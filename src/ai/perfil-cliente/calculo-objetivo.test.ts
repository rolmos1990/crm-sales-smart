import { describe, expect, it } from "vitest";
import { clasificarTipoRelacion } from "./calculo-objetivo";

// calcularDatosObjetivos no se testea acá (toca Prisma/DB real) — el
// proyecto separa Vitest (funciones puras) de Playwright (todo lo que toca
// DB), ver specs/009-.../tasks.md. clasificarTipoRelacion sí es pura.

describe("clasificarTipoRelacion (012, research.md Decisión 2)", () => {
  it("incidencia activa pesa más que cualquier otro dato (CLIENTE_CON_INCIDENCIA)", () => {
    expect(
      clasificarTipoRelacion({
        pedidosCompletados: 10,
        tieneInteraccionPrevia: true,
        fechaUltimaCompra: new Date().toISOString(),
        tieneIncidenciaActiva: true,
      }),
    ).toBe("CLIENTE_CON_INCIDENCIA");
  });

  it("sin pedidos y sin interacción previa → NUEVO_CONTACTO", () => {
    expect(
      clasificarTipoRelacion({
        pedidosCompletados: 0,
        tieneInteraccionPrevia: false,
        fechaUltimaCompra: null,
        tieneIncidenciaActiva: false,
      }),
    ).toBe("NUEVO_CONTACTO");
  });

  it("sin pedidos pero con interacción previa → PROSPECTO_RECURRENTE", () => {
    expect(
      clasificarTipoRelacion({
        pedidosCompletados: 0,
        tieneInteraccionPrevia: true,
        fechaUltimaCompra: null,
        tieneIncidenciaActiva: false,
      }),
    ).toBe("PROSPECTO_RECURRENTE");
  });

  it("1 pedido reciente → CLIENTE_NUEVO", () => {
    expect(
      clasificarTipoRelacion({
        pedidosCompletados: 1,
        tieneInteraccionPrevia: true,
        fechaUltimaCompra: new Date().toISOString(),
        tieneIncidenciaActiva: false,
      }),
    ).toBe("CLIENTE_NUEVO");
  });

  it("2+ pedidos recientes → CLIENTE_REGULAR", () => {
    expect(
      clasificarTipoRelacion({
        pedidosCompletados: 4,
        tieneInteraccionPrevia: true,
        fechaUltimaCompra: new Date().toISOString(),
        tieneIncidenciaActiva: false,
      }),
    ).toBe("CLIENTE_REGULAR");
  });

  it("pedidos previos pero última compra hace más de 90 días → CLIENTE_INACTIVO", () => {
    const hace100Dias = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      clasificarTipoRelacion({
        pedidosCompletados: 3,
        tieneInteraccionPrevia: true,
        fechaUltimaCompra: hace100Dias,
        tieneIncidenciaActiva: false,
      }),
    ).toBe("CLIENTE_INACTIVO");
  });
});
