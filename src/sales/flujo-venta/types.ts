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
