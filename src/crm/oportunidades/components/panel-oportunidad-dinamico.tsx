"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Layers, Loader2, Pencil, UserPlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  asignarContactoAOportunidad,
} from "../actions";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import { obtenerTagsAction } from "@/crm/tags/actions";
import type { Tag } from "@/crm/tags/types";
import { moverAStage, obtenerPipelinesAction } from "@/crm/pipeline/actions";
import { SelectorPipelineStage } from "@/crm/pipeline/components/selector-pipeline-stage";
import { ActualizarOportunidadSchema, type ActualizarOportunidadInput } from "../schema";
import type { Oportunidad } from "../types";
import type { PipelineConStages, CampoPersonalizadoStage } from "@/crm/pipeline/types";
import { CamposDinamicos } from "./campos-dinamicos";
import { cn } from "@/lib/utils";
import { actualizarContacto, crearContacto, obtenerContactoAction } from "@/crm/contactos/actions";

// ── Schema local para el formulario de contacto ───────────────────
const ContactoPanelSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().max(20).optional().or(z.literal("")),
  cargo: z.string().max(100).optional().or(z.literal("")),
  notas: z.string().max(2000).optional().or(z.literal("")),
  estado: z.enum(["ACTIVO", "INACTIVO", "LEAD"]),
});
type ContactoPanelInput = z.infer<typeof ContactoPanelSchema>;
type ContactoBasica = NonNullable<Awaited<ReturnType<typeof obtenerContactoAction>>>;

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
  initialPipelineId: string | null;
  todosPipelines: PipelineConStages[];
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  tagsDisponibles: Tag[];
  tagIdsIniciales: string[];
  contactoIdInicial: string;
  contactoDataInicial: ContactoBasica | null;
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
  const [contactoIdInicial, setContactoIdInicial] = useState<string>("");
  const [contactoDataInicial, setContactoDataInicial] = useState<ContactoBasica | null>(null);
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
    ]).then(async ([data, tags, pipelines]) => {
      if (!data) { setCargando(false); return; }
      setOportunidad(data);
      setTagsDisponibles(tags as Tag[]);
      setTodosPipelines(pipelines as PipelineConStages[]);
      setTagIdsIniciales((data as any).tags?.map((t: { tagId: string }) => t.tagId) ?? []);

      const ctId = data.contactos?.[0]?.contacto.id ?? "";
      setContactoIdInicial(ctId);
      if (ctId) {
        const ct = await obtenerContactoAction(ctId);
        setContactoDataInicial(ct ?? null);
      } else {
        setContactoDataInicial(null);
      }

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
            contactoIdInicial={contactoIdInicial}
            contactoDataInicial={contactoDataInicial}
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
  contactoIdInicial,
  contactoDataInicial,
  onClose,
  onUpdate,
  onDelete,
}: FormularioProps) {
  const [activeTab, setActiveTab] = useState<"info" | "contacto">("info");
  const [stageActualId, setStageActualId] = useState<string | null>(initialStageId);
  const [pipelineActualId, setPipelineActualId] = useState<string | null>(initialPipelineId);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initialMetadata);
  const [guardandoStage, setGuardandoStage] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>(tagIdsIniciales);
  const [selectedContactoId, setSelectedContactoId] = useState<string>(contactoIdInicial);
  const [originalContactoId, setOriginalContactoId] = useState<string>(contactoIdInicial);
  const [contactoData, setContactoData] = useState<ContactoBasica | null>(contactoDataInicial);

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

  const formContacto = useForm<ContactoPanelInput>({
    resolver: zodResolver(ContactoPanelSchema),
    defaultValues: contactoDataInicial
      ? {
          nombre: contactoDataInicial.nombre,
          apellido: contactoDataInicial.apellido,
          email: contactoDataInicial.email ?? "",
          telefono: contactoDataInicial.telefono ?? "",
          cargo: contactoDataInicial.cargo ?? "",
          notas: contactoDataInicial.notas ?? "",
          estado: contactoDataInicial.estado as ContactoPanelInput["estado"],
        }
      : { nombre: "", apellido: "", email: "", telefono: "", cargo: "", notas: "", estado: "ACTIVO" },
  });

  const pipelineActual = todosPipelines.find((p) => p.id === pipelineActualId) ?? todosPipelines[0];

  const stageActual = pipelineActual?.stages.find((s) => s.id === stageActualId);

  const camposActuales: CampoPersonalizadoStage[] = stageActual?.campos ?? [];

  const handleCambiarStage = async (nuevoStageId: string, nuevoPipelineId: string) => {
    if (nuevoStageId === stageActualId && nuevoPipelineId === pipelineActualId) return;
    setGuardandoStage(true);
    const resultado = await moverAStage(oportunidad.id, nuevoStageId, nuevoPipelineId);
    setGuardandoStage(false);
    if (resultado.exito) {
      const nuevoPipeline = todosPipelines.find((p) => p.id === nuevoPipelineId);
      const nuevoStage = nuevoPipeline?.stages.find((s) => s.id === nuevoStageId);
      const cambioPipeline = nuevoPipelineId !== pipelineActualId;
      if (cambioPipeline) setMetadata({});
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

  const [modoCrear, setModoCrear] = useState(false);

  const handleEntrarModoCrear = () => {
    formContacto.reset({ nombre: "", apellido: "", email: "", telefono: "", cargo: "", notas: "", estado: "ACTIVO" });
    setModoCrear(true);
  };

  const handleCancelarCrear = () => {
    setModoCrear(false);
    if (contactoData) {
      formContacto.reset({
        nombre: contactoData.nombre,
        apellido: contactoData.apellido,
        email: contactoData.email ?? "",
        telefono: contactoData.telefono ?? "",
        cargo: contactoData.cargo ?? "",
        notas: contactoData.notas ?? "",
        estado: contactoData.estado as ContactoPanelInput["estado"],
      });
    } else {
      formContacto.reset({ nombre: "", apellido: "", email: "", telefono: "", cargo: "", notas: "", estado: "ACTIVO" });
    }
  };

  const handleContactoChange = (newId: string) => {
    setSelectedContactoId(newId);
    if (!newId) {
      setContactoData(null);
      formContacto.reset({
        nombre: "",
        apellido: "",
        email: "",
        telefono: "",
        cargo: "",
        notas: "",
        estado: "ACTIVO",
      });
      return;
    }
    obtenerContactoAction(newId).then((c) => {
      setContactoData(c ?? null);
      if (c) {
        formContacto.reset({
          nombre: c.nombre,
          apellido: c.apellido,
          email: c.email ?? "",
          telefono: c.telefono ?? "",
          cargo: c.cargo ?? "",
          notas: c.notas ?? "",
          estado: c.estado as ContactoPanelInput["estado"],
        });
      }
    });
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
    onUpdate({
      ...resultadoBase.datos,
      stageId: stageActualId,
      tags: tagIds.map((tagId) => ({
        tagId,
        tag: tagsDisponibles.find((t) => t.id === tagId) ?? { id: tagId, nombre: "", color: null },
      })),
    });
  };

  const onSubmitContacto = async (datos: ContactoPanelInput) => {
    if (modoCrear) {
      const r = await crearContacto({
        nombre: datos.nombre,
        apellido: datos.apellido,
        email: datos.email || undefined,
        telefono: datos.telefono || undefined,
        cargo: datos.cargo || undefined,
        notas: datos.notas || undefined,
        estado: datos.estado,
      });
      if (!r.exito) { toast.error(r.error); return; }
      const ra = await asignarContactoAOportunidad(oportunidad.id, r.datos.id);
      if (!ra.exito) { toast.error(ra.error); return; }
      setContactoData({
        id: r.datos.id,
        nombre: r.datos.nombre,
        apellido: r.datos.apellido,
        email: r.datos.email,
        telefono: r.datos.telefono,
        cargo: r.datos.cargo,
        notas: r.datos.notas,
        estado: r.datos.estado,
      });
      setSelectedContactoId(r.datos.id);
      setOriginalContactoId(r.datos.id);
      setModoCrear(false);
      toast.success("Contacto creado y asignado");
      return;
    }

    const cambioAsociacion = selectedContactoId !== originalContactoId;

    if (cambioAsociacion) {
      const r = await asignarContactoAOportunidad(
        oportunidad.id,
        selectedContactoId || null
      );
      if (!r.exito) { toast.error(r.error); return; }
      setOriginalContactoId(selectedContactoId);
    }

    if (selectedContactoId && contactoData) {
      const r = await actualizarContacto(contactoData.id, datos);
      if (!r.exito) { toast.error(r.error); return; }
    }

    toast.success("Contacto guardado");
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

          {/* Selector de pipeline + stage */}
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "contacto")} className="flex flex-1 flex-col overflow-hidden">
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
            Contacto
          </TabsTrigger>
        </TabsList>

        {/* ── Pestaña: Información ──────────────────────────────── */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", activeTab !== "info" && "hidden")}>
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

                {/* Etiquetas */}
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

                {/* Campos dinámicos del stage */}
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
        </div>

        {/* ── Pestaña: Contacto ─────────────────────────────────── */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", activeTab !== "contacto" && "hidden")}>
          <Form {...formContacto}>
            <form
              onSubmit={formContacto.handleSubmit(onSubmitContacto)}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Header: volver o selector */}
                {modoCrear ? (
                  <button
                    type="button"
                    onClick={handleCancelarCrear}
                    className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Seleccionar existente
                  </button>
                ) : (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                      Contacto principal
                    </FormLabel>
                    <Combobox
                      opciones={contactos}
                      valor={selectedContactoId}
                      onChange={handleContactoChange}
                      placeholder="Sin contacto asignado..."
                    />
                  </FormItem>
                )}

                {(modoCrear || selectedContactoId) ? (
                  <>
                    {modoCrear && (
                      <div className="rounded-xl bg-lime-500/8 dark:bg-lime-400/8 border border-lime-500/15 dark:border-lime-400/15 px-4 py-3">
                        <p className="text-xs font-semibold text-lime-700 dark:text-lime-400">Nuevo contacto</p>
                        <p className="text-xs text-lime-600/70 dark:text-lime-500 mt-0.5">Se creará y asignará a esta oportunidad</p>
                      </div>
                    )}

                    <div className="h-px bg-stone-100 dark:bg-white/8" />

                    {/* Nombre + Apellido */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={formContacto.control}
                        name="nombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                              Nombre
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={formContacto.control}
                        name="apellido"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                              Apellido
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Email */}
                    <FormField
                      control={formContacto.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
                              placeholder="correo@ejemplo.com"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Teléfono + Cargo */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={formContacto.control}
                        name="telefono"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                              Teléfono
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
                                placeholder="+51 999 999 999"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={formContacto.control}
                        name="cargo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                              Cargo
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9"
                                placeholder="Director, Gerente..."
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Estado */}
                    <FormField
                      control={formContacto.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                            Estado
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl h-9">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ACTIVO">Activo</SelectItem>
                              <SelectItem value="INACTIVO">Inactivo</SelectItem>
                              <SelectItem value="LEAD">Lead</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="h-px bg-stone-100 dark:bg-white/8" />

                    {/* Notas */}
                    <FormField
                      control={formContacto.control}
                      name="notas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                            Notas del contacto
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              className="resize-none bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl text-sm"
                              placeholder="Información adicional..."
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
                    <div className="rounded-full bg-stone-100 dark:bg-white/5 p-3.5">
                      <svg
                        className="h-5 w-5 text-stone-400 dark:text-stone-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Sin contacto asignado</p>
                      <p className="text-xs text-stone-400 dark:text-stone-600 mt-1">Selecciona uno arriba o crea uno nuevo</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleEntrarModoCrear}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-stone-300 dark:border-white/15 px-4 py-2.5 text-xs font-semibold text-stone-500 dark:text-stone-400 hover:border-lime-400 dark:hover:border-lime-400/50 hover:text-lime-600 dark:hover:text-lime-400 hover:bg-lime-50 dark:hover:bg-lime-400/5 transition-all"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Crear nuevo contacto
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              {(modoCrear || selectedContactoId) && (
                <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-stone-100 dark:border-white/10 px-6 py-4 flex-shrink-0">
                  {modoCrear && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelarCrear}
                      className="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg"
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={formContacto.formState.isSubmitting}
                    className="bg-lime-500 dark:bg-lime-500 text-stone-950 hover:bg-lime-400 dark:hover:bg-lime-400 rounded-xl px-5 font-semibold shadow-sm transition-all hover:scale-[1.02]"
                  >
                    {formContacto.formState.isSubmitting
                      ? (modoCrear ? "Creando..." : "Guardando...")
                      : (modoCrear ? "Crear y asignar" : "Guardar contacto")}
                  </Button>
                </SheetFooter>
              )}
            </form>
          </Form>
        </div>
      </Tabs>
    </>
  );
}
