// Lógica pura de armado de filtros (Prisma `where`) para Oportunidades —
// sin I/O, sin importar la instancia compartida de Prisma, para poder
// testearla de forma aislada (ver filtros-oportunidades.test.ts). Solo
// importa el tipo `Prisma` (se borra en compilación) y utilidades de fecha
// puras. `queries.ts` importa estas funciones y las combina con llamadas
// reales a la base de datos.
import type { Prisma } from "@/generated/prisma/client";
import type { Etapa } from "@/generated/prisma/enums";
import { rangoDiaEnZona } from "@/sales/pedidos/utils/fechas-zona";

export interface OportunidadesFiltros {
  /** Busca por título de la oportunidad, nombre/apellido del contacto o
   *  nombre de la empresa. */
  busqueda?: string;
  productoIds?: string[];
  contactoIds?: string[];
  empresaId?: string;
  /** Responsable — Oportunidad.usuarioId. */
  usuarioId?: string;
  tagIds?: string[];
  /** Etapa del pipeline dinámico (PipelineStage.id) — tiene prioridad sobre
   *  `etapaLegacy` cuando el tenant tiene pipelines configurados. */
  etapaId?: string;
  /** Etapa del enum legacy — solo relevante para oportunidades sin pipeline
   *  dinámico asignado (stageId null). Mutuamente excluyente con `etapaId`
   *  en la práctica, igual que "estado"/"flujoVentaEtapaId" en Pedidos. */
  etapaLegacy?: Etapa;
  /** Activas = ni ganada ni perdida, considerando pipeline dinámico
   *  (stage.esGanado/esPerdido) o enum legacy según cuál aplique por
   *  registro — ver condicionEstado(). "Todas" no agrega condición. */
  estado?: "activas" | "ganadas" | "perdidas" | "todas";
  valorMin?: number;
  valorMax?: number;
  probabilidadMin?: number;
  probabilidadMax?: number;
  creadoDesde?: Date;
  creadoHasta?: Date;
  /** true = solo con al menos una cotización, false = solo sin ninguna. */
  conCotizacion?: boolean;
  /** true = con al menos una actividad no completada. */
  conActividadesPendientes?: boolean;
  /** true = sin ninguna actividad en la ventana "reciente" (ver
   *  DIAS_ACTIVIDAD_RECIENTE) — incluye oportunidades sin actividades. */
  sinActividadReciente?: boolean;
  /** Rango de vencimiento (Oportunidad.fechaCierre en el modelo — se
   *  muestra como "Vencimiento" en la UI). No se incluye en
   *  construirWhereBase(): los indicadores "Por vencer"/"Vencidas" calculan
   *  su propia condición de fecha sin importar qué filtro rápido de
   *  vencimiento esté aplicado en la tabla (mismo criterio que
   *  "Total ventas · mes actual" en Pedidos). */
  vencimiento?: "vencidas" | "hoy" | "7dias" | "30dias" | "sinfecha" | "personalizado";
  vencDesde?: Date;
  vencHasta?: Date;
}

/** Ventana de días para considerar que hubo actividad "reciente" — no hay
 *  una definición de dominio para esto, se deja como constante nombrada y
 *  fácil de ajustar si el criterio cambia. */
export const DIAS_ACTIVIDAD_RECIENTE = 14;

const ETAPAS_LEGACY_GANADO_PERDIDO: Etapa[] = ["GANADO", "PERDIDO"];

/** Condición Prisma para "ganada"/"perdida"/"activa", resolviendo por
 *  registro si la oportunidad vive en un pipeline dinámico (stage.esGanado/
 *  esPerdido) o en el enum legacy (solo cuando stageId es null) — mismo
 *  patrón de duplicidad que `FlujoVentaEtapa.esFinal/esCancelacion` en
 *  Pedidos, pero acá con dos flags en vez de uno. */
export function condicionGanada(): Prisma.OportunidadWhereInput {
  return {
    OR: [
      { stage: { esGanado: true } },
      { AND: [{ stageId: null }, { etapa: "GANADO" }] },
    ],
  };
}

export function condicionPerdida(): Prisma.OportunidadWhereInput {
  return {
    OR: [
      { stage: { esPerdido: true } },
      { AND: [{ stageId: null }, { etapa: "PERDIDO" }] },
    ],
  };
}

export function condicionActiva(): Prisma.OportunidadWhereInput {
  return {
    NOT: {
      OR: [
        { stage: { esGanado: true } },
        { stage: { esPerdido: true } },
        { AND: [{ stageId: null }, { etapa: { in: ETAPAS_LEGACY_GANADO_PERDIDO } }] },
      ],
    },
  };
}

export function condicionEstado(estado: OportunidadesFiltros["estado"]): Prisma.OportunidadWhereInput {
  switch (estado) {
    case "activas": return condicionActiva();
    case "ganadas": return condicionGanada();
    case "perdidas": return condicionPerdida();
    default: return {};
  }
}

/** Todos los filtros salvo "vencimiento" — se reutiliza para la tabla (con
 *  su propia condición de vencimiento agregada aparte) y para los 4
 *  indicadores (cada uno agrega su propia condición de fecha/estado sobre
 *  esta misma base, ver obtenerOportunidadesKpis). `zonaHoraria` solo se usa
 *  para resolver "sin actividad reciente". */
