"use client";

import { useState } from "react";
import {
  AlertCircle, Check, ChevronDown, ChevronUp, Download, FileText, Lock, Mail, Paperclip, Reply, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { AvatarContacto } from "@/conversaciones/components/avatar-contacto";
import { BloqueErrorEnvio, BurbujaImagen } from "@/conversaciones/components/burbuja-mensaje";
import { EventoSistema } from "@/conversaciones/components/evento-sistema";
import type { EstadoMensaje, MensajeConMeta } from "@/conversaciones/types";
import { AdjuntosCorreo, etiquetaTipoArchivo } from "./adjuntos-correo";
import { CabecerasCorreo } from "./cabeceras-correo";
import { CuerpoCorreo } from "./cuerpo-correo";
import { useCorreoMensaje } from "./use-correo-mensaje";

export interface ParticipantesHilo {
  /** La foto es la del contacto: la primera que llegó por cualquier canal
   *  (el correo nunca trae foto, así que no la pisa). */
  contacto: { nombre: string; apellido: string; avatarUrl: string | null };
  /** Dirección del cliente. */
  direccionContacto: string | null;
  /** El buzón del comercio que recibe y responde. */
  buzon: { nombre: string; identificador: string } | null;
}

function esCorreoReal(m: MensajeConMeta) {
  return m.tipo !== "EVENTO_SISTEMA" && !m.esNotaInterna;
}

// ── Encabezado del hilo ──────────────────────────────────────────────────────

export function EncabezadoHiloCorreo({
  asunto,
  mensajes,
  className,
}: {
  asunto: string | null;
  mensajes: MensajeConMeta[];
  className?: string;
}) {
  const total = mensajes.filter(esCorreoReal).length;
  return (
    <div
      data-slot="encabezado-hilo-correo"
      className={cn("flex items-center gap-3 px-4 py-3 border-b border-border shrink-0", className)}
    >
      <div className="h-9 w-9 shrink-0 rounded-lg bg-muted border border-border flex items-center justify-center">
        <Mail className="h-4 w-4 text-info" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm md:text-base font-semibold text-foreground truncate" title={asunto ?? undefined}>
          {asunto?.trim() || "(Sin asunto)"}
        </h2>
        <p className="text-[11px] text-muted-foreground">
          {total === 1 ? "1 mensaje en esta conversación" : `${total} mensajes en esta conversación`}
        </p>
      </div>
      <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full border border-badge-border bg-badge-bg px-2 py-0.5 text-[10px] font-semibold text-info">
        <Mail className="h-2.5 w-2.5" />
        Correo
      </span>
    </div>
  );
}

// ── Hilo ─────────────────────────────────────────────────────────────────────

interface HiloCorreoProps extends ParticipantesHilo {
  mensajes: MensajeConMeta[];
  idsLeidosLocal: Set<string>;
  onMarcarLeido: (id: string) => void;
  /** Lleva el foco al compositor de respuesta. */
  onResponder: () => void;
}

/**
 * Vista de hilo para el canal correo: cada mensaje es una tarjeta plegable,
 * los anteriores contraídos y el último abierto, como en un cliente de correo.
 *
 * El cuerpo se muestra con formato solo dentro de un iframe aislado
 * (CuerpoCorreo); el HTML del correo nunca entra en el DOM de esta página
 * (regla de seguridad del canal, ver CLAUDE.md §9).
 */
export function HiloCorreo({
  mensajes,
  idsLeidosLocal,
  onMarcarLeido,
  onResponder,
  contacto,
  direccionContacto,
  buzon,
}: HiloCorreoProps) {
  // Solo se guarda lo que el agente cambió a mano: el resto sale de la regla
  // por defecto, así un correo nuevo que llega por SSE se abre solo.
  const [alternados, setAlternados] = useState<Map<string, boolean>>(new Map());

  const ultimoCorreoId = [...mensajes].reverse().find((m) => m.tipo !== "EVENTO_SISTEMA")?.id;

  const abiertoPorDefecto = (m: MensajeConMeta) =>
    m.id === ultimoCorreoId ||
    (m.remitente === "CONTACTO" && m.estado !== "LEIDO" && !idsLeidosLocal.has(m.id));

  const alternar = (id: string, actual: boolean) =>
    setAlternados((prev) => new Map(prev).set(id, !actual));

  if (mensajes.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
        Sin correos aún
      </div>
    );
  }

  return (
    <div data-slot="hilo-correo" className="space-y-2">
      {mensajes.map((m) =>
        m.tipo === "EVENTO_SISTEMA" ? (
          <EventoSistema key={m.id} mensaje={m} />
        ) : (
          <TarjetaCorreo
            key={m.id}
            mensaje={m}
            abierto={alternados.get(m.id) ?? abiertoPorDefecto(m)}
            onAlternar={(actual) => alternar(m.id, actual)}
            leidoLocal={idsLeidosLocal.has(m.id)}
            onMarcarLeido={onMarcarLeido}
            onResponder={onResponder}
            contacto={contacto}
            direccionContacto={direccionContacto}
            buzon={buzon}
          />
        ),
      )}
    </div>
  );
}

