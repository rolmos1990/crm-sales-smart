import { Plus, ShoppingCart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaPedidos } from "@/sales/pedidos/components/lista-pedidos";
import { PedidosKpiCards } from "@/sales/pedidos/components/pedidos-kpi-cards";
import { PedidosFiltrosBar } from "@/sales/pedidos/components/pedidos-filtros";
import { obtenerPedidos, obtenerPedidosKpis, type PedidosFiltros } from "@/sales/pedidos/queries";
import { obtenerFlujoVenta } from "@/sales/flujo-venta/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import type { Pedido } from "@/sales/pedidos/types";
import type { PedidosKpis } from "@/sales/pedidos/queries";

export const dynamic = "force-dynamic";

interface PedidosPageProps {
  searchParams: Promise<{
    q?: string;
    desde?: string;
    hasta?: string;
    estado?: string;
    metodo?: string;
    contactoId?: string;
    productoId?: string;
  }>;
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const sp = await searchParams;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "pedidos", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "pedidos");

  const filtros: PedidosFiltros = {
    busqueda: sp.q || undefined,
    desde: sp.desde ? new Date(`${sp.desde}T00:00:00`) : undefined,
    hasta: sp.hasta ? new Date(`${sp.hasta}T23:59:59`) : undefined,
    estado: sp.estado || undefined,
    metodoEntrega: sp.metodo || undefined,
    contactoId: sp.contactoId || undefined,
    productoId: sp.productoId || undefined,
  };

  let pedidos: Pedido[] = [];
  let kpis: PedidosKpis = { totalPedidos: 0, totalVentas: 0, pendientes: 0, expirados: 0, entregados: 0 };
  let etapasFlujo: { id: string; nombre: string; color: string | null; esFinal: boolean; esCancelacion: boolean; esSecuencial: boolean; orden: number; parentId: string | null }[] = [];
  let contactosDb: Awaited<ReturnType<typeof buscarContactos>> = [];
  let productosDb: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];
  let moneda = "PEN";

  try {
    const [datos, kpisDatos, flujo, contactosRes, productosRes, monedaRes] = await Promise.all([
      obtenerPedidos(sesion.instanciaId, filtros),
      obtenerPedidosKpis(sesion.instanciaId, filtros),
      obtenerFlujoVenta(sesion.instanciaId),
      buscarContactos("", sesion.instanciaId),
      obtenerProductosCatalogo(sesion.instanciaId),
      obtenerMonedaPrincipal(sesion.instanciaId),
    ]);
    pedidos = datos.map((p) => ({
      ...p,
      subtotal:  Number(p.subtotal),
      descuento: Number(p.descuento),
      impuesto:  Number(p.impuesto),
      total:     Number(p.total),
    })) as unknown as Pedido[];
    kpis = kpisDatos;
    etapasFlujo = flujo?.etapas ?? [];
    contactosDb = contactosRes;
    productosDb = productosRes;
    moneda = monedaRes;
  } catch (err) {
    console.error("[PedidosPage] Error al cargar pedidos:", err);
  }

  const opcionesContactos = contactosDb.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));
  const opcionesProductos = productosDb.map((p) => ({ valor: p.id, etiqueta: p.nombre }));
  const hayPedidosSinFiltrar = pedidos.length > 0 || Object.values(filtros).some(Boolean);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        titulo="Pedidos"
        descripcion="Gestiona todos tus pedidos de venta"
        accion={puedeMod ? (
          <ButtonLink href="/sales/pedidos/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo pedido
          </ButtonLink>
        ) : undefined}
      />

      {!hayPedidosSinFiltrar ? (
        <EmptyState
          Icono={ShoppingCart}
          titulo="Sin pedidos todavía"
          descripcion="Registra tu primer pedido para comenzar a gestionar tus ventas."
          accion={puedeMod ? (
            <ButtonLink href="/sales/pedidos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Crear primer pedido
            </ButtonLink>
          ) : undefined}
        />
      ) : (
        <>
          <PedidosFiltrosBar contactos={opcionesContactos} productos={opcionesProductos} pedidosFiltrados={pedidos} />
          <PedidosKpiCards kpis={kpis} moneda={moneda} hayRangoFecha={!!(filtros.desde || filtros.hasta)} />
          <ListaPedidos pedidos={pedidos} etapasFlujo={etapasFlujo} />
        </>
      )}
    </div>
  );
}
