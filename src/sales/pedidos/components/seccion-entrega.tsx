import { Truck, MapPin, Hash, Link2, Calendar, FileText, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { obtenerTransportistas } from "@/sales/transportistas/queries";
import { FormEntrega } from "./form-entrega";
import type { Rol } from "@/generated/prisma/enums";
import { METODO_ENTREGA_LABELS as METODO_LABELS } from "../constantes";

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: "Pendiente",  color: "text-stone-400 bg-stone-100/50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700" },
  PREPARANDO: { label: "Preparando", color: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-400/10 border-yellow-200 dark:border-yellow-400/20" },
  EN_CAMINO:  { label: "En camino",  color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border-blue-200 dark:border-blue-400/20" },
  ENTREGADO:  { label: "Entregado",  color: "text-lime-700 dark:text-lime-400 bg-lime-50 dark:bg-lime-400/10 border-lime-200 dark:border-lime-400/20" },
  FALLIDO:    { label: "Fallido",    color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border-red-200 dark:border-red-400/20" },
  CANCELADO:  { label: "Cancelado",  color: "text-stone-500 bg-stone-100/50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700" },
  DEVUELTO:   { label: "Devuelto",   color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-400/10 border-orange-200 dark:border-orange-400/20" },
};

interface EntregaConTransportista {
  id: string;
  metodoEntrega: string;
  estadoEntrega: string;
  transportistaId?: string | null;
  transportista?: { id: string; nombre: string; tipo: string } | null;
  numeroGuia?: string | null;
  urlSeguimiento?: string | null;
  fechaEstimada?: Date | null;
  observaciones?: string | null;
}

interface SeccionEntregaProps {
  pedidoId: string;
  instanciaId: string;
  rol: Rol;
  flujoVentaEtapa?: { permiteEditarEntrega: boolean } | null;
  entrega?: EntregaConTransportista | null;
}

function CampoInfo({ icono: Icono, label, valor }: { icono: React.ElementType; label: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex items-start gap-2">
      <Icono className="h-3.5 w-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-stone-400 dark:text-stone-500">{label}</p>
        <p className="text-sm text-stone-700 dark:text-stone-300">{valor}</p>
      </div>
    </div>
  );
}

export async function SeccionEntrega({
  pedidoId,
  instanciaId,
  rol,
  flujoVentaEtapa,
  entrega,
}: SeccionEntregaProps) {
  const puedeEditar = ["OWNER", "ADMIN"].includes(rol) && (flujoVentaEtapa?.permiteEditarEntrega ?? false);
  const transportistas = puedeEditar ? await obtenerTransportistas(instanciaId) : [];

  const estadoConfig = entrega ? (ESTADO_CONFIG[entrega.estadoEntrega] ?? ESTADO_CONFIG.PENDIENTE) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white dark:bg-white/[0.03] backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-lime-400/10 p-1.5">
            <Truck className="h-4 w-4 text-lime-600 dark:text-lime-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-50">Entrega y seguimiento</h3>
            {entrega && estadoConfig && (
              <span className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium mt-0.5",
                estadoConfig.color
              )}>
                {estadoConfig.label}
              </span>
            )}
          </div>
        </div>
        {!puedeEditar && ["OWNER", "ADMIN"].includes(rol) && (
          <div className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-600">
            <Lock className="h-3 w-3" />
            <span>Bloqueado por etapa</span>
          </div>
        )}
      </div>

      <div className="p-5">
        {puedeEditar ? (
          <FormEntrega
            pedidoId={pedidoId}
            entrega={entrega}
            transportistas={transportistas}
          />
        ) : entrega ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <CampoInfo
              icono={Truck}
              label="Método"
              valor={METODO_LABELS[entrega.metodoEntrega] ?? entrega.metodoEntrega}
            />
            <CampoInfo
              icono={MapPin}
              label="Transportista"
              valor={entrega.transportista?.nombre}
            />
            <CampoInfo icono={Hash} label="N° de guía" valor={entrega.numeroGuia} />
            <CampoInfo
              icono={Calendar}
              label="Fecha estimada"
              valor={entrega.fechaEstimada
                ? new Date(entrega.fechaEstimada).toLocaleDateString("es-PE", { dateStyle: "medium" })
                : null
              }
            />
            {entrega.urlSeguimiento && (
              <div className="col-span-2 flex items-start gap-2">
                <Link2 className="h-3.5 w-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400 dark:text-stone-500">Seguimiento</p>
                  <a
                    href={entrega.urlSeguimiento}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-lime-600 dark:text-lime-400 hover:underline truncate block max-w-sm"
                  >
                    {entrega.urlSeguimiento}
                  </a>
                </div>
              </div>
            )}
            <CampoInfo
              icono={FileText}
              label="Observaciones"
              valor={entrega.observaciones}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <Truck className="h-5 w-5 text-stone-400" />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-500">Sin datos de entrega</p>
            {!["OWNER", "ADMIN"].includes(rol) && (
              <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">
                Solo los administradores pueden registrar la entrega
              </p>
            )}
            {["OWNER", "ADMIN"].includes(rol) && !puedeEditar && (
              <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">
                Activa "Permite editar entrega" en la etapa actual del flujo de venta
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
