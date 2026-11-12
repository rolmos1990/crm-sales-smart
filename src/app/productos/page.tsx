import { Plus, Package } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaProductos } from "@/shared/productos/components/lista-productos";
import { obtenerProductosListado } from "@/shared/productos/queries";
import { obtenerEtiquetasProducto } from "@/shared/productos/etiquetas/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import type { ProductoListado } from "@/shared/productos/types";
import type { EtiquetaProducto } from "@/shared/productos/etiquetas/types";

export default async function ProductosPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "productos", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "productos");
  let productos: ProductoListado[] = [];
  let etiquetas: EtiquetaProducto[] = [];

  try {
    // Activos e inactivos: el filtro Estado del listado decide qué se ve.
    [productos, etiquetas] = await Promise.all([
      obtenerProductosListado(sesion.instanciaId),
      obtenerEtiquetasProducto(sesion.instanciaId),
    ]);
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
        <ListaProductos productos={productos} etiquetas={etiquetas} />
      )}
    </div>
  );
}
