import { Plus, ShoppingCart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { VistaPedidos } from "@/sales/pedidos/components/vista-pedidos";
import { cargarVistaPedidos, type EtapaFlujoVista, type VistaPedidos as DatosVistaPedidos } from "@/sales/pedidos/vista";
import { FILTROS_VISTA_PEDIDOS_DEFECTO } from "@/sales/pedidos/schema";
import { etiquetaMesAnioEnZona } from "@/shared/fechas/zona";
import { rangoMesHastaAhora } from "@/shared/fechas/rangos";
import { obtenerFlujoVenta } from "@/sales/flujo-venta/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { redirect } from "next/navigation";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";

export const dynamic = "force-dynamic";

interface PedidosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  // Los filtros viven en estado de cliente (ver VistaPedidos), nunca en la URL.
  // Un link viejo con `?entrega=hoy` & cía. se limpia en vez de aplicarse.
  if (Object.keys(await searchParams).length > 0) redirect("/sales/pedidos");

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "pedidos", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "pedidos");

  // Zona de negocio: define qué día es "hoy" para filtros y KPIs. Viene ya
  // resuelta en la sesión.
  const zonaHoraria = sesion.zonaNegocio;

  // Se necesita antes de consultar: "Ver cerrados" oculta por default las
  // etapas esFinal/esCancelacion, y para eso hay que saber cuáles son.
  let etapasFlujo: EtapaFlujoVista[] = [];
  try {
    const flujo = await obtenerFlujoVenta(sesion.instanciaId);
    etapasFlujo = flujo?.etapas ?? [];
  } catch (err) {
    console.error("[PedidosPage] Error al cargar el flujo de venta:", err);
  }

  const etiquetaMesActual = etiquetaMesAnioEnZona(rangoMesHastaAhora(zonaHoraria).hasta, zonaHoraria);

  let inicial: DatosVistaPedidos = {
    pedidos: [],
    kpis: { totalPedidos: 0, totalVentas: 0, totalVentasMesActual: 0, pendientes: 0, expirados: 0, entregados: 0 },
    cerradosForzados: false,
    hayFiltrosActivos: false,
    hayRangoFecha: false,
  };
  let contactosDb: Awaited<ReturnType<typeof buscarContactos>> = [];
  let productosDb: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];
  let moneda = "PEN";

  try {
    const [vista, contactosRes, productosRes, monedaRes] = await Promise.all([
      cargarVistaPedidos(sesion.instanciaId, zonaHoraria, FILTROS_VISTA_PEDIDOS_DEFECTO, etapasFlujo),
      buscarContactos("", sesion.instanciaId),
      obtenerProductosCatalogo(sesion.instanciaId),
      obtenerMonedaPrincipal(sesion.instanciaId),
    ]);
    inicial = vista;
    contactosDb = contactosRes;
    productosDb = productosRes;
    moneda = monedaRes;
  } catch (err) {
    console.error("[PedidosPage] Error al cargar pedidos:", err);
  }

  const opcionesContactos = contactosDb.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));
  const opcionesProductos = productosDb.map((p) => ({ valor: p.id, etiqueta: p.nombre }));
  // `kpis.totalPedidos` no aplica "ocultarCerrados" (ver obtenerPedidosKpis)
  // — es el total real de la instancia, sin el ocultamiento por-defecto de
  // cerrados. Usarlo acá (en vez de `pedidos.length`, que sí lo aplica) evita
  // que una instancia con TODOS sus pedidos ya Entregados/Cancelados caiga al
  // EmptyState de "Sin pedidos todavía" y pierda las KPIs y la barra de
  // filtros — ahí es justo donde vive el checkbox "Ver cerrados".
  const hayPedidos = inicial.kpis.totalPedidos > 0;

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

      {!hayPedidos ? (
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
        <VistaPedidos
          inicial={inicial}
          contactos={opcionesContactos}
          productos={opcionesProductos}
          etapasFlujo={etapasFlujo}
          zonaNegocio={zonaHoraria}
          moneda={moneda}
          etiquetaMesActual={etiquetaMesActual}
        />
      )}
    </div>
  );
}
