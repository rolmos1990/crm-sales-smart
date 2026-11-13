import { describe, expect, it } from "vitest";
import { cotizacionADefaultValues, entregaGuardadaAFormulario, type EntregaGuardada } from "./mapeo-entrega";

// La cotización del caso real: Chiriquí / Volcán con UnoExpress, servicio
// Estándar, zona y tarifa resueltas. Todo eso estaba guardado y el
// formulario de edición lo mostraba vacío.
const GUARDADA: EntregaGuardada = {
  metodoEntrega: "COURIER_EXTERNO",
  estadoEntrega: "PENDIENTE",
  transportistaId: "transp-uno",
  nombreDestinatario: "Doña Marta (vecina)",
  fechaEstimada: null,
  observaciones: "Dejar en portería",
  paisId: "pais-pa",
  estadoProvinciaId: "ep-chiriqui",
  ciudad: "Volcán",
  corregimiento: "Cuesta de Piedra",
  sectorOCodigoPostal: "0426",
  zonaEntregaId: "zona-chiriqui",
  zonaAsignadaManualmente: false,
  servicioTransportistaId: "serv-estandar",
  tarifaTransportistaZonaId: "tarifa-1",
  costoEnvioConfirmado: true,
};

describe("entregaGuardadaAFormulario", () => {
  it("no pierde ningún campo del destino ni del snapshot de envío", () => {
    const r = entregaGuardadaAFormulario(GUARDADA, 7.5);

    expect(r).toMatchObject({
      transportistaId: "transp-uno",
      nombreDestinatario: "Doña Marta (vecina)",
      paisId: "pais-pa",
      estadoProvinciaId: "ep-chiriqui",
      ciudad: "Volcán",
      corregimiento: "Cuesta de Piedra",
      sectorOCodigoPostal: "0426",
      zonaEntregaId: "zona-chiriqui",
      servicioTransportistaId: "serv-estandar",
      tarifaTransportistaZonaId: "tarifa-1",
      costoEnvioConfirmado: true,
      costoEnvio: 7.5,
    });
  });

  it("cubre todas las claves que el formulario envía de vuelta — lo que falte se borra al guardar", () => {
    const r = entregaGuardadaAFormulario(GUARDADA, 7.5);

    // Toda clave de EntregaGuardada tiene que viajar al formulario, salvo las
    // dos que cambian de nombre o de origen.
    for (const clave of Object.keys(GUARDADA)) {
      if (clave === "fechaEstimada") continue; // null → undefined, se chequea aparte
      expect(r, `falta "${clave}" en los valores del formulario`).toHaveProperty(clave);
    }
    expect(r).toHaveProperty("costoEnvio");
  });

  it("el costo de envío viene de la cotización, no de la entrega", () => {
    expect(entregaGuardadaAFormulario(GUARDADA, 12.25).costoEnvio).toBe(12.25);
  });

  it("convierte la fecha estimada a Date, y null a undefined", () => {
    expect(entregaGuardadaAFormulario({ ...GUARDADA, fechaEstimada: "2026-11-20T00:00:00.000Z" }, 0).fechaEstimada)
      .toBeInstanceOf(Date);
    expect(entregaGuardadaAFormulario(GUARDADA, 0).fechaEstimada).toBeUndefined();
  });

  it("cotización sin entrega: valores iniciales sanos, no vacíos rotos", () => {
    const r = entregaGuardadaAFormulario(null, 0);

    expect(r.metodoEntrega).toBe("COURIER_EXTERNO");
    expect(r.estadoEntrega).toBe("PENDIENTE");
    expect(r.transportistaId).toBeNull();
    expect(r.nombreDestinatario).toBe("");
    expect(r.estadoProvinciaId).toBeNull();
    // Por defecto confirmado: una cotización sin entrega no debe bloquear la
    // conversión a pedido (ver aprobarCotizacion, FR-040).
    expect(r.costoEnvioConfirmado).toBe(true);
  });

  it("conserva el costo por confirmar para que aprobar siga bloqueado", () => {
    const r = entregaGuardadaAFormulario({ ...GUARDADA, costoEnvioConfirmado: false }, 0);
    expect(r.costoEnvioConfirmado).toBe(false);
  });

  it("conserva la zona asignada a mano", () => {
    const r = entregaGuardadaAFormulario({ ...GUARDADA, zonaAsignadaManualmente: true }, 7.5);
    expect(r.zonaAsignadaManualmente).toBe(true);
  });
});

