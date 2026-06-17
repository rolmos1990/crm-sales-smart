"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, AlertCircle, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parsearArchivo } from "../utils/parsear-archivo";
import {
  detectarSeparador,
  etiquetaSeparador,
} from "../utils/detectar-separador";
import { obtenerPlantilla } from "../utils/plantillas-config";
import type { DatosArchivo, EntidadImportable, SeparadorCSV } from "../types";

const MAX_SIZE = 2 * 1024 * 1024;
const EXTENSIONES_VALIDAS = [".csv", ".xls", ".xlsx"];

interface PasoArchivoProps {
  entidad: EntidadImportable;
  onArchivoParsed: (archivo: DatosArchivo) => void;
  onAtras: () => void;
}

const ETIQUETAS_ENTIDAD: Record<EntidadImportable, string> = {
  CONTACTO: "Contactos",
  EMPRESA: "Empresas",
  OPORTUNIDAD: "Oportunidades",
  PEDIDO: "Pedidos",
  PRODUCTO: "Productos",
  ACTIVIDAD: "Actividades",
};

const SEPARADORES: SeparadorCSV[] = [";", ",", "|", "\t"];

export function PasoArchivo({
  entidad,
  onArchivoParsed,
  onAtras,
}: PasoArchivoProps) {
  const [archivoRaw, setArchivoRaw] = useState<File | null>(null);
  const [datosParsed, setDatosParsed] = useState<DatosArchivo | null>(null);
  const [separador, setSeparador] = useState<SeparadorCSV | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseando, setParseando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const procesarArchivo = useCallback(
    async (file: File, sepOverride?: SeparadorCSV) => {
      setError(null);

      const extension = "." + file.name.split(".").pop()?.toLowerCase();
      if (!EXTENSIONES_VALIDAS.includes(extension)) {
        setError("Solo se permiten archivos CSV, XLS o XLSX.");
        return;
      }

      if (file.size > MAX_SIZE) {
        setError("El archivo supera el límite permitido de 2MB.");
        return;
      }

      setParseando(true);
      try {
        const datos = await parsearArchivo(file, sepOverride);
        setDatosParsed(datos);
        if (datos.separador) setSeparador(datos.separador);
      } catch {
        setError("No se pudo leer el archivo. Verifica que no esté dañado.");
      } finally {
        setParseando(false);
      }
    },
    [],
  );

  const handleFile = useCallback(
    (file: File) => {
      setArchivoRaw(file);
      procesarArchivo(file);
    },
    [procesarArchivo],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setArrastrando(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleSeparadorChange = useCallback(
    async (nuevoSep: SeparadorCSV) => {
      setSeparador(nuevoSep);
      if (archivoRaw) {
        await procesarArchivo(archivoRaw, nuevoSep);
      }
    },
    [archivoRaw, procesarArchivo],
  );

  const limpiar = () => {
    setArchivoRaw(null);
    setDatosParsed(null);
    setSeparador(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const esCSV = datosParsed?.tipo === "csv";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-50">
          Sube tu archivo
        </h2>
        <p className="text-sm text-stone-400 mt-1">
          Importando:{" "}
          <span className="text-lime-400 font-medium">
            {ETIQUETAS_ENTIDAD[entidad]}
          </span>
        </p>
      </div>

      {!archivoRaw ? (
        <div className="flex flex-col gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-all",
              arrastrando
                ? "border-lime-500/60 bg-lime-500/5"
                : "border-white/15 bg-white/4 hover:border-white/25 hover:bg-white/6",
            )}
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/8">
              <Upload className="w-7 h-7 text-stone-400" />
            </div>
            <div className="text-center">
              <p className="text-stone-200 font-medium">
                Arrastra tu archivo aquí
              </p>
              <p className="text-stone-500 text-sm mt-1">
                o{" "}
                <span className="text-lime-400 underline underline-offset-2">
                  haz clic para seleccionar
                </span>
              </p>
              <p className="text-stone-600 text-xs mt-2">
                CSV, XLS, XLSX · máximo 2 MB
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          <a
            href={obtenerPlantilla(entidad).url}
            download={obtenerPlantilla(entidad).nombreDescarga}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center gap-2 self-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-stone-400 transition-all hover:border-lime-500/30 hover:bg-lime-500/5 hover:text-lime-400"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar archivo modelo ({ETIQUETAS_ENTIDAD[entidad]})
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-lime-500/10 flex-shrink-0">
              <FileText className="w-5 h-5 text-lime-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-stone-100 font-medium text-sm truncate">
                {archivoRaw.name}
              </p>
              <p className="text-stone-500 text-xs mt-0.5">
                {datosParsed
                  ? `${datosParsed.filasTotales} registros · ${formatBytes(archivoRaw.size)}`
                  : formatBytes(archivoRaw.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={limpiar}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>

          {parseando && (
            <div className="flex items-center gap-2 text-stone-400 text-sm">
              <div className="w-4 h-4 border-2 border-lime-500/30 border-t-lime-500 rounded-full animate-spin" />
              Analizando archivo...
            </div>
          )}

          {esCSV && separador && !parseando && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex-1">
                <p className="text-stone-300 text-sm font-medium">
                  Separador detectado
                </p>
                <p className="text-stone-500 text-xs mt-0.5">
                  Si la vista previa no se ve correctamente, cambia el
                  separador.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-sm text-lime-300">
                  {separador === "\t" ? "TAB" : separador}
                </span>
                <Select
                  value={separador}
                  onValueChange={(v) =>
                    handleSeparadorChange(v as SeparadorCSV)
                  }
                >
                  <SelectTrigger className="w-36 h-8 text-xs border-white/15 bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEPARADORES.map((sep) => (
                      <SelectItem key={sep} value={sep} className="text-xs">
                        {etiquetaSeparador(sep)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {datosParsed && !parseando && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Registros", valor: datosParsed.filasTotales },
                { label: "Columnas", valor: datosParsed.encabezados.length },
                {
                  label: "Formato",
                  valor: datosParsed.tipo.toUpperCase(),
                },
              ].map(({ label, valor }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/8 bg-white/4 p-3 text-center"
                >
                  <p className="text-stone-300 font-semibold text-lg">
                    {valor}
                  </p>
                  <p className="text-stone-500 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 p-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onAtras}
          className="text-stone-400 hover:text-stone-200"
        >
          ← Volver
        </Button>
        <Button
          onClick={() => datosParsed && onArchivoParsed(datosParsed)}
          disabled={!datosParsed || parseando}
          className="bg-lime-500/90 text-stone-950 rounded-xl hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          Continuar <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
