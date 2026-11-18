// 041 — Evaluador mínimo de `where` de Prisma sobre objetos en memoria, con la
// lógica de tres valores de SQL (TRUE / FALSE / NULL). Solo cubre lo que usan
// las condiciones de Contactos. Existe para que los tests detecten la trampa
// de NULL bajo `NOT` igual que la detectaría PostgreSQL.

type Tri = true | false | null;
type Fila = Record<string, unknown>;

const and = (a: Tri, b: Tri): Tri => (a === false || b === false ? false : a === null || b === null ? null : true);
const or = (a: Tri, b: Tri): Tri => (a === true || b === true ? true : a === null || b === null ? null : false);
const not = (a: Tri): Tri => (a === null ? null : !a);

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);
}

function comparar(valor: unknown, filtro: unknown): Tri {
  if (!esObjetoPlano(filtro)) {
    if (filtro === null) return valor === null || valor === undefined;
    if (valor === null || valor === undefined) return null;
    return valor instanceof Date && filtro instanceof Date ? valor.getTime() === filtro.getTime() : valor === filtro;
  }
  let r: Tri = true;
  for (const [op, arg] of Object.entries(filtro)) {
    switch (op) {
      case "not":
        if (arg === null) r = and(r, valor !== null && valor !== undefined);
        else r = and(r, not(comparar(valor, arg)));
        break;
      case "in":
        r = and(r, valor === null || valor === undefined ? null : (arg as unknown[]).includes(valor));
        break;
      case "notIn":
        r = and(r, valor === null || valor === undefined ? null : !(arg as unknown[]).includes(valor));
        break;
      case "gte":
        r = and(r, valor === null || valor === undefined ? null : (valor as Date) >= (arg as Date));
        break;
      case "contains":
        // Los tests usan siempre mode: "insensitive".
        r = and(r, valor === null || valor === undefined ? null : String(valor).toLowerCase().includes(String(arg).toLowerCase()));
        break;
      case "mode":
        break;
      case "lt":
        r = and(r, valor === null || valor === undefined ? null : (valor as Date) < (arg as Date));
        break;
      default:
        throw new Error(`Operador no soportado en el evaluador de test: ${op}`);
    }
  }
  return r;
}

export function evaluarWhere(where: Record<string, unknown>, fila: Fila): Tri {
  let r: Tri = true;
  for (const [clave, valor] of Object.entries(where)) {
    if (clave === "AND") {
      for (const w of valor as Record<string, unknown>[]) r = and(r, evaluarWhere(w, fila));
    } else if (clave === "OR") {
      let acc: Tri = false;
      for (const w of valor as Record<string, unknown>[]) acc = or(acc, evaluarWhere(w, fila));
      r = and(r, acc);
    } else if (clave === "NOT") {
      r = and(r, not(evaluarWhere(valor as Record<string, unknown>, fila)));
    } else if (Array.isArray(fila[clave]) && esObjetoPlano(valor) && ("some" in valor || "none" in valor)) {
      const filas = fila[clave] as Fila[];
      if ("some" in valor) r = and(r, filas.some((f) => evaluarWhere(valor.some as Record<string, unknown>, f) === true));
      if ("none" in valor) r = and(r, !filas.some((f) => evaluarWhere(valor.none as Record<string, unknown>, f) === true));
    } else if (esObjetoPlano(fila[clave]) && esObjetoPlano(valor)) {
      r = and(r, evaluarWhere(valor, fila[clave] as Fila));
    } else {
      r = and(r, comparar(fila[clave], valor));
    }
  }
  return r;
}

/** Como PostgreSQL: la fila entra solo si la condición es estrictamente verdadera. */
export function cumple(where: Record<string, unknown>, fila: Fila): boolean {
  return evaluarWhere(where, fila) === true;
}
