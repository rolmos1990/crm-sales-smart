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
  direccionEntrega: string | null;
  identificacion: string | null;
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
    // Lo que falte aca no solo no se muestra: se borra al guardar.
    direccionEntrega: entrega?.direccionEntrega ?? "",
    identificacion: entrega?.identificacion ?? "",
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

// ── Valores iniciales del formulario de edición ─────────────────────────────
//
// Lo arman DOS caminos: la página /sales/cotizaciones/[id]/editar y
// obtenerDatosEdicionCotizacionAction (el Sheet y el panel del Workspace).
// Estuvieron duplicados carácter por carácter y costó dos bugs del mismo tipo,
// porque el formulario reenvía lo que recibe y actualizarCotizacion escribe lo
// que le llega: lo que falte acá no se muestra Y SE BORRA al guardar.
//
//   - `nombreDestinatario` faltaba en la copia del action.
//   - `oportunidadId` también: editar una cotización nacida en el Pipeline le
//     cortaba el vínculo con su oportunidad, y después el disparador de
//     "Cerrar oportunidad relacionada" no tenía a quién cerrar.
//
// Por eso ahora hay una sola función: agregar un campo al formulario y
// olvidarse de un camino vuelve a ser imposible.

/** Lo que estos valores necesitan de la cotización ya cargada. */
export interface CotizacionParaEdicion {
  moneda: string;
  subtotal: unknown;
  impuesto: unknown;
  costoEnvio?: unknown;
  notas: string | null;
  contactoId: string | null;
  empresaId: string | null;
  oportunidadId: string | null;
  fechaVencimiento: Date | string | null;
  metadata: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lineas: any[];
  entrega: EntregaGuardada | null;
}

const LINEA_VACIA = { descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 };

export function cotizacionADefaultValues(
  cotizacion: CotizacionParaEdicion,
): Partial<CrearCotizacionInput> {
  // El % de IGV no se guarda como tal —solo el monto ya calculado—, así que se
  // recalcula desde subtotal/impuesto para no perder el valor original: sin
  // esto el form caería al 0% de una cotización nueva y cambiaría el impuesto
  // sin que el usuario lo haya tocado.
  const subtotal = Number(cotizacion.subtotal);
  const impuestoPorcentaje =
    subtotal > 0 ? Math.round((Number(cotizacion.impuesto) / subtotal) * 1000) / 10 : 0;

  const metadata = cotizacion.metadata as Record<string, unknown> | null;
  const destinatario = metadata?.destinatario as Record<string, string> | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineas = (cotizacion.lineas ?? []).map((l: any) => ({
    productoId: l.productoId ?? "",
    varianteId: l.varianteId ?? "",
    descripcion: l.descripcion ?? "",
    cantidad: Number(l.cantidad),
    precioUnitario: Number(l.precioUnitario),
    descuento: Number(l.descuento),
    // Por línea, no por documento — ver EntregaDigitalCotizacion. Sin
    // `codigo` real: solo si ya hay uno configurado (tieneCodigoConfigurado,
    // via ocultarCodigo en queries.ts), nunca el valor.
    entregaDigital: l.entregaDigital
      ? {
          metodo: l.entregaDigital.metodo ?? undefined,
          email: l.entregaDigital.email ?? "",
          url: l.entregaDigital.url ?? "",
          archivo: l.entregaDigital.archivo ?? "",
          usuarioAcceso: l.entregaDigital.usuarioAcceso ?? "",
          fechaEntrega: l.entregaDigital.fechaEntrega ? new Date(l.entregaDigital.fechaEntrega) : undefined,
          fechaExpiracion: l.entregaDigital.fechaExpiracion ? new Date(l.entregaDigital.fechaExpiracion) : undefined,
          instrucciones: l.entregaDigital.instrucciones ?? "",
          observaciones: l.entregaDigital.observaciones ?? "",
          codigoAccion: l.entregaDigital.tieneCodigoConfigurado ? ("CONSERVAR" as const) : undefined,
          codigoNuevo: "",
        }
      : undefined,
  }));

  return {
    moneda: cotizacion.moneda,
    impuesto: impuestoPorcentaje,
    notas: cotizacion.notas ?? "",
    contactoId: cotizacion.contactoId ?? "",
    empresaId: cotizacion.empresaId ?? "",
    // FormCotizacion no expone esto como campo editable, solo lo reenvía: si
    // no viene, el guardado corta el vínculo con la oportunidad.
    oportunidadId: cotizacion.oportunidadId ?? "",
    fechaVencimiento: cotizacion.fechaVencimiento ? new Date(cotizacion.fechaVencimiento) : undefined,
    lineas: lineas.length > 0 ? lineas : [LINEA_VACIA],
    destinatario: {
      nombre: destinatario?.nombre ?? "",
      apellido: destinatario?.apellido ?? "",
      telefono: destinatario?.telefono ?? "",
      email: destinatario?.email ?? "",
    },
    entrega: entregaGuardadaAFormulario(cotizacion.entrega, Number(cotizacion.costoEnvio ?? 0)),
  };
}
