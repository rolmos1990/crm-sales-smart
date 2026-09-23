import "server-only";

import { obtenerOportunidades, obtenerOportunidadesKpis, type OportunidadesFiltros, type OportunidadesKpis } from "./queries";
import { parsearExtremosDeSearchParams } from "@/shared/fechas/searchparams";
import type { Etapa, Oportunidad } from "./types";

/** Claves que entiende la barra de filtros de Oportunidades. */
export const CLAVES_VISTA_OPORTUNIDADES = [
  "q", "productoIds", "contactoIds", "vencimiento", "vencDesde", "vencHasta", "etapaId", "etapa",
  "estado", "responsable", "tagIds", "empresaId", "valorMin", "valorMax", "probMin", "probMax",
  "creadoDesde", "creadoHasta", "cotizacion", "actividadPendiente", "sinActividadReciente",
] as const;

export type FiltrosVistaOportunidades = Partial<Record<(typeof CLAVES_VISTA_OPORTUNIDADES)[number], string>>;

export interface VistaOportunidades {
  oportunidades: Oportunidad[];
  kpis: OportunidadesKpis;
  hayFiltrosActivos: boolean;
}

const csvAArray = (v?: string) => (v ? v.split(",").filter(Boolean) : undefined);

/**
 * Traduce los filtros de la barra (mismo formato clave → string que tenían en
 * la URL) a la consulta. Lo usan la página (sin filtros, primer render) y la
 * Server Action que consulta la barra al cambiar un filtro.
 */
export async function cargarVistaOportunidades(
  instanciaId: string,
  zonaHoraria: string,
  sp: FiltrosVistaOportunidades,
): Promise<VistaOportunidades> {
  // Los "YYYY-MM-DD" se interpretan en la zona de negocio, nunca en la del
  // proceso servidor — ver docs/fechas-y-zonas-horarias.md.
  const creado = parsearExtremosDeSearchParams(sp, zonaHoraria, { prefijo: "creado" });
  const venc = parsearExtremosDeSearchParams(sp, zonaHoraria, { prefijo: "venc" });

  const filtros: OportunidadesFiltros = {
    busqueda: sp.q || undefined,
    productoIds: csvAArray(sp.productoIds),
    contactoIds: csvAArray(sp.contactoIds),
    empresaId: sp.empresaId || undefined,
    usuarioId: sp.responsable || undefined,
    tagIds: csvAArray(sp.tagIds),
    etapaId: sp.etapaId || undefined,
    etapaLegacy: (sp.etapa as Etapa) || undefined,
    estado: (sp.estado as OportunidadesFiltros["estado"]) || undefined,
    valorMin: sp.valorMin ? Number(sp.valorMin) : undefined,
    valorMax: sp.valorMax ? Number(sp.valorMax) : undefined,
    probabilidadMin: sp.probMin ? Number(sp.probMin) : undefined,
    probabilidadMax: sp.probMax ? Number(sp.probMax) : undefined,
    creadoDesde: creado.desde,
    creadoHasta: creado.hasta,
    conCotizacion: sp.cotizacion === "con" ? true : sp.cotizacion === "sin" ? false : undefined,
    conActividadesPendientes: sp.actividadPendiente === "1" || undefined,
    sinActividadReciente: sp.sinActividadReciente === "1" || undefined,
    vencimiento: (sp.vencimiento as OportunidadesFiltros["vencimiento"]) || undefined,
    vencDesde: venc.desde,
    vencHasta: venc.hasta,
  };

  const [datos, kpis] = await Promise.all([
    obtenerOportunidades(instanciaId, filtros, zonaHoraria),
    obtenerOportunidadesKpis(instanciaId, filtros, zonaHoraria),
  ]);

  return {
    oportunidades: datos.map((o) => ({ ...o, valor: Number(o.valor) })) as unknown as Oportunidad[],
    kpis,
    hayFiltrosActivos: CLAVES_VISTA_OPORTUNIDADES.some((k) => sp[k]),
  };
}
