import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormOportunidad } from "@/crm/oportunidades/components/form-oportunidad";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerPipelines } from "@/crm/pipeline/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { resolverInstanciaId } from "@/shared/db/instancia";
import type { PipelineConStages } from "@/crm/pipeline/types";

export default async function NuevaOportunidadPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const pipelineId = searchParams.pipelineId ?? null;
  const stageId = searchParams.stageId ?? null;

  let empresas: { valor: string; etiqueta: string }[] = [];
  let contactos: { valor: string; etiqueta: string }[] = [];
  let pipeline: PipelineConStages | null = null;
  let tags: Awaited<ReturnType<typeof obtenerTags>> = [];
  let monedaDefault = "PEN";

  try {
    const instanciaId = await resolverInstanciaId();
    const [e, c, pipelines, t, moneda] = await Promise.all([
      buscarEmpresas(""),
      buscarContactos(""),
      pipelineId ? obtenerPipelines() : Promise.resolve([]),
      obtenerTags(),
      obtenerMonedaPrincipal(instanciaId),
    ]);
    monedaDefault = moneda;
    empresas = e.map(x => ({ valor: x.id, etiqueta: x.nombre }));
    contactos = c.map(x => ({ valor: x.id, etiqueta: `${x.nombre} ${x.apellido}` }));
    tags = t;
    if (pipelineId) {
      pipeline = (pipelines as unknown as PipelineConStages[]).find(p => p.id === pipelineId) ?? null;
    }
  } catch {
    // DB no configurada
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nueva oportunidad</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {pipeline
            ? `Crear en pipeline: ${pipeline.nombre}`
            : "Registra una nueva oportunidad de venta"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la oportunidad</CardTitle>
        </CardHeader>
        <CardContent>
          <FormOportunidad
            empresas={empresas}
            contactos={contactos}
            tags={tags}
            pipelineId={pipelineId}
            stageId={stageId}
            pipeline={pipeline}
            monedaDefault={monedaDefault}
          />
        </CardContent>
      </Card>
    </div>
  );
}