// Este mapeo tiene DOS consumidores: la página /sales/cotizaciones/[id]/editar
// y obtenerDatosEdicionCotizacionAction (el Sheet y el panel del Workspace).
// Estuvo duplicado y costó caro: se agregó `nombreDestinatario` a la página y
// a la copia no, así que abrir una cotización desde el panel cargaba el campo
// vacío y guardar lo borraba. El test exige que ninguno de los dos vuelva a
// armar el objeto por su cuenta.
describe("un solo mapeo para los dos caminos de edición", () => {
  const FUENTES = [
    "src/app/sales/cotizaciones/[id]/editar/page.tsx",
    "src/sales/cotizaciones/actions.ts",
  ] as const;

  it.each(FUENTES)("%s usa cotizacionADefaultValues", async (ruta) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fuente = readFileSync(join(process.cwd(), ruta), "utf8");

    expect(fuente).toContain("cotizacionADefaultValues(");
    // Si alguien vuelve a armar los valores a mano, estas claves reaparecen
    // sueltas en el archivo y el mapeo se puede separar otra vez.
    expect(fuente).not.toContain("metodoEntrega: entregaGuardada?.metodoEntrega");
    expect(fuente).not.toContain("oportunidadId: cotizacion.oportunidadId");
  });
});

// El vínculo con la oportunidad se perdía al editar: FormCotizacion no lo
// expone como campo, solo reenvía lo que recibe, y actualizarCotizacion
// escribe lo que le llega. Faltaba en el mapeo del Sheet/panel, así que editar
// una cotización nacida en el Pipeline le cortaba la oportunidad — y después
// el disparador "Cerrar oportunidad relacionada" no tenía a quién cerrar.
describe("cotizacionADefaultValues", () => {
  const COTIZACION = {
    moneda: "USD",
    subtotal: 100,
    impuesto: 7,
    costoEnvio: 5,
    notas: "Entregar por la mañana",
    contactoId: "cont-1",
    empresaId: "emp-1",
    oportunidadId: "op-1",
    fechaVencimiento: null,
    metadata: { destinatario: { nombre: "Ana", apellido: "Ruiz" } },
    lineas: [{ productoId: "p1", cantidad: 2, precioUnitario: 50, descuento: 0, descripcion: null }],
    entrega: GUARDADA,
  };

  it("conserva el vínculo con la oportunidad", () => {
    expect(cotizacionADefaultValues(COTIZACION).oportunidadId).toBe("op-1");
  });

  it("una cotización sin oportunidad queda sin vínculo, no en undefined", () => {
    expect(cotizacionADefaultValues({ ...COTIZACION, oportunidadId: null }).oportunidadId).toBe("");
  });

  it("recalcula el % de impuesto desde el monto guardado", () => {
    // 7 sobre 100 = 7%
    expect(cotizacionADefaultValues(COTIZACION).impuesto).toBe(7);
  });

  it("sin subtotal no divide por cero", () => {
    expect(cotizacionADefaultValues({ ...COTIZACION, subtotal: 0 }).impuesto).toBe(0);
  });

  it("trae el destinatario de metadata y la entrega completa", () => {
    const r = cotizacionADefaultValues(COTIZACION);
    expect(r.destinatario).toMatchObject({ nombre: "Ana", apellido: "Ruiz" });
    expect(r.entrega).toMatchObject({ nombreDestinatario: "Doña Marta (vecina)", costoEnvio: 5 });
  });

  it("una cotización sin líneas arranca con una vacía, no con cero", () => {
    expect(cotizacionADefaultValues({ ...COTIZACION, lineas: [] }).lineas).toHaveLength(1);
  });
});
