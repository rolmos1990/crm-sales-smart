import { PipelineWrapper } from "@/crm/pipeline/components/pipeline-wrapper";
import { obtenerPipelines } from "@/crm/pipeline/queries";
import { cargarVistaPipeline, type VistaPipeline } from "@/crm/pipeline/vista";
import { obtenerOportunidadesPorEtapa } from "@/crm/oportunidades/queries";
import { obtenerEmpresas } from "@/crm/empresas/queries";
import { obtenerContactos } from "@/crm/contactos/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import type { PipelineConStages } from "@/crm/pipeline/types";
import type { Etapa, Oportunidad } from "@/crm/oportunidades/types";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import type { Tag } from "@/crm/tags/types";

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

  // Filtros, paginación y "Ver ocultos" viven en estado de cliente (ver
  // PipelineWrapper), nunca en la URL. `?p=` se conserva porque no es un
  // filtro sino qué tablero se abre (lo usan los links de otras pantallas).
  // Cualquier otro param de un link viejo se limpia en vez de aplicarse.
  if (Object.keys(searchParams).some((k) => k !== "p")) {
    redirect(pipelineIdParam ? `/crm/pipeline?p=${encodeURIComponent(pipelineIdParam)}` : "/crm/pipeline");
  }

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "pipeline", "ver").permitido) redirect("/acceso-denegado");

  let pipelines: PipelineConStages[] = [];
  let pipelineId: string | null = null;
  let vistaInicial: VistaPipeline | null = null;
  let oportunidadesLegacy: Map<Etapa, Oportunidad[]> | null = null;
  let empresasOpciones: OpcionCombobox[] = [];
  let contactosOpciones: OpcionCombobox[] = [];
  let contactosFiltroOpciones: OpcionCombobox[] = [];
  let tags: Tag[] = [];
  let defaultCountryCode = "PA";

  try {
    const [pipelinesData, empresas, contactos, tagsData, config] = await Promise.all([
      obtenerPipelines(sesion.instanciaId),
      obtenerEmpresas(sesion.instanciaId),
      obtenerContactos(sesion.instanciaId),
      obtenerTags(sesion.instanciaId),
      obtenerConfiguracionEmpresa(sesion.instanciaId),
    ]);

    pipelines = pipelinesData as unknown as PipelineConStages[];
    empresasOpciones = empresas.map((e: { id: string; nombre: string }) => ({ valor: e.id, etiqueta: e.nombre }));
    contactosOpciones = contactos.map((c: { id: string; nombre: string; apellido: string }) => ({
      valor: c.id,
      etiqueta: `${c.nombre} ${c.apellido}`,
    }));
    contactosFiltroOpciones = contactos.map((c) => ({
      valor: c.id,
      etiqueta: `${c.nombre} ${c.apellido}`,
      subtitulo: c.email ?? undefined,
      busqueda: [c.telefonoPrincipal, c.telefonoSecundario].filter((v): v is string => !!v),
    }));
    tags = tagsData as unknown as Tag[];
    if (config?.pais) defaultCountryCode = PAIS_A_ISO[config.pais] ?? "PA";

    const pipelineDefault = pipelines.find((p) => p.esDefault);
    pipelineId = pipelineIdParam ?? pipelineDefault?.id ?? null;

    const pipelineValido = pipelineId && pipelines.some((p) => p.id === pipelineId);

    if (pipelineValido && pipelineId) {
      vistaInicial = await cargarVistaPipeline(pipelineId, sesion.instanciaId, sesion.zonaNegocio, {});
    } else {
      const datos = await obtenerOportunidadesPorEtapa(sesion.instanciaId);
      oportunidadesLegacy = datos as unknown as Map<Etapa, Oportunidad[]>;
    }
  } catch {
    // DB no configurada
  }

  return (
    // `key`: cambiar de pipeline arranca con filtros y "Ver ocultos" limpios.
    <PipelineWrapper
      key={pipelineId ?? "sin-pipeline"}
      pipelines={pipelines}
      pipelineActualId={pipelineId}
      vistaInicial={vistaInicial}
      oportunidadesLegacy={oportunidadesLegacy}
      empresas={empresasOpciones}
      contactos={contactosOpciones}
      contactosFiltro={contactosFiltroOpciones}
      tags={tags}
      defaultCountryCode={defaultCountryCode}
    />
  );
}
