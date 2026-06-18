import { Plus, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaContactos } from "@/crm/contactos/components/lista-contactos";
import { obtenerContactos } from "@/crm/contactos/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar } from "@/shared/auth/permisos";
import type { Contacto } from "@/crm/contactos/types";

export default async function ContactosPage() {
  const sesion = await requireSesion();
  const puedeMod = puedeModificar(sesion.rol, "contactos");
  let contactos: Contacto[] = [];
  try {
    const datos = await obtenerContactos(sesion.instanciaId);
    contactos = datos as unknown as Contacto[];
  } catch {
    // DB no configurada aún
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Contactos"
        descripcion="Gestiona tus contactos y relaciones comerciales"
        accion={puedeMod ? (
          <ButtonLink href="/crm/contactos/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo contacto
          </ButtonLink>
        ) : undefined}
      />
      {contactos.length === 0 ? (
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
        <ListaContactos contactos={contactos} />
      )}
    </div>
  );
}
