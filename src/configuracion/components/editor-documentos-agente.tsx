"use client";

// 033 — Documentación del comercio. Reemplaza a editor-documentos-faq.tsx.
//
// La diferencia de fondo con el editor anterior: de cada archivo se ve SOLO el
// nombre. Antes había que leer y corregir a mano el texto destilado, porque
// ese texto era literalmente lo que el agente iba a ver. Ahora el archivo se
// indexa entero y el agente lo consulta cuando hace falta, así que no hay nada
// que editar — y mostrar un textarea sugeriría que todavía lo hay.
//
// Todo acá tiene efecto inmediato vía server actions: nada viaja en el
// formulario del agente. Eso es lo que permite que los identificadores de
// OpenAI nunca lleguen al navegador.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, File, FileCode, FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  alternarActivo,
  cargarDocumentacionAgente,
  eliminarDocumento,
  eliminarDocumentoLegacy,
  reintentarIndexacion,
  subirDocumento,
} from "@/configuracion/ia/documentacion/actions";
import type { DocumentoAgenteVista, EstadoDocumentacionAgente } from "@/ai/documentacion/queries";
import {
  ACCEPT_INPUT_ARCHIVO,
  ETIQUETA_ESTADO_DOCUMENTO,
  MAX_DOCUMENTOS_AGENTE,
  MAX_PESO_TOTAL_INSTANCIA,
  MENSAJE_RECHAZO,
  formatearPeso,
  validarArchivo,
} from "@/ai/documentacion/tipos";

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

const EXTENSIONES_CODIGO = new Set([
  ".c", ".cpp", ".cs", ".go", ".java", ".js", ".php", ".py", ".rb", ".sh", ".ts",
  ".json", ".html", ".css", ".tex",
]);

/** Icono por familia de formato. Es identificación, no previsualización: del
 *  contenido del archivo no se muestra absolutamente nada. */
function IconoDocumento({ extension }: { extension: string }) {
  const Icono = EXTENSIONES_CODIGO.has(extension) ? FileCode : extension === ".pdf" ? FileText : File;
  return <Icono className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />;
}

