"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpcionesEditor } from "../../queries";
import type { DatosEditorWorkflow } from "./editor-workflow";

// React Flow solo funciona en el navegador y pesa: se carga aparte, solo en
// esta ruta (bundle-dynamic-imports).
const EditorWorkflow = dynamic(() => import("./editor-workflow").then((m) => m.EditorWorkflow), {
  ssr: false,
  loading: () => <EsqueletoEditor />,
});

export function CargadorEditor(props: { workflow: DatosEditorWorkflow; opciones: OpcionesEditor; puedeModificar: boolean }) {
  return <EditorWorkflow {...props} />;
}

export function EsqueletoEditor() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-56" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex flex-1">
        <div className="hidden w-64 space-y-2 border-r border-border p-3 lg:block">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center gap-10 pt-16">
          <Skeleton className="h-20 w-64 rounded-xl" />
          <Skeleton className="h-20 w-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
