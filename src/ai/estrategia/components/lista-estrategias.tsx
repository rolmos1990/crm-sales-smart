"use client";

// 011-playbook-estrategia-comercial (Historia 1 y 3) — gestión de playbooks:
// activar/desactivar/duplicar/editar/priorizar, y crear uno nuevo desde cero.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Copy, Trash2, Plus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  crearEstrategia,
  editarEstrategia,
  activarEstrategia,
  desactivarEstrategia,
  duplicarEstrategia,
  eliminarEstrategia,
} from "@/ai/estrategia/actions";

interface EstrategiaRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  origen: "PLANTILLA" | "PERSONALIZADA";
  activo: boolean;
  contenido: unknown;
  condiciones: unknown;
  prioridad: number;
}

interface ListaEstrategiasProps {
  estrategiasIniciales: EstrategiaRow[];
}

function extraerReglas(contenido: unknown): string[] {
  if (contenido && typeof contenido === "object" && Array.isArray((contenido as { reglas?: unknown }).reglas)) {
    return (contenido as { reglas: string[] }).reglas;
  }
  return [];
}

export function ListaEstrategias({ estrategiasIniciales }: ListaEstrategiasProps) {
  const [estrategias, setEstrategias] = useState(estrategiasIniciales);
  const [editando, setEditando] = useState<EstrategiaRow | "nueva" | null>(null);
  const [isPending, startTransition] = useTransition();

  function actualizarLocal(id: string, cambios: Partial<EstrategiaRow>) {
    setEstrategias((actuales) => actuales.map((e) => (e.id === id ? { ...e, ...cambios } : e)));
  }

  function toggleActivo(estrategia: EstrategiaRow) {
    startTransition(async () => {
      const accion = estrategia.activo ? desactivarEstrategia : activarEstrategia;
      const resultado = await accion(estrategia.id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      actualizarLocal(estrategia.id, { activo: !estrategia.activo });
    });
  }

  function handleDuplicar(id: string) {
    startTransition(async () => {
      const resultado = await duplicarEstrategia(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Estrategia duplicada");
      // La copia aparecerá en la próxima carga de la sección — revalidatePath ya la refleja en el servidor.
      location.reload();
    });
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      const resultado = await eliminarEstrategia(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      setEstrategias((actuales) => actuales.filter((e) => e.id !== id));
      toast.success("Estrategia eliminada");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-stone-400" />
          <h3 className="text-sm font-semibold text-stone-200 uppercase tracking-wide">Estrategias</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditando("nueva")}
          className="border-white/10 text-stone-300 hover:bg-white/10 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva estrategia
        </Button>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/3 divide-y divide-white/8">
        {estrategias.map((estrategia) => (
          <div key={estrategia.id} className="flex items-center gap-3 px-4 py-3">
            <Switch checked={estrategia.activo} onCheckedChange={() => toggleActivo(estrategia)} disabled={isPending} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-stone-200 truncate">{estrategia.nombre}</p>
                <Badge
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    estrategia.origen === "PLANTILLA"
                      ? "bg-blue-400/10 text-blue-300 border border-blue-400/20"
                      : "bg-purple-400/10 text-purple-300 border border-purple-400/20",
                  )}
                >
                  {estrategia.origen === "PLANTILLA" ? "Plantilla" : "Personalizada"}
                </Badge>
              </div>
              {estrategia.descripcion && <p className="text-xs text-stone-500 truncate">{estrategia.descripcion}</p>}
            </div>
            <Input
              type="number"
              min={0}
              max={100}
              value={estrategia.prioridad}
              onChange={(e) => actualizarLocal(estrategia.id, { prioridad: Number(e.target.value) })}
              onBlur={() =>
                startTransition(async () => {
                  await editarEstrategia(estrategia.id, {
                    nombre: estrategia.nombre,
                    descripcion: estrategia.descripcion ?? undefined,
                    contenido: { reglas: extraerReglas(estrategia.contenido) },
                    condiciones: estrategia.condiciones,
                    prioridad: estrategia.prioridad,
                  });
                })
              }
              className="w-16 h-8 bg-white/5 border-white/10 text-stone-50 text-xs text-center flex-shrink-0"
              title="Prioridad"
            />
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setEditando(estrategia)} className="flex-shrink-0 text-stone-400 hover:text-stone-200">
              Editar
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => handleDuplicar(estrategia.id)} className="flex-shrink-0 text-stone-400 hover:text-stone-200">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => handleEliminar(estrategia.id)} className="flex-shrink-0 text-stone-400 hover:text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {editando && (
        <FormEstrategia
          estrategia={editando === "nueva" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(estrategia) => {
            if (editando === "nueva") {
              setEstrategias((actuales) => [...actuales, estrategia]);
            } else {
              actualizarLocal(estrategia.id, estrategia);
            }
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function FormEstrategia({
  estrategia,
  onCerrar,
  onGuardado,
}: {
  estrategia: EstrategiaRow | null;
  onCerrar: () => void;
  onGuardado: (e: EstrategiaRow) => void;
}) {
  const [nombre, setNombre] = useState(estrategia?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(estrategia?.descripcion ?? "");
  const [reglasTexto, setReglasTexto] = useState(extraerReglas(estrategia?.contenido).join("\n"));
  const [isPending, startTransition] = useTransition();

  function guardar() {
    const reglas = reglasTexto.split("\n").map((r) => r.trim()).filter(Boolean);
    const datos = {
      nombre,
      descripcion: descripcion || undefined,
      contenido: { reglas },
      condiciones: (estrategia?.condiciones as { tiposRelacion: string[]; intenciones: string[] } | undefined) ?? {
        tiposRelacion: [],
        intenciones: [],
      },
      prioridad: estrategia?.prioridad ?? 0,
    };

    startTransition(async () => {
      const resultado = estrategia
        ? await editarEstrategia(estrategia.id, datos)
        : await crearEstrategia(datos);

      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success(estrategia ? "Estrategia actualizada" : "Estrategia creada");

      onGuardado({
        id: estrategia?.id ?? (resultado as { id?: string }).id ?? "",
        nombre,
        descripcion: descripcion || null,
        origen: estrategia?.origen ?? "PERSONALIZADA",
        activo: estrategia?.activo ?? false,
        contenido: { reglas },
        condiciones: datos.condiciones,
        prioridad: datos.prioridad,
      });
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="bg-stone-950/98 border-white/10 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-stone-50">{estrategia ? "Editar estrategia" : "Nueva estrategia"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-stone-400">Nombre</label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="bg-white/5 border-white/10 text-stone-50 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-stone-400">Descripción (opcional)</label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="bg-white/5 border-white/10 text-stone-50 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-stone-400">Reglas (una por línea)</label>
            <Textarea
              value={reglasTexto}
              onChange={(e) => setReglasTexto(e.target.value)}
              rows={6}
              className="bg-white/5 border-white/10 text-stone-50 text-sm resize-none"
            />
          </div>
          <Button
            type="button"
            onClick={guardar}
            disabled={isPending || !nombre.trim()}
            className="self-end rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 font-semibold"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
