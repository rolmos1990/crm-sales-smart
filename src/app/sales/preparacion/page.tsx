import { redirect } from "next/navigation";
import { PackageCheck, SearchX } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import {
  LIMITE_POR_ESTADO,
  obtenerActividadReciente,
  obtenerResumenPorProducto,
  obtenerTableroPreparacion,
} from "@/sales/preparacion/queries";
import { ActividadReciente } from "@/sales/preparacion/components/actividad-reciente";
import { PanelConfigPreparacion } from "@/sales/preparacion/components/panel-config-preparacion";
import { PreparacionTabsRango } from "@/sales/preparacion/components/preparacion-tabs-rango";
import { ResumenPorProducto } from "@/sales/preparacion/components/resumen-por-producto";
import { TableroLista } from "@/sales/preparacion/components/tablero-lista";
import { TableroCliente } from "@/sales/preparacion/components/tablero-cliente";
import { parsearExtremosDeSearchParams } from "@/shared/fechas/searchparams";
import { ProveedorNavegacionFiltros, ZonaResultados } from "@/shared/ui/navegacion-filtros";
import type { FiltrosTableroInput } from "@/sales/preparacion/schema";
import type { RangoPreparacion } from "@/sales/preparacion/types";

export const dynamic = "force-dynamic";

interface PreparacionPageProps {
  searchParams: Promise<{
    rango?: string;
    desde?: string;
    hasta?: string;
    q?: string;
    vista?: string;
    limite?: string;
    limites?: string;
    agrupacion?: string;
  }>;
}

const RANGOS_VALIDOS: RangoPreparacion[] = ["HOY", "MANANA", "SEMANA", "PERSONALIZADO"];

export default async function PreparacionPage({ searchParams }: PreparacionPageProps) {
  const sp = await searchParams;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "preparacion", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "preparacion");

  // Zona de negocio: define qué día es "hoy" para el tablero. Viene ya
  // resuelta en la sesión.
  const zonaHoraria = sesion.zonaNegocio;

  const rango = RANGOS_VALIDOS.includes(sp.rango as RangoPreparacion)
    ? (sp.rango as RangoPreparacion)
    : "HOY";

  // `hasta` pasa a ser inclusivo por día, igual que en Pedidos: antes era el
  // inicio del día elegido y `resolverRango` lo usa como límite exclusivo, así
  // que elegir "hasta el 17" dejaba el 17 fuera del tablero.
  const { desde, hasta } = parsearExtremosDeSearchParams(sp, zonaHoraria);

  const filtros: FiltrosTableroInput = {
    rango,
    desde,
    hasta,
    busqueda: sp.q,
  };

  // Paginación por columna. Los límites viven en la URL y no en estado de
  // cliente: así sobreviven al F5, a un cambio de filtro y al refresh que
  // dispara mover una tarjeta, sin lógica de merge aparte (mismo criterio que
  // el Kanban de pipeline).
  const limiteParsed = Number(sp.limite);
  const limitePorEstado =
    Number.isFinite(limiteParsed) && limiteParsed > 0 ? Math.floor(limiteParsed) : LIMITE_POR_ESTADO;

  // `?limites=estadoId:100,estadoId:150` — solo las columnas que el usuario ya
  // expandió más allá del default.
  const limitesPorEstado = new Map<string, number>();
  for (const par of (sp.limites ?? "").split(",")) {
    const [estadoId, valorRaw] = par.split(":");
    const valor = Number(valorRaw);
    if (estadoId && Number.isFinite(valor) && valor > 0) limitesPorEstado.set(estadoId, Math.floor(valor));
  }

  const [tablero, resumen, actividad] = await Promise.all([
    obtenerTableroPreparacion(sesion.instanciaId, zonaHoraria, filtros, limitePorEstado, limitesPorEstado),
    obtenerResumenPorProducto(sesion.instanciaId, zonaHoraria, filtros),
    obtenerActividadReciente(sesion.instanciaId),
  ]);

  const vista = sp.vista === "lista" ? "lista" : "kanban";
  const agrupacion =
    sp.agrupacion === "POR_PRODUCTO" || sp.agrupacion === "POR_PEDIDO"
      ? sp.agrupacion
      : tablero.configuracion.agrupacionDefecto;

  const totalTarjetas =
    tablero.columnas.reduce((acc, c) => acc + c.tarjetas.length, 0);
  const hayBusqueda = Boolean(filtros.busqueda);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        titulo="Preparación de pedidos"
        descripcion="Organiza, prepara y marca tus pedidos listos para entrega."
        accion={puedeMod ? <PanelConfigPreparacion configuracion={tablero.configuracion} /> : undefined}
      />

      {/* Filtros y resultados comparten la transición de navegación: al
          cambiar de rango o vista la barra queda montada con la selección ya
          marcada y el tablero se atenúa, en vez de saltar al loading.tsx. */}
      <ProveedorNavegacionFiltros>
        <PreparacionTabsRango
          rangoActivo={rango}
          desde={sp.desde ?? null}
          hasta={sp.hasta ?? null}
          contadores={tablero.contadores}
          busqueda={filtros.busqueda}
          vista={vista}
          zonaNegocio={zonaHoraria}
        />

        <ZonaResultados>
          {totalTarjetas === 0 ? (
            hayBusqueda ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16">
                <SearchX className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Ningún pedido coincide con esa búsqueda en este rango.
                </p>
              </div>
            ) : (
              <EmptyState
                Icono={PackageCheck}
                titulo="Nada para preparar en este rango"
                descripcion="Cuando un pedido llegue a una etapa que habilita la preparación, aparecerá acá automáticamente."
              />
            )
          ) : vista === "lista" ? (
            <TableroLista columnas={tablero.columnas} />
          ) : (
            <TableroCliente
              columnas={tablero.columnas}
              limitePorEstado={limitePorEstado}
              puedeMod={puedeMod}
              agrupacion={agrupacion}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <ResumenPorProducto resumen={resumen} />
            <ActividadReciente movimientos={actividad} />
          </div>
        </ZonaResultados>
      </ProveedorNavegacionFiltros>
    </div>
  );
}
