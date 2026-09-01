"use client";

// 014-conversaciones-piloto-ejemplos-relevantes (Historia 1) — gestión de
// conversaciones piloto: anonimizar, incluir/excluir del perfil.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  obtenerConversacionesPilotoAction,
  anonimizarConversacionPiloto,
  incluirEnPerfil,
  excluirDePerfil,
} from "@/ai/piloto/actions";
import { SeleccionarConversacionPiloto } from "./seleccionar-conversacion-piloto";

type Piloto = Awaited<ReturnType<typeof obtenerConversacionesPilotoAction>>[number];

export function ListaConversacionesPiloto() {
  const [pilotos, setPilotos] = useState<Piloto[] | null>(null);
  const [isPending, startTransition] = useTransition();

  async function recargar() {
    setPilotos(await obtenerConversacionesPilotoAction());
  }

  useEffect(() => {
    recargar();
  }, []);

  function handleAnonimizar(id: string) {
    startTransition(async () => {
      const resultado = await anonimizarConversacionPiloto(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Conversación anonimizada");
      recargar();
    });
  }

  function handleIncluir(id: string) {
    startTransition(async () => {
      const resultado = await incluirEnPerfil(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Incluida en el perfil de aprendizaje");
      recargar();
    });
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const resultado = await excluirDePerfil(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Excluida del perfil de aprendizaje");
      recargar();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SeleccionarConversacionPiloto onCreada={recargar} />

      {pilotos === null ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        </div>
      ) : pilotos.length === 0 ? (
        <p className="text-stone-500 text-sm">Sin conversaciones piloto todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pilotos.map((p) => (
            <li key={p.id} className="rounded-xl border border-white/8 bg-white/3 p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-stone-200 text-sm">
                    {p.conversacionOrigen.contacto ? `${p.conversacionOrigen.contacto.nombre} ${p.conversacionOrigen.contacto.apellido}` : "Sin contacto"}
                  </p>
                  <p className="text-stone-500 text-xs">{p.explicacion}</p>
                </div>
                <Badge variant={p.clasificacion === "POSITIVO" ? "default" : "destructive"}>
                  {p.clasificacion === "POSITIVO" ? "Positivo" : "Negativo"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!p.anonimizadaEn ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => handleAnonimizar(p.id)} disabled={isPending}>
                    <ShieldCheck className="h-3.5 w-3.5" />Anonimizar
                  </Button>
                ) : p.incluidaEnPerfil ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => handleExcluir(p.id)} disabled={isPending}>
                    <ShieldOff className="h-3.5 w-3.5" />Excluir del perfil
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => handleIncluir(p.id)} disabled={isPending}>
                    <Sparkles className="h-3.5 w-3.5" />Incluir en el perfil
                  </Button>
                )}
                {p.anonimizadaEn && <span className="text-xs text-stone-500">Anonimizada</span>}
                {p.incluidaEnPerfil && <span className="text-xs text-lime-400">Incluida en el perfil</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
