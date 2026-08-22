"use client";

import { useState, useEffect, useRef, useTransition, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, MessagesSquare, ChevronUp, Loader2, UserCircle2,
  Check, RotateCcw, XCircle, Clock, Clock3, Search, MessageCircle, Camera, Mail,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/shared/ui/empty-state";
import { AvatarContacto } from "./avatar-contacto";
import { BurbujaMensaje } from "./burbuja-mensaje";
import { EventoSistema } from "./evento-sistema";
import { InputMensaje } from "./input-mensaje";
import { PanelContactoInbox } from "./panel-contacto-inbox";
import { BarraClasificacion } from "./barra-clasificacion";
import {
  cerrarConversacion,
  enviarMensaje,
  marcarMensajesLeidos,
  marcarRespondida,
  reabrirConversacion,
  obtenerConversacionAction,
  obtenerConversacionesInboxAction,
  toggleReaccion,
} from "../actions";
import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import { IndicadorAutoRefresh } from "@/shared/components/indicador-auto-refresh";
import type { ConversacionResumen, MensajeConMeta, MensajeReaccionResumen, CuentaCanalResumen } from "../types";

// ── Tipos y configuración de estados ─────────────────────────────────────────

type Filtro = "todos" | "abiertas" | "esperando" | "cerradas";
type EstadoConv = ConversacionResumen["estado"];

const ESTADO_CFG: Record<EstadoConv, {
  dot: string;
  /** Color del punto en la barra de estado (BarraEstado) — solo difiere del
   *  `dot` de la lista en EN_ESPERA, donde el badge de la lista se queda en
   *  el verde eucalipto del Inbox pero el banner pasa a ámbar (ver abajo). */
  barDot?: string;
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
    dot: "bg-stage-amber",
    pulse: true,
    barBg: "bg-stage-amber-muted",
    barBorder: "border-stage-amber-border",
    label: "Pendiente de respuesta",
    labelColor: "text-stage-amber-text",
    badgeBg: "bg-stage-amber-muted border-stage-amber-border",
    badgeText: "text-stage-amber-text",
    badgeLabel: "Abierta",
  },
  EN_ESPERA: {
    // Badge de la lista ("Esperando"): verde eucalipto del Inbox — es la
    // identidad de marca del Inbox, discreta.
    dot: "bg-inbox-waiting-text",
    // Banner grande ("Esperando respuesta del cliente"): es un estado de
    // atención, no de marca — ámbar tenue en vez de verde, para no repetir
    // el mismo verde en todos lados y que se lea como una señal distinta.
    barDot: "bg-inbox-banner-dot",
    pulse: false,
    barBg: "bg-inbox-banner-bg",
    barBorder: "border-inbox-banner-border",
    label: "Esperando respuesta del cliente",
    labelColor: "text-inbox-banner-title",
    badgeBg: "bg-inbox-waiting-bg border-inbox-waiting-border",
    badgeText: "text-inbox-waiting-text",
    badgeLabel: "Esperando",
  },
  CERRADA: {
    dot: "bg-text-muted",
    pulse: false,
    barBg: "bg-muted",
    barBorder: "border-border-subtle",
    label: "Conversación cerrada",
    labelColor: "text-muted-foreground",
    badgeBg: "bg-badge-bg border-badge-border",
    badgeText: "text-badge-text",
    badgeLabel: "Cerrada",
  },
  ARCHIVADA: {
    dot: "bg-text-disabled",
    pulse: false,
    barBg: "bg-muted/60",
    barBorder: "border-border-subtle",
    label: "Conversación archivada",
    labelColor: "text-muted-foreground",
    badgeBg: "bg-badge-bg/60 border-badge-border",
    badgeText: "text-muted-foreground",
    badgeLabel: "Archivada",
  },
};

