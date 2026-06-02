"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, ChevronUp, Loader2, UserCircle2,
  Check, RotateCcw, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BurbujaMensaje } from "./burbuja-mensaje";
import { InputMensaje } from "./input-mensaje";
import { PanelContactoInbox } from "./panel-contacto-inbox";
import {
  cerrarConversacion,
  enviarMensaje,
  marcarRespondida,
  reabrirConversacion,
} from "../actions";
import type { ConversacionResumen, MensajeConMeta, CuentaCanalResumen } from "../types";

// ── Tipos y configuración de estados ─────────────────────────────────────────

type Filtro = "todos" | "abiertas" | "esperando" | "cerradas";
type EstadoConv = ConversacionResumen["estado"];

const ESTADO_CFG: Record<EstadoConv, {
  dot: string;
  pulse: boolean;
  barBg: string;
  barBorder: string;
  label: string;
  labelColor: string;
  badgeBg: string;
  badgeText: string;
  badgeLabel: string;
}> = {
  ABIERTA: {
    dot: "bg-amber-500",
    pulse: true,
    barBg: "bg-amber-500/5",
    barBorder: "border-amber-500/20",
    label: "Pendiente de respuesta",
    labelColor: "text-amber-400",
    badgeBg: "bg-amber-500/12 border-amber-500/25",
    badgeText: "text-amber-400",
    badgeLabel: "Abierta",
  },
  EN_ESPERA: {
    dot: "bg-lime-500",
    pulse: false,
    barBg: "bg-lime-500/5",
    barBorder: "border-lime-500/20",
    label: "Esperando respuesta del cliente",
    labelColor: "text-lime-400",
    badgeBg: "bg-lime-500/12 border-lime-500/25",
    badgeText: "text-lime-400",
    badgeLabel: "Esperando",
  },
  CERRADA: {
    dot: "bg-stone-500",
    pulse: false,
    barBg: "bg-stone-900/60",
    barBorder: "border-white/6",
    label: "Conversación cerrada",
    labelColor: "text-stone-400",
    badgeBg: "bg-white/6 border-white/10",
    badgeText: "text-stone-400",
    badgeLabel: "Cerrada",
  },
  ARCHIVADA: {
    dot: "bg-stone-600",
    pulse: false,
    barBg: "bg-stone-900/40",
    barBorder: "border-white/5",
    label: "Conversación archivada",
    labelColor: "text-stone-500",
    badgeBg: "bg-white/4 border-white/8",
    badgeText: "text-stone-500",
    badgeLabel: "Archivada",
  },
};

const FILTROS: { key: Filtro; label: string; estados: EstadoConv[] }[] = [
  { key: "todos",    label: "Todos",    estados: ["ABIERTA", "EN_ESPERA", "CERRADA", "ARCHIVADA"] },
  { key: "abiertas", label: "Abiertas", estados: ["ABIERTA"] },
  { key: "esperando", label: "Esperando", estados: ["EN_ESPERA"] },
  { key: "cerradas", label: "Cerradas", estados: ["CERRADA"] },
];

