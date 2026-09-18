import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { AuthUsuario } from "@/shared/auth/provider/types";

// Refresca la sesión (renueva el access token si expiró) y la persiste en cookies.
// Implementación específica de Supabase para src/middleware.ts; expone la misma
// firma que tendría cualquier otro proveedor.
export async function refrescarSesionSupabase(
  request: NextRequest,
  // Headers a propagar hacia los Server Components / Server Actions / Route
  // Handlers. El middleware los usa para inyectar `x-time-zone`. Es opcional
  // para que cualquier otro llamador siga compilando sin cambios.
  headersEntrada: Headers = request.headers,
): Promise<{ response: NextResponse; usuario: AuthUsuario | null }> {
  let response = NextResponse.next({ request: { headers: headersEntrada } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: headersEntrada } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const usuario: AuthUsuario | null = data.user
    ? { id: data.user.id, email: data.user.email ?? null }
    : null;

  return { response, usuario };
}
