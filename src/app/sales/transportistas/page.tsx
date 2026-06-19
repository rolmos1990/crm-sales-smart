import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { requireSesion } from "@/shared/auth/sesion";
import { obtenerTransportistas } from "@/sales/transportistas/queries";
import { ListaTransportistas } from "@/sales/transportistas/components/lista-transportistas";
import { DialogTransportista } from "@/sales/transportistas/components/dialog-transportista";
import { PageHeader } from "@/shared/ui/page-header";

export default async function TransportistasPage() {
  const sesion = await requireSesion();

  if (!["OWNER", "ADMIN"].includes(sesion.rol)) {
    redirect("/sales/pedidos");
  }

  const transportistas = await obtenerTransportistas(sesion.instanciaId);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-lime-500/10 dark:bg-lime-400/10 p-2.5">
          <Truck className="h-5 w-5 text-lime-600 dark:text-lime-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Transportistas
          </h1>
          <p className="text-sm text-stone-400 dark:text-stone-500">
            Catálogo de métodos y carriers de entrega
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white dark:bg-white/[0.03] backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] p-6">
        <PageHeader
          titulo="Catálogo"
          descripcion={`${transportistas.length} transportista${transportistas.length !== 1 ? "s" : ""} registrado${transportistas.length !== 1 ? "s" : ""}`}
          accion={<DialogTransportista tipo="crear" />}
        />
        <ListaTransportistas transportistas={transportistas} />
      </div>
    </div>
  );
}
