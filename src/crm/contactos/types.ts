import type { EstadoContacto } from "@/generated/prisma/enums";

export type { EstadoContacto };

export interface Contacto {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefonoPrincipal: string | null;
  telefonoSecundario: string | null;
  cargo: string | null;
  notas: string | null;
  estado: EstadoContacto;
  creadoEn: Date;
  actualizadoEn: Date;
  empresaId: string | null;
  empresa: { id: string; nombre: string } | null;
  usuarioId: string | null;
}

export interface ContactoConRelaciones extends Contacto {
  _count?: {
    oportunidades: number;
    actividades: number;
  };
}

export type ResultadoAccion<T = void> =
  | { exito: true; datos: T }
  | { exito: false; error: string };
