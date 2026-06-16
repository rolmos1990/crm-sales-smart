"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import { MONEDAS, MONEDA_DEFAULT } from "@/shared/moneda/constants";
import { CrearOportunidadSchema, type CrearOportunidadInput } from "../schema";
import { useCrearOportunidadMutation, useActualizarOportunidadMutation } from "../hooks";
import type { Oportunidad } from "../types";
import type { PipelineConStages } from "@/crm/pipeline/types";
import type { Tag } from "@/crm/tags/types";
import { cn } from "@/lib/utils";

interface FormOportunidadProps {
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  tags?: Tag[];
  tagIdsIniciales?: string[];
  inicial?: Partial<Oportunidad>;
  modo?: "crear" | "editar";
  pipelineId?: string | null;
  stageId?: string | null;
  pipeline?: PipelineConStages | null;
  monedaDefault?: string;
}

export function FormOportunidad({
  empresas,
  contactos,
  tags = [],
  tagIdsIniciales = [],
  inicial,
  modo = "crear",
  pipelineId,
  stageId,
  pipeline,
  monedaDefault = MONEDA_DEFAULT,
}: FormOportunidadProps) {
  const router = useRouter();
  const enModoPipeline = !!pipeline && !!pipelineId;
  const crearMutation = useCrearOportunidadMutation();
  const actualizarMutation = useActualizarOportunidadMutation(inicial?.id ?? "");
  const mutation = modo === "crear" ? crearMutation : actualizarMutation;

  const form = useForm<CrearOportunidadInput>({
    resolver: zodResolver(CrearOportunidadSchema),
    defaultValues: {
      titulo: inicial?.titulo ?? "",
      valor: inicial?.valor ?? 0,
      moneda: inicial?.moneda ?? monedaDefault,
      etapa: inicial?.etapa ?? "PROSPECTO",
      fechaCierre: inicial?.fechaCierre ? new Date(inicial.fechaCierre) : undefined,
      notas: inicial?.notas ?? "",
      empresaId: inicial?.empresaId ?? "",
      contactoId: "",
      pipelineId: pipelineId ?? "",
      stageId: stageId ?? "",
      tagIds: tagIdsIniciales,
    },
  });

  const onSubmit = (datos: CrearOportunidadInput) => {
    mutation.mutate(datos, {
      onSuccess: () => {
        if (enModoPipeline) {
          router.push(`/crm/pipeline?p=${pipelineId}`);
        } else {
          router.push("/crm/oportunidades");
        }
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="titulo" render={({ field }) => (
          <FormItem>
            <FormLabel>Título *</FormLabel>
            <FormControl><Input placeholder="Proyecto de implementación ERP..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="valor" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor *</FormLabel>
              <FormControl>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="moneda" render={({ field }) => (
            <FormItem>
              <FormLabel>Moneda</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? monedaDefault}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {MONEDAS.map((m) => (
                    <SelectItem key={m.valor} value={m.valor}>{m.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Selector de etapa: stage del pipeline O etapa legacy */}
          {enModoPipeline ? (
            <FormField control={form.control} name="stageId" render={({ field }) => {
              const stageSeleccionado = pipeline.stages.find(s => s.id === field.value);
              return (
                <FormItem>
                  <FormLabel>Etapa del pipeline</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        {stageSeleccionado ? (
                          <span className="flex flex-1 items-center gap-2">
                            {stageSeleccionado.color && (
                              <span
                                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: stageSeleccionado.color }}
                              />
                            )}
                            <span>{stageSeleccionado.nombre}</span>
                          </span>
                        ) : (
                          <SelectValue placeholder="Seleccionar etapa..." />
                        )}
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pipeline.stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <span className="flex items-center gap-2">
                            {stage.color && (
                              <span
                                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: stage.color }}
                              />
                            )}
                            {stage.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }} />
          ) : (
            <FormField control={form.control} name="etapa" render={({ field }) => (
              <FormItem>
                <FormLabel>Etapa</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="PROSPECTO">Prospecto</SelectItem>
                    <SelectItem value="CALIFICADO">Calificado</SelectItem>
                    <SelectItem value="PROPUESTA">Propuesta</SelectItem>
                    <SelectItem value="NEGOCIACION">Negociación</SelectItem>
                    <SelectItem value="GANADO">Ganado</SelectItem>
                    <SelectItem value="PERDIDO">Perdido</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          )}

          <FormField control={form.control} name="fechaCierre" render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de cierre</FormLabel>
              <FormControl>
                <SmartDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Selecciona fecha de cierre"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="empresaId" render={({ field }) => (
            <FormItem>
              <FormLabel>Empresa</FormLabel>
              <FormControl>
                <Combobox opciones={empresas} valor={field.value ?? ""} onChange={field.onChange} placeholder="Seleccionar empresa..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="contactoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Contacto principal</FormLabel>
              <FormControl>
                <Combobox opciones={contactos} valor={field.value ?? ""} onChange={field.onChange} placeholder="Seleccionar contacto..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {tags.length > 0 && (
          <FormField control={form.control} name="tagIds" render={({ field }) => (
            <FormItem>
              <FormLabel>Etiquetas</FormLabel>
              <FormControl>
                <SelectorTags
                  tags={tags}
                  seleccionados={field.value ?? []}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <FormField control={form.control} name="notas" render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Detalles de la oportunidad..."
                className="resize-none"
                rows={3}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Indicador visual cuando se crea en un pipeline específico */}
        {enModoPipeline && (
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-xs",
            "bg-lime-500/8 border border-lime-500/20 dark:bg-lime-400/8 dark:border-lime-400/20",
            "text-lime-700 dark:text-lime-400"
          )}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-500 dark:bg-lime-400" />
            Se creará en el pipeline <span className="font-semibold">{pipeline.nombre}</span>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : modo === "crear" ? "Crear oportunidad" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
