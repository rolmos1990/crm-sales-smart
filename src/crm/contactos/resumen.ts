import { prisma } from "@/shared/db/prisma";
import { construirCondicionVenta, type EtapaParaKpis } from "@/sales/pedidos/condicion-venta";
import { condicionCliente, condicionInteresado, type EstadoSeguimiento, type TipoComercial } from "./segmentacion/condiciones";
import type { CortesSeguimiento } from "./segmentacion/cortes";
import { obtenerAnalisisContacto, type AnalisisContacto } from "./analisis/queries";
import {
  calcularRecomendacion,
  calcularSeguimientoFila,
  type NivelInteresValor,
  type Recomendacion,
} from "./segmentacion/recomendacion";

type Origen = "MANUAL" | "REGLA" | "IA";

export interface ResumenContacto {
  /** 042 — sección "Análisis de IA" del panel. */
  analisis: AnalisisContacto;
  contacto: {
    id: string;
    nombre: string;
    apellido: string;
    email: string | null;
    telefonoPrincipal: string | null;
    telefonoSecundario: string | null;
    avatarUrl: string | null;
    empresa: { id: string; nombre: string } | null;
    etiquetas: Array<{ id: string; nombre: string; color: string | null }>;
    canales: Array<{ canal: string; identificador: string; handle: string | null }>;
    tipo: TipoComercial;
    esInteresado: boolean;
    interes: NivelInteresValor;
    interesOrigen: Origen | null;
    interesFijado: boolean;
    noContactar: { desde: string; origen: Origen | null; porNombre: string | null } | null;
    seguimiento: EstadoSeguimiento;
    recomendacion: Recomendacion;
  };
  actividadComercial: {
    ultimaCompra: { pedidoId: string; numero: string; fecha: string } | null;
    oportunidadesAbiertas: Array<{ id: string; titulo: string; etapa: string }>;
    actividadesPendientes: Array<{ id: string; titulo: string; fecha: string; vencida: boolean }>;
    ultimaInteraccionEn: string | null;
  };
  historial: Array<{
    dimension: "INTERES" | "PREFERENCIA_CONTACTO";
    valorAnterior: string | null;
    valorNuevo: string;
    origen: Origen;
    usuarioNombre: string | null;
    creadoEn: string;
  }>;
}

async function nombresDeUsuarios(instanciaId: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const filas = await prisma.usuarioInstancia.findMany({
    where: { id: { in: ids }, instanciaId },
    select: { id: true, usuario: { select: { nombre: true } } },
  });
  return new Map(filas.map((f) => [f.id, f.usuario.nombre]));
}

/**
 * 041 — Datos del panel lateral. `null` si el contacto no existe o es de otra
 * instancia. Tipo y seguimiento salen de las MISMAS reglas que la lista.
 */
