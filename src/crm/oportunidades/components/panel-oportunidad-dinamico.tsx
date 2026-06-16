"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ExternalLink, Layers, Loader2, Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button, ButtonLink } from "@/components/ui/button";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import {
  obtenerOportunidadAction,
  actualizarOportunidad,
  actualizarMetadataOportunidad,
  eliminarOportunidad,
} from "../actions";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import { obtenerTagsAction } from "@/crm/tags/actions";
import type { Tag } from "@/crm/tags/types";
import { moverAStage, obtenerPipelinesAction } from "@/crm/pipeline/actions";
import { SelectorPipelineStage } from "@/crm/pipeline/components/selector-pipeline-stage";
import { ActualizarOportunidadSchema, type ActualizarOportunidadInput } from "../schema";
import type { Oportunidad } from "../types";
import type { PipelineConStages } from "@/crm/pipeline/types";
import { CamposDinamicos, validarCamposRequeridos } from "./campos-dinamicos";
import { DialogCamposRequeridos } from "./dialog-campos-requeridos";
import { cn } from "@/lib/utils";
import { GestorContactosPanel, type ContactoEnPanel } from "./gestor-contactos-panel";
import { MONEDAS } from "@/shared/moneda/constants";
import { SheetNuevaCotizacion } from "@/sales/cotizaciones/components/sheet-nueva-cotizacion";

// ── Tipos ─────────────────────────────────────────────────────────

type OportunidadFetched = NonNullable<Awaited<ReturnType<typeof obtenerOportunidadAction>>>;

interface PanelOportunidadDinamicoProps {
  oportunidadId: string | null;
  initialStageId: string | null;
  pipeline: PipelineConStages;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  defaultCountryCode?: string;
  onClose: () => void;
  onUpdate: (updated: Oportunidad & { stageId?: string | null }) => void;
  onDelete: (id: string) => void;
}

interface FormularioProps {
  oportunidad: OportunidadFetched;
  initialMetadata: Record<string, unknown>;
  initialStageId: string | null;
  initialPipelineId: string | null;
  todosPipelines: PipelineConStages[];
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  tagsDisponibles: Tag[];
  tagIdsIniciales: string[];
  contactosIniciales: ContactoEnPanel[];
  defaultCountryCode: string;
  onClose: () => void;
  onUpdate: (updated: Oportunidad & { stageId?: string | null }) => void;
  onDelete: (id: string) => void;
}

// ── Capa exterior: solo gestiona el fetch ─────────────────────────

