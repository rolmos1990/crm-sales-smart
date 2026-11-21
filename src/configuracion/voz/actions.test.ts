import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const sesionMock = {
  usuarioId: "usuario-1",
  nombre: "Admin",
  email: "admin@test.com",
  instanciaId: "instancia-1",
  usuarioInstanciaId: "ui-1",
  rol: "ADMIN" as const,
};

vi.mock("@/shared/auth/sesion", () => ({
  requireSesion: () => Promise.resolve(sesionMock),
}));

const findFirstMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const countMock = vi.fn(async (..._a: unknown[]) => 0);
const configUpdateMock = vi.fn(async (..._a: unknown[]) => ({}));

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    proveedorVoz: {
      findFirst: (...a: unknown[]) => findFirstMock(...a),
      create: (...a: unknown[]) => createMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
    configuracionEmpresa: { update: (...a: unknown[]) => configUpdateMock(...a) },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  crearProveedorVoz,
  actualizarProveedorVoz,
  guardarTranscripcionVozHabilitada,
} = await import("./actions");

const datosBase = {
  alias: "ElevenLabs principal",
  proveedor: "ELEVENLABS" as const,
  apiKey: "sk-test-123",
  baseUrl: "",
  modelo: "scribe_v3",
  prioridad: 5,
  costoPorHora: 0.2,
  limiteMinutosDia: null,
  timeoutMs: 30000,
  reintentosMax: 2,
};

function datosCreados() {
  return (createMock.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
}
function datosActualizados() {
  return (updateMock.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirstMock.mockResolvedValue(null);
  createMock.mockResolvedValue({ id: "pv1" });
  updateMock.mockResolvedValue({ id: "pv1" });
  countMock.mockResolvedValue(0);
});

describe("crearProveedorVoz", () => {
  it("cifra la API key: nunca se guarda en claro", async () => {
    const r = await crearProveedorVoz(datosBase);

    expect(r).toEqual({ exito: true });
    const data = datosCreados();
    expect(data.apiKeyEncriptada).toMatch(/^enc:v1:/);
    expect(String(data.apiKeyEncriptada)).not.toContain("sk-test-123");
  });

  it("normaliza el alias a minúsculas y sin espacios de borde", async () => {
    await crearProveedorVoz({ ...datosBase, alias: "  ElevenLabs Principal  " });

    const data = datosCreados();
    expect(data.alias).toBe("ElevenLabs Principal");
    expect(data.aliasNormalizado).toBe("elevenlabs principal");
  });

  it("rechaza un alias duplicado antes de escribir", async () => {
    findFirstMock.mockResolvedValue({ id: "ya-existe" });

    const r = await crearProveedorVoz(datosBase);

    expect(r).toMatchObject({ exito: false });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("traduce la colisión del índice único a un mensaje entendible", async () => {
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" }),
    );

    const r = await crearProveedorVoz(datosBase);

    expect(r).toMatchObject({ exito: false });
    expect((r as { error: string }).error).toContain("alias");
  });

  it("rechaza un proveedor sin adaptador implementado", async () => {
    const r = await crearProveedorVoz({ ...datosBase, proveedor: "LOCAL" });

    expect(r).toMatchObject({ exito: false });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("acota siempre a la instancia de la sesión", async () => {
    await crearProveedorVoz(datosBase);

    expect(datosCreados().instanciaId).toBe("instancia-1");
  });

  it("sin costoPorHora lo deja en null — no inventa una tarifa", async () => {
    await crearProveedorVoz({ ...datosBase, costoPorHora: null });

    expect(datosCreados().costoPorHora).toBeNull();
  });
});

describe("actualizarProveedorVoz", () => {
  beforeEach(() => findFirstMock.mockResolvedValue({ id: "pv1" }));

  it("API key vacía CONSERVA la vigente: no la borra", async () => {
    // El caso que rompe la cuenta en silencio — un `null` acá dejaría al
    // comercio sin transcripción sin que nadie lo haya pedido.
    await actualizarProveedorVoz("pv1", { ...datosBase, proveedor: undefined, apiKey: "" });

    expect(datosActualizados()).not.toHaveProperty("apiKeyEncriptada");
  });

  it("API key nueva sí la reemplaza, cifrada", async () => {
    await actualizarProveedorVoz("pv1", { ...datosBase, proveedor: undefined, apiKey: "sk-nueva" });

    expect(String(datosActualizados().apiKeyEncriptada)).toMatch(/^enc:v1:/);
  });

  it("el proveedor es inmutable: no se escribe aunque venga en el payload", async () => {
    await actualizarProveedorVoz("pv1", { ...datosBase, proveedor: "OPENAI" });

    expect(datosActualizados()).not.toHaveProperty("proveedor");
  });

  it("no toca un proveedor de otra instancia", async () => {
    findFirstMock.mockResolvedValue(null);

    const r = await actualizarProveedorVoz("de-otra-cuenta", { ...datosBase, proveedor: undefined });

    expect(r).toMatchObject({ exito: false });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("guardarTranscripcionVozHabilitada", () => {
  it("no deja encender sin un proveedor activo con credencial", async () => {
    countMock.mockResolvedValue(0);

    const r = await guardarTranscripcionVozHabilitada(true);

    expect(r).toMatchObject({ exito: false });
    expect(configUpdateMock).not.toHaveBeenCalled();
  });

  it("enciende cuando hay un proveedor utilizable", async () => {
    countMock.mockResolvedValue(1);

    const r = await guardarTranscripcionVozHabilitada(true);

    expect(r).toEqual({ exito: true });
    expect((configUpdateMock.mock.calls[0]![0] as { data: Record<string, unknown> }).data)
      .toEqual({ transcripcionVozHabilitada: true });
  });

  it("apagar no exige proveedor alguno", async () => {
    countMock.mockResolvedValue(0);

    const r = await guardarTranscripcionVozHabilitada(false);

    expect(r).toEqual({ exito: true });
    expect(countMock).not.toHaveBeenCalled();
  });
});
