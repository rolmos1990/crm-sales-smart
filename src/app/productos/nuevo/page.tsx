import { ButtonLink } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { FormProducto } from "@/shared/productos/components/form-producto";
import { obtenerOCrearInstancia } from "@/shared/db/instancia";

export default async function NuevoProductoPage() {
  const instancia = await obtenerOCrearInstancia();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/productos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Nuevo producto" descripcion="Agrega un producto o servicio al catálogo" />
      <FormProducto instanciaId={instancia.id} />
    </div>
  );
}
