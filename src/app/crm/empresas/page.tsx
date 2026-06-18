import { Plus, Building2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaEmpresas } from "@/crm/empresas/components/lista-empresas";
import { obtenerEmpresas } from "@/crm/empresas/queries";
import { requireSesion } from "@/shared/auth/sesion";
import { puedeModificar } from "@/shared/auth/permisos";
import type { EmpresaConRelaciones } from "@/crm/empresas/types";

export default async function EmpresasPage() {
  const sesion = await requireSesion();
  const puedeMod = puedeModificar(sesion.rol, "empresas");
  let empresas: EmpresaConRelaciones[] = [];
  try {
    const datos = await obtenerEmpresas(sesion.instanciaId);
    empresas = datos as unknown as EmpresaConRelaciones[];
  } catch {
    // DB no configurada
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Empresas"
        descripcion="Gestiona las empresas y organizaciones de tu CRM"
        accion={puedeMod ? (
          <ButtonLink href="/crm/empresas/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva empresa
          </ButtonLink>
        ) : undefined}
      />
      {empresas.length === 0 ? (
        <EmptyState
          Icono={Building2}
          titulo="Sin empresas todavía"
          descripcion="Agrega tu primera empresa para organizar tus contactos y oportunidades."
          accion={puedeMod ? (
            <ButtonLink href="/crm/empresas/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Crear primera empresa
            </ButtonLink>
          ) : undefined}
        />
      ) : (
        <ListaEmpresas empresas={empresas} />
      )}
    </div>
  );
}
