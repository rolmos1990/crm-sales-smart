"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Lock, Check, CheckCheck, AlertCircle, ImageIcon, FileText, Mic, Video, EyeOff } from "lucide-react";
import type { MensajeConMeta, RemitenteMsg, EstadoMensaje, TipoMensaje } from "../types";

const TIPO_FALLBACK: Partial<Record<TipoMensaje, { icono: React.ReactNode; texto: string }>> = {
  IMAGEN:    { icono: <ImageIcon className="h-3.5 w-3.5" />, texto: "Imagen" },
  VIDEO:     { icono: <Video className="h-3.5 w-3.5" />,     texto: "Video" },
  AUDIO:     { icono: <Mic className="h-3.5 w-3.5" />,       texto: "Audio" },
  NOTA_VOZ:  { icono: <Mic className="h-3.5 w-3.5" />,       texto: "Nota de voz" },
  DOCUMENTO: { icono: <FileText className="h-3.5 w-3.5" />,  texto: "Documento" },
};

const iconoEstado: Record<EstadoMensaje, React.ReactNode> = {
  RECIBIDO: <Check className="h-3 w-3" />,
  ENVIADO: <Check className="h-3 w-3" />,
  ENTREGADO: <CheckCheck className="h-3 w-3" />,
  LEIDO: <CheckCheck className="h-3 w-3 text-lime-400" />,
  FALLIDO: <AlertCircle className="h-3 w-3 text-red-400" />,
};

interface BurbujaMensajeProps {
  mensaje: MensajeConMeta;
  onMarcarLeido?: (id: string) => void;
  leidoLocal?: boolean;
}

export function BurbujaMensaje({ mensaje, onMarcarLeido, leidoLocal }: BurbujaMensajeProps) {
  const esPropioONota = (mensaje.remitente as RemitenteMsg) === "AGENTE" || (mensaje.remitente as RemitenteMsg) === "SISTEMA";
  const esNota = mensaje.esNotaInterna;
  const esContacto = (mensaje.remitente as RemitenteMsg) === "CONTACTO";
  const estadoEfectivo: EstadoMensaje = leidoLocal ? "LEIDO" : (mensaje.estado as EstadoMensaje);
  const esNoLeido = esContacto && estadoEfectivo !== "LEIDO";

  return (
    <div className={cn("flex w-full group", esPropioONota ? "justify-end" : "justify-start")}>
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
        {mensaje.contenido
          ? <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>
          : (() => {
              const esAudioTipo = mensaje.tipo === "AUDIO" || mensaje.tipo === "NOTA_VOZ";

              if (esAudioTipo && mensaje.mediaUrl) {
                const minutos = mensaje.mediaDuracion
                  ? Math.floor(mensaje.mediaDuracion / 60)
                  : null;
                const segundos = mensaje.mediaDuracion
                  ? String(mensaje.mediaDuracion % 60).padStart(2, "0")
                  : null;
                return (
                  <div className="flex flex-col gap-1.5 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-lime-400 shrink-0" />
                      <span className="text-xs text-stone-400">
                        {mensaje.tipo === "NOTA_VOZ" ? "Nota de voz" : "Audio"}
                        {minutos !== null && segundos !== null
                          ? ` · ${minutos}:${segundos}`
                          : ""}
                      </span>
                    </div>
                    <audio
                      controls
                      src={mensaje.mediaUrl}
                      preload="metadata"
                      className="w-full max-w-[260px] h-8"
                    />
                  </div>
                );
              }

              const fallback = TIPO_FALLBACK[mensaje.tipo as TipoMensaje];
              return fallback ? (
                <span className="flex items-center gap-1.5 text-stone-400 text-xs italic">
                  {fallback.icono}
                  {fallback.texto}
                  {esAudioTipo && (
                    <span className="text-stone-500 text-[10px]">(procesando…)</span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-stone-500 text-xs italic">
                  <EyeOff className="h-3.5 w-3.5 shrink-0" />
                  Este contenido no puede visualizarse. La conversación sigue disponible.
                </span>
              );
            })()
        }

        {/* Footer: botón marcar leído (hover) + timestamp + estado */}
        <div className="flex items-center justify-between gap-2 mt-1">
          {/* Botón dentro de la burbuja para no afectar el layout externo */}
          {esNoLeido && onMarcarLeido ? (
            <button
              type="button"
              onClick={() => onMarcarLeido(mensaje.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-stone-500 hover:text-lime-400 flex items-center gap-0.5 whitespace-nowrap shrink-0"
            >
              <Check className="h-2.5 w-2.5" />
              Marcar leído
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1 ml-auto shrink-0">
            <span className="text-[10px] text-stone-500">
              {format(new Date(mensaje.creadoEn), "HH:mm", { locale: es })}
            </span>
            {esPropioONota && !esNota && (
              <span className="text-stone-500">{iconoEstado[estadoEfectivo]}</span>
            )}
            {esContacto && !esNoLeido && (
              <span className="text-[9px] text-lime-500/60 flex items-center gap-0.5">
                <Check className="h-2.5 w-2.5" />
                Leído
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
