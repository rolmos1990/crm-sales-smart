import { Plus, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar, verificarAcceso } from "@/shared/auth/permisos";
import { obtenerEtapasFlujoActivo } from "@/sales/flujo-venta/queries";
import { obtenerUmbralesSeguimiento } from "@/crm/contactos/queries";
import { FILTROS_VISTA_CONTACTOS_DEFECTO } from "@/crm/contactos/schema";
import { cargarVistaContactos } from "@/crm/contactos/vista";
import { VistaContactos } from "@/crm/contactos/components/vista-contactos";
import type { VistaContactos as DatosVistaContactos } from "@/crm/contactos/types";

// Los indicadores y el seguimiento dependen de la hora actual y del Flujo de
// Venta vigente: nunca se sirven cacheados.
export const dynamic = "force-dynamic";

export default async function ContactosPage() {
  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "contactos", "ver").permitido) redirect("/acceso-denegado");
  const puedeMod = puedeModificar(sesion.rol, "contactos");

  const [etapas, umbrales] = await Promise.all([
    obtenerEtapasFlujoActivo(sesion.instanciaId),
    obtenerUmbralesSeguimiento(sesion.instanciaId),
  ]);
  const inicial = await cargarVistaContactos(sesion.instanciaId, sesion.zonaNegocio, FILTROS_VISTA_CONTACTOS_DEFECTO, etapas, umbrales);

  const botonNuevo = puedeMod ? (
    <ButtonLink href="/crm/contactos/nuevo">
      <Plus className="mr-2 h-4 w-4" />
      Nuevo contacto
    </ButtonLink>
  ) : undefined;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Contactos"
        descripcion="Conoce y gestiona tus contactos, clientes y oportunidades comerciales"
        accion={botonNuevo}
      />
      {inicial.indicadores.total === 0 ? (
        <EmptyState
          Icono={Users}
          titulo="Sin contactos todavía"
          descripcion="Crea tu primer contacto para empezar a gestionar tus relaciones."
          accion={puedeMod ? (
            <ButtonLink href="/crm/contactos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Crear primer contacto
            </ButtonLink>
          ) : undefined}
        />
      ) : (
        <VistaContactos inicial={inicial} />
      )}
    </div>
  );
}
