import { Download, Mail, Link2, Hash, User, Calendar, FileText, Lock } from "lucide-react";
import { FormEntregaDigital } from "./form-entrega-digital";
import type { Rol } from "@/generated/prisma/enums";
import { METODO_ENTREGA_DIGITAL_LABELS } from "../constantes";

interface EntregaDigitalActual {
  id: string;
  metodo?: string | null;
  email?: string | null;
  url?: string | null;
  archivo?: string | null;
  codigo?: string | null;
  usuarioAcceso?: string | null;
  fechaEntrega?: Date | null;
  fechaExpiracion?: Date | null;
  instrucciones?: string | null;
  observaciones?: string | null;
}

interface SeccionEntregaDigitalProps {
  pedidoId: string;
  rol: Rol;
  flujoVentaEtapa?: { permiteEditarEntrega: boolean } | null;
  entregaDigital?: EntregaDigitalActual | null;
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

export async function SeccionEntregaDigital({
  pedidoId,
  rol,
  flujoVentaEtapa,
  entregaDigital,
}: SeccionEntregaDigitalProps) {
  const puedeEditar = ["OWNER", "ADMIN"].includes(rol) && (flujoVentaEtapa?.permiteEditarEntrega ?? false);

  return (
    <div className="rounded-2xl border border-white/10 bg-white dark:bg-white/[0.03] backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-lime-400/10 p-1.5">
            <Download className="h-4 w-4 text-lime-600 dark:text-lime-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-50">Entrega digital y seguimiento</h3>
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
          <FormEntregaDigital pedidoId={pedidoId} entregaDigital={entregaDigital} />
        ) : entregaDigital ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <CampoInfo
              icono={Download}
              label="Método"
              valor={entregaDigital.metodo ? METODO_ENTREGA_DIGITAL_LABELS[entregaDigital.metodo] : null}
            />
            <CampoInfo icono={Mail} label="Email" valor={entregaDigital.email} />
            <CampoInfo icono={Hash} label="Código / Licencia" valor={entregaDigital.codigo} />
            <CampoInfo icono={User} label="Usuario / Referencia" valor={entregaDigital.usuarioAcceso} />
            <CampoInfo
              icono={Calendar}
              label="Fecha de entrega"
              valor={entregaDigital.fechaEntrega
                ? new Date(entregaDigital.fechaEntrega).toLocaleDateString("es-PE", { dateStyle: "medium" })
                : null
              }
            />
            <CampoInfo
              icono={Calendar}
              label="Fecha de expiración"
              valor={entregaDigital.fechaExpiracion
                ? new Date(entregaDigital.fechaExpiracion).toLocaleDateString("es-PE", { dateStyle: "medium" })
                : null
              }
            />
            {(entregaDigital.url || entregaDigital.archivo) && (
              <div className="col-span-2 flex items-start gap-2">
                <Link2 className="h-3.5 w-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-400 dark:text-stone-500">
                    {entregaDigital.url ? "URL / Link" : "Archivo / Recurso"}
                  </p>
                  {entregaDigital.url ? (
                    <a
                      href={entregaDigital.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-lime-600 dark:text-lime-400 hover:underline truncate block max-w-sm"
                    >
                      {entregaDigital.url}
                    </a>
                  ) : (
                    <p className="text-sm text-stone-700 dark:text-stone-300">{entregaDigital.archivo}</p>
                  )}
                </div>
              </div>
            )}
            <CampoInfo
              icono={FileText}
              label="Instrucciones"
              valor={entregaDigital.instrucciones}
            />
            <CampoInfo
              icono={FileText}
              label="Observaciones"
              valor={entregaDigital.observaciones}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-white/5 flex items-center justify-center mb-3">
              <Download className="h-5 w-5 text-stone-400" />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-500">Sin datos de entrega digital</p>
            {!["OWNER", "ADMIN"].includes(rol) && (
              <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">
                Solo los administradores pueden registrar la entrega digital
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
