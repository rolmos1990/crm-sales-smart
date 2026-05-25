"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { actualizarOportunidad, eliminarOportunidad } from "../actions";
import { ActualizarOportunidadSchema, type ActualizarOportunidadInput } from "../schema";
import type { Oportunidad } from "../types";
import { ETAPAS_PIPELINE } from "../types";
import { cn } from "@/lib/utils";

interface PanelOportunidadProps {
  oportunidad: Oportunidad | null;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  onClose: () => void;
  onUpdate: (updated: Oportunidad) => void;
  onDelete: (id: string) => void;
}

export function PanelOportunidad({
  oportunidad,
  empresas,
  contactos,
  onClose,
  onUpdate,
  onDelete,
}: PanelOportunidadProps) {
  const form = useForm<ActualizarOportunidadInput>({
    resolver: zodResolver(ActualizarOportunidadSchema),
  });

  useEffect(() => {
    if (!oportunidad) return;
    form.reset({
      titulo: oportunidad.titulo,
      valor: oportunidad.valor,
      moneda: oportunidad.moneda,
      etapa: oportunidad.etapa,
      probabilidad: oportunidad.probabilidad,
      fechaCierre: oportunidad.fechaCierre
        ? new Date(oportunidad.fechaCierre)
        : undefined,
      notas: oportunidad.notas ?? "",
      empresaId: oportunidad.empresaId ?? "",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidad?.id]);

  const onSubmit = async (datos: ActualizarOportunidadInput) => {
    if (!oportunidad) return;
    const resultado = await actualizarOportunidad(oportunidad.id, datos);
    if (resultado.exito) {
      toast.success("Oportunidad actualizada");
      onUpdate(resultado.datos);
    } else {
      toast.error(resultado.error);
    }
  };

  const handleDelete = async () => {
    if (!oportunidad) return;
    const resultado = await eliminarOportunidad(oportunidad.id);
    if (resultado.exito) {
      toast.success("Oportunidad eliminada");
      onDelete(oportunidad.id);
      onClose();
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <Sheet open={!!oportunidad} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-left text-sm font-medium text-muted-foreground">
            Editar oportunidad
          </SheetTitle>
        </SheetHeader>

        {oportunidad && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {/* Título grande editable */}
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full border-0 bg-transparent p-0 text-xl font-semibold placeholder:text-muted-foreground/50 focus:outline-none"
                          placeholder="Título de la oportunidad"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Etapa */}
                <FormField
                  control={form.control}
                  name="etapa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Etapa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ETAPAS_PIPELINE.map((e) => (
                            <SelectItem key={e.valor} value={e.valor}>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  e.color
                                )}
                              >
                                {e.etiqueta}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Valor + Moneda */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="moneda"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moneda</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PEN">PEN (S/)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Probabilidad + Fecha cierre */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="probabilidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Probabilidad (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fechaCierre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de cierre</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={
                              field.value
                                ? new Date(field.value).toISOString().split("T")[0]
                                : ""
                            }
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? new Date(e.target.value) : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Empresa */}
                <FormField
                  control={form.control}
                  name="empresaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Combobox
                          opciones={empresas}
                          valor={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Seleccionar empresa..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contacto (solo lectura, sin onChange en action actual) */}
                <FormItem>
                  <FormLabel>Contacto principal</FormLabel>
                  <Combobox
                    opciones={contactos}
                    valor={oportunidad.contactos?.[0]?.contacto.id ?? ""}
                    onChange={() => {}}
                    placeholder="Sin contacto asignado"
                    disabled
                  />
                </FormItem>

                <Separator />

                {/* Notas */}
                <FormField
                  control={form.control}
                  name="notas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          className="resize-none"
                          placeholder="Escribe los detalles de esta oportunidad..."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <SheetFooter className="flex-row items-center justify-between gap-2 border-t px-6 py-4">
                <div className="flex gap-1">
                  <ConfirmacionDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Eliminar
                      </Button>
                    }
                    titulo="¿Eliminar oportunidad?"
                    descripcion={`Se eliminará permanentemente "${oportunidad.titulo}".`}
                    onConfirmar={handleDelete}
                  />
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link href={`/crm/oportunidades/${oportunidad.id}`}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Ver completo
                    </Link>
                  </Button>
                </div>
                <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Guardando..." : "Guardar"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  );
}
