import { describe, expect, it } from "vitest";

// 033 — El límite operativo de la documentación es el PESO TOTAL de la cuenta,
// no la cantidad de archivos. Estos tests fijan ese contrato y, sobre todo, el
// orden de los chequeos: un archivo puede fallar por varios motivos a la vez y
// el que se reporta tiene que ser el que al negocio le sirve para corregirlo.

import {
  MAX_DOCUMENTOS_AGENTE,
  MAX_PESO_TOTAL_INSTANCIA,
  formatearPeso,
  validarArchivo,
} from "./tipos";

const MB = 1024 * 1024;

describe("validarArchivo — presupuesto por instancia", () => {
  it("acepta un archivo que entra justo en el tope de la cuenta", () => {
    const r = validarArchivo("politicas.pdf", 5 * MB, 0, MAX_PESO_TOTAL_INSTANCIA - 5 * MB);

    expect(r.ok).toBe(true);
  });

  it("rechaza por un solo byte de más", () => {
    const r = validarArchivo("politicas.pdf", 5 * MB + 1, 0, MAX_PESO_TOTAL_INSTANCIA - 5 * MB);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("SIN_ESPACIO");
    // El mensaje tiene que decir cuánto queda: sin eso el negocio no sabe qué
    // recortar ni cuánto liberar.
    expect(r.mensaje).toContain("quedan");
  });

  it("deja que un solo archivo consuma todo el presupuesto", () => {
    const r = validarArchivo("catalogo.pdf", MAX_PESO_TOTAL_INSTANCIA, 0, 0);

    expect(r.ok).toBe(true);
  });

  it("con la cuenta llena pide eliminar, no habla de espacio restante", () => {
    const r = validarArchivo("politicas.pdf", 1024, 0, MAX_PESO_TOTAL_INSTANCIA);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("SIN_ESPACIO");
    expect(r.mensaje).toContain("Eliminá");
  });

  it("no le importa la cantidad de archivos mientras haya espacio", () => {
    const r = validarArchivo("nota.txt", 1024, MAX_DOCUMENTOS_AGENTE - 1, 0);

    expect(r.ok).toBe(true);
  });
});

describe("validarArchivo — orden de los chequeos", () => {
  it("una imagen sigue reportando ES_IMAGEN aunque tampoco haya espacio", () => {
    const r = validarArchivo("logo.png", 5 * MB, 0, MAX_PESO_TOTAL_INSTANCIA);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("ES_IMAGEN");
  });

  it("una extensión no soportada se reporta como tal, no como falta de espacio", () => {
    const r = validarArchivo("video.mp4", 5 * MB, 0, MAX_PESO_TOTAL_INSTANCIA);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("EXTENSION_NO_SOPORTADA");
  });

  it("el tope de cordura por agente sigue frenando", () => {
    const r = validarArchivo("nota.txt", 1024, MAX_DOCUMENTOS_AGENTE, 0);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("LIMITE_ALCANZADO");
  });
});

describe("formatearPeso", () => {
  it("no le pone decimal a un valor redondo", () => {
    expect(formatearPeso(20 * MB)).toBe("20 MB");
  });

  it("cae a KB cuando MB no diría nada útil", () => {
    expect(formatearPeso(4 * 1024)).toBe("4 KB");
  });

  it("una cuenta vacía muestra 0, no el mínimo de 1 KB", () => {
    expect(formatearPeso(0)).toBe("0 KB");
  });
});