function BadgeEstado({ estado }: { estado: DocumentoAgenteVista["estado"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
        estado === "LISTO"
          ? "border-success/40 bg-success/10 text-success"
          : estado === "ERROR"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {estado === "INDEXANDO" && <Loader2 className="mr-0.5 inline h-2.5 w-2.5 animate-spin" />}
      {ETIQUETA_ESTADO_DOCUMENTO[estado]}
    </span>
  );
}

export function EditorDocumentosAgente({ agenteIAConfigId }: { agenteIAConfigId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<EstadoDocumentacionAgente | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // El componente carga su propio estado en vez de recibirlo del formulario
  // del agente (mismo patrón que SeccionVersionesAgente). Esa separación es
  // lo que hace que los identificadores de OpenAI no tengan por dónde llegar
  // al navegador ni perderse al guardar el perfil.
  const recargar = useCallback(async () => {
    if (!agenteIAConfigId) return;
    setEstado(await cargarDocumentacionAgente(agenteIAConfigId));
  }, [agenteIAConfigId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  if (!agenteIAConfigId) {
    return <p className="text-stone-500 text-xs">Guardá el agente antes de subir documentos.</p>;
  }

  if (!estado) {
    return (
      <p className="flex items-center gap-1.5 text-stone-500 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando documentación…
      </p>
    );
  }

  const { documentos, legacy, habilitado, pesoUsadoInstancia } = estado;
  // El tope que manda es el peso de la CUENTA; la cantidad quedó como tope de
  // cordura y casi nunca es la que frena.
  const sinEspacio = pesoUsadoInstancia >= MAX_PESO_TOTAL_INSTANCIA;
  const lleno = sinEspacio || documentos.length >= MAX_DOCUMENTOS_AGENTE;

  if (!habilitado) {
    return (
      <p className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-2 text-[11px] text-warning">
        <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
        {MENSAJE_RECHAZO.NO_CONFIGURADO}
      </p>
    );
  }

  const subir = async (archivo: File) => {
    // Validación en el cliente solo para dar feedback inmediato. El server
    // action valida de nuevo: es el boundary que de verdad decide.
    const validacion = validarArchivo(
      archivo.name,
      archivo.size,
      documentos.length,
      pesoUsadoInstancia,
    );
    if (!validacion.ok) {
      toast.error(validacion.mensaje);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const r = await subirDocumento(agenteIAConfigId, fd);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      if (r.datos?.estado === "ERROR") {
        toast.warning(`"${r.datos.nombre}" se guardó pero no se pudo indexar. Probá reintentar.`);
      } else {
        toast.success(`"${r.datos?.nombre}" ya está disponible para el agente.`);
      }
      await recargar();
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const conFila = (id: string, accion: () => Promise<{ exito: boolean; error?: string }>, exitoMsg?: string) =>
    startTransition(async () => {
      setOcupadoId(id);
      try {
        const r = await accion();
        if (!r.exito) {
          toast.error(r.error);
        } else if (exitoMsg) {
          toast.success(exitoMsg);
        }
        await recargar();
      } finally {
        setOcupadoId(null);
      }
    });

  return (
    <div className="flex flex-col gap-3">
      {documentos.map((doc) => (
        <div key={doc.id} className="rounded-xl border border-white/10 bg-white/3 p-3">
          <div className="flex items-start gap-2">
            <IconoDocumento extension={doc.extension} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-medium text-stone-200">{doc.nombre}</p>
                <BadgeEstado estado={doc.estado} />
              </div>
              <p className="text-[11px] text-stone-500">{kb(doc.pesoBytes)}</p>
            </div>

            {doc.estado === "LISTO" && (
              <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-stone-400">
                <input
                  type="checkbox"
                  checked={doc.activo}
                  disabled={ocupadoId === doc.id}
                  onChange={(e) =>
                    conFila(doc.id, () => alternarActivo(agenteIAConfigId, doc.id, e.target.checked))
                  }
                  className="accent-lime-500"
                />
                Activo
              </label>
            )}

            {doc.estado === "ERROR" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ocupadoId === doc.id}
                onClick={() =>
                  conFila(
                    doc.id,
                    () => reintentarIndexacion(agenteIAConfigId, doc.id),
                    "Documento indexado",
                  )
                }
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar ${doc.nombre}`}
              disabled={ocupadoId === doc.id}
              onClick={() =>
                conFila(doc.id, () => eliminarDocumento(agenteIAConfigId, doc.id), "Documento eliminado")
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {doc.estado === "ERROR" && doc.errorIndexacion && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              {doc.errorIndexacion}
            </p>
          )}
        </div>
      ))}

      {/* Documentos del mecanismo anterior. No se migran: el texto destilado
          que tenían no equivale a un archivo indexado entero, y presentarlos
          como si lo fueran sería mentir sobre lo que el agente sabe. */}
      {legacy.map((doc) => (
        <div key={doc.id} className="rounded-xl border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-start gap-2">
            <File className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-medium text-stone-400">{doc.nombre}</p>
                <span className="shrink-0 rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold text-warning">
                  Requiere resubir
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Cargado con el método anterior. El agente ya no lo usa: subilo de nuevo para indexarlo.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Eliminar ${doc.nombre}`}
              disabled={ocupadoId === doc.id}
              onClick={() =>
                conFila(doc.id, () => eliminarDocumentoLegacy(agenteIAConfigId, doc.id), "Documento eliminado")
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_INPUT_ARCHIVO}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) void subir(archivo);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lleno || subiendo}
          onClick={() => inputRef.current?.click()}
        >
          {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {subiendo ? "Indexando…" : "Subir documento"}
        </Button>

        {/* El consumo es de la cuenta entera: este agente puede estar vacío y
            el presupuesto igual estar lleno por lo que subió otro. */}
        <span
          className={cn(
            "text-[11px] tabular-nums",
            sinEspacio ? "font-medium text-destructive" : "text-stone-500",
          )}
        >
          {formatearPeso(pesoUsadoInstancia)} de {formatearPeso(MAX_PESO_TOTAL_INSTANCIA)} usados
        </span>
      </div>

      <p className="text-[11px] text-stone-500">
        {sinEspacio
          ? `La cuenta llegó a los ${formatearPeso(MAX_PESO_TOTAL_INSTANCIA)} de documentación. Eliminá un documento para subir otro.`
          : lleno
            ? `Llegaste al máximo de ${MAX_DOCUMENTOS_AGENTE} documentos. Eliminá uno para subir otro.`
            : `PDF, Word, PowerPoint, TXT, Markdown, JSON, HTML y archivos de código. Hasta ${formatearPeso(MAX_PESO_TOTAL_INSTANCIA)} en total entre todos los agentes de la cuenta, sin límite de archivos. Las imágenes no se pueden indexar.`}
      </p>
    </div>
  );
}

/**
 * Vista de solo lectura para la pestaña que resume el agente.
 *
 * El verde no es "activo" a secas: es "el agente puede encontrarlo", o sea
 * LISTO y activo. Un documento que falló al indexar está cargado pero el
 * agente nunca lo va a ver, y mostrarlo en verde mentiría.
 */
export function ResumenDocumentosAgente({ agenteIAConfigId }: { agenteIAConfigId: string | null }) {
  const [estado, setEstado] = useState<EstadoDocumentacionAgente | null>(null);

  useEffect(() => {
    if (!agenteIAConfigId) return;
    void cargarDocumentacionAgente(agenteIAConfigId).then(setEstado);
  }, [agenteIAConfigId]);

  if (!agenteIAConfigId || !estado) {
    return <p className="text-stone-500 text-xs">Sin documentos cargados.</p>;
  }

  const { documentos, legacy } = estado;
  if (documentos.length === 0 && legacy.length === 0) {
    return <p className="text-stone-500 text-xs">Sin documentos cargados.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {documentos.map((doc) => {
        const consultable = doc.estado === "LISTO" && doc.activo;
        return (
          <li key={doc.id} className="flex items-center gap-2 text-xs">
            <FileText className={cn("h-3.5 w-3.5 shrink-0", consultable ? "text-lime-400" : "text-stone-600")} />
            <span className={cn("min-w-0 truncate font-medium", consultable ? "text-stone-300" : "text-stone-500")}>
              {doc.nombre}
            </span>
            <span className="shrink-0 text-stone-500">· {ETIQUETA_ESTADO_DOCUMENTO[doc.estado]}</span>
            {doc.estado === "LISTO" && !doc.activo && (
              <span className="shrink-0 text-stone-600">· desactivado</span>
            )}
          </li>
        );
      })}
      {legacy.map((doc) => (
        <li key={doc.id} className="flex items-center gap-2 text-xs">
          <FileText className="h-3.5 w-3.5 shrink-0 text-stone-600" />
          <span className="min-w-0 truncate font-medium text-stone-500">{doc.nombre}</span>
          <span className="shrink-0 text-warning">· requiere resubir</span>
        </li>
      ))}
    </ul>
  );
}
