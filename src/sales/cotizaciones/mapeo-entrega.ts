import type { CrearCotizacionInput } from "./schema";

// Traduce la EntregaCotizacion guardada a los valores por defecto del
// formulario de edición.
//
// Vivía inline en la página de editar y mapeaba solo 5 de los 15 campos: el
// destino (019) y el snapshot de transportista/zona/tarifa (022) se habían
// agregado al esquema y al formulario, pero nunca acá. Al abrir una
// cotización, esos campos aparecían vacíos aunque estuvieran guardados — y
// como actualizarCotizacion escribe lo que venga del formulario, guardar los
// borraba. Extraído para poder cubrirlo con tests: es un mapeo puro.

/** Campos de EntregaCotizacion que el formulario necesita. */
export interface EntregaGuardada {
  metodoEntrega: string;
  estadoEntrega: string;
  transportistaId: string | null;
  nombreDestinatario: string | null;
  fechaEstimada: Date | string | null;
  observaciones: string | null;
  paisId: string | null;
  estadoProvinciaId: string | null;
  ciudad: string | null;
  corregimiento: string | null;
  sectorOCodigoPostal: string | null;
  zonaEntregaId: string | null;
  zonaAsignadaManualmente: boolean;
  servicioTransportistaId: string | null;
  tarifaTransportistaZonaId: string | null;
  costoEnvioConfirmado: boolean;
}

export function entregaGuardadaAFormulario(
  entrega: EntregaGuardada | null | undefined,
  /** Vive en Cotizacion.costoEnvio, no en EntregaCotizacion — ver schema.ts. */
  costoEnvio: number,
): NonNullable<CrearCotizacionInput["entrega"]> {
  return {
    metodoEntrega: (entrega?.metodoEntrega ?? "COURIER_EXTERNO") as NonNullable<
      CrearCotizacionInput["entrega"]
    >["metodoEntrega"],
    estadoEntrega: (entrega?.estadoEntrega ?? "PENDIENTE") as NonNullable<
      CrearCotizacionInput["entrega"]
    >["estadoEntrega"],
    transportistaId: entrega?.transportistaId ?? null,
    nombreDestinatario: entrega?.nombreDestinatario ?? "",
    fechaEstimada: entrega?.fechaEstimada ? new Date(entrega.fechaEstimada) : undefined,
    observaciones: entrega?.observaciones ?? "",
    costoEnvio,
    // 019-cobertura-geografica-envios — destino.
    paisId: entrega?.paisId ?? null,
    estadoProvinciaId: entrega?.estadoProvinciaId ?? null,
    ciudad: entrega?.ciudad ?? "",
    // 022-transportistas-zonas-tarifas — snapshot de envío.
    corregimiento: entrega?.corregimiento ?? "",
    sectorOCodigoPostal: entrega?.sectorOCodigoPostal ?? "",
    zonaEntregaId: entrega?.zonaEntregaId ?? null,
    zonaAsignadaManualmente: entrega?.zonaAsignadaManualmente ?? false,
    servicioTransportistaId: entrega?.servicioTransportistaId ?? null,
    tarifaTransportistaZonaId: entrega?.tarifaTransportistaZonaId ?? null,
    costoEnvioConfirmado: entrega?.costoEnvioConfirmado ?? true,
  };
}
