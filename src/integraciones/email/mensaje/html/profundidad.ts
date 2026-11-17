// 035 — Pre-chequeo de anidamiento del HTML de un correo.
//
// sanitize-html ya corta el árbol en PROFUNDIDAD_ANIDAMIENTO, pero un HTML con
// miles de niveles abiertos a propósito no es un correo legítimo: se rechaza
// antes de limpiarlo. Recorre el HTML con el parser de htmlparser2 (el mismo
// que usa sanitize-html) llevando solo un contador: no arma árbol y es lineal.
//
// Apto para el worker.
import { Parser } from "htmlparser2";

class ProfundidadExcedida extends Error {}

export function superaProfundidad(html: string, limite: number): boolean {
  let profundidad = 0;
  const parser = new Parser(
    {
      onopentag() {
        profundidad += 1;
        if (profundidad > limite) throw new ProfundidadExcedida();
      },
      onclosetag() {
        if (profundidad > 0) profundidad -= 1;
      },
    },
    { decodeEntities: false, lowerCaseTags: true },
  );
  try {
    parser.end(html);
    return false;
  } catch (err) {
    if (err instanceof ProfundidadExcedida) return true;
    throw err;
  }
}
