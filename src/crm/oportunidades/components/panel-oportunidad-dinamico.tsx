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
import { moverAStage } from "@/crm/pipeline/actions";
import { ActualizarOportunidadSchema, type ActualizarOportunidadInput } from "../schema";
import type { Oportunidad } from "../types";
import type { PipelineConStages, CampoPersonalizadoStage } from "@/crm/pipeline/types";
import { CamposDinamicos } from "./campos-dinamicos";
import { cn } from "@/lib/utils";

// ── Tipos ─────────────────────────────────────────────────────────

type OportunidadFetched = NonNullable<Awaited<ReturnType<typeof obtenerOportunidadAction>>>;

interface PanelOportunidadDinamicoProps {
  oportunidadId: string | null;
  initialStageId: string | null;
  pipeline: PipelineConStages;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  onClose: () => void;
  onUpdate: (updated: Oportunidad & { stageId?: string | null }) => void;
  onDelete: (id: string) => void;
}

interface FormularioProps {
  oportunidad: OportunidadFetched;
  initialMetadata: Record<string, unknown>;
  initialStageId: string | null;
  pipeline: PipelineConStages;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  tagsDisponibles: Tag[];
  tagIdsIniciales: string[];
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
  onClose,
  onUpdate,
  onDelete,
}: PanelOportunidadDinamicoProps) {
  const [oportunidad, setOportunidad] = useState<OportunidadFetched | null>(null);
  const [tagsDisponibles, setTagsDisponibles] = useState<Tag[]>([]);
  const [tagIdsIniciales, setTagIdsIniciales] = useState<string[]>([]);
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
    ]).then(([data, tags]) => {
      if (!data) { setCargando(false); return; }
      setOportunidad(data);
      setTagsDisponibles(tags as Tag[]);
      setTagIdsIniciales((data as any).tags?.map((t: { tagId: string }) => t.tagId) ?? []);
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
            pipeline={pipeline}
            empresas={empresas}
            contactos={contactos}
            tagsDisponibles={tagsDisponibles}
            tagIdsIniciales={tagIdsIniciales}
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
  pipeline,
  empresas,
  contactos,
  tagsDisponibles,
  tagIdsIniciales,
  onClose,
  onUpdate,
  onDelete,
}: FormularioProps) {
  const [stageActualId, setStageActualId] = useState<string | null>(initialStageId);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initialMetadata);
  const [guardandoStage, setGuardandoStage] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>(tagIdsIniciales);

  // useForm con defaultValues del fetch — se instancia UNA vez con los valores correctos
  const form = useForm<ActualizarOportunidadInput>({
    resolver: zodResolver(ActualizarOportunidadSchema),
    defaultValues: {
      titulo: oportunidad.titulo,
      valor: Number(oportunidad.valor),
      moneda: oportunidad.moneda,
      etapa: oportunidad.etapa,
      fechaCierre: oportunidad.fechaCierre
        ? new Date(oportunidad.fechaCierre)
        : undefined,
      notas: oportunidad.notas ?? "",
      empresaId: oportunidad.empresaId ?? "",
    },
  });

  const camposActuales: CampoPersonalizadoStage[] =
    pipeline.stages.find((s) => s.id === stageActualId)?.campos ?? [];

  const stageActual = pipeline.stages.find((s) => s.id === stageActualId);

  const handleCambiarStage = async (nuevoStageId: string | null) => {
    if (!nuevoStageId || nuevoStageId === stageActualId) return;
    setGuardandoStage(true);
    const resultado = await moverAStage(oportunidad.id, nuevoStageId, pipeline.id);
    setGuardandoStage(false);
    if (resultado.exito) {
      const stage = pipeline.stages.find((s) => s.id === nuevoStageId);
      toast.success(`Movido a "${stage?.nombre}"`);
      setStageActualId(nuevoStageId);
      onUpdate({
        ...oportunidad,
        valor: Number(oportunidad.valor),
        stageId: nuevoStageId,
      } as Oportunidad & { stageId: string });
    } else {
      toast.error(resultado.error);
    }
  };

  const onSubmit = async (datos: ActualizarOportunidadInput) => {
    const [resultadoCampos, resultadoBase] = await Promise.all([
      camposActuales.length > 0
        ? actualizarMetadataOportunidad(oportunidad.id, metadata)
        : Promise.resolve({ exito: true as const, datos: undefined }),
      actualizarOportunidad(oportunidad.id, { ...datos, tagIds }),
    ]);

    if (!resultadoBase.exito) { toast.error(resultadoBase.error); return; }
    if (!resultadoCampos.exito) { toast.error(resultadoCampos.error); return; }

    toast.success("Oportunidad actualizada");
    onUpdate({ ...resultadoBase.datos, stageId: stageActualId });
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

          {/* Selector de stage */}
          <div className="flex items-center gap-1.5">
            {guardandoStage && <Loader2 className="h-3 w-3 animate-spin text-stone-400" />}
            <Select
              value={stageActualId ?? ""}
              onValueChange={handleCambiarStage}
              disabled={guardandoStage}
            >
              <SelectTrigger
                className={cn(
                  "h-7 rounded-lg border text-xs font-medium gap-1.5 px-2",
                  "border-stone-200 dark:border-white/10",
                  "bg-white dark:bg-white/5 text-stone-600 dark:text-stone-300",
                  "hover:bg-stone-50 dark:hover:bg-white/8",
                  "[&>svg]:h-3 [&>svg]:w-3",
                )}
              >
                {stageActual ? (
                  <span className="flex items-center gap-1.5">
                    {stageActual.color && (
                      <span
                        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stageActual.color }}
                      />
                    )}
                    {stageActual.nombre}
                  </span>
                ) : (
                  <SelectValue placeholder="Etapa..." />
                )}
              </SelectTrigger>
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
          </div>
        </div>
      </SheetHeader>

      {/* Form */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
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
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                      Valor
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="moneda"
                render={({ field }) => {
                  const monedaActual = field.value;
                  return (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                        Moneda
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9">
                            {monedaActual ? (
                              <span>{monedaActual === "PEN" ? "PEN (S/)" : "USD ($)"}</span>
                            ) : (
                              <SelectValue />
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PEN">PEN (S/)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
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
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                    Empresa
                  </FormLabel>
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

            {/* Contacto (solo lectura) */}
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                Contacto principal
              </FormLabel>
              <Combobox
                opciones={contactos}
                valor={oportunidad.contactos?.[0]?.contacto.id ?? ""}
                onChange={() => {}}
                placeholder="Sin contacto asignado"
                disabled
              />
            </FormItem>

            <div className="h-px bg-stone-100 dark:bg-white/8" />

            {/* Notas */}
            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                    Notas
                  </FormLabel>
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

            {/* ── Etiquetas ─────────────────────────────────── */}
            {tagsDisponibles.length > 0 && (
              <>
                <div className="h-px bg-stone-100 dark:bg-white/8" />
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                    Etiquetas
                  </FormLabel>
                  <FormControl>
                    <SelectorTags
                      tags={tagsDisponibles}
                      seleccionados={tagIds}
                      onChange={setTagIds}
                    />
                  </FormControl>
                </FormItem>
              </>
            )}

            {/* ── Campos dinámicos del stage ─────────────────── */}
            {camposActuales.length > 0 && (
              <>
                <div className="h-px bg-stone-100 dark:bg-white/8" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center h-5 w-5 rounded-md flex-shrink-0"
                      style={{
                        backgroundColor: stageActual?.color
                          ? `${stageActual.color}20`
                          : "rgb(132 204 22 / 0.1)",
                      }}
                    >
                      <Layers
                        className="h-3 w-3"
                        style={{ color: stageActual?.color ?? "#84cc16" }}
                      />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                      Campos de {stageActual?.nombre ?? "etapa"}
                    </span>
                  </div>
                  <CamposDinamicos
                    campos={camposActuales}
                    valores={metadata}
                    onChange={(clave, valor) =>
                      setMetadata((prev) => ({ ...prev, [clave]: valor }))
                    }
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-stone-100 dark:border-white/10 px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-1">
              <ConfirmacionDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 rounded-lg"
                  >
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
    </>
  );
}
