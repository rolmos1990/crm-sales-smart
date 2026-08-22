import { Wrench, MapPin, Calendar, Clock, Timer, User, FileText, Lock } from "lucide-react";
import { FormServicio } from "./form-servicio";
import type { Rol } from "@/generated/prisma/enums";
import { MODALIDAD_SERVICIO_LABELS } from "../constantes";

interface ServicioActual {
  id: string;
  modalidad?: string | null;
  fecha?: Date | null;
  hora?: string | null;
  duracion?: string | null;
  ubicacion?: string | null;
  direccion?: string | null;
  responsable?: string | null;
  instrucciones?: string | null;
  observaciones?: string | null;
}

interface SeccionServicioProps {
  pedidoId: string;
  rol: Rol;
  flujoVentaEtapa?: { permiteEditarEntrega: boolean } | null;
  servicio?: ServicioActual | null;
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

export async function SeccionServicio({
  pedidoId,
  rol,
  flujoVentaEtapa,
  servicio,
}: SeccionServicioProps) {
  const puedeEditar = ["OWNER", "ADMIN"].includes(rol) && (flujoVentaEtapa?.permiteEditarEntrega ?? false);

  return (
    <div className="rounded-2xl border border-white/10 bg-white dark:bg-white/[0.03] backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-lime-400/10 p-1.5">
            <Wrench className="h-4 w-4 text-lime-600 dark:text-lime-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-50">Servicio y seguimiento</h3>
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
          <FormServicio pedidoId={pedidoId} servicio={servicio} />
        ) : servicio ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <CampoInfo
              icono={Wrench}
              label="Modalidad"
              valor={servicio.modalidad ? MODALIDAD_SERVICIO_LABELS[servicio.modalidad] : null}
            />
            <CampoInfo
              icono={Calendar}
              label="Fecha"
              valor={servicio.fecha ? new Date(servicio.fecha).toLocaleDateString("es-PE", { dateStyle: "medium" }) : null}
            />
            <CampoInfo icono={Clock} label="Hora / franja horaria" valor={servicio.hora} />
            <CampoInfo icono={Timer} label="Duración" valor={servicio.duracion} />
            <CampoInfo icono={MapPin} label="Ubicación" valor={servicio.ubicacion} />
            <CampoInfo icono={MapPin} label="Dirección" valor={servicio.direccion} />
            <CampoInfo icono={User} label="Responsable / Técnico" valor={servicio.responsable} />
            <CampoInfo icono={FileText} label="Instrucciones" valor={servicio.instrucciones} />
            <CampoInfo icono={FileText} label="Observaciones" valor={servicio.observaciones} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <Wrench className="h-5 w-5 text-stone-400" />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-500">Sin datos del servicio</p>
            {!["OWNER", "ADMIN"].includes(rol) && (
              <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">
                Solo los administradores pueden registrar el servicio
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
