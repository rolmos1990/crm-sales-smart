"use client";

import { useState, useMemo, useTransition } from "react";
import { format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  Phone, Mail, Users, CheckSquare, FileText, MessageCircle,
  AlertCircle, Sun, Clock, CheckCircle2, CheckCheck,
  Package, Target, User, Building2, SlidersHorizontal,
  Search, Plus, ChevronDown, Trash2, Circle, X,
  Calendar, Tag,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { completarActividad, eliminarActividad } from "../actions";
import { useSesion } from "@/shared/auth/sesion-context";
import type { Actividad, TipoActividad, PrioridadActividad } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<TipoActividad, { label: string; icon: typeof Phone; color: string; bg: string }> = {
  LLAMADA:  { label: "Llamada",   icon: Phone,         color: "#84cc16", bg: "#84cc1622" },
  EMAIL:    { label: "Email",     icon: Mail,          color: "#3b82f6", bg: "#3b82f622" },
  REUNION:  { label: "Reunión",   icon: Users,         color: "#a855f7", bg: "#a855f722" },
  TAREA:    { label: "Tarea",     icon: CheckSquare,   color: "#f59e0b", bg: "#f59e0b22" },
  NOTA:     { label: "Nota",      icon: FileText,      color: "#6b7280", bg: "#6b728022" },
  WHATSAPP: { label: "WhatsApp",  icon: MessageCircle, color: "#22c55e", bg: "#22c55e22" },
};

const PRIORIDAD_CONFIG: Record<PrioridadActividad, { label: string; clase: string }> = {
  ALTA:  { label: "Alta",  clase: "bg-red-500/10 text-red-500 border-red-500/20" },
  MEDIA: { label: "Media", clase: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  BAJA:  { label: "Baja",  clase: "bg-stone-500/10 text-stone-400 border-stone-500/20" },
};

function formatearFecha(fecha: Date, esVencida: boolean): { texto: string; clase: string } {
  const d = new Date(fecha);
  const hora = format(d, "hh:mm a", { locale: es });
  if (esVencida) {
    const diasAtras = Math.floor((Date.now() - d.getTime()) / 86400000);
    const texto = diasAtras === 0 ? `Hoy · ${hora}` : diasAtras === 1 ? `Ayer · ${hora}` : `Venció ${format(d, "dd MMM", { locale: es })} · ${hora}`;
    return { texto, clase: "text-red-500" };
  }
  if (isToday(d)) return { texto: `Hoy · ${hora}`, clase: "text-amber-500" };
  if (isTomorrow(d)) return { texto: `Mañana · ${hora}`, clase: "text-blue-400" };
  return { texto: format(d, "dd MMM · ", { locale: es }) + hora, clase: "text-blue-400" };
}

function entidadPrincipal(a: Actividad): { label: string; icon: typeof Package; ref?: string } | null {
  if (a.pedido) return { label: a.pedido.numero, icon: Package, ref: "Pedido" };
  if (a.cotizacion) return { label: a.cotizacion.numero, icon: FileText, ref: "Cotización" };
  if (a.oportunidad) return { label: a.oportunidad.titulo, icon: Target, ref: "Oportunidad" };
  if (a.empresa) return { label: a.empresa.nombre, icon: Building2, ref: "Empresa" };
  if (a.contacto) return { label: `${a.contacto.nombre} ${a.contacto.apellido}`, icon: User, ref: "Contacto" };
  return null;
}

function clientePrincipal(a: Actividad): string | null {
  if (a.contacto) return `${a.contacto.nombre} ${a.contacto.apellido}`;
  if (a.empresa) return a.empresa.nombre;
  return null;
}

// ── Card de actividad ───────────────────────────────────────────────────────

function CardActividad({ actividad, esVencida = false, onCompletar, onEliminar }: {
  actividad: Actividad;
  esVencida?: boolean;
  onCompletar?: (id: string) => void;
  onEliminar?: (id: string) => void;
}) {
  const cfg = TIPO_CONFIG[actividad.tipo];
  const Icono = cfg.icon;
  const prioridad = PRIORIDAD_CONFIG[actividad.prioridad];
  const { texto: fechaTexto, clase: fechaClase } = formatearFecha(new Date(actividad.fecha), esVencida);
  const entidad = entidadPrincipal(actividad);
  const cliente = clientePrincipal(actividad);
  const EntidadIcono = entidad?.icon ?? Package;

  return (
    <div className={cn(
      "group flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
      "bg-card border-border hover:border-stone-300 dark:hover:border-white/15",
    )}>
      {/* Icono tipo */}
      <div
        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: cfg.bg }}
      >
        <Icono className="h-4 w-4" style={{ color: cfg.color }} />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{actividad.titulo}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {cliente && <span className="text-xs text-muted-foreground">{cliente}</span>}
          {entidad && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {cliente && <span className="text-muted-foreground/40">·</span>}
              <EntidadIcono className="h-3 w-3" />
              {entidad.ref}: <span className="font-medium text-foreground/80">{entidad.label}</span>
            </span>
          )}
        </div>
        <p className={cn("mt-1 text-xs font-medium", fechaClase)}>{fechaTexto}</p>
      </div>

      {/* Acciones */}
      <div className="flex flex-shrink-0 items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className={cn("hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border", prioridad.clase)}>
          {prioridad.label}
        </span>
        {onCompletar && (
          <button
            type="button"
            title="Completar"
            onClick={() => onCompletar(actividad.id)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-lime-500/40 hover:text-lime-500 transition-colors"
          >
            <Circle className="h-3.5 w-3.5" />
          </button>
        )}
        {onEliminar && (
          <button
            type="button"
            title="Eliminar"
            onClick={() => onEliminar(actividad.id)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-red-500/40 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Badge prioridad (siempre visible en mobile) */}
      <span className={cn("sm:hidden mt-0.5 flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border", prioridad.clase)}>
        {prioridad.label}
      </span>
    </div>
  );
}

// ── Card completada (compacta) ──────────────────────────────────────────────

function CardCompletada({ actividad }: { actividad: Actividad }) {
  const cfg = TIPO_CONFIG[actividad.tipo];
  const entidad = entidadPrincipal(actividad);
  const EntidadIcono = entidad?.icon ?? Package;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-lime-500/10">
        <CheckCheck className="h-3 w-3 text-lime-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground/80 truncate leading-tight">{actividad.titulo}</p>
        {entidad && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <EntidadIcono className="h-3 w-3" />
            {entidad.label}
          </span>
        )}
      </div>
      <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
        {actividad.completadaEn
          ? format(new Date(actividad.completadaEn), isToday(new Date(actividad.completadaEn)) ? "'Hoy,' HH:mm" : "dd MMM, HH:mm", { locale: es })
          : "—"}
      </span>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────

function KpiCard({ label, valor, descripcion, icon: Icono, color }: {
  label: string; valor: number; descripcion: string; icon: typeof AlertCircle; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 flex items-start gap-3">
      <div className="rounded-lg p-2 flex-shrink-0" style={{ backgroundColor: color + "22" }}>
        <Icono className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-none mt-1">{valor}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{descripcion}</p>
      </div>
    </div>
  );
}

// ── Sección de actividades ─────────────────────────────────────────────────

function SeccionActividades({
  titulo, color, icono: Icono, actividades, esVencida = false,
  limite, onVerMas, onCompletar, onEliminar,
}: {
  titulo: string; color: string; icono: typeof AlertCircle;
  actividades: Actividad[]; esVencida?: boolean;
  limite: number; onVerMas?: () => void;
  onCompletar?: (id: string) => void; onEliminar?: (id: string) => void;
}) {
  if (actividades.length === 0) return null;
  const visibles = actividades.slice(0, limite);
  const hayMas = actividades.length > limite;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icono className="h-4 w-4" style={{ color }} />
          <h3 className="text-sm font-semibold text-foreground" style={{ color }}>{titulo}</h3>
          <span
            className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: color + "22", color }}
          >
            {actividades.length}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {visibles.map(a => (
          <CardActividad
            key={a.id}
            actividad={a}
            esVencida={esVencida}
            onCompletar={onCompletar}
            onEliminar={onEliminar}
          />
        ))}
      </div>

      {hayMas && onVerMas && (
        <button
          type="button"
          onClick={onVerMas}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Ver {Math.min(5, actividades.length - limite)} más
        </button>
      )}
    </div>
  );
}

