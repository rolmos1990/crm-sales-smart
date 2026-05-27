export interface Plantilla {
  id: string;
  nombre: string;
  alias: string;
  descripcion: string | null;
  tipo: string;
  contenidoTexto: string | null;
  imagenUrl: string | null;
  activo: boolean;
  instanciaId: string;
  creadoPorId: string | null;
  actualizadoPorId: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export type ResultadoAccion<T = undefined> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
