"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelectorEstadoProvincia } from "@/shared/entregas/components/selector-estado-provincia";
import { listarEstadosProvincia } from "@/shared/entregas/queries-geografia";
import { queryKeys } from "@/shared/query-keys";
import { crearZonaEntrega } from "../zonas/actions";
import { CrearZonaEntregaSchema, type CrearZonaEntregaInput } from "../zonas/schema";

interface DialogZonaEntregaProps {
  // 023-transportistas-por-pais — el país ya no se elige acá: viene fijo
  // del transportista (research.md Decisión 1 / FR-004).
  paisId: string;
  paisLabel: string;
  onCreada: (zona: { id: string; nombre: string }) => void;
}

// 022-transportistas-zonas-tarifas — crear una zona sin salir del flujo de
// configuración de tarifas (FR-012); usado desde SeccionZonasTarifas.
//
// Una zona real llega a decenas de ubicaciones. Por eso la lista es de filas
// colapsadas con una sola expandida a la vez y scroll propio: con todos los
// formularios abiertos el diálogo crecía más allá del viewport y, al estar
// centrado con `-translate-y-1/2`, se cortaba arriba y abajo sin forma de
// llegar al botón de guardar.
export function DialogZonaEntrega({ paisId, paisLabel, onCreada }: DialogZonaEntregaProps) {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  /** Índice de la única ubicación con el formulario desplegado. */
  const [indiceExpandido, setIndiceExpandido] = useState<number | null>(0);
  const [desplazarAExpandida, setDesplazarAExpandida] = useState(false);
  const filaExpandidaRef = useRef<HTMLDivElement>(null);

  const form = useForm<CrearZonaEntregaInput>({
    resolver: zodResolver(CrearZonaEntregaSchema),
    defaultValues: { nombre: "", descripcion: "", ubicaciones: [{ paisId, provinciaEstado: "" }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "ubicaciones" });

  // Valores en vivo para el resumen de cada fila colapsada.
  const ubicaciones = useWatch({ control: form.control, name: "ubicaciones" });

  // `ubicaciones.provinciaEstado` es texto libre (no una FK — ver
  // ZonaEntregaUbicacion.provinciaEstado), así que el Combobox (que trabaja
  // con el id de EstadoProvincia) se traduce a ida y vuelta acá: al elegir
  // se guarda el nombre real; para resaltar la selección se busca el id que
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

  const agregarUbicacion = () => {
    setIndiceExpandido(fields.length);
    setDesplazarAExpandida(true);
    append({ paisId, provinciaEstado: "" });
  };

  const quitarUbicacion = (idx: number) => {
    remove(idx);
    // Los índices posteriores se corren una posición al quitar una fila.
    setIndiceExpandido((actual) => {
      if (actual === null || actual === idx) return null;
      return actual > idx ? actual - 1 : actual;
    });
  };

  const alternarUbicacion = (idx: number) => {
    setIndiceExpandido((actual) => (actual === idx ? null : idx));
  };

  // Un error en una fila colapsada sería invisible: se despliega la primera
  // que lo tenga para que el usuario vea qué corregir.
  const onInvalid = (errores: FieldErrors<CrearZonaEntregaInput>) => {
    const deUbicaciones = errores.ubicaciones;
    if (!Array.isArray(deUbicaciones)) return;
    const primera = deUbicaciones.findIndex(Boolean);
    if (primera >= 0) {
      setIndiceExpandido(primera);
      setDesplazarAExpandida(true);
    }
  };

  const onSubmit = (valores: CrearZonaEntregaInput) => {
    startTransition(async () => {
      const resultado = await crearZonaEntrega(valores);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Zona creada");
      onCreada(resultado.data!);
      form.reset({ nombre: "", descripcion: "", ubicaciones: [{ paisId, provinciaEstado: "" }] });
      setIndiceExpandido(0);
      setAbierto(false);
    });
  };

  const resumenUbicacion = (idx: number) => {
    const u = ubicaciones?.[idx];
    const partes = [u?.provinciaEstado, u?.distritoCiudad].filter(Boolean);
    return partes.length > 0 ? partes.join(" · ") : "Sin provincia ni distrito";
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setAbierto(true)}>
        <Plus className="h-3.5 w-3.5" />
        Agregar zona
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        {/* flex en columna + max-h: el encabezado y el pie quedan fijos y solo
            la lista de ubicaciones desplaza. `min-h-0` en cada eslabón de la
            cadena es lo que permite que el área de scroll ceda altura. */}
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-14">
            <DialogTitle>Nueva zona de entrega</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem className="shrink-0">
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Lima Norte" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Ubicaciones</p>
                    <Badge>{fields.length} {fields.length === 1 ? "ubicación" : "ubicaciones"}</Badge>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    Agrega las ubicaciones donde realizas entregas en esta zona (país, provincia/estado y distrito/ciudad).
                  </p>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
                    {fields.map((f, idx) => {
                      const expandida = indiceExpandido === idx;
                      const conError = !!form.formState.errors.ubicaciones?.[idx];
                      return (
                        <div
                          key={f.id}
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
                              onClick={() => alternarUbicacion(idx)}
                              aria-expanded={expandida}
                              aria-controls={`ubicacion-${f.id}`}
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
                              <span className="truncate text-muted-foreground">{resumenUbicacion(idx)}</span>
                            </button>
                            {!expandida && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-muted-foreground"
                                onClick={() => alternarUbicacion(idx)}
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
                              disabled={fields.length === 1}
                              onClick={() => quitarUbicacion(idx)}
                              aria-label={`Eliminar ubicación ${idx + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Eliminar</span>
                            </Button>
                          </div>

                          {expandida && (
                            <div id={`ubicacion-${f.id}`} className="space-y-3 border-t border-border px-3 py-3">
                              <div>
                                <p className="mb-1.5 text-xs font-medium text-muted-foreground">País</p>
                                <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                                  <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
                                  <span>{paisLabel}</span>
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">Heredado del transportista — no se puede cambiar aquí</p>
                              </div>
                              <FormField
                                control={form.control}
                                name={`ubicaciones.${idx}.provinciaEstado`}
                                render={({ field }) => {
                                  const estadoActual = estados?.find((e) => e.nombre === field.value);
                                  return (
                                    <FormItem>
                                      <FormLabel className="text-xs">Provincia/Estado</FormLabel>
                                      <SelectorEstadoProvincia
                                        paisId={paisId}
                                        value={estadoActual?.id ?? null}
                                        onChange={(estadoId) => {
                                          const estado = estados?.find((e) => e.id === estadoId);
                                          field.onChange(estado?.nombre ?? "");
                                        }}
                                      />
                                      <FormMessage />
                                    </FormItem>
                                  );
                                }}
                              />
                              <FormField
                                control={form.control}
                                name={`ubicaciones.${idx}.distritoCiudad`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Distrito/Ciudad</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Opcional" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full shrink-0 gap-1.5"
                    onClick={agregarUbicacion}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar ubicación
                  </Button>
                </div>
              </div>

              <DialogFooter className="mx-0 mb-0 shrink-0">
                <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear zona
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