const FILTROS: { key: Filtro; label: string; estados: EstadoConv[]; Icono: LucideIcon }[] = [
  { key: "abiertas",  label: "Abiertas",  estados: ["ABIERTA"],   Icono: MessageSquare },
  { key: "todos",     label: "Todos",     estados: ["ABIERTA", "EN_ESPERA", "CERRADA", "ARCHIVADA"], Icono: MessagesSquare },
  { key: "esperando", label: "Esperando", estados: ["EN_ESPERA"], Icono: Clock3 },
  { key: "cerradas",  label: "Cerradas",  estados: ["CERRADA"],   Icono: Check },
];

// Prioridad de ordenación para vista "Todos"
const PRIORIDAD: Record<EstadoConv, number> = {
  ABIERTA: 0, EN_ESPERA: 1, CERRADA: 2, ARCHIVADA: 3,
};

// ── Canal: icono + color discreto para identificar rápido en la lista ────────

function infoCanal(canal: string | undefined): { Icono: LucideIcon; clase: string } {
  // Whatsapp/Email usan tokens semánticos (success/info); Instagram conserva
  // su rosa de marca — no hay un token de "identidad de canal" para eso y
  // ya tiene variante propia por tema, no es un hardcode que rompa light/dark.
  if (canal?.startsWith("whatsapp")) return { Icono: MessageCircle, clase: "text-success" };
  if (canal === "instagram") return { Icono: Camera, clase: "text-pink-600 dark:text-pink-400" };
  if (canal === "email") return { Icono: Mail, clase: "text-info" };
  return { Icono: MessageCircle, clase: "text-muted-foreground" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Formato compacto para el indicador de última respuesta del cliente
// (header del chat, ver InboxLayout) — deliberadamente más corto que
// formatDistanceToNow (que da "hace 5 minutos"/"hace 1 hora"): acá el
// espacio es mínimo, así que "min"/"h"/"día(s)" en vez de la palabra
// completa. Mismo dato que después va a alimentar la ventana de mensajería
// de Instagram (ver obtenerEstadoVentanaMensajeria en
// src/conversaciones/providers/instagram-ventana.ts) — por ahora solo se
// muestra, sin ninguna lógica de color/estado asociada.
function formatearTiempoCompacto(fecha: Date, ahora: Date): string {
  const minutos = differenceInMinutes(ahora, fecha);
  if (minutos < 1) return "hace instantes";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = differenceInHours(ahora, fecha);
  if (horas < 24) return `hace ${horas} h`;
  const dias = differenceInDays(ahora, fecha);
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
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

// ── Componente principal ──────────────────────────────────────────────────────

interface InboxLayoutProps {
  conversacionesIniciales: ConversacionResumen[];
  cuentas: CuentaCanalResumen[];
  usuarioActualId?: string | null;
  nombreUsuarioActual?: string | null;
}

export function InboxLayout({ conversacionesIniciales, cuentas, usuarioActualId = null, nombreUsuarioActual = null }: InboxLayoutProps) {
  const queryClient = useQueryClient();

  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("abiertas");
  const [busqueda, setBusqueda] = useState("");
  const [panelContactoAbierto, setPanelContactoAbierto] = useState(true);

  const [enviando, startEnviando] = useTransition();
  const [accionando, startAccion] = useTransition();
  const [marcandoLeido, startMarcarLeido] = useTransition();
  const [idsLeidosLocal, setIdsLeidosLocal] = useState<Set<string>>(new Set());

  const [mensajesAnteriores, setMensajesAnteriores] = useState<MensajeConMeta[]>([]);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [hayMasAnteriores, setHayMasAnteriores] = useState(false);
  const [reaccionesOptimistas, setReaccionesOptimistas] = useState<Map<string, MensajeReaccionResumen[]>>(new Map());

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

  // Lista filtrada y ordenada — el filtro de texto es puramente local, sobre
  // los datos ya cargados (sin llamadas nuevas al backend).
  const filtradas = useMemo(() => {
    const cfg = FILTROS.find((f) => f.key === filtro)!;
    let lista = conversaciones.filter((c) => cfg.estados.includes(c.estado));

    const termino = busqueda.trim().toLowerCase();
    if (termino) {
      lista = lista.filter((c) => {
        const nombre = `${c.contacto.nombre} ${c.contacto.apellido}`.toLowerCase();
        const preview = c.ultimoMensaje?.contenido?.toLowerCase() ?? "";
        const telefono = c.contacto.telefonoPrincipal?.toLowerCase() ?? "";
        return nombre.includes(termino) || preview.includes(termino) || telefono.includes(termino);
      });
    }

    if (filtro === "todos") {
      return [...lista].sort(
        (a, b) =>
          PRIORIDAD[a.estado] - PRIORIDAD[b.estado] ||
          new Date(b.actualizadoEn).getTime() - new Date(a.actualizadoEn).getTime()
      );
    }
    return lista;
  }, [conversaciones, filtro, busqueda]);

  // Conteos por filtro (sobre el total, no afectados por la búsqueda de texto)
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
    setIdsLeidosLocal(new Set());
    setReaccionesOptimistas(new Map());
  }, [seleccionada]);

  const handleMarcarLeidos = (ids: string[]) => {
    if (!seleccionada || !ids.length) return;
    startMarcarLeido(async () => {
      setIdsLeidosLocal((prev) => new Set([...prev, ...ids]));
      const result = await marcarMensajesLeidos(seleccionada, ids);
      if (!result.ok) {
        setIdsLeidosLocal((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        toast.error("Error al marcar como leído");
      } else {
        queryClient.invalidateQueries({ queryKey: ["inbox-mensajes", seleccionada] });
      }
    });
  };

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
          // Refrescar datos completos de la conversación (incluye oportunidadGanadaRel, clasificacion)
          obtenerConversacionAction(cid).then((fresca) => {
            if (!fresca) return;
            setConversaciones((prev) => {
              const existe = prev.find((c) => c.id === cid);
              if (existe) return prev.map((c) => c.id === cid ? fresca : c);
              // Conversación nueva — agregar al inicio
              return [fresca, ...prev];
            });
          });
        }
      } catch { /* ignorar */ }
    });

    source.addEventListener("MENSAJE_ENVIADO", () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-mensajes", seleccionada] });
    });

    source.addEventListener("REACCION_ACTUALIZADA", () => {
      setReaccionesOptimistas(new Map());
      queryClient.invalidateQueries({ queryKey: ["inbox-mensajes", seleccionada] });
    });

    return () => source.close();
  }, [instanciaId, seleccionada, queryClient]);

  // ── Auto-refresh: red de seguridad sobre el SSE ─────────────────────────────
  // El SSE ya empuja mensajes nuevos en tiempo real, pero si la conexión se
  // cae silenciosamente (proxys, redes inestables) no hay forma de notarlo
  // desde la UI. Este poll periódico re-trae la lista completa y la reemplaza,
  // así "nuevoMensaje"/conversaciones que llegaron igual aparecen solas.
  const refrescarConversaciones = useCallback(async () => {
    try {
      const frescas = await obtenerConversacionesInboxAction();
      setConversaciones(frescas);
    } catch {
      // silencioso — el próximo tick lo reintenta
    }
  }, []);

  const {
    restante: autoRefreshRestante,
    intervaloSegundos: autoRefreshIntervalo,
    activo: autoRefreshActivo,
    setActivo: setAutoRefreshActivo,
    cambiarIntervalo: cambiarAutoRefreshIntervalo,
  } = useAutoRefresh("inbox-auto-refresh-segundos", refrescarConversaciones);

  // ── Reacciones a mensajes ─────────────────────────────────────────────────

  const todosLosMensajesRef = [...mensajesAnteriores, ...mensajesRecientes];

  const handleToggleReaccion = (mensajeId: string, emoji: string, tipo: "CANAL" | "INTERNA") => {
    setReaccionesOptimistas((prev) => {
      const next = new Map(prev);
      const actuales = next.get(mensajeId)
        ?? todosLosMensajesRef.find((m) => m.id === mensajeId)?.reacciones
        ?? [];
      const yaReacciono = actuales.some((r) => r.emoji === emoji && r.usuarioId === usuarioActualId);
      next.set(
        mensajeId,
        yaReacciono
          ? actuales.filter((r) => !(r.emoji === emoji && r.usuarioId === usuarioActualId))
          : [
              ...actuales,
              {
                id: "optimistic",
                emoji,
                tipo,
                usuarioId: usuarioActualId,
                contactoId: null,
                nombreUsuario: nombreUsuarioActual ?? "Yo",
                creadoEn: new Date(),
              },
            ]
      );
      return next;
    });

    toggleReaccion(mensajeId, emoji, tipo, usuarioActualId, nombreUsuarioActual).then((r) => {
      if (!r.exito) {
        setReaccionesOptimistas((prev) => {
          const next = new Map(prev);
          next.delete(mensajeId);
          return next;
        });
        toast.error("Error al guardar la reacción");
      }
    });
  };

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

  // ── Refresco puntual de una conversación ────────────────────────────────────
  // El panel de contacto (clasificación, edición de la oportunidad activa)
  // hace sus propias llamadas a Server Actions; tras cada una pide refrescar
  // solo esa conversación para traer los datos actualizados (oportunidad
  // recién creada, etapa/etiquetas nuevas, etc.) sin recargar todo el inbox.
  const handleConversacionActualizada = (conversacionId: string, datosFrescos?: ConversacionResumen) => {
    // Si el caller ya trae los datos frescos (ej. clasificarConversacion los
    // devuelve en la misma respuesta), evitamos un round-trip aparte — antes
    // este segundo viaje era la parte lenta y a veces no llegaba a reflejarse
    // sin recargar la página a mano.
    if (datosFrescos) {
      setConversaciones((prev) => prev.map((c) => (c.id === conversacionId ? datosFrescos : c)));
      return;
    }
    obtenerConversacionAction(conversacionId)
      .then((fresca) => {
        if (!fresca) return;
        setConversaciones((prev) => prev.map((c) => (c.id === conversacionId ? fresca : c)));
      })
      .catch(() => toast.error("No se pudo actualizar la conversación — intenta de nuevo."));
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

  const mensajesNoLeidos = useMemo(
    () =>
      todosLosMensajes.filter(
        (m) =>
          m.remitente === "CONTACTO" &&
          m.estado !== "LEIDO" &&
          !idsLeidosLocal.has(m.id)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todosLosMensajes, idsLeidosLocal]
  );

  // Última respuesta/mensaje ENTRANTE del cliente — no el último mensaje de
  // la conversación en general (ese puede ser del agente y no debe reiniciar
  // este indicador). mensajesRecientes alcanza y sobra: son los últimos 50
  // en orden ascendente, así que cualquier mensaje de CONTACTO ahí adentro
  // ya es, por construcción, el más reciente de toda la conversación
  // (mensajesAnteriores, cargado por paginación "cargar anteriores", es
  // siempre más viejo — no puede cambiar este resultado).
  const ultimoMensajeContactoEn = useMemo(() => {
    for (let i = mensajesRecientes.length - 1; i >= 0; i--) {
      if (mensajesRecientes[i].remitente === "CONTACTO") return new Date(mensajesRecientes[i].creadoEn);
    }
    return null;
  }, [mensajesRecientes]);

  const convNombreBase = convActiva
    ? `${convActiva.contacto.nombre} ${convActiva.contacto.apellido}`.trim()
    : "";
  const convNombre = convNombreBase || convActiva?.contacto.telefonoPrincipal || "Sin nombre";
  const convSinIdentificar = convActiva ? !convNombreBase : false;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Panel izquierdo: lista de conversaciones ── */}
      <aside className="w-72 lg:w-96 shrink-0 border-r border-border flex flex-col bg-background-subtle">

        {/* Buscador + filtros */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar conversaciones..."
                className={cn(
                  "w-full h-8 rounded-lg border pl-8 pr-3 text-xs transition-colors outline-none",
                  "bg-input-bg border-input",
                  "text-foreground placeholder:text-input-placeholder",
                  "focus:border-input-focus/50 focus:ring-2 focus:ring-input-focus/15"
                )}
              />
            </div>
            <IndicadorAutoRefresh
              restante={autoRefreshRestante}
              intervaloSegundos={autoRefreshIntervalo}
              activo={autoRefreshActivo}
              onCambiarIntervalo={cambiarAutoRefreshIntervalo}
              onToggleActivo={() => setAutoRefreshActivo((v) => !v)}
              className="shrink-0"
            />
          </div>

          {/* Tabs de filtro */}
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => {
              const activo = filtro === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFiltro(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                    activo
                      ? "bg-inbox-accent-muted border-inbox-accent-border text-inbox-accent"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <f.Icono className="h-3.5 w-3.5" />
                  {f.label}
                  <span className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    activo ? "text-inbox-accent" : "text-muted-foreground"
                  )}>
                    {conteos[f.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista */}
        <ul className="flex-1 inbox-scroll divide-y divide-card-divider">
          {filtradas.length === 0 ? (
            <li className="flex flex-col items-center justify-center gap-2 h-40 text-center px-4">
              <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                {busqueda.trim() ? "Sin resultados para tu búsqueda" : "Sin conversaciones"}
              </p>
            </li>
          ) : (
            filtradas.map((conv) => {
              const esActiva = seleccionada === conv.id;
              const nombreContacto = `${conv.contacto.nombre} ${conv.contacto.apellido}`.trim();
              const sinIdentificar = !nombreContacto;
              const nombre = nombreContacto || conv.contacto.telefonoPrincipal || "Sin nombre";
              const cfg = ESTADO_CFG[conv.estado] ?? ESTADO_CFG.CERRADA;
              const canal = infoCanal(conv.cuentaCanal?.canal);
              const noLeido = conv.ultimoMensaje?.remitente === "CONTACTO" && conv.ultimoMensaje?.estado !== "LEIDO";

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
                        ? "bg-inbox-accent-muted border-l-inbox-accent"
                        : "border-l-transparent hover:bg-muted/70"
                    )}
                  >
                    {/* Avatar */}
                    <AvatarContacto
                      nombre={conv.contacto.nombre}
                      apellido={conv.contacto.apellido}
                      avatarUrl={conv.contacto.avatarUrl}
                      className="h-9 w-9 text-xs"
                    />

                    <div className="flex-1 min-w-0">
                      {/* Nombre + tiempo */}
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={cn(
                            "text-xs truncate",
                            noLeido ? "font-bold" : "font-semibold",
                            "text-foreground"
                          )}>
                            {nombre}
                          </p>
                          {sinIdentificar && (
                            <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-stage-amber-muted text-stage-amber-text border border-stage-amber-border">
                              ?
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {formatDistanceToNow(new Date(conv.actualizadoEn), { addSuffix: false, locale: es })}
                        </span>
                      </div>

                      {/* Último mensaje */}
                      <p className={cn(
                        "text-[11px] truncate leading-snug",
                        noLeido ? "text-text-secondary" : "text-muted-foreground"
                      )}>
                        {conv.ultimoMensaje?.contenido
                          ? conv.ultimoMensaje.contenido.slice(0, 55)
                          : <span className="italic text-muted-foreground">Sin mensajes</span>}
                      </p>

                      {/* Canal + badge de estado */}
                      <div className="flex items-center justify-between mt-1 gap-1">
                        {conv.cuentaCanal ? (
                          <span className={cn("inline-flex items-center gap-1 text-[9px] font-medium truncate", canal.clase)}>
                            <canal.Icono className="h-2.5 w-2.5 shrink-0" />
                            {conv.cuentaCanal.nombre}
                          </span>
                        ) : <span />}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {noLeido && <span className="h-1.5 w-1.5 rounded-full bg-inbox-accent" />}
                          <span className={cn(
                            "flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                            cfg.badgeBg, cfg.badgeText
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
                            {cfg.badgeLabel}
                          </span>
                        </div>
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
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {seleccionada === null || !convActiva ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              Icono={MessagesSquare}
              titulo="Selecciona una conversación"
              descripcion="Elige una conversación de la lista para ver los mensajes y continuar desde donde lo dejaste."
            />
          </div>
        ) : (
          <>
            {/* Encabezado del chat */}
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-3">
              <AvatarContacto
                nombre={convActiva.contacto.nombre}
                apellido={convActiva.contacto.apellido}
                avatarUrl={convActiva.contacto.avatarUrl}
                className="h-8 w-8 text-xs"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{convNombre}</p>
                  {convSinIdentificar && (
                    <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-stage-amber-muted text-stage-amber-text border border-stage-amber-border">
                      Sin identificar
                    </span>
                  )}
                </div>
                {convActiva.cuentaCanal && (
                  <p className="text-[10px] text-muted-foreground">{convActiva.cuentaCanal.nombre}</p>
                )}
              </div>
              {isFetching && <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />}
              {ultimoMensajeContactoEn && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 whitespace-nowrap cursor-default">
                      <Clock className="h-3 w-3 shrink-0" />
                      {formatearTiempoCompacto(ultimoMensajeContactoEn, new Date())}
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Última respuesta del cliente
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <button
                type="button"
                onClick={() => setPanelContactoAbierto((v) => !v)}
                title={panelContactoAbierto ? "Ocultar info de contacto" : "Ver info de contacto"}
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center transition-colors shrink-0",
                  panelContactoAbierto
                    ? "bg-inbox-accent-muted text-inbox-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <UserCircle2 className="h-4 w-4" />
              </button>
            </div>

            {/* Barra de estado */}
            <BarraEstado
              conv={convActiva}
              accionando={accionando}
              marcandoLeido={marcandoLeido}
              mensajesNoLeidosCount={mensajesNoLeidos.length}
              onMarcarRespondida={() => handleMarcarRespondida(convActiva.id)}
              onReabrir={() => handleReabrir(convActiva.id, convActiva.estado)}
              onCerrar={() => handleCerrar(convActiva.id)}
              onMarcarBloque={() => handleMarcarLeidos(mensajesNoLeidos.map((m) => m.id))}
            />

            {/* Barra de clasificación (solo si hay oportunidad ganada previa) */}
            {convActiva.oportunidadGanadaRel && <BarraClasificacion />}

            {/* Área de mensajes */}
            <div
              ref={messagesAreaRef}
              className="flex-1 inbox-scroll px-4 py-3"
            >
              {hayMasAnteriores && (
                <div className="flex justify-center pb-3">
                  <button
                    type="button"
                    onClick={handleCargarAnteriores}
                    disabled={cargandoAnteriores}
                    className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-foreground bg-button-secondary-bg hover:bg-button-secondary-hover border border-button-secondary-border rounded-full px-3 py-1.5 transition-all disabled:opacity-50"
                  >
                    {cargandoAnteriores
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ChevronUp className="h-3 w-3" />}
                    Cargar anteriores
                  </button>
                </div>
              )}

              {grupos.length === 0 && !isFetching ? (
                <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                  Sin mensajes aún
                </div>
              ) : (
                grupos.map((grupo) => (
                  <div key={grupo.fecha}>
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-card-divider" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{grupo.fecha}</span>
                      <div className="flex-1 h-px bg-card-divider" />
                    </div>
                    <div className="space-y-1">
                      {grupo.mensajes.map((m) =>
                        m.tipo === "EVENTO_SISTEMA" ? (
                          <EventoSistema key={m.id} mensaje={m} />
                        ) : (
                          <BurbujaMensaje
                            key={m.id}
                            mensaje={m}
                            leidoLocal={idsLeidosLocal.has(m.id)}
                            onMarcarLeido={m.remitente === "CONTACTO" ? (id) => handleMarcarLeidos([id]) : undefined}
                            reaccionesEfectivas={reaccionesOptimistas.get(m.id) ?? m.reacciones}
                            usuarioActualId={usuarioActualId}
                            onToggleReaccion={handleToggleReaccion}
                          />
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input o banner de cerrada */}
            {convActiva.estado === "CERRADA" ? (
              <div className="px-4 py-3 border-t border-border bg-muted flex items-center justify-center gap-3">
                <p className="text-xs text-muted-foreground">Esta conversación está cerrada.</p>
                <button
                  type="button"
                  disabled={accionando}
                  onClick={() => handleReabrir(convActiva.id, "CERRADA")}
                  className="flex items-center gap-1.5 text-xs font-medium text-text-secondary bg-button-secondary-bg hover:bg-button-secondary-hover border border-button-secondary-border rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
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
        <div className="w-64 lg:w-72 xl:w-80 shrink-0 flex flex-col min-h-0">
          <PanelContactoInbox
            conversacion={convActiva}
            onContactoActualizado={handleContactoActualizado}
            onConversacionActualizada={handleConversacionActualizada}
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
  marcandoLeido,
  mensajesNoLeidosCount,
  onMarcarRespondida,
  onReabrir,
  onCerrar,
  onMarcarBloque,
}: {
  conv: ConversacionResumen;
  accionando: boolean;
  marcandoLeido: boolean;
  mensajesNoLeidosCount: number;
  onMarcarRespondida: () => void;
  onReabrir: () => void;
  onCerrar: () => void;
  onMarcarBloque: () => void;
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
        <div className={cn("h-2 w-2 rounded-full shrink-0", cfg.barDot ?? cfg.dot, cfg.pulse && "animate-pulse")} />
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold leading-tight", cfg.labelColor)}>
            {cfg.label}
          </p>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            {tiempoRelativo}
          </p>
        </div>
      </div>

      {/* Acciones rápidas según estado */}
      <div className="flex items-center gap-1.5 shrink-0">
        {mensajesNoLeidosCount > 0 && (
          <button
            type="button"
            disabled={accionando || marcandoLeido}
            onClick={onMarcarBloque}
            className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary bg-button-secondary-bg hover:bg-button-secondary-hover border border-button-secondary-border rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Marcar bloque como leído
            <span className="text-[9px] bg-badge-bg rounded-full px-1.5 py-0.5 leading-none">
              {mensajesNoLeidosCount}
            </span>
          </button>
        )}

        {conv.estado === "ABIERTA" && (
          <button
            type="button"
            disabled={accionando}
            onClick={onMarcarRespondida}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-inbox-accent-foreground bg-inbox-accent hover:bg-inbox-accent-hover rounded-lg px-2.5 py-1.5 transition-all hover:scale-[1.02] disabled:opacity-50 shadow-sm"
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
              className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary bg-button-secondary-bg hover:bg-button-secondary-hover border border-button-secondary-border rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Reabrir
            </button>
            <button
              type="button"
              disabled={accionando}
              onClick={onCerrar}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted hover:bg-muted/70 border border-border-subtle rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
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
            className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary bg-button-secondary-bg hover:bg-button-secondary-hover border border-button-secondary-border rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            Reabrir conversación
          </button>
        )}
      </div>
    </div>
  );
}
