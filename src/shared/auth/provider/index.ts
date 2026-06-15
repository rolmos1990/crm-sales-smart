import { supabaseAuthProvider } from "@/shared/auth/provider/supabase-provider";
import { refrescarSesionSupabase } from "@/shared/auth/provider/supabase-middleware";
import type { AuthProvider } from "@/shared/auth/provider/types";

export type { AuthProvider, AuthUsuario, ResultadoAuthLogin } from "@/shared/auth/provider/types";

// Único punto a cambiar para migrar de proveedor de autenticación.
export function obtenerAuthProvider(): AuthProvider {
  return supabaseAuthProvider;
}

// Refresco de sesión para middleware (edge-compatible).
export const refrescarSesion = refrescarSesionSupabase;
