import { Plus, ShoppingCart, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaPedidos } from "@/sales/pedidos/components/lista-pedidos";
import { PedidosKpiCards } from "@/sales/pedidos/components/pedidos-kpi-cards";
import { PedidosFiltrosBar } from "@/sales/pedidos/components/pedidos-filtros";
import { obtenerPedidos, obtenerPedidosKpis, type PedidosFiltros } from "@/sales/pedidos/queries";
import { rangoDiaEnZona, rangoMesActualEnZona, etiquetaMesAnioEnZona, inicioDiaEnZona, parseYMD, sumarDias } from "@/sales/pedidos/utils/fechas-zona";
import { obtenerFlujoVenta } from "@/sales/flujo-venta/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerMonedaPrincipal, obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
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
    etapa?: string;
    metodo?: string;
    contactoId?: string;
    productoId?: string;
    entrega?: string;
    entregaDesde?: string;
    entregaHasta?: string;
    cerrados?: string;
  }>;
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const sp = await searchParams;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "pedidos", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "pedidos");

  let zonaHoraria = "America/Lima";
  try {
    const config = await obtenerConfiguracionEmpresa(sesion.instanciaId);
    if (config?.zonaHoraria) zonaHoraria = config.zonaHoraria;
  } catch {
    // usa el default
  }

  // "Entrega estimada": hoy/mañana se resuelven server-side en la zona
  // horaria de negocio (no en la del servidor ni la del navegador — ver
  // utils/fechas-zona.ts). Personalizado usa el rango tal cual lo eligió el
  // usuario, interpretado como día completo en esa misma zona.
  let entregaDesde: Date | undefined;
  let entregaHasta: Date | undefined;
  if (sp.entrega === "hoy") {
    ({ desde: entregaDesde, hasta: entregaHasta } = rangoDiaEnZona(zonaHoraria, 0));
  } else if (sp.entrega === "manana") {
    ({ desde: entregaDesde, hasta: entregaHasta } = rangoDiaEnZona(zonaHoraria, 1));
  } else if (sp.entrega === "personalizado") {
    // "Hasta" es exclusivo (< inicio del día siguiente) para incluir el día
    // completo elegido, sin depender de la hora guardada en fechaEntrega.
    if (sp.entregaDesde) entregaDesde = inicioDiaEnZona(parseYMD(sp.entregaDesde), zonaHoraria);
    if (sp.entregaHasta) entregaHasta = inicioDiaEnZona(sumarDias(parseYMD(sp.entregaHasta), 1), zonaHoraria);
  }

  // Se necesita antes de armar `filtros`: "Ver cerrados" oculta por default
  // las etapas esFinal/esCancelacion, y para eso hay que saber cuáles son.
  let etapasFlujo: { id: string; nombre: string; color: string | null; esFinal: boolean; esCancelacion: boolean; esSecuencial: boolean; orden: number; parentId: string | null }[] = [];
  try {
    const flujo = await obtenerFlujoVenta(sesion.instanciaId);
    etapasFlujo = flujo?.etapas ?? [];
  } catch (err) {
    console.error("[PedidosPage] Error al cargar el flujo de venta:", err);
  }
  const etapaIdsCerradas = etapasFlujo.length > 0
    ? etapasFlujo.filter((e) => e.esFinal || e.esCancelacion).map((e) => e.id)
    : undefined;

  const filtros: PedidosFiltros = {
    busqueda: sp.q || undefined,
    desde: sp.desde ? new Date(`${sp.desde}T00:00:00`) : undefined,
    hasta: sp.hasta ? new Date(`${sp.hasta}T23:59:59`) : undefined,
    // "estado" (enum legacy) y "etapa" (Flujo de Venta dinámico) son
    // mutuamente excluyentes en la práctica — la barra de filtros ofrece uno
    // u otro según si el tenant tiene un flujo dinámico activo.
    estado: sp.estado || undefined,
    flujoVentaEtapaId: sp.etapa || undefined,
    metodoEntrega: sp.metodo || undefined,
    contactoId: sp.contactoId || undefined,
    productoId: sp.productoId || undefined,
    entregaDesde,
    entregaHasta,
    // "Ver cerrados" — desmarcado por default (ver checkbox en la barra de
    // filtros); ?cerrados=1 lo activa y muestra también los cerrados.
    ocultarCerrados: sp.cerrados !== "1",
    etapaIdsCerradas,
  };

  const rangoMesActual = rangoMesActualEnZona(zonaHoraria);
  const etiquetaMesActual = etiquetaMesAnioEnZona(rangoMesActual.hasta, zonaHoraria);

  let pedidos: Pedido[] = [];
  let kpis: PedidosKpis = { totalPedidos: 0, totalVentas: 0, totalVentasMesActual: 0, pendientes: 0, expirados: 0, entregados: 0 };
  let contactosDb: Awaited<ReturnType<typeof buscarContactos>> = [];
  let productosDb: Awaited<ReturnType<typeof obtenerProductosCatalogo>> = [];
  let moneda = "PEN";

  try {
    const [datos, kpisDatos, contactosRes, productosRes, monedaRes] = await Promise.all([
      obtenerPedidos(sesion.instanciaId, filtros),
      obtenerPedidosKpis(sesion.instanciaId, filtros, rangoMesActual),
      buscarContactos("", sesion.instanciaId),
      obtenerProductosCatalogo(sesion.instanciaId),
      obtenerMonedaPrincipal(sesion.instanciaId),
    ]);
    pedidos = datos.map((p) => ({
      ...p,
      subtotal:   Number(p.subtotal),
      descuento:  Number(p.descuento),
      impuesto:   Number(p.impuesto),
      costoEnvio: Number(p.costoEnvio),
      total:      Number(p.total),
    })) as unknown as Pedido[];
    kpis = kpisDatos;
    contactosDb = contactosRes;
    productosDb = productosRes;
    moneda = monedaRes;
  } catch (err) {
    console.error("[PedidosPage] Error al cargar pedidos:", err);
  }

  const opcionesContactos = contactosDb.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` }));
  const opcionesProductos = productosDb.map((p) => ({ valor: p.id, etiqueta: p.nombre }));
  // "ocultarCerrados"/"etapaIdsCerradas" son estado derivado, no filtros que
  // el usuario haya elegido explícitamente — no cuentan para decidir si hay
  // que mostrar "Sin pedidos todavía" vs. "No encontramos pedidos con estos
  // filtros" (ver EmptyState más abajo).
  const hayFiltrosActivos = Boolean(
    filtros.busqueda || filtros.desde || filtros.hasta || filtros.estado ||
    filtros.flujoVentaEtapaId || filtros.metodoEntrega || filtros.contactoId ||
    filtros.productoId || filtros.entregaDesde || filtros.entregaHasta
  );
  // `kpis.totalPedidos` no aplica "ocultarCerrados" (ver obtenerPedidosKpis)
  // — es el total real de la instancia con los filtros explícitos del
  // usuario, sin el ocultamiento por-defecto de cerrados. Usarlo acá (en vez
  // de `pedidos.length`, que sí lo aplica) evita que una instancia con TODOS
  // sus pedidos ya Entregados/Cancelados caiga al EmptyState de "Sin pedidos
  // todavía" y pierda las KPIs y la barra de filtros — ahí es justo donde
  // vive el checkbox "Ver cerrados" para poder volver a verlos.
  const hayPedidosSinFiltrar = kpis.totalPedidos > 0 || hayFiltrosActivos;

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
          <PedidosFiltrosBar contactos={opcionesContactos} productos={opcionesProductos} pedidosFiltrados={pedidos} etapasFlujo={etapasFlujo} />
          <PedidosKpiCards kpis={kpis} moneda={moneda} hayRangoFecha={!!(filtros.desde || filtros.hasta)} etiquetaMesActual={etiquetaMesActual} />
          {pedidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-200 dark:border-white/10 py-16">
              <div className="h-12 w-12 rounded-2xl bg-stone-100 dark:bg-white/5 flex items-center justify-center">
                <SearchX className="h-5 w-5 text-stone-300 dark:text-stone-600" />
              </div>
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                {hayFiltrosActivos
                  ? "No encontramos pedidos con estos filtros."
                  : "Todos tus pedidos están cerrados (entregados o cancelados)."}
              </p>
              {hayFiltrosActivos ? (
                <ButtonLink href="/sales/pedidos" variant="outline" size="sm">
                  Limpiar filtros
                </ButtonLink>
              ) : (
                <ButtonLink href="/sales/pedidos?cerrados=1" variant="outline" size="sm">
                  Ver cerrados
                </ButtonLink>
              )}
            </div>
          ) : (
            <ListaPedidos pedidos={pedidos} etapasFlujo={etapasFlujo} zonaHoraria={zonaHoraria} />
          )}
        </>
      )}
    </div>
  );
}
