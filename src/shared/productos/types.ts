export interface Producto {
  id: string;
  sku: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  categoria: string | null;
  unidad: string | null;
  imagenUrl: string | null;
  activo: boolean;
  manejaStock: boolean;
  cantidadDisponible: number;
  creadoEn: Date;
  actualizadoEn: Date;
}

/** Versión reducida para selectores en cotizaciones/pedidos */
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
}

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
