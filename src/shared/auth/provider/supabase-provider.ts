import { crearSupabaseServerClient } from "@/shared/auth/provider/supabase-server";
import { crearSupabaseAdminClient } from "@/shared/auth/provider/supabase-admin";
import { MENSAJE_LOGIN_INVALIDO, MENSAJE_REGISTRO_INVALIDO } from "@/shared/auth/schema";
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

  async registrarUsuario(email, password): Promise<ResultadoAuthLogin> {
    const supabase = crearSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      return { usuario: null, error: MENSAJE_REGISTRO_INVALIDO };
    }

    return { usuario: { id: data.user.id, email: data.user.email ?? null }, error: null };
  },

  async eliminarUsuarioAuth(authUserId): Promise<void> {
    const supabase = crearSupabaseAdminClient();
    await supabase.auth.admin.deleteUser(authUserId);
  },

  async cerrarSesion(): Promise<void> {
    const supabase = await crearSupabaseServerClient();
    await supabase.auth.signOut();
  },
};
