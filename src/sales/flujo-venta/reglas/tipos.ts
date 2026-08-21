import type { OperadorCondicion } from "../../../generated/prisma/enums";

export type { OperadorCondicion };

// ── Tipos de dato de un campo evaluable ─────────────────────────────────────

export type TipoDatoCampo =
  | "TEXTO"
  | "NUMERO"
  | "MONEDA"
  | "LISTA"
  | "FECHA"
  | "BOOLEANO"
  | "COLECCION"
  | "ARCHIVO";

export interface OpcionListaCampo {
  valor: string;
  etiqueta: string;
}

// ── Hechos resueltos de un pedido ───────────────────────────────────────────
// Objeto plano armado por resolver-hechos.ts, indexado por la misma `key`
// que usa cada CampoRegla del catálogo — así el `resolver` de un campo es
// simplemente `(hechos) => hechos[key]`.
export type HechosPedido = Record<string, unknown>;

// ── Catálogo de campos ──────────────────────────────────────────────────────

export interface CampoRegla {
  key: string;
  label: string;
  category: string;
  dataType: TipoDatoCampo;
  allowedOperators: OperadorCondicion[];
  resolver: (hechos: HechosPedido) => unknown;
  allowedValues?: OpcionListaCampo[];
  isCustomField?: boolean;
}

// ── Árbol de condiciones (tipado, sin código/expresiones arbitrarias) ──────
// Anidamiento limitado a 2 niveles: el GroupNode raíz puede contener
// ConditionNode y GroupNode hijos, pero esos GroupNode hijos solo pueden
// contener ConditionNode (no más grupos) — se valida en el constructor de
// UI y, de nuevo, en el schema del server action antes de guardar.

export interface ConditionNode {
  type: "condition";
  fieldKey: string;
  operator: OperadorCondicion;
  /** Valor fijo de comparación — string para simplificar persistencia; el
   *  evaluador lo interpreta según el `dataType` del campo. Arreglo para
   *  operadores de lista/colección (ESTA_EN, CONTIENE_ALGUNO, etc.) o el
   *  segundo extremo de ENTRE/ENTRE_FECHAS. */
  value?: string | string[] | null;
  /** Comparar contra otro campo del catálogo (mismo tipo de dato) en vez de
   *  un valor fijo — si está presente, `value` se ignora. */
  comparisonFieldKey?: string | null;
}

export interface GroupNode {
  type: "group";
  logicalOperator: "AND" | "OR";
  children: (ConditionNode | GroupNode)[];
}

/** La raíz siempre es un grupo — es lo que se guarda en `arbolCondiciones`. */
export type ConditionTree = GroupNode;

// ── Resultado de evaluación ─────────────────────────────────────────────────

export interface CondicionEvaluada {
  fieldKey: string;
  fieldLabel: string;
  operator: OperadorCondicion;
  cumple: boolean;
  valorEsperado: unknown;
  valorActual: unknown;
}

export interface ReglaEvaluada {
  reglaId: string;
  nombre: string;
  prioridad: number;
  cumple: boolean;
  mensajeFallo: string | null;
  mostrarPendientes: boolean;
  /** Condiciones hoja evaluadas, en el orden en que aparecen en el árbol —
   *  para mostrar "cumplidas" vs "pendientes" en la UI y en "Probar con un pedido". */
  condiciones: CondicionEvaluada[];
}

export interface ResultadoEvaluacion {
  esValido: boolean;
  etapaDestinoId: string;
  reglasEvaluadas: ReglaEvaluada[];
  /** La primera regla (por prioridad) que no se cumplió — null si esValido. */
  reglaFallida: ReglaEvaluada | null;
}
