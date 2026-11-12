export interface EtiquetaProducto {
  id: string;
  nombre: string;
  color: string | null;
  /** Cuántos productos la usan (activos o no). */
  totalProductos: number;
}
