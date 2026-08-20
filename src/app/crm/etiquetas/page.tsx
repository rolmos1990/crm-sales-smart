import { redirect } from "next/navigation";
import { Tag } from "lucide-react";
import { obtenerTags } from "@/crm/tags/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { ListaTags } from "@/crm/tags/components/lista-tags";

export default async function EtiquetasPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "etiquetas", "ver").permitido) redirect("/acceso-denegado");
  let tags: Awaited<ReturnType<typeof obtenerTags>> = [];

  try {
    tags = await obtenerTags(sesion.instanciaId);
  } catch {
    // DB no configurada
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="h-8 w-8 rounded-xl bg-lime-500/10 dark:bg-lime-400/10 flex items-center justify-center">
            <Tag className="h-4 w-4 text-lime-600 dark:text-lime-400" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Etiquetas</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-10.5">
          Gestiona las etiquetas que puedes asignar a oportunidades y contactos.
        </p>
      </div>

      <ListaTags tags={tags} />
    </div>
  );
}
