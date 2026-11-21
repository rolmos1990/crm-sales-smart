import { describe, it, expect } from "vitest";
import { PROVEEDORES_VOZ_IMPLEMENTADOS, MODELOS_POR_PROVEEDOR_VOZ } from "./disponibles";
import { proveedoresVozRegistrados } from "./registro";
import "./inicializar";

/**
 * Mantiene sincronizados el registro real y la lista que ve el formulario.
 *
 * Si se desincronizan, el comercio puede dar de alta un proveedor que no
 * existe: se guarda sin una queja y después falla en runtime con "Proveedor de
 * voz no registrado", en el log del servidor. El negocio creería tener la
 * transcripción activa y ningún audio se transcribiría.
 */
describe("registro de proveedores de voz", () => {
  it("todo lo registrado está declarado como implementado", () => {
    for (const nombre of proveedoresVozRegistrados()) {
      expect(PROVEEDORES_VOZ_IMPLEMENTADOS).toContain(nombre);
    }
  });

  it("todo lo declarado como implementado está registrado de verdad", () => {
    const registrados = proveedoresVozRegistrados();
    for (const nombre of PROVEEDORES_VOZ_IMPLEMENTADOS) {
      expect(registrados).toContain(nombre);
    }
  });

  it("cada proveedor implementado tiene modelos sugeridos para el formulario", () => {
    for (const nombre of PROVEEDORES_VOZ_IMPLEMENTADOS) {
      expect(MODELOS_POR_PROVEEDOR_VOZ[nombre]?.length).toBeGreaterThan(0);
    }
  });
});
