"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ImageIcon, Upload, X, Loader2, Link2, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaModulo, CanalOrigen, MediaUploadApiResponse, MediaUploadApiError } from "@/lib/media";

// ─── Props ───────────────────────────────────────────────────────────────────

interface MediaUploaderProps {
  instanciaId: string;
  modulo: MediaModulo;
  entidadId?: string;
  entidadTipo?: string;
  canalOrigen?: CanalOrigen;
  value: string;
  onChange: (url: string, mediaId?: string) => void;
  disabled?: boolean;
  className?: string;
}

// ─── Estado de upload ─────────────────────────────────────────────────────────

interface UploadState {
  estado: "idle" | "uploading" | "success" | "error";
  pesoOriginal?: number;
  pesoOptimizado?: number;
  error?: string;
  deduplicado?: boolean;
  urlPublica?: string;
}

// ─── Formateo ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ahorroPercent(original: number, optimizado: number): number {
  return Math.round((1 - optimizado / original) * 100);
}

// ─── Sub-componente: banner URL pública ──────────────────────────────────────

function UrlPublicaBanner({ urlPublica }: { urlPublica: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      const texto =
        typeof window !== "undefined"
          ? `${window.location.origin}${urlPublica}`
          : urlPublica;
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard no disponible en todos los contextos
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-lime-500/20 bg-lime-500/5 dark:bg-lime-400/5 px-3 py-2">
      <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">URL pública:</span>
      <span className="text-xs font-mono text-lime-700 dark:text-lime-400 truncate flex-1">
        {urlPublica}
      </span>
      <button
        type="button"
        onClick={copiar}
        className="flex-shrink-0 text-stone-400 hover:text-lime-500 transition-colors"
        title="Copiar URL pública"
      >
        {copiado ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function MediaUploader({
  instanciaId,
  modulo,
  entidadId,
  entidadTipo,
  canalOrigen = "web",
  value,
  onChange,
  disabled = false,
  className,
}: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [modoUrl, setModoUrl] = useState(
    () => value.startsWith("http://") || value.startsWith("https://")
  );
  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ estado: "idle" });
  const [cacheBust, setCacheBust] = useState(0);

  // URL pública del archivo actualmente en el campo (imagen pre-existente)
  const [urlPublicaExistente, setUrlPublicaExistente] = useState<string | null>(null);

  // Cuando el valor viene de una imagen ya guardada, buscar su URL pública
  useEffect(() => {
    setUrlPublicaExistente(null);

    // Solo buscar si hay un valor local (no URL externa, no vacío)
    if (!value || value.startsWith("http://") || value.startsWith("https://")) return;

    // No buscar si el último upload ya nos dio la URL pública
    if (uploadState.urlPublica) return;

    const controller = new AbortController();

    fetch(`/api/media/lookup?url=${encodeURIComponent(value)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { urlPublica?: string } | null) => {
        if (data?.urlPublica) setUrlPublicaExistente(data.urlPublica);
      })
      .catch(() => {});

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const subirArchivo = useCallback(
    async (file: File) => {
      setUploadState({ estado: "uploading", pesoOriginal: file.size });
      setUrlPublicaExistente(null);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("instanciaId", instanciaId);
      fd.append("modulo", modulo);
      if (entidadId) fd.append("entidadId", entidadId);
      if (entidadTipo) fd.append("entidadTipo", entidadTipo);
      if (canalOrigen) fd.append("canalOrigen", canalOrigen);

      try {
        const res = await fetch("/api/media/upload", { method: "POST", body: fd });
        const json = (await res.json()) as MediaUploadApiResponse | MediaUploadApiError;

        if (!json.ok) {
          setUploadState({ estado: "error", error: json.error });
          return;
        }

        const { data } = json;
        onChange(data.urlOptimizada, data.id);
        setCacheBust(Date.now());
        setUploadState({
          estado: "success",
          pesoOriginal: data.pesoOriginal,
          pesoOptimizado: data.pesoOptimizado ?? undefined,
          deduplicado: data.deduplicado,
          urlPublica: data.urlPublica,
        });
      } catch {
        setUploadState({ estado: "error", error: "Error de conexión al subir la imagen." });
      }
    },
    [instanciaId, modulo, entidadId, entidadTipo, canalOrigen, onChange]
  );

  const handleFile = (f: File | undefined | null) => {
    if (!f || disabled) return;
    subirArchivo(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleQuitar = () => {
    onChange("");
    setCacheBust(0);
    setUploadState({ estado: "idle" });
    setUrlPublicaExistente(null);
  };

  const urlPublicaActiva = uploadState.urlPublica ?? urlPublicaExistente;
  const preview = value ? `${value}${cacheBust ? `?t=${cacheBust}` : ""}` : "";
  const uploading = uploadState.estado === "uploading";

  return (
    <div className={cn("space-y-3", className)}>

      {/* ── Selector de modo ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-stone-100 dark:bg-white/5 w-fit">
        <button
          type="button"
          onClick={() => { setModoUrl(false); setUploadState({ estado: "idle" }); }}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            !modoUrl
              ? "bg-white dark:bg-white/10 text-stone-900 dark:text-stone-50 shadow-sm"
              : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          )}
        >
          <Upload className="h-3 w-3" />
          Subir archivo
        </button>
        <button
          type="button"
          onClick={() => setModoUrl(true)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            modoUrl
              ? "bg-white dark:bg-white/10 text-stone-900 dark:text-stone-50 shadow-sm"
              : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          )}
        >
          <Link2 className="h-3 w-3" />
          URL externa
        </button>
      </div>

      {modoUrl ? (
        /* ── Modo URL externa ── */
        <div className="flex gap-2">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="https://ejemplo.com/imagen.jpg"
            className="flex-1 h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500/50 transition-all disabled:opacity-50"
          />
          {value && (
            <button
              type="button"
              onClick={handleQuitar}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-stone-200 dark:border-white/10 text-stone-400 hover:text-red-500 hover:border-red-500/30 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        /* ── Modo drag & drop ── */
        <div
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && !disabled && inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all h-36 text-center px-4",
            dragging
              ? "border-lime-400 bg-lime-500/5 dark:bg-lime-400/5"
              : uploadState.estado === "success"
              ? "border-green-400/50 bg-green-500/5 dark:border-green-400/30"
              : uploadState.estado === "error"
              ? "border-red-400/50 bg-red-500/5 dark:border-red-400/30"
              : "border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20 hover:bg-stone-50 dark:hover:bg-white/3",
            (uploading || disabled) && "pointer-events-none opacity-60"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/gif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 text-lime-500 animate-spin" />
              <div className="text-center">
                <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Procesando y subiendo…
                </p>
                {uploadState.pesoOriginal && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {formatBytes(uploadState.pesoOriginal)} → comprimiendo a WebP
                  </p>
                )}
              </div>
            </>
          ) : uploadState.estado === "success" ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div className="text-center">
                <p className="text-xs font-medium text-green-700 dark:text-green-400">
                  {uploadState.deduplicado ? "Imagen reutilizada (ya existía)" : "¡Imagen subida!"}
                </p>
                {uploadState.pesoOriginal && uploadState.pesoOptimizado && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {formatBytes(uploadState.pesoOriginal)} → {formatBytes(uploadState.pesoOptimizado)}
                    {" "}
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      (−{ahorroPercent(uploadState.pesoOriginal, uploadState.pesoOptimizado)}%)
                    </span>
                  </p>
                )}
                <p className="text-xs text-stone-400 mt-1">Haz clic para cambiar la imagen</p>
              </div>
            </>
          ) : (
            <>
              <div className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-white/8 flex items-center justify-center">
                <Upload className="h-5 w-5 text-stone-400 dark:text-stone-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  {dragging ? "Suelta la imagen aquí" : "Arrastra una imagen o haz clic"}
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  JPG, PNG, WebP, AVIF, HEIC · máx. 10 MB · se convierte a WebP
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {uploadState.estado === "error" && uploadState.error && (
        <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {uploadState.error}
        </div>
      )}

      {/* ── Preview + URL pública ── */}
      {preview ? (
        <div className="flex gap-3 items-start">
          {/* Imagen preview */}
          <div className="relative flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-stone-200 dark:border-white/10 bg-stone-100 dark:bg-white/5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Mostrar placeholder si la imagen no carga, sin limpiar el campo
                const img = e.target as HTMLImageElement;
                img.style.display = "none";
                const parent = img.parentElement;
                if (parent) {
                  const placeholder = parent.querySelector("[data-placeholder]") as HTMLElement | null;
                  if (placeholder) placeholder.style.display = "flex";
                }
              }}
            />
            {/* Placeholder visible si la imagen falla */}
            <div
              data-placeholder
              style={{ display: "none" }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-stone-400 dark:text-stone-600"
            >
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Sin vista previa</span>
            </div>
            <button
              type="button"
              onClick={handleQuitar}
              className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* URL pública */}
          {urlPublicaActiva && (
            <div className="flex-1 min-w-0">
              <UrlPublicaBanner urlPublica={urlPublicaActiva} />
            </div>
          )}
        </div>
      ) : (
        <div className="w-32 h-32 rounded-xl border-2 border-dashed border-stone-200 dark:border-white/10 flex flex-col items-center justify-center gap-1.5 text-stone-400 dark:text-stone-600">
          <ImageIcon className="h-5 w-5" />
          <span className="text-xs">Sin imagen</span>
        </div>
      )}
    </div>
  );
}
