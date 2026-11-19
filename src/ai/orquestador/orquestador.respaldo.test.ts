import { describe, expect, it, vi } from "vitest";

// 042 (FR-025, U3) — Si el proveedor asignado al objetivo ANALISIS_CONTACTOS
// tiene el circuit breaker abierto, se usa el siguiente activo.

const proveedores = [
  {
    id: "asignado",
    proveedor: "DEEPSEEK",
    prioridad: 1,
    activo: true,
    apiKeyEncriptada: "k1",
    modelosDisponibles: ["deepseek-chat"],
    casosDeUso: { objetivos: ["ANALISIS_CONTACTOS"] },
    tipoAgenteIA: null,
    costoInputPorMilToken: null,
    costoOutputPorMilToken: null,
  },
  {
    id: "respaldo",
    proveedor: "OPENAI",
    prioridad: 2,
    activo: true,
    apiKeyEncriptada: "k2",
    modelosDisponibles: ["gpt"],
    casosDeUso: null,
    tipoAgenteIA: null,
    costoInputPorMilToken: null,
    costoOutputPorMilToken: null,
  },
];

vi.mock("@/ai/proveedores/inicializar", () => ({}));
vi.mock("@/ai/queries", () => ({ obtenerProveedoresActivos: vi.fn(async () => proveedores) }));
vi.mock("@/shared/lib/cifrado-tokens", () => ({ descifrarToken: (k: string) => k }));
vi.mock("@/ai/proveedores/registro", () => ({
  crearProveedor: (nombre: string) => ({ nombre }),
}));

const { seleccionarProveedor, registrarFalla } = await import("./orquestador");

describe("seleccionarProveedor — respaldo para el análisis de contactos", () => {
  it("usa el proveedor asignado al objetivo cuando está sano", async () => {
    const r = await seleccionarProveedor("inst-1", undefined, "ANALISIS_CONTACTOS");
    expect(r.proveedorId).toBe("asignado");
  });

  it("con su circuit breaker abierto, pasa al siguiente activo", async () => {
    for (let i = 0; i < 3; i++) registrarFalla("asignado");
    const r = await seleccionarProveedor("inst-1", undefined, "ANALISIS_CONTACTOS");
    expect(r.proveedorId).toBe("respaldo");
  });
});
