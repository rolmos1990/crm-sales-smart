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

vi.mock("@/shared/db/prisma", () => ({
  prisma: {
    proveedorIA: {
      findFirst: (...a: unknown[]) => findFirstMock(...a),
      create: (...a: unknown[]) => createMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { crearProveedorIA, actualizarProveedorIA } = await import("./actions");

const datosBase = {
  alias: "DeepSeek Ventas",
  proveedor: "DEEPSEEK" as const,
  tipoAgenteIA: null,
  apiKey: "sk-test-123",
  baseUrl: "",
  modelosDisponibles: "deepseek-chat",
  prioridad: 5,
  limitePorMinuto: null,
  limitePorDia: null,
  timeoutMs: 30000,
  reintentosMax: 2,
};

function errorP2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7.8.0",
  });
}

describe("configuracion/ia/actions — 021-alias-proveedores-ia", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    createMock.mockReset().mockResolvedValue({ id: "nuevo-1" });
    updateMock.mockReset().mockResolvedValue({ id: "existente-1" });
  });

  describe("crearProveedorIA", () => {
    it("crea un agente con alias válido (sin duplicado)", async () => {
      findFirstMock.mockResolvedValue(null); // sin duplicado
      const resultado = await crearProveedorIA(datosBase);

      expect(resultado.exito).toBe(true);
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alias: "DeepSeek Ventas",
            aliasNormalizado: "deepseek ventas",
            proveedor: "DEEPSEEK",
          }),
        }),
      );
    });

    it("permite un segundo agente del mismo proveedor y tipoAgenteIA (ya no choca con la restricción vieja)", async () => {
      findFirstMock.mockResolvedValue(null); // el "duplicado" comprobado es por alias, no por proveedor+tipo
      const resultado = await crearProveedorIA({ ...datosBase, alias: "DeepSeek Soporte" });

      expect(resultado.exito).toBe(true);
      expect(findFirstMock).toHaveBeenCalledWith({
        where: { instanciaId: "instancia-1", aliasNormalizado: "deepseek soporte" },
      });
    });

    it("rechaza alias vacío antes de tocar Prisma", async () => {
      const resultado = await crearProveedorIA({ ...datosBase, alias: "   " });

      expect(resultado.exito).toBe(false);
      expect(findFirstMock).not.toHaveBeenCalled();
      expect(createMock).not.toHaveBeenCalled();
    });

    it("rechaza un alias duplicado exacto", async () => {
      findFirstMock.mockResolvedValue({ id: "otro-1" });
      const resultado = await crearProveedorIA(datosBase);

      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain("DeepSeek Ventas");
      expect(createMock).not.toHaveBeenCalled();
    });

    it("rechaza un alias duplicado insensible a mayúsculas y espacios de borde", async () => {
      findFirstMock.mockResolvedValue({ id: "otro-1" });
      const resultado = await crearProveedorIA({ ...datosBase, alias: "  deepseek ventas " });

      expect(resultado.exito).toBe(false);
      expect(findFirstMock).toHaveBeenCalledWith({
        where: { instanciaId: "instancia-1", aliasNormalizado: "deepseek ventas" },
      });
    });

    it("traduce una condición de carrera (P2002) al mismo mensaje de negocio, sin exponer el error de Prisma", async () => {
      findFirstMock.mockResolvedValue(null); // pasó el pre-check...
      createMock.mockRejectedValue(errorP2002()); // ...pero chocó en el create real

      const resultado = await crearProveedorIA(datosBase);

      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain("Ya existe un agente con el alias");
      expect(resultado.error).not.toContain("P2002");
    });
  });

  describe("actualizarProveedorIA", () => {
    const existente = { id: "prov-1", instanciaId: "instancia-1", apiKeyEncriptada: "clave-guardada" };

    it("edita conservando su propio alias sin marcarlo como duplicado consigo mismo", async () => {
      findFirstMock
        .mockResolvedValueOnce(existente) // verificación de tenencia
        .mockResolvedValueOnce(null); // verificación de duplicado (excluyendo el propio id)

      const resultado = await actualizarProveedorIA("prov-1", datosBase);

      expect(resultado.exito).toBe(true);
      expect(findFirstMock).toHaveBeenNthCalledWith(2, {
        where: { instanciaId: "instancia-1", aliasNormalizado: "deepseek ventas", NOT: { id: "prov-1" } },
      });
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "prov-1" } }),
      );
    });

    it("rechaza editar hacia un alias usado por otro agente", async () => {
      findFirstMock
        .mockResolvedValueOnce(existente)
        .mockResolvedValueOnce({ id: "otro-2" }); // otro agente ya tiene ese alias

      const resultado = await actualizarProveedorIA("prov-1", datosBase);

      expect(resultado.exito).toBe(false);
      expect(resultado.error).toContain("DeepSeek Ventas");
      expect(updateMock).not.toHaveBeenCalled();
    });

    it("rechaza editar un proveedor que no pertenece a la instancia (o no existe)", async () => {
      findFirstMock.mockResolvedValueOnce(null); // no encontrado por tenencia

      const resultado = await actualizarProveedorIA("prov-otro", datosBase);

      expect(resultado.exito).toBe(false);
      expect(resultado.error).toBe("Proveedor no encontrado");
      expect(updateMock).not.toHaveBeenCalled();
    });

    it("conserva la API key existente cuando se edita sin reingresarla", async () => {
      findFirstMock.mockResolvedValueOnce(existente).mockResolvedValueOnce(null);

      await actualizarProveedorIA("prov-1", { ...datosBase, apiKey: "" });

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ apiKeyEncriptada: "clave-guardada" }),
        }),
      );
    });

    it("rechaza alias vacío en edición", async () => {
      findFirstMock.mockResolvedValueOnce(existente);

      const resultado = await actualizarProveedorIA("prov-1", { ...datosBase, alias: "" });

      expect(resultado.exito).toBe(false);
      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
