import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// EntregaPedido declara el snapshot de envío de la 022 (FR-046/047) para
// recibirlo de EntregaCotizacion al convertir en pedido, pero la copia nunca
// lo incluyó: el pedido nacía con el destino a medias y sin la zona ni la
// tarifa con las que se cotizó, así que operaciones perdía el rastro de por
// qué se cobró ese monto de envío.
//
// Probarlo contra Prisma exigiría una base real (el servicio encadena
// stock, numeración y eventos), así que se verifica sobre el código: que
// cada campo del snapshot aparezca en el `create` de la entrega. Es un test
// de contrato, no de comportamiento — basta para que agregar una columna al
// snapshot y olvidarse de copiarla falle acá.

const FUENTE = readFileSync(
  join(process.cwd(), "src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts"),
  "utf8",
);

/** Campos que EntregaCotizacion y EntregaPedido comparten y deben viajar al pedido. */
const CAMPOS_SNAPSHOT = [
  // Básicos
  "metodoEntrega",
  "estadoEntrega",
  "transportistaId",
  "fechaEstimada",
  "observaciones",
  // 019-cobertura-geografica-envios — destino
  "paisId",
  "estadoProvinciaId",
  "ciudad",
  // 022-transportistas-zonas-tarifas — snapshot de envío
  "corregimiento",
  "sectorOCodigoPostal",
  "zonaEntregaId",
  "zonaAsignadaManualmente",
  "servicioTransportistaId",
  "tarifaTransportistaZonaId",
  "costoInternoEnvio",
  "costoEnvioConfirmado",
] as const;

describe("generarPedidoDesdeCotizacion — snapshot de envío", () => {
  const bloqueEntrega = FUENTE.slice(
    FUENTE.indexOf("entrega: cotizacion.entrega ?"),
    FUENTE.indexOf("servicio: cotizacion.servicio ?"),
  );

  it.each(CAMPOS_SNAPSHOT)("copia %s desde la cotización", (campo) => {
    expect(bloqueEntrega).toContain(`cotizacion.entrega.${campo}`);
  });

  it("no inventa número de guía ni seguimiento: no existen todavía al cotizar", () => {
    expect(bloqueEntrega).toContain("numeroGuia:      null");
    expect(bloqueEntrega).toContain("urlSeguimiento:  null");
  });

  it("el costo de envío viaja en la raíz del pedido, no en la entrega", () => {
    expect(FUENTE).toContain("costoEnvio:         cotizacion.costoEnvio");
  });
});
