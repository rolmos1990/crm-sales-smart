"use client";

import { Camera, Mail, MessageCircle, Send, ExternalLink, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatearIdentificadorWA } from "@/lib/whatsapp-utils";
import { resumirIdentidades } from "../agrupacion";
import type { ConversacionResumen, IdentidadCanalResumen } from "../types";

/**
 * 035 — "Identidades / canales vinculados".
 *
 * Todos los canales por los que esta persona está registrada. El dato ya
 * viajaba con la conversación y se descartaba al mapear; mostrarlo no cuesta
 * una consulta.
 *
 * Sirve para dos cosas: saber por dónde más puede escribir un cliente, y
 * notar que dos registros son la misma persona — que hoy es invisible, porque
 * el identificador de Instagram no se parece a un teléfono ni a un correo y
 * nunca se deduplica solo.
 */

// Mismo criterio de ícono y color por canal que el resto del Inbox (ver
// infoCanal en inbox-layout.tsx y SelectorCuentaCanal).
function iconoCanal(canal: string): { Icono: LucideIcon; clase: string } {
  if (canal.startsWith("whatsapp")) return { Icono: MessageCircle, clase: "text-success" };
  if (canal === "instagram") return { Icono: Camera, clase: "text-pink-600 dark:text-pink-400" };
  if (canal === "facebook_messenger") return { Icono: Send, clase: "text-blue-600 dark:text-blue-400" };
  if (canal === "email") return { Icono: Mail, clase: "text-info" };
  return { Icono: MessageCircle, clase: "text-muted-foreground" };
}

const NOMBRE_CANAL: Record<string, string> = {
  whatsapp_lite: "WhatsApp",
  whatsapp_business: "WhatsApp",
  instagram: "Instagram",
  facebook_messenger: "Messenger",
  email: "Correo",
};

function etiquetaCanal(canal: string): string {
  return NOMBRE_CANAL[canal] ?? canal.replace("_", " ");
}

/** Lo que se le muestra al agente: el @usuario si el canal lo expone, y si no,
 *  el identificador — con el formato de WhatsApp cuando corresponde, para no
 *  mostrar un JID crudo. */
function textoIdentidad(identidad: IdentidadCanalResumen): string {
  if (identidad.handle) return identidad.handle;
  if (identidad.canal.startsWith("whatsapp")) {
    return formatearIdentificadorWA(identidad.identificador) || identidad.identificador;
  }
  return identidad.identificador;
}

interface SeccionIdentidadesCanalProps {
  identidades: IdentidadCanalResumen[];
  /** Conversaciones del contacto que el Inbox YA tiene cargadas. */
  conversacionesDelContacto: ConversacionResumen[];
  /** Id de la conversación abierta, para marcarla como "estás acá". */
  conversacionActualId: string;
  /** Abre otra conversación del contacto; ausente = no hay a dónde ir. */
  onAbrirConversacion?: (conversacionId: string) => void;
}

export function SeccionIdentidadesCanal({
  identidades,
  conversacionesDelContacto,
  conversacionActualId,
  onAbrirConversacion,
}: SeccionIdentidadesCanalProps) {
  if (identidades.length === 0) return null;

  const items = resumirIdentidades({ identidades, conversacionesDelContacto });

  return (
    <>
      <div className="pt-2 pb-1 px-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          Identidades / canales vinculados
        </p>
      </div>

      <div className="px-2 space-y-1">
        {items.map((item) => {
          const { Icono, clase } = iconoCanal(item.canal);
          const esActual = item.conversacionId === conversacionActualId;
          const puedeAbrir = !!item.conversacionId && !esActual && !!onAbrirConversacion;

          const contenido = (
            <>
              <Icono className={cn("h-3.5 w-3.5 shrink-0", clase)} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {etiquetaCanal(item.canal)}
                </p>
                <p className="text-xs text-text-secondary truncate">{textoIdentidad(item)}</p>
              </div>
              {esActual && (
                <span className="shrink-0 text-[9px] font-semibold text-inbox-accent">Acá</span>
              )}
              {puedeAbrir && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />}
            </>
          );

          // Sin conversación cargada no hay a dónde ir: se muestra como canal
          // registrado y nada más. No se pide nada al servidor para
          // completarlo (FR-018).
          return puedeAbrir ? (
            <button
              key={`${item.canal}-${item.identificador}`}
              type="button"
              onClick={() => onAbrirConversacion!(item.conversacionId!)}
              className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
            >
              {contenido}
            </button>
          ) : (
            <div
              key={`${item.canal}-${item.identificador}`}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2",
                esActual && "bg-inbox-accent-muted",
              )}
            >
              {contenido}
            </div>
          );
        })}
      </div>
    </>
  );
}
