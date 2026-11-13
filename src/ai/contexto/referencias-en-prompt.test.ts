import { describe, expect, it, vi, beforeEach } from "vitest";
import { construirSystemPrompt, type ConfigAgenteParaPrompt } from "@/ai/prompt/builder";

// Verifica el enganche de las referencias `@` en el único punto por el que
// pasan el flujo real y el simulador (construirContextoCompuesto). La lógica
// de expansión en sí ya está cubierta en configuracion/referencias/.

const plantillaFindManyMock = vi.fn();
const usuarioInstanciaFindManyMock = vi.fn();
const productoFindManyMock = vi.fn();

vi.mock("./capas/estrategia-activa", () => ({ producirCapaEstrategia: vi.fn() }));
vi.mock("./capas/perfil-cliente", () => ({ producirCapaPerfilCliente: vi.fn() }));
vi.mock("./capas/ejemplos-piloto", () => ({
  producirCapaEjemplosPiloto: vi.fn().mockResolvedValue({ texto: null, ejemplosIds: [] }),
}));
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    producto: { findMany: (...a: unknown[]) => productoFindManyMock(...a) },
    plantillaCRM: { findMany: (...a: unknown[]) => plantillaFindManyMock(...a) },
    usuarioInstancia: { findMany: (...a: unknown[]) => usuarioInstanciaFindManyMock(...a) },
  },
}));

const { construirContextoCompuesto } = await import("./context-builder");

const PLANTILLA = {
  nombre: "Métodos de envío",
  alias: "metodos_envios",
  contenidoTexto: "Hacemos envíos a todo el país con Uno Express.",
  imagenUrl: null,
};

const componer = (configAgente: ConfigAgenteParaPrompt) =>
  construirContextoCompuesto({ instanciaId: "inst-1" }, { configAgente, contextoDinamico: {} });

beforeEach(() => {
  plantillaFindManyMock.mockReset().mockResolvedValue([PLANTILLA]);
  usuarioInstanciaFindManyMock.mockReset().mockResolvedValue([]);
  // Capa 8 (catálogo) y resolución de `@producto:` comparten producto.findMany.
  productoFindManyMock.mockReset().mockResolvedValue([]);
});

describe("referencias `@` en el systemPrompt", () => {
  it("expande el contenido vivo de la plantilla referenciada", async () => {
    const { systemPrompt } = await componer({
      objetivo: "ventas",
      instruccionesAgente: "Si preguntan por envío, respondé siguiendo @plantilla:metodos_envios",
    });

    expect(systemPrompt).toContain("«Plantilla · Métodos de envío»");
    expect(systemPrompt).toContain("Hacemos envíos a todo el país con Uno Express.");
    expect(systemPrompt).not.toContain("@plantilla:metodos_envios");
  });

  it("el contenido referenciado va antes de las reglas fijas del sistema", async () => {
    const { systemPrompt } = await componer({
      objetivo: "ventas",
      instruccionesAgente: "Seguí @plantilla:metodos_envios",
    });

    expect(systemPrompt.indexOf("Uno Express")).toBeLessThan(systemPrompt.indexOf("SEGURIDAD:"));
    expect(systemPrompt.indexOf("Uno Express")).toBeLessThan(
      systemPrompt.indexOf("Comportamiento natural"),
    );
  });

  it("sin referencias el prompt es byte-idéntico y no se consulta nada (SC-001 de la 013)", async () => {
    const config: ConfigAgenteParaPrompt = {
      objetivo: "ventas",
      instruccionesAgente: "# Rol\nSos un asesor comercial.",
    };

    const { systemPrompt } = await componer(config);

    expect(systemPrompt).toBe(construirSystemPrompt(config, {}));
    expect(plantillaFindManyMock).not.toHaveBeenCalled();
    expect(usuarioInstanciaFindManyMock).not.toHaveBeenCalled();
  });

  it("una referencia rota no tumba el prompt: queda literal y el resto se arma igual", async () => {
    plantillaFindManyMock.mockResolvedValue([]);

    const { systemPrompt } = await componer({
      objetivo: "ventas",
      instruccionesAgente: "Seguí @plantilla:borrada",
    });

    expect(systemPrompt).toContain("@plantilla:borrada");
    expect(systemPrompt).toContain("SEGURIDAD:");
  });

  it("también expande el formato de una respuesta guía", async () => {
    const { systemPrompt } = await componer({
      objetivo: "ventas",
      instruccionesAgente: "# Rol\nSos un asesor.",
      respuestasGuia: [
        {
          id: "1",
          intencion: "ENVIO",
          cuandoAplica: "preguntan por envío",
          formato: "contá lo de @plantilla:metodos_envios",
          activa: true,
        },
      ],
    });

    expect(systemPrompt).toContain("contá lo de «Plantilla · Métodos de envío»");
    expect(systemPrompt).toContain("Hacemos envíos a todo el país con Uno Express.");
  });
});