export async function obtenerResumenContacto(
  contactoId: string,
  instanciaId: string,
  etapas: EtapaParaKpis[],
  cortes: CortesSeguimiento,
): Promise<ResumenContacto | null> {
  const c = await prisma.contacto.findFirst({
    where: { id: contactoId, instanciaId },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      telefonoPrincipal: true,
      telefonoSecundario: true,
      avatarUrl: true,
      creadoEn: true,
      nivelInteres: true,
      nivelInteresOrigen: true,
      nivelInteresFijado: true,
      noContactarDesde: true,
      noContactarOrigen: true,
      noContactarPorId: true,
      ultimaInteraccionEn: true,
      esperandoRespuestaDesde: true,
      empresa: { select: { id: true, nombre: true } },
      tags: { select: { tag: { select: { id: true, nombre: true, color: true } } } },
      identificadoresCanal: { select: { canal: true, identificador: true, handle: true } },
    },
  });
  if (!c) return null;

  const deEste = { id: contactoId, instanciaId };
  const [esCliente, esInteresado, ultimaCompra, oportunidades, pendientes, vencida, vigente, historial] = await Promise.all([
    prisma.contacto.count({ where: { AND: [deEste, condicionCliente(etapas)] } }).then((n) => n > 0),
    prisma.contacto.count({ where: { AND: [deEste, condicionInteresado()] } }).then((n) => n > 0),
    prisma.pedido.findFirst({
      where: { contactoId, instanciaId, ...construirCondicionVenta(etapas) },
      orderBy: [{ fechaVenta: { sort: "desc", nulls: "last" } }, { creadoEn: "desc" }],
      select: { id: true, numero: true, fechaVenta: true, creadoEn: true },
    }),
    prisma.oportunidadContacto.findMany({
      where: { contactoId, oportunidad: { instanciaId, fechaGanada: null, fechaPerdida: null } },
      select: { oportunidad: { select: { id: true, titulo: true, etapa: true, stage: { select: { nombre: true } } } } },
      take: 5,
    }),
    prisma.actividad.findMany({
      where: { contactoId, instanciaId, completada: false },
      orderBy: { fecha: "asc" },
      select: { id: true, titulo: true, fecha: true },
      take: 5,
    }),
    prisma.actividad.count({ where: { contactoId, completada: false, fecha: { lt: cortes.ahora } } }).then((n) => n > 0),
    prisma.actividad.count({ where: { contactoId, completada: false, fecha: { gte: cortes.ahora } } }).then((n) => n > 0),
    prisma.contactoClasificacionHistorial.findMany({
      where: { contactoId, instanciaId },
      orderBy: { creadoEn: "desc" },
      take: 10,
      select: { dimension: true, valorAnterior: true, valorNuevo: true, origen: true, usuarioInstanciaId: true, creadoEn: true },
    }),
  ]);

  const nombres = await nombresDeUsuarios(
    instanciaId,
    [c.noContactarPorId, ...historial.map((h) => h.usuarioInstanciaId)].filter((x): x is string => Boolean(x)),
  );

  const noContactar = c.noContactarDesde !== null;
  const esperandoRespuesta = c.esperandoRespuestaDesde !== null;
  const seguimiento = calcularSeguimientoFila(
    {
      ultimaInteraccionEn: c.ultimaInteraccionEn,
      creadoEn: c.creadoEn,
      esperandoRespuesta,
      tieneActividadVencida: vencida,
      tieneActividadVigente: vigente,
      esInteresado,
      noContactar,
    },
    cortes,
  );
  const recomendacion = calcularRecomendacion({ noContactar, esperandoRespuesta, seguimiento, esCliente, esInteresado, interes: c.nivelInteres });
  const analisis = await obtenerAnalisisContacto(instanciaId, contactoId, recomendacion, c.nivelInteresFijado);

  return {
    analisis,
    contacto: {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      email: c.email,
      telefonoPrincipal: c.telefonoPrincipal,
      telefonoSecundario: c.telefonoSecundario,
      avatarUrl: c.avatarUrl,
      empresa: c.empresa,
      etiquetas: c.tags.map((t) => t.tag),
      canales: c.identificadoresCanal,
      tipo: esCliente ? "CLIENTE" : esInteresado ? "INTERESADO" : "LEAD",
      esInteresado,
      interes: c.nivelInteres,
      interesOrigen: c.nivelInteresOrigen,
      interesFijado: c.nivelInteresFijado,
      noContactar: c.noContactarDesde
        ? {
            desde: c.noContactarDesde.toISOString(),
            origen: c.noContactarOrigen,
            porNombre: c.noContactarPorId ? (nombres.get(c.noContactarPorId) ?? null) : null,
          }
        : null,
      seguimiento,
      recomendacion,
    },
    actividadComercial: {
      ultimaCompra: ultimaCompra
        ? { pedidoId: ultimaCompra.id, numero: ultimaCompra.numero, fecha: (ultimaCompra.fechaVenta ?? ultimaCompra.creadoEn).toISOString() }
        : null,
      oportunidadesAbiertas: oportunidades.map((o) => ({
        id: o.oportunidad.id,
        titulo: o.oportunidad.titulo,
        etapa: o.oportunidad.stage?.nombre ?? o.oportunidad.etapa,
      })),
      actividadesPendientes: pendientes.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        fecha: a.fecha.toISOString(),
        vencida: a.fecha < cortes.ahora,
      })),
      ultimaInteraccionEn: c.ultimaInteraccionEn?.toISOString() ?? null,
    },
    historial: historial.map((h) => ({
      dimension: h.dimension,
      valorAnterior: h.valorAnterior,
      valorNuevo: h.valorNuevo,
      origen: h.origen,
      usuarioNombre: h.usuarioInstanciaId ? (nombres.get(h.usuarioInstanciaId) ?? null) : null,
      creadoEn: h.creadoEn.toISOString(),
    })),
  };
}
