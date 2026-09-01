import type { EstadoPedido } from "@/generated/prisma/enums";

export type { EstadoPedido };

export interface PedidoLinea {
  id: string;
  descripcion: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  productoId: string | null;
  producto: { id: string; nombre: string } | null;
}

export interface Pedido {
  id: string;
  numero: string;
  estado: EstadoPedido;
  fechaPedido: Date;
  fechaEntrega: Date | null;
  fechaExpiracion: Date | null;
  subtotal: number;
  descuento: number;
  impuesto: number;
  costoEnvio: number;
  total: number;
  moneda: string;
  notas: string | null;
  // Datos del comprador (pedido manual)
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  ruc: string | null;
  empresaNombre: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
  contactoId: string | null;
  contacto: { id: string; nombre: string; apellido: string } | null;
  empresaId: string | null;
  empresa: { id: string; nombre: string } | null;
  cotizacionId: string | null;
  entrega?: { metodoEntrega: string } | null;
  generadoPorIA: boolean;
  confirmadoPorHumano: boolean;
  lineas?: PedidoLinea[];
}

export const ESTADO_PEDIDO_CONFIG: Record<EstadoPedido, { etiqueta: string; color: string }> = {
  PENDIENTE: { etiqueta: "Pendiente", color: "bg-yellow-100 text-yellow-700" },
  CONFIRMADO: { etiqueta: "Confirmado", color: "bg-blue-100 text-blue-700" },
  EN_PROCESO: { etiqueta: "En proceso", color: "bg-violet-100 text-violet-700" },
  ENVIADO: { etiqueta: "Enviado", color: "bg-cyan-100 text-cyan-700" },
  ENTREGADO: { etiqueta: "Entregado", color: "bg-green-100 text-green-700" },
  CANCELADO: { etiqueta: "Cancelado", color: "bg-red-100 text-red-700" },
};

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
