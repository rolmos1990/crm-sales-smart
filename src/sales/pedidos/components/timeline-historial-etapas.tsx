"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronDown, ChevronUp, Filter,
  FileText, Clock, RefreshCw, CheckCircle2, Truck,
  CheckCircle, XCircle, Package, Settings, User, Webhook, Radio,
  Monitor, Plus, Trash2, Hash, Percent, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { METODO_ENTREGA_LABELS as METODO_LABELS } from "../constantes";

// ── Tipos ───────────────────────────────────────────────────────────────

export interface EventoHistorial {
  id: string;
  etapaNombre: string;
  etapaAnteriorNombre: string | null;
  tipo: "MANUAL" | "AUTOMATICO";
  origen: string;
  notas: string | null;
  referencia: string | null;
  usuarioId: string | null;
  usuarioNombre: string | null;
  creadoEn: Date | string;
  etapa: { color: string | null } | null;
}

export interface EventoCambio {
  id: string;
  accion: string;
  valorAnterior: unknown;
  valorNuevo: unknown;
  usuarioId: string | null;
  usuarioNombre: string | null;
  creadoEn: Date | string;
}

interface TimelineHistorialEtapasProps {
  historial: EventoHistorial[];
  historialCambios?: EventoCambio[];
}

type EntradaTimeline =
  | { tipo: "ETAPA"; data: EventoHistorial }
  | { tipo: "CAMBIO"; data: EventoCambio };

// ── Helpers de iconos y etiquetas ────────────────────────────────────────

function iconoEtapa(nombre: string) {
  const n = nombre.toLowerCase();
  if (n.includes("cread") || n.includes("genera")) return FileText;
  if (n.includes("pendiente") || n.includes("espera")) return Clock;
  if (n.includes("proceso") || n.includes("preparac")) return RefreshCw;
  if (n.includes("pagad") || n.includes("cobrad")) return CheckCircle2;
  if (n.includes("enviad") || n.includes("despacha")) return Truck;
  if (n.includes("finaliz") || n.includes("entregad") || n.includes("completad")) return CheckCircle;
  if (n.includes("cancel")) return XCircle;
  return Package;
}

const ACCION_CONFIG: Record<string, { label: string; icon: typeof Plus; color: string; bg: string }> = {
  PEDIDO_CREADO:        { label: "Pedido creado",           icon: FileText, color: "#16a34a", bg: "#16a34a22" },
  PRODUCTO_AGREGADO:    { label: "Producto agregado",        icon: Plus,     color: "#16a34a", bg: "#16a34a22" },
  PRODUCTO_ELIMINADO:   { label: "Producto eliminado",       icon: Trash2,   color: "#dc2626", bg: "#dc262622" },
  CANTIDAD_MODIFICADA:  { label: "Cantidad modificada",      icon: Hash,     color: "#2563eb", bg: "#2563eb22" },
  DESCUENTO_ACTUALIZADO:{ label: "Descuento actualizado",    icon: Percent,  color: "#ea580c", bg: "#ea580c22" },
  PEDIDO_EDITADO:       { label: "Datos del pedido editados",icon: Pencil,   color: "#6b7280", bg: "#6b728022" },
  ENTREGA_REGISTRADA:   { label: "Entrega registrada",       icon: Truck,    color: "#65a30d", bg: "#65a30d22" },
  ENTREGA_ACTUALIZADA:  { label: "Entrega actualizada",      icon: Truck,    color: "#2563eb", bg: "#2563eb22" },
};

