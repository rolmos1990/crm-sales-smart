import { z } from "zod";
import { MetodoEntregaEnum, EstadoEntregaEnum } from "@/sales/pedidos/schema";

export { MetodoEntregaEnum, EstadoEntregaEnum };

// Sin `codigo` real a propósito — el cliente solo puede pedir "conservar" o
// "reemplazar" (ver src/shared/lib/codigo-sensible.ts), nunca manda ni
// recibe el valor existente.
export const EntregaDigitalCotizacionSchema = z.object({
  metodo: z.enum(["EMAIL", "LINK", "DESCARGA", "ACCESO", "LICENCIA", "MANUAL", "OTRO"]).optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  url: z.string().max(500).optional().or(z.literal("")),
  archivo: z.string().max(500).optional().or(z.literal("")),
  usuarioAcceso: z.string().max(200).optional().or(z.literal("")),
  fechaEntrega: z.date().optional().nullable(),
  fechaExpiracion: z.date().optional().nullable(),
  instrucciones: z.string().max(500).optional().or(z.literal("")),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  codigoAccion: z.enum(["CONSERVAR", "REEMPLAZAR"]).optional(),
  codigoNuevo: z.string().max(200).optional().or(z.literal("")),
});

// `entregaDigital` es por LÍNEA, no por cotización completa — una
// cotización puede tener varios productos DIGITAL distintos, cada uno con
// su propia entrega (ver EntregaDigitalCotizacion en schema.prisma). Solo
// tiene sentido cuando la línea usa un producto tipo DIGITAL; el servidor
// decide si se persiste (ver actions.ts).
export const LineaCotizacionSchema = z.object({
  productoId: z.string().optional().or(z.literal("")),
  descripcion: z.string().max(500).optional().or(z.literal("")),
  cantidad: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0, "El precio debe ser mayor o igual a 0"),
  descuento: z.number().min(0).max(100),
  entregaDigital: EntregaDigitalCotizacionSchema.optional(),
});

export const DestinatarioCotizacionSchema = z.object({
  nombre: z.string().max(200).optional().or(z.literal("")),
  apellido: z.string().max(200).optional().or(z.literal("")),
  telefono: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

// Sin numeroGuia/urlSeguimiento: a esta altura (cotización) todavía no
// existen — se completan recién en el Pedido al aprobar (ver aprobarCotizacion).
export const EntregaCotizacionSchema = z.object({
  metodoEntrega: MetodoEntregaEnum.optional(),
  estadoEntrega: EstadoEntregaEnum.optional(),
  transportistaId: z.string().nullable().optional(),
  fechaEstimada: z.date().optional().nullable(),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  // Se suma al total de la cotización (lo que paga el cliente) pero vive en
  // Cotizacion.costoEnvio, no en EntregaCotizacion — así los KPIs de
  // Pedidos pueden restarlo con un simple _sum, sin join (ver actions.ts).
  costoEnvio: z.number().min(0).optional(),
  // 019-cobertura-geografica-envios — paisId solo se pide si el negocio
  // opera en modo MULTIPAIS (FR-011/FR-012); ciudad es texto libre opcional.
  paisId: z.string().nullable().optional(),
  estadoProvinciaId: z.string().nullable().optional(),
  ciudad: z.string().max(150).optional().or(z.literal("")),
});

// Sin campos obligatorios a propósito — el Flujo de Venta resuelve después
// qué debe completarse para avanzar de etapa, esto solo guarda el dato.
export const ServicioCotizacionSchema = z.object({
  modalidad: z.enum(["EN_ESTABLECIMIENTO", "A_DOMICILIO", "REMOTO", "OTRO"]).optional(),
  fecha: z.date().optional().nullable(),
  hora: z.string().max(20).optional().or(z.literal("")),
  duracion: z.string().max(100).optional().or(z.literal("")),
  ubicacion: z.string().max(200).optional().or(z.literal("")),
  direccion: z.string().max(300).optional().or(z.literal("")),
  responsable: z.string().max(200).optional().or(z.literal("")),
  instrucciones: z.string().max(500).optional().or(z.literal("")),
  observaciones: z.string().max(500).optional().or(z.literal("")),
});

export const CrearCotizacionSchema = z.object({
  estado: z.enum(["BORRADOR", "REVISADA", "APROBADA", "ENVIADA", "RECHAZADA", "VENCIDA"]).optional(),
  fechaVencimiento: z.date().optional(),
  moneda: z.string().optional(),
  impuesto: z.number().min(0).max(100),
  notas: z.string().max(2000).optional().or(z.literal("")),
  // La cotización siempre se relaciona a un contacto (no a la oportunidad puntual):
  // así su historial se conserva aunque el contacto abra una nueva oportunidad.
  contactoId: z.string().min(1, "Selecciona un contacto"),
  empresaId: z.string().optional().or(z.literal("")),
  oportunidadId: z.string().optional().or(z.literal("")),
  destinatario: DestinatarioCotizacionSchema.optional(),
  // entrega/servicio: solo uno de los dos se persiste, según
  // tipoCumplimiento (derivado de las líneas, ver actions.ts) — sin
  // cambios. entregaDigital ya NO va acá: es por línea (ver
  // LineaCotizacionSchema.entregaDigital), porque una cotización puede
  // tener varios productos DIGITAL distintos.
  entrega: EntregaCotizacionSchema.optional(),
  servicio: ServicioCotizacionSchema.optional(),
  lineas: z.array(LineaCotizacionSchema).min(1, "Debe agregar al menos un producto"),
});

export const ActualizarCotizacionSchema = CrearCotizacionSchema.partial();

export type CrearCotizacionInput = z.infer<typeof CrearCotizacionSchema>;
export type ActualizarCotizacionInput = z.infer<typeof ActualizarCotizacionSchema>;
export type LineaCotizacionInput = z.infer<typeof LineaCotizacionSchema>;
export type DestinatarioCotizacionInput = z.infer<typeof DestinatarioCotizacionSchema>;
export type EntregaCotizacionInput = z.infer<typeof EntregaCotizacionSchema>;
export type ServicioCotizacionInput = z.infer<typeof ServicioCotizacionSchema>;
export type EntregaDigitalCotizacionInput = z.infer<typeof EntregaDigitalCotizacionSchema>;
