import { crearSupabaseServerClient } from "@/shared/auth/provider/supabase-server";
import { MENSAJE_LOGIN_INVALIDO } from "@/shared/auth/schema";
import type { AuthProvider, AuthUsuario, ResultadoAuthLogin } from "@/shared/auth/provider/types";

export const supabaseAuthProvider: AuthProvider = {
  async obtenerUsuarioActual(): Promise<AuthUsuario | null> {
    const supabase = await crearSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  },

  async iniciarSesionConPassword(email, password): Promise<ResultadoAuthLogin> {
    const supabase = await crearSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return { usuario: null, error: MENSAJE_LOGIN_INVALIDO };
    }

    return { usuario: { id: data.user.id, email: data.user.email ?? null }, error: null };
  },

  async cerrarSesion(): Promise<void> {
    const supabase = await crearSupabaseServerClient();
    await supabase.auth.signOut();
  },
};
