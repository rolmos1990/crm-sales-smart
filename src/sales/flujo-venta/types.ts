import type { OperadorCondicion, TipoMovimientoEtapa } from "@/generated/prisma/enums";

export type { OperadorCondicion, TipoMovimientoEtapa };

export interface FlujoVentaEtapa {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  orden: number;
  esInicial: boolean;
  esFinal: boolean;
  esCancelacion: boolean;
  esSecuencial: boolean;
  permiteEditarPedido: boolean;
  permiteEditarEntrega: boolean;
  activo: boolean;
  flujoVentaId: string;
  parentId: string | null;
}

export interface FlujoVentaReglaCondicion {
  id: string;
  campo: string;
  operador: OperadorCondicion;
  valor: string;
  reglaId: string;
}

export interface FlujoVentaRegla {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  prioridad: number;
  etapaDestinoId: string;
  condiciones: FlujoVentaReglaCondicion[];
}

export interface FlujoVenta {
  id: string;
  nombre: string;
  descripcion: string | null;
  esDefault: boolean;
  activo: boolean;
  etapas: FlujoVentaEtapa[];
}

export interface PedidoHistorialEtapa {
  id: string;
  etapaNombre: string;
  tipo: TipoMovimientoEtapa;
  notas: string | null;
  creadoEn: Date;
  etapaId: string;
  etapa: { nombre: string; color: string | null };
  usuarioId: string | null;
}

// Campos evaluables en condiciones de reglas
export const CAMPOS_EVALUABLES = [
  { valor: "total", etiqueta: "Total del pedido" },
  { valor: "metadata.estadoPago", etiqueta: "Estado de pago" },
  { valor: "metadata.metodoEnvio", etiqueta: "Método de envío" },
  { valor: "metadata.tipoPedido", etiqueta: "Tipo de pedido" },
  { valor: "metadata.canalOrigen", etiqueta: "Canal de origen" },
] as const;

export const OPERADORES_CONFIG: Record<OperadorCondicion, { etiqueta: string; tipo: "texto" | "numero" | "booleano" }> = {
  IGUAL:        { etiqueta: "es igual a",       tipo: "texto" },
  DIFERENTE:    { etiqueta: "es diferente de",  tipo: "texto" },
  MAYOR_QUE:    { etiqueta: "es mayor que",     tipo: "numero" },
  MENOR_QUE:    { etiqueta: "es menor que",     tipo: "numero" },
  CONTIENE:     { etiqueta: "contiene",         tipo: "texto" },
  ES_VERDADERO: { etiqueta: "es verdadero",     tipo: "booleano" },
  ES_FALSO:     { etiqueta: "es falso",         tipo: "booleano" },
};

export const COLORES_ETAPA = [
  "#4ade80", "#60a5fa", "#f97316", "#facc15",
  "#c084fc", "#f87171", "#34d399", "#fb923c",
];

type EtapaParaFlujo = {
  id: string;
  parentId: string | null;
  orden: number;
  esSecuencial: boolean;
  esFinal: boolean;
  esCancelacion: boolean;
};

/**
 * Calcula las etapas disponibles para transición desde la etapa actual.
 * - Sub-etapas directas de la etapa actual (profundizar en el flujo)
 * - La siguiente etapa raíz secuencial inmediata (por orden)
 * - Todas las etapas Manual (!esSecuencial) como opciones libres
 * - Etapas Final/Cancelación siempre visibles como salidas
 */
export function calcularSiguientesEtapas<T extends EtapaParaFlujo>(
  etapas: T[],
  etapaActualId: string | null,
): T[] {
  if (!etapaActualId) return [];
  const etapaActual = etapas.find((e) => e.id === etapaActualId);
  if (!etapaActual || etapaActual.esFinal || etapaActual.esCancelacion) return [];

  const ids = new Set<string>();
  const resultado: T[] = [];
  const agregar = (e: T) => {
    if (!ids.has(e.id)) { ids.add(e.id); resultado.push(e); }
  };

  const tieneHijos = etapas.some((e) => e.parentId === etapaActualId);

  // 1. Sub-etapas directas: solo el primer hijo secuencial + todos los manuales
  const hijos = etapas
    .filter((e) => e.parentId === etapaActualId)
    .sort((a, b) => a.orden - b.orden);
  let primeraSecuencialHijo = false;
  for (const hijo of hijos) {
    if (hijo.esSecuencial) {
      if (!primeraSecuencialHijo) { agregar(hijo); primeraSecuencialHijo = true; }
    } else {
      agregar(hijo);
    }
  }

  // 1.5. Siguiente hermano secuencial (solo para hojas: hijos sin hijos propios)
  if (etapaActual.parentId !== null && !tieneHijos) {
    const hermanos = etapas
      .filter((e) => e.parentId === etapaActual.parentId)
      .sort((a, b) => a.orden - b.orden);
    const idx = hermanos.findIndex((e) => e.id === etapaActualId);
    if (idx !== -1) {
      for (let i = idx + 1; i < hermanos.length; i++) {
        agregar(hermanos[i]);
        if (hermanos[i].esSecuencial) break;
      }
    }
  }

  // 2. Siguiente etapa raíz secuencial inmediata
  // Solo para raíces O para hojas. Sube toda la cadena para encontrar el ancestro raíz real.
  if (etapaActual.parentId === null || !tieneHijos) {
    let ancestroRaiz: T = etapaActual;
    while (ancestroRaiz.parentId !== null) {
      const padre = etapas.find((e) => e.id === ancestroRaiz.parentId);
      if (!padre) break;
      ancestroRaiz = padre;
    }
    const raices = etapas
      .filter((e) => e.parentId === null)
      .sort((a, b) => a.orden - b.orden);
    const idxRaiz = raices.findIndex((e) => e.id === ancestroRaiz.id);
    if (idxRaiz !== -1) {
      for (let i = idxRaiz + 1; i < raices.length; i++) {
        if (raices[i].esSecuencial) { agregar(raices[i]); break; }
      }
    }
  }

  // 3. Todas las etapas Manual (!esSecuencial), excepto la actual
  etapas
    .filter((e) => !e.esSecuencial && e.id !== etapaActualId)
    .forEach(agregar);

  // 4. Etapas Final/Cancelación (siempre visibles como salidas)
  etapas
    .filter((e) => (e.esFinal || e.esCancelacion) && e.id !== etapaActualId)
    .forEach(agregar);

  return resultado;
}
