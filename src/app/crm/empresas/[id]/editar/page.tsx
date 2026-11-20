import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormEmpresa } from "@/crm/empresas/components/form-empresa";
import { obtenerEmpresaPorId } from "@/crm/empresas/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";

export default async function EditarEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "empresas", "modificar").permitido) redirect("/acceso-denegado");

  const empresa = await obtenerEmpresaPorId(id, sesion.instanciaId);

  // 043 — "no existe" solo puede venir de una lectura exitosa sin fila.
  if (!empresa) notFound();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href={`/crm/empresas/${id}`}><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Editar empresa" descripcion={empresa?.nombre ?? ""} />
      <FormEmpresa inicial={empresa ?? undefined} modo="editar" />
    </div>
  );
}
