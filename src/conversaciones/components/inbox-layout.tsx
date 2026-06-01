"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, ChevronUp, Loader2, XCircle, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BurbujaMensaje } from "./burbuja-mensaje";
import { InputMensaje } from "./input-mensaje";
import { PanelContactoInbox } from "./panel-contacto-inbox";
import { cerrarConversacion, enviarMensaje } from "../actions";
import type { ConversacionResumen, MensajeConMeta, CuentaCanalResumen } from "../types";

interface ContextMenuState {
  x: number;
  y: number;
  conversacionId: string;
}

async function fetchUltimosMensajes(conversacionId: string): Promise<MensajeConMeta[]> {
  const res = await fetch(`/api/conversaciones/${conversacionId}/mensajes?recientes=50`);
  if (!res.ok) throw new Error("Error al cargar mensajes");
  return res.json();
}

async function fetchMensajesAnteriores(conversacionId: string, antesDeId: string): Promise<MensajeConMeta[]> {
  const res = await fetch(`/api/conversaciones/${conversacionId}/mensajes?antes=${antesDeId}`);
  if (!res.ok) throw new Error("Error al cargar mensajes anteriores");
  return res.json();
}

function agruparPorFecha(mensajes: MensajeConMeta[]) {
  const grupos: { fecha: string; mensajes: MensajeConMeta[] }[] = [];
  for (const m of mensajes) {
    const fecha = format(new Date(m.creadoEn), "d MMM yyyy", { locale: es });
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.fecha === fecha) {
      ultimo.mensajes.push(m);
    } else {
      grupos.push({ fecha, mensajes: [m] });
    }
  }
  return grupos;
}

interface InboxLayoutProps {
  conversacionesIniciales: ConversacionResumen[];
  cuentas: CuentaCanalResumen[];
}

