"use client";

import { useRef, useState } from "react";
import { ImageIcon, Upload, X, Loader2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadImagenProductoProps {
  productoId: string | null;
  instancia?: string;
  value: string;
  onChange: (url: string) => void;
}

export function UploadImagenProducto({
  productoId,
  instancia = "default",
  value,
  onChange,
}: UploadImagenProductoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modoUrl, setModoUrl] = useState(!productoId);
  const [dragging, setDragging] = useState(false);
  // cacheBust solo se usa para forzar recarga del <img>, no se guarda en DB
  const [cacheBust, setCacheBust] = useState(0);

  const subirArchivo = async (file: File) => {
    if (!productoId) {
      setError("Guarda el producto primero para poder subir una imagen.");
      return;
    }
    setError(null);
    setSubiendo(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("productoId", productoId);
    fd.append("instancia", instancia);

    try {
      const res = await fetch("/api/upload/producto", { method: "POST", body: fd });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Error al subir");
      onChange(json.url);          // URL limpia → se guarda en DB
      setCacheBust(Date.now());    // fuerza recarga del <img> en pantalla
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setSubiendo(false);
    }
  };

  const handleFile = (f: File | undefined | null) => {
    if (!f) return;
    subirArchivo(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // Añade cache-bust solo cuando se acaba de subir un archivo nuevo
  const preview = value ? `${value}${cacheBust ? `?t=${cacheBust}` : ""}` : "";

  return (
    <div className="space-y-3">
      {/* Tabs: subir / URL */}
      <div className="flex gap-1 p-1 rounded-xl bg-stone-100 dark:bg-white/5 w-fit">
        <button
          type="button"
          onClick={() => setModoUrl(false)}
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
        /* ── Modo URL ── */
        <div className="flex gap-2">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
            className="flex-1 h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500/50 transition-all"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-stone-200 dark:border-white/10 text-stone-400 hover:text-red-500 hover:border-red-500/30 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        /* ── Modo upload ── */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !subiendo && inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all",
            "h-36 text-center px-4",
            dragging
              ? "border-lime-400 bg-lime-500/5 dark:bg-lime-400/5"
              : "border-stone-200 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20 hover:bg-stone-50 dark:hover:bg-white/3",
            subiendo && "pointer-events-none opacity-60"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {subiendo ? (
            <>
              <Loader2 className="h-6 w-6 text-lime-500 animate-spin" />
              <p className="text-xs text-stone-500 dark:text-stone-400">Comprimiendo y guardando…</p>
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
                  JPG, PNG o WebP · máx. 5 MB · se guarda como WebP comprimido
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Preview */}
      {preview ? (
        <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={() => onChange("")}
          />
          <button
            type="button"
            onClick={() => { onChange(""); setCacheBust(0); }}
            className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="w-32 h-32 rounded-xl border-2 border-dashed border-stone-200 dark:border-white/10 flex flex-col items-center justify-center gap-1.5 text-stone-400 dark:text-stone-600">
          <ImageIcon className="h-6 w-6" />
          <span className="text-xs">Sin imagen</span>
        </div>
      )}
    </div>
  );
}
