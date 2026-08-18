"use client";

import { useState, useRef, useMemo, useCallback, useTransition } from "react";
import { Send, Lock, Paperclip, X, ImageIcon, Loader2, Sparkles, Smile } from "lucide-react";
import { toast } from "sonner";
import { generarSugerenciaIA } from "../actions-ia";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SelectorPlantillas, registrarUsoPlantilla } from "./selector-plantillas";
import type { PlantillaItem } from "./selector-plantillas";
import { SelectorCuentaCanal } from "./selector-cuenta-canal";
import { EMOJIS_GRID } from "./reacciones-mensaje";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CuentaCanalResumen } from "../types";
import {
  interpolarPlantilla,
  fetchContextoInterpolacion,
} from "../interpolacion";

interface InputMensajeProps {
  conversacionId: string;
  cuentas: CuentaCanalResumen[];
  cuentaSeleccionadaId: string | null;
  onCambiarCuenta: (id: string) => void;
  onEnviar: (opts: {
    contenido: string;
    esNotaInterna: boolean;
    mediaUrl?: string;
  }) => Promise<void>;
  enviando?: boolean;
}

async function fetchPlantillas(instanciaId: string): Promise<PlantillaItem[]> {
  const res = await fetch(`/api/plantillas?instanciaId=${instanciaId}`);
  if (!res.ok) return [];
  return res.json() as Promise<PlantillaItem[]>;
}

