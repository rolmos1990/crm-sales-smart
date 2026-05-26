import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormOportunidad } from "@/crm/oportunidades/components/form-oportunidad";
import { obtenerOportunidadPorId } from "@/crm/oportunidades/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerTags } from "@/crm/tags/queries";

export default async function EditarOportunidadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let oportunidad = null;
  let empresas: { id: string; nombre: string }[] = [];
  let contactos: { id: string; nombre: string; apellido: string }[] = [];
  let tags: Awaited<ReturnType<typeof obtenerTags>> = [];

  try {
    [oportunidad, empresas, contactos, tags] = await Promise.all([
      obtenerOportunidadPorId(id),
      buscarEmpresas(""),
      buscarContactos(""),
      obtenerTags(),
    ]);
  } catch {
    // DB not configured
  }

  if (!oportunidad && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  const opcionesEmpresas = empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }));
  const opcionesContactos = contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href={`/crm/oportunidades/${id}`}><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Editar oportunidad" descripcion={oportunidad?.titulo ?? ""} />
      <FormOportunidad
        empresas={opcionesEmpresas}
        contactos={opcionesContactos}
        tags={tags}
        tagIdsIniciales={oportunidad?.tags?.map((t) => t.tagId) ?? []}
        inicial={oportunidad ? { ...oportunidad, valor: Number(oportunidad.valor) } : undefined}
        modo="editar"
      />
    </div>
  );
}
