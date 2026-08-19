import type { EstadoCotizacion } from "@/generated/prisma/enums";

export type { EstadoCotizacion };

export interface CotizacionLinea {
  id: string;
  descripcion: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  productoId: string | null;
  producto: { id: string; nombre: string } | null;
}

export interface Cotizacion {
  id: string;
  numero: string;
  estado: EstadoCotizacion;
  fechaEmision: Date;
  fechaVencimiento: Date | null;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  moneda: string;
  notas: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  contactoId: string | null;
  contacto: { id: string; nombre: string; apellido: string } | null;
  empresaId: string | null;
  empresa: { id: string; nombre: string } | null;
  lineas?: CotizacionLinea[];
  entrega?: {
    metodoEntrega: string;
    estadoEntrega: string;
    transportistaId: string | null;
    fechaEstimada: Date | null;
    observaciones: string | null;
  } | null;
}

export const ESTADO_COTIZACION_CONFIG: Record<EstadoCotizacion, { etiqueta: string; variante: "default" | "secondary" | "outline" | "destructive" }> = {
  BORRADOR: { etiqueta: "Borrador", variante: "secondary" },
  ENVIADA: { etiqueta: "Enviada", variante: "default" },
  APROBADA: { etiqueta: "Aprobada", variante: "default" },
  RECHAZADA: { etiqueta: "Rechazada", variante: "destructive" },
  VENCIDA: { etiqueta: "Vencida", variante: "outline" },
};

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
