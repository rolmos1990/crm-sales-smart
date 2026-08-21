"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface PlantillaItem {
  id: string;
  nombre: string;
  alias: string;
  descripcion: string | null;
  tipo: string;
  contenidoTexto: string | null;
  imagenUrl: string | null;
  activo: boolean;
}

const USOS_KEY = "crm-plantillas-usos";
const MAX_FAV = 5;

function cargarUsos(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(USOS_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function registrarUsoPlantilla(alias: string) {
  const usos = cargarUsos();
  usos[alias] = (usos[alias] ?? 0) + 1;
  localStorage.setItem(USOS_KEY, JSON.stringify(usos));
}

function getIcono(alias: string, nombre: string): string {
  const s = (alias + nombre).toLowerCase();
  if (s.match(/salud|bienven/)) return "👋";
  if (s.match(/pago|cobro|factur/)) return "💰";
  if (s.match(/pedido|envio|envío/)) return "📦";
  if (s.match(/llamad|reagend|cita/)) return "📞";
  if (s.match(/oferta|promo/)) return "🛒";
  if (s.match(/fideliz|program/)) return "⭐";
  if (s.match(/reclam|soporte|incid/)) return "⚠️";
  if (s.match(/document/)) return "📄";
  return "💬";
}

function extractVariables(texto: string): string[] {
  const matches = texto.match(/\{\{[\w]+\}\}/g);
  return matches ? [...new Set(matches)] : [];
}

interface SelectorPlantillasProps {
  plantillas: PlantillaItem[];
  filtro: string;
  onSeleccionar: (plantilla: PlantillaItem) => void;
  onCerrar: () => void;
  onAutocompletar: (alias: string) => void;
}

export function SelectorPlantillas({
  plantillas,
  filtro,
  onSeleccionar,
  onCerrar,
  onAutocompletar,
}: SelectorPlantillasProps) {
  const [indice, setIndice] = useState(0);
  const [usos, setUsos] = useState<Record<string, number>>({});
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsos(cargarUsos());
  }, []);

  const filtradas = useMemo(() => {
    const q = filtro.toLowerCase();
    return plantillas.filter(
      (p) =>
        p.activo &&
        (!q ||
          p.alias.toLowerCase().includes(q) ||
          p.nombre.toLowerCase().includes(q) ||
          (p.descripcion?.toLowerCase().includes(q) ?? false))
    );
  }, [plantillas, filtro]);

  const favoritas = useMemo(
    () =>
      filtradas
        .filter((p) => (usos[p.alias] ?? 0) > 0)
        .sort((a, b) => (usos[b.alias] ?? 0) - (usos[a.alias] ?? 0))
        .slice(0, MAX_FAV),
    [filtradas, usos]
  );

  const restantes = useMemo(() => {
    const favSet = new Set(favoritas.map((f) => f.id));
    return filtradas.filter((p) => !favSet.has(p.id));
  }, [filtradas, favoritas]);

  const ordenadas = useMemo(() => [...favoritas, ...restantes], [favoritas, restantes]);

  const plantillaActiva = ordenadas[indice] ?? null;

  useEffect(() => {
    setIndice(0);
  }, [filtro]);

  useEffect(() => {
    if (indice >= ordenadas.length && ordenadas.length > 0) {
      setIndice(ordenadas.length - 1);
    }
  }, [ordenadas.length, indice]);

  // Scroll activo al view
  useEffect(() => {
    const el = listaRef.current?.querySelector(`[data-sel-idx="${indice}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  // Interceptar teclado antes que el textarea
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setIndice((i) => Math.min(ordenadas.length - 1, i + 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setIndice((i) => Math.max(0, i - 1));
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (plantillaActiva) {
            registrarUsoPlantilla(plantillaActiva.alias);
            setUsos(cargarUsos());
            onSeleccionar(plantillaActiva);
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onCerrar();
          break;
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          if (plantillaActiva) {
            onAutocompletar(plantillaActiva.alias);
          }
          break;
      }
    };
    document.addEventListener("keydown", handleKey, { capture: true });
    return () => document.removeEventListener("keydown", handleKey, { capture: true });
  }, [ordenadas.length, plantillaActiva, onSeleccionar, onCerrar, onAutocompletar]);

  if (ordenadas.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-xl border border-border bg-dropdown backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] dark:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] p-4 text-center text-muted-foreground text-sm">
        Sin plantillas para &ldquo;{filtro}&rdquo;
      </div>
    );
  }

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-xl border border-border bg-dropdown backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] dark:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex h-72">
        {/* Columna izquierda — lista */}
        <div ref={listaRef} className="w-[45%] border-r border-border overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 px-3 py-2 border-b border-border-subtle bg-dropdown z-10">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Plantillas
            </p>
          </div>

          {favoritas.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-stage-amber-text/80">
                ⭐ Favoritas
              </div>
              {favoritas.map((p, i) => (
                <ItemLista
                  key={p.id}
                  plantilla={p}
                  activa={ordenadas[indice]?.id === p.id}
                  dataIdx={i}
                  onHover={() => setIndice(i)}
                  onClick={() => {
                    registrarUsoPlantilla(p.alias);
                    setUsos(cargarUsos());
                    onSeleccionar(p);
                  }}
                />
              ))}
            </div>
          )}

          {restantes.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Todas las plantillas
              </div>
              {restantes.map((p, i) => {
                const gi = favoritas.length + i;
                return (
                  <ItemLista
                    key={p.id}
                    plantilla={p}
                    activa={ordenadas[indice]?.id === p.id}
                    dataIdx={gi}
                    onHover={() => setIndice(gi)}
                    onClick={() => {
                      registrarUsoPlantilla(p.alias);
                      setUsos(cargarUsos());
                      onSeleccionar(p);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Columna derecha — preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header preview */}
          <div className="sticky top-0 px-3 py-2 border-b border-border-subtle bg-dropdown">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Vista previa
            </p>
          </div>

          {plantillaActiva ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Nombre + badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">{getIcono(plantillaActiva.alias, plantillaActiva.nombre)}</span>
                  <p className="text-xs font-semibold text-foreground truncate">{plantillaActiva.alias}</p>
                </div>
                {(usos[plantillaActiva.alias] ?? 0) > 0 && (
                  <span className="shrink-0 text-[9px] bg-stage-amber-muted text-stage-amber-text border border-stage-amber-border px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    ⭐ Favorita
                  </span>
                )}
              </div>

              {/* Contenido */}
              <div className="rounded-lg border border-border-subtle bg-muted p-2.5 text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap max-h-28 overflow-y-auto scrollbar-thin">
                {plantillaActiva.contenidoTexto ?? "(sin contenido)"}
              </div>

              {/* Imagen adjunta */}
              {plantillaActiva.imagenUrl && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>📷</span>
                  <span>Imagen adjunta</span>
                </div>
              )}

              {/* Variables */}
              {plantillaActiva.contenidoTexto &&
                extractVariables(plantillaActiva.contenidoTexto).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Variables</p>
                    <div className="flex flex-wrap gap-1">
                      {extractVariables(plantillaActiva.contenidoTexto).map((v) => (
                        <span
                          key={v}
                          className="text-[10px] bg-inbox-accent-muted text-inbox-accent border border-inbox-accent-border px-1.5 py-0.5 rounded"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Canal */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-3.5 h-3.5 rounded-full bg-success flex items-center justify-center text-[8px] text-inbox-accent-foreground shrink-0">
                  ✓
                </span>
                <span>WhatsApp</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
              Selecciona una plantilla
            </div>
          )}
        </div>
      </div>

      {/* Footer — atajos */}
      <div className="border-t border-border px-3 py-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>
          <kbd className="px-1 py-px rounded bg-muted border border-border-subtle text-muted-foreground font-mono">
            ↑↓
          </kbd>{" "}
          Navegar
        </span>
        <span>
          <kbd className="px-1 py-px rounded bg-muted border border-border-subtle text-muted-foreground font-mono">
            Enter
          </kbd>{" "}
          Seleccionar
        </span>
        <span>
          <kbd className="px-1 py-px rounded bg-muted border border-border-subtle text-muted-foreground font-mono">
            Esc
          </kbd>{" "}
          Cerrar
        </span>
      </div>
    </div>
  );
}

interface ItemListaProps {
  plantilla: PlantillaItem;
  activa: boolean;
  dataIdx: number;
  onHover: () => void;
  onClick: () => void;
}

function ItemLista({ plantilla, activa, dataIdx, onHover, onClick }: ItemListaProps) {
  return (
    <button
      type="button"
      data-sel-idx={dataIdx}
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2 flex items-start gap-2 transition-all border-l-2",
        activa
          ? "bg-inbox-accent-muted border-inbox-accent/50"
          : "border-transparent hover:bg-muted"
      )}
    >
      <span className="text-base leading-none mt-0.5 shrink-0">
        {getIcono(plantilla.alias, plantilla.nombre)}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{plantilla.alias}</p>
        {plantilla.descripcion && (
          <p className="text-[10px] text-muted-foreground truncate">{plantilla.descripcion}</p>
        )}
      </div>
    </button>
  );
}
