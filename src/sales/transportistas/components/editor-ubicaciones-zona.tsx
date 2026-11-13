"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectorEstadoProvincia } from "@/shared/entregas/components/selector-estado-provincia";
import { listarEstadosProvincia } from "@/shared/entregas/queries-geografia";
import { queryKeys } from "@/shared/query-keys";

/** Una zona real llega a decenas de ubicaciones: `id` viaja de vuelta al
 *  servidor para que la edición las reconcilie en vez de recrearlas. */
export interface UbicacionEditable {
  /** Ausente mientras la ubicación no se haya guardado nunca. */
  id?: string;
  paisId: string;
  provinciaEstado: string;
  distritoCiudad: string;
}

interface EditorUbicacionesZonaProps {
  valor: UbicacionEditable[];
  onChange: (ubicaciones: UbicacionEditable[]) => void;
  // 023-transportistas-por-pais — el país no se elige acá: viene fijo del
  // transportista (research.md Decisión 1 / FR-004).
  paisId: string;
  paisLabel: string;
  /** Se despliega la primera de estas filas — p.ej. la que falló al validar. */
  indicesConError?: number[];
}

// Lista de ubicaciones de una zona, compartida por el alta y la edición: filas
// compactas con una sola expandida a la vez y scroll propio. Con todos los
// formularios abiertos el diálogo crecía más allá del viewport y, al estar
// centrado, se cortaba arriba y abajo sin forma de llegar al botón de guardar.
export function EditorUbicacionesZona({
  valor, onChange, paisId, paisLabel, indicesConError,
}: EditorUbicacionesZonaProps) {
  const [indiceExpandido, setIndiceExpandido] = useState<number | null>(0);
  const [desplazarAExpandida, setDesplazarAExpandida] = useState(false);
  const filaExpandidaRef = useRef<HTMLDivElement>(null);

  // `provinciaEstado` es texto libre (no una FK — ver
  // ZonaEntregaUbicacion.provinciaEstado), así que el Combobox (que trabaja
  // con el id de EstadoProvincia) se traduce a ida y vuelta acá: al elegir se
  // guarda el nombre real; para resaltar la selección se busca el id que
  // corresponde a ese nombre en el catálogo ya cacheado por el Selector.
  const { data: estados } = useQuery({
    queryKey: queryKeys.geografia.estados(paisId),
    queryFn: () => listarEstadosProvincia(paisId),
    staleTime: 24 * 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!desplazarAExpandida) return;
    filaExpandidaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setDesplazarAExpandida(false);
  }, [desplazarAExpandida]);

  // Un error en una fila colapsada sería invisible: se despliega la primera.
  const primeraConError = indicesConError?.[0];
  useEffect(() => {
    if (primeraConError == null) return;
    setIndiceExpandido(primeraConError);
    setDesplazarAExpandida(true);
  }, [primeraConError]);

  const actualizar = (idx: number, cambios: Partial<UbicacionEditable>) => {
    onChange(valor.map((u, i) => (i === idx ? { ...u, ...cambios } : u)));
  };

  const agregar = () => {
    setIndiceExpandido(valor.length);
    setDesplazarAExpandida(true);
    onChange([...valor, { paisId, provinciaEstado: "", distritoCiudad: "" }]);
  };

  const quitar = (idx: number) => {
    onChange(valor.filter((_, i) => i !== idx));
    // Los índices posteriores se corren una posición al quitar una fila.
    setIndiceExpandido((actual) => {
      if (actual === null || actual === idx) return null;
      return actual > idx ? actual - 1 : actual;
    });
  };

  const alternar = (idx: number) => {
    setIndiceExpandido((actual) => (actual === idx ? null : idx));
  };

  const resumen = (u: UbicacionEditable) => {
    const partes = [u.provinciaEstado, u.distritoCiudad].filter(Boolean);
    return partes.length > 0 ? partes.join(" · ") : "Sin provincia ni distrito";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <p className="text-sm font-medium text-foreground">Ubicaciones</p>
        <Badge>{valor.length} {valor.length === 1 ? "ubicación" : "ubicaciones"}</Badge>
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        Agrega las ubicaciones donde realizas entregas en esta zona (país, provincia/estado y distrito/ciudad).
      </p>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
        {valor.map((u, idx) => {
          const expandida = indiceExpandido === idx;
          const conError = indicesConError?.includes(idx) ?? false;
          const idPanel = `ubicacion-${u.id ?? `nueva-${idx}`}`;
          return (
            <div
              key={u.id ?? `nueva-${idx}`}
              ref={expandida ? filaExpandidaRef : undefined}
              className={cn(
                "rounded-lg border bg-card transition-colors",
                expandida ? "border-primary/70" : "border-border",
                conError && "border-destructive/70",
              )}
            >
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => alternar(idx)}
                  aria-expanded={expandida}
                  aria-controls={idPanel}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      expandida && "rotate-90",
                    )}
                  />
                  <span className="shrink-0">{paisLabel}</span>
                  <span aria-hidden className="text-muted-foreground">·</span>
                  <span className="truncate text-muted-foreground">{resumen(u)}</span>
                </button>
                {!expandida && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => alternar(idx)}
                    aria-label={`Editar ubicación ${idx + 1}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  disabled={valor.length === 1}
                  onClick={() => quitar(idx)}
                  aria-label={`Eliminar ubicación ${idx + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Eliminar</span>
                </Button>
              </div>

              {expandida && (
                <div id={idPanel} className="space-y-3 border-t border-border px-3 py-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">País</p>
                    <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                      <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      <span>{paisLabel}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Heredado del transportista — no se puede cambiar aquí</p>
                  </div>
                  <div className="space-y-1.5">
                    {/* Sin htmlFor: el Combobox no expone un input asociable. */}
                    <Label className="text-xs">Provincia/Estado</Label>
                    <SelectorEstadoProvincia
                      paisId={paisId}
                      value={estados?.find((e) => e.nombre === u.provinciaEstado)?.id ?? null}
                      onChange={(estadoId) => {
                        const estado = estados?.find((e) => e.id === estadoId);
                        actualizar(idx, { provinciaEstado: estado?.nombre ?? "" });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor={`${idPanel}-distrito`}>Distrito/Ciudad</Label>
                    <Input
                      id={`${idPanel}-distrito`}
                      placeholder="Opcional"
                      value={u.distritoCiudad}
                      onChange={(e) => actualizar(idx, { distritoCiudad: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" className="w-full shrink-0 gap-1.5" onClick={agregar}>
        <Plus className="h-3.5 w-3.5" />
        Agregar ubicación
      </Button>
    </div>
  );
}
