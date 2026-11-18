import type { Prisma } from "@/generated/prisma/client";
import { construirCondicionVenta, type EtapaParaKpis } from "@/sales/pedidos/condicion-venta";
import type { CortesSeguimiento } from "./cortes";

/**
 * 041 — Reglas comerciales de Contactos como `ContactoWhereInput`.
 *
 * Es la ÚNICA definición de Cliente, Interesado, Lead y de los estados de
 * seguimiento. La usan los conteos de los indicadores, los filtros, la
 * paginación por prioridad y el cálculo por fila; por eso un número y su
 * lista no pueden contradecirse. Sin Prisma en runtime (solo tipos), mismo
 * criterio que `src/sales/pedidos/condicion-venta.ts`, para probarlas como
 * funciones puras.
 *
 * "Cliente" se deriva SIEMPRE de `cuentaComoVenta` en cada consulta y nunca se
 * copia al contacto (regla 10 de CLAUDE.md): marcar o desmarcar una etapa del
 * Flujo de Venta cambia los clientes en el siguiente render.
 *
 * Trampa de NULL: con `NOT`, una comparación sobre una columna nula da NULL y
 * PostgreSQL descarta la fila de AMBOS lados. Toda comparación sobre una
 * fecha nulable va acompañada de su `not: null`, así cada condición es
 * estrictamente verdadera o falsa y los estados de seguimiento cubren a todos.
 */

type Where = Prisma.ContactoWhereInput;

export const ESTADOS_COTIZACION_ACTIVA = ["BORRADOR", "REVISADA", "APROBADA", "ENVIADA"] as const;

export const ESTADOS_SEGUIMIENTO = ["AL_DIA", "PENDIENTE", "POR_RECUPERAR", "INACTIVO"] as const;
export type EstadoSeguimiento = (typeof ESTADOS_SEGUIMIENTO)[number];

export const SEGMENTOS = ["TODOS", "CLIENTES", "INTERESADOS", "POR_RECUPERAR", "LEADS"] as const;
export type Segmento = (typeof SEGMENTOS)[number];

export const TIPOS_COMERCIALES = ["CLIENTE", "INTERESADO", "LEAD"] as const;
export type TipoComercial = (typeof TIPOS_COMERCIALES)[number];

export type Tramo = 1 | 2 | 3 | 4;
export const TRAMOS: readonly Tramo[] = [1, 2, 3, 4];

// ── Conceptos base ─────────────────────────────────────────────────────────

export function condicionCliente(etapas: EtapaParaKpis[]): Where {
  return { pedidos: { some: construirCondicionVenta(etapas) } };
}

export function condicionSenalObjetiva(): Where {
  return {
    OR: [
      { oportunidades: { some: { oportunidad: { fechaGanada: null, fechaPerdida: null } } } },
      { cotizaciones: { some: { estado: { in: [...ESTADOS_COTIZACION_ACTIVA] } } } },
    ],
  };
}

/** Un "Bajo" puesto a mano es la forma de decir "ya no le interesa" sin IA. */
function condicionBajoFijado(): Where {
  return { nivelInteres: "BAJO", nivelInteresFijado: true };
}

export function condicionInteresado(): Where {
  return {
    OR: [
      { nivelInteres: { in: ["ALTO", "MEDIO"] } },
      { AND: [condicionSenalObjetiva(), { NOT: condicionBajoFijado() }] },
    ],
  };
}

export function condicionLead(etapas: EtapaParaKpis[]): Where {
  return { AND: [{ NOT: condicionCliente(etapas) }, { NOT: condicionInteresado() }] };
}

/** Tipo principal de la columna Tipo: Cliente gana sobre Interesado. */
export function condicionTipo(tipo: TipoComercial, etapas: EtapaParaKpis[]): Where {
  switch (tipo) {
    case "CLIENTE":
      return condicionCliente(etapas);
    case "INTERESADO":
      return { AND: [condicionInteresado(), { NOT: condicionCliente(etapas) }] };
    case "LEAD":
      return condicionLead(etapas);
  }
}

// ── Fecha de referencia (ultimaInteraccionEn, o creadoEn si nunca hubo) ────

