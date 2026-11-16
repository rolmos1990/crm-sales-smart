"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText, Loader2, Lock, Maximize2, Minimize2, Reply, Send, Sparkles, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generarSugerenciaIA } from "@/conversaciones/actions-ia";
import { fetchContextoInterpolacion, interpolarPlantilla } from "@/conversaciones/interpolacion";
import {
  SelectorPlantillas, fetchPlantillas, registrarUsoPlantilla, type PlantillaItem,
} from "@/conversaciones/components/selector-plantillas";
import { asuntoDeRespuesta } from "../mensaje/asunto";

export interface ComposerCorreoHandle {
  enfocar: () => void;
}

interface ComposerCorreoProps {
  conversacionId: string;
  instanciaId: string | null;
  /** A quién va la respuesta (la dirección del cliente). */
  destinatario: string | null;
  /** Asunto de la conversación; el "Re:" se calcula igual que en el envío SMTP. */
  asunto: string | null;
  onEnviar: (opts: { contenido: string; esNotaInterna: boolean }) => Promise<void>;
  enviando?: boolean;
  /** Mismo contrato que InputMensaje.textoExterno (cotización desde el panel). */
  textoExterno?: { texto: string; n: number } | null;
  ref?: React.Ref<ComposerCorreoHandle>;
}

// ── Borrador local ───────────────────────────────────────────────────────────
// Por conversación y por navegador. Es una comodidad del agente, no un dato del
// negocio: si el almacenamiento no está disponible, el compositor funciona igual.

const PREFIJO_BORRADOR = "karia:borrador-correo:";

function leerBorrador(conversacionId: string): string {
  try {
    return localStorage.getItem(PREFIJO_BORRADOR + conversacionId) ?? "";
  } catch {
    return "";
  }
}

function guardarBorrador(conversacionId: string, texto: string) {
  try {
    if (texto.trim()) localStorage.setItem(PREFIJO_BORRADOR + conversacionId, texto);
    else localStorage.removeItem(PREFIJO_BORRADOR + conversacionId);
  } catch {
    /* sin almacenamiento: el borrador vive solo mientras el compositor esté montado */
  }
}

/**
 * Compositor para el canal correo. Se monta con `key={conversacionId}`: cada
 * conversación arranca con su propio borrador.
 *
 * Enter hace salto de línea (un correo es texto largo); Ctrl/⌘+Enter envía.
 */
