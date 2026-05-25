export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  moneda: string;
  categoria: string | null;
  unidad: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
