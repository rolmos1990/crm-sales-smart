import { Plus, KanbanSquare } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { PipelineKanban } from "@/crm/pipeline/components/pipeline-kanban";
import { obtenerOportunidadesPorEtapa } from "@/crm/oportunidades/queries";
import { obtenerEmpresas } from "@/crm/empresas/queries";
import { obtenerContactos } from "@/crm/contactos/queries";
import type { Etapa, Oportunidad } from "@/crm/oportunidades/types";
import type { OpcionCombobox } from "@/shared/ui/combobox";

export default async function PipelinePage() {
  let oportunidades = new Map<Etapa, Oportunidad[]>();
  let empresasOpciones: OpcionCombobox[] = [];
  let contactosOpciones: OpcionCombobox[] = [];

  try {
    const [datos, empresas, contactos] = await Promise.all([
      obtenerOportunidadesPorEtapa(),
      obtenerEmpresas(),
      obtenerContactos(),
    ]);
    oportunidades = datos as unknown as Map<Etapa, Oportunidad[]>;
    empresasOpciones = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
    contactosOpciones = contactos.map((c) => ({
      valor: c.id,
      etiqueta: `${c.nombre} ${c.apellido}`,
    }));
  } catch {
    // DB no configurada
  }

  const isEmpty =
    oportunidades.size === 0 ||
    [...oportunidades.values()].every((v) => v.length === 0);

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      <PageHeader
        titulo="Pipeline de Ventas"
        descripcion="Arrastra las oportunidades entre etapas · Haz clic en una tarjeta para editarla"
        accion={
          <ButtonLink href="/crm/oportunidades/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva oportunidad
          </ButtonLink>
        }
      />
      {isEmpty ? (
        <div className="text-center py-12 text-muted-foreground">
          <KanbanSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Pipeline vacío</p>
          <p className="text-sm mt-1">Crea oportunidades para verlas aquí.</p>
        </div>
      ) : (
        <PipelineKanban
          oportunidades={oportunidades}
          empresas={empresasOpciones}
          contactos={contactosOpciones}
        />
      )}
    </div>
  );
}
