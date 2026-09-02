"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
export function DialogZonaEntrega({ paisId, paisLabel, onCreada }: DialogZonaEntregaProps) {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CrearZonaEntregaInput>({
    resolver: zodResolver(CrearZonaEntregaSchema),
    defaultValues: { nombre: "", descripcion: "", ubicaciones: [{ paisId, provinciaEstado: "" }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "ubicaciones" });

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
      setAbierto(false);
    });
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setAbierto(true)}>
        <Plus className="h-3.5 w-3.5" />
        Agregar zona
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva zona de entrega</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Lima Norte" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Ubicaciones</p>
                {fields.map((f, idx) => (
                  <div key={f.id} className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">País</p>
                        <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          <span>{paisLabel}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">Heredado del transportista — no se puede cambiar aquí</p>
                      </div>
                      <FormField
                        control={form.control}
                        name={`ubicaciones.${idx}.provinciaEstado`}
                        render={({ field }) => {
                          const estadoActual = estados?.find((e) => e.nombre === field.value);
                          return (
                            <FormItem className="col-span-2">
                              <FormLabel className="text-xs">Provincia/Estado</FormLabel>
                              <SelectorEstadoProvincia
                                paisId={paisId}
                                value={estadoActual?.id ?? null}
                                onChange={(estadoId) => {
                                  const estado = estados?.find((e) => e.id === estadoId);
                                  field.onChange(estado?.nombre ?? "");
                                }}
                              />
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
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6"
                      disabled={fields.length === 1}
                      onClick={() => remove(idx)}
                      aria-label="Quitar ubicación"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => append({ paisId, provinciaEstado: "" })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar ubicación
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear zona
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
