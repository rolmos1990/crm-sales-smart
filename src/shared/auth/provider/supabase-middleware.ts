import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { AuthUsuario } from "@/shared/auth/provider/types";

// Refresca la sesión (renueva el access token si expiró) y la persiste en cookies.
// Implementación específica de Supabase para src/middleware.ts; expone la misma
// firma que tendría cualquier otro proveedor.
export async function refrescarSesionSupabase(
  request: NextRequest,
): Promise<{ response: NextResponse; usuario: AuthUsuario | null }> {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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
