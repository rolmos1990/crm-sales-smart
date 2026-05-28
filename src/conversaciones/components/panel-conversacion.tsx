"use client";

import { useState, useEffect, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2, Plus, Phone } from "lucide-react";
import { toast } from "sonner";
import { ListaMensajes } from "./lista-mensajes";
import { InputMensaje } from "./input-mensaje";
import { HistorialCompleto } from "./historial-completo";
import { SelectorCuentaCanal } from "./selector-cuenta-canal";
import { enviarMensaje, iniciarConversacion } from "../actions";
import type { ConversacionResumen, MensajeConMeta, CuentaCanalResumen } from "../types";

interface PanelConversacionProps {
  oportunidadId: string;
  contactoId: string;
  nombreContacto: string;
  telefonoContacto?: string | null;
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
  contactoId,
  nombreContacto,
  telefonoContacto,
  cuentas,
  conversacionesIniciales,
}: PanelConversacionProps) {
  const queryClient = useQueryClient();
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>(conversacionesIniciales);
  const [conversacionActiva, setConversacionActiva] = useState<string | null>(
    conversacionesIniciales[0]?.id ?? null
  );
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState<string | null>(
    conversacionesIniciales[0]?.cuentaCanalId ?? cuentas[0]?.id ?? null
  );
  const [iniciando, startIniciando] = useTransition();
  const [enviando, startEnviando] = useTransition();

  // Mensajes de la conversación activa via React Query
  const { data: mensajes = [], isFetching } = useQuery<MensajeConMeta[]>({
    queryKey: ["mensajes", conversacionActiva],
    queryFn: () => fetchMensajes(conversacionActiva!),
    enabled: !!conversacionActiva,
    staleTime: 0,
  });

  // SSE: escucha mensajes nuevos usando instanciaId de la conversación activa
  const instanciaIdActivo = conversaciones.find((c) => c.id === conversacionActiva)?.instanciaId ?? null;
  useEffect(() => {
    if (!instanciaIdActivo) return;
    const source = new EventSource(`/api/sse/conversaciones?instanciaId=${instanciaIdActivo}`);
    source.addEventListener("MENSAJE_RECIBIDO", () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes", conversacionActiva] });
    });
    source.addEventListener("MENSAJE_ENVIADO", () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes", conversacionActiva] });
    });
    return () => source.close();
  }, [instanciaIdActivo, conversacionActiva, queryClient]);

  const handleIniciarConversacion = () => {
    startIniciando(async () => {
      const result = await iniciarConversacion({
        contactoId,
        cuentaCanalId: cuentaSeleccionadaId ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const cuentaSeleccionada = cuentas.find((c) => c.id === cuentaSeleccionadaId) ?? null;
      const nueva: ConversacionResumen = {
        id: result.conversacionId,
        instanciaId: cuentaSeleccionada?.instanciaId ?? null,
        contactoId,
        cuentaCanalId: cuentaSeleccionadaId ?? null,
        asunto: null,
        estado: "ABIERTA",
        creadoEn: new Date(),
        actualizadoEn: new Date(),
        contacto: { id: contactoId, nombre: nombreContacto.split(" ")[0] ?? "", apellido: nombreContacto.split(" ").slice(1).join(" "), telefonoPrincipal: telefonoContacto ?? null, email: null },
        cuentaCanal: cuentaSeleccionada,
        oportunidades: [],
        _count: { mensajes: 0 },
        ultimoMensaje: null,
      };
      setConversaciones((prev) => [nueva, ...prev]);
      setConversacionActiva(result.conversacionId);
    });
  };

  const handleEnviar = async ({ contenido, esNotaInterna }: { contenido: string; esNotaInterna: boolean }) => {
    if (!conversacionActiva) {
      toast.error("Sin conversación activa");
      return;
    }
    startEnviando(async () => {
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

  const sinConversacion = !conversacionActiva;

  return (
    <div className="flex flex-col h-full bg-stone-950/80 backdrop-blur-xl border-r border-white/10 min-w-0">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-lime-500/15">
          <MessageSquare className="h-4 w-4 text-lime-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-100 truncate">{nombreContacto}</p>
          {conversacionActiva && conversaciones.find(c => c.id === conversacionActiva)?.cuentaCanal && (
            <p className="text-[10px] text-stone-500 truncate">
              {conversaciones.find(c => c.id === conversacionActiva)?.cuentaCanal?.nombre}
            </p>
          )}
        </div>
        {isFetching && <Loader2 className="h-3.5 w-3.5 text-stone-500 animate-spin shrink-0" />}
      </div>

      {/* Selector de conversaciones si hay varias */}
      {conversaciones.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-white/10 overflow-x-auto shrink-0">
          {conversaciones.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => {
                setConversacionActiva(conv.id);
                setCuentaSeleccionadaId(conv.cuentaCanalId ?? null);
              }}
              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                conversacionActiva === conv.id
                  ? "bg-lime-500/20 text-lime-300 border border-lime-500/30"
                  : "bg-white/5 text-stone-400 hover:text-stone-200"
              }`}
            >
              {conv.cuentaCanal?.nombre ?? "Sin canal"}
            </button>
          ))}
        </div>
      )}

      {/* ── Estado vacío: iniciar conversación ── */}
      {sinConversacion && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-lime-500/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-lime-400" />
            </div>
            <p className="text-sm font-semibold text-stone-300">Sin conversaciones</p>
            {telefonoContacto && (
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Phone className="h-3 w-3" />
                {telefonoContacto}
              </div>
            )}
            <p className="text-xs text-stone-600 max-w-[200px]">
              Elige el canal desde el que quieres escribirle
            </p>
          </div>

          <div className="w-full space-y-3">
            {cuentas.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Canal (opcional)</p>
                <SelectorCuentaCanal
                  cuentas={cuentas}
                  seleccionada={cuentaSeleccionadaId}
                  onSeleccionar={setCuentaSeleccionadaId}
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleIniciarConversacion}
              disabled={iniciando}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-lime-500/90 text-stone-950 text-sm font-semibold hover:bg-lime-400 transition-all shadow-lg hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {iniciando ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Iniciando…</>
              ) : (
                <><Plus className="h-4 w-4" /> Iniciar conversación</>
              )}
            </button>

            {cuentas.length === 0 && (
              <p className="text-[10px] text-stone-600 text-center">
                Sin canales. Ve a Integraciones para conectar WhatsApp u otro canal.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lista de mensajes */}
      {!sinConversacion && <ListaMensajes mensajes={mensajes} />}

      {/* Historial completo */}
      {!sinConversacion && (
        <div className="px-2 py-1 border-t border-white/5 shrink-0">
          <HistorialCompleto contactoId={contactoId} nombreContacto={nombreContacto} />
        </div>
      )}

      {/* Input de mensaje — solo cuando hay conversación activa */}
      {!sinConversacion && (
        <InputMensaje
          conversacionId={conversacionActiva ?? ""}
          cuentas={cuentas}
          cuentaSeleccionadaId={cuentaSeleccionadaId}
          onCambiarCuenta={setCuentaSeleccionadaId}
          onEnviar={handleEnviar}
          enviando={enviando}
        />
      )}
    </div>
  );
}
