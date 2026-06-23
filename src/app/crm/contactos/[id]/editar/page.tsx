import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormContacto } from "@/crm/contactos/components/form-contacto";
import { obtenerContactoPorId } from "@/crm/contactos/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { obtenerTags } from "@/crm/tags/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";

const PAIS_A_ISO: Record<string, string> = {
  "Panamá": "PA", "Perú": "PE", "Colombia": "CO", "México": "MX",
  "Argentina": "AR", "Chile": "CL", "Ecuador": "EC", "Bolivia": "BO",
  "Venezuela": "VE", "Paraguay": "PY", "Uruguay": "UY",
  "Costa Rica": "CR", "Guatemala": "GT",
};

export default async function EditarContactoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "contactos", "modificar").permitido) redirect("/acceso-denegado");

  let contacto = null;
  let empresas: { id: string; nombre: string }[] = [];
  let tags: Awaited<ReturnType<typeof obtenerTags>> = [];
  let defaultCountryCode = "PA";

  try {
    [contacto, empresas, tags] = await Promise.all([
      obtenerContactoPorId(id, sesion.instanciaId),
      buscarEmpresas("", sesion.instanciaId),
      obtenerTags(sesion.instanciaId),
    ]);
    const config = await obtenerConfiguracionEmpresa(sesion.instanciaId);
    if (config?.pais) defaultCountryCode = PAIS_A_ISO[config.pais] ?? "PA";
  } catch {
    // DB not configured
  }

  if (!contacto && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  const opcionesEmpresas = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href={`/crm/contactos/${id}`}><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader
        titulo="Editar contacto"
        descripcion={contacto ? `${contacto.nombre} ${contacto.apellido}` : ""}
      />
      <FormContacto
        empresas={opcionesEmpresas}
        tags={tags}
        tagIdsIniciales={contacto?.tags?.map((t) => t.tagId) ?? []}
        inicial={contacto ?? undefined}
        modo="editar"
        defaultCountryCode={defaultCountryCode}
      />
    </div>
  );
}
