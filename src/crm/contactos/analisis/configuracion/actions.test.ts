import { beforeEach, describe, expect, it, vi } from "vitest";

// 042 — Configuración del análisis: solo administración (`ia`), solo la cuenta
// de la sesión, sin `peso`, y cambiar el modo de interés no toca contactos.

const permiso = vi.fn();
const upsert = vi.fn(async (..._a: unknown[]) => ({}));
const findUnique = vi.fn();
const reintentarFallidos = vi.fn(async (..._a: unknown[]) => 7);
const contactoUpdate = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/auth/permisos-server", () => ({ requirePermisoAction: (...a: unknown[]) => permiso(...a) }));
vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    configuracionAnalisisContactos: { upsert: (...a: unknown[]) => upsert(...a), findUnique: (...a: unknown[]) => findUnique(...a) },
    contacto: { updateMany: contactoUpdate },
  },
}));
vi.mock("../cola", () => ({ reintentarFallidos: (...a: unknown[]) => reintentarFallidos(...a), invalidarParametrosCola: vi.fn() }));

const { guardarInterruptoresAnalisisAction, guardarConfiguracionAnalisisAction, reintentarFallidosAction } = await import("./actions");
const { CONFIGURACION_ANALISIS_DEFECTO } = await import("./schema");

beforeEach(() => {
  vi.clearAllMocks();
  permiso.mockResolvedValue({ ok: true, sesion: { instanciaId: "inst-1", usuarioInstanciaId: "ui-1" } });
  findUnique.mockResolvedValue({ modoInteres: "SOLO_SUGERIR" });
});

describe("guardarInterruptoresAnalisisAction", () => {
  it("guarda para la cuenta de la sesión", async () => {
    expect(await guardarInterruptoresAnalisisAction({ habilitado: false, historicoPausado: true })).toEqual({ exito: true, datos: undefined });
    expect(upsert).toHaveBeenCalledWith({
      where: { instanciaId: "inst-1" },
      create: { instanciaId: "inst-1", habilitado: false, historicoPausado: true },
      update: { habilitado: false, historicoPausado: true },
    });
    expect(permiso).toHaveBeenCalledWith("ia", "modificar");
  });

  it("sin permiso de IA se rechaza", async () => {
    permiso.mockResolvedValue({ ok: false, error: "Sin permiso" });
    expect(await guardarInterruptoresAnalisisAction({ habilitado: false, historicoPausado: false })).toEqual({ exito: false, error: "Sin permiso" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("datos inválidos se rechazan antes de tocar la base", async () => {
    expect(await guardarInterruptoresAnalisisAction({ habilitado: "si" })).toMatchObject({ exito: false });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("guardarConfiguracionAnalisisAction", () => {
  it("ignora `peso` aunque llegue en la entrada", async () => {
    await guardarConfiguracionAnalisisAction({ ...CONFIGURACION_ANALISIS_DEFECTO, peso: 10 });
    const llamada = upsert.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(llamada.update).not.toHaveProperty("peso");
  });

  it("valida rangos (lote de 51 → rechazo)", async () => {
    expect(await guardarConfiguracionAnalisisAction({ ...CONFIGURACION_ANALISIS_DEFECTO, tamanoLote: 51 })).toMatchObject({ exito: false });
  });

  it("cambiar el modo de interés registra quién y cuándo, y no toca contactos", async () => {
    await guardarConfiguracionAnalisisAction({ ...CONFIGURACION_ANALISIS_DEFECTO, modoInteres: "APLICAR_AUTOMATICO" });
    const llamada = upsert.mock.calls[0][0] as { update: Record<string, unknown> };
    expect(llamada.update).toMatchObject({ modoInteres: "APLICAR_AUTOMATICO", modoInteresCambiadoPorId: "ui-1" });
    expect(contactoUpdate).not.toHaveBeenCalled();
  });
});

describe("reintentarFallidosAction", () => {
  it("solo afecta a la cuenta de la sesión", async () => {
    expect(await reintentarFallidosAction()).toEqual({ exito: true, datos: { reintentados: 7 } });
    expect(reintentarFallidos).toHaveBeenCalledWith("inst-1");
  });
});
