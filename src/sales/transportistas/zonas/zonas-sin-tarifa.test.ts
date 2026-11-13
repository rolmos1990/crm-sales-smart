import { describe, expect, it } from "vitest";
import { zonasSinTarifaDelTransportista } from "./zonas-sin-tarifa";

const zona = (id: string, nombre = id) => ({ id, nombre });
const tarifa = (zonaId: string) => ({ zonaEntrega: { id: zonaId } });

describe("zonasSinTarifaDelTransportista", () => {
  it("lista solo las que este transportista no cubre", () => {
    const r = zonasSinTarifaDelTransportista(
      [zona("a"), zona("b"), zona("c")],
      [tarifa("b")],
    );
    expect(r.map((z) => z.id)).toEqual(["a", "c"]);
  });

  it("si cubre todas, no hay aviso", () => {
    const r = zonasSinTarifaDelTransportista([zona("a"), zona("b")], [tarifa("a"), tarifa("b")]);
    expect(r).toEqual([]);
  });

  it("recién importado: las zonas con tarifa nueva salen del aviso", () => {
    const zonas = [zona("a"), zona("b")];
    // Antes de importar no hay ninguna tarifa: las dos aparecen.
    expect(zonasSinTarifaDelTransportista(zonas, [])).toHaveLength(2);
    // Después de importar, ninguna.
    expect(zonasSinTarifaDelTransportista(zonas, [tarifa("a"), tarifa("b")])).toEqual([]);
  });

  it("varias tarifas sobre la misma zona (distintos servicios) la sacan una sola vez", () => {
    const r = zonasSinTarifaDelTransportista([zona("a"), zona("b")], [tarifa("a"), tarifa("a")]);
    expect(r.map((z) => z.id)).toEqual(["b"]);
  });

  it("una tarifa de otra zona no saca a la que no cubre", () => {
    const r = zonasSinTarifaDelTransportista([zona("a")], [tarifa("z")]);
    expect(r.map((z) => z.id)).toEqual(["a"]);
  });

  it("sin zonas no hay nada que avisar", () => {
    expect(zonasSinTarifaDelTransportista([], [tarifa("a")])).toEqual([]);
  });

  it("conserva el objeto de la zona, no solo el id — el aviso muestra el nombre", () => {
    const r = zonasSinTarifaDelTransportista([zona("a", "Coclé")], []);
    expect(r[0]).toMatchObject({ id: "a", nombre: "Coclé" });
  });
});
