import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { FormProducto } from "@/shared/productos/components/form-producto";
import { obtenerProductoPorId } from "@/shared/productos/queries";

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let producto = null;

  try {
    producto = await obtenerProductoPorId(id);
  } catch {
    // DB not configured
  }

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
        inicial={producto ? { ...producto, precio: Number(producto.precio) } : undefined}
        modo="editar"
      />
    </div>
  );
}
