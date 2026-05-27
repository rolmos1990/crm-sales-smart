import { ListaPlantillas } from "./lista-plantillas";
import type { Plantilla } from "@/configuracion/plantillas/types";

interface TabPlantillasProps {
  plantillas: Plantilla[];
  instanciaId: string;
}

export function TabPlantillas({ plantillas, instanciaId }: TabPlantillasProps) {
  return (
    <div className="space-y-1">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Plantillas de mensajes</h2>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
          Textos precargados que puedes invocar con <code className="font-mono bg-stone-100 dark:bg-white/8 px-1 rounded">/alias</code> en conversaciones, respuestas rápidas y automatizaciones.
        </p>
      </div>
      <ListaPlantillas plantillas={plantillas} instanciaId={instanciaId} />
    </div>
  );
}
