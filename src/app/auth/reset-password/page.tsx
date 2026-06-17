"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

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
      setError("No se pudo actualizar la contraseña. El link puede haber expirado.");
      return;
    }

    router.push("/crm");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-neutral-950 to-black p-4">
      <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-lime-500/20">
            <KeyRound className="h-6 w-6 text-lime-400" />
          </div>
          <CardTitle className="text-stone-50 text-xl">Nueva contraseña</CardTitle>
          <CardDescription className="text-stone-400">
            Ingresa tu nueva contraseña para continuar
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
                Nueva contraseña
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
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
                required
                className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
              />
            </div>
            <Button
              type="submit"
              disabled={cargando}
              className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
            >
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Actualizar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
