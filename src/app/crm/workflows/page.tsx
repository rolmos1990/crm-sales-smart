import { redirect } from "next/navigation";
import { Workflow } from "lucide-react";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerAsignacionMensajes, obtenerEstadoWorkflowsEmpresa, obtenerWorkflows } from "@/workflows/queries";
import { AsignacionMensajes } from "@/workflows/components/asignacion-mensajes";
import { ListaWorkflows } from "@/workflows/components/lista-workflows";
import { ActivacionWorkflows } from "@/workflows/components/activacion-workflows";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "workflows", "ver").permitido) redirect("/acceso-denegado");

  const [workflows, estadoEmpresa, asignacionMensajes] = await Promise.all([
    obtenerWorkflows(sesion.instanciaId),
    obtenerEstadoWorkflowsEmpresa(sesion.instanciaId),
    obtenerAsignacionMensajes(sesion.instanciaId),
  ]);
  const puedeModificar = verificarAcceso(sesion, "workflows", "modificar").permitido;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stage-lavender-muted">
            <Workflow className="h-4 w-4 text-stage-lavender-text" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        </div>
        <p className="ml-10.5 text-sm text-muted-foreground">
          Automatiza conversaciones y seguimientos con flujos visuales. Asigna un Workflow a cada etapa del pipeline.
        </p>
      </div>

      <ActivacionWorkflows
        habilitado={estadoEmpresa.habilitado}
        etapasConIA={estadoEmpresa.etapasConIA}
        puedeModificar={puedeModificar}
      />
      <AsignacionMensajes
        workflowId={asignacionMensajes.workflowId}
        candidatos={asignacionMensajes.candidatos}
        puedeModificar={puedeModificar}
      />
      <ListaWorkflows workflows={workflows} puedeModificar={puedeModificar} />
    </div>
  );
}
