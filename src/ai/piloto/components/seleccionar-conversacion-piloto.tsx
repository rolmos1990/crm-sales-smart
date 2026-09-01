"use client";

// 014-conversaciones-piloto-ejemplos-relevantes (Historia 1) — marcar una
// conversación real existente como ejemplo piloto (positivo o negativo).
// No se integra dentro del hilo de conversación de InboxLayout (componente
// central y complejo del Inbox) — selector propio sobre conversaciones
// recientes, para no arriesgar el comportamiento existente del Inbox.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { obtenerConversacionesRecientesAction, crearConversacionPiloto } from "@/ai/piloto/actions";

const SIN_SELECCION = "__NINGUNA__";

const CLASIFICACIONES = { POSITIVO: "Buena atención (positivo)", NEGATIVO: "Mala atención (negativo)" } as const;

interface SeleccionarConversacionPilotoProps {
  onCreada?: () => void;
}

export function SeleccionarConversacionPiloto({ onCreada }: SeleccionarConversacionPilotoProps) {
  const [conversaciones, setConversaciones] = useState<Awaited<ReturnType<typeof obtenerConversacionesRecientesAction>>>([]);
  const [conversacionId, setConversacionId] = useState(SIN_SELECCION);
  const [clasificacion, setClasificacion] = useState<"POSITIVO" | "NEGATIVO">("POSITIVO");
  const [explicacion, setExplicacion] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    obtenerConversacionesRecientesAction().then(setConversaciones);
  }, []);

  function handleCrear() {
    if (conversacionId === SIN_SELECCION || !explicacion.trim()) return;
    startTransition(async () => {
      const resultado = await crearConversacionPiloto({
        conversacionOrigenId: conversacionId,
        clasificacion,
        explicacion: explicacion.trim(),
      });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Conversación marcada como piloto");
      setConversacionId(SIN_SELECCION);
      setExplicacion("");
      onCreada?.();
    });
  }

  const opcionesConversaciones = Object.fromEntries(
    conversaciones.map((c) => [
      c.id,
      `${c.contacto ? `${c.contacto.nombre} ${c.contacto.apellido}` : "Sin contacto"}${c.asunto ? ` — ${c.asunto}` : ""}`,
    ]),
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/3 p-4">
      <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">Marcar conversación como piloto</p>

      <Select
        items={opcionesConversaciones}
        value={conversacionId}
        onValueChange={(v) => setConversacionId(v ?? SIN_SELECCION)}
      >
        <SelectTrigger><SelectValue placeholder="Elegí una conversación reciente..." /></SelectTrigger>
        <SelectContent>
          {conversaciones.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.contacto ? `${c.contacto.nombre} ${c.contacto.apellido}` : "Sin contacto"}
              {c.asunto ? ` — ${c.asunto}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={CLASIFICACIONES}
        value={clasificacion}
        onValueChange={(v) => v && setClasificacion(v as "POSITIVO" | "NEGATIVO")}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(CLASIFICACIONES) as Array<keyof typeof CLASIFICACIONES>).map((c) => (
            <SelectItem key={c} value={c}>{CLASIFICACIONES[c]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        value={explicacion}
        onChange={(e) => setExplicacion(e.target.value)}
        placeholder="¿Por qué representa buena o mala atención?"
        rows={3}
        className="bg-white/5 border-white/10 text-stone-50"
      />

      <Button
        type="button"
        onClick={handleCrear}
        disabled={isPending || conversacionId === SIN_SELECCION || !explicacion.trim()}
        className="self-end bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marcar como piloto"}
      </Button>
    </div>
  );
}
