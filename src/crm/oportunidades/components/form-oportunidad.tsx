"use client";

import { useState } from "react";
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
import { SelectorContacto } from "@/crm/contactos/components/selector-contacto";
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
  pipelines?: PipelineConStages[];
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
  pipelines = [],
  monedaDefault = MONEDA_DEFAULT,
}: FormOportunidadProps) {
  const router = useRouter();
  // Lista local de contactos — crece cuando se crea uno nuevo inline, sin recargar la página
  const [contactosDisponibles, setContactosDisponibles] = useState<OpcionCombobox[]>(contactos);
  // enModoPipeline: viene del Kanban con pipeline fijo en URL → solo selector de stage
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
      pipelineId: inicial?.pipelineId ?? pipelineId ?? "",
      stageId: inicial?.stageId ?? stageId ?? "",
      tagIds: tagIdsIniciales,
    },
  });

  // Seguimiento reactivo del pipeline seleccionado en el formulario
  const watchedPipelineId = form.watch("pipelineId");
  const watchedStageId = form.watch("stageId");

  // Pipeline activo en el selector libre (cuando no estamos en modo kanban)
  const pipelineActivo = !enModoPipeline && pipelines.length > 0
    ? (pipelines.find(p => p.id === watchedPipelineId) ?? null)
    : null;

  const stageActivo = pipelineActivo
    ? (pipelineActivo.stages.find(s => s.id === watchedStageId) ?? null)
    : (pipeline?.stages.find(s => s.id === watchedStageId) ?? null);

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
                <FormControl>
                  <SelectTrigger>
                    <SelectValue>{MONEDAS.find(m => m.valor === field.value)?.etiqueta ?? field.value}</SelectValue>
                  </SelectTrigger>
                </FormControl>
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

        {/* ── Pipeline libre (solo cuando no viene del Kanban y hay pipelines disponibles) ── */}
        {!enModoPipeline && pipelines.length > 0 && (
          <FormField control={form.control} name="pipelineId" render={({ field }) => (
            <FormItem>
              <FormLabel>Pipeline</FormLabel>
              <Select
                onValueChange={(v) => {
                  field.onChange(v === "__ninguno__" ? "" : v);
                  form.setValue("stageId", "");
                }}
                value={field.value || "__ninguno__"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue>
                      {field.value
                        ? (pipelines.find(p => p.id === field.value)?.nombre ?? "Seleccionar pipeline...")
                        : "Sin pipeline"}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__ninguno__">Sin pipeline</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Etapa: modo kanban (pipeline fijo) */}
          {enModoPipeline ? (
            <FormField control={form.control} name="stageId" render={({ field }) => (
              <FormItem>
                <FormLabel>Etapa del pipeline</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        {stageActivo ? (
                          <span className="flex items-center gap-2">
                            {stageActivo.color && (
                              <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stageActivo.color }} />
                            )}
                            {stageActivo.nombre}
                          </span>
                        ) : "Seleccionar etapa..."}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {pipeline!.stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <span className="flex items-center gap-2">
                          {stage.color && <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />}
                          {stage.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

          /* Etapa: pipeline seleccionado en selector libre */
          ) : pipelineActivo ? (
            <FormField control={form.control} name="stageId" render={({ field }) => (
              <FormItem>
                <FormLabel>Etapa</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        {stageActivo ? (
                          <span className="flex items-center gap-2">
                            {stageActivo.color && (
                              <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stageActivo.color }} />
                            )}
                            {stageActivo.nombre}
                          </span>
                        ) : "Seleccionar etapa..."}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {pipelineActivo.stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <span className="flex items-center gap-2">
                          {stage.color && <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />}
                          {stage.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

          /* Etapa: sin pipeline (legacy enum) */
          ) : (
            <FormField control={form.control} name="etapa" render={({ field }) => (
              <FormItem>
                <FormLabel>Etapa</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? "PROSPECTO"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        {ETAPA_LABELS[field.value ?? "PROSPECTO"] ?? field.value}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(ETAPA_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
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
                <SelectorContacto
                  contactos={contactosDisponibles}
                  valor={field.value ?? ""}
                  onChange={field.onChange}
                  onContactoCreado={(opcion) => setContactosDisponibles((prev) => [...prev, opcion])}
                  placeholder="Seleccionar contacto..."
                />
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

        {enModoPipeline && (
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-xs",
            "bg-lime-500/8 border border-lime-500/20 dark:bg-lime-400/8 dark:border-lime-400/20",
            "text-lime-700 dark:text-lime-400"
          )}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-500 dark:bg-lime-400" />
            Se creará en el pipeline <span className="font-semibold">{pipeline!.nombre}</span>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]">
            {mutation.isPending ? "Guardando..." : modo === "crear" ? "Crear oportunidad" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

const ETAPA_LABELS: Record<string, string> = {
  PROSPECTO:   "Prospecto",
  CALIFICADO:  "Calificado",
  PROPUESTA:   "Propuesta",
  NEGOCIACION: "Negociación",
  GANADO:      "Ganado",
  PERDIDO:     "Perdido",
};
