import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import type { EtapaParaKpis } from "@/sales/pedidos/condicion-venta";
import { construirCondicionVenta } from "@/sales/pedidos/condicion-venta";
import { ESTADOS_COTIZACION_ACTIVA, condicionInteresado } from "@/crm/contactos/segmentacion/condiciones";
import type { CortesSeguimiento } from "@/crm/contactos/segmentacion/cortes";
import { calcularSeguimientoFila } from "@/crm/contactos/segmentacion/recomendacion";
import type { DatosContactoLote, EvaluacionPrevia } from "./types";

/**
 * 042 — Carga en bloque los datos de un lote (research D6): un número fijo de
 * consultas por lote, nunca una por contacto. Cliente e Interesado salen de
 * las MISMAS condiciones que usa la lista de la 041 (`construirCondicionVenta`
 * y `condicionInteresado`), así el análisis no puede contradecir a la tabla.
 *
 * Todo filtrado por `instanciaId`: un id de otra cuenta que se cuele en el
 * lote simplemente no aparece en el resultado (FR-054).
 */
export async function cargarDatosLote(
  instanciaId: string,
  contactoIds: string[],
  etapas: EtapaParaKpis[],
  cortes: CortesSeguimiento,
): Promise<Map<string, DatosContactoLote>> {
  const resultado = new Map<string, DatosContactoLote>();
  if (contactoIds.length === 0) return resultado;

  const ahora = cortes.ahora;
  const deIds = { id: { in: contactoIds }, instanciaId };

  const [contactos, compras, cotizaciones, oportunidades, vencidas, vigentes, interesados, evaluaciones, ultimosMensajes] = await Promise.all([
    prisma.contacto.findMany({
      where: deIds,
      select: {
        id: true,
        creadoEn: true,
        ultimaInteraccionEn: true,
        esperandoRespuestaDesde: true,
        noContactarDesde: true,
        nivelInteres: true,
        nivelInteresFijado: true,
      },
    }),
    prisma.pedido.groupBy({
      by: ["contactoId"],
      where: { contactoId: { in: contactoIds }, instanciaId, ...construirCondicionVenta(etapas) },
      _count: { _all: true },
      _sum: { total: true },
      _max: { fechaVenta: true, creadoEn: true },
    }),
    prisma.cotizacion.groupBy({
      by: ["contactoId"],
      where: { contactoId: { in: contactoIds }, instanciaId, estado: { in: [...ESTADOS_COTIZACION_ACTIVA] } },
      _count: { _all: true },
    }),
    prisma.oportunidadContacto.groupBy({
      by: ["contactoId"],
      where: { contactoId: { in: contactoIds }, oportunidad: { instanciaId, fechaGanada: null, fechaPerdida: null } },
      _count: { _all: true },
    }),
    prisma.actividad.findMany({
      where: { contactoId: { in: contactoIds }, instanciaId, completada: false, fecha: { lt: ahora } },
      select: { contactoId: true },
      distinct: ["contactoId"],
    }),
    prisma.actividad.groupBy({
      by: ["contactoId"],
      where: { contactoId: { in: contactoIds }, instanciaId, completada: false, fecha: { gte: ahora } },
      _min: { fecha: true },
    }),
    prisma.contacto.findMany({ where: { AND: [deIds, condicionInteresado()] }, select: { id: true } }),
    prisma.contactoEvaluacion.findMany({
      where: { contactoId: { in: contactoIds }, instanciaId },
      select: {
        contactoId: true,
        puntaje: true,
        ajusteIA: true,
        accionIA: true,
        versionEvaluada: true,
        intencion: true,
        senales: true,
        iaHasta: true,
        evaluadoIAEn: true,
        noContactarResueltoEn: true,
        interesSugerido: true,
        interesSugeridoEstado: true,
      },
    }),
    // Último mensaje (de cualquier lado) por contacto: decide si hay contenido
    // nuevo para la IA desde `iaHasta` (embudo, research D5).
    prisma.$queryRaw<Array<{ contactoId: string; ultimo: Date }>>`
      SELECT c."contactoId", MAX(m."creadoEn") AS ultimo
      FROM "MensajeConversacion" m
      JOIN "Conversacion" c ON c."id" = m."conversacionId"
      WHERE c."instanciaId" = ${instanciaId} AND c."contactoId" IN (${Prisma.join(contactoIds)})
      GROUP BY c."contactoId"`,
  ]);

  const porContacto = <T extends { contactoId: string | null }>(filas: T[]) =>
    new Map(filas.filter((f): f is T & { contactoId: string } => f.contactoId !== null).map((f) => [f.contactoId, f]));

  const comprasPor = porContacto(compras);
  const cotizacionesPor = porContacto(cotizaciones);
  const oportunidadesPor = porContacto(oportunidades);
  const vigentesPor = porContacto(vigentes);
  const vencidasSet = new Set(vencidas.map((a) => a.contactoId).filter((x): x is string => Boolean(x)));
  const interesadosSet = new Set(interesados.map((c) => c.id));
  const evaluacionesPor = new Map(evaluaciones.map((e) => [e.contactoId, e]));
  const ultimoMensajePor = new Map(ultimosMensajes.map((m) => [m.contactoId, m.ultimo]));

  for (const c of contactos) {
    const compra = comprasPor.get(c.id);
    const nCompras = compra?._count._all ?? 0;
    const proximaActividadEn = vigentesPor.get(c.id)?._min.fecha ?? null;
    const esInteresado = interesadosSet.has(c.id);
    const noContactar = c.noContactarDesde !== null;
    const esperandoRespuesta = c.esperandoRespuestaDesde !== null;
    const tieneActividadVencida = vencidasSet.has(c.id);
    const tieneActividadVigente = proximaActividadEn !== null;
    const ev = evaluacionesPor.get(c.id);

    const evaluacionPrevia: EvaluacionPrevia | null = ev
      ? {
          puntaje: ev.puntaje,
          ajusteIA: ev.ajusteIA,
          accionIA: ev.accionIA,
          versionEvaluada: ev.versionEvaluada,
          intencion: ev.intencion,
          senales: Array.isArray(ev.senales) ? (ev.senales as string[]) : [],
          iaHasta: ev.iaHasta,
          evaluadoIAEn: ev.evaluadoIAEn,
          noContactarResueltoEn: ev.noContactarResueltoEn,
          interesSugerido: ev.interesSugerido,
          interesSugeridoEstado: ev.interesSugeridoEstado,
        }
      : null;

    resultado.set(c.id, {
      contactoId: c.id,
      creadoEn: c.creadoEn,
      ultimaInteraccionEn: c.ultimaInteraccionEn,
      esperandoRespuesta,
      noContactar,
      nivelInteres: c.nivelInteres,
      nivelInteresFijado: c.nivelInteresFijado,
      compras: nCompras,
      valorCompras: Number(compra?._sum.total ?? 0),
      // Mismo criterio que el perfil 012: fechaVenta, y si un pedido viejo no la tiene, su creación.
      ultimaCompraEn: compra ? (compra._max.fechaVenta ?? compra._max.creadoEn ?? null) : null,
      cotizacionesActivas: cotizacionesPor.get(c.id)?._count._all ?? 0,
      oportunidadesAbiertas: oportunidadesPor.get(c.id)?._count._all ?? 0,
      tieneActividadVencida,
      tieneActividadVigente,
      proximaActividadEn,
      esCliente: nCompras > 0,
      esInteresado,
      seguimiento: calcularSeguimientoFila(
        {
          ultimaInteraccionEn: c.ultimaInteraccionEn,
          creadoEn: c.creadoEn,
          esperandoRespuesta,
          tieneActividadVencida,
          tieneActividadVigente,
          esInteresado,
          noContactar,
        },
        cortes,
      ),
      ultimoMensajeEn: ultimoMensajePor.get(c.id) ?? null,
      evaluacionPrevia,
    });
  }
  return resultado;
}
