"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Lock, Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import type { MensajeConMeta, RemitenteMsg, EstadoMensaje } from "../types";

const iconoEstado: Record<EstadoMensaje, React.ReactNode> = {
  RECIBIDO: <Check className="h-3 w-3" />,
  ENVIADO: <Check className="h-3 w-3" />,
  ENTREGADO: <CheckCheck className="h-3 w-3" />,
  LEIDO: <CheckCheck className="h-3 w-3 text-lime-400" />,
  FALLIDO: <AlertCircle className="h-3 w-3 text-red-400" />,
};

interface BurbujaMensajeProps {
  mensaje: MensajeConMeta;
}

export function BurbujaMensaje({ mensaje }: BurbujaMensajeProps) {
  const esPropioONota = (mensaje.remitente as RemitenteMsg) === "AGENTE" || (mensaje.remitente as RemitenteMsg) === "SISTEMA";
  const esNota = mensaje.esNotaInterna;

  return (
    <div className={cn("flex w-full", esPropioONota ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          esNota
            ? "bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-tr-sm"
            : esPropioONota
              ? "bg-lime-500/20 border border-lime-500/20 text-stone-100 rounded-tr-sm"
              : "bg-white/5 border border-white/10 text-stone-200 rounded-tl-sm"
        )}
      >
        {esNota && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 mb-1 font-medium uppercase tracking-wide">
            <Lock className="h-2.5 w-2.5" />
            Nota interna
          </div>
        )}
        {mensaje.contenido && <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px] text-stone-500">
            {format(new Date(mensaje.creadoEn), "HH:mm", { locale: es })}
          </span>
          {esPropioONota && !esNota && (
            <span className="text-stone-500">{iconoEstado[mensaje.estado as EstadoMensaje]}</span>
          )}
        </div>
      </div>
    </div>
  );
}
