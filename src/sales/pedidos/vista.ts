import "server-only";

import { obtenerPedidos, obtenerPedidosKpis, type PedidosFiltros, type PedidosKpis } from "./queries";
import { rangoHoy, rangoManana, rangoMesHastaAhora } from "@/shared/fechas/rangos";
import { parsearExtremosDeSearchParams } from "@/shared/fechas/searchparams";
import type { FiltrosVistaPedidos } from "./schema";
import type { Pedido } from "./types";

export interface EtapaFlujoVista {
  id: string;
  nombre: string;
  color: string | null;
  esFinal: boolean;
  esCancelacion: boolean;
  esSecuencial: boolean;
  orden: number;
  parentId: string | null;
}

export interface VistaPedidos {
  pedidos: Pedido[];
  kpis: PedidosKpis;
  /** Hay un rango de fechas activo que obliga a mostrar también los cerrados. */
  cerradosForzados: boolean;
  /** El usuario eligió algún filtro explícito (no cuenta el ocultamiento de cerrados). */
  hayFiltrosActivos: boolean;
  hayRangoFecha: boolean;
}

/**
 * Traduce los filtros de la barra a la consulta de Pedidos. Lo usan la página
 * (con los filtros por defecto, para el primer render) y la Server Action que
 * consulta la barra al cambiar un filtro — una sola regla para los dos.
 */
export async function cargarVistaPedidos(
  instanciaId: string,
  zonaHoraria: string,
  f: FiltrosVistaPedidos,
  etapasFlujo: EtapaFlujoVista[],
): Promise<VistaPedidos> {
  // "Entrega estimada": hoy/mañana se resuelven en la zona horaria de negocio
  // (no en la del servidor ni la del navegador). Personalizado usa el rango tal
  // cual lo eligió el usuario, interpretado como día completo en esa zona.
  let entregaDesde: Date | undefined;
  let entregaHasta: Date | undefined;
  if (f.entrega === "hoy") {
    ({ desde: entregaDesde, hasta: entregaHasta } = rangoHoy(zonaHoraria));
  } else if (f.entrega === "manana") {
    ({ desde: entregaDesde, hasta: entregaHasta } = rangoManana(zonaHoraria));
  } else if (f.entrega === "personalizado") {
    ({ desde: entregaDesde, hasta: entregaHasta } = parsearExtremosDeSearchParams(
      { entregaDesde: f.entregaDesde ?? undefined, entregaHasta: f.entregaHasta ?? undefined },
      zonaHoraria,
      { prefijo: "entrega" },
    ));
  }

  // Rango sobre `fechaPedido`.
  const { desde: fechaPedidoDesde, hasta: fechaPedidoHasta } = parsearExtremosDeSearchParams(
    { desde: f.desde ?? undefined, hasta: f.hasta ?? undefined },
    zonaHoraria,
  );

  // "Ver cerrados" oculta por default las etapas esFinal/esCancelacion.
  const etapaIdsCerradas = etapasFlujo.length > 0
    ? etapasFlujo.filter((e) => e.esFinal || e.esCancelacion).map((e) => e.id)
    : undefined;

  // Un rango de fechas es una consulta sobre el histórico, y ahí casi todo ya
  // está entregado o cancelado. Ocultar los cerrados vaciaba la tabla mientras
  // los KPIs del mismo rango seguían sumándolos (obtenerPedidosKpis no aplica
  // ocultarCerrados, sus totales son históricos por diseño), lo que se leía
  // como que el filtro de fecha no funcionaba. Con un rango activo, el rango
  // manda: lista y montos miran la misma población.
  const hayFiltroFecha = Boolean(fechaPedidoDesde || fechaPedidoHasta || entregaDesde || entregaHasta);

  const filtros: PedidosFiltros = {
    busqueda: f.q || undefined,
    desde: fechaPedidoDesde,
    hasta: fechaPedidoHasta,
    // "estado" (enum legacy) y "etapa" (Flujo de Venta dinámico) son
    // mutuamente excluyentes en la práctica — la barra de filtros ofrece uno
    // u otro según si el tenant tiene un flujo dinámico activo.
    estado: f.estado || undefined,
    flujoVentaEtapaId: f.etapa || undefined,
    metodoEntrega: f.metodo || undefined,
    contactoId: f.contactoId || undefined,
    productoId: f.productoId || undefined,
    entregaDesde,
    entregaHasta,
    ocultarCerrados: !f.cerrados && !hayFiltroFecha,
    etapaIdsCerradas,
  };

  const [datos, kpis] = await Promise.all([
    obtenerPedidos(instanciaId, filtros),
    obtenerPedidosKpis(instanciaId, filtros, rangoMesHastaAhora(zonaHoraria)),
  ]);

  const pedidos = datos.map((p) => ({
    ...p,
    subtotal:   Number(p.subtotal),
    descuento:  Number(p.descuento),
    impuesto:   Number(p.impuesto),
    costoEnvio: Number(p.costoEnvio),
    total:      Number(p.total),
  })) as unknown as Pedido[];

  return {
    pedidos,
    kpis,
    cerradosForzados: hayFiltroFecha && !f.cerrados,
    // "ocultarCerrados"/"etapaIdsCerradas" son estado derivado, no filtros que
    // el usuario haya elegido — no cuentan para decidir entre "Sin pedidos
    // todavía" y "No encontramos pedidos con estos filtros".
    hayFiltrosActivos: Boolean(
      filtros.busqueda || filtros.desde || filtros.hasta || filtros.estado ||
      filtros.flujoVentaEtapaId || filtros.metodoEntrega || filtros.contactoId ||
      filtros.productoId || filtros.entregaDesde || filtros.entregaHasta
    ),
    hayRangoFecha: Boolean(filtros.desde || filtros.hasta),
  };
}