export function PanelOportunidadDinamico({
  oportunidadId,
  initialStageId,
  pipeline,
  empresas,
  contactos,
  defaultCountryCode = "PA",
  onClose,
  onUpdate,
  onDelete,
}: PanelOportunidadDinamicoProps) {
  const [oportunidad, setOportunidad] = useState<OportunidadFetched | null>(null);
  const [tagsDisponibles, setTagsDisponibles] = useState<Tag[]>([]);
  const [tagIdsIniciales, setTagIdsIniciales] = useState<string[]>([]);
  const [contactosIniciales, setContactosIniciales] = useState<ContactoEnPanel[]>([]);
  const [todosPipelines, setTodosPipelines] = useState<PipelineConStages[]>([pipeline]);
  const [cargando, setCargando] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const fetchedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!oportunidadId) {
      fetchedIdRef.current = null;
      setOportunidad(null);
      return;
    }
    if (fetchedIdRef.current === oportunidadId) return;
    fetchedIdRef.current = oportunidadId;
    setCargando(true);
    Promise.all([
      obtenerOportunidadAction(oportunidadId),
      obtenerTagsAction(),
      obtenerPipelinesAction(),
    ]).then(([data, tags, pipelines]) => {
      if (!data) { setCargando(false); return; }
      setOportunidad(data);
      setTagsDisponibles(tags as Tag[]);
      setTodosPipelines(pipelines as PipelineConStages[]);
      setTagIdsIniciales((data as any).tags?.map((t: { tagId: string }) => t.tagId) ?? []);

      const cts: ContactoEnPanel[] = ((data as any).contactos ?? []).map((rel: any) => ({
        contactoId: rel.contactoId,
        principal: rel.principal,
        contacto: rel.contacto,
      }));
      setContactosIniciales(cts);

      setResetKey((k) => k + 1);
      setCargando(false);
    });
  }, [oportunidadId]);

  return (
    <Sheet open={!!oportunidadId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[500px] bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10 shadow-2xl"
      >
        {cargando && (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-lime-500 dark:text-lime-400" />
              <p className="text-xs text-stone-400 dark:text-stone-600">Cargando...</p>
            </div>
          </div>
        )}

        {!cargando && oportunidad && (
          <PanelFormulario
            key={resetKey}
            oportunidad={oportunidad}
            initialMetadata={(oportunidad.metadata as Record<string, unknown>) ?? {}}
            initialStageId={oportunidad.stageId ?? initialStageId}
            initialPipelineId={oportunidad.pipelineId ?? pipeline.id}
            todosPipelines={todosPipelines}
            empresas={empresas}
            contactos={contactos}
            tagsDisponibles={tagsDisponibles}
            tagIdsIniciales={tagIdsIniciales}
            contactosIniciales={contactosIniciales}
            defaultCountryCode={defaultCountryCode}
            onClose={onClose}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Capa interior: formulario con defaultValues correctos ─────────

function PanelFormulario({
  oportunidad,
  initialMetadata,
  initialStageId,
  initialPipelineId,
  todosPipelines,
  empresas,
  contactos,
  tagsDisponibles,
  tagIdsIniciales,
  contactosIniciales,
  defaultCountryCode,
  onClose,
  onUpdate,
  onDelete,
}: FormularioProps) {
  const contactoPrincipal =
    contactosIniciales.find((r) => r.principal)?.contacto ??
    contactosIniciales[0]?.contacto ??
    null;

  const [activeTab, setActiveTab] = useState<"info" | "contacto">("info");
  const [stageActualId, setStageActualId] = useState<string | null>(initialStageId);
  const [pipelineActualId, setPipelineActualId] = useState<string | null>(initialPipelineId);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initialMetadata);
  const [guardandoStage, setGuardandoStage] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>(tagIdsIniciales);
  const [bloqueoPendiente, setBloqueoPendiente] = useState<{
    stageNombre: string;
    stageColor: string | null;
    campos: string[];
  } | null>(null);
  const camposRef = useRef<HTMLDivElement>(null);

  const form = useForm<ActualizarOportunidadInput>({
    resolver: zodResolver(ActualizarOportunidadSchema),
    defaultValues: {
      titulo: oportunidad.titulo,
      valor: Number(oportunidad.valor),
      moneda: oportunidad.moneda,
      etapa: oportunidad.etapa,
      fechaCierre: oportunidad.fechaCierre ? new Date(oportunidad.fechaCierre) : undefined,
      notas: oportunidad.notas ?? "",
      empresaId: oportunidad.empresaId ?? "",
    },
  });

  const pipelineActual = todosPipelines.find((p) => p.id === pipelineActualId) ?? todosPipelines[0];
  const stageActual = pipelineActual?.stages.find((s) => s.id === stageActualId);
  const camposPipeline = pipelineActual?.campos ?? [];

  const handleCambiarStage = async (
    nuevoStageId: string,
    nuevoPipelineId: string,
    nuevoStageNombre: string,
    nuevoStageColor: string | null,
  ) => {
    if (nuevoStageId === stageActualId && nuevoPipelineId === pipelineActualId) return;

    const camposDestinoPipeline = todosPipelines.find((p) => p.id === nuevoPipelineId)?.campos ?? [];
    const camposFaltantes = validarCamposRequeridos(camposDestinoPipeline, nuevoStageId, metadata);
    if (camposFaltantes.length > 0) {
      setBloqueoPendiente({ stageNombre: nuevoStageNombre, stageColor: nuevoStageColor, campos: camposFaltantes });
      return;
    }

    setGuardandoStage(true);
    const resultado = await moverAStage(oportunidad.id, nuevoStageId, nuevoPipelineId);
    setGuardandoStage(false);
    if (resultado.exito) {
      const nuevoPipeline = todosPipelines.find((p) => p.id === nuevoPipelineId);
      const nuevoStage = nuevoPipeline?.stages.find((s) => s.id === nuevoStageId);
      if (nuevoPipelineId !== pipelineActualId) setMetadata({});
      toast.success(`Movido a "${nuevoStage?.nombre ?? nuevoStageId}"`);
      setStageActualId(nuevoStageId);
      setPipelineActualId(nuevoPipelineId);
      onUpdate({
        ...oportunidad,
        valor: Number(oportunidad.valor),
        stageId: nuevoStageId,
        pipelineId: nuevoPipelineId,
        tags: tagIds.map((tagId) => ({
          tagId,
          tag: tagsDisponibles.find((t) => t.id === tagId) ?? { id: tagId, nombre: "", color: null },
        })),
      } as Oportunidad & { stageId: string });
    } else {
      toast.error(resultado.error);
    }
  };

  const onSubmit = async (datos: ActualizarOportunidadInput) => {
    const camposFaltantes = validarCamposRequeridos(camposPipeline, stageActualId, metadata);
    if (camposFaltantes.length > 0) {
      toast.error(`Completa los campos obligatorios: ${camposFaltantes.join(", ")}`);
      return;
    }

    const [resultadoCampos, resultadoBase] = await Promise.all([
      camposPipeline.length > 0
        ? actualizarMetadataOportunidad(oportunidad.id, metadata)
        : Promise.resolve({ exito: true as const, datos: undefined }),
      actualizarOportunidad(oportunidad.id, { ...datos, tagIds }),
    ]);

    if (!resultadoBase.exito) { toast.error(resultadoBase.error); return; }
    if (!resultadoCampos.exito) { toast.error(resultadoCampos.error); return; }

    toast.success("Oportunidad actualizada");
    onUpdate({
      ...resultadoBase.datos,
      stageId: stageActualId,
      tags: tagIds.map((tagId) => ({
        tagId,
        tag: tagsDisponibles.find((t) => t.id === tagId) ?? { id: tagId, nombre: "", color: null },
      })),
    });
  };

  const handleDelete = async () => {
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
    <>
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
          <SelectorPipelineStage
            pipelineId={pipelineActualId}
            stageId={stageActualId}
            stageNombre={stageActual?.nombre}
            stageColor={stageActual?.color}
            onSelect={handleCambiarStage}
            cargando={guardandoStage}
          />
        </div>
      </SheetHeader>

      {/* Tabs */}
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

        {/* ── Pestaña: Información ──────────────────────────────── */}
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
                          onChange={field.onChange}
                        />
                      </FormControl>
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
                            onBlur={field.onBlur} name={field.name} ref={field.ref}
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
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
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
                      <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Fecha de cierre</FormLabel>
                      <FormControl>
                        <SmartDatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecciona fecha de cierre"
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
                      <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Etiquetas</FormLabel>
                      <FormControl>
                        <SelectorTags tags={tagsDisponibles} seleccionados={tagIds} onChange={setTagIds} />
                      </FormControl>
                    </FormItem>
                  </>
                )}

                {/* Campos dinámicos del pipeline */}
                {camposPipeline.length > 0 && (
                  <>
                    <div className="h-px bg-stone-100 dark:bg-white/8" />
                    <div ref={camposRef} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-5 w-5 rounded-md flex-shrink-0 bg-lime-500/10">
                          <Layers className="h-3 w-3 text-lime-500" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                          Campos
                        </span>
                      </div>
                      <CamposDinamicos
                        campos={camposPipeline}
                        stageId={stageActualId}
                        valores={metadata}
                        onChange={(clave, valor) => setMetadata((prev) => ({ ...prev, [clave]: valor }))}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Footer info */}
              <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-stone-100 dark:border-white/10 px-6 py-4 flex-shrink-0">
                <div className="flex items-center gap-1 flex-wrap">
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
                  <SheetNuevaCotizacion
                    oportunidadId={oportunidad.id}
                    oportunidadTitulo={oportunidad.titulo}
                    contactoId={contactoPrincipal?.id}
                    empresaId={oportunidad.empresaId ?? undefined}
                    destinatario={{
                      nombre: contactoPrincipal?.nombre,
                      apellido: contactoPrincipal?.apellido,
                      telefono: (contactoPrincipal as any)?.telefonoPrincipal ?? undefined,
                      email: (contactoPrincipal as any)?.email ?? undefined,
                    }}
                  />
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

        {/* ── Pestaña: Contactos ────────────────────────────────── */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", activeTab !== "contacto" && "hidden")}>
          <GestorContactosPanel
            oportunidadId={oportunidad.id}
            contactosIniciales={contactosIniciales}
            todosContactos={contactos}
            defaultCountryCode={defaultCountryCode}
          />
        </div>
      </Tabs>

      <DialogCamposRequeridos
        open={bloqueoPendiente !== null}
        onClose={() => setBloqueoPendiente(null)}
        stageNombre={bloqueoPendiente?.stageNombre ?? ""}
        stageColor={bloqueoPendiente?.stageColor}
        camposFaltantes={bloqueoPendiente?.campos ?? []}
        onIrACampos={
          camposPipeline.length > 0
            ? () => {
                setTimeout(() => camposRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }
            : undefined
        }
      />
    </>
  );
}
