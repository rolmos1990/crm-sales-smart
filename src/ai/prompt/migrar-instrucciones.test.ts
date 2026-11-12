import { describe, expect, it } from "vitest";
import { construirSystemPrompt, type ConfigAgenteParaPrompt } from "./builder";
import { generarInstruccionesDesdeConfig } from "./migrar-instrucciones";

// Un agente configurado con todo lo que la 009 permite.
const CONFIG_COMPLETA: ConfigAgenteParaPrompt = {
  objetivo: "la venta de hosting",
  especialidad: "infraestructura web",
  personalidad: "cercana",
  nombreAgente: "Sofía",
  rol: "asesora comercial",
  idiomaPrincipal: "es",
  idiomasPermitidos: ["es", "en"],
  configuracionTono: { tono: "Cálido", formalidad: "Semi Formal", tuteo: true, usoEmojis: false },
  longitudRespuesta: "CORTA",
  proactividad: "MEDIA",
  intensidadComercial: "SUAVE",
  estiloRecomendacion: "CONSULTIVO",
  frasesPreferidas: ["con gusto te ayudo"],
  frasesProhibidas: ["no es mi problema"],
  comportamientosProhibidos: ["presionar para cerrar"],
  reglasPersonalizadas: ["Siempre confirma el correo antes de enviar la propuesta"],
  condicionesTransferenciaHumano: ["el cliente pide hablar con una persona"],
};

/**
 * Frases del prompt que salen de lo que el negocio configuró, sin los
 * encabezados de sección: la migración cambia "Estilo de comunicación:" por
 * "# Estilo de comunicación" a propósito. Lo que no puede cambiar es lo que
 * dicen las líneas de abajo.
 */
function lineasConfigurables(prompt: string): string[] {
  const corte = prompt.indexOf("Comportamiento natural (siempre aplica):");
  const configurable = corte === -1 ? prompt : prompt.slice(0, corte);
  return configurable
    .split("\n")
    .map((l) => l.replace(/^[-\s]+/, "").trim())
    .filter((l) => l.length > 0 && !l.endsWith(":") && !l.startsWith("#"));
}

describe("generarInstruccionesDesdeConfig", () => {
  it("conserva todo lo que el agente ya decía", () => {
    const antes = construirSystemPrompt(CONFIG_COMPLETA);
    const instruccionesAgente = generarInstruccionesDesdeConfig(CONFIG_COMPLETA);
    const despues = construirSystemPrompt({ ...CONFIG_COMPLETA, instruccionesAgente });

    // Cada frase configurable del prompt viejo sigue en el nuevo. Es la
    // garantía de que migrar no le cambia el comportamiento a nadie.
    for (const linea of lineasConfigurables(antes)) {
      expect(despues, `se perdió: "${linea}"`).toContain(linea);
    }
  });

  it("mantiene los bloques fijos del sistema", () => {
    const instruccionesAgente = generarInstruccionesDesdeConfig(CONFIG_COMPLETA);
    const prompt = construirSystemPrompt({ ...CONFIG_COMPLETA, instruccionesAgente });

    expect(prompt).toContain("Comportamiento natural (siempre aplica):");
    expect(prompt).toContain("Restricciones:");
    expect(prompt).toContain("SEGURIDAD:");
    expect(prompt).toContain("Nunca inventes un precio.");
  });

  it("no duplica las reglas: con el bloque, dejan de componerse por campos", () => {
    const instruccionesAgente = generarInstruccionesDesdeConfig(CONFIG_COMPLETA);
    const prompt = construirSystemPrompt({ ...CONFIG_COMPLETA, instruccionesAgente });

    const vecesRegla = prompt.split("Siempre confirma el correo antes de enviar la propuesta").length - 1;
    expect(vecesRegla).toBe(1);
    expect(prompt).not.toContain("Reglas del negocio:");
    expect(prompt).not.toContain("Estilo de comunicación:\n-");
  });

  it("arma las secciones en markdown", () => {
    const texto = generarInstruccionesDesdeConfig(CONFIG_COMPLETA);
    expect(texto).toContain("# Rol y objetivo");
    expect(texto).toContain("# Estilo de comunicación");
    expect(texto).toContain("# Reglas");
    // Nada alimenta el proceso hoy: no se inventa uno.
    expect(texto).not.toContain("# Proceso de atención");
  });

  it("un agente sin nada configurado conserva su rol por defecto", () => {
    const texto = generarInstruccionesDesdeConfig({});
    expect(texto).toContain("# Rol y objetivo");
    expect(texto).toContain("Eres un asistente comercial");
    expect(texto).not.toContain("# Estilo de comunicación");
    expect(texto).not.toContain("# Reglas");
  });

  it("respeta el texto de un agente ya migrado", () => {
    const propio = "# Rol y objetivo\nEres otra cosa.";
    expect(generarInstruccionesDesdeConfig({ ...CONFIG_COMPLETA, instruccionesAgente: propio })).toBe(propio);
  });

  it("el agente sin migrar sigue generando el prompt de siempre", () => {
    const sinMigrar = construirSystemPrompt(CONFIG_COMPLETA);
    expect(sinMigrar).toContain("Estilo de comunicación:");
    expect(sinMigrar).toContain("Reglas del negocio:");
    expect(sinMigrar).toContain("Eres un asistente especializado en la venta de hosting");
  });
});
