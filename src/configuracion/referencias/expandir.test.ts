import { describe, expect, it, vi, beforeEach } from "vitest";
import { expandirReferenciasAgente } from "./expandir";
import type { Referencia, ReferenciaResuelta } from "./tipos";

// El resolver se inyecta: así este test cubre la orquestación (qué textos se
// recorren, dónde cae el bloque, qué se deja intacto) sin mezclarse con la
// resolución contra Prisma, que ya cubre queries.test.ts.
const resolverMock = vi.fn<(i: string, r: Referencia[]) => Promise<Map<string, ReferenciaResuelta>>>();

const ENVIOS: ReferenciaResuelta = {
  tipo: "plantilla",
  clave: "metodos_envios",
  token: "@plantilla:metodos_envios",
  etiqueta: "Plantilla · Métodos de envío",
  contenido: "Hacemos envíos a todo el país con Uno Express.",
};

beforeEach(() => {
  resolverMock.mockReset().mockResolvedValue(new Map([["plantilla:metodos_envios", ENVIOS]]));
});

const expandir = <T extends Parameters<typeof expandirReferenciasAgente>[0]>(config: T) =>
  expandirReferenciasAgente(config, "inst-1", resolverMock);

describe("expandirReferenciasAgente", () => {
  it("reemplaza el token por la etiqueta y anexa el contenido vivo", async () => {
    const r = await expandir({
      instruccionesAgente: "Si preguntan por envío, respondé siguiendo @plantilla:metodos_envios",
    });

    expect(r.instruccionesAgente).toContain("respondé siguiendo «Plantilla · Métodos de envío»");
    expect(r.instruccionesAgente).toContain("Uno Express");
    expect(r.instruccionesAgente).not.toContain("@plantilla:metodos_envios");
  });

  it("sin ningún `@` devuelve el MISMO objeto y no resuelve nada", async () => {
    const config = { instruccionesAgente: "# Rol\nSos un asesor comercial." };

    const r = await expandir(config);

    expect(r).toBe(config);
    expect(resolverMock).not.toHaveBeenCalled();
  });

  it("un `@` que no es una referencia tampoco dispara una resolución", async () => {
    const config = { instruccionesAgente: "escribinos a hola@empresa.com" };

    const r = await expandir(config);

    expect(r).toBe(config);
    expect(resolverMock).not.toHaveBeenCalled();
  });

  it("también expande el formato de las respuestas guía", async () => {
    const r = await expandir({
      instruccionesAgente: "# Rol\nSos un asesor.",
      respuestasGuia: [
        { id: "1", intencion: "ENVIO", cuandoAplica: "preguntan por envío", formato: "usá @plantilla:metodos_envios", activa: true },
      ],
    });

    const guias = r.respuestasGuia as { formato: string }[];
    expect(guias[0].formato).toBe("usá «Plantilla · Métodos de envío»");
    expect(guias[0]).toMatchObject({ id: "1", intencion: "ENVIO", activa: true });
  });

  it("el mismo token en instrucciones y en una respuesta guía inyecta el contenido una sola vez", async () => {
    const r = await expandir({
      instruccionesAgente: "seguí @plantilla:metodos_envios",
      respuestasGuia: [{ id: "1", formato: "usá @plantilla:metodos_envios", activa: true }],
    });

    const apariciones = r.instruccionesAgente!.split("Uno Express").length - 1;
    expect(apariciones).toBe(1);
    expect(resolverMock.mock.calls[0][1]).toHaveLength(1);
  });

  it("un token que no resolvió queda literal y no genera bloque", async () => {
    resolverMock.mockResolvedValue(new Map());

    const config = { instruccionesAgente: "seguí @plantilla:no_existe" };
    const r = await expandir(config);

    expect(r).toBe(config);
  });

  it("agente sin instruccionesAgente: el bloque va a sistemaPrompt, no activa el camino migrado", async () => {
    // Un agente anterior al backfill compone su prompt desde rol/tono/
    // especialidad, y eso ocurre solo mientras `instruccionesAgente` esté
    // vacío — escribirle el bloque ahí le borraría la identidad.
    const r = await expandir({
      instruccionesAgente: null,
      sistemaPrompt: "Override existente.",
      respuestasGuia: [{ id: "1", formato: "usá @plantilla:metodos_envios", activa: true }],
    });

    expect(r.instruccionesAgente).toBeNull();
    expect(r.sistemaPrompt).toContain("Uno Express");
    expect(r.sistemaPrompt).toContain("Override existente.");
  });

  it("no muta la config original", async () => {
    const config = {
      instruccionesAgente: "seguí @plantilla:metodos_envios",
      respuestasGuia: [{ id: "1", formato: "usá @plantilla:metodos_envios", activa: true }],
    };

    await expandir(config);

    expect(config.instruccionesAgente).toBe("seguí @plantilla:metodos_envios");
    expect(config.respuestasGuia[0].formato).toBe("usá @plantilla:metodos_envios");
  });
});
