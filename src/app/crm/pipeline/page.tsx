import { PipelineWrapper } from "@/crm/pipeline/components/pipeline-wrapper";
import { obtenerPipelines, obtenerOportunidadesPorPipeline } from "@/crm/pipeline/queries";
import { obtenerOportunidadesPorEtapa } from "@/crm/oportunidades/queries";
import { obtenerEmpresas } from "@/crm/empresas/queries";
import { obtenerContactos } from "@/crm/contactos/queries";
import { obtenerOCrearInstancia } from "@/shared/db/instancia";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import type { OportunidadEnStage, PipelineConStages } from "@/crm/pipeline/types";
import type { Etapa, Oportunidad } from "@/crm/oportunidades/types";
import type { OpcionCombobox } from "@/shared/ui/combobox";

const PAIS_A_ISO: Record<string, string> = {
  "Panamá": "PA", "Perú": "PE", "Colombia": "CO", "México": "MX",
  "Argentina": "AR", "Chile": "CL", "Ecuador": "EC", "Bolivia": "BO",
  "Venezuela": "VE", "Paraguay": "PY", "Uruguay": "UY",
  "Costa Rica": "CR", "Guatemala": "GT",
};

export default async function PipelinePage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const pipelineIdParam = searchParams.p ?? null;

  let pipelines: PipelineConStages[] = [];
  let pipelineId: string | null = null;
  let oportunidadesDinamicas: Map<string, OportunidadEnStage[]> | null = null;
  let oportunidadesLegacy: Map<Etapa, Oportunidad[]> | null = null;
  let empresasOpciones: OpcionCombobox[] = [];
  let contactosOpciones: OpcionCombobox[] = [];
  let defaultCountryCode = "PA";

  try {
    const instancia = await obtenerOCrearInstancia();
    const [pipelinesData, empresas, contactos, config] = await Promise.all([
      obtenerPipelines(),
      obtenerEmpresas(),
      obtenerContactos(),
      obtenerConfiguracionEmpresa(instancia.id),
    ]);

    pipelines = pipelinesData as unknown as PipelineConStages[];
    empresasOpciones = empresas.map((e: { id: string; nombre: string }) => ({ valor: e.id, etiqueta: e.nombre }));
    contactosOpciones = contactos.map((c: { id: string; nombre: string; apellido: string }) => ({
      valor: c.id,
      etiqueta: `${c.nombre} ${c.apellido}`,
    }));
    if (config?.pais) defaultCountryCode = PAIS_A_ISO[config.pais] ?? "PA";

    const pipelineDefault = pipelines.find((p) => p.esDefault);
    pipelineId = pipelineIdParam ?? pipelineDefault?.id ?? null;

    const pipelineValido = pipelineId && pipelines.some((p) => p.id === pipelineId);

    if (pipelineValido && pipelineId) {
      oportunidadesDinamicas = await obtenerOportunidadesPorPipeline(pipelineId);
    } else {
      const datos = await obtenerOportunidadesPorEtapa();
      oportunidadesLegacy = datos as unknown as Map<Etapa, Oportunidad[]>;
    }
  } catch {
    // DB no configurada
  }

  return (
    <PipelineWrapper
      pipelines={pipelines}
      pipelineActualId={pipelineId}
      oportunidadesDinamicas={oportunidadesDinamicas}
      oportunidadesLegacy={oportunidadesLegacy}
      empresas={empresasOpciones}
      contactos={contactosOpciones}
      defaultCountryCode={defaultCountryCode}
    />
  );
}
