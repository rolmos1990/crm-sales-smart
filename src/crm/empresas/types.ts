export interface Empresa {
  id: string;
  nombre: string;
  ruc: string | null;
  industria: string | null;
  tamano: string | null;
  sitioWeb: string | null;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  usuarioId: string | null;
}

export interface EmpresaConRelaciones extends Empresa {
  _count?: {
    contactos: number;
    oportunidades: number;
    actividades: number;
  };
}

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
