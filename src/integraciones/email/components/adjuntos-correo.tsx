"use client";

import { Download, FileText, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RespuestaCorreoMensaje } from "./use-correo-mensaje";

export function etiquetaTipoArchivo(mime: string | null): string {
  if (!mime) return "Archivo";
  const sub = mime.split("/")[1] ?? mime;
  if (sub === "pdf") return "PDF";
  if (sub.includes("wordprocessing") || sub === "msword") return "Word";
  if (sub.includes("spreadsheet") || sub === "vnd.ms-excel") return "Excel";
  if (sub.includes("presentation")) return "PowerPoint";
  return sub.toUpperCase().slice(0, 12);
}

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Adjuntos del correo con nombre, tipo y tamaño (US4). La descarga sale de una
 * ruta que fuerza `attachment` y `application/octet-stream`: un HTML o SVG
 * adjunto nunca se abre dentro de Karia (FR-025).
 */
export function AdjuntosCorreo({
  adjuntos,
  className,
}: {
  adjuntos: RespuestaCorreoMensaje["adjuntos"];
  className?: string;
}) {
  if (adjuntos.length === 0) return null;
  return (
    <div data-slot="adjuntos-correo" className={cn("mt-3 pt-3 border-t border-card-divider", className)}>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
        <Paperclip className="h-3 w-3" />
        {adjuntos.length === 1 ? "1 archivo adjunto" : `${adjuntos.length} archivos adjuntos`}
      </p>
      <ul className="flex flex-wrap gap-2">
        {adjuntos.map((a) => (
          <li key={a.id} className="max-w-full">
            <a
              href={a.urlDescarga}
              download={a.nombre}
              className="inline-flex max-w-full items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2 hover:bg-muted/70 transition-colors"
            >
              <span className="h-8 w-8 shrink-0 rounded-md bg-danger-muted border border-danger-border flex items-center justify-center">
                <FileText className="h-4 w-4 text-danger" />
              </span>
              <span className="min-w-0">
                <span className="block max-w-[14rem] text-xs font-medium text-foreground truncate" title={a.nombre}>
                  {a.nombre}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {etiquetaTipoArchivo(a.mimeType)} · {tamanoLegible(a.bytes)}
                </span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Descargar" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
