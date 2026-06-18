import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { FormProducto } from "@/shared/productos/components/form-producto";
import { obtenerProductoPorId } from "@/shared/productos/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar } from "@/shared/auth/permisos";

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSesion();
  if (!puedeModificar(sesion.rol, "productos")) redirect("/productos");

  const producto = await obtenerProductoPorId(id, sesion.instanciaId).catch(() => null);

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
        instanciaId={sesion.instanciaId}
        inicial={producto ? { ...producto, precio: Number(producto.precio), cantidadDisponible: Number(producto.cantidadDisponible) } : undefined}
        modo="editar"
      />
    </div>
  );
}
