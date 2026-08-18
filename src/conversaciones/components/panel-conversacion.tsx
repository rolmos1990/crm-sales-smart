"use client";

import { useState, useEffect, useTransition, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2, Plus, Phone } from "lucide-react";
import { toast } from "sonner";
import { ListaMensajes } from "./lista-mensajes";
import { InputMensaje } from "./input-mensaje";
import { SelectorCuentaCanal } from "./selector-cuenta-canal";
import { enviarMensaje, iniciarConversacion } from "../actions";
import type { ConversacionResumen, MensajeConMeta, CuentaCanalResumen } from "../types";

const PAGE_SIZE = Math.min(
  parseInt(process.env.NEXT_PUBLIC_MENSAJES_POR_PAGINA ?? "") || 50,
  200
);

interface PanelConversacionProps {
  oportunidadId: string;
  contactoId: string;
  nombreContacto: string;
  telefonoContacto?: string | null;
  cuentas: CuentaCanalResumen[];
  conversacionesIniciales: ConversacionResumen[];
  puedeMod?: boolean;
}

async function fetchMensajesRecientes(conversacionId: string): Promise<MensajeConMeta[]> {
  const res = await fetch(`/api/conversaciones/${conversacionId}/mensajes?recientes=${PAGE_SIZE}`);
  if (!res.ok) throw new Error("Error al cargar mensajes");
  return res.json();
}

async function fetchMensajesAnteriores(
  conversacionId: string,
  antesDeId: string
): Promise<MensajeConMeta[]> {
  const res = await fetch(
    `/api/conversaciones/${conversacionId}/mensajes?antes=${antesDeId}&limite=${PAGE_SIZE}`
  );
  if (!res.ok) throw new Error("Error al cargar mensajes anteriores");
  return res.json();
}

