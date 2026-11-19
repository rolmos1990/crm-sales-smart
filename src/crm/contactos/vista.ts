import type { Prisma } from "@/generated/prisma/client";
import type { EtapaParaKpis } from "@/sales/pedidos/condicion-venta";
import { prisma } from "@/shared/db/prisma";
import type { FiltrosVistaContactos } from "./schema";
import { VALORES_POR_GRUPO_CANAL, grupoDeCanal } from "./segmentacion/canales";
import {
  TRAMOS,
  condicionCliente,
  condicionInteresado,
  condicionLead,
  condicionSegmento,
  condicionSeguimiento,
  condicionTipo,
  condicionTramo,
  type Tramo,
} from "./segmentacion/condiciones";
import { calcularCortes, filtroUltimaActividad, type CortesSeguimiento, type UmbralesSeguimiento } from "./segmentacion/cortes";
import { planificarTramos } from "./segmentacion/paginacion";
import { calcularRecomendacion, calcularSeguimientoFila } from "./segmentacion/recomendacion";
import type { FilaContacto, IndicadoresContactos, VistaContactos } from "./types";

type Where = Prisma.ContactoWhereInput;

const SELECT_FILA = {
  id: true,
  nombre: true,
  apellido: true,
  avatarUrl: true,
  telefonoPrincipal: true,
  email: true,
  nivelInteres: true,
  nivelInteresFijado: true,
  noContactarDesde: true,
  ultimaInteraccionEn: true,
  esperandoRespuestaDesde: true,
  creadoEn: true,
  puntajeComercial: true,
} satisfies Prisma.ContactoSelect;

type ContactoFila = Prisma.ContactoGetPayload<{ select: typeof SELECT_FILA }>;

const ORDEN_RECIENTE: Prisma.ContactoOrderByWithRelationInput[] = [
  { ultimaInteraccionEn: { sort: "desc", nulls: "last" } },
  // Entre los que nunca tuvieron actividad, los recién creados primero.
  { creadoEn: "desc" },
  { id: "asc" },
];

export function hayFiltrosActivos(f: FiltrosVistaContactos): boolean {
  return Boolean(
    f.busqueda || f.tipo || f.interes || f.canal || f.ultimaActividad || f.seguimiento || f.preferencia || f.segmento !== "TODOS",
  );
}

/** El `where` de la barra (segmento + filtros). Instancia siempre incluida. */
export function construirWhereVista(
  instanciaId: string,
  zonaNegocio: string,
  f: FiltrosVistaContactos,
  etapas: EtapaParaKpis[],
  cortes: CortesSeguimiento,
): Where {
  const y: Where[] = [{ instanciaId }];

  if (f.busqueda) {
    const contiene = { contains: f.busqueda, mode: "insensitive" as const };
    y.push({
      OR: [
        { nombre: contiene },
        { apellido: contiene },
        { email: contiene },
        { telefonoPrincipal: contiene },
        { telefonoSecundario: contiene },
      ],
    });
  }
  if (f.segmento !== "TODOS") y.push(condicionSegmento(f.segmento, etapas, cortes));
  if (f.tipo) y.push(condicionTipo(f.tipo, etapas));
  if (f.interes) y.push({ nivelInteres: f.interes });
  if (f.canal) y.push({ identificadoresCanal: { some: { canal: { in: [...VALORES_POR_GRUPO_CANAL[f.canal]] } } } });
  if (f.ultimaActividad) {
    const filtro = filtroUltimaActividad(f.ultimaActividad, zonaNegocio, cortes.ahora);
    y.push(filtro ? { ultimaInteraccionEn: filtro } : { ultimaInteraccionEn: null });
  }
  if (f.seguimiento) y.push(condicionSeguimiento(f.seguimiento, cortes));
  if (f.preferencia) y.push({ noContactarDesde: f.preferencia === "NO_CONTACTAR" ? { not: null } : null });

  return { AND: y };
}

