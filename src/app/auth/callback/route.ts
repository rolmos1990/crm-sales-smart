import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/shared/db/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/crm";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=codigo_invalido`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=sesion_invalida`);
  }

  // Activar usuario en Prisma si está en estado INVITADO
  await prisma.usuario.updateMany({
    where: { authUserId: data.user.id, estado: "INVITADO" },
    data: { estado: "ACTIVO", ultimoLogin: new Date() },
  });

  return NextResponse.redirect(`${origin}${next}`);
}
