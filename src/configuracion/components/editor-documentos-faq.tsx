"use client";

// 032 — Sección FAQ de la pestaña Conocimiento del agente.
//
// Subir y eliminar llaman a sus Server Actions y tienen efecto inmediato
// (mueven archivos en el storage, no pueden esperar al "guardar" del perfil).
// Editar el contenido destilado sí viaja con el formulario, así que entra en
// el ciclo borrador → publicar como el resto del perfil.

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, FileText, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { eliminarDocumentoFaq, entrenarDocumentosFaq, subirDocumentoFaq } from "@/configuracion/ia/conocimiento/actions";
import {
  ETIQUETA_ESTADO_DOCUMENTO,
  MAX_CARACTERES_DOCUMENTO,
  MAX_DOCUMENTOS_FAQ,
  necesitaEntrenamiento,
  type DocumentoFaq,
} from "@/configuracion/ia/conocimiento/tipos";

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function EditorDocumentosFaq({
  agenteIAConfigId,
  valores,
  onChange,
}: {
  agenteIAConfigId: string | null;
  valores: DocumentoFaq[];
  onChange: (v: DocumentoFaq[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [entrenando, setEntrenando] = useState(false);
  const [, startTransition] = useTransition();
  const lleno = valores.length >= MAX_DOCUMENTOS_FAQ;
  const pendientes = valores.filter(necesitaEntrenamiento).length;

  if (!agenteIAConfigId) {
    return <p className="text-stone-500 text-xs">Guardá el agente antes de subir documentos.</p>;
  }

  const subir = async (archivo: File) => {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const r = await subirDocumentoFaq(agenteIAConfigId, fd);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      onChange([...valores, r.datos!]);
      toast.success(`"${r.datos!.nombre}" cargado. Apretá "Entrenar" para que el agente lo use.`);
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const eliminar = (doc: DocumentoFaq) =>
    startTransition(async () => {
      const r = await eliminarDocumentoFaq(agenteIAConfigId, doc.id);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      onChange(valores.filter((d) => d.id !== doc.id));
      toast.success("Documento eliminado");
    });

  const entrenar = async () => {
    setEntrenando(true);
    try {
      const r = await entrenarDocumentosFaq(agenteIAConfigId);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      const { entrenados, fallidos, documentos } = r.datos!;
      onChange(documentos);
      if (fallidos > 0) {
        toast.warning(
          `${entrenados} documento(s) entrenados, ${fallidos} quedaron para revisar. Corregí el texto a mano antes de publicar.`,
        );
      } else {
        toast.success(`${entrenados} documento(s) entrenados. El agente ya los usa.`);
      }
    } finally {
      setEntrenando(false);
    }
  };

  const actualizar = (id: string, cambio: Partial<DocumentoFaq>) =>
    onChange(valores.map((d) => (d.id === id ? { ...d, ...cambio } : d)));

  return (
    <div className="flex flex-col gap-3">
      {valores.map((doc) => (
        <div key={doc.id} className="rounded-xl border border-white/10 bg-white/3 p-3">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-medium text-stone-200">{doc.nombre}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                    doc.estado === "LISTO"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/10 text-warning",
                  )}
                >
                  {doc.estado === "LISTO" && <Check className="mr-0.5 inline h-2.5 w-2.5" />}
                  {ETIQUETA_ESTADO_DOCUMENTO[doc.estado]}
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                {kb(doc.pesoBytes)} · {doc.caracteresOriginal.toLocaleString("es")} caracteres leídos →{" "}
                {doc.contenido.length.toLocaleString("es")} en el contexto
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-stone-400">
              <input
                type="checkbox"
                checked={doc.activo}
                onChange={(e) => actualizar(doc.id, { activo: e.target.checked })}
                className="accent-lime-500"
              />
              Activo
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar ${doc.nombre}`}
              onClick={() => eliminar(doc)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {doc.estado === "SIN_ENTRENAR" && (
            <p className="mt-2 rounded-lg border border-white/10 bg-white/3 px-2 py-1.5 text-[11px] text-stone-400">
              Anticipo del texto del archivo. El agente todavía no lo usa: apretá “Entrenar” para
              convertirlo al formato que consume.
            </p>
          )}

          {doc.estado === "REVISAR" && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              El entrenamiento falló: esto es el texto crudo recortado. Corregilo a mano antes de publicar.
            </p>
          )}

          <Textarea
            value={doc.contenido}
            onChange={(e) => actualizar(doc.id, { contenido: e.target.value.slice(0, MAX_CARACTERES_DOCUMENTO) })}
            rows={6}
            className="mt-2 text-xs"
            placeholder="Lo que el agente va a leer de este documento…"
          />
          <p
            className={cn(
              "mt-1 text-right text-[10px] tabular-nums",
              doc.contenido.length >= MAX_CARACTERES_DOCUMENTO ? "text-warning" : "text-stone-600",
            )}
          >
            {doc.contenido.length} / {MAX_CARACTERES_DOCUMENTO}
          </p>
        </div>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) void subir(archivo);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lleno || subiendo || entrenando}
          onClick={() => inputRef.current?.click()}
        >
          {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {subiendo ? "Cargando…" : "Subir documento"}
        </Button>

        <Button type="button" size="sm" disabled={pendientes === 0 || entrenando || subiendo} onClick={entrenar}>
          {entrenando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {entrenando ? "Entrenando…" : pendientes > 0 ? `Entrenar (${pendientes})` : "Entrenar"}
        </Button>
      </div>

      <p className="text-[11px] text-stone-500">
        {lleno
          ? `Llegaste al máximo de ${MAX_DOCUMENTOS_FAQ} documentos. Eliminá uno para subir otro.`
          : `PDF o TXT, hasta ${MAX_DOCUMENTOS_FAQ} documentos. Subir solo guarda el archivo; “Entrenar” lo convierte al formato compacto que el agente consume. Podés corregir ese texto a mano después.`}
      </p>
    </div>
  );
}
