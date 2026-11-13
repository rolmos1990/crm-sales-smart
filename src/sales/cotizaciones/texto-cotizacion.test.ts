import { describe, expect, it } from "vitest";
import { construirTextoCotizacion, simboloMoneda, type CotizacionTexto } from "./texto-cotizacion";

const BASE: CotizacionTexto = {
  numero: "00001",
  moneda: "PAB",
  fechaEmision: new Date(2026, 10, 13),
  fechaVencimiento: null,
  subtotal: 16,
  impuesto: 1.12,
  costoEnvio: 7.5,
  total: 24.62,
  notas: null,
  destinatario: { nombre: "Ramón", apellido: "Olmos", telefono: "+507 6123-4567" },
  lineas: [
    { descripcion: null, productoNombre: "Esfera Escalera Luna", cantidad: 1, precioUnitario: 16, descuento: 0, subtotal: 16 },
  ],
  entrega: {
    transportistaNombre: "UnoExpress",
    servicioNombre: "Estándar",
    ciudad: "Volcán",
    estadoProvinciaNombre: "Chiriquí Province",
    costoEnvioConfirmado: true,
  },
};

describe("simboloMoneda", () => {
  it("usa el símbolo real de cada moneda", () => {
    expect(simboloMoneda("PAB")).toBe("B/.");
    expect(simboloMoneda("USD")).toBe("$");
    expect(simboloMoneda("PEN")).toBe("S/");
  });

  it("una moneda desconocida cae al código, nunca a otra divisa", () => {
    expect(simboloMoneda("BRL")).toBe("BRL");
  });
});

describe("construirTextoCotizacion", () => {
  it("un negocio en Panamá no ve soles peruanos", () => {
    const texto = construirTextoCotizacion(BASE);

    expect(texto).toContain("B/. 16.00");
    expect(texto).not.toContain("S/");
  });

  it("incluye el envío para que las cuentas cierren", () => {
    const texto = construirTextoCotizacion(BASE);

    expect(texto).toContain("Envío:     B/. 7.50");
    // 16.00 + 1.12 + 7.50 = 24.62
    expect(texto).toContain("TOTAL:     B/. 24.62");
  });

  it("sin costo de envío no agrega la línea", () => {
    const texto = construirTextoCotizacion({ ...BASE, costoEnvio: 0, entrega: null, total: 17.12 });
    expect(texto).not.toContain("Envío:");
  });

  it("costo por confirmar se dice, no se omite ni se inventa un número", () => {
    const texto = construirTextoCotizacion({
      ...BASE,
      costoEnvio: 0,
      entrega: { ...BASE.entrega!, costoEnvioConfirmado: false },
    });

    expect(texto).toContain("Envío:     por confirmar");
  });

  it("muestra destino y transportista", () => {
    const texto = construirTextoCotizacion(BASE);

    expect(texto).toContain("ENTREGA:");
    expect(texto).toContain("Destino: Volcán, Chiriquí Province");
    expect(texto).toContain("Transportista: UnoExpress (Estándar)");
  });

  it("sin entrega resuelta no inventa un bloque vacío", () => {
    const texto = construirTextoCotizacion({ ...BASE, entrega: null });
    expect(texto).not.toContain("ENTREGA:");
  });

  it("prefiere el nombre del producto sobre la descripción libre", () => {
    const texto = construirTextoCotizacion({
      ...BASE,
      lineas: [{ descripcion: "texto libre", productoNombre: "Producto real", cantidad: 2, precioUnitario: 5, descuento: 10, subtotal: 9 }],
    });

    expect(texto).toContain("2x Producto real — B/. 5.00 (10% dto.)");
    expect(texto).not.toContain("texto libre");
  });

  it("una línea sin producto ni descripción no rompe el texto", () => {
    const texto = construirTextoCotizacion({
      ...BASE,
      lineas: [{ descripcion: null, productoNombre: null, cantidad: 1, precioUnitario: 1, descuento: 0, subtotal: 1 }],
    });

    expect(texto).toContain("1x — ");
  });

  it("formatea cantidades fraccionarias sin romper las enteras", () => {
    const frac = construirTextoCotizacion({
      ...BASE,
      lineas: [{ ...BASE.lineas[0], cantidad: 1.5 }],
    });

    expect(frac).toContain("1.50x");
    expect(construirTextoCotizacion(BASE)).toContain("1x");
  });

  it("omite los datos del destinatario que no existen", () => {
    const texto = construirTextoCotizacion({ ...BASE, destinatario: { nombre: "Ramón" } });

    expect(texto).toContain("Para: Ramón");
    expect(texto).not.toContain("Tel:");
    expect(texto).not.toContain("Email:");
  });

  it("incluye vencimiento y notas solo si existen", () => {
    const sin = construirTextoCotizacion(BASE);
    expect(sin).not.toContain("Vence:");
    expect(sin).not.toContain("Notas:");

    const con = construirTextoCotizacion({
      ...BASE,
      fechaVencimiento: new Date(2026, 10, 20),
      notas: "Retira en tienda",
    });
    expect(con).toContain("Vence: 20/11/2026");
    expect(con).toContain("Notas: Retira en tienda");
  });

  it("empieza por el número de cotización — es lo que identifica el mensaje", () => {
    expect(construirTextoCotizacion(BASE).split("\n")[0]).toBe("📋 COTIZACIÓN 00001");
  });
});
