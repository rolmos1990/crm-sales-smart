import type { ConditionNode, GroupNode } from "../reglas/tipos";
import { ETIQUETA_OPERADOR, OPERADORES_SIN_VALOR, type CampoReglaCliente } from "./constructor-condiciones";

function etiquetaValor(nodo: ConditionNode): string {
  if (Array.isArray(nodo.value)) return nodo.value.filter(Boolean).join(" y ");
  return nodo.value ?? "";
}

function etiquetaCondicion(nodo: ConditionNode, campos: CampoReglaCliente[]): string {
  const campo = campos.find((c) => c.key === nodo.fieldKey);
  const nombreCampo = campo?.label ?? nodo.fieldKey;
  const operador = ETIQUETA_OPERADOR[nodo.operator] ?? nodo.operator;

  if (nodo.comparisonFieldKey) {
    const campoComparado = campos.find((c) => c.key === nodo.comparisonFieldKey);
    return `${nombreCampo} ${operador} ${campoComparado?.label ?? nodo.comparisonFieldKey}`;
  }
  if (OPERADORES_SIN_VALOR.has(nodo.operator)) return `${nombreCampo} ${operador}`;

  const valor = etiquetaValor(nodo);
  return valor ? `${nombreCampo} ${operador} "${valor}"` : `${nombreCampo} ${operador}`;
}

/** Arma un resumen en lenguaje natural del árbol de condiciones — sin IA,
 *  solo una plantilla determinística a partir de las etiquetas del catálogo. */
export function generarResumenNatural(grupo: GroupNode, campos: CampoReglaCliente[], etapaNombre?: string): string {
  if (grupo.children.length === 0) {
    return "Todavía no hay condiciones configuradas.";
  }

  const partes = grupo.children.map((hijo) => {
    if (hijo.type === "condition") return etiquetaCondicion(hijo, campos);
    const sub = hijo.children
      .filter((c): c is ConditionNode => c.type === "condition")
      .map((c) => etiquetaCondicion(c, campos));
    const conector = hijo.logicalOperator === "AND" ? " y " : " o ";
    return sub.length > 0 ? `(${sub.join(conector)})` : null;
  }).filter((p): p is string => !!p);

  if (partes.length === 0) return "Todavía no hay condiciones configuradas.";

  const conectorRaiz = grupo.logicalOperator === "AND" ? ", y " : ", o ";
  const cuerpo = partes.length === 1 ? partes[0] : partes.join(conectorRaiz);
  const destino = etapaNombre ? ` obtener el estado "${etapaNombre}"` : " cumplirse esta regla";

  return `Para${destino}, ${cuerpo}.`;
}
