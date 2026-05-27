import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { FormProducto } from "@/shared/productos/components/form-producto";
import { obtenerProductoPorId } from "@/shared/productos/queries";
import { obtenerOCrearInstancia } from "@/shared/db/instancia";

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [instancia, producto] = await Promise.all([
    obtenerOCrearInstancia(),
    obtenerProductoPorId(id).catch(() => null),
  ]);

  if (!producto && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <ButtonLink variant="ghost" size="icon-sm" href="/productos"><ArrowLeft className="h-4 w-4" /></ButtonLink>
      </div>
      <PageHeader titulo="Editar producto" descripcion={producto?.nombre ?? ""} />
      <FormProducto
        instanciaId={instancia.id}
        inicial={producto ? { ...producto, precio: Number(producto.precio), cantidadDisponible: Number(producto.cantidadDisponible) } : undefined}
        modo="editar"
      />
    </div>
  );
}
