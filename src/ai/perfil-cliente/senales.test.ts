import { describe, expect, it } from "vitest";
import { generarSenalesObjetivas } from "./senales";
import type { DatosObjetivos } from "./tipos";

const BASE: DatosObjetivos = {
  numeroPedidosCompletados: 0,
  fechaPrimeraInteraccion: new Date().toISOString(),
  fechaUltimaCompra: null,
  productosComprados: [],
  oportunidadesAbiertas: [],
  cotizacionesActivas: [],
  incidenciasActivas: 0,
  metodoEntregaHabitual: null,
};

// Lista negra de adjetivos subjetivos que el pedido original prohíbe
// explícitamente (FR-003/SC-003 de la spec) — verificación mecánica de que
// ninguna plantilla los produce, en vez de revisión manual de output de IA.
const ADJETIVOS_PROHIBIDOS = ["difícil", "tacaño", "mal cliente", "problemático", "molesto"];

describe("generarSenalesObjetivas (012, FR-003/SC-003)", () => {
  it("contacto sin historial produce una señal neutra, sin inventar datos", () => {
    const senales = generarSenalesObjetivas(BASE);
    expect(senales).toContain("No posee pedidos completados.");
  });

  it("refleja pedidos completados con fecha de la última compra", () => {
    const senales = generarSenalesObjetivas({
      ...BASE,
      numeroPedidosCompletados: 3,
      fechaUltimaCompra: "2026-05-01T00:00:00.000Z",
    });
    expect(senales.some((s) => s.includes("3 pedidos") && s.includes("mayo"))).toBe(true);
  });

  it("refleja oportunidades, cotizaciones e incidencias cuando existen", () => {
    const senales = generarSenalesObjetivas({
      ...BASE,
      oportunidadesAbiertas: [{ id: "o1", titulo: "x", etapa: "y" }],
      cotizacionesActivas: [{ id: "c1", numero: "00001", estado: "ENVIADA" }],
      incidenciasActivas: 2,
    });
    expect(senales.some((s) => s.includes("1 oportunidad abierta"))).toBe(true);
    expect(senales.some((s) => s.includes("1 cotización activa"))).toBe(true);
    expect(senales.some((s) => s.includes("2 conversaciones clasificadas"))).toBe(true);
  });

  it("nunca produce ningún adjetivo subjetivo o despectivo, sin importar la combinación de datos", () => {
    const senales = generarSenalesObjetivas({
      ...BASE,
      numeroPedidosCompletados: 0,
      incidenciasActivas: 5,
      cotizacionesActivas: [
        { id: "c1", numero: "1", estado: "ENVIADA" },
        { id: "c2", numero: "2", estado: "BORRADOR" },
      ],
    });
    const textoCompleto = senales.join(" ").toLowerCase();
    for (const adjetivo of ADJETIVOS_PROHIBIDOS) {
      expect(textoCompleto).not.toContain(adjetivo);
    }
  });
});
