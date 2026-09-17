import { redirect } from "next/navigation";
import { PackageCheck, SearchX } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import {
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
import { parseYMD, inicioDiaEnZona } from "@/sales/pedidos/utils/fechas-zona";
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
    agrupacion?: string;
  }>;
}

const RANGOS_VALIDOS: RangoPreparacion[] = ["HOY", "MANANA", "SEMANA", "PERSONALIZADO"];

export default async function PreparacionPage({ searchParams }: PreparacionPageProps) {
  const sp = await searchParams;
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "preparacion", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "preparacion");

  let zonaHoraria = "America/Lima";
  try {
    const config = await obtenerConfiguracionEmpresa(sesion.instanciaId);
    if (config?.zonaHoraria) zonaHoraria = config.zonaHoraria;
  } catch {
    // usa el default
  }

  const rango = RANGOS_VALIDOS.includes(sp.rango as RangoPreparacion)
    ? (sp.rango as RangoPreparacion)
    : "HOY";

  const filtros: FiltrosTableroInput = {
    rango,
    desde: sp.desde ? inicioDiaEnZona(parseYMD(sp.desde), zonaHoraria) : undefined,
    hasta: sp.hasta ? inicioDiaEnZona(parseYMD(sp.hasta), zonaHoraria) : undefined,
    busqueda: sp.q,
  };

  const [tablero, resumen, actividad] = await Promise.all([
    obtenerTableroPreparacion(sesion.instanciaId, zonaHoraria, filtros),
    obtenerResumenPorProducto(sesion.instanciaId, zonaHoraria, filtros),
    obtenerActividadReciente(sesion.instanciaId),
  ]);

  const vista = sp.vista === "lista" ? "lista" : "kanban";
  const agrupacion =
    sp.agrupacion === "POR_PRODUCTO" || sp.agrupacion === "POR_PEDIDO"
      ? sp.agrupacion
      : tablero.configuracion.agrupacionDefecto;

  const totalTarjetas =
    tablero.columnas.reduce((acc, c) => acc + c.tarjetas.length, 0) + tablero.sinFecha.length;
  const hayBusqueda = Boolean(filtros.busqueda);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        titulo="Preparación de pedidos"
        descripcion="Organiza, prepara y marca tus pedidos listos para entrega."
        accion={puedeMod ? <PanelConfigPreparacion configuracion={tablero.configuracion} /> : undefined}
      />

      <PreparacionTabsRango
        rangoActivo={rango}
        contadores={tablero.contadores}
        busqueda={filtros.busqueda}
        vista={vista}
      />

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
        <TableroLista columnas={tablero.columnas} sinFecha={tablero.sinFecha} />
      ) : (
        <TableroCliente
          columnas={tablero.columnas}
          sinFecha={tablero.sinFecha}
          puedeMod={puedeMod}
          agrupacion={agrupacion}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ResumenPorProducto resumen={resumen} />
        <ActividadReciente movimientos={actividad} />
      </div>
    </div>
  );
}
