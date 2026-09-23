import { redirect } from "next/navigation";
import { PageHeader } from "@/shared/ui/page-header";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import { obtenerActividadReciente } from "@/sales/preparacion/queries";
import { cargarVistaPreparacion } from "@/sales/preparacion/vista";
import { FILTROS_VISTA_PREPARACION_DEFECTO } from "@/sales/preparacion/schema";
import { ActividadReciente } from "@/sales/preparacion/components/actividad-reciente";
import { PanelConfigPreparacion } from "@/sales/preparacion/components/panel-config-preparacion";
import { VistaPreparacion } from "@/sales/preparacion/components/vista-preparacion";

export const dynamic = "force-dynamic";

interface PreparacionPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PreparacionPage({ searchParams }: PreparacionPageProps) {
  // Los filtros viven en estado de cliente (ver VistaPreparacion), nunca en la
  // URL. Un link viejo con `?rango=…` se limpia en vez de aplicarse.
  if (Object.keys(await searchParams).length > 0) redirect("/sales/preparacion");

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "preparacion", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "preparacion");

  // Zona de negocio: define qué día es "hoy" para el tablero. Viene ya
  // resuelta en la sesión.
  const zonaHoraria = sesion.zonaNegocio;

  const [inicial, actividad] = await Promise.all([
    cargarVistaPreparacion(sesion.instanciaId, zonaHoraria, FILTROS_VISTA_PREPARACION_DEFECTO),
    obtenerActividadReciente(sesion.instanciaId),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        titulo="Preparación de pedidos"
        descripcion="Organiza, prepara y marca tus pedidos listos para entrega."
        accion={puedeMod ? <PanelConfigPreparacion configuracion={inicial.tablero.configuracion} /> : undefined}
      />

      <VistaPreparacion
        inicial={inicial}
        puedeMod={puedeMod}
        zonaNegocio={zonaHoraria}
        actividad={<ActividadReciente movimientos={actividad} />}
      />
    </div>
  );
}
