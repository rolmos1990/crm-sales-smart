import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/shared/db/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/crm";

  // Los invite links usan PKCE → redireccionan con ?code=
  // Los magic links usan OTP  → redireccionan con ?token_hash=&type=
  if (!code && !tokenHash) {
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

  let userId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/login?error=sesion_invalida`);
    }
    userId = data.user.id;
  } else if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (type ?? "magiclink") as "email" | "recovery" | "invite" | "email_change" | "magiclink",
    });
    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/login?error=sesion_invalida`);
    }
    userId = data.user.id;
  }

  if (!userId) {
    return NextResponse.redirect(`${origin}/login?error=sesion_invalida`);
  }

  // Activar usuario en Prisma si está en estado INVITADO
  const resultado = await prisma.usuario.updateMany({
    where: { authUserId: userId, estado: "INVITADO" },
    data: { estado: "ACTIVO", ultimoLogin: new Date() },
  });

  const destino = resultado.count > 0 ? "/auth/configurar-cuenta" : next;
  return NextResponse.redirect(`${origin}${destino}`);
}
