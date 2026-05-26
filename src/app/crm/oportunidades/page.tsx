import { Plus, TrendingUp } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { EmptyState } from "@/shared/ui/empty-state";
import { ListaOportunidades } from "@/crm/oportunidades/components/lista-oportunidades";
import { obtenerOportunidades } from "@/crm/oportunidades/queries";
import type { Oportunidad } from "@/crm/oportunidades/types";

export default async function OportunidadesPage() {
  let oportunidades: Oportunidad[] = [];
  try {
    const datos = await obtenerOportunidades();
    oportunidades = datos.map((o) => ({ ...o, valor: Number(o.valor) })) as unknown as Oportunidad[];
  } catch {
    // DB no configurada
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        titulo="Oportunidades"
        descripcion="Gestiona todas tus oportunidades de venta"
        accion={
          <ButtonLink href="/crm/oportunidades/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva oportunidad
          </ButtonLink>
        }
      />
      {oportunidades.length === 0 ? (
        <EmptyState
          Icono={TrendingUp}
          titulo="Sin oportunidades todavía"
          descripcion="Crea tu primera oportunidad para empezar a gestionar tu pipeline de ventas."
          accion={
            <ButtonLink href="/crm/oportunidades/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Crear primera oportunidad
            </ButtonLink>
          }
        />
      ) : (
        <ListaOportunidades oportunidades={oportunidades} />
      )}
    </div>
  );
}
