"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelectorPais } from "@/shared/entregas/components/selector-pais";
import { crearZonaEntrega } from "../zonas/actions";
import { CrearZonaEntregaSchema, type CrearZonaEntregaInput } from "../zonas/schema";

interface DialogZonaEntregaProps {
  onCreada: (zona: { id: string; nombre: string }) => void;
}

// 022-transportistas-zonas-tarifas — crear una zona sin salir del flujo de
// configuración de tarifas (FR-012); usado desde SeccionZonasTarifas.
export function DialogZonaEntrega({ onCreada }: DialogZonaEntregaProps) {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CrearZonaEntregaInput>({
    resolver: zodResolver(CrearZonaEntregaSchema),
    defaultValues: { nombre: "", descripcion: "", ubicaciones: [{ paisId: "", provinciaEstado: "" }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "ubicaciones" });

  const onSubmit = (valores: CrearZonaEntregaInput) => {
    startTransition(async () => {
      const resultado = await crearZonaEntrega(valores);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Zona creada");
      onCreada(resultado.data!);
      form.reset({ nombre: "", descripcion: "", ubicaciones: [{ paisId: "", provinciaEstado: "" }] });
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
                      <FormField
                        control={form.control}
                        name={`ubicaciones.${idx}.paisId`}
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-xs">País</FormLabel>
                            <SelectorPais value={field.value || null} onChange={(v) => field.onChange(v ?? "")} />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`ubicaciones.${idx}.provinciaEstado`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Provincia/Estado</FormLabel>
                            <FormControl>
                              <Input placeholder="Opcional — vacío cubre todo el país" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
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
                  onClick={() => append({ paisId: "", provinciaEstado: "" })}
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