export function PanelConversacion({
  oportunidadId,
  contactoId,
  nombreContacto,
  telefonoContacto,
  cuentas,
  conversacionesIniciales,
  puedeMod = true,
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

  // Mensajes anteriores (paginación hacia atrás)
  const [anteriores, setAnteriores] = useState<MensajeConMeta[]>([]);
  const [hayMasAnteriores, setHayMasAnteriores] = useState(false);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const initialHayMasCheckedRef = useRef(false);

  // Mensajes recientes de la conversación activa via React Query
  const { data: recientes = [], isFetching } = useQuery<MensajeConMeta[]>({
    queryKey: ["mensajes", conversacionActiva],
    queryFn: () => fetchMensajesRecientes(conversacionActiva!),
    enabled: !!conversacionActiva,
    staleTime: 5000,
  });

  // Determinar si hay mensajes anteriores tras la carga inicial
  useEffect(() => {
    if (!isFetching && !initialHayMasCheckedRef.current && recientes.length > 0) {
      setHayMasAnteriores(recientes.length >= PAGE_SIZE);
      initialHayMasCheckedRef.current = true;
    }
  }, [isFetching, recientes.length]);

  // Resetear paginación al cambiar de conversación
  useEffect(() => {
    setAnteriores([]);
    setHayMasAnteriores(false);
    initialHayMasCheckedRef.current = false;
  }, [conversacionActiva]);

  // Lista combinada y deduplicada (anteriores primero, recientes al final)
  const mensajes = useMemo<MensajeConMeta[]>(() => {
    const seen = new Set<string>();
    const combined: MensajeConMeta[] = [];
    for (const m of [...anteriores, ...recientes]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        combined.push(m);
      }
    }
    return combined;
  }, [anteriores, recientes]);

  // Cargar página anterior
  const cargarAnteriores = async () => {
    if (cargandoAnteriores || !conversacionActiva) return;
    const oldest = anteriores[0] ?? recientes[0];
    if (!oldest) return;

    setCargandoAnteriores(true);
    try {
      const nuevos = await fetchMensajesAnteriores(conversacionActiva, oldest.id);
      if (nuevos.length > 0) {
        setAnteriores((prev) => [...nuevos, ...prev]);
      }
      setHayMasAnteriores(nuevos.length >= PAGE_SIZE);
    } catch {
      toast.error("Error al cargar mensajes anteriores");
    } finally {
      setCargandoAnteriores(false);
    }
  };

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
        oportunidadId,
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
        clasificacion: "NINGUNA",
        creadoEn: new Date(),
        actualizadoEn: new Date(),
        contacto: {
          id: contactoId,
          nombre: nombreContacto.split(" ")[0] ?? "",
          apellido: nombreContacto.split(" ").slice(1).join(" "),
          avatarUrl: null,
          telefonoPrincipal: telefonoContacto ?? null,
          email: null,
        },
        cuentaCanal: cuentaSeleccionada,
        oportunidades: [],
        _count: { mensajes: 0 },
        ultimoMensaje: null,
      };
      setConversaciones((prev) => [nueva, ...prev]);
      setConversacionActiva(result.conversacionId);
    });
  };

  const handleEnviar = async ({ contenido, esNotaInterna, mediaUrl }: { contenido: string; esNotaInterna: boolean; mediaUrl?: string }) => {
    if (!conversacionActiva) {
      toast.error("Sin conversación activa");
      return;
    }
    startEnviando(async () => {
      const result = await enviarMensaje({
        conversacionId: conversacionActiva,
        contenido,
        tipo: mediaUrl ? "IMAGEN" : "TEXTO",
        esNotaInterna,
        mediaUrl,
      });
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["mensajes", conversacionActiva] });
      } else {
        toast.error("Error al enviar mensaje");
      }
    });
  };

  const sinConversacion = !conversacionActiva;
  const conversacionActivaObj = conversaciones.find((c) => c.id === conversacionActiva) ?? null;

  return (
    <div className="flex flex-col h-full bg-stone-50/60 dark:bg-white/[0.02] border-r border-stone-200 dark:border-white/[0.07] min-w-0">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-stone-200 dark:border-white/[0.07] shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-lime-500/10 dark:bg-lime-400/10">
          <MessageSquare className="h-4 w-4 text-lime-600 dark:text-lime-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{nombreContacto}</p>
          {conversacionActivaObj?.cuentaCanal && (
            <p className="text-[10px] text-stone-400 dark:text-stone-500 truncate">
              {conversacionActivaObj.cuentaCanal.nombre}
              {conversacionActivaObj.cuentaCanal.canal === "instagram" && (conversacionActivaObj.handleCanal || conversacionActivaObj.identificadorCanal) && (
                <span className="font-mono">
                  {" · "}
                  {conversacionActivaObj.handleCanal ? `@${conversacionActivaObj.handleCanal}` : `ID: ${conversacionActivaObj.identificadorCanal}`}
                </span>
              )}
            </p>
          )}
        </div>
        {isFetching && <Loader2 className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500 animate-spin shrink-0" />}
      </div>

      {/* Selector de conversaciones si hay varias */}
      {conversaciones.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-stone-200 dark:border-white/10 overflow-x-auto shrink-0">
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
                  ? "bg-lime-500/10 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400 border border-lime-500/25 dark:border-lime-400/25"
                  : "bg-stone-100 dark:bg-white/5 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              }`}
            >
              {conv.cuentaCanal?.nombre ?? "Sin canal"}
            </button>
          ))}
        </div>
      )}

      {/* Estado vacío: iniciar conversación */}
      {sinConversacion && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-lime-500/10 dark:bg-lime-400/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-lime-600 dark:text-lime-400" />
            </div>
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Sin conversaciones</p>
            {telefonoContacto && (
              <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
                <Phone className="h-3 w-3" />
                {telefonoContacto}
              </div>
            )}
            <p className="text-xs text-stone-400 dark:text-stone-600 max-w-[200px]">
              Elige el canal desde el que quieres escribirle
            </p>
          </div>

          {puedeMod && <div className="w-full space-y-3">
            {cuentas.length > 0 && (
              <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/3 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">Canal (opcional)</p>
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
              <p className="text-[10px] text-stone-400 dark:text-stone-600 text-center">
                Sin canales. Ve a Integraciones para conectar WhatsApp u otro canal.
              </p>
            )}
          </div>}
        </div>
      )}

      {/* Lista de mensajes con paginación */}
      {!sinConversacion && (
        <ListaMensajes
          mensajes={mensajes}
          hayMasAnteriores={hayMasAnteriores}
          cargandoAnteriores={cargandoAnteriores}
          onCargarAnteriores={cargarAnteriores}
        />
      )}

      {/* Input de mensaje */}
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