// Prioridad de ordenación para vista "Todos"
const PRIORIDAD: Record<EstadoConv, number> = {
  ABIERTA: 0, EN_ESPERA: 1, CERRADA: 2, ARCHIVADA: 3,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Componente principal ──────────────────────────────────────────────────────

interface InboxLayoutProps {
  conversacionesIniciales: ConversacionResumen[];
  cuentas: CuentaCanalResumen[];
}

export function InboxLayout({ conversacionesIniciales, cuentas }: InboxLayoutProps) {
  const queryClient = useQueryClient();

  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [panelContactoAbierto, setPanelContactoAbierto] = useState(true);

  const [enviando, startEnviando] = useTransition();
  const [accionando, startAccion] = useTransition();

  const [mensajesAnteriores, setMensajesAnteriores] = useState<MensajeConMeta[]>([]);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [hayMasAnteriores, setHayMasAnteriores] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  // Mensajes de la conversación seleccionada
  const { data: mensajesRecientes = [], isFetching } = useQuery<MensajeConMeta[]>({
    queryKey: ["inbox-mensajes", seleccionada],
    queryFn: () => fetchUltimosMensajes(seleccionada!),
    enabled: !!seleccionada,
    staleTime: 0,
  });

  // Conversación activa (fuente de verdad para estado)
  const convActiva = useMemo(
    () => conversaciones.find((c) => c.id === seleccionada) ?? null,
    [conversaciones, seleccionada]
  );

  // Lista filtrada y ordenada
  const filtradas = useMemo(() => {
    const cfg = FILTROS.find((f) => f.key === filtro)!;
    const lista = conversaciones.filter((c) => cfg.estados.includes(c.estado));
    if (filtro === "todos") {
      return [...lista].sort(
        (a, b) =>
          PRIORIDAD[a.estado] - PRIORIDAD[b.estado] ||
          new Date(b.actualizadoEn).getTime() - new Date(a.actualizadoEn).getTime()
      );
    }
    return lista;
  }, [conversaciones, filtro]);

  // Conteos por filtro
  const conteos = useMemo(() => {
    const c: Record<Filtro, number> = { todos: 0, abiertas: 0, esperando: 0, cerradas: 0 };
    for (const conv of conversaciones) {
      c.todos++;
      if (conv.estado === "ABIERTA") c.abiertas++;
      else if (conv.estado === "EN_ESPERA") c.esperando++;
      else if (conv.estado === "CERRADA") c.cerradas++;
    }
    return c;
  }, [conversaciones]);

  // Reset al cambiar de conversación
  useEffect(() => {
    setMensajesAnteriores([]);
    setHayMasAnteriores(false);
  }, [seleccionada]);

  useEffect(() => {
    if (mensajesRecientes.length > 0) {
      setHayMasAnteriores(mensajesRecientes.length >= 50);
    }
  }, [mensajesRecientes]);

  // Scroll al fondo al cambiar de conversación
  useEffect(() => {
    if (!isFetching && mensajesRecientes.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [seleccionada, isFetching]);

  // SSE: actualizar mensajes y estados en tiempo real
  const instanciaId = convActiva?.instanciaId ?? null;
  useEffect(() => {
    if (!instanciaId) return;
    const source = new EventSource(`/api/sse/conversaciones?instanciaId=${instanciaId}`);

    source.addEventListener("MENSAJE_RECIBIDO", (e) => {
      queryClient.invalidateQueries({ queryKey: ["inbox-mensajes", seleccionada] });
      try {
        const { conversacionId: cid } = JSON.parse(e.data ?? "{}") as { conversacionId?: string };
        if (cid) {
          // Si la conversación estaba en espera, reabrirla localmente
          setConversaciones((prev) =>
            prev.map((c) =>
              c.id === cid && c.estado === "EN_ESPERA" ? { ...c, estado: "ABIERTA" } : c
            )
          );
        }
      } catch { /* ignorar */ }
    });

    source.addEventListener("MENSAJE_ENVIADO", () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-mensajes", seleccionada] });
    });

    return () => source.close();
  }, [instanciaId, seleccionada, queryClient]);

  // ── Actualizaciones de estado (optimistas) ────────────────────────────────

  const actualizarEstado = (id: string, nuevoEstado: EstadoConv) => {
    setConversaciones((prev) =>
      prev.map((c) => (c.id === id ? { ...c, estado: nuevoEstado } : c))
    );
  };

  const handleMarcarRespondida = (id: string) => {
    startAccion(async () => {
      actualizarEstado(id, "EN_ESPERA");
      const result = await marcarRespondida(id);
      if (!result.ok) {
        actualizarEstado(id, "ABIERTA");
        toast.error(result.error ?? "Error al marcar respondida");
      } else {
        toast.success("Marcada como respondida");
      }
    });
  };

  const handleReabrir = (id: string, estadoPrev: EstadoConv) => {
    startAccion(async () => {
      actualizarEstado(id, "ABIERTA");
      const result = await reabrirConversacion(id);
      if (!result.ok) {
        actualizarEstado(id, estadoPrev);
        toast.error(result.error ?? "Error al reabrir");
      }
    });
  };

  const handleCerrar = (id: string) => {
    startAccion(async () => {
      actualizarEstado(id, "CERRADA");
      const result = await cerrarConversacion(id);
      if (!result.ok) {
        actualizarEstado(id, "ABIERTA");
        toast.error(result.error ?? "Error al cerrar");
      } else {
        toast.success("Conversación cerrada");
      }
    });
  };

  // ── Paginación ────────────────────────────────────────────────────────────

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
      requestAnimationFrame(() => {
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight - scrollHeightAntes;
      });
    } finally {
      setCargandoAnteriores(false);
    }
  };

  const handleEnviar = async ({ contenido, esNotaInterna, mediaUrl }: {
    contenido: string; esNotaInterna: boolean; mediaUrl?: string;
  }) => {
    if (!seleccionada) return;
    startEnviando(async () => {
      const result = await enviarMensaje({
        conversacionId: seleccionada,
        contenido,
        tipo: mediaUrl ? "IMAGEN" : "TEXTO",
        esNotaInterna,
        mediaUrl,
      });
      if (!result.ok) toast.error("Error al enviar mensaje");
    });
  };

  const handleContactoActualizado = (
    conversacionId: string,
    nuevoContacto: ConversacionResumen["contacto"]
  ) => {
    setConversaciones((prev) =>
      prev.map((c) => (c.id === conversacionId ? { ...c, contacto: nuevoContacto } : c))
    );
  };

  // ── Datos derivados ───────────────────────────────────────────────────────

  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState<string | null>(null);

  const todosLosMensajes = [...mensajesAnteriores, ...mensajesRecientes];
  const grupos = agruparPorFecha(todosLosMensajes);

  const convNombreBase = convActiva
    ? `${convActiva.contacto.nombre} ${convActiva.contacto.apellido}`.trim()
    : "";
  const convNombre = convNombreBase || convActiva?.contacto.telefonoPrincipal || "Sin nombre";
  const convSinIdentificar = convActiva ? !convNombreBase : false;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Panel izquierdo: lista de conversaciones ── */}
      <aside className="w-64 lg:w-72 shrink-0 border-r border-white/10 flex flex-col bg-stone-950/70 backdrop-blur-xl">

        {/* Encabezado */}
        <div className="px-4 pt-3.5 pb-2 border-b border-white/8 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2.5">
            Conversaciones
          </p>
          {/* Tabs de filtro */}
          <div className="flex gap-1">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltro(f.key)}
                className={cn(
                  "flex-1 text-center text-[10px] font-medium rounded-lg py-1 px-0.5 transition-colors leading-tight",
                  filtro === f.key
                    ? "bg-lime-500/15 text-lime-400 border border-lime-500/25"
                    : "text-stone-500 hover:text-stone-300 hover:bg-white/4 border border-transparent"
                )}
              >
                <span className="block">{f.label}</span>
                <span className={cn(
                  "block text-[9px] font-semibold mt-0.5",
                  filtro === f.key ? "text-lime-300" : "text-stone-600"
                )}>
                  {conteos[f.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <ul className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
          {filtradas.length === 0 ? (
            <li className="flex flex-col items-center justify-center gap-2 h-40 text-center px-4">
              <MessageSquare className="h-5 w-5 text-stone-700" />
              <p className="text-xs text-stone-600">Sin conversaciones</p>
            </li>
          ) : (
            filtradas.map((conv) => {
              const esActiva = seleccionada === conv.id;
              const nombreContacto = `${conv.contacto.nombre} ${conv.contacto.apellido}`.trim();
              const sinIdentificar = !nombreContacto;
              const nombre = nombreContacto || conv.contacto.telefonoPrincipal || "Sin nombre";
              const iniciales = nombreContacto
                ? `${conv.contacto.nombre[0] ?? ""}${conv.contacto.apellido[0] ?? ""}`.toUpperCase()
                : "?";
              const cfg = ESTADO_CFG[conv.estado] ?? ESTADO_CFG.CERRADA;

              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeleccionada(conv.id);
                      setCuentaSeleccionadaId(conv.cuentaCanalId ?? cuentas[0]?.id ?? null);
                    }}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-l-2",
                      esActiva
                        ? "bg-lime-500/8 border-l-lime-500"
                        : "border-l-transparent hover:bg-white/4"
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "h-9 w-9 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0",
                      sinIdentificar
                        ? "bg-stone-800/60 border-stone-700 text-stone-500"
                        : "bg-gradient-to-br from-lime-500/30 to-emerald-500/20 border-lime-500/20 text-lime-300"
                    )}>
                      {iniciales}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Nombre + tiempo */}
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={cn(
                            "text-xs font-semibold truncate",
                            esActiva ? "text-stone-50" : "text-stone-200"
                          )}>
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

                      {/* Último mensaje */}
                      <p className="text-[11px] text-stone-500 truncate leading-snug">
                        {conv.ultimoMensaje?.contenido
                          ? conv.ultimoMensaje.contenido.slice(0, 55)
                          : <span className="italic text-stone-600">Sin mensajes</span>}
                      </p>

                      {/* Canal + badge de estado */}
                      <div className="flex items-center justify-between mt-1 gap-1">
                        {conv.cuentaCanal ? (
                          <p className="text-[9px] text-stone-600 truncate">{conv.cuentaCanal.nombre}</p>
                        ) : <span />}
                        <span className={cn(
                          "shrink-0 flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                          cfg.badgeBg, cfg.badgeText
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
                          {cfg.badgeLabel}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {/* ── Panel central: área de chat ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-stone-950/40">
        {seleccionada === null || !convActiva ? (
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
            {/* Encabezado del chat */}
            <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center gap-3 bg-stone-950/50 backdrop-blur-sm">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-lime-500/30 to-emerald-500/20 border border-lime-500/20 flex items-center justify-center text-xs font-semibold text-lime-300 shrink-0">
                {`${convActiva.contacto.nombre[0] ?? ""}${convActiva.contacto.apellido[0] ?? ""}`.toUpperCase() || "?"}
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
                {convActiva.cuentaCanal && (
                  <p className="text-[10px] text-stone-500">{convActiva.cuentaCanal.nombre}</p>
                )}
              </div>
              {isFetching && <Loader2 className="h-3.5 w-3.5 text-stone-600 animate-spin shrink-0" />}
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

            {/* Barra de estado */}
            <BarraEstado
              conv={convActiva}
              accionando={accionando}
              onMarcarRespondida={() => handleMarcarRespondida(convActiva.id)}
              onReabrir={() => handleReabrir(convActiva.id, convActiva.estado)}
              onCerrar={() => handleCerrar(convActiva.id)}
            />

            {/* Área de mensajes */}
            <div
              ref={messagesAreaRef}
              className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-white/10"
            >
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

            {/* Input o banner de cerrada */}
            {convActiva.estado === "CERRADA" ? (
              <div className="px-4 py-3 border-t border-white/8 bg-stone-950/60 flex items-center justify-center gap-3">
                <p className="text-xs text-stone-500">Esta conversación está cerrada.</p>
                <button
                  type="button"
                  disabled={accionando}
                  onClick={() => handleReabrir(convActiva.id, "CERRADA")}
                  className="flex items-center gap-1.5 text-xs font-medium text-stone-300 bg-white/8 hover:bg-white/12 border border-white/12 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reabrir para responder
                </button>
              </div>
            ) : (
              <InputMensaje
                conversacionId={seleccionada}
                cuentas={cuentas}
                cuentaSeleccionadaId={cuentaSeleccionadaId}
                onCambiarCuenta={setCuentaSeleccionadaId}
                onEnviar={handleEnviar}
                enviando={enviando}
              />
            )}
          </>
        )}
      </div>

      {/* ── Panel derecho: info de contacto ── */}
      {seleccionada && convActiva && panelContactoAbierto && (
        <div className="w-64 shrink-0">
          <PanelContactoInbox
            conversacion={convActiva}
            onContactoActualizado={handleContactoActualizado}
          />
        </div>
      )}
    </div>
  );
}

