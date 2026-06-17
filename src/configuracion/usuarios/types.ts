import type { Rol, EstadoUsuario, TipoUsuario } from "@/generated/prisma/enums";

export type UsuarioInstanciaDetalle = {
  id: string;
  usuarioId: string;
  nombre: string;
  email: string;
  tipo: TipoUsuario;
  rol: Rol;
  cargo: string | null;
  telefono: string | null;
  estado: EstadoUsuario;
  activo: boolean;
  ultimoLogin: Date | null;
};

export type ResultadoAccion<T = undefined> =
  | { exito: true; datos: T }
  | { exito: false; error: string };

export type ResultadoCrearUsuario = {
  inviteLink?: string;
};
