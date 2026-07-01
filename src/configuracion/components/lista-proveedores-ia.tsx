"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Zap, Trash2, ToggleLeft, ToggleRight, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormProveedorIA } from "./form-proveedor-ia";
import { toggleProveedorIA, eliminarProveedorIA } from "@/configuracion/ia/actions";

interface ProveedorIARow {
  id: string;
  proveedor: string;
  activo: boolean;
  prioridad: number;
  modelosDisponibles: unknown;
  timeoutMs: number;
  reintentosMax: number;
  limitePorMinuto: number | null;
  limitePorDia: number | null;
  baseUrl: string | null;
  creadoEn: Date;
}

interface ListaProveedoresIAProps {
  proveedores: ProveedorIARow[];
}

const PROVEEDOR_COLORES: Record<string, string> = {
  ANTHROPIC: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  OPENAI: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  GEMINI: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  DEEPSEEK: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  LOCAL: "text-stone-400 border-stone-400/30 bg-stone-400/10",
};

export function ListaProveedoresIA({ proveedores: inicial }: ListaProveedoresIAProps) {
  const [proveedores, setProveedores] = useState(inicial);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleExito() {
    setDialogAbierto(false);
    // El revalidatePath del server action actualiza la lista en el siguiente render
    window.location.reload();
  }

  function handleToggle(id: string, activoActual: boolean) {
    startTransition(async () => {
      const resultado = await toggleProveedorIA(id, !activoActual);
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al actualizar");
        return;
      }
      setProveedores((prev) =>
        prev.map((p) => (p.id === id ? { ...p, activo: !activoActual } : p)),
      );
      toast.success(activoActual ? "Proveedor desactivado" : "Proveedor activado");
    });
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      const resultado = await eliminarProveedorIA(id);
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al eliminar");
        return;
      }
      setProveedores((prev) => prev.filter((p) => p.id !== id));
      toast.success("Proveedor eliminado");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-50">Proveedores configurados</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Los proveedores se usan en orden de prioridad (mayor número = mayor prioridad)
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogAbierto(true)}
          className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Agregar
        </Button>
      </div>

      {proveedores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/3 p-8 text-center">
          <Zap className="h-8 w-8 text-stone-600 mx-auto mb-2" />
          <p className="text-sm text-stone-400">Sin proveedores configurados</p>
          <p className="text-xs text-stone-500 mt-1">Agrega un proveedor para empezar a usar IA</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {proveedores.map((p) => {
            const modelos = Array.isArray(p.modelosDisponibles) ? p.modelosDisponibles as string[] : [];
            const colorClase = PROVEEDOR_COLORES[p.proveedor] ?? PROVEEDOR_COLORES["LOCAL"];

            return (
              <div
                key={p.id}
                className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-2 w-36">
                  <Badge variant="outline" className={`text-xs font-mono ${colorClase}`}>
                    {p.proveedor}
                  </Badge>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-400 truncate">
                    {modelos.slice(0, 2).join(", ")}
                    {modelos.length > 2 && ` +${modelos.length - 2}`}
                  </p>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Timeout {p.timeoutMs / 1000}s · {p.reintentosMax} reintentos
                    {p.limitePorDia ? ` · ${p.limitePorDia.toLocaleString()} tokens/día` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-xs text-stone-500">
                  <ChevronUp className="h-3 w-3" />
                  <span>{p.prioridad}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => handleToggle(p.id, p.activo)}
                    className="h-8 w-8 text-stone-400 hover:text-stone-50 hover:bg-white/10"
                    title={p.activo ? "Desactivar" : "Activar"}
                  >
                    {p.activo ? (
                      <ToggleRight className="h-4 w-4 text-lime-400" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => handleEliminar(p.id)}
                    className="h-8 w-8 text-stone-500 hover:text-red-400 hover:bg-red-400/10"
                    title="Eliminar proveedor"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FormProveedorIA
        abierto={dialogAbierto}
        onCerrar={() => setDialogAbierto(false)}
        onExito={handleExito}
      />
    </div>
  );
}
