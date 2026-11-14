import { describe, expect, it, vi, beforeEach } from "vitest";
import { CategoriaIntencionAutonomia } from "@/generated/prisma/enums";

const generarRespuestaMock = vi.fn();
vi.mock("@/ai/gateway/gateway", () => ({ generarRespuesta: (...a: unknown[]) => generarRespuestaMock(...a) }));

const { clasificarCategoriaIntencion } = await import("./clasificador");

/** El prompt del sistema con el que se llamó al modelo. */
const promptUsado = () => generarRespuestaMock.mock.calls[0][0].mensajes[0].contenido as string;

const respondeCon = (categorias: Array<{ categoria: string; confianza: number }>) =>
  generarRespuestaMock.mockResolvedValue({ contenido: JSON.stringify({ categorias }) });

beforeEach(() => {
  generarRespuestaMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Sin definiciones, el modelo adivina por el nombre: "prefiero que me la
// envíen" caía en EXCEPCION_ENTREGA y, como está en HUMAN_ONLY, el agente se
// callaba justo cuando el cliente quería comprar. Estas pruebas existen para
// que nadie vuelva a dejar la lista pelada.
describe("INSTRUCCION_CLASIFICACION — las categorías van definidas", () => {
  beforeEach(() => respondeCon([{ categoria: "SALUDO", confianza: 0.9 }]));

  it("las 16 categorías del enum aparecen en el prompt", async () => {
    await clasificarCategoriaIntencion("hola", "inst-1");
    const prompt = promptUsado();

    for (const categoria of Object.values(CategoriaIntencionAutonomia)) {
      expect(prompt).toContain(categoria);
    }
  });

  it("cada categoría lleva su definición, no solo el nombre", async () => {
    await clasificarCategoriaIntencion("hola", "inst-1");
    const prompt = promptUsado();

    for (const categoria of Object.values(CategoriaIntencionAutonomia)) {
      expect(prompt).toMatch(new RegExp(`- ${categoria}: \\S`));
    }
  });

  it("separa las categorías seguras de las que exigen una persona", async () => {
    await clasificarCategoriaIntencion("hola", "inst-1");

    expect(promptUsado()).toContain("Categorías seguras");
    expect(promptUsado()).toContain("exigen una persona");
  });

  it("incluye la regla de desempate: ante la duda, la segura", async () => {
    await clasificarCategoriaIntencion("hola", "inst-1");

    expect(promptUsado()).toMatch(/[Aa]nte la duda[\s\S]*elige la segura/);
  });

  it("aclara explícitamente que pedir un envío normal NO es una excepción de entrega", async () => {
    await clasificarCategoriaIntencion("hola", "inst-1");

    expect(promptUsado()).toContain("Pedir un envío normal NO es una excepción");
  });

  it("aclara que un “sí” no es un compromiso no definido", async () => {
    await clasificarCategoriaIntencion("hola", "inst-1");

    expect(promptUsado()).toMatch(/NO uses esta categoría para un "sí"/);
  });
});

describe("clasificarCategoriaIntencion — parseo y validación", () => {
  it("devuelve las categorías con su confianza", async () => {
    respondeCon([{ categoria: "SOLICITUD_COTIZACION", confianza: 0.9 }]);

    await expect(clasificarCategoriaIntencion("si por favor", "inst-1")).resolves.toEqual({
      categorias: [{ categoria: "SOLICITUD_COTIZACION", confianza: 0.9 }],
    });
  });

  it("descarta una categoría que no existe en el enum", async () => {
    respondeCon([{ categoria: "QUIERE_COMPRAR_YA", confianza: 0.9 }, { categoria: "SALUDO", confianza: 0.4 }]);

    const r = await clasificarCategoriaIntencion("hola", "inst-1");

    expect(r?.categorias).toEqual([{ categoria: "SALUDO", confianza: 0.4 }]);
  });

  it("tolera el JSON envuelto en markdown", async () => {
    generarRespuestaMock.mockResolvedValue({
      contenido: '```json\n{"categorias":[{"categoria":"SALUDO","confianza":0.8}]}\n```',
    });

    expect((await clasificarCategoriaIntencion("hola", "inst-1"))?.categorias).toHaveLength(1);
  });

  it("un mensaje vacío no gasta una llamada al modelo", async () => {
    expect(await clasificarCategoriaIntencion("   ", "inst-1")).toBeNull();
    expect(generarRespuestaMock).not.toHaveBeenCalled();
  });

  it("si el proveedor falla devuelve null en vez de lanzar (FR-010)", async () => {
    generarRespuestaMock.mockRejectedValue(new Error("proveedor caído"));

    expect(await clasificarCategoriaIntencion("hola", "inst-1")).toBeNull();
  });

  it("si ninguna categoría es válida devuelve null, no una lista vacía", async () => {
    respondeCon([{ categoria: "INVENTADA", confianza: 0.9 }]);

    expect(await clasificarCategoriaIntencion("hola", "inst-1")).toBeNull();
  });
});
