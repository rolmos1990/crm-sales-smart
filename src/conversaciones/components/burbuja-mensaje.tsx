"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Lock, Check, CheckCheck, AlertCircle, ImageIcon, FileText, Mic, Video, EyeOff, Loader2, ShieldX, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { MensajeConMeta, MensajeReaccionResumen, RemitenteMsg, EstadoMensaje, TipoMensaje } from "../types";
import { BarraAccionesRapidas, SelectorReaccionesCompleto, BadgesReacciones } from "./reacciones-mensaje";

// ── Lightbox de imagen ────────────────────────────────────────────────────────

function LightboxImagen({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-stone-950/95 border-white/10 flex items-center justify-center overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-black/60 text-stone-300 hover:text-white hover:bg-black/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Imagen completa"
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Burbuja de imagen con thumbnail cliqueable ────────────────────────────────

function BurbujaImagen({ mensaje }: { mensaje: MensajeConMeta }) {
  const [lightboxAbierto, setLightboxAbierto] = useState(false);

  const estado = mensaje.mediaEstado;
  const esRechazada = estado === "ERROR" && mensaje.mediaErrorMensaje?.includes("RECHAZADA");

  // Estado: rechazada por seguridad
  if (esRechazada) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-danger-border bg-danger-muted px-3 py-2.5 min-w-[160px]">
        <ShieldX className="h-4 w-4 text-danger shrink-0" />
        <div>
          <p className="text-xs font-medium text-danger-text">Imagen no permitida</p>
          <p className="text-[10px] text-danger-text/70">Formato rechazado por seguridad</p>
        </div>
      </div>
    );
  }

  // Estado: error de procesamiento
  if (estado === "ERROR") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 min-w-[160px]">
        <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">No se pudo cargar la imagen</p>
      </div>
    );
  }

  // Estado: sin mediaArchivo (no se pudo procesar antes de encolarlo)
  if (!mensaje.mediaArchivoId && !mensaje.mediaUrl) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 min-w-[160px]">
        <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">Imagen no disponible</p>
      </div>
    );
  }

  // URL a mostrar como thumbnail (prioridad: urlThumbnail, luego mediaUrl)
  const thumbnailSrc = mensaje.mediaUrlThumbnail ?? mensaje.mediaUrl;
  // URL completa para el lightbox
  const fullSrc = mensaje.mediaUrlOptimizada ?? mensaje.mediaUrlThumbnail ?? mensaje.mediaUrl;

  if (!thumbnailSrc) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 min-w-[160px]">
        <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">Imagen no disponible</p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => fullSrc && setLightboxAbierto(true)}
        className="block rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-inbox-accent/40"
        title="Ver imagen completa"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailSrc}
          alt="Imagen recibida"
          loading="lazy"
          className="max-w-[240px] max-h-[240px] object-cover rounded-xl"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </button>
      {lightboxAbierto && fullSrc && (
        <LightboxImagen src={fullSrc} onClose={() => setLightboxAbierto(false)} />
      )}
    </>
  );
}

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
  LEIDO: <CheckCheck className="h-3 w-3 text-inbox-accent" />,
  FALLIDO: <AlertCircle className="h-3 w-3 text-danger" />,
};

interface BurbujaMensajeProps {
  mensaje: MensajeConMeta;
  onMarcarLeido?: (id: string) => void;
  leidoLocal?: boolean;
  reaccionesEfectivas?: MensajeReaccionResumen[];
  usuarioActualId?: string | null;
  onToggleReaccion?: (mensajeId: string, emoji: string, tipo: "CANAL" | "INTERNA") => void;
}

