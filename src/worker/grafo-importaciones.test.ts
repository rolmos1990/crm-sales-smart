import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// El worker corre con `tsx` en Node pelado, NO dentro de Next.js. Cualquier
// módulo que alcance desde src/worker/disparadores.ts tiene que poder
// resolverse ahí.
//
// Este test existe por un incidente real: `import "server-only"` en
// integraciones/email/mensaje/hilo.ts tumbó el worker en producción con
// MODULE_NOT_FOUND. Ni los tests ni el build lo vieron —vitest aliasea
// server-only a un stub (ver vitest.config.ts) y Next lo provee— así que la
// única forma de detectarlo antes de desplegar es recorrer el grafo a mano.

const RAIZ = resolve(__dirname, "..", "..");
const ENTRADA = resolve(RAIZ, "src/worker/disparadores.ts");

// Se comprueba resolución REAL, no una lista a mano: `next/cache` por ejemplo
// sí resuelve (es un archivo dentro del paquete `next`, que está instalado) y
// el worker lo usa desde siempre envuelto en try/catch. `server-only`, en
// cambio, no está en node_modules y por eso tumba el proceso.
const requerir = createRequire(resolve(RAIZ, "package.json"));

function resuelveComoPaquete(especificador: string): boolean {
  try {
    requerir.resolve(especificador);
    return true;
  } catch {
    return false;
  }
}

const EXTENSIONES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolverImport(especificador: string, desde: string): string | null {
  // Solo se siguen los imports del proyecto; node_modules no se recorre.
  let base: string;
  if (especificador.startsWith("@/")) {
    base = resolve(RAIZ, "src", especificador.slice(2));
  } else if (especificador.startsWith(".")) {
    base = resolve(dirname(desde), especificador);
  } else {
    return null;
  }

  for (const ext of ["", ...EXTENSIONES]) {
    const ruta = base + ext;
    if (existsSync(ruta) && !ruta.endsWith("/")) {
      try {
        if (readFileSync(ruta).length >= 0) return ruta;
      } catch {
        /* es un directorio */
      }
    }
  }
  return null;
}

/** Imports estáticos y dinámicos (`await import("...")`). */
function extraerImports(fuente: string): string[] {
  const especificadores: string[] = [];
  const estaticos = /(?:^|\n)\s*import\s+(?:[^"']*?\sfrom\s+)?["']([^"']+)["']/g;
  const dinamicos = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const re of [estaticos, dinamicos]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(fuente)) !== null) especificadores.push(m[1]);
  }
  return especificadores;
}

/** Recorre el grafo desde la entrada del worker y devuelve, por archivo, sus imports prohibidos. */
function analizarGrafo(): { visitados: string[]; infracciones: { archivo: string; paquete: string; cadena: string[] }[] } {
  const visitados = new Set<string>();
  const infracciones: { archivo: string; paquete: string; cadena: string[] }[] = [];
  const pila: { archivo: string; cadena: string[] }[] = [{ archivo: ENTRADA, cadena: [] }];

  while (pila.length > 0) {
    const { archivo, cadena } = pila.pop()!;
    if (visitados.has(archivo)) continue;
    visitados.add(archivo);

    const fuente = readFileSync(archivo, "utf-8");
    const cadenaAqui = [...cadena, archivo.replace(RAIZ + "/", "")];

    for (const especificador of extraerImports(fuente)) {
      const resuelto = resolverImport(especificador, archivo);
      if (resuelto) {
        pila.push({ archivo: resuelto, cadena: cadenaAqui });
        continue;
      }
      // No es un archivo del proyecto: tiene que ser un paquete instalado.
      if (!resuelveComoPaquete(especificador)) {
        infracciones.push({
          archivo: archivo.replace(RAIZ + "/", ""),
          paquete: especificador,
          cadena: cadenaAqui,
        });
      }
    }
  }

  return { visitados: [...visitados], infracciones };
}

describe("grafo de importaciones del worker", () => {
  const { visitados, infracciones } = analizarGrafo();

  it("recorre un grafo no trivial (si no, el test no estaría probando nada)", () => {
    expect(visitados.length).toBeGreaterThan(20);
  });

  it("todo lo que importa resuelve en Node pelado, sin el runtime de Next", () => {
    const detalle = infracciones
      .map((i) => `\n  ${i.archivo} importa "${i.paquete}"\n    vía: ${i.cadena.join("\n       → ")}`)
      .join("");

    expect(infracciones, `El worker no puede resolver estos imports:${detalle}\n`).toEqual([]);
  });
});