// ── Barra de estado de la conversación ───────────────────────────────────────

function BarraEstado({
  conv,
  accionando,
  onMarcarRespondida,
  onReabrir,
  onCerrar,
}: {
  conv: ConversacionResumen;
  accionando: boolean;
  onMarcarRespondida: () => void;
  onReabrir: () => void;
  onCerrar: () => void;
}) {
  const cfg = ESTADO_CFG[conv.estado] ?? ESTADO_CFG.CERRADA;

  const tiempoRelativo = formatDistanceToNow(new Date(conv.actualizadoEn), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div className={cn(
      "px-4 py-2.5 border-b shrink-0 flex items-center justify-between gap-3",
      cfg.barBg, cfg.barBorder
    )}>
      {/* Indicador izquierdo */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold leading-tight", cfg.labelColor)}>
            {cfg.label}
          </p>
          <p className="flex items-center gap-1 text-[10px] text-stone-500 mt-0.5">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            {tiempoRelativo}
          </p>
        </div>
      </div>

      {/* Acciones rápidas según estado */}
      <div className="flex items-center gap-1.5 shrink-0">
        {conv.estado === "ABIERTA" && (
          <button
            type="button"
            disabled={accionando}
            onClick={onMarcarRespondida}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-950 bg-lime-400 hover:bg-lime-300 rounded-lg px-2.5 py-1.5 transition-all hover:scale-[1.02] disabled:opacity-50 shadow-sm"
          >
            <Check className="h-3 w-3" />
            Marcar respondida
          </button>
        )}

        {conv.estado === "EN_ESPERA" && (
          <>
            <button
              type="button"
              disabled={accionando}
              onClick={onReabrir}
              className="flex items-center gap-1.5 text-[11px] font-medium text-stone-300 bg-white/8 hover:bg-white/12 border border-white/12 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Reabrir
            </button>
            <button
              type="button"
              disabled={accionando}
              onClick={onCerrar}
              className="flex items-center gap-1.5 text-[11px] font-medium text-stone-400 bg-white/5 hover:bg-white/8 border border-white/8 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" />
              Cerrar
            </button>
          </>
        )}

        {conv.estado === "CERRADA" && (
          <button
            type="button"
            disabled={accionando}
            onClick={onReabrir}
            className="flex items-center gap-1.5 text-[11px] font-medium text-stone-300 bg-white/8 hover:bg-white/12 border border-white/12 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            Reabrir conversación
          </button>
        )}
      </div>
    </div>
  );
}
