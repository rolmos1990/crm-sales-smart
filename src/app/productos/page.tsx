import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaProductos } from "@/shared/productos/components/lista-productos";
import { obtenerProductos } from "@/shared/productos/queries";
import type { Producto } from "@/shared/productos/types";

export default async function ProductosPage() {
  let productos: Producto[] = [];

  try {
    const datos = await obtenerProductos();
    productos = datos.map((p) => ({ ...p, precio: Number(p.precio) })) as Producto[];
  } catch {
    // DB not configured — show empty state
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Catálogo de productos"
        descripcion="Gestiona los productos y servicios de tu empresa"
        accion={
          <ButtonLink href="/productos/nuevo"><Plus className="h-4 w-4" />Nuevo producto</ButtonLink>
        }
      />
      {productos.length === 0 ? (
        <EmptyState
          Icono={Package}
          titulo="Sin productos"
          descripcion="Agrega tus productos y servicios para usarlos en cotizaciones y pedidos."
          accion={
            <ButtonLink href="/productos/nuevo"><Plus className="h-4 w-4" />Nuevo producto</ButtonLink>
          }
        />
      ) : (
        <ListaProductos productos={productos} />
      )}
    </div>
  );
}