// ── Tarjeta de un correo ─────────────────────────────────────────────────────

const ETIQUETA_ESTADO: Partial<Record<EstadoMensaje, string>> = {
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
  LEIDO: "Leído",
};

interface TarjetaCorreoProps extends ParticipantesHilo {
  mensaje: MensajeConMeta;
  abierto: boolean;
  onAlternar: (actual: boolean) => void;
  leidoLocal: boolean;
  onMarcarLeido: (id: string) => void;
  onResponder: () => void;
}

function TarjetaCorreo({
  mensaje,
  abierto,
  onAlternar,
  leidoLocal,
  onMarcarLeido,
  onResponder,
  contacto,
  direccionContacto,
  buzon,
}: TarjetaCorreoProps) {
  const esContacto = mensaje.remitente === "CONTACTO";
  const esNota = mensaje.esNotaInterna;
  const esAppNativa = mensaje.remitente === "AGENTE_CANAL_NATIVO";
  const noLeido = esContacto && mensaje.estado !== "LEIDO" && !leidoLocal;
  const fallido = !esContacto && !esNota && mensaje.estado === "FALLIDO";
  const tieneAdjunto = mensaje.tipo !== "TEXTO" && mensaje.tipo !== "EVENTO_SISTEMA";

  const nombreContacto = `${contacto.nombre} ${contacto.apellido}`.trim() || direccionContacto || "Cliente";
  const de = esNota
    ? { nombre: "Nota interna", direccion: null }
    : esContacto
      ? { nombre: nombreContacto, direccion: direccionContacto }
      : { nombre: buzon?.nombre ?? "Tu buzón", direccion: buzon?.identificador ?? null };
  const para = esNota ? null : esContacto ? buzon?.identificador ?? null : direccionContacto;

  const resumen = (mensaje.contenido ?? "").replace(/\s+/g, " ").trim();

  // Cabeceras, HTML aislado y adjuntos: se piden recién al abrir la tarjeta.
  const correo = useCorreoMensaje(mensaje.id, abierto && !esNota);

  return (
    <article
      data-slot="tarjeta-correo"
      className={cn(
        "rounded-xl border transition-colors",
        esNota
          ? "border-stage-amber-border bg-stage-amber-muted"
          : abierto
            ? "border-border bg-card shadow-sm"
            : "border-border bg-card/60 hover:bg-card",
        fallido && "border-danger-border",
      )}
    >
      {/* Cabecera: siempre visible. Clic para plegar/desplegar. */}
      <button
        type="button"
        onClick={() => onAlternar(abierto)}
        aria-expanded={abierto}
        className="w-full flex items-start gap-3 px-3 md:px-4 py-3 text-left"
      >
        {esNota ? (
          <span className="h-8 w-8 shrink-0 rounded-full border border-stage-amber-border flex items-center justify-center text-stage-amber-text">
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : esContacto ? (
          <AvatarContacto
            nombre={contacto.nombre}
            apellido={contacto.apellido}
            avatarUrl={contacto.avatarUrl}
            className="h-8 w-8 text-xs shrink-0"
          />
        ) : (
          <span className="h-8 w-8 shrink-0 rounded-full bg-inbox-accent-muted border border-inbox-accent-border flex items-center justify-center text-xs font-semibold text-inbox-accent">
            {(buzon?.nombre ?? "K").charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span
              className={cn(
                "text-[13px] truncate",
                esNota ? "text-stage-amber-text" : "text-foreground",
                noLeido ? "font-bold" : "font-semibold",
              )}
            >
              {de.nombre}
            </span>
            {de.direccion && (
              <span className="hidden sm:inline text-[11px] text-muted-foreground truncate">
                &lt;{de.direccion}&gt;
              </span>
            )}
          </div>

          {abierto ? (
            <div className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground">
              {esAppNativa && (
                <p className="flex items-center gap-1">
                  <Smartphone className="h-2.5 w-2.5" />
                  Enviado desde el cliente de correo, fuera de Karia
                </p>
              )}
            </div>
          ) : (
            <p className={cn("mt-0.5 text-[12px] truncate", noLeido ? "text-text-secondary" : "text-muted-foreground")}>
              {resumen || "(Sin contenido)"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {noLeido && <span className="h-1.5 w-1.5 rounded-full bg-inbox-accent" aria-label="No leído" />}
          {!abierto && tieneAdjunto && <Paperclip className="h-3 w-3 text-muted-foreground" aria-label="Con adjunto" />}
          {fallido && <AlertCircle className="h-3.5 w-3.5 text-danger" aria-label="No se pudo enviar" />}
          <FechaHora valor={mensaje.creadoEn} modo="fechaHora" className="text-[11px] text-muted-foreground whitespace-nowrap" />
          {abierto ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {abierto && (
        <div className="px-3 md:px-4 pb-3 md:pl-[3.75rem]">
          {esNota ? (
            mensaje.contenido ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stage-amber-text">
                {mensaje.contenido}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground">(Sin contenido de texto)</p>
            )
          ) : (
            <>
              <CabecerasCorreo
                cabeceras={correo.data?.cabeceras ?? null}
                respaldoPara={para}
                fechaRespaldo={mensaje.creadoEn}
                className="mb-3"
              />
              <CuerpoCorreo
                textoPlano={mensaje.contenido ?? ""}
                datos={correo.data}
                cargando={correo.isLoading}
                error={correo.isError}
                asunto={correo.data?.cabeceras?.asunto ?? null}
              />
            </>
          )}

          {correo.data && correo.data.adjuntos.length > 0 ? (
            <AdjuntosCorreo adjuntos={correo.data.adjuntos} />
          ) : (
            tieneAdjunto && <AdjuntoCorreo mensaje={mensaje} />
          )}

          {fallido && <BloqueErrorEnvio codigoError={mensaje.codigoError} motivoError={mensaje.motivoError} />}

          {!esNota && (
            <div className="mt-3 pt-2 border-t border-card-divider flex items-center gap-1.5">
              <button
                type="button"
                onClick={onResponder}
                className="inline-flex items-center gap-1.5 rounded-lg border border-button-secondary-border bg-button-secondary-bg hover:bg-button-secondary-hover px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors"
              >
                <Reply className="h-3 w-3" />
                Responder
              </button>
              {noLeido && (
                <button
                  type="button"
                  onClick={() => onMarcarLeido(mensaje.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-inbox-accent hover:bg-muted transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Marcar leído
                </button>
              )}
              {!esContacto && ETIQUETA_ESTADO[mensaje.estado] && (
                <span className="ml-auto text-[10px] text-muted-foreground">{ETIQUETA_ESTADO[mensaje.estado]}</span>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── Adjunto (correos previos a 035) ──────────────────────────────────────────

/**
 * Para correos sin datos de correo guardados: el adjunto principal viaja en
 * los campos de media del mensaje (ver normalizar.ts) y los demás vienen
 * listados por nombre dentro del cuerpo. Desde 035 se usa AdjuntosCorreo.
 */
function AdjuntoCorreo({ mensaje }: { mensaje: MensajeConMeta }) {
  return (
    <div className="mt-3 pt-3 border-t border-card-divider">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
        <Paperclip className="h-3 w-3" />
        Archivo adjunto
      </p>
      {mensaje.tipo === "IMAGEN" ? (
        <BurbujaImagen mensaje={mensaje} />
      ) : mensaje.mediaUrl ? (
        <a
          href={mensaje.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2 hover:bg-muted/70 transition-colors"
        >
          <span className="h-8 w-8 shrink-0 rounded-md bg-danger-muted border border-danger-border flex items-center justify-center">
            <FileText className="h-4 w-4 text-danger" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-foreground truncate">Documento adjunto</span>
            <span className="block text-[10px] text-muted-foreground">{etiquetaTipoArchivo(mensaje.mediaMimeType)}</span>
          </span>
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      ) : (
        <p className="text-xs italic text-muted-foreground">El adjunto no está disponible.</p>
      )}
    </div>
  );
}
