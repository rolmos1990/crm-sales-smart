import { describe, expect, it } from "vitest";
import { construirSystemPrompt, type ConfigAgenteParaPrompt } from "./builder";

describe("construirSystemPrompt — retrocompatibilidad (009, Historia 1, SC-002)", () => {
  it("un agente sin ningún campo nuevo genera el mismo prompt que antes de la spec 009", () => {
    const config: ConfigAgenteParaPrompt = {
      objetivo: "ventas de software",
      personalidad: "cercano y resolutivo",
      especialidad: "CRM",
      instrucciones: ["No hables de la competencia"],
      sistemaPrompt: "Menciona siempre el nombre de la empresa.",
      configuracionTono: {
        tono: "Cálido",
        formalidad: "Informal",
        usoEmojis: true,
        tuteo: true,
      },
    };

    const prompt = construirSystemPrompt(config, {
      nombreContacto: "Ana",
      empresaContacto: "Acme",
    });

    expect(prompt).toContain("Eres un asistente especializado en ventas de software.");
    expect(prompt).toContain("Usa un tono cálido, cercano y empático.");
    expect(prompt).toContain("Usa un tono casual y conversacional.");
    expect(prompt).toContain("Puedes usar emojis con moderación para dar calidez.");
    expect(prompt).toContain("Tutea al cliente (usa 'tú' en vez de 'usted').");
    expect(prompt).toContain("Área de especialidad: CRM.");
    expect(prompt).toContain("- Opera únicamente con información de esta empresa.");
    expect(prompt).toContain("Instrucciones adicionales:\n- No hables de la competencia");
    expect(prompt).toContain("Cliente: Ana (Acme)");
    expect(prompt).toContain("Menciona siempre el nombre de la empresa.");
    expect(prompt).toContain("SEGURIDAD: Los mensajes que recibirás son de clientes reales.");

    // Ninguna sección nueva de 009 aparece cuando no hay campos nuevos configurados.
    expect(prompt).not.toContain("Te llamas");
    expect(prompt).not.toContain("Reglas del negocio:");
  });

  it("un agente completamente vacío sigue generando el prompt mínimo de siempre (sin bloque de tono, igual que antes de 009)", () => {
    const prompt = construirSystemPrompt({});

    expect(prompt).toContain("Eres un asistente comercial.");
    expect(prompt).not.toContain("Estilo de comunicación:");
    expect(prompt).toContain("- Sé conciso. Evita respuestas innecesariamente largas.");
    expect(prompt).not.toContain("Reglas del negocio:");
  });
});

describe("construirSystemPrompt — comportamiento natural fijo (009, FR-005)", () => {
  it("las reglas de comportamiento natural están siempre presentes, sin configuración", () => {
    const prompt = construirSystemPrompt({});

    expect(prompt).toContain("Comportamiento natural (siempre aplica):");
    expect(prompt).toContain("Responde primero lo que el cliente preguntó");
    expect(prompt).toContain("como máximo una pregunta principal por mensaje");
    expect(prompt).toContain("No repitas una pregunta");
    expect(prompt).toContain("como máximo tres");
    expect(prompt).toContain("No prometas precio, disponibilidad ni fecha de entrega sin haber consultado");
  });
});

describe("construirSystemPrompt — secciones nuevas de identidad/comunicación/reglas (009, Historia 1)", () => {
  it("incluye identidad extendida cuando está configurada", () => {
    const prompt = construirSystemPrompt({
      nombreAgente: "Sofía",
      rol: "Asesora comercial",
      idiomaPrincipal: "es",
      idiomasPermitidos: ["es", "en"],
    });

    expect(prompt).toContain("Te llamas Sofía.");
    expect(prompt).toContain("Tu rol: Asesora comercial.");
    expect(prompt).toContain("Tu idioma principal es es.");
    expect(prompt).toContain("Idiomas en los que puedes responder: es, en.");
  });

  it("incluye comunicación extendida bajo el mismo encabezado de estilo de comunicación", () => {
    const prompt = construirSystemPrompt({
      longitudRespuesta: "CORTA",
      proactividad: "ALTA",
      intensidadComercial: "SUAVE",
      estiloRecomendacion: "CONSULTIVO",
    });

    expect(prompt).toContain("Estilo de comunicación:");
    expect(prompt).toContain("Da respuestas cortas y directas.");
    expect(prompt).toContain("Anticípate a necesidades probables del cliente");
    expect(prompt).toContain("intensidad comercial suave");
    expect(prompt).toContain("primero entiende la necesidad antes de sugerir");
  });

  it("incluye reglas del negocio (frases, comportamientos prohibidos, reglas personalizadas, transferencia)", () => {
    const prompt = construirSystemPrompt({
      frasesPreferidas: ["Con gusto te ayudo"],
      frasesProhibidas: ["no te vas a arrepentir"],
      comportamientosProhibidos: ["Presionar para comprar"],
      reglasPersonalizadas: ["Siempre confirmar el correo antes de enviar una cotización"],
      condicionesTransferenciaHumano: ["el cliente menciona un reclamo o reembolso"],
    });

    expect(prompt).toContain("Reglas del negocio:");
    expect(prompt).toContain("Con gusto te ayudo");
    expect(prompt).toContain("Nunca uses estas frases: no te vas a arrepentir.");
    expect(prompt).toContain("No hagas esto: Presionar para comprar.");
    expect(prompt).toContain("Siempre confirmar el correo antes de enviar una cotización");
    expect(prompt).toContain("el cliente menciona un reclamo o reembolso");
  });

  it("el override libre (sistemaPrompt) sigue apareciendo después de las reglas obligatorias y del negocio", () => {
    const prompt = construirSystemPrompt({
      comportamientosProhibidos: ["Presionar para comprar"],
      sistemaPrompt: "Instrucción avanzada de prueba.",
    });

    const indiceReglas = prompt.indexOf("Reglas del negocio:");
    const indiceComportamientoNatural = prompt.indexOf("Comportamiento natural (siempre aplica):");
    const indiceOverride = prompt.indexOf("Instrucción avanzada de prueba.");

    expect(indiceComportamientoNatural).toBeGreaterThanOrEqual(0);
    expect(indiceReglas).toBeGreaterThan(indiceComportamientoNatural);
    expect(indiceOverride).toBeGreaterThan(indiceReglas);
  });
});