export function InboxLayout({ conversacionesIniciales, cuentas }: InboxLayoutProps) {
  const queryClient = useQueryClient();

  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [cerrando, startCerrando] = useTransition();
  const [enviando, startEnviando] = useTransition();
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState<string | null>(null);

  const [panelContactoAbierto, setPanelContactoAbierto] = useState(true);

  const [mensajesAnteriores, setMensajesAnteriores] = useState<MensajeConMeta[]>([]);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [hayMasAnteriores, setHayMasAnteriores] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  // Recent 50 messages for selected conversation
  const { data: mensajesRecientes = [], isFetching } = useQuery<MensajeConMeta[]>({
    queryKey: ["inbox-mensajes", seleccionada],
    queryFn: () => fetchUltimosMensajes(seleccionada!),
    enabled: !!seleccionada,
    staleTime: 0,
  });

  // Reset state when switching conversations
  useEffect(() => {
    setMensajesAnteriores([]);
    setHayMasAnteriores(false);
  }, [seleccionada]);

  // Update pagination flag after messages load
  useEffect(() => {
    if (mensajesRecientes.length > 0) {
      setHayMasAnteriores(mensajesRecientes.length >= 50);
    }
  }, [mensajesRecientes]);

  // Scroll to bottom when switching conversations or new messages arrive
  useEffect(() => {
    if (!isFetching && mensajesRecientes.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [seleccionada, isFetching]);

  // SSE real-time updates
  const convActiva = conversaciones.find((c) => c.id === seleccionada) ?? null;
  const instanciaId = convActiva?.instanciaId ?? null;
  useEffect(() => {
    if (!instanciaId) return;
    const source = new EventSource(`/api/sse/conversaciones?instanciaId=${instanciaId}`);
    source.addEventListener("MENSAJE_RECIBIDO", () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-mensajes", seleccionada] });
    });
    source.addEventListener("MENSAJE_ENVIADO", () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-mensajes", seleccionada] });
    });
    return () => source.close();
  }, [instanciaId, seleccionada, queryClient]);

  // Close context menu on outside interaction
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, conversacionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, conversacionId });
  };

  const handleCerrar = (conversacionId: string) => {
    startCerrando(async () => {
      const result = await cerrarConversacion(conversacionId);
      if (!result.ok) {
        toast.error(result.error ?? "Error al cerrar");
        return;
      }
      setConversaciones((prev) => prev.filter((c) => c.id !== conversacionId));
      if (seleccionada === conversacionId) setSeleccionada(null);
      toast.success("Conversación cerrada");
    });
  };

  const handleCargarAnteriores = async () => {
    if (!seleccionada || cargandoAnteriores) return;
    const masAntiguo = mensajesAnteriores[0] ?? mensajesRecientes[0];
    if (!masAntiguo) return;

    const scrollArea = messagesAreaRef.current;
    const scrollHeightAntes = scrollArea?.scrollHeight ?? 0;

    setCargandoAnteriores(true);
    try {
      const anteriores = await fetchMensajesAnteriores(seleccionada, masAntiguo.id);
      setMensajesAnteriores((prev) => [...anteriores, ...prev]);
      setHayMasAnteriores(anteriores.length >= 50);
      // Preserve scroll position after DOM grows upward
      requestAnimationFrame(() => {
        if (scrollArea) {
          scrollArea.scrollTop = scrollArea.scrollHeight - scrollHeightAntes;
        }
      });
    } finally {
      setCargandoAnteriores(false);
    }
  };

  const handleEnviar = async ({ contenido, esNotaInterna, mediaUrl }: { contenido: string; esNotaInterna: boolean; mediaUrl?: string }) => {
    if (!seleccionada) return;
    startEnviando(async () => {
      const result = await enviarMensaje({
        conversacionId: seleccionada,
        contenido,
        tipo: mediaUrl ? "IMAGEN" : "TEXTO",
        esNotaInterna,
        mediaUrl,
      });
      if (!result.ok) {
        toast.error("Error al enviar mensaje");
      }
    });
  };

  const handleContactoActualizado = (
    conversacionId: string,
    nuevoContacto: ConversacionResumen["contacto"]
  ) => {
    setConversaciones((prev) =>
      prev.map((c) =>
        c.id === conversacionId ? { ...c, contacto: nuevoContacto } : c
      )
    );
  };

  const todosLosMensajes = [...mensajesAnteriores, ...mensajesRecientes];
  const grupos = agruparPorFecha(todosLosMensajes);

  const convNombreBase = convActiva
    ? `${convActiva.contacto.nombre} ${convActiva.contacto.apellido}`.trim()
    : "";
  const convNombre = convNombreBase || convActiva?.contacto.telefonoPrincipal || "Sin nombre";
  const convSinIdentificar = convActiva ? !convNombreBase : false;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel: conversation list ── */}
      <aside className="w-64 lg:w-72 shrink-0 border-r border-white/10 flex flex-col bg-stone-950/70 backdrop-blur-xl">
        <div className="px-4 py-3.5 border-b border-white/8 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Conversaciones</p>
          <p className="text-[11px] text-stone-600 mt-0.5">
            {conversaciones.length} {conversaciones.length === 1 ? "activa" : "activas"}
          </p>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
          {conversaciones.length === 0 ? (
            <li className="flex flex-col items-center justify-center gap-2 h-40 text-center px-4">
              <MessageSquare className="h-5 w-5 text-stone-700" />
              <p className="text-xs text-stone-600">Sin conversaciones abiertas</p>
            </li>
          ) : (
            conversaciones.map((conv) => {
              const esActiva = seleccionada === conv.id;
              const nombreContacto = `${conv.contacto.nombre} ${conv.contacto.apellido}`.trim();
              const sinIdentificar = !nombreContacto;
              const nombre = nombreContacto || conv.contacto.telefonoPrincipal || "Sin nombre";
              const iniciales = nombreContacto
                ? `${conv.contacto.nombre[0] ?? ""}${conv.contacto.apellido[0] ?? ""}`.toUpperCase()
                : "?";

              return (
                <li key={conv.id} onContextMenu={(e) => handleContextMenu(e, conv.id)}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeleccionada(conv.id);
                      setCuentaSeleccionadaId(conv.cuentaCanalId ?? cuentas[0]?.id ?? null);
                    }}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors border-l-2",
                      esActiva
                        ? "bg-lime-500/8 border-l-lime-500 dark:border-l-lime-400"
                        : "border-l-transparent hover:bg-white/4"
                    )}
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0",
                      sinIdentificar
                        ? "bg-stone-800/60 border-stone-700 text-stone-500"
                        : "bg-gradient-to-br from-lime-500/30 to-emerald-500/20 border-lime-500/20 text-lime-300"
                    )}>
                      {iniciales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={cn("text-xs font-semibold truncate", esActiva ? "text-stone-50" : "text-stone-200")}>
                            {nombre}
                          </p>
                          {sinIdentificar && (
                            <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                              ?
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-stone-600 shrink-0 whitespace-nowrap">
                          {formatDistanceToNow(new Date(conv.actualizadoEn), { addSuffix: false, locale: es })}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate leading-snug">
                        {conv.ultimoMensaje?.contenido
                          ? conv.ultimoMensaje.contenido.slice(0, 55)
                          : <span className="italic text-stone-600">Sin mensajes</span>}
                      </p>
                      {conv.cuentaCanal && (
                        <p className="text-[9px] text-stone-600 mt-0.5">{conv.cuentaCanal.nombre}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {/* ── Right panel: chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-stone-950/40">
        {seleccionada === null ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-stone-900/80 border border-white/8 flex items-center justify-center shadow-inner">
              <MessageSquare className="h-7 w-7 text-stone-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-400">Ninguna conversación seleccionada</p>
              <p className="text-xs text-stone-600 mt-1.5 max-w-52">
                Selecciona una conversación de la lista para ver los mensajes
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center gap-3 bg-stone-950/50 backdrop-blur-sm">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-lime-500/30 to-emerald-500/20 border border-lime-500/20 flex items-center justify-center text-xs font-semibold text-lime-300 shrink-0">
                {convActiva
                  ? `${convActiva.contacto.nombre[0] ?? ""}${convActiva.contacto.apellido[0] ?? ""}`.toUpperCase() || "?"
                  : "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-stone-100 truncate">{convNombre}</p>
                  {convSinIdentificar && (
                    <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      Sin identificar
                    </span>
                  )}
                </div>
                {convActiva?.cuentaCanal && (
                  <p className="text-[10px] text-stone-500">{convActiva.cuentaCanal.nombre}</p>
                )}
              </div>
              {isFetching && (
                <Loader2 className="h-3.5 w-3.5 text-stone-600 animate-spin shrink-0" />
              )}
              <button
                type="button"
                onClick={() => setPanelContactoAbierto((v) => !v)}
                title={panelContactoAbierto ? "Ocultar info de contacto" : "Ver info de contacto"}
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center transition-colors shrink-0",
                  panelContactoAbierto
                    ? "bg-lime-500/15 text-lime-400"
                    : "text-stone-500 hover:bg-white/5 hover:text-stone-300"
                )}
              >
                <UserCircle2 className="h-4 w-4" />
              </button>
            </div>

            {/* Messages area */}
            <div
              ref={messagesAreaRef}
              className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-white/10"
            >
              {/* Load earlier button */}
              {hayMasAnteriores && (
                <div className="flex justify-center pb-3">
                  <button
                    type="button"
                    onClick={handleCargarAnteriores}
                    disabled={cargandoAnteriores}
                    className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 bg-white/5 hover:bg-white/8 border border-white/10 rounded-full px-3 py-1.5 transition-all disabled:opacity-50"
                  >
                    {cargandoAnteriores
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ChevronUp className="h-3 w-3" />}
                    Cargar anteriores
                  </button>
                </div>
              )}

              {/* Message groups */}
              {grupos.length === 0 && !isFetching ? (
                <div className="flex items-center justify-center h-32 text-xs text-stone-600">
                  Sin mensajes aún
                </div>
              ) : (
                grupos.map((grupo) => (
                  <div key={grupo.fecha}>
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-[10px] text-stone-600 uppercase tracking-wide">{grupo.fecha}</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                    <div className="space-y-1">
                      {grupo.mensajes.map((m) => (
                        <BurbujaMensaje key={m.id} mensaje={m} />
                      ))}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Message input */}
            <InputMensaje
              conversacionId={seleccionada}
              cuentas={cuentas}
              cuentaSeleccionadaId={cuentaSeleccionadaId}
              onCambiarCuenta={setCuentaSeleccionadaId}
              onEnviar={handleEnviar}
              enviando={enviando}
            />
          </>
        )}
      </div>

      {/* ── Right panel: contact info ── */}
      {seleccionada && convActiva && panelContactoAbierto && (
        <div className="w-64 shrink-0">
          <PanelContactoInbox
            conversacion={convActiva}
            onContactoActualizado={handleContactoActualizado}
          />
        </div>
      )}

      {/* Context menu (right-click) */}
      {contextMenu && (
        <div
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 100 }}
          className="bg-stone-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl shadow-black/60 py-1 min-w-48 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            disabled={cerrando}
            onClick={() => {
              handleCerrar(contextMenu.conversacionId);
              setContextMenu(null);
            }}
            className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="h-4 w-4 shrink-0" />
            Cerrar conversación
          </button>
        </div>
      )}
    </div>
  );
}
