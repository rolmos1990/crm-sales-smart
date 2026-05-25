import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaContactos } from "@/crm/contactos/components/lista-contactos";
import { obtenerContactos } from "@/crm/contactos/queries";
import type { Contacto } from "@/crm/contactos/types";

export default async function ContactosPage() {
  let contactos: Contacto[] = [];
  try {
    const datos = await obtenerContactos();
    contactos = datos as unknown as Contacto[];
  } catch {
    // DB no configurada aún
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Contactos"
        descripcion="Gestiona tus contactos y relaciones comerciales"
        accion={
          <Link href="/crm/contactos/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo contacto
            </Button>
          </Link>
        }
      />
      {contactos.length === 0 ? (
        <EmptyState
          Icono={Users}
          titulo="Sin contactos todavía"
          descripcion="Crea tu primer contacto para empezar a gestionar tus relaciones."
          accion={
            <Link href="/crm/contactos/nuevo">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear primer contacto
              </Button>
            </Link>
          }
        />
      ) : (
        <ListaContactos contactos={contactos} />
      )}
    </div>
  );
}
