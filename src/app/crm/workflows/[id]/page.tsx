import { notFound, redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerOpcionesEditor, obtenerWorkflow } from "@/workflows/queries";
import { DefinicionWorkflowSchema } from "@/workflows/definicion/schema";
import { definicionInicial } from "@/workflows/schema";
import { CargadorEditor } from "@/workflows/components/editor/cargador-editor";

export const dynamic = "force-dynamic";

export default async function EditorWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "workflows", "ver").permitido) redirect("/acceso-denegado");

  const [workflow, opciones] = await Promise.all([
    obtenerWorkflow(id, sesion.instanciaId),
    obtenerOpcionesEditor(sesion.instanciaId, id),
  ]);
  if (!workflow) notFound();

  // Un borrador corrupto no debe impedir abrir el editor.
  const definicion = DefinicionWorkflowSchema.safeParse(workflow.borrador);

  return (
    <CargadorEditor
      workflow={{
        id: workflow.id,
        nombre: workflow.nombre,
        descripcion: workflow.descripcion,
        estado: workflow.estado,
        versionPublicada: workflow.versionPublicada?.numero ?? null,
        actualizadoEn: workflow.actualizadoEn,
        definicion: definicion.success ? definicion.data : definicionInicial(),
      }}
      opciones={opciones}
      puedeModificar={verificarAcceso(sesion, "workflows", "modificar").permitido}
    />
  );
}
