"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Search, CheckCircle2, XCircle, Clock, Zap, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CATALOGO_INTEGRACIONES, CATEGORIAS } from "../catalog";
import {
  instalarIntegracion,
  activarIntegracion,
  desactivarIntegracion,
  desinstalarIntegracion,
} from "../actions";
import type { IntegracionConEstado, CategoriaIntegracion, EstadoIntegracion } from "../types";

// ── Badge de estado ───────────────────────────────────────────────

const ESTADO_CONFIG: Record<
  EstadoIntegracion,
  { label: string; className: string; Icono: React.ElementType }
> = {
  ACTIVA:    { label: "Activa",     className: "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400", Icono: CheckCircle2 },
  INSTALADA: { label: "Instalada",  className: "bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400",          Icono: Zap },
  INACTIVA:  { label: "Inactiva",   className: "bg-stone-500/10 border-stone-500/25 text-stone-500 dark:text-stone-400",      Icono: XCircle },
  ERROR:     { label: "Error",      className: "bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400",              Icono: XCircle },
};

function BadgeEstado({ estado }: { estado: EstadoIntegracion }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
      cfg.className
    )}>
      <cfg.Icono className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

// ── Card de integración ───────────────────────────────────────────

function CardIntegracion({ integracion }: { integracion: IntegracionConEstado }) {
  const [isPending, startTransition] = useTransition();
  const instalada = integracion.instalada;

  const handleInstalar = () => {
    startTransition(async () => {
      const r = await instalarIntegracion(integracion.clave);
      if (r.exito) toast.success(`${integracion.nombre} instalado`);
      else toast.error(r.error);
    });
  };

  const handleActivar = () => {
    if (!instalada) return;
    startTransition(async () => {
      const r = await activarIntegracion(instalada.id);
      if (r.exito) toast.success(`${integracion.nombre} activado`);
      else toast.error(r.error);
    });
  };

  const handleDesactivar = () => {
    if (!instalada) return;
    startTransition(async () => {
      const r = await desactivarIntegracion(instalada.id);
      if (r.exito) toast.success(`${integracion.nombre} desactivado`);
      else toast.error(r.error);
    });
  };

  const handleDesinstalar = () => {
    if (!instalada) return;
    if (!confirm(`¿Desinstalar ${integracion.nombre}? Se perderá la configuración guardada.`)) return;
    startTransition(async () => {
      const r = await desinstalarIntegracion(instalada.id);
      if (r.exito) toast.success(`${integracion.nombre} desinstalado`);
      else toast.error(r.error);
    });
  };

  const deshabilitada = !integracion.disponible || integracion.proximamente;

  return (
    <div className={cn(
      "group flex flex-col rounded-2xl border p-5 transition-all duration-200",
      deshabilitada
        ? "bg-stone-50/60 dark:bg-white/2 border-stone-100 dark:border-white/5 opacity-70"
        : "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="h-11 w-11 rounded-xl bg-stone-100 dark:bg-white/8 border border-stone-200 dark:border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
          {integracion.logoEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-50 leading-tight">
              {integracion.nombre}
            </h3>
            {integracion.badges?.map((b) => (
              <span key={b} className="inline-flex items-center rounded-md bg-lime-500/10 border border-lime-500/20 px-1.5 py-0.5 text-[10px] font-bold text-lime-700 dark:text-lime-400">
                {b}
              </span>
            ))}
            {integracion.proximamente && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <Clock className="h-2.5 w-2.5" /> Próximamente
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 capitalize mt-0.5">
            {integracion.categoria}
          </p>
        </div>
        {instalada && <BadgeEstado estado={instalada.estado} />}
      </div>

      {/* Descripción */}
      <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed flex-1 mb-4">
        {integracion.descripcion}
      </p>

      {/* Acciones */}
      <div className="flex items-center gap-2 pt-3 border-t border-stone-100 dark:border-white/8">
        {!instalada ? (
          <button
            disabled={deshabilitada || isPending}
            onClick={handleInstalar}
            className={cn(
              "flex-1 py-2 rounded-xl text-xs font-semibold transition-all",
              deshabilitada
                ? "bg-stone-100 dark:bg-white/5 text-stone-400 dark:text-stone-600 cursor-not-allowed"
                : "bg-lime-500/90 hover:bg-lime-400 text-stone-950 shadow-sm hover:shadow-md hover:scale-[1.01]"
            )}
          >
            {isPending ? "Instalando…" : deshabilitada ? "No disponible" : "Instalar"}
          </button>
        ) : (
          <>
            {instalada.estado !== "ACTIVA" ? (
              <button
                disabled={isPending}
                onClick={handleActivar}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-500/90 hover:bg-emerald-400 text-white shadow-sm transition-all hover:scale-[1.01]"
              >
                {isPending ? "Activando…" : "Activar"}
              </button>
            ) : (
              <button
                disabled={isPending}
                onClick={handleDesactivar}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5 transition-all"
              >
                {isPending ? "Desactivando…" : "Desactivar"}
              </button>
            )}
            {instalada.estado === "ACTIVA" && integracion.clave === "whatsapp_lite" && (
              <Link
                href="/integraciones/whatsapp-lite"
                className="py-2 px-3 rounded-xl text-xs font-semibold border border-lime-500/25 text-lime-700 dark:text-lime-400 hover:bg-lime-500/8 transition-all flex items-center gap-1.5"
              >
                <Settings2 className="h-3 w-3" />
                Configurar
              </Link>
            )}
            <button
              disabled={isPending}
              onClick={handleDesinstalar}
              className="py-2 px-3 rounded-xl text-xs font-semibold border border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-500/8 transition-all"
            >
              Desinstalar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Lista principal ───────────────────────────────────────────────

interface ListaIntegracionesProps {
  integraciones: IntegracionConEstado[];
}

export function ListaIntegraciones({ integraciones }: ListaIntegracionesProps) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string>("todas");

  const filtradas = integraciones.filter((i) => {
    const coincideBusqueda =
      !busqueda ||
      i.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.descripcion.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = categoria === "todas" || i.categoria === categoria;
    return coincideBusqueda && coincideCategoria;
  });

  const instaladas = filtradas.filter((i) => !!i.instalada);
  const disponibles = filtradas.filter((i) => !i.instalada && !i.proximamente);
  const proximamente = filtradas.filter((i) => !i.instalada && i.proximamente);

  return (
    <div className="flex flex-col gap-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar integración…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIAS.map((cat) => (
            <button
              key={cat.valor}
              onClick={() => setCategoria(cat.valor)}
              className={cn(
                "h-9 px-3 rounded-xl text-xs font-medium border transition-all",
                categoria === cat.valor
                  ? "bg-lime-500/10 border-lime-500/25 text-lime-700 dark:text-lime-400"
                  : "border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5"
              )}
            >
              {cat.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* Instaladas */}
      {instaladas.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-3">
            Instaladas · {instaladas.length}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {instaladas.map((i) => <CardIntegracion key={i.clave} integracion={i} />)}
          </div>
        </section>
      )}

      {/* Disponibles */}
      {disponibles.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-3">
            Disponibles · {disponibles.length}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {disponibles.map((i) => <CardIntegracion key={i.clave} integracion={i} />)}
          </div>
        </section>
      )}

      {/* Próximamente */}
      {proximamente.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-3">
            Próximamente · {proximamente.length}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {proximamente.map((i) => <CardIntegracion key={i.clave} integracion={i} />)}
          </div>
        </section>
      )}

      {filtradas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
            No se encontraron integraciones
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">
            Prueba con otro término de búsqueda o categoría
          </p>
        </div>
      )}
    </div>
  );
}