export function BurbujaMensaje({
  mensaje,
  onMarcarLeido,
  leidoLocal,
  reaccionesEfectivas,
  usuarioActualId = null,
  onToggleReaccion,
}: BurbujaMensajeProps) {
  const esPropioONota = (mensaje.remitente as RemitenteMsg) === "AGENTE" || (mensaje.remitente as RemitenteMsg) === "SISTEMA";
  const esNota = mensaje.esNotaInterna;
  const esContacto = (mensaje.remitente as RemitenteMsg) === "CONTACTO";
  const estadoEfectivo: EstadoMensaje = leidoLocal ? "LEIDO" : (mensaje.estado as EstadoMensaje);
  const esNoLeido = esContacto && estadoEfectivo !== "LEIDO";

  const [barraVisible, setBarraVisible] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const reacciones = reaccionesEfectivas ?? mensaje.reacciones ?? [];
  const conReacciones = !!onToggleReaccion;

  return (
    <div
      className={cn("flex flex-col w-full", esPropioONota ? "items-end" : "items-start")}
      onMouseEnter={() => conReacciones && setBarraVisible(true)}
      onMouseLeave={() => { if (!selectorAbierto) setBarraVisible(false); }}
    >
      {/* Contenedor relativo para la burbuja y la barra flotante */}
      <div className={cn("relative max-w-[80%]")}>
        {/* Barra flotante en hover */}
        {conReacciones && (
          <>
            <BarraAccionesRapidas
              mensajeId={mensaje.id}
              visible={barraVisible}
              esPropioONota={esPropioONota}
              onReaccion={(emoji, tipo) => onToggleReaccion(mensaje.id, emoji, tipo)}
              onAbrirSelector={() => setSelectorAbierto(true)}
            />
            <SelectorReaccionesCompleto
              open={selectorAbierto}
              onOpenChange={(v) => {
                setSelectorAbierto(v);
                if (!v) setBarraVisible(false);
              }}
              onReaccion={(emoji, tipo) => {
                onToggleReaccion(mensaje.id, emoji, tipo);
                setSelectorAbierto(false);
              }}
              esPropioONota={esPropioONota}
            />
          </>
        )}

        {/* Burbuja */}
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm leading-relaxed",
            esNota
              ? "bg-stage-amber-muted border border-stage-amber-border text-stage-amber-text rounded-tr-sm"
              : esPropioONota
                ? "bg-inbox-sent-bg border border-inbox-sent-border text-inbox-sent-text rounded-tr-sm"
                : "bg-muted border border-border text-text-secondary rounded-tl-sm"
          )}
        >
          {esNota && (
            <div className="flex items-center gap-1 text-[10px] text-stage-amber-text mb-1 font-medium uppercase tracking-wide">
              <Lock className="h-2.5 w-2.5" />
              Nota interna
            </div>
          )}
          {mensaje.contenido
            ? <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>
            : (() => {
                const esAudioTipo = mensaje.tipo === "AUDIO" || mensaje.tipo === "NOTA_VOZ";
                const esImagenTipo = mensaje.tipo === "IMAGEN";

                // ── Imagen recibida ───────────────────────────────────────
                if (esImagenTipo) {
                  return <BurbujaImagen mensaje={mensaje} />;
                }

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
                        <Mic className="h-3.5 w-3.5 text-inbox-accent-icon shrink-0" />
                        <span className="text-xs text-muted-foreground">
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
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs italic">
                    {fallback.icono}
                    {fallback.texto}
                    {esAudioTipo && (
                      <span className="text-muted-foreground text-[10px]">(procesando…)</span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs italic">
                    <EyeOff className="h-3.5 w-3.5 shrink-0" />
                    Este contenido no puede visualizarse. La conversación sigue disponible.
                  </span>
                );
              })()
          }

          {/* Footer: botón marcar leído + timestamp + estado */}
          <div className="flex items-center justify-between gap-2 mt-1">
            {esNoLeido && onMarcarLeido ? (
              <button
                type="button"
                onClick={() => onMarcarLeido(mensaje.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-muted-foreground hover:text-inbox-accent flex items-center gap-0.5 whitespace-nowrap shrink-0"
              >
                <Check className="h-2.5 w-2.5" />
                Marcar leído
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-1 ml-auto shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(mensaje.creadoEn), "HH:mm", { locale: es })}
              </span>
              {esPropioONota && !esNota && (
                <span className="text-muted-foreground">{iconoEstado[estadoEfectivo]}</span>
              )}
              {esContacto && !esNoLeido && (
                <span className="text-[9px] text-inbox-accent/70 flex items-center gap-0.5">
                  <Check className="h-2.5 w-2.5" />
                  Leído
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Badges de reacciones debajo de la burbuja */}
      {reacciones.length > 0 && (
        <div className="mt-1 mb-0.5">
          <BadgesReacciones
            reacciones={reacciones}
            usuarioActualId={usuarioActualId}
            onToggle={(emoji) =>
              onToggleReaccion?.(
                mensaje.id,
                emoji,
                reacciones.find((r) => r.emoji === emoji)?.tipo ?? "INTERNA"
              )
            }
          />
        </div>
      )}
    </div>
  );
}
