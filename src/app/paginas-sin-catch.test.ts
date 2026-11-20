import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Una página NO puede atrapar un fallo de lectura y seguir renderizando con un
// valor inventado. Si lo hace, el usuario ve un listado vacío que parece "no
// tenés datos", un 404 sobre un registro que sí existe, o un total en cero —
// mentiras que no se distinguen del caso legítimo.
//
// Este test existe porque el fix de 043 fueron 38 ediciones mecánicas sobre 32
// archivos: justo la forma de cambio donde se cuela el descuido, en las dos
// direcciones (borrar uno que había que conservar, u olvidar uno que había que
// borrar). Y nada impediría que dentro de seis meses una página nueva llegue
// con el mismo `catch {}` y el mismo comentario "DB no configurada" —que,
// dicho sea de paso, describía un escenario imposible: la sesión consulta la
// base antes del try, así que ese catch nunca atrapó eso.
//
// Mismo espíritu que src/worker/grafo-importaciones.test.ts: una invariante
// estructural que ningún test funcional puede observar.
//
// VIGILA LAS DOS FORMAS SINTÁCTICAS, y eso no es exceso de celo: el inventario
// original de 043 se armó buscando solo `catch {` y se le escaparon 5 bloques
// escritos como `.catch(() => [])`, uno de los cuales producía un 404 falso
// igual que los otros nueve. Un guardia que repita el sesgo del barrido que lo
// originó no protege de nada.

const RAIZ = resolve(__dirname, "..", "..");
const APP = resolve(RAIZ, "src/app");

/**
 * Los únicos bloques permitidos, identificados por archivo + una marca estable
 * del código cercano. A propósito NO se usan números de línea: se mueven con
 * cualquier edición y volverían el test una molestia en vez de una red.
 *
 * Para agregar una entrada acá hace falta que se cumplan las dos condiciones:
 * el contenido principal de la página ya está resuelto, y lo que falla es
 * accesorio. "Que no se caiga la página" no alcanza — si lo que falla es el
 * contenido principal, la página DEBE caerse.
 */
const PERMITIDOS: { archivo: string; marca: string; porque: string }[] = [
  {
    archivo: "crm/oportunidades/[id]/page.tsx",
    marca: "conversacionesNoDisponibles = true",
    porque: "La oportunidad ya está cargada; el panel de conversaciones es accesorio y avisa cuando falla.",
  },
  {
    archivo: "crm/oportunidades/[id]/page.tsx",
    marca: "return String(campo.valor)",
    porque: "No es lectura de datos: es parseo de una fecha ya leída.",
  },
  {
    archivo: "sales/cotizaciones/nueva/page.tsx",
    marca: "prefillNoDisponible = true",
    porque: "El prefill desde la oportunidad de origen es opcional; sin él el formulario sigue siendo correcto, y avisa.",
  },
  {
    archivo: "sales/pedidos/[id]/page.tsx",
    marca: "return String(cv.valor)",
    porque: "No es lectura de datos: es parseo de una fecha ya leída.",
  },
];

/** Cuánto texto después del `catch` se mira para encontrar su marca. */
const VENTANA = 240;

function paginas(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = resolve(dir, entrada);
    if (statSync(ruta).isDirectory()) paginas(ruta, acc);
    else if (entrada === "page.tsx") acc.push(ruta);
  }
  return acc;
}

type Hallazgo = { archivo: string; forma: string; contexto: string };

/**
 * Las dos formas de atrapar un fallo de lectura:
 *   try { … } catch        → `catch {` o `catch (e) {`
 *   promesa.catch(() => …) → encadenado, típicamente dentro de un Promise.all
 */
function buscarBloques(fuente: string, archivo: string): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const formas: [string, RegExp][] = [
    ["try/catch", /(?<![.\w])catch\s*(?:\([^)]*\)\s*)?\{/g],
    [".catch encadenado", /\.catch\s*\(/g],
  ];
  for (const [forma, re] of formas) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(fuente)) !== null) {
      hallazgos.push({
        archivo,
        forma,
        contexto: fuente.slice(m.index, m.index + VENTANA),
      });
    }
  }
  return hallazgos;
}

describe("ninguna página esconde un fallo de lectura (043)", () => {
  const archivos = paginas(APP);
  const hallazgos = archivos.flatMap((ruta) =>
    buscarBloques(readFileSync(ruta, "utf-8"), ruta.replace(APP + "/", "")),
  );

  it("recorre un número no trivial de páginas (si no, el test no prueba nada)", () => {
    expect(archivos.length).toBeGreaterThan(40);
  });

  it("solo existen los bloques de la lista blanca", () => {
    const infracciones = hallazgos.filter(
      (h) => !PERMITIDOS.some((p) => p.archivo === h.archivo && h.contexto.includes(p.marca)),
    );

    const detalle = infracciones
      .map(
        (i) =>
          `\n  ${i.archivo} — ${i.forma}\n    ${i.contexto.split("\n").slice(0, 3).join("\n    ")}`,
      )
      .join("");

    expect(
      infracciones.map((i) => `${i.archivo} (${i.forma})`),
      "Una página solo puede atrapar un fallo de lectura si su contenido principal " +
        "ya está resuelto y lo que falla es accesorio (y entonces debe avisarlo). " +
        "Si lo que falla es el contenido principal, dejá que el error se propague: " +
        "una pantalla de error es honesta, un listado vacío o un 404 inventado no lo son. " +
        `Bloques no permitidos:${detalle}\n`,
    ).toEqual([]);
  });

  it("la lista blanca no tiene entradas muertas", () => {
    // Si una entrada deja de corresponder a código real, borrarla: una lista
    // blanca con entradas fantasma deja de ser revisable.
    const muertas = PERMITIDOS.filter(
      (p) => !hallazgos.some((h) => h.archivo === p.archivo && h.contexto.includes(p.marca)),
    );
    expect(
      muertas.map((p) => `${p.archivo} → "${p.marca}"`),
      "Entradas de la lista blanca que ya no corresponden a ningún bloque del código",
    ).toEqual([]);
  });
});
