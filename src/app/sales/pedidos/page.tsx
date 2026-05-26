import { Plus, ShoppingCart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaPedidos } from "@/sales/pedidos/components/lista-pedidos";
import { obtenerPedidos } from "@/sales/pedidos/queries";
import type { Pedido } from "@/sales/pedidos/types";

export default async function PedidosPage() {
  let pedidos: Pedido[] = [];
  try {
    const datos = await obtenerPedidos();
    pedidos = datos.map((p) => ({
      ...p,
      subtotal:  Number(p.subtotal),
      descuento: Number(p.descuento),
      impuesto:  Number(p.impuesto),
      total:     Number(p.total),
    })) as unknown as Pedido[];
  } catch {
    // DB no configurada
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        titulo="Pedidos"
        descripcion="Gestiona todos tus pedidos de venta"
        accion={
          <ButtonLink href="/sales/pedidos/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo pedido
          </ButtonLink>
        }
      />
      {pedidos.length === 0 ? (
        <EmptyState
          Icono={ShoppingCart}
          titulo="Sin pedidos todavía"
          descripcion="Registra tu primer pedido para comenzar a gestionar tus ventas."
          accion={
            <ButtonLink href="/sales/pedidos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Crear primer pedido
            </ButtonLink>
          }
        />
      ) : (
        <ListaPedidos pedidos={pedidos} />
      )}
    </div>
  );
}
