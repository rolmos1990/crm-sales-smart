"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Edición inline: click para editar, se guarda al salir del campo o con Enter,
 * Escape descarta. Sin botón de guardar — `onGuardar` persiste.
 *
 * - `compacta` (Inbox): una línea con ícono y valor; la etiqueta va en el title.
 * - `fila` (ficha de contacto): ícono · etiqueta en columna · valor.
 */
export function CampoEditable({
  label,
  valor,
  placeholder,
  icono,
  onGuardar,
  variante = "compacta",
  tipo = "text",
  deshabilitado = false,
  className,
}: {
  label: string;
  valor: string | null | undefined;
  placeholder: string;
  icono: ReactNode;
  onGuardar: (v: string) => Promise<void>;
  variante?: "compacta" | "fila";
  tipo?: "text" | "email" | "tel";
  deshabilitado?: boolean;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(valor ?? "");
  const [guardando, startGuardando] = useTransition();
  const esFila = variante === "fila";

  useEffect(() => {
    setVal(valor ?? "");
  }, [valor]);

  const guardar = () => {
    if (val === (valor ?? "")) { setEditando(false); return; }
    startGuardando(async () => {
      await onGuardar(val);
      setEditando(false);
    });
  };

  const etiquetaFila = esFila && (
    <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}</span>
  );

  if (editando) {
    return (
      <div
        data-slot="campo-editable"
        className={cn(
          "flex items-center gap-2 rounded-xl border border-input-focus/50 bg-input-bg",
          esFila ? "gap-3 px-3 py-1.5" : "px-3 py-2",
          className,
        )}
      >
        <span className="shrink-0 text-muted-foreground">{icono}</span>
        {etiquetaFila}
        <input
          autoFocus
          type={tipo}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") { setVal(valor ?? ""); setEditando(false); }
          }}
          placeholder={placeholder}
          aria-label={label}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-input-placeholder",
            esFila ? "text-sm" : "text-xs",
          )}
        />
        {guardando
          ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
          : <Check className="h-3 w-3 shrink-0 text-primary" />}
      </div>
    );
  }

  if (deshabilitado) {
    return (
      <div
        data-slot="campo-editable"
        className={cn("flex items-center gap-2 px-3", esFila ? "gap-3 py-2" : "py-2", className)}
      >
        <span className="shrink-0 text-muted-foreground">{icono}</span>
        {etiquetaFila}
        <span className={cn("min-w-0 flex-1 truncate", esFila ? "text-sm" : "text-xs", valor ? "text-foreground" : "text-muted-foreground")}>
          {valor || "—"}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-slot="campo-editable"
      onClick={() => setEditando(true)}
      className={cn(
        "group flex w-full items-center gap-2 rounded-xl px-3 text-left transition-colors hover:bg-muted",
        esFila ? "gap-3 py-2" : "py-2",
        className,
      )}
      title={`Editar ${label}`}
    >
      <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">{icono}</span>
      {etiquetaFila}
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          esFila ? "text-sm" : "text-xs",
          valor ? (esFila ? "text-foreground" : "text-text-secondary") : "italic text-muted-foreground",
        )}
      >
        {valor || placeholder}
      </span>
      {esFila && (
        <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      )}
    </button>
  );
}

/**
 * Igual que `CampoEditable` pero multilínea. Enter NO guarda (hace falta poder
 * saltar de línea): se guarda al salir del campo o con Ctrl/⌘+Enter.
 */
export function CampoEditableTexto({
  label,
  valor,
  placeholder,
  icono,
  filas = 4,
  onGuardar,
  variante = "compacta",
  deshabilitado = false,
  className,
}: {
  label: string;
  valor: string | null | undefined;
  placeholder: string;
  icono: ReactNode;
  filas?: number;
  onGuardar: (v: string) => Promise<void>;
  variante?: "compacta" | "fila";
  deshabilitado?: boolean;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(valor ?? "");
  const [guardando, startGuardando] = useTransition();
  const esFila = variante === "fila";
  const texto = esFila ? "text-sm" : "text-xs";

  useEffect(() => {
    setVal(valor ?? "");
  }, [valor]);

  const guardar = () => {
    if (val === (valor ?? "")) { setEditando(false); return; }
    startGuardando(async () => {
      await onGuardar(val);
      setEditando(false);
    });
  };

  const cabecera = (estado?: ReactNode) => (
    <span className="mb-1 flex items-center gap-2">
      <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">{icono}</span>
      <span
        className={cn(
          "flex-1",
          esFila ? "text-sm text-muted-foreground" : "text-[9px] font-bold uppercase tracking-widest text-muted-foreground",
        )}
      >
        {label}
      </span>
      {estado}
    </span>
  );

  if (editando) {
    return (
      <div data-slot="campo-editable-texto" className={cn("rounded-xl border border-input-focus/50 bg-input-bg px-3 py-2", className)}>
        {cabecera(
          guardando
            ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
            : <Check className="h-3 w-3 shrink-0 text-primary" />,
        )}
        <textarea
          autoFocus
          rows={filas}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); guardar(); }
            if (e.key === "Escape") { setVal(valor ?? ""); setEditando(false); }
          }}
          placeholder={placeholder}
          aria-label={label}
          className={cn("w-full resize-none bg-transparent leading-relaxed text-foreground outline-none placeholder:text-input-placeholder", texto)}
        />
      </div>
    );
  }

  const cuerpo = (
    <span
      className={cn(
        "block whitespace-pre-wrap leading-relaxed",
        texto,
        valor ? "text-text-secondary" : "italic text-muted-foreground",
      )}
    >
      {valor || (deshabilitado ? "—" : placeholder)}
    </span>
  );

  if (deshabilitado) {
    return (
      <div data-slot="campo-editable-texto" className={cn("px-3 py-2", className)}>
        {cabecera()}
        {cuerpo}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-slot="campo-editable-texto"
      onClick={() => setEditando(true)}
      className={cn("group w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted", className)}
      title={`Editar ${label}`}
    >
      {cabecera(esFila ? <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /> : undefined)}
      {cuerpo}
    </button>
  );
}
