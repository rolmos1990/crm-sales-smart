"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Pencil, Copy, Trash2, Power, PowerOff, ChevronDown, ChevronRight,
  ShieldCheck, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { cn } from "@/lib/utils";
import { duplicarRegla, eliminarRegla, obtenerCatalogoCamposAction, toggleRegla } from "../actions";
import type { FlujoVentaEtapa, FlujoVentaRegla } from "../types";
import { SheetReglaValidacion } from "./sheet-regla-validacion";
import { generarResumenNatural } from "./resumen-regla";
import type { CampoReglaCliente } from "./constructor-condiciones";
import { construirArbolDesdeRegla } from "../reglas/evaluador";
import type { GroupNode } from "../reglas/tipos";

// ── Tarjeta de una regla dentro del acordeón de su etapa ────────────────────

function TarjetaRegla({
  regla, campos, onEditar, onDuplicar, onToggle, onEliminar,
}: {
  regla: FlujoVentaRegla;
  campos: CampoReglaCliente[];
  onEditar: () => void;
  onDuplicar: () => void;
  onToggle: (activo: boolean) => void;
  onEliminar: () => void;
}) {
  const arbol = construirArbolDesdeRegla(regla) as GroupNode;
  const resumen = generarResumenNatural(arbol, campos);

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-2.5 transition-all",
        regla.activo
          ? "bg-white dark:bg-white/5 border-stone-200 dark:border-white/10"
          : "bg-stone-50/50 dark:bg-white/2 border-stone-200/60 dark:border-white/5 opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">{regla.nombre}</span>
            {regla.estado === "BORRADOR" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-400/40 text-amber-600 dark:text-amber-400">
                Borrador
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500">
              Prioridad {regla.prioridad}
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">{resumen}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onToggle(!regla.activo)}
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded-lg transition-colors",
              regla.activo ? "text-emerald-500 hover:bg-emerald-500/8" : "text-stone-400 hover:bg-stone-100 dark:hover:bg-white/8"
            )}
            title={regla.activo ? "Desactivar" : "Activar"}
          >
            {regla.activo ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onEditar}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDuplicar}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
            title="Duplicar"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onEliminar}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-500/8 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Acordeón por etapa ───────────────────────────────────────────────────────

