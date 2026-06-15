// Contrato de autenticación. Toda la app depende de esta interfaz, nunca de un
// proveedor concreto — cambiar de proveedor solo implica una nueva implementación
// de AuthProvider + actualizar la fábrica en provider/index.ts.

export type AuthUsuario = {
  id: string;
  email: string | null;
};

export type ResultadoAuthLogin =
  | { usuario: AuthUsuario; error: null }
  | { usuario: null; error: string };

export interface AuthProvider {
  obtenerUsuarioActual(): Promise<AuthUsuario | null>;
  iniciarSesionConPassword(email: string, password: string): Promise<ResultadoAuthLogin>;
  cerrarSesion(): Promise<void>;
}