export function ComposerCorreo({
  conversacionId,
  instanciaId,
  destinatario,
  asunto,
  onEnviar,
  enviando = false,
  textoExterno = null,
  ref,
}: ComposerCorreoProps) {
  const [texto, setTexto] = useState(() => leerBorrador(conversacionId));
  const [esNota, setEsNota] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [interpolando, setInterpolando] = useState(false);
  const [generandoIA, startGenerandoIA] = useTransition();
  // "barra" = escribió "/" al inicio (reemplaza); "boton" = abrió desde el
  // botón Plantillas (agrega al final, para no borrar un saludo ya escrito).
  const [selector, setSelector] = useState<{ modo: "barra" | "boton"; filtro: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    enfocar: () => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    },
  }));

  useEffect(() => {
    guardarBorrador(conversacionId, texto);
  }, [conversacionId, texto]);

  // Arranca con el `n` vigente: el compositor se remonta al cambiar de
  // conversación y no debe volver a pegar una cotización que ya entró en otra.
  const ultimoExternoRef = useRef<number | null>(textoExterno?.n ?? null);
  useEffect(() => {
    if (!textoExterno || ultimoExternoRef.current === textoExterno.n) return;
    ultimoExternoRef.current = textoExterno.n;
    setTexto((actual) => (actual.trim() ? `${actual.trimEnd()}\n\n${textoExterno.texto}` : textoExterno.texto));
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [textoExterno]);

  const { data: plantillas = [] } = useQuery<PlantillaItem[]>({
    queryKey: ["plantillas", instanciaId],
    queryFn: () => fetchPlantillas(instanciaId!),
    enabled: !!instanciaId,
    staleTime: 5 * 60 * 1000,
  });

  const handleEnviar = async () => {
    const contenido = texto.trim();
    if (!contenido || enviando || interpolando) return;
    await onEnviar({ contenido, esNotaInterna: esNota });
    setTexto("");
    setExpandido(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTexto(val);
    if (val.startsWith("/")) setSelector({ modo: "barra", filtro: val.slice(1) });
    else if (selector?.modo === "barra") setSelector(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (selector) return;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleEnviar();
    } else if (e.key === "Escape" && expandido) {
      setExpandido(false);
    }
  };

  const handleSeleccionarPlantilla = useCallback(
    async (plantilla: PlantillaItem) => {
      registrarUsoPlantilla(plantilla.alias);
      const modo = selector?.modo ?? "barra";
      setSelector(null);

      let contenido = plantilla.contenidoTexto ?? "";
      if (contenido.includes("{{")) {
        setInterpolando(true);
        try {
          contenido = interpolarPlantilla(contenido, await fetchContextoInterpolacion(conversacionId));
        } finally {
          setInterpolando(false);
        }
      }
      setTexto((actual) =>
        modo === "boton" && actual.trim() ? `${actual.trimEnd()}\n\n${contenido}` : contenido,
      );
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [conversacionId, selector?.modo],
  );

  const handleSugerenciaIA = () => {
    startGenerandoIA(async () => {
      const resultado = await generarSugerenciaIA(conversacionId);
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      setTexto(resultado.contenido);
      textareaRef.current?.focus();
    });
  };

  const puedeEnviar = !!texto.trim() && !enviando && !interpolando;
  const atajo = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

  return (
    <div
      data-slot="composer-correo"
      className={cn(
        expandido
          // Ocupa todo el panel central (que es `relative`): más lugar para
          // redactar sin perder de vista el panel de la oportunidad.
          ? "absolute inset-0 z-30 flex flex-col bg-background p-3 md:p-4"
          : "shrink-0 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
      )}
    >
      <div
        className={cn(
          "relative flex flex-col rounded-xl border bg-card transition-colors",
          expandido && "flex-1 min-h-0",
          esNota ? "border-stage-amber-border" : "border-border focus-within:border-input-focus/50",
        )}
      >
        {selector && plantillas.length > 0 && (
          <SelectorPlantillas
            plantillas={plantillas}
            filtro={selector.filtro}
            onSeleccionar={handleSeleccionarPlantilla}
            onCerrar={() => setSelector(null)}
            onAutocompletar={(alias) => {
              setSelector((s) => (s ? { ...s, filtro: alias } : s));
              if (selector.modo === "barra") setTexto(`/${alias}`);
            }}
            onFiltroChange={(valor) => {
              setSelector((s) => (s ? { ...s, filtro: valor } : s));
              if (selector.modo === "barra") setTexto(`/${valor}`);
            }}
          />
        )}

        {/* Pestaña + acciones de ventana */}
        <div className="flex items-center gap-1 border-b border-card-divider px-2 pt-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-2.5 py-1.5 text-xs font-semibold",
              esNota ? "border-stage-amber text-stage-amber-text" : "border-inbox-accent text-foreground",
            )}
          >
            {esNota ? <Lock className="h-3.5 w-3.5" /> : <Reply className="h-3.5 w-3.5" />}
            {esNota ? "Nota interna" : "Responder"}
          </span>
          <div className="ml-auto flex items-center gap-0.5 pb-1">
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              title={expandido ? "Reducir editor" : "Ampliar editor"}
              aria-label={expandido ? "Reducir editor" : "Ampliar editor"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {expandido ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Cabeceras de la respuesta */}
        {!esNota && (
          <div className="space-y-0.5 border-b border-card-divider px-3 py-1.5 text-[11px] text-muted-foreground">
            <p className="truncate">
              <span className="text-text-secondary">Para:</span> {destinatario ?? "—"}
            </p>
            <p className="truncate">
              <span className="text-text-secondary">Asunto:</span> {asuntoDeRespuesta(asunto)}
            </p>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={interpolando ? "…interpolando plantilla" : texto}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={interpolando}
          placeholder={
            esNota ? "Nota interna (no se envía al cliente)…" : "Escribe tu respuesta por correo… (/ para plantillas)"
          }
          rows={expandido ? undefined : 4}
          className={cn(
            "w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-input-placeholder outline-none inbox-scroll",
            expandido ? "flex-1 min-h-0" : "max-h-64",
            esNota && "bg-stage-amber-muted",
            interpolando && "text-muted-foreground italic",
          )}
        />

        {/* Barra inferior */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-card-divider px-2 py-2">
          <button
            type="button"
            onClick={() => setSelector((s) => (s?.modo === "boton" ? null : { modo: "boton", filtro: "" }))}
            disabled={!instanciaId || plantillas.length === 0}
            title={plantillas.length === 0 ? "No hay plantillas activas" : "Insertar plantilla"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-button-secondary-border bg-button-secondary-bg hover:bg-button-secondary-hover px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5" />
            Plantillas
          </button>
          {instanciaId && (
            <button
              type="button"
              onClick={handleSugerenciaIA}
              disabled={generandoIA || interpolando || enviando}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                generandoIA
                  ? "border-inbox-accent-border bg-inbox-accent-muted text-inbox-accent cursor-wait"
                  : "border-border text-muted-foreground hover:text-inbox-accent hover:border-inbox-accent-border hover:bg-inbox-accent-muted",
              )}
            >
              {generandoIA ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generandoIA ? "Generando…" : "Sugerir IA"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEsNota((v) => !v)}
            aria-pressed={esNota}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              esNota
                ? "bg-stage-amber-muted border-stage-amber-border text-stage-amber-text"
                : "border-border text-muted-foreground hover:text-text-secondary hover:bg-muted",
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            Nota interna
          </button>

          <div className="ml-auto flex items-center gap-2">
            {texto.trim() && (
              <button
                type="button"
                onClick={() => setTexto("")}
                title="Descartar borrador"
                aria-label="Descartar borrador"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <span className="hidden lg:inline text-[10px] text-muted-foreground">{atajo}+Enter</span>
            <button
              type="button"
              onClick={handleEnviar}
              disabled={!puedeEnviar}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                puedeEnviar
                  ? esNota
                    ? "bg-stage-amber text-text-inverse hover:bg-stage-amber/80"
                    : "bg-inbox-accent text-inbox-accent-foreground hover:bg-inbox-accent-hover shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {esNota ? "Guardar nota" : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
