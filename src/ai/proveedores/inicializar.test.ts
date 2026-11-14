import { describe, expect, it } from "vitest";
import { PROVEEDORES_IMPLEMENTADOS } from "./disponibles";

// Antes de esto, el enum ofrecía seis proveedores y solo tres tenían código.
// Elegir uno de los otros se guardaba sin error y después fallaba en runtime
// con "Proveedor IA no registrado", pero el fallo quedaba solo en el log y el
// agente seguía respondiendo con otro proveedor: imposible de notar.
describe("registro de proveedores IA", () => {
  it("todo proveedor declarado como implementado está realmente registrado", async () => {
    await import("./inicializar");
    const { proveedoresRegistrados } = await import("./registro");

    expect([...proveedoresRegistrados()].sort()).toEqual([...PROVEEDORES_IMPLEMENTADOS].sort());
  });

  it("cada uno se puede construir sin estallar", async () => {
    await import("./inicializar");
    const { crearProveedor } = await import("./registro");

    for (const nombre of PROVEEDORES_IMPLEMENTADOS) {
      expect(() => crearProveedor(nombre, "clave-de-prueba")).not.toThrow();
    }
  });

  it("uno no implementado lanza, en vez de devolver algo a medias", async () => {
    await import("./inicializar");
    const { crearProveedor } = await import("./registro");

    expect(() => crearProveedor("GEMINI", "k")).toThrow(/no registrado/i);
  });

  it("OPENAI se construye y se identifica como tal", async () => {
    await import("./inicializar");
    const { crearProveedor } = await import("./registro");

    expect(crearProveedor("OPENAI", "sk-prueba").nombre).toBe("OPENAI");
  });
});
