import { describe, expect, it } from "vitest";
import { producirCapaConocimiento } from "./conocimiento";

// 033 — Lo que esta capa emite cambió de raíz: antes llevaba el TEXTO de los
// documentos, ahora lleva la política de cuándo consultarlos. El test que más
// importa acá es el que verifica que el contenido de un archivo no puede
// volver a filtrarse al prompt por accidente.

describe("producirCapaConocimiento", () => {
  it("devuelve null sin documentación — el agente se comporta como antes de la feature", () => {
    expect(producirCapaConocimiento({ tieneDocumentacion: false, nombres: [] })).toBeNull();
  });

  it("devuelve null si dice tener documentación pero no hay nombres", () => {
    expect(producirCapaConocimiento({ tieneDocumentacion: true, nombres: [] })).toBeNull();
  });

  it("nombra la herramienta y lista los archivos disponibles", () => {
    const texto = producirCapaConocimiento({
      tieneDocumentacion: true,
      nombres: ["politica-envios.pdf", "manual-cuidados.docx"],
    });

    expect(texto).toContain("buscar_en_documentacion");
    expect(texto).toContain("politica-envios.pdf");
    expect(texto).toContain("manual-cuidados.docx");
  });

  it("emite las cinco reglas de la política de consulta", () => {
    const texto = producirCapaConocimiento({ tieneDocumentacion: true, nombres: ["faq.pdf"] })!;

    // Saludos y preguntas ya contestadas → sin búsqueda
    expect(texto).toContain("saludos");
    // Información estable del comercio → sí buscar
    expect(texto).toContain("políticas");
    // Precios y stock → herramientas de datos, nunca documentos
    expect(texto).toContain("No uses documentos como sustituto");
    // No buscar en cada mensaje
    expect(texto).toContain("No consultes documentos para cada mensaje");
    // No inventar
    expect(texto).toContain("no la inventes");
  });

  it("resume cuando hay más documentos de los que vale la pena listar", () => {
    const nombres = Array.from({ length: 12 }, (_, i) => `doc-${i}.pdf`);
    const texto = producirCapaConocimiento({ tieneDocumentacion: true, nombres })!;

    expect(texto).toContain("doc-0.pdf");
    // Listar los 12 gastaría más contexto del que esta capa vino a ahorrar.
    expect(texto).not.toContain("doc-11.pdf");
    expect(texto).toContain("y 4 más");
  });

  it("NUNCA emite el contenido de un documento, solo su nombre", () => {
    const texto = producirCapaConocimiento({
      tieneDocumentacion: true,
      nombres: ["politica-envios.pdf"],
    })!;

    // El contenido vive indexado en OpenAI y llega por la herramienta. Si
    // alguna vez volviera a inyectarse acá, se perdería todo el ahorro de
    // contexto que justifica esta feature.
    expect(texto).not.toContain("Enviamos a todo el país");
    expect(texto.length).toBeLessThan(1500);
  });
});
