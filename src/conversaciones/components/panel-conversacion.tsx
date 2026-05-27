"use client";

import { useState, useEffect, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ListaMensajes } from "./lista-mensajes";
import { InputMensaje } from "./input-mensaje";
import { HistorialCompleto } from "./historial-completo";
import { enviarMensaje } from "../actions";
import type { ConversacionResumen, MensajeConMeta, CuentaCanalResumen } from "../types";

interface PanelConversacionProps {
  oportunidadId: string;
  instanciaId: string;
  contactoId: string;
  nombreContacto: string;
  cuentas: CuentaCanalResumen[];
  conversacionesIniciales: ConversacionResumen[];
}

async function fetchMensajes(conversacionId: string): Promise<MensajeConMeta[]> {
  const res = await fetch(`/api/conversaciones/${conversacionId}/mensajes`);
  if (!res.ok) throw new Error("Error al cargar mensajes");
  return res.json();
}

export function PanelConversacion({
  oportunidadId,
  instanciaId,
  contactoId,
  nombreContacto,
  cuentas,
  conversacionesIniciales,
}: PanelConversacionProps) {
  const queryClient = useQueryClient();
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(
    conversacionesIniciales[0]?.id ?? null
  );
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState<string | null>(
    conversacionesIniciales[0]?.cuentaCanalId ?? cuentas[0]?.id ?? null
  );
  const [isPending, startTransition] = useTransition();

  // Mensajes de la conversación activa via React Query
  const { data: mensajes = [], isFetching } = useQuery<MensajeConMeta[]>({
    queryKey: ["mensajes", conversacionActiva],
    queryFn: () => fetchMensajes(conversacionActiva!),
    enabled: !!conversacionActiva,
    initialData: undefined,
    staleTime: 0,
  });

  // SSE: escucha mensajes nuevos y revalida
  useEffect(() => {
    if (!instanciaId) return;
    const source = new EventSource(`/api/sse/conversaciones?instanciaId=${instanciaId}`);
    source.addEventListener("MENSAJE_RECIBIDO", () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes", conversacionActiva] });
    });
    source.addEventListener("MENSAJE_ENVIADO", () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes", conversacionActiva] });
    });
    return () => source.close();
  }, [instanciaId, conversacionActiva, queryClient]);

  const handleEnviar = async ({ contenido, esNotaInterna }: { contenido: string; esNotaInterna: boolean }) => {
    if (!conversacionActiva) {
      toast.error("Sin conversación activa");
      return;
    }
    startTransition(async () => {
      const result = await enviarMensaje({
        conversacionId: conversacionActiva,
        contenido,
        tipo: "TEXTO",
        esNotaInterna,
      });
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["mensajes", conversacionActiva] });
      } else {
        toast.error("Error al enviar mensaje");
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-stone-950/80 backdrop-blur-xl border-r border-white/10 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-lime-500/15">
          <MessageSquare className="h-4 w-4 text-lime-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-100 truncate">{nombreContacto}</p>
          {conversacionesIniciales[0]?.cuentaCanal && (
            <p className="text-[10px] text-stone-500 truncate">
              {conversacionesIniciales[0].cuentaCanal.nombre}
            </p>
          )}
        </div>
        {isFetching && <Loader2 className="h-3.5 w-3.5 text-stone-500 animate-spin shrink-0" />}
      </div>

      {/* Selector de conversaciones si hay varias */}
      {conversacionesIniciales.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-white/10 overflow-x-auto shrink-0">
          {conversacionesIniciales.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => {
                setConversacionActiva(conv.id);
                setCuentaSeleccionadaId(conv.cuentaCanalId);
              }}
              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                conversacionActiva === conv.id
                  ? "bg-lime-500/20 text-lime-300 border border-lime-500/30"
                  : "bg-white/5 text-stone-400 hover:text-stone-200"
              }`}
            >
              {conv.cuentaCanal.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Sin conversación */}
      {!conversacionActiva && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-stone-600 p-4">
          <MessageSquare className="h-8 w-8" />
          <p className="text-sm text-center">Sin conversaciones.<br />Los mensajes aparecerán aquí.</p>
        </div>
      )}

      {/* Lista de mensajes */}
      {conversacionActiva && <ListaMensajes mensajes={mensajes} />}

      {/* Historial completo */}
      <div className="px-2 py-1 border-t border-white/5 shrink-0">
        <HistorialCompleto contactoId={contactoId} nombreContacto={nombreContacto} />
      </div>

      {/* Input de mensaje */}
      <InputMensaje
        conversacionId={conversacionActiva ?? ""}
        cuentas={cuentas}
        cuentaSeleccionadaId={cuentaSeleccionadaId}
        onCambiarCuenta={setCuentaSeleccionadaId}
        onEnviar={handleEnviar}
        enviando={isPending}
      />
    </div>
  );
}
