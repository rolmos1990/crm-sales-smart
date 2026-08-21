"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Plus, Loader2, KanbanSquare, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { crearPipeline } from "../actions";
import type { PipelineConStages } from "../types";
import { useSesion } from "@/shared/auth/sesion-context";

interface PipelineSwitcherProps {
  pipelines: PipelineConStages[];
  pipelineActualId: string | null;
  onSwitch: (id: string | null) => void;
  onConfigurar?: () => void;
}

export function PipelineSwitcher({ pipelines, pipelineActualId, onSwitch, onConfigurar }: PipelineSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogCrear, setDialogCrear] = useState(false);
  const [nombre, setNombre] = useState("");
  const [isPending, startTransition] = useTransition();

  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("oportunidades");
  const pipelineActual = pipelines.find((p) => p.id === pipelineActualId);

  const handleSwitch = (id: string | null) => {
    setOpen(false);
    onSwitch(id);
    const url = id ? `/crm/pipeline?p=${id}` : "/crm/pipeline";
    router.push(url);
  };

  const handleCrear = () => {
    if (!nombre.trim()) return;
    startTransition(async () => {
      const resultado = await crearPipeline({ nombre: nombre.trim() });
      if (resultado.exito) {
        toast.success(`Pipeline "${nombre}" creado`);
        setNombre("");
        setDialogCrear(false);
        router.push(`/crm/pipeline?p=${resultado.id}`);
      } else {
        toast.error(resultado.error);
      }
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-xl transition-all",
            "bg-white/80 dark:bg-white/[0.06] border border-stone-200 dark:border-white/[0.08]",
            "text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-white/12",
            "shadow-sm dark:shadow-none font-medium text-sm cursor-pointer"
          )}
        >
          <KanbanSquare className="h-4 w-4 text-lime-600 dark:text-lime-400 flex-shrink-0" />
          <span className="max-w-[180px] truncate">
            {pipelineActual?.nombre ?? "Sin pipeline"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500 flex-shrink-0" />
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-64 p-1.5 bg-dropdown border-border shadow-xl rounded-xl"
        >
          <div className="space-y-0.5">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSwitch(p.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left",
                  p.id === pipelineActualId
                    ? "bg-lime-500/10 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400"
                    : "text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/[0.05]"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.stages[0]?.color ?? "#818cf8" }}
                />
                <span className="flex-1 truncate font-medium">{p.nombre}</span>
                <span className="text-xs text-stone-400 dark:text-stone-600 flex-shrink-0">
                  {p.stages.length} etapas
                </span>
                {p.id === pipelineActualId && (
                  <Check className="h-3.5 w-3.5 flex-shrink-0" />
                )}
              </button>
            ))}

            <div className="mx-2 my-1 h-px bg-stone-100 dark:bg-white/[0.06]" />

            {pipelineActualId && onConfigurar && (
              <button
                onClick={() => { setOpen(false); onConfigurar(); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors text-left"
              >
                <Settings2 className="h-4 w-4 flex-shrink-0" />
                Configurar pipeline
              </button>
            )}

            {puedeMod && (
              <button
                onClick={() => { setOpen(false); setDialogCrear(true); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/[0.05] transition-colors text-left"
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                Crear nuevo pipeline
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogCrear} onOpenChange={setDialogCrear}>
        <DialogContent className="sm:max-w-sm bg-modal border-border">
          <DialogHeader>
            <DialogTitle className="text-stone-900 dark:text-stone-50">Nuevo pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-600 dark:text-stone-400 uppercase tracking-wide">
                Nombre
              </Label>
              <Input
                autoFocus
                placeholder="Ej: Pipeline B2B, Ventas Enterprise..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCrear(); }}
                className="bg-stone-50 dark:bg-white/[0.04] border-stone-200 dark:border-white/[0.08] rounded-xl"
              />
            </div>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Se crearán 6 etapas predeterminadas que puedes personalizar.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogCrear(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCrear}
              disabled={!nombre.trim() || isPending}
              className="rounded-xl bg-lime-500 hover:bg-lime-400 text-stone-950"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
