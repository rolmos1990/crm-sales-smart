"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

export default function ConfigurarCuentaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [esOAuth, setEsOAuth] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    async function verificarSesion() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login?error=sesion_invalida");
        return;
      }
      const provider = data.user.app_metadata?.provider as string | undefined;
      setEsOAuth(!!provider && provider !== "email");
      setVerificando(false);
    }
    verificarSesion();
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setCargando(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setCargando(false);

    if (updateError) {
      setError("No se pudo guardar la contraseña. Intenta de nuevo.");
      return;
    }

    router.replace("/crm");
  }

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-neutral-950 to-black">
        <Loader2 className="h-6 w-6 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-neutral-950 to-black p-4">
      <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-lime-500/20">
            <ShieldCheck className="h-6 w-6 text-lime-400" />
          </div>
          <CardTitle className="text-stone-50 text-xl">Configura tu acceso</CardTitle>
          <CardDescription className="text-stone-400">
            {esOAuth
              ? "Puedes establecer una contraseña o saltar este paso y usar tu cuenta de Google."
              : "Crea una contraseña para ingresar al CRM cuando lo necesites."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-stone-300 text-sm">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required={!esOAuth}
                className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmar" className="text-stone-300 text-sm">
                Confirmar contraseña
              </Label>
              <Input
                id="confirmar"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repite la contraseña"
                required={!esOAuth}
                className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
              />
            </div>
            <Button
              type="submit"
              disabled={cargando}
              className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
            >
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar contraseña"}
            </Button>
            {esOAuth && (
              <button
                type="button"
                onClick={() => router.replace("/crm")}
                className="text-sm text-stone-500 hover:text-stone-300 transition-colors text-center"
              >
                Omitir — entrar sin contraseña
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