export function InputMensaje({
  conversacionId,
  cuentas,
  cuentaSeleccionadaId,
  onCambiarCuenta,
  onEnviar,
  enviando = false,
}: InputMensajeProps) {
  const [texto, setTexto] = useState("");
  const [esNota, setEsNota] = useState(false);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [filtroSelector, setFiltroSelector] = useState("");
  const [imagenAdjunta, setImagenAdjunta] = useState<string | null>(null);
  const [interpolando, setInterpolando] = useState(false);
  const [emojiPickerAbierto, setEmojiPickerAbierto] = useState(false);
  const [generandoIA, startGenerandoIA] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inserta el emoji en la posición del cursor (no solo al final) y devuelve
  // el foco al textarea con el cursor justo después del emoji insertado.
  const insertarEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const inicio = textarea?.selectionStart ?? texto.length;
    const fin = textarea?.selectionEnd ?? texto.length;
    const nuevoTexto = texto.slice(0, inicio) + emoji + texto.slice(fin);
    setTexto(nuevoTexto);
    setEmojiPickerAbierto(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      const nuevaPos = inicio + emoji.length;
      textarea?.setSelectionRange(nuevaPos, nuevaPos);
    });
  };

  const instanciaId = useMemo(
    () => cuentas.find((c) => c.id === cuentaSeleccionadaId)?.instanciaId ?? null,
    [cuentas, cuentaSeleccionadaId]
  );

  const { data: plantillas = [] } = useQuery<PlantillaItem[]>({
    queryKey: ["plantillas", instanciaId],
    queryFn: () => fetchPlantillas(instanciaId!),
    enabled: !!instanciaId,
    staleTime: 5 * 60 * 1000,
  });

  const handleEnviar = async () => {
    const contenido = texto.trim();
    if (!contenido || enviando) return;
    await onEnviar({
      contenido,
      esNotaInterna: esNota,
      mediaUrl: imagenAdjunta ?? undefined,
    });
    setTexto("");
    setImagenAdjunta(null);
    textareaRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTexto(val);
    if (val.startsWith("/")) {
      setFiltroSelector(val.slice(1));
      setSelectorVisible(true);
    } else {
      setSelectorVisible(false);
      setFiltroSelector("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (selectorVisible) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  // Cuando el agente selecciona una plantilla:
  // 1. Busca el contexto de interpolación (contacto + empresa + oportunidad)
  // 2. Interpola el contenido reemplazando {{variables}} con valores reales
  // 3. Deja el texto listo para editar antes de enviar
  const handleSeleccionarPlantilla = useCallback(
    async (plantilla: PlantillaItem) => {
      registrarUsoPlantilla(plantilla.alias);
      setSelectorVisible(false);
      setFiltroSelector("");

      const contenidoRaw = plantilla.contenidoTexto ?? "";

      // Si no tiene variables, insertar directo sin fetch
      if (!contenidoRaw.includes("{{")) {
        setTexto(contenidoRaw);
        if (plantilla.imagenUrl) setImagenAdjunta(plantilla.imagenUrl);
        textareaRef.current?.focus();
        return;
      }

      // Fetch del contexto e interpolación
      setInterpolando(true);
      try {
        const ctx = await fetchContextoInterpolacion(conversacionId);
        const interpolado = interpolarPlantilla(contenidoRaw, ctx);
        setTexto(interpolado);
        if (plantilla.imagenUrl) setImagenAdjunta(plantilla.imagenUrl);
      } finally {
        setInterpolando(false);
        textareaRef.current?.focus();
      }
    },
    [conversacionId]
  );

  const cerrarSelector = () => {
    setSelectorVisible(false);
    setFiltroSelector("");
  };

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

  const puedeEnviar = (texto.trim() || imagenAdjunta) && !enviando && !interpolando;

  return (
    <div className="border-t border-stone-200 dark:border-white/10 p-2 space-y-2 relative">
      {/* Selector de plantillas flotante */}
      {selectorVisible && plantillas.length > 0 && (
        <SelectorPlantillas
          plantillas={plantillas}
          filtro={filtroSelector}
          onSeleccionar={handleSeleccionarPlantilla}
          onCerrar={cerrarSelector}
          onAutocompletar={(alias) => {
            setTexto(`/${alias}`);
            setFiltroSelector(alias);
          }}
        />
      )}

      {/* Preview de imagen adjunta */}
      {imagenAdjunta && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-lime-50 dark:bg-lime-500/10 border border-lime-200 dark:border-lime-500/20">
          <ImageIcon className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400 shrink-0" />
          <span className="text-xs text-lime-700 dark:text-lime-300 flex-1 truncate">Imagen adjunta</span>
          <button
            type="button"
            onClick={() => setImagenAdjunta(null)}
            className="text-lime-600/70 dark:text-lime-400/70 hover:text-lime-700 dark:hover:text-lime-300 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar superior */}
      <div className="flex items-center justify-between gap-2">
        <SelectorCuentaCanal
          cuentas={cuentas}
          seleccionada={cuentaSeleccionadaId}
          onSeleccionar={onCambiarCuenta}
        />
        <div className="flex items-center gap-1.5">
          {instanciaId && (
            <button
              type="button"
              onClick={handleSugerenciaIA}
              disabled={generandoIA || interpolando || enviando}
              title="Generar respuesta con IA"
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all",
                generandoIA
                  ? "border-lime-500/30 bg-lime-50 dark:bg-lime-500/10 text-lime-700 dark:text-lime-400 cursor-wait"
                  : "border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-500 hover:text-lime-700 dark:hover:text-lime-400 hover:border-lime-500/30 hover:bg-lime-50 dark:hover:bg-lime-500/5"
              )}
            >
              {generandoIA ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {generandoIA ? "Generando…" : "Sugerir IA"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEsNota((v) => !v)}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors",
              esNota
                ? "bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300"
                : "border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5"
            )}
          >
            <Lock className="h-3 w-3" />
            Nota interna
          </button>
        </div>
      </div>

      {/* Área de texto */}
      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors",
          esNota
            ? "border-amber-300 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5"
            : "border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/3 focus-within:border-lime-400/50 dark:focus-within:border-lime-500/30"
        )}
      >
        <textarea
          ref={textareaRef}
          value={interpolando ? "…interpolando plantilla" : texto}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={interpolando}
          placeholder={
            esNota
              ? "Nota interna (no se envía al cliente)…"
              : "Escribe un mensaje… (/ para plantillas, Enter para enviar)"
          }
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none max-h-32 inbox-scroll",
            interpolando && "text-stone-400 dark:text-stone-500 italic"
          )}
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <div className="flex items-center gap-1 shrink-0">
          {interpolando ? (
            <Loader2 className="h-4 w-4 text-lime-600 dark:text-lime-400 animate-spin" />
          ) : (
            <>
              <Popover open={emojiPickerAbierto} onOpenChange={setEmojiPickerAbierto}>
                <PopoverTrigger
                  className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 p-1 rounded transition-colors"
                  title="Insertar emoji"
                >
                  <Smile className="h-4 w-4" />
                </PopoverTrigger>
                <PopoverContent align="end" side="top" className="w-64 p-2 bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10">
                  <div className="grid grid-cols-7 gap-0.5">
                    {EMOJIS_GRID.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertarEmoji(emoji)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-lg hover:bg-stone-100 dark:hover:bg-white/10 hover:scale-110 active:scale-95 transition-all"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 p-1 rounded transition-colors"
                title="Adjuntar archivo"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!puedeEnviar}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              puedeEnviar
                ? esNota
                  ? "bg-amber-500/80 text-stone-900 hover:bg-amber-400"
                  : "bg-lime-500/90 text-stone-900 hover:bg-lime-400 shadow-lg hover:scale-[1.05]"
                : "text-stone-300 dark:text-stone-600 cursor-not-allowed"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
