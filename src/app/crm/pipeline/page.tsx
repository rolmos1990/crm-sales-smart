import Link from "next/link";
import { Plus, KanbanSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { PipelineKanban } from "@/crm/pipeline/components/pipeline-kanban";
import { obtenerOportunidadesPorEtapa } from "@/crm/oportunidades/queries";
import type { Etapa, Oportunidad } from "@/crm/oportunidades/types";

export default async function PipelinePage() {
  let oportunidades = new Map<Etapa, Oportunidad[]>();
  try {
    const datos = await obtenerOportunidadesPorEtapa();
    oportunidades = datos as unknown as Map<Etapa, Oportunidad[]>;
  } catch {
    // DB no configurada
  }

  return (
    <div className="space-y-6 h-full">
      <PageHeader
        titulo="Pipeline de Ventas"
        descripcion="Visualiza y gestiona tus oportunidades por etapa"
        accion={
          <Link href="/crm/oportunidades/nueva">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva oportunidad
            </Button>
          </Link>
        }
      />
      {oportunidades.size === 0 && [...oportunidades.values()].every(v => v.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <KanbanSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Pipeline vacío</p>
          <p className="text-sm mt-1">Crea oportunidades para verlas aquí.</p>
        </div>
      ) : (
        <PipelineKanban oportunidades={oportunidades} />
      )}
    </div>
  );
}