function AcordeonEtapa({
  etapa, reglas, campos, onAgregar, onEditar, onDuplicar, onToggle, onEliminar,
}: {
  etapa: FlujoVentaEtapa;
  reglas: FlujoVentaRegla[];
  campos: CampoReglaCliente[];
  onAgregar: () => void;
  onEditar: (r: FlujoVentaRegla) => void;
  onDuplicar: (r: FlujoVentaRegla) => void;
  onToggle: (r: FlujoVentaRegla, activo: boolean) => void;
  onEliminar: (r: FlujoVentaRegla) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  const color = etapa.color ?? "#818cf8";

  return (
    <div className="rounded-xl border border-stone-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-stone-50/80 dark:bg-white/3 hover:bg-stone-100/80 dark:hover:bg-white/5 transition-colors"
      >
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 flex-1 text-left">{etapa.nombre}</span>
        {reglas.length > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md bg-stone-200 dark:bg-white/10 text-xs font-bold text-stone-600 dark:text-stone-400">
            {reglas.length}
          </span>
        )}
        {abierto ? <ChevronDown className="h-4 w-4 text-stone-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-stone-400 flex-shrink-0" />}
      </button>

      {abierto && (
        <div className="px-3 pb-3 pt-2 space-y-1.5 bg-white dark:bg-transparent">
          {reglas.length === 0 ? (
            <p className="text-xs text-stone-400 dark:text-stone-600 py-2 text-center">Sin reglas para este estado</p>
          ) : (
            [...reglas].sort((a, b) => a.prioridad - b.prioridad).map((regla) => (
              <TarjetaRegla
                key={regla.id}
                regla={regla}
                campos={campos}
                onEditar={() => onEditar(regla)}
                onDuplicar={() => onDuplicar(regla)}
                onToggle={(activo) => onToggle(regla, activo)}
                onEliminar={() => onEliminar(regla)}
              />
            ))
          )}
          <button
            onClick={onAgregar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-stone-300 dark:border-white/12 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:border-stone-400 dark:hover:border-white/20 hover:bg-stone-50 dark:hover:bg-white/3 transition-all text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar regla
          </button>
        </div>
      )}
    </div>
  );
}

// ── Panel principal ─────────────────────────────────────────────────────────

interface PanelConfigReglasProps {
  etapas: FlujoVentaEtapa[];
  reglasIniciales: FlujoVentaRegla[];
}

export function PanelConfigReglas({ etapas, reglasIniciales }: PanelConfigReglasProps) {
  const router = useRouter();
  const [reglas, setReglas] = useState<FlujoVentaRegla[]>(reglasIniciales);
  const [campos, setCampos] = useState<CampoReglaCliente[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);

  const [etapaSheet, setEtapaSheet] = useState<FlujoVentaEtapa | null>(null);
  const [reglaEditando, setReglaEditando] = useState<FlujoVentaRegla | null>(null);
  const [sheetAbierto, setSheetAbierto] = useState(false);
  // Confirmación de borrado en dos niveles: "publicada" siempre se pregunta
  // antes de borrar una regla Publicada (esté o no usada); si el servidor
  // avisa que además quedó auditada (se usó para evaluar algún pedido), se
  // escala a "usada" — una segunda confirmación más fuerte, porque ahí sí se
  // pierde historial.
  const [confirmarEliminar, setConfirmarEliminar] = useState<{ regla: FlujoVentaRegla; nivel: "publicada" | "usada" } | null>(null);

  useEffect(() => {
    obtenerCatalogoCamposAction()
      .then((c) => setCampos(c as CampoReglaCliente[]))
      .finally(() => setCargandoCatalogo(false));
  }, []);

  // Sincroniza cuando router.refresh() trae reglas frescas del servidor (tras
  // crear/editar) — sin esto, el estado local seguiría mostrando los datos
  // con los que se montó el componente la primera vez.
  useEffect(() => {
    setReglas(reglasIniciales);
  }, [reglasIniciales]);

  const abrirNueva = (etapa: FlujoVentaEtapa) => {
    setEtapaSheet(etapa);
    setReglaEditando(null);
    setSheetAbierto(true);
  };

  const abrirEditar = (etapa: FlujoVentaEtapa, regla: FlujoVentaRegla) => {
    setEtapaSheet(etapa);
    setReglaEditando(regla);
    setSheetAbierto(true);
  };

  const refrescar = () => {
    // Los Server Actions ya llaman a revalidatePath — router.refresh() vuelve
    // a pedirle al Server Component los datos (sin perder scroll/estado de
    // navegación) y el efecto de arriba sincroniza `reglas` con la lista
    // fresca en cuanto llega, trayendo la regla recién creada/editada.
    router.refresh();
  };

  const handleToggle = (regla: FlujoVentaRegla, activo: boolean) => {
    setReglas((prev) => prev.map((r) => r.id === regla.id ? { ...r, activo } : r));
    toggleRegla(regla.id, activo).then((r) => {
      if (!r.exito) {
        toast.error(r.error);
        setReglas((prev) => prev.map((r2) => r2.id === regla.id ? { ...r2, activo: !activo } : r2));
      }
    });
  };

  const handleDuplicar = (regla: FlujoVentaRegla) => {
    duplicarRegla(regla.id).then((r) => {
      if (r.exito) { toast.success("Regla duplicada como borrador"); refrescar(); }
      else toast.error(r.error);
    });
  };

  const ejecutarEliminar = async (regla: FlujoVentaRegla, forzar: boolean) => {
    const r = await eliminarRegla(regla.id, forzar);
    if (r.exito) {
      toast.success("Regla eliminada");
      setReglas((prev) => prev.filter((x) => x.id !== regla.id));
      setConfirmarEliminar(null);
      return;
    }
    if (r.error === "USADA") {
      // El servidor rechazó el borrado directo porque la regla quedó
      // auditada — se escala a la confirmación fuerte en vez de la genérica.
      setConfirmarEliminar({ regla, nivel: "usada" });
      return;
    }
    toast.error(r.error);
    setConfirmarEliminar(null);
  };

  const handleEliminarClick = (regla: FlujoVentaRegla) => {
    if (regla.estado === "PUBLICADA") {
      // Toda regla Publicada pide confirmación antes de borrarla, la haya
      // usado un pedido o no — perder un requisito que está en producción
      // sin avisar sería sorprendente.
      setConfirmarEliminar({ regla, nivel: "publicada" });
      return;
    }
    ejecutarEliminar(regla, false);
  };

  if (cargandoCatalogo) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-start gap-3 rounded-xl border border-lime-500/20 dark:border-lime-400/15 bg-lime-500/5 dark:bg-lime-400/5 px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-lime-600 dark:text-lime-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Una regla pertenece a un estado destino y define qué debe cumplir un pedido para obtenerlo —
          se evalúa <strong>sin importar el estado anterior</strong>, ya sea desde la pantalla del
          pedido, el pipeline, acciones rápidas o automatizaciones.
        </p>
      </div>

      <div className="space-y-2">
        {etapas.map((etapa) => (
          <AcordeonEtapa
            key={etapa.id}
            etapa={etapa}
            reglas={reglas.filter((r) => r.etapaDestinoId === etapa.id)}
            campos={campos}
            onAgregar={() => abrirNueva(etapa)}
            onEditar={(r) => abrirEditar(etapa, r)}
            onDuplicar={handleDuplicar}
            onToggle={handleToggle}
            onEliminar={handleEliminarClick}
          />
        ))}
      </div>

      {etapaSheet && (
        <SheetReglaValidacion
          key={reglaEditando?.id ?? "nueva"}
          etapa={etapaSheet}
          regla={reglaEditando}
          campos={campos}
          open={sheetAbierto}
          onOpenChange={(v) => { setSheetAbierto(v); if (!v) { setEtapaSheet(null); setReglaEditando(null); } }}
          onGuardado={refrescar}
        />
      )}

      {confirmarEliminar?.nivel === "publicada" && (
        <ConfirmacionDialog
          open onOpenChange={(v) => { if (!v) setConfirmarEliminar(null); }}
          titulo="¿Eliminar esta regla publicada?"
          descripcion={
            <>
              La regla &quot;{confirmarEliminar.regla.nombre}&quot; está publicada y activa — mientras exista
              puede estar bloqueando (o permitiendo) el paso de pedidos a &quot;{etapas.find((e) => e.id === confirmarEliminar.regla.etapaDestinoId)?.nombre}&quot;.
              Esta acción no se puede deshacer.
            </>
          }
          variante="destructive"
          textoConfirmar="Eliminar regla"
          onConfirmar={() => ejecutarEliminar(confirmarEliminar.regla, false)}
        />
      )}

      {confirmarEliminar?.nivel === "usada" && (
        <ConfirmacionDialog
          open onOpenChange={(v) => { if (!v) setConfirmarEliminar(null); }}
          titulo="Esta regla ya quedó registrada en la auditoría"
          descripcion={
            <>
              La regla &quot;{confirmarEliminar.regla.nombre}&quot; se usó para evaluar o rechazar algún
              pedido — eliminarla borra ese historial. Si preferís conservarlo, desactivala en su lugar
              con el botón de encendido/apagado en vez de borrarla.
            </>
          }
          variante="destructive"
          textoConfirmar="Eliminar de todas formas"
          onConfirmar={() => ejecutarEliminar(confirmarEliminar.regla, true)}
        />
      )}
    </div>
  );
}
