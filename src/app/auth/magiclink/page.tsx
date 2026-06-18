"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { activarSesionUsuario } from "./actions";

export default function MagicLinkPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function handleMagicLink() {
      // Flujo implícito: Supabase pone los tokens en el hash (#access_token=...)
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      // Fallback: algunos entornos redirigen con ?code= o ?token_hash=
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const tokenHash = urlParams.get("token_hash");
      const type = urlParams.get("type");

      let userId: string | null = null;

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error || !data.user) {
          router.replace("/login?error=sesion_invalida");
          return;
        }
        userId = data.user.id;
      } else if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.user) {
          router.replace("/login?error=sesion_invalida");
          return;
        }
        userId = data.user.id;
      } else if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type ?? "magiclink") as "email" | "recovery" | "invite" | "email_change" | "magiclink",
        });
        if (error || !data.user) {
          router.replace("/login?error=sesion_invalida");
          return;
        }
        userId = data.user.id;
      } else {
        router.replace("/login?error=codigo_invalido");
        return;
      }

      if (userId) {
        const { activado } = await activarSesionUsuario(userId);
        router.replace(activado ? "/auth/configurar-cuenta" : "/crm");
        return;
      }

      router.replace("/crm");
    }

    handleMagicLink();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime-500 border-t-transparent" />
        <p className="text-sm text-stone-400">Verificando sesión...</p>
      </div>
    </div>
  );
}
