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

/** Mismo enum que EntregaDigitalCotizacion/Pedido.metodo — ver
 *  MetodoEntregaDigital en schema.prisma. */
export type MetodoEntregaDigital = "EMAIL" | "LINK" | "DESCARGA" | "ACCESO" | "LICENCIA" | "MANUAL" | "OTRO";

/** Plantilla de entrega digital de un Producto — SIN el campo `codigo`
 *  real: solo `tieneCodigoConfigurado`, nunca el valor (ver
 *  src/shared/lib/codigo-sensible.ts). Se copia como snapshot editable a
 *  cada línea de Cotización/Pedido que use este producto — nunca es una
 *  referencia viva. */
export interface EntregaDigitalProductoInfo {
  metodo: MetodoEntregaDigital | null;
  url: string | null;
  archivo: string | null;
  usuarioAcceso: string | null;
  instrucciones: string | null;
  observaciones: string | null;
  requiereSeguimiento: boolean;
  tipoSeguimiento: string | null;
  tieneCodigoConfigurado: boolean;
}

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
  /** Solo relevante cuando tipo = DIGITAL. */
  entregaDigital: EntregaDigitalProductoInfo | null;
}

/** Versión reducida para selectores en cotizaciones/pedidos — incluye
 *  `tipo` porque de ahí se deriva el tipoCumplimiento de la
 *  Cotización/Pedido (ver resolverTipoCumplimiento en cada actions.ts), y
 *  `entregaDigital` porque de ahí se precargan los valores por defecto de
 *  la línea al elegir el producto (ver SelectorProductoLinea.onSeleccionar). */
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
  entregaDigital: EntregaDigitalProductoInfo | null;
}

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
