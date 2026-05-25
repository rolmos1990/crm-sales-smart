import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaEmpresas } from "@/crm/empresas/components/lista-empresas";
import { obtenerEmpresas } from "@/crm/empresas/queries";
import type { EmpresaConRelaciones } from "@/crm/empresas/types";

export default async function EmpresasPage() {
  let empresas: EmpresaConRelaciones[] = [];
  try {
    const datos = await obtenerEmpresas();
    empresas = datos as unknown as EmpresaConRelaciones[];
  } catch {
    // DB no configurada
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Empresas"
        descripcion="Gestiona las empresas y organizaciones de tu CRM"
        accion={
          <Link href="/crm/empresas/nueva">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva empresa
            </Button>
          </Link>
        }
      />
      {empresas.length === 0 ? (
        <EmptyState
          Icono={Building2}
          titulo="Sin empresas todavía"
          descripcion="Agrega tu primera empresa para organizar tus contactos y oportunidades."
          accion={
            <Link href="/crm/empresas/nueva">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear primera empresa
              </Button>
            </Link>
          }
        />
      ) : (
        <ListaEmpresas empresas={empresas} />
      )}
    </div>
  );
}