const ORIGEN_CONFIG: Record<string, { label: string; icon: typeof Settings; clase: string }> = {
  USUARIO:     { label: "Manual",       icon: User,     clase: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  SISTEMA:     { label: "Automático",   icon: Settings, clase: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  WEBHOOK:     { label: "Webhook",      icon: Webhook,  clase: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  INTEGRACION: { label: "Integración",  icon: Radio,    clase: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" },
};

function BadgeOrigen({ origen, tipo }: { origen: string; tipo: "MANUAL" | "AUTOMATICO" }) {
  const key = origen in ORIGEN_CONFIG ? origen : (tipo === "MANUAL" ? "USUARIO" : "SISTEMA");
  const cfg = ORIGEN_CONFIG[key]!;
  const Icono = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border", cfg.clase)}>
      <Icono className="h-3 w-3" />
      {tipo === "AUTOMATICO" && origen === "SISTEMA" ? "Automático" : cfg.label}
    </span>
  );
}

function InicialAvatar({ nombre }: { nombre: string }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-[10px] font-semibold text-stone-100 flex-shrink-0">
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}

function AutorFecha({ usuarioNombre, creadoEn }: { usuarioNombre: string | null; creadoEn: Date | string }) {
  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {usuarioNombre ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <InicialAvatar nombre={usuarioNombre} />
          {usuarioNombre}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Monitor className="h-3 w-3" />
          Sistema
        </span>
      )}
      <span className="text-xs text-muted-foreground">·</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {format(new Date(creadoEn), "dd MMM yyyy · HH:mm", { locale: es })}
      </span>
    </div>
  );
}

// ── Formatear diffs de manera legible ────────────────────────────────────

function formatearValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v || "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function DiffExpandido({ accion, valorAnterior, valorNuevo }: { accion: string; valorAnterior: unknown; valorNuevo: unknown }) {
  const ant = (valorAnterior ?? {}) as Record<string, unknown>;
  const nvo = (valorNuevo ?? {}) as Record<string, unknown>;

  if (accion === "PEDIDO_CREADO") {
    return (
      <div className="grid grid-cols-2 gap-4 text-sm">
        {!!nvo.numero && <div><span className="text-muted-foreground">Número: </span><span className="font-mono">{String(nvo.numero)}</span></div>}
        {nvo.total !== undefined && <div><span className="text-muted-foreground">Total: </span><span className="font-medium">S/ {Number(nvo.total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span></div>}
      </div>
    );
  }

  if (accion === "PRODUCTO_AGREGADO") {
    return (
      <div className="text-sm space-y-0.5">
        {!!nvo.descripcion && <p><span className="text-muted-foreground">Producto: </span>{String(nvo.descripcion)}</p>}
        <p><span className="text-muted-foreground">Cantidad: </span>{formatearValor(nvo.cantidad)} · <span className="text-muted-foreground">Precio: </span>S/ {formatearValor(nvo.precioUnitario)} · <span className="text-muted-foreground">Desc: </span>{formatearValor(nvo.descuento)}%</p>
      </div>
    );
  }

  if (accion === "PRODUCTO_ELIMINADO") {
    return (
      <div className="text-sm space-y-0.5">
        {!!ant.descripcion && <p><span className="text-muted-foreground">Producto: </span>{String(ant.descripcion)}</p>}
        <p><span className="text-muted-foreground">Cantidad era: </span>{formatearValor(ant.cantidad)} · <span className="text-muted-foreground">Precio era: </span>S/ {formatearValor(ant.precioUnitario)}</p>
      </div>
    );
  }

  if (accion === "CANTIDAD_MODIFICADA") {
    return (
      <p className="text-sm">
        <span className="text-muted-foreground">Cantidad: </span>
        <span className="line-through text-muted-foreground">{formatearValor(ant.cantidad)}</span>
        {" → "}
        <span className="font-medium">{formatearValor(nvo.cantidad)}</span>
      </p>
    );
  }

  if (accion === "DESCUENTO_ACTUALIZADO") {
    return (
      <p className="text-sm">
        <span className="text-muted-foreground">Descuento: </span>
        <span className="line-through text-muted-foreground">{formatearValor(ant.descuento)}%</span>
        {" → "}
        <span className="font-medium">{formatearValor(nvo.descuento)}%</span>
      </p>
    );
  }

  if (accion === "PEDIDO_EDITADO") {
    const ETIQUETAS: Record<string, string> = {
      nombre: "Nombre", apellido: "Apellido", telefono: "Teléfono", email: "Email",
      ruc: "RUC", empresaNombre: "Empresa (facturación)", moneda: "Moneda",
      fechaEntrega: "Fecha de entrega", notas: "Notas",
      contactoId: "Contacto", empresaId: "Empresa (CRM)", estado: "Estado",
    };
    const KEYS_LINEA = new Set(["lineasEliminadas", "lineasAgregadas", "lineasModificadas"]);
    type LineaData = { descripcion?: string; productoId?: string; cantidad?: number; precioUnitario?: number; descuento?: number };
    type ModifMap = Record<string, { cantidad?: number; descuento?: number }>;

    const eliminadas = (ant.lineasEliminadas ?? []) as LineaData[];
    const agregadas = (nvo.lineasAgregadas ?? []) as LineaData[];
    const modifAnt = (ant.lineasModificadas ?? {}) as ModifMap;
    const modifNvo = (nvo.lineasModificadas ?? {}) as ModifMap;
    const camposEscalares = [...new Set([...Object.keys(ant), ...Object.keys(nvo)])].filter(k => !KEYS_LINEA.has(k));

    const hayAlgo = eliminadas.length > 0 || agregadas.length > 0 || Object.keys(modifAnt).length > 0 || camposEscalares.length > 0;
    if (!hayAlgo) return <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>;

    const Fila = ({ label, children }: { label: string; children: React.ReactNode }) => (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
        {children}
      </div>
    );

    return (
      <div className="space-y-3 text-sm">
        {eliminadas.map((l, i) => (
          <Fila key={`eli-${i}`} label="Producto eliminado">
            <p className="text-muted-foreground line-through">
              {l.descripcion || l.productoId || "—"} · {l.cantidad} u · S/ {l.precioUnitario}
              {l.descuento ? ` · ${l.descuento}% desc.` : ""}
            </p>
          </Fila>
        ))}
        {agregadas.map((l, i) => (
          <Fila key={`agr-${i}`} label="Producto agregado">
            <p className="font-medium">
              {l.descripcion || l.productoId || "—"} · {l.cantidad} u · S/ {l.precioUnitario}
              {l.descuento ? ` · ${l.descuento}% desc.` : ""}
            </p>
          </Fila>
        ))}
        {Object.keys(modifAnt).map(lineaId => {
          const a = modifAnt[lineaId]!;
          const n = modifNvo[lineaId] ?? {};
          return (
            <div key={lineaId} className="space-y-1">
              {a.cantidad !== undefined && (
                <Fila label="Cantidad modificada">
                  <p className="flex items-center gap-1.5">
                    <span className="line-through text-muted-foreground">{a.cantidad}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{n.cantidad}</span>
                  </p>
                </Fila>
              )}
              {a.descuento !== undefined && (
                <Fila label="Descuento modificado">
                  <p className="flex items-center gap-1.5">
                    <span className="line-through text-muted-foreground">{a.descuento}%</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{n.descuento}%</span>
                  </p>
                </Fila>
              )}
            </div>
          );
        })}
        {camposEscalares.map(clave => (
          <Fila key={clave} label={ETIQUETAS[clave] ?? clave}>
            <p className="flex items-center gap-1.5 flex-wrap">
              <span className="line-through text-muted-foreground">{ant[clave] != null ? String(ant[clave]) : "—"}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{nvo[clave] != null ? String(nvo[clave]) : "—"}</span>
            </p>
          </Fila>
        ))}
      </div>
    );
  }

  if (accion === "ENTREGA_REGISTRADA" || accion === "ENTREGA_ACTUALIZADA") {
    const ESTADO_LABELS: Record<string, string> = {
      PENDIENTE:  "Pendiente",
      PREPARANDO: "Preparando",
      EN_CAMINO:  "En camino",
      ENTREGADO:  "Entregado",
      FALLIDO:    "Fallido",
      CANCELADO:  "Cancelado",
      DEVUELTO:   "Devuelto",
    };

    const resolvLabel = (val: unknown, mapa: Record<string, string>) =>
      val != null ? (mapa[String(val)] ?? String(val)) : "—";

    const CAMPOS: { clave: string; label: string; mapa?: Record<string, string> }[] = [
      { clave: "estadoEntrega",  label: "Estado",      mapa: ESTADO_LABELS },
      { clave: "metodoEntrega",  label: "Método",      mapa: METODO_LABELS },
      { clave: "transportista",  label: "Transportista" },
      { clave: "numeroGuia",     label: "N° de guía" },
      { clave: "fechaEstimada",  label: "Fecha estimada" },
      { clave: "costoEnvio",     label: "Costo de envío" },
    ];

    const Fila = ({ label, children }: { label: string; children: React.ReactNode }) => (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
        {children}
      </div>
    );

    if (accion === "ENTREGA_REGISTRADA") {
      const campos = CAMPOS.filter(c => nvo[c.clave] != null && nvo[c.clave] !== "");
      if (campos.length === 0) return null;
      return (
        <div className="space-y-2 text-sm">
          {campos.map(c => (
            <Fila key={c.clave} label={c.label}>
              <p className="font-medium">
                {c.clave === "fechaEstimada" && nvo[c.clave]
                  ? (() => { try { return new Date(String(nvo[c.clave])).toLocaleDateString("es-PE", { dateStyle: "medium" }); } catch { return String(nvo[c.clave]); } })()
                  : c.mapa ? resolvLabel(nvo[c.clave], c.mapa) : (nvo[c.clave] != null ? String(nvo[c.clave]) : "—")}
              </p>
            </Fila>
          ))}
        </div>
      );
    }

    // ENTREGA_ACTUALIZADA — mostrar solo los campos que cambiaron
    const camposModificados = CAMPOS.filter(c => {
      const aVal = ant[c.clave] ?? null;
      const nVal = nvo[c.clave] ?? null;
      return String(aVal) !== String(nVal);
    });
    if (camposModificados.length === 0) return <p className="text-sm text-muted-foreground">Sin cambios detectados.</p>;
    return (
      <div className="space-y-2 text-sm">
        {camposModificados.map(c => {
          const fmtFecha = (v: unknown) => {
            if (!v) return "—";
            try { return new Date(String(v)).toLocaleDateString("es-PE", { dateStyle: "medium" }); } catch { return String(v); }
          };
          const fmt = (v: unknown) => c.clave === "fechaEstimada" ? fmtFecha(v)
            : c.mapa ? resolvLabel(v, c.mapa) : (v != null ? String(v) : "—");
          return (
            <Fila key={c.clave} label={c.label}>
              <p className="flex items-center gap-1.5 flex-wrap">
                <span className="line-through text-muted-foreground">{fmt(ant[c.clave])}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{fmt(nvo[c.clave])}</span>
              </p>
            </Fila>
          );
        })}
      </div>
    );
  }

  return null;
}

// ── Item de ETAPA ────────────────────────────────────────────────────────

function EtapaItem({ evento, esUltimo, expandidoInicial }: { evento: EventoHistorial; esUltimo: boolean; expandidoInicial: boolean }) {
  const [expandido, setExpandido] = useState(expandidoInicial);
  const Icono = iconoEtapa(evento.etapaNombre);
  const color = evento.etapa?.color ?? "#6b7280";
  const tieneDetalles = !!(evento.etapaAnteriorNombre || evento.notas || evento.referencia);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm" style={{ backgroundColor: color }}>
          <Icono className="h-3.5 w-3.5 text-white" />
        </div>
        {!esUltimo && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      <div className={cn("flex-1 pb-5", esUltimo && "pb-0")}>
        <div className="rounded-xl border border-border bg-card transition-colors hover:border-stone-300 dark:hover:border-white/15">
          <div className="flex items-start justify-between gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => tieneDetalles && setExpandido(!expandido)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{evento.etapaNombre}</span>
                <BadgeOrigen origen={evento.origen} tipo={evento.tipo} />
              </div>
              <AutorFecha usuarioNombre={evento.usuarioNombre} creadoEn={evento.creadoEn} />
              {!expandido && evento.notas && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{evento.notas}</p>}
            </div>
            {tieneDetalles && (
              <button type="button" className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>

          {expandido && tieneDetalles && (
            <div className="border-t border-border px-4 py-3 space-y-3">
              {evento.notas && <p className="text-sm text-foreground/80 leading-relaxed">{evento.notas}</p>}
              {(evento.etapaAnteriorNombre || evento.referencia) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                  {evento.etapaAnteriorNombre && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Etapa anterior</p>
                      <p className="text-sm font-medium" style={{ color }}>{evento.etapaAnteriorNombre}</p>
                    </div>
                  )}
                  {evento.referencia && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Referencia</p>
                      <p className="text-sm font-mono text-foreground">{evento.referencia}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Origen</p>
                    <p className="text-sm text-foreground">
                      {evento.origen === "USUARIO" ? "Usuario" : evento.origen === "SISTEMA" ? "Sistema" : evento.origen === "WEBHOOK" ? "Webhook" : "Integración"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Item de CAMBIO ───────────────────────────────────────────────────────

function CambioItem({ evento, esUltimo, expandidoInicial }: { evento: EventoCambio; esUltimo: boolean; expandidoInicial: boolean }) {
  const [expandido, setExpandido] = useState(expandidoInicial);
  const cfg = ACCION_CONFIG[evento.accion] ?? { label: evento.accion, icon: Pencil, color: "#6b7280", bg: "#6b728022" };
  const Icono = cfg.icon;
  const tieneDetalles = evento.valorAnterior !== null || evento.valorNuevo !== null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm" style={{ backgroundColor: cfg.bg, borderColor: cfg.color + "44" }}>
          <Icono className="h-3.5 w-3.5" style={{ color: cfg.color }} />
        </div>
        {!esUltimo && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      <div className={cn("flex-1 pb-5", esUltimo && "pb-0")}>
        <div className="rounded-xl border border-border bg-card transition-colors hover:border-stone-300 dark:hover:border-white/15">
          <div className="flex items-start justify-between gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => tieneDetalles && setExpandido(!expandido)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{cfg.label}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20">
                  <Monitor className="h-3 w-3" />
                  Sistema
                </span>
              </div>
              <AutorFecha usuarioNombre={evento.usuarioNombre} creadoEn={evento.creadoEn} />
            </div>
            {tieneDetalles && (
              <button type="button" className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>

          {expandido && tieneDetalles && (
            <div className="border-t border-border px-4 py-3">
              <DiffExpandido accion={evento.accion} valorAnterior={evento.valorAnterior} valorNuevo={evento.valorNuevo} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

// ── Componente principal ─────────────────────────────────────────────────

export function TimelineHistorialEtapas({ historial, historialCambios = [] }: TimelineHistorialEtapasProps) {
  const [soloManuales, setSoloManuales] = useState(false);
  const [pagina, setPagina] = useState(1);

  const entradasUnificadas: EntradaTimeline[] = [
    ...historial.map(e => ({ tipo: "ETAPA" as const, data: e })),
    ...historialCambios.map(e => ({ tipo: "CAMBIO" as const, data: e })),
  ].sort((a, b) => new Date(b.data.creadoEn).getTime() - new Date(a.data.creadoEn).getTime());

  const filtradas = soloManuales
    ? entradasUnificadas.filter(e => e.tipo === "ETAPA" && (e.data.tipo === "MANUAL" || e.data.origen === "USUARIO"))
    : entradasUnificadas;

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * PAGE_SIZE;
  const visibles = filtradas.slice(inicio, inicio + PAGE_SIZE);

  const total = entradasUnificadas.length;
  const manuales = entradasUnificadas.filter(e => e.tipo === "ETAPA" && (e.data.tipo === "MANUAL" || e.data.origen === "USUARIO")).length;

  const handleFiltro = (valor: boolean) => {
    setSoloManuales(valor);
    setPagina(1);
  };

  // Genera el rango de números de página a mostrar (máx 5 botones)
  const paginasVisibles = (() => {
    const delta = 2;
    const izq = Math.max(1, paginaActual - delta);
    const der = Math.min(totalPaginas, paginaActual + delta);
    return Array.from({ length: der - izq + 1 }, (_, i) => izq + i);
  })();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Historial de etapas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtradas.length} {filtradas.length === 1 ? "evento" : "eventos"}
            {filtradas.length !== total && ` de ${total}`}
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          className={cn("gap-1.5 text-xs h-8 rounded-lg", soloManuales && "bg-stone-100 dark:bg-white/10 border-stone-300 dark:border-white/20")}
          onClick={() => handleFiltro(!soloManuales)}
          disabled={manuales === 0}
        >
          <Filter className="h-3.5 w-3.5" />
          {soloManuales ? `Manuales (${manuales})` : "Ver solo manuales"}
        </Button>
      </div>

      <div className="px-5 py-5">
        {filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay cambios manuales registrados.</p>
        ) : (
          <>
            {visibles.map((entrada, idx) =>
              entrada.tipo === "ETAPA" ? (
                <EtapaItem
                  key={`etapa-${entrada.data.id}`}
                  evento={entrada.data}
                  esUltimo={idx === visibles.length - 1}
                  expandidoInicial={idx === 0 && paginaActual === 1}
                />
              ) : (
                <CambioItem
                  key={`cambio-${entrada.data.id}`}
                  evento={entrada.data}
                  esUltimo={idx === visibles.length - 1}
                  expandidoInicial={idx === 0 && paginaActual === 1}
                />
              )
            )}

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {inicio + 1}–{Math.min(inicio + PAGE_SIZE, filtradas.length)} de {filtradas.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronUp className="h-3.5 w-3.5 -rotate-90" />
                  </button>

                  {paginasVisibles[0]! > 1 && (
                    <>
                      <button type="button" onClick={() => setPagina(1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        1
                      </button>
                      {paginasVisibles[0]! > 2 && <span className="px-0.5 text-xs text-muted-foreground">…</span>}
                    </>
                  )}

                  {paginasVisibles.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPagina(n)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition-colors",
                        n === paginaActual
                          ? "border-lime-500/40 bg-lime-500/10 text-lime-600 dark:text-lime-400 font-semibold"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}

                  {paginasVisibles[paginasVisibles.length - 1]! < totalPaginas && (
                    <>
                      {paginasVisibles[paginasVisibles.length - 1]! < totalPaginas - 1 && <span className="px-0.5 text-xs text-muted-foreground">…</span>}
                      <button type="button" onClick={() => setPagina(totalPaginas)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        {totalPaginas}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronUp className="h-3.5 w-3.5 rotate-90" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
