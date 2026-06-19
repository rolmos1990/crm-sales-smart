"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Truck, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toggleTransportista } from "../actions";
import { DialogTransportista } from "./dialog-transportista";
import { TIPO_TRANSPORTISTA_LABELS } from "../types";
import type { Transportista } from "../types";

interface ListaTransportistasProps {
  transportistas: Transportista[];
}

function FilaTransportista({ transportista }: { transportista: Transportista }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const resultado = await toggleTransportista(transportista.id);
      if (!resultado.exito) toast.error(resultado.error);
      else toast.success(transportista.activo ? "Transportista desactivado" : "Transportista activado");
    });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
      <div className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
        transportista.activo
          ? "bg-lime-400/10 text-lime-400"
          : "bg-white/5 text-white/30"
      )}>
        <Truck className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          transportista.activo ? "text-stone-900 dark:text-stone-50" : "text-stone-400 dark:text-stone-600 line-through"
        )}>
          {transportista.nombre}
        </p>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
          {TIPO_TRANSPORTISTA_LABELS[transportista.tipo] ?? transportista.tipo}
        </p>
      </div>

      <Badge
        variant="outline"
        className={cn(
          "text-xs rounded-full",
          transportista.activo
            ? "border-lime-400/30 text-lime-600 dark:text-lime-400 bg-lime-400/5"
            : "border-stone-300/30 text-stone-400 bg-stone-100/5"
        )}
      >
        {transportista.activo ? "Activo" : "Inactivo"}
      </Badge>

      <div className="flex items-center gap-1 flex-shrink-0">
        <DialogTransportista tipo="editar" transportista={transportista} />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          onClick={handleToggle}
          disabled={isPending}
          title={transportista.activo ? "Desactivar" : "Activar"}
        >
          <Power className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ListaTransportistas({ transportistas }: ListaTransportistasProps) {
  if (transportistas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Truck className="h-6 w-6 text-stone-400" />
        </div>
        <p className="text-sm font-medium text-stone-600 dark:text-stone-400">Sin transportistas</p>
        <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">
          Crea el primero para empezar a registrar entregas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transportistas.map((t) => (
        <FilaTransportista key={t.id} transportista={t} />
      ))}
    </div>
  );
}
