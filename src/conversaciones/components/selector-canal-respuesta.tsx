"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronDown, Loader2, Mail, MessageCircle, Plus, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanalRespuesta } from "./canales-respuesta";


const ETIQUETA_CANAL: Record<string, string> = {
  email: "Correo",
  instagram: "Instagram",
  facebook_messenger: "Messenger",
};

function etiquetaCanal(canal: string): string {
  if (canal.startsWith("whatsapp")) return "WhatsApp";
  return ETIQUETA_CANAL[canal] ?? canal;
}

// Mismo criterio de ícono/color por canal que el resto del Inbox.
function IconoCanal({ canal }: { canal: string }) {
  if (canal.startsWith("whatsapp")) return <MessageCircle className="h-3.5 w-3.5 text-success" />;
  if (canal === "instagram") return <Camera className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />;
  if (canal === "facebook_messenger") return <Send className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
  if (canal === "email") return <Mail className="h-3.5 w-3.5 text-info" />;
  return <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

interface SelectorCanalRespuestaProps {
  canales: CanalRespuesta[];
  conversacionActivaId: string;
  /** Recibe la cuenta elegida; si no tiene conversación, el caller la inicia. */
  onCambiar: (canal: CanalRespuesta) => void;
  cambiando?: boolean;
  className?: string;
}

/**
 * "Responder por": cuenta del negocio desde la que sale la respuesta. Cambiar
 * es pasar a la conversación del contacto en esa cuenta (o iniciarla).
 */
export function SelectorCanalRespuesta({
  canales,
  conversacionActivaId,
  onCambiar,
  cambiando = false,
  className,
}: SelectorCanalRespuestaProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const actual = canales.find((c) => c.conversacionId === conversacionActivaId) ?? canales[0];
  const hayOtros = canales.length > 1;

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  if (!actual) return null;

  return (
    <div ref={contenedor} data-slot="selector-canal-respuesta" className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => hayOtros && setAbierto((v) => !v)}
        disabled={!hayOtros || cambiando}
        aria-haspopup={hayOtros ? "listbox" : undefined}
        aria-expanded={hayOtros ? abierto : undefined}
        title={hayOtros ? "Cambiar la cuenta de respuesta" : "Solo se le puede responder por esta cuenta"}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-badge-border bg-badge-bg px-2 py-1.5 text-xs text-text-secondary transition-colors",
          hayOtros ? "hover:bg-muted" : "cursor-default",
        )}
      >
        <span className="text-muted-foreground">Responder por</span>
        {cambiando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IconoCanal canal={actual.canal} />}
        <span className="font-medium">{etiquetaCanal(actual.canal)}</span>
        <span className="max-w-[160px] truncate" title={actual.identificadorCuenta}>
          · {actual.nombreCuenta}
        </span>
        {hayOtros && <ChevronDown className={cn("h-3 w-3 transition-transform", abierto && "rotate-180")} />}
      </button>

      {abierto && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-50 mb-1 min-w-[240px] overflow-hidden rounded-xl border border-border bg-dropdown shadow-lg dark:shadow-xl"
        >
          {canales.map((c) => {
            const activo = c.cuentaCanalId === actual.cuentaCanalId;
            return (
              <button
                key={c.cuentaCanalId}
                type="button"
                role="option"
                aria-selected={activo}
                onClick={() => {
                  setAbierto(false);
                  if (!activo) onCambiar(c);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:bg-muted",
                  activo && "bg-inbox-accent-muted text-inbox-accent",
                )}
              >
                <IconoCanal canal={c.canal} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {etiquetaCanal(c.canal)} · {c.nombreCuenta}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {c.identificadorCuenta}
                    {c.identificadorContacto && <> → {c.identificadorContacto}</>}
                  </span>
                </span>
                {activo ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  !c.conversacionId && (
                    <span
                      className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"
                      title="Inicia una conversación nueva desde esta cuenta"
                    >
                      <Plus className="h-3 w-3" /> Nueva
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
