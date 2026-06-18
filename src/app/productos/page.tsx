import { Plus, Package } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaProductos } from "@/shared/productos/components/lista-productos";
import { obtenerProductos } from "@/shared/productos/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar } from "@/shared/auth/permisos";
import type { Producto } from "@/shared/productos/types";

export default async function ProductosPage() {
  const sesion = await requireSesion();
  const puedeMod = puedeModificar(sesion.rol, "productos");
  let productos: Producto[] = [];

  try {
    const datos = await obtenerProductos(sesion.instanciaId);
    productos = datos.map((p) => ({ ...p, precio: Number(p.precio), cantidadDisponible: Number(p.cantidadDisponible) })) as Producto[];
  } catch {
    // DB not configured — show empty state
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Catálogo de productos"
        descripcion="Gestiona los productos y servicios de tu empresa"
        accion={puedeMod ? (
          <ButtonLink href="/productos/nuevo"><Plus className="h-4 w-4" />Nuevo producto</ButtonLink>
        ) : undefined}
      />
      {productos.length === 0 ? (
        <EmptyState
          Icono={Package}
          titulo="Sin productos"
          descripcion="Agrega tus productos y servicios para usarlos en cotizaciones y pedidos."
          accion={puedeMod ? (
            <ButtonLink href="/productos/nuevo"><Plus className="h-4 w-4" />Nuevo producto</ButtonLink>
          ) : undefined}
        />
      ) : (
        <ListaProductos productos={productos} />
      )}
    </div>
  );
}
