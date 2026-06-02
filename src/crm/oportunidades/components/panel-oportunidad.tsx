"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ExternalLink, Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Button, ButtonLink } from "@/components/ui/button";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import {
  actualizarOportunidad,
  eliminarOportunidad,
  obtenerOportunidadAction,
} from "../actions";
import { ActualizarOportunidadSchema, type ActualizarOportunidadInput } from "../schema";
import type { Oportunidad, Etapa } from "../types";
import { ETAPAS_PIPELINE } from "../types";
import { MoverPipelinePopover } from "./mover-pipeline-popover";
import { MONEDAS } from "@/shared/moneda/constants";
import { cn } from "@/lib/utils";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import { obtenerTagsAction } from "@/crm/tags/actions";
import type { Tag } from "@/crm/tags/types";
import { GestorContactosPanel, type ContactoEnPanel } from "./gestor-contactos-panel";

// ── Props ─────────────────────────────────────────────────────────

interface PanelOportunidadProps {
  oportunidad: Oportunidad | null;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  defaultCountryCode?: string;
  onClose: () => void;
  onUpdate: (updated: Oportunidad) => void;
  onDelete: (id: string) => void;
}

// ── Componente ───────────────────────────────────────────────────

export function PanelOportunidad({
  oportunidad,
  empresas,
  contactos,
  defaultCountryCode = "PA",
  onClose,
  onUpdate,
  onDelete,
}: PanelOportunidadProps) {
  const [activeTab, setActiveTab] = useState<"info" | "contacto">("info");
  const [tagsDisponibles, setTagsDisponibles] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [contactosIniciales, setContactosIniciales] = useState<ContactoEnPanel[]>([]);

  const form = useForm<ActualizarOportunidadInput>({
    resolver: zodResolver(ActualizarOportunidadSchema),
  });

  useEffect(() => {
    if (!oportunidad) return;
    setActiveTab("info");
    form.reset({
      titulo: oportunidad.titulo,
      valor: oportunidad.valor,
      moneda: oportunidad.moneda,
      etapa: oportunidad.etapa,
      fechaCierre: oportunidad.fechaCierre ? new Date(oportunidad.fechaCierre) : undefined,
      notas: oportunidad.notas ?? "",
      empresaId: oportunidad.empresaId ?? "",
    });

    Promise.all([
      obtenerTagsAction(),
      obtenerOportunidadAction(oportunidad.id),
    ]).then(([tags, op]) => {
      setTagsDisponibles(tags as Tag[]);
      setTagIds(op?.tags?.map((t: { tagId: string }) => t.tagId) ?? []);

      const cts: ContactoEnPanel[] = ((op as any)?.contactos ?? []).map((rel: any) => ({
        contactoId: rel.contactoId,
        principal: rel.principal,
        contacto: rel.contacto,
      }));
      setContactosIniciales(cts);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidad?.id]);

  const onSubmit = async (datos: ActualizarOportunidadInput) => {
    if (!oportunidad) return;
    const resultado = await actualizarOportunidad(oportunidad.id, { ...datos, tagIds });
    if (resultado.exito) {
      toast.success("Oportunidad actualizada");
      onUpdate({
        ...resultado.datos,
        tags: tagIds.map((tagId) => ({
          tagId,
          tag: tagsDisponibles.find((t) => t.id === tagId) ?? { id: tagId, nombre: "", color: null },
        })),
      });
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

  const handleMovidaEtapa = (nuevaEtapa: Etapa) => {
    if (!oportunidad) return;
    form.setValue("etapa", nuevaEtapa);
    onUpdate({ ...oportunidad, etapa: nuevaEtapa, tags: oportunidad.tags });
  };

  return (
    <Sheet open={!!oportunidad} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[500px] bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10 shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="border-b border-stone-100 dark:border-white/10 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-lime-500/10 dark:bg-lime-400/10 p-1.5">
              <Pencil className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400" />
            </div>
            <SheetTitle className="text-sm font-semibold text-stone-500 dark:text-stone-400 tracking-wide">
              Editar oportunidad
            </SheetTitle>
            <span className="flex-1" />
            {oportunidad && (
              <MoverPipelinePopover
                oportunidadId={oportunidad.id}
                etapaActual={oportunidad.etapa}
                onMovidoEtapa={handleMovidaEtapa}
              />
            )}
          </div>
        </SheetHeader>

        {oportunidad && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "info" | "contacto")}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="mx-6 mt-3 flex-shrink-0 grid grid-cols-2 h-9 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/8 p-0.5 gap-0.5">
              <TabsTrigger
                value="info"
                className="rounded-lg text-xs font-semibold transition-all text-stone-500 dark:text-stone-400 data-active:bg-white dark:data-active:bg-white/10 data-active:text-stone-900 dark:data-active:text-stone-100 data-active:shadow-sm"
              >
                Información
              </TabsTrigger>
              <TabsTrigger
                value="contacto"
                className="rounded-lg text-xs font-semibold transition-all text-stone-500 dark:text-stone-400 data-active:bg-white dark:data-active:bg-white/10 data-active:text-stone-900 dark:data-active:text-stone-100 data-active:shadow-sm"
              >
                Contactos{contactosIniciales.length > 0 ? ` (${contactosIniciales.length})` : ""}
              </TabsTrigger>
            </TabsList>

            {/* ── Pestaña: Información ────────────────────────────── */}
            <div className={cn("flex-1 flex flex-col overflow-hidden", activeTab !== "info" && "hidden")}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Título */}
                    <FormField
                      control={form.control}
                      name="titulo"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <textarea
                              {...field}
                              rows={2}
                              className="w-full border-0 bg-transparent p-0 text-xl font-semibold leading-snug placeholder:text-stone-300 dark:placeholder:text-stone-700 focus:outline-none resize-none text-stone-900 dark:text-stone-50"
                              placeholder="Título de la oportunidad"
                              value={field.value ?? ""}
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
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                            Etapa
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ETAPAS_PIPELINE.map((e) => (
                                <SelectItem key={e.valor} value={e.valor}>
                                  <span className={cn("inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold", e.color)}>
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

                    <div className="h-px bg-stone-100 dark:bg-white/8" />

                    {/* Valor + Moneda */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="valor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Valor</FormLabel>
                            <FormControl>
                              <Input
                                type="number" min="0" step="0.01"
                                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
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
                            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Moneda</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9">
                                  <SelectValue />
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
                        )}
                      />
                    </div>

                    {/* Fecha cierre */}
                    <FormField
                      control={form.control}
                      name="fechaCierre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                            Fecha de cierre
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
                              value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="h-px bg-stone-100 dark:bg-white/8" />

                    {/* Empresa */}
                    <FormField
                      control={form.control}
                      name="empresaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Empresa</FormLabel>
                          <FormControl>
                            <Combobox opciones={empresas} valor={field.value ?? ""} onChange={field.onChange} placeholder="Seleccionar empresa..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="h-px bg-stone-100 dark:bg-white/8" />

                    {/* Notas */}
                    <FormField
                      control={form.control}
                      name="notas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Notas</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={4}
                              className="resize-none bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl text-sm"
                              placeholder="Escribe los detalles de esta oportunidad..."
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Etiquetas */}
                    {tagsDisponibles.length > 0 && (
                      <>
                        <div className="h-px bg-stone-100 dark:bg-white/8" />
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                            Etiquetas
                          </FormLabel>
                          <FormControl>
                            <SelectorTags tags={tagsDisponibles} seleccionados={tagIds} onChange={setTagIds} />
                          </FormControl>
                        </FormItem>
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-stone-100 dark:border-white/10 px-6 py-4 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <ConfirmacionDialog
                        trigger={
                          <Button type="button" variant="ghost" size="sm" className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 rounded-lg">
                            Eliminar
                          </Button>
                        }
                        titulo="¿Eliminar oportunidad?"
                        descripcion={`Se eliminará permanentemente "${oportunidad.titulo}".`}
                        onConfirmar={handleDelete}
                      />
                      <ButtonLink
                        href={`/crm/oportunidades/${oportunidad.id}`}
                        variant="ghost"
                        size="sm"
                        className="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Ver completo
                      </ButtonLink>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={form.formState.isSubmitting}
                      className="bg-lime-500 dark:bg-lime-500 text-stone-950 hover:bg-lime-400 dark:hover:bg-lime-400 rounded-xl px-5 font-semibold shadow-sm transition-all hover:scale-[1.02]"
                    >
                      {form.formState.isSubmitting ? "Guardando..." : "Guardar"}
                    </Button>
                  </SheetFooter>
                </form>
              </Form>
            </div>

            {/* ── Pestaña: Contactos ───────────────────────────────── */}
            <div className={cn("flex-1 flex flex-col overflow-hidden", activeTab !== "contacto" && "hidden")}>
              <GestorContactosPanel
                oportunidadId={oportunidad.id}
                contactosIniciales={contactosIniciales}
                todosContactos={contactos}
                defaultCountryCode={defaultCountryCode}
              />
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