function referenciaDesde(corte: Date): Where {
  return {
    OR: [
      { AND: [{ ultimaInteraccionEn: { not: null } }, { ultimaInteraccionEn: { gte: corte } }] },
      { AND: [{ ultimaInteraccionEn: null }, { creadoEn: { gte: corte } }] },
    ],
  };
}

function referenciaAntesDe(corte: Date): Where {
  return {
    OR: [
      { AND: [{ ultimaInteraccionEn: { not: null } }, { ultimaInteraccionEn: { lt: corte } }] },
      { AND: [{ ultimaInteraccionEn: null }, { creadoEn: { lt: corte } }] },
    ],
  };
}

// ── Seguimiento (FR-028; tabla de precedencia en data-model.md) ────────────

export function condicionEsperandoRespuesta(): Where {
  return { esperandoRespuestaDesde: { not: null } };
}

function reglas(cortes: CortesSeguimiento) {
  const actividadVencida: Where = { actividades: { some: { completada: false, fecha: { lt: cortes.ahora } } } };
  const actividadVigente: Where = { actividades: { some: { completada: false, fecha: { gte: cortes.ahora } } } };

  // 1 — alguien espera respuesta o hay una tarea atrasada.
  const r1: Where = { OR: [condicionEsperandoRespuesta(), actividadVencida] };
  // 2 — ya tiene seguimiento agendado o habló hace poco.
  const r2: Where = { OR: [actividadVigente, referenciaDesde(cortes.pendiente)] };
  // 3 — solo un Interesado contactable puede quedar pendiente o por recuperar
  // por fechas (FR-029); la inactividad sola no hace recuperable a nadie.
  const r3: Where = { AND: [condicionInteresado(), { noContactarDesde: null }] };
  // 4 — sin interacción hace mucho.
  const r4: Where = referenciaAntesDe(cortes.inactivo);

  const noR1NiR2: Where[] = [{ NOT: r1 }, { NOT: r2 }];
  return { r1, r2, r3, r4, noR1NiR2 };
}

export function condicionSeguimiento(estado: EstadoSeguimiento, cortes: CortesSeguimiento): Where {
  const { r1, r2, r3, r4, noR1NiR2 } = reglas(cortes);
  switch (estado) {
    case "PENDIENTE":
      return {
        OR: [r1, { AND: [...noR1NiR2, r3, referenciaDesde(cortes.recuperar)] }],
      };
    case "POR_RECUPERAR":
      return { AND: [...noR1NiR2, r3, referenciaAntesDe(cortes.recuperar)] };
    case "INACTIVO":
      return { AND: [...noR1NiR2, { NOT: r3 }, r4] };
    case "AL_DIA":
      return { AND: [{ NOT: r1 }, { OR: [r2, { AND: [{ NOT: r3 }, { NOT: r4 }] }] }] };
  }
}

/**
 * Tramos del orden por prioridad (FR-012, research D2). Excluyentes y
 * exhaustivos: T1 mensaje sin responder, T2 resto de Pendientes, T3 Por
 * recuperar, T4 el resto.
 */
export function condicionTramo(tramo: Tramo, cortes: CortesSeguimiento): Where {
  switch (tramo) {
    case 1:
      return condicionEsperandoRespuesta();
    case 2:
      return { AND: [condicionSeguimiento("PENDIENTE", cortes), { NOT: condicionEsperandoRespuesta() }] };
    case 3:
      return condicionSeguimiento("POR_RECUPERAR", cortes);
    case 4:
      return { OR: [condicionSeguimiento("AL_DIA", cortes), condicionSeguimiento("INACTIVO", cortes)] };
  }
}

export function condicionSegmento(segmento: Segmento, etapas: EtapaParaKpis[], cortes: CortesSeguimiento): Where {
  switch (segmento) {
    case "TODOS":
      return {};
    case "CLIENTES":
      return condicionCliente(etapas);
    case "INTERESADOS":
      return condicionInteresado();
    case "POR_RECUPERAR":
      return condicionSeguimiento("POR_RECUPERAR", cortes);
    case "LEADS":
      return condicionLead(etapas);
  }
}
