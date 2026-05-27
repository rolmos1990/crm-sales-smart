"use client";

import { useState, useRef } from "react";
import { Send, Lock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectorCuentaCanal } from "./selector-cuenta-canal";
import type { CuentaCanalResumen } from "../types";

interface InputMensajeProps {
  conversacionId: string;
  cuentas: CuentaCanalResumen[];
  cuentaSeleccionadaId: string | null;
  onCambiarCuenta: (id: string) => void;
  onEnviar: (opts: { contenido: string; esNotaInterna: boolean }) => Promise<void>;
  enviando?: boolean;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEnviar = async () => {
    const contenido = texto.trim();
    if (!contenido || enviando) return;
    await onEnviar({ contenido, esNotaInterna: esNota });
    setTexto("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  return (
    <div className="border-t border-white/10 p-2 space-y-2">
      {/* Toolbar superior */}
      <div className="flex items-center justify-between gap-2">
        <SelectorCuentaCanal
          cuentas={cuentas}
          seleccionada={cuentaSeleccionadaId}
          onSeleccionar={onCambiarCuenta}
        />
        <button
          type="button"
          onClick={() => setEsNota((v) => !v)}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors",
            esNota
              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
              : "border-white/10 text-stone-500 hover:text-stone-300 hover:bg-white/5"
          )}
        >
          <Lock className="h-3 w-3" />
          Nota interna
        </button>
      </div>

      {/* Área de texto */}
      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors",
          esNota
            ? "border-amber-500/20 bg-amber-500/5"
            : "border-white/10 bg-white/3 focus-within:border-lime-500/30"
        )}
      >
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={esNota ? "Nota interna (no se envía al cliente)…" : "Escribe un mensaje… (Enter para enviar)"}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-stone-100 placeholder:text-stone-500 outline-none max-h-32 scrollbar-thin"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="text-stone-500 hover:text-stone-300 p-1 rounded transition-colors"
            title="Adjuntar archivo"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!texto.trim() || enviando}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              texto.trim() && !enviando
                ? esNota
                  ? "bg-amber-500/80 text-stone-900 hover:bg-amber-400"
                  : "bg-lime-500/90 text-stone-900 hover:bg-lime-400 shadow-lg hover:scale-[1.05]"
                : "text-stone-600 cursor-not-allowed"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