export function construirWhereBase(instanciaId: string, zonaHoraria: string, filtros?: OportunidadesFiltros): Prisma.OportunidadWhereInput {
  const where: Prisma.OportunidadWhereInput = { instanciaId };
  if (!filtros) return where;

  if (filtros.busqueda) {
    const q = filtros.busqueda;
    where.OR = [
      { titulo: { contains: q, mode: "insensitive" } },
      { contactos: { some: { contacto: { is: { OR: [
        { nombre: { contains: q, mode: "insensitive" } },
        { apellido: { contains: q, mode: "insensitive" } },
      ] } } } } },
      { empresa: { is: { nombre: { contains: q, mode: "insensitive" } } } },
    ];
  }
  // Oportunidad.productos (OportunidadProducto) nunca se escribe desde
  // ningún form/Server Action del dominio — es una relación muerta, así que
  // filtrar por ella siempre daba cero resultados. El producto real de una
  // oportunidad vive en las líneas de sus cotizaciones (CotizacionLinea vía
  // Cotizacion.oportunidadId), así que se filtra por ahí.
  if (filtros.productoIds && filtros.productoIds.length > 0) {
    where.cotizaciones = {
      some: { lineas: { some: { productoId: { in: filtros.productoIds } } } },
    };
  }
  if (filtros.contactoIds && filtros.contactoIds.length > 0) {
    where.contactos = { some: { contactoId: { in: filtros.contactoIds } } };
  }
  if (filtros.empresaId) where.empresaId = filtros.empresaId;
  if (filtros.usuarioId) where.usuarioId = filtros.usuarioId;
  if (filtros.tagIds && filtros.tagIds.length > 0) {
    where.tags = { some: { tagId: { in: filtros.tagIds } } };
  }
  if (filtros.etapaId) where.stageId = filtros.etapaId;
  else if (filtros.etapaLegacy) where.etapa = filtros.etapaLegacy;

  // AND explícito (no mezclar con `where.OR` de la búsqueda de arriba, que
  // usa la misma clave a nivel raíz).
  if (filtros.estado) where.AND = condicionEstado(filtros.estado);

  if (filtros.valorMin != null || filtros.valorMax != null) {
    where.valor = {
      ...(filtros.valorMin != null ? { gte: filtros.valorMin } : {}),
      ...(filtros.valorMax != null ? { lte: filtros.valorMax } : {}),
    };
  }
  if (filtros.probabilidadMin != null || filtros.probabilidadMax != null) {
    where.probabilidad = {
      ...(filtros.probabilidadMin != null ? { gte: filtros.probabilidadMin } : {}),
      ...(filtros.probabilidadMax != null ? { lte: filtros.probabilidadMax } : {}),
    };
  }
  if (filtros.creadoDesde || filtros.creadoHasta) {
    where.creadoEn = {
      ...(filtros.creadoDesde ? { gte: filtros.creadoDesde } : {}),
      ...(filtros.creadoHasta ? { lte: filtros.creadoHasta } : {}),
    };
  }
  // Si productoIds ya dejó armado where.cotizaciones (arriba), "some" con
  // línea de producto ya implica "con cotización" — no hay que pisarlo.
  // "sin cotización" sí se pisa a propósito: es incompatible con tener una
  // línea de producto (sin cotización no puede haber línea), así que
  // prevalece la condición más restrictiva.
  if (filtros.conCotizacion === true) where.cotizaciones ??= { some: {} };
  else if (filtros.conCotizacion === false) where.cotizaciones = { none: {} };

  if (filtros.conActividadesPendientes) {
    where.actividades = { some: { completada: false } };
  }
  if (filtros.sinActividadReciente) {
    const { desde } = rangoDiaEnZona(zonaHoraria, -DIAS_ACTIVIDAD_RECIENTE);
    where.actividades = { none: { fecha: { gte: desde } } };
  }

  return where;
}

/** Agrega la condición de vencimiento (Oportunidad.fechaCierre) sobre la
 *  base de construirWhereBase() — usada solo por la tabla, nunca por los
 *  indicadores (ver comentario en OportunidadesFiltros.vencimiento). */
export function construirWhere(instanciaId: string, zonaHoraria: string, filtros?: OportunidadesFiltros): Prisma.OportunidadWhereInput {
  const where = construirWhereBase(instanciaId, zonaHoraria, filtros);
  if (!filtros?.vencimiento) return where;

  if (filtros.vencimiento === "sinfecha") {
    where.fechaCierre = null;
    return where;
  }
  if (filtros.vencimiento === "personalizado") {
    if (filtros.vencDesde || filtros.vencHasta) {
      where.fechaCierre = {
        ...(filtros.vencDesde ? { gte: filtros.vencDesde } : {}),
        ...(filtros.vencHasta ? { lt: filtros.vencHasta } : {}),
      };
    }
    return where;
  }

  const hoy = rangoDiaEnZona(zonaHoraria, 0);
  if (filtros.vencimiento === "vencidas") {
    where.fechaCierre = { lt: hoy.desde };
  } else if (filtros.vencimiento === "hoy") {
    where.fechaCierre = { gte: hoy.desde, lt: hoy.hasta };
  } else if (filtros.vencimiento === "7dias") {
    where.fechaCierre = { gte: hoy.desde, lt: rangoDiaEnZona(zonaHoraria, 7).desde };
  } else if (filtros.vencimiento === "30dias") {
    where.fechaCierre = { gte: hoy.desde, lt: rangoDiaEnZona(zonaHoraria, 30).desde };
  }
  return where;
}