export function ordenSimple(f: FiltrosVistaContactos): Prisma.ContactoOrderByWithRelationInput[] {
  switch (f.orden) {
    case "NOMBRE": {
      const dir = f.direccion ?? "asc";
      return [{ nombre: dir }, { apellido: dir }, { id: "asc" }];
    }
    case "ULTIMA_ACTIVIDAD":
      return [{ ultimaInteraccionEn: { sort: f.direccion ?? "desc", nulls: "last" } }, { id: "asc" }];
    case "INTERES":
      // El orden del enum NivelInteres es Alto → Sin evaluar.
      return [{ nivelInteres: f.direccion ?? "asc" }, ...ORDEN_RECIENTE];
    case "PUNTAJE":
      // 042 — Sin evaluación al final en ambas direcciones (FR-052a).
      return [{ puntajeComercial: { sort: f.direccion ?? "desc", nulls: "last" } }, ...ORDEN_RECIENTE];
    case "PRIORIDAD":
      return ORDEN_RECIENTE;
  }
}

export async function obtenerIndicadores(
  instanciaId: string,
  etapas: EtapaParaKpis[],
  cortes: CortesSeguimiento,
): Promise<IndicadoresContactos> {
  const contar = (w: Where) => prisma.contacto.count({ where: { AND: [{ instanciaId }, w] } });
  const [total, clientes, interesados, porRecuperar, leads] = await Promise.all([
    contar({}),
    contar(condicionCliente(etapas)),
    contar(condicionInteresado()),
    contar(condicionSeguimiento("POR_RECUPERAR", cortes)),
    contar(condicionLead(etapas)),
  ]);
  return { total, clientes, interesados, porRecuperar, leads };
}

async function leerPagina(
  where: Where,
  f: FiltrosVistaContactos,
  total: number,
  cortes: CortesSeguimiento,
): Promise<{ filas: ContactoFila[]; pagina: number }> {
  const totalPaginas = Math.max(1, Math.ceil(total / f.tamanoPagina));
  const pagina = Math.min(f.pagina, totalPaginas);
  const skip = (pagina - 1) * f.tamanoPagina;

  if (f.orden !== "PRIORIDAD") {
    const filas = await prisma.contacto.findMany({ where, select: SELECT_FILA, orderBy: ordenSimple(f), skip, take: f.tamanoPagina });
    return { filas, pagina };
  }

  const conteos = await Promise.all(
    TRAMOS.map((t) => prisma.contacto.count({ where: { AND: [where, condicionTramo(t, cortes)] } })),
  );
  const porTramo = Object.fromEntries(TRAMOS.map((t, i) => [t, conteos[i]])) as Record<Tramo, number>;
  const plan = planificarTramos(porTramo, skip, f.tamanoPagina);
  const trozos = await Promise.all(
    plan.map((r) =>
      prisma.contacto.findMany({
        where: { AND: [where, condicionTramo(r.tramo, cortes)] },
        select: SELECT_FILA,
        orderBy: ORDEN_RECIENTE,
        skip: r.skip,
        take: r.take,
      }),
    ),
  );
  return { filas: trozos.flat(), pagina };
}

/**
 * Datos de relación para las filas de la página, en lote (no N+1): quién es
 * cliente o interesado, quién tiene actividades pendientes y el canal de su
 * última conversación. Cliente e Interesado usan las MISMAS condiciones que
 * los filtros, así la fila nunca contradice al indicador.
 */
