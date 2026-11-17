"use client";

import { ExternalLink, X, type LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { AvisoOtroCanal } from "../types";

/**
 * 035 — "También hay un mensaje nuevo por WhatsApp".
 *
 * El error caro del día a día es responderle a alguien por un canal sin saber
 * que escribió algo más nuevo por otro. Este aviso existe para eso y para nada
 * más: nombra el canal, dice cuándo escribió, y ofrece ir.
 *
 * Se calcula con las conversaciones que el Inbox ya cargó — no pide nada al
 * servidor (FR-015).
 */

interface AvisoOtroCanalBannerProps {
  aviso: AvisoOtroCanal;
  nombreContacto: string;
  onIr: (conversacionId: string) => void;
  onDescartar: (mensajeId: string) => void;
  infoCanal: (canal: string | undefined) => { Icono: LucideIcon; clase: string };
}

export function AvisoOtroCanalBanner({
  aviso,
  nombreContacto,
  onIr,
  onDescartar,
  infoCanal,
}: AvisoOtroCanalBannerProps) {
  const canal = infoCanal(aviso.canal);
  const cuando = formatDistanceToNow(aviso.fecha, { addSuffix: true, locale: es });

  return (
    <div className="shrink-0 px-3 md:px-4 py-2.5 border-b border-inbox-accent-border bg-inbox-accent-muted flex items-center gap-3">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/60",
          canal.clase,
        )}
      >
        <canal.Icono className="h-3.5 w-3.5" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          También hay un mensaje nuevo por {aviso.nombreCanal}.
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {nombreContacto} escribió {cuando}.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onIr(aviso.conversacionId)}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-inbox-accent-border bg-background/60 px-2.5 py-1.5 text-[11px] font-medium text-inbox-accent transition-colors hover:bg-background"
      >
        Ver conversación
        <ExternalLink className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={() => onDescartar(aviso.mensajeId)}
        aria-label="Descartar aviso"
        title="Descartar aviso"
        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
