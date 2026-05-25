import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormProducto } from "@/shared/productos/components/form-producto";

export default function NuevoProductoPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/productos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Nuevo producto" descripcion="Agrega un producto o servicio al catálogo" />
      <FormProducto />
    </div>
  );
}