async function enriquecer(ids: string[], instanciaId: string, etapas: EtapaParaKpis[], ahora: Date) {
  if (ids.length === 0) {
    return { clientes: new Set<string>(), interesados: new Set<string>(), vencidas: new Set<string>(), vigentes: new Set<string>(), canales: new Map<string, string | null>() };
  }
  const deIds = { id: { in: ids }, instanciaId };
  const [clientes, interesados, vencidas, vigentes, conversaciones] = await Promise.all([
    prisma.contacto.findMany({ where: { AND: [deIds, condicionCliente(etapas)] }, select: { id: true } }),
    prisma.contacto.findMany({ where: { AND: [deIds, condicionInteresado()] }, select: { id: true } }),
    prisma.actividad.findMany({
      where: { contactoId: { in: ids }, completada: false, fecha: { lt: ahora } },
      select: { contactoId: true },
      distinct: ["contactoId"],
    }),
    prisma.actividad.findMany({
      where: { contactoId: { in: ids }, completada: false, fecha: { gte: ahora } },
      select: { contactoId: true },
      distinct: ["contactoId"],
    }),
    prisma.conversacion.findMany({
      where: { contactoId: { in: ids }, instanciaId },
      orderBy: { actualizadoEn: "desc" },
      select: { contactoId: true, cuentaCanal: { select: { canal: true } } },
      distinct: ["contactoId"],
    }),
  ]);
  return {
    clientes: new Set(clientes.map((c) => c.id)),
    interesados: new Set(interesados.map((c) => c.id)),
    vencidas: new Set(vencidas.map((a) => a.contactoId).filter((x): x is string => Boolean(x))),
    vigentes: new Set(vigentes.map((a) => a.contactoId).filter((x): x is string => Boolean(x))),
    canales: new Map(conversaciones.map((c) => [c.contactoId, c.cuentaCanal?.canal ?? null])),
  };
}

export async function cargarVistaContactos(
  instanciaId: string,
  zonaNegocio: string,
  filtros: FiltrosVistaContactos,
  etapas: EtapaParaKpis[],
  umbrales: UmbralesSeguimiento,
  ahora: Date = new Date(),
): Promise<VistaContactos> {
  const cortes = calcularCortes(zonaNegocio, umbrales, ahora);
  const where = construirWhereVista(instanciaId, zonaNegocio, filtros, etapas, cortes);

  const [indicadores, total] = await Promise.all([
    obtenerIndicadores(instanciaId, etapas, cortes),
    prisma.contacto.count({ where }),
  ]);
  const { filas, pagina } = await leerPagina(where, filtros, total, cortes);
  const extra = await enriquecer(filas.map((f) => f.id), instanciaId, etapas, ahora);

  return {
    indicadores,
    filas: filas.map((c) => construirFila(c, extra, cortes)),
    total,
    pagina,
    tamanoPagina: filtros.tamanoPagina,
    hayFiltrosActivos: hayFiltrosActivos(filtros),
  };
}

function construirFila(
  c: ContactoFila,
  extra: Awaited<ReturnType<typeof enriquecer>>,
  cortes: CortesSeguimiento,
): FilaContacto {
  const esCliente = extra.clientes.has(c.id);
  const esInteresado = extra.interesados.has(c.id);
  const noContactar = c.noContactarDesde !== null;
  const esperandoRespuesta = c.esperandoRespuestaDesde !== null;
  const seguimiento = calcularSeguimientoFila(
    {
      ultimaInteraccionEn: c.ultimaInteraccionEn,
      creadoEn: c.creadoEn,
      esperandoRespuesta,
      tieneActividadVencida: extra.vencidas.has(c.id),
      tieneActividadVigente: extra.vigentes.has(c.id),
      esInteresado,
      noContactar,
    },
    cortes,
  );
  return {
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    avatarUrl: c.avatarUrl,
    datoSecundario: c.telefonoPrincipal ?? c.email,
    tipo: esCliente ? "CLIENTE" : esInteresado ? "INTERESADO" : "LEAD",
    esInteresado,
    interes: c.nivelInteres,
    interesFijado: c.nivelInteresFijado,
    noContactar,
    ultimaInteraccionEn: c.ultimaInteraccionEn?.toISOString() ?? null,
    canal: grupoDeCanal(extra.canales.get(c.id)),
    seguimiento,
    puntaje: c.puntajeComercial,
    recomendacion: calcularRecomendacion({
      noContactar,
      esperandoRespuesta,
      seguimiento,
      esCliente,
      esInteresado,
      interes: c.nivelInteres,
    }),
  };
}
