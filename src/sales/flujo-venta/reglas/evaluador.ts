import { fechaYMDEnZona, hoyEnZona, inicioDiaEnZona, sumarDias } from "../../pedidos/utils/fechas-zona";
import type {
  CampoRegla,
  CondicionEvaluada,
  ConditionNode,
  ConditionTree,
  GroupNode,
  HechosPedido,
  OperadorCondicion,
} from "./tipos";

// ── Evaluador de árbol de condiciones — función pura, sin I/O ──────────────
// Dado un árbol (AND/OR, hasta 2 niveles de anidamiento), los hechos ya
// resueltos de un pedido y el catálogo de campos, decide si se cumple y
// devuelve el detalle de cada condición hoja evaluada (para "requisitos
// pendientes" y "Probar con un pedido").

function normalizarTexto(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

const EPSILON_MONEDA = 0.005;

function coerceFecha(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function comoArreglo(v: string | string[] | null | undefined): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

/** Resuelve el valor de comparación de una condición: campo comparado (si se
 *  configuró `comparisonFieldKey`) o el `value` fijo guardado en el nodo. */
function resolverValorComparacion(
  nodo: ConditionNode,
  hechos: HechosPedido,
  camposPorKey: Map<string, CampoRegla>
): unknown {
  if (nodo.comparisonFieldKey) {
    return camposPorKey.get(nodo.comparisonFieldKey)?.resolver(hechos);
  }
  return Array.isArray(nodo.value) ? nodo.value[0] : (nodo.value ?? null);
}

function evaluarTexto(actual: unknown, operador: OperadorCondicion, comparacion: unknown): boolean {
  const a = normalizarTexto(actual).toLowerCase();
  const c = normalizarTexto(comparacion).toLowerCase();
  switch (operador) {
    case "IGUAL": return a === c;
    case "DIFERENTE": return a !== c;
    case "CONTIENE": return c !== "" && a.includes(c);
    case "NO_CONTIENE": return c === "" || !a.includes(c);
    case "ESTA_VACIO": return a.trim() === "";
    case "NO_ESTA_VACIO": return a.trim() !== "";
    case "EMPIEZA_CON": return a.startsWith(c);
    case "TERMINA_CON": return a.endsWith(c);
    default: return false;
  }
}

function evaluarNumero(
  actual: unknown,
  operador: OperadorCondicion,
  nodo: ConditionNode,
  hechos: HechosPedido,
  camposPorKey: Map<string, CampoRegla>
): boolean {
  const a = Number(actual);
  if (Number.isNaN(a)) return false;

  if (operador === "ENTRE") {
    const [minRaw, maxRaw] = comoArreglo(nodo.value);
    const min = Number(minRaw);
    const max = Number(maxRaw);
    if (Number.isNaN(min) || Number.isNaN(max)) return false;
    return a >= min && a <= max;
  }

  const c = Number(resolverValorComparacion(nodo, hechos, camposPorKey));
  if (Number.isNaN(c)) return false;
  switch (operador) {
    case "IGUAL": return Math.abs(redondear2(a) - redondear2(c)) < EPSILON_MONEDA;
    case "DIFERENTE": return Math.abs(redondear2(a) - redondear2(c)) >= EPSILON_MONEDA;
    case "MAYOR_QUE": return a > c;
    case "MENOR_QUE": return a < c;
    case "MAYOR_IGUAL": return a >= c;
    case "MENOR_IGUAL": return a <= c;
    default: return false;
  }
}

function evaluarLista(
  actual: unknown,
  operador: OperadorCondicion,
  nodo: ConditionNode,
  hechos: HechosPedido,
  camposPorKey: Map<string, CampoRegla>
): boolean {
  const a = normalizarTexto(actual);
  if (operador === "ESTA_EN" || operador === "NO_ESTA_EN") {
    const enLista = comoArreglo(nodo.value).includes(a);
    return operador === "ESTA_EN" ? enLista : !enLista;
  }
  const c = normalizarTexto(resolverValorComparacion(nodo, hechos, camposPorKey));
  if (operador === "IGUAL") return a === c;
  if (operador === "DIFERENTE") return a !== c;
  return false;
}

function evaluarBooleano(actual: unknown, operador: OperadorCondicion): boolean {
  const a = actual === true || actual === "true";
  if (operador === "ES_VERDADERO") return a;
  if (operador === "ES_FALSO") return !a;
  return false;
}

function evaluarColeccion(actual: unknown, operador: OperadorCondicion, nodo: ConditionNode): boolean {
  const arr = Array.isArray(actual) ? actual.map(String) : [];
  const buscados = comoArreglo(nodo.value);
  switch (operador) {
    case "COLECCION_VACIA": return arr.length === 0;
    case "COLECCION_NO_VACIA": return arr.length > 0;
    case "CONTIENE_ALGUNO": return buscados.some((v) => arr.includes(v));
    case "CONTIENE_TODOS": return buscados.length > 0 && buscados.every((v) => arr.includes(v));
    case "NO_CONTIENE_COLECCION": return !buscados.some((v) => arr.includes(v));
    case "CANTIDAD_IGUAL": return arr.length === Number(nodo.value);
    case "CANTIDAD_MAYOR": return arr.length > Number(nodo.value);
    case "CANTIDAD_MENOR": return arr.length < Number(nodo.value);
    default: return false;
  }
}

function evaluarArchivo(actual: unknown, operador: OperadorCondicion): boolean {
  const adjunto = actual !== null && actual !== undefined && normalizarTexto(actual).trim() !== "";
  if (operador === "ADJUNTO") return adjunto;
  if (operador === "NO_ADJUNTO") return !adjunto;
  return false;
}

/** Resuelve una fecha de comparación (campo u otro valor fijo) a "YYYY-MM-DD"
 *  en la zona horaria de negocio, para comparar por día calendario. */
function resolverFechaYMD(
  nodo: ConditionNode,
  hechos: HechosPedido,
  camposPorKey: Map<string, CampoRegla>,
  zonaHoraria: string
): string | null {
  if (nodo.comparisonFieldKey) {
    const fecha = coerceFecha(camposPorKey.get(nodo.comparisonFieldKey)?.resolver(hechos));
    return fecha ? fechaYMDEnZona(fecha, zonaHoraria) : null;
  }
  const valor = Array.isArray(nodo.value) ? nodo.value[0] : nodo.value;
  return typeof valor === "string" && valor ? valor.slice(0, 10) : null;
}

function evaluarFecha(
  actualRaw: unknown,
  operador: OperadorCondicion,
  nodo: ConditionNode,
  hechos: HechosPedido,
  camposPorKey: Map<string, CampoRegla>,
  zonaHoraria: string,
  ahora: Date
): boolean {
  const actual = coerceFecha(actualRaw);
  if (!actual) return false;
  const ymdActual = fechaYMDEnZona(actual, zonaHoraria);
  const ymdHoy = fechaYMDEnZona(ahora, zonaHoraria);

  switch (operador) {
    case "ES_HOY": return ymdActual === ymdHoy;
    case "ESTA_VENCIDA": return ymdActual < ymdHoy;
    case "PROXIMOS_N_DIAS": {
      const n = Number(nodo.value);
      if (Number.isNaN(n)) return false;
      const limite = fechaYMDEnZona(
        inicioDiaEnZona(sumarDias(hoyEnZona(zonaHoraria, ahora), n), zonaHoraria),
        zonaHoraria
      );
      return ymdActual >= ymdHoy && ymdActual <= limite;
    }
    case "ENTRE_FECHAS": {
      const [desde, hasta] = comoArreglo(nodo.value);
      return !!desde && !!hasta && ymdActual >= desde.slice(0, 10) && ymdActual <= hasta.slice(0, 10);
    }
    case "ANTES_DE": {
      const c = resolverFechaYMD(nodo, hechos, camposPorKey, zonaHoraria);
      return c !== null && ymdActual < c;
    }
    case "DESPUES_DE": {
      const c = resolverFechaYMD(nodo, hechos, camposPorKey, zonaHoraria);
      return c !== null && ymdActual > c;
    }
    case "IGUAL": {
      const c = resolverFechaYMD(nodo, hechos, camposPorKey, zonaHoraria);
      return c !== null && ymdActual === c;
    }
    default: return false;
  }
}

function evaluarCondicionHoja(
  nodo: ConditionNode,
  hechos: HechosPedido,
  camposPorKey: Map<string, CampoRegla>,
  zonaHoraria: string,
  ahora: Date
): CondicionEvaluada {
  const campo = camposPorKey.get(nodo.fieldKey);
  const valorActual = campo ? campo.resolver(hechos) : undefined;
  const valorEsperado = nodo.comparisonFieldKey
    ? `campo: ${camposPorKey.get(nodo.comparisonFieldKey)?.label ?? nodo.comparisonFieldKey}`
    : (nodo.value ?? null);

  let cumple = false;
  if (campo) {
    switch (campo.dataType) {
      case "TEXTO":
        cumple = evaluarTexto(valorActual, nodo.operator, resolverValorComparacion(nodo, hechos, camposPorKey));
        break;
      case "NUMERO":
      case "MONEDA":
        cumple = evaluarNumero(valorActual, nodo.operator, nodo, hechos, camposPorKey);
        break;
      case "LISTA":
        cumple = evaluarLista(valorActual, nodo.operator, nodo, hechos, camposPorKey);
        break;
      case "FECHA":
        cumple = evaluarFecha(valorActual, nodo.operator, nodo, hechos, camposPorKey, zonaHoraria, ahora);
        break;
      case "BOOLEANO":
        cumple = evaluarBooleano(valorActual, nodo.operator);
        break;
      case "COLECCION":
        cumple = evaluarColeccion(valorActual, nodo.operator, nodo);
        break;
      case "ARCHIVO":
        cumple = evaluarArchivo(valorActual, nodo.operator);
        break;
    }
  }

  return {
    fieldKey: nodo.fieldKey,
    fieldLabel: campo?.label ?? nodo.fieldKey,
    operator: nodo.operator,
    cumple,
    valorEsperado,
    valorActual,
  };
}

function evaluarNodo(
  nodo: ConditionNode | GroupNode,
  hechos: HechosPedido,
  camposPorKey: Map<string, CampoRegla>,
  zonaHoraria: string,
  ahora: Date
): { cumple: boolean; condiciones: CondicionEvaluada[] } {
  if (nodo.type === "condition") {
    const condicion = evaluarCondicionHoja(nodo, hechos, camposPorKey, zonaHoraria, ahora);
    return { cumple: condicion.cumple, condiciones: [condicion] };
  }

  const resultados = nodo.children.map((hijo) => evaluarNodo(hijo, hechos, camposPorKey, zonaHoraria, ahora));
  const condiciones = resultados.flatMap((r) => r.condiciones);
  // Grupo sin hijos: AND vacío es "verdadero" por vacuidad, OR vacío es
  // "falso" — así un grupo mal armado nunca bloquea (ni abre) todo por accidente.
  const cumple = resultados.length === 0
    ? nodo.logicalOperator === "AND"
    : nodo.logicalOperator === "AND"
      ? resultados.every((r) => r.cumple)
      : resultados.some((r) => r.cumple);

  return { cumple, condiciones };
}

export function evaluarArbol(
  tree: ConditionTree,
  hechos: HechosPedido,
  catalogo: CampoRegla[],
  zonaHoraria: string,
  ahora: Date = new Date()
): { cumple: boolean; condiciones: CondicionEvaluada[] } {
  const camposPorKey = new Map(catalogo.map((c) => [c.key, c]));
  return evaluarNodo(tree, hechos, camposPorKey, zonaHoraria, ahora);
}

/**
 * Normaliza una regla (nueva, con `arbolCondiciones`; o legada, con solo
 * `condiciones` planas) a un único árbol AND — así el resto del motor
 * siempre evalúa un `ConditionTree`, sin dos caminos de código distintos.
 */
export function construirArbolDesdeRegla(regla: {
  arbolCondiciones: unknown;
  condiciones: { campo: string; operador: OperadorCondicion; valor: string }[];
}): ConditionTree {
  if (regla.arbolCondiciones && typeof regla.arbolCondiciones === "object") {
    return regla.arbolCondiciones as ConditionTree;
  }
  return {
    type: "group",
    logicalOperator: "AND",
    children: regla.condiciones.map((c) => ({
      type: "condition" as const,
      fieldKey: c.campo,
      operator: c.operador,
      value: c.valor,
    })),
  };
}