// ── Panel de filtros ──────────────────────────────────────────────────────

const TIPOS_OPCIONES = [
  { valor: "LLAMADA", label: "Llamada" },
  { valor: "EMAIL", label: "Email" },
  { valor: "REUNION", label: "Reunión" },
  { valor: "TAREA", label: "Tarea" },
  { valor: "NOTA", label: "Nota" },
] as const;

const PRIORIDAD_OPCIONES = [
  { valor: "ALTA", label: "Alta" },
  { valor: "MEDIA", label: "Media" },
  { valor: "BAJA", label: "Baja" },
] as const;

// ── Componente principal ───────────────────────────────────────────────────

interface DashboardActividadesProps {
  actividades: Actividad[];
}

const LIMITE_INICIAL = 5;
const PASO_LIMITE = 5;

export function DashboardActividades({ actividades }: DashboardActividadesProps) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("actividades");
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoActividad | "">("");
  const [filtroPrioridad, setFiltroPrioridad] = useState<PrioridadActividad | "">("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [limiteVencidas, setLimiteVencidas] = useState(LIMITE_INICIAL);
  const [limiteHoy, setLimiteHoy] = useState(LIMITE_INICIAL);
  const [limiteProximas, setLimiteProximas] = useState(LIMITE_INICIAL);
  const [, startTransition] = useTransition();

  const hoy = startOfDay(new Date());

  // KPIs siempre de todos los datos sin filtrar
  const kpis = useMemo(() => {
    const pendientes = actividades.filter(a => !a.completada);
    return {
      pendientes: pendientes.length,
      vencidas: pendientes.filter(a => isPast(new Date(a.fecha)) && !isToday(new Date(a.fecha))).length,
      paraHoy: pendientes.filter(a => isToday(new Date(a.fecha))).length,
      proximas: pendientes.filter(a => new Date(a.fecha) >= new Date(hoy.getTime() + 86400000)).length,
      completadas: actividades.filter(a => a.completada).length,
    };
  }, [actividades, hoy]);

  // Actividades filtradas por búsqueda + filtros
  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return actividades.filter(a => {
      if (filtroTipo && a.tipo !== filtroTipo) return false;
      if (filtroPrioridad && a.prioridad !== filtroPrioridad) return false;
      if (q) {
        const hayMatch =
          a.titulo.toLowerCase().includes(q) ||
          (a.descripcion?.toLowerCase().includes(q) ?? false) ||
          (a.contacto ? `${a.contacto.nombre} ${a.contacto.apellido}`.toLowerCase().includes(q) : false) ||
          (a.empresa?.nombre.toLowerCase().includes(q) ?? false) ||
          (a.oportunidad?.titulo.toLowerCase().includes(q) ?? false) ||
          (a.pedido?.numero.toLowerCase().includes(q) ?? false) ||
          (a.cotizacion?.numero.toLowerCase().includes(q) ?? false);
        if (!hayMatch) return false;
      }
      return true;
    });
  }, [actividades, busqueda, filtroTipo, filtroPrioridad]);

  const { vencidas, hoyActividades, proximas, recientes } = useMemo(() => {
    const pendientes = filtradas.filter(a => !a.completada);
    const manana = new Date(hoy.getTime() + 86400000);
    return {
      vencidas: pendientes.filter(a => isPast(new Date(a.fecha)) && !isToday(new Date(a.fecha))).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
      hoyActividades: pendientes.filter(a => isToday(new Date(a.fecha))).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
      proximas: pendientes.filter(a => new Date(a.fecha) >= manana).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
      recientes: filtradas.filter(a => a.completada).sort((a, b) => new Date(b.completadaEn ?? b.creadoEn).getTime() - new Date(a.completadaEn ?? a.creadoEn).getTime()).slice(0, 5),
    };
  }, [filtradas, hoy]);

  const hayFiltrosActivos = !!(busqueda || filtroTipo || filtroPrioridad);
  const totalPendientesFiltrado = vencidas.length + hoyActividades.length + proximas.length;

  function handleCompletar(id: string) {
    startTransition(async () => {
      await completarActividad(id);
    });
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      await eliminarActividad(id);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar actividades..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9 h-9 bg-card border-border text-sm"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            className={cn("gap-1.5 h-9", mostrarFiltros && "bg-accent", hayFiltrosActivos && "border-lime-500/40 text-lime-500")}
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            {hayFiltrosActivos && <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-lime-500 text-[9px] font-bold text-black">{[busqueda, filtroTipo, filtroPrioridad].filter(Boolean).length}</span>}
          </Button>
          {puedeMod && (
            <ButtonLink href="/crm/actividades/nueva" className="h-9 gap-1.5">
              <Plus className="h-4 w-4" />
              Nueva actividad
            </ButtonLink>
          )}
        </div>
      </div>

      {/* Panel filtros */}
      {mostrarFiltros && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_OPCIONES.map(o => (
                <button key={o.valor} type="button"
                  onClick={() => setFiltroTipo(filtroTipo === o.valor ? "" : o.valor as TipoActividad)}
                  className={cn("px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
                    filtroTipo === o.valor ? "border-lime-500/40 bg-lime-500/10 text-lime-500" : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >{o.label}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Prioridad</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORIDAD_OPCIONES.map(o => (
                <button key={o.valor} type="button"
                  onClick={() => setFiltroPrioridad(filtroPrioridad === o.valor ? "" : o.valor as PrioridadActividad)}
                  className={cn("px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
                    filtroPrioridad === o.valor ? "border-lime-500/40 bg-lime-500/10 text-lime-500" : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >{o.label}</button>
              ))}
            </div>
          </div>
          {hayFiltrosActivos && (
            <button type="button"
              onClick={() => { setBusqueda(""); setFiltroTipo(""); setFiltroPrioridad(""); }}
              className="self-end px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Pendientes" valor={kpis.pendientes} descripcion="Actividades abiertas" icon={Calendar} color="#f59e0b" />
        <KpiCard label="Vencidas" valor={kpis.vencidas} descripcion="Requieren atención" icon={AlertCircle} color="#ef4444" />
        <KpiCard label="Para hoy" valor={kpis.paraHoy} descripcion="Vence hoy" icon={Sun} color="#f59e0b" />
        <KpiCard label="Próximas" valor={kpis.proximas} descripcion="Próximos 7 días" icon={Clock} color="#3b82f6" />
        <KpiCard label="Completadas" valor={kpis.completadas} descripcion="Últimos 30 días" icon={CheckCircle2} color="#84cc16" />
      </div>

      {/* Cuerpo principal */}
      {totalPendientesFiltrado === 0 && recientes.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-lime-500/50 mb-3" />
          <p className="text-sm font-semibold text-foreground">
            {hayFiltrosActivos ? "Sin resultados para esta búsqueda" : "Todo al día"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {hayFiltrosActivos ? "Intenta con otros filtros" : "No hay actividades pendientes."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Columna izquierda: pendientes */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <SeccionActividades
              titulo="Vencidas" color="#ef4444" icono={AlertCircle}
              actividades={vencidas} esVencida
              limite={limiteVencidas} onVerMas={() => setLimiteVencidas(l => l + PASO_LIMITE)}
              onCompletar={puedeMod ? handleCompletar : undefined} onEliminar={puedeMod ? handleEliminar : undefined}
            />
            <SeccionActividades
              titulo="Hoy" color="#f59e0b" icono={Sun}
              actividades={hoyActividades}
              limite={limiteHoy} onVerMas={() => setLimiteHoy(l => l + PASO_LIMITE)}
              onCompletar={puedeMod ? handleCompletar : undefined} onEliminar={puedeMod ? handleEliminar : undefined}
            />
            <SeccionActividades
              titulo="Próximas" color="#3b82f6" icono={Clock}
              actividades={proximas}
              limite={limiteProximas} onVerMas={() => setLimiteProximas(l => l + PASO_LIMITE)}
              onCompletar={puedeMod ? handleCompletar : undefined} onEliminar={puedeMod ? handleEliminar : undefined}
            />
            {totalPendientesFiltrado === 0 && (
              <div className="rounded-xl border border-dashed border-border py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-lime-500/50 mb-2" />
                <p className="text-sm text-muted-foreground">Sin actividades pendientes</p>
              </div>
            )}
          </div>

          {/* Columna derecha: completadas recientes */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card overflow-hidden sticky top-4">
              <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
                <CheckCircle2 className="h-4 w-4 text-lime-500" />
                <h3 className="text-sm font-semibold text-lime-500">Completadas recientemente</h3>
              </div>
              <div className="px-4 py-2">
                {recientes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Sin actividades completadas</p>
                ) : (
                  recientes.map(a => <CardCompletada key={a.id} actividad={a} />)
                )}
              </div>
              <div className="px-4 py-3 border-t border-border">
                <ButtonLink
                  href="/crm/actividades?historial=1"
                  variant="ghost"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground justify-center gap-1"
                >
                  Ver historial completo
                  <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tip */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <span className="text-lime-500">💡</span>
        Tip: Marca las actividades como completadas para mantener tu seguimiento al día.
      </p>
    </div>
  );
}
