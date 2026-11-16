"use client";

import { useState } from "react";
import { AlertCircle, ImageOff, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PERMISOS_SANDBOX } from "@/integraciones/email/vista/documento";
import type { RespuestaCorreoMensaje } from "./use-correo-mensaje";

type Vista = "html" | "texto";

interface CuerpoCorreoProps {
  textoPlano: string;
  /** Datos de la ruta con sesión; undefined mientras carga. */
  datos: RespuestaCorreoMensaje | undefined;
  cargando: boolean;
  error: boolean;
  asunto: string | null;
  className?: string;
}

/**
 * Cuerpo de un correo: vista con formato (iframe aislado) o texto plano.
 *
 * SEGURIDAD — el HTML del correo NUNCA entra en el DOM de esta página: ni
 * dangerouslySetInnerHTML ni srcdoc. Solo se carga en un iframe con sandbox
 * (sin scripts ni mismo origen) desde una ruta que además aplica CSP. Ver
 * specs/035-correo-html-seguro/ y CLAUDE.md §9. No relajar el sandbox para
 * que un correo "se vea mejor".
 */
export function CuerpoCorreo({ textoPlano, datos, cargando, error, asunto, className }: CuerpoCorreoProps) {
  const [vista, setVista] = useState<Vista>("html");
  // Solo para este correo y esta lectura: no se recuerda (FR-019).
  const [cargarImagenes, setCargarImagenes] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [falloIframe, setFalloIframe] = useState(false);

  const html = datos?.html;
  const urlBase = html?.urlVista ?? null;
  const url = cargarImagenes && html?.urlVistaConImagenes ? html.urlVistaConImagenes : urlBase;
  const conFormato = html?.estado === "DISPONIBLE" && !!url && !falloIframe;
  const sinFormatoConAviso = (html?.estado === "NO_DISPONIBLE" || falloIframe || error) && !cargando;

  if (cargando) {
    return (
      <div data-slot="cuerpo-correo" className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div data-slot="cuerpo-correo" className={cn("min-w-0", className)}>
      {conFormato && (
        <div className="mb-2 flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Formato del correo"
            className="inline-flex rounded-lg border border-border bg-muted p-0.5"
          >
            <BotonVista activo={vista === "html"} onClick={() => setVista("html")}>
              Vista previa (HTML)
            </BotonVista>
            <BotonVista activo={vista === "texto"} onClick={() => setVista("texto")}>
              Texto plano
            </BotonVista>
          </div>
          {vista === "html" && (
            <button
              type="button"
              onClick={() => setAmpliado(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Maximize2 className="h-3 w-3" />
              Ampliar
            </button>
          )}
        </div>
      )}

      {conFormato && vista === "html" ? (
        <>
          {html?.tieneImagenesExternas && !cargarImagenes && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-[11px] text-muted-foreground">
              <ImageOff className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 min-w-[12rem]">
                Este correo contiene imágenes externas que se han bloqueado por seguridad
              </span>
              <button
                type="button"
                onClick={() => setCargarImagenes(true)}
                className="rounded-md border border-button-secondary-border bg-button-secondary-bg hover:bg-button-secondary-hover px-2 py-0.5 font-medium text-text-secondary transition-colors"
              >
                Cargar imágenes
              </button>
            </div>
          )}
          <HojaCorreo
            src={url as string}
            className="h-[min(70vh,640px)]"
            onError={() => setFalloIframe(true)}
          />
          <Dialog open={ampliado} onOpenChange={setAmpliado}>
            <DialogContent className="flex h-[90vh] w-full max-w-[min(1100px,95vw)] flex-col gap-3 sm:max-w-[min(1100px,95vw)]">
              <DialogTitle className="pr-8 text-sm font-semibold text-foreground truncate">
                {asunto?.trim() || "(Sin asunto)"}
              </DialogTitle>
              {ampliado && <HojaCorreo src={url as string} className="flex-1 min-h-0" />}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <>
          {sinFormatoConAviso && (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              La vista con formato no está disponible para este correo
            </p>
          )}
          <TextoPlano texto={textoPlano} />
        </>
      )}
    </div>
  );
}

function BotonVista({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
        activo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * La "hoja" del correo. Fondo claro siempre: los correos se diseñan para
 * fondo claro. El desplazamiento es interno y la barra la oculta el estilo
 * del documento servido (no se puede tocar desde acá: origen distinto).
 */
function HojaCorreo({ src, className, onError }: { src: string; className?: string; onError?: () => void }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-white", className)}>
      <iframe
        src={src}
        sandbox={PERMISOS_SANDBOX}
        referrerPolicy="no-referrer"
        loading="lazy"
        title="Contenido del correo"
        onError={onError}
        className="block h-full w-full border-0"
      />
    </div>
  );
}

function TextoPlano({ texto }: { texto: string }) {
  if (!texto) return <p className="text-xs italic text-muted-foreground">(Sin contenido de texto)</p>;
  return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground select-text">{texto}</p>;
}
