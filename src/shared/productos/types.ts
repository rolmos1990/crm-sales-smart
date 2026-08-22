/** Determina qué bloque de cumplimiento usa una Cotización/Pedido que
 *  incluya este producto — ver ServicioCotizacion/Pedido y
 *  EntregaDigitalCotizacion/Pedido. Sin reglas de obligatoriedad acá; eso
 *  lo resuelve después el Flujo de Venta. */
export type TipoProducto = "FISICO" | "SERVICIO" | "DIGITAL";

export const TIPO_PRODUCTO_LABELS: Record<TipoProducto, string> = {
  FISICO: "Físico",
  SERVICIO: "Servicio",
  DIGITAL: "Digital",
};

export interface Producto {
  id: string;
  sku: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  categoria: string | null;
  tipo: TipoProducto;
  unidad: string | null;
  imagenUrl: string | null;
  activo: boolean;
  manejaStock: boolean;
  cantidadDisponible: number;
  creadoEn: Date;
  actualizadoEn: Date;
}

/** Versión reducida para selectores en cotizaciones/pedidos — incluye
 *  `tipo` porque de ahí se deriva el tipoCumplimiento de la
 *  Cotización/Pedido (ver resolverTipoCumplimiento en cada actions.ts). */
export interface ProductoCatalogo {
  id: string;
  sku: string | null;
  nombre: string;
  precio: number;
  moneda: string;
  unidad: string | null;
  imagenUrl: string | null;
  manejaStock: boolean;
  cantidadDisponible: number;
  tipo: TipoProducto;
}

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
