"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  X, Phone, Video, Search, MoreHorizontal, ExternalLink, Loader2,
  ChevronDown, Building2, CalendarDays, Layers, Mail, Globe,
  Save, Tag as TagIcon, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { PanelConversacion } from "@/conversaciones/components/panel-conversacion";
import {
  obtenerOportunidadAction,
  actualizarMetadataOportunidad,
  eliminarOportunidad,
  marcarMensajeLeido,
} from "../actions";
import {
  useActualizarOportunidadMutation,
  useEliminarOportunidadMutation,
  useMoverAStageMutation,
} from "../hooks";
import { SaveIndicator } from "@/shared/components/save-indicator";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import { obtenerTagsAction } from "@/crm/tags/actions";
import type { Tag } from "@/crm/tags/types";
import { obtenerPipelinesAction } from "@/crm/pipeline/actions";
import { SelectorPipelineStage } from "@/crm/pipeline/components/selector-pipeline-stage";
import { ActualizarOportunidadSchema, type ActualizarOportunidadInput } from "../schema";
import type { Oportunidad } from "../types";
import type { PipelineConStages, CampoPersonalizadoStage } from "@/crm/pipeline/types";
import { CamposDinamicos } from "./campos-dinamicos";
import { GestorContactosPanel, type ContactoEnPanel } from "./gestor-contactos-panel";
import {
  obtenerConversacionesPorOportunidadAction,
  obtenerCuentasCanalAction,
} from "@/conversaciones/actions";
import type { ConversacionResumen, CuentaCanalResumen } from "@/conversaciones/types";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type OportunidadFetched = NonNullable<Awaited<ReturnType<typeof obtenerOportunidadAction>>>;

export interface WorkspaceOportunidadProps {
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

interface WorkspaceData {
  oportunidad: OportunidadFetched;
  tagsDisponibles: Tag[];
  todosPipelines: PipelineConStages[];
  tagIds: string[];
  contactosIniciales: ContactoEnPanel[];
  conversaciones: ConversacionResumen[];
  cuentasCanal: CuentaCanalResumen[];
}

// ── Accordion helper ──────────────────────────────────────────────────────────

function Seccion({
  titulo,
  icono,
  abierto,
  onToggle,
  children,
  badge,
}: {
  titulo: string;
  icono: React.ReactNode;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/3 transition-colors"
      >
        <span className="flex items-center justify-center h-5 w-5 rounded-md bg-white/5 text-stone-400 shrink-0">
          {icono}
        </span>
        <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-stone-400">
          {titulo}
        </span>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/8 text-stone-400">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-stone-500 transition-transform duration-200",
            abierto && "rotate-180"
          )}
        />
      </button>
      {abierto && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── Capa exterior: gestiona fetch ──────────────────────────────────────────────

export function WorkspaceOportunidad({
  oportunidadId,
  initialStageId,
  pipeline,
  empresas,
  contactos,
  defaultCountryCode = "PA",
  onClose,
  onUpdate,
  onDelete,
}: WorkspaceOportunidadProps) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const fetchedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!oportunidadId) {
      fetchedIdRef.current = null;
      setData(null);
      return;
    }
    if (fetchedIdRef.current === oportunidadId) return;
    fetchedIdRef.current = oportunidadId;
    setCargando(true);

    Promise.all([
      obtenerOportunidadAction(oportunidadId),
      obtenerTagsAction(),
      obtenerPipelinesAction(),
      obtenerConversacionesPorOportunidadAction(oportunidadId),
      obtenerCuentasCanalAction(),
    ]).then(([oportunidad, tags, pipelines, conversaciones, cuentasCanal]) => {
      if (!oportunidad) { setCargando(false); return; }

      const tagIds = (oportunidad as any).tags?.map((t: { tagId: string }) => t.tagId) ?? [];
      const contactosIniciales: ContactoEnPanel[] = ((oportunidad as any).contactos ?? []).map(
        (rel: any) => ({
          contactoId: rel.contactoId,
          principal: rel.principal,
          contacto: rel.contacto,
        })
      );

      setData({
        oportunidad,
        tagsDisponibles: tags as Tag[],
        todosPipelines: pipelines as PipelineConStages[],
        tagIds,
        contactosIniciales,
        conversaciones: conversaciones as ConversacionResumen[],
        cuentasCanal: cuentasCanal as CuentaCanalResumen[],
      });
      setResetKey((k) => k + 1);
      setCargando(false);
      // Marcar mensajes como leídos cuando el agente abre el workspace
      marcarMensajeLeido(oportunidadId);
    });
  }, [oportunidadId]);

  const abierto = !!oportunidadId;

  return (
    <DialogPrimitive.Root open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop con blur */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[6px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200" />

        {/* Modal flotante */}
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex items-center justify-center p-3 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-200">
          <div className="w-[96vw] h-[94vh] max-w-[1800px] rounded-2xl border border-white/10 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_theme(colors.stone.900)_0%,_theme(colors.neutral.950)_60%,_theme(colors.black)_100%)]">

            {/* Loading state */}
            {cargando && (
              <div className="flex flex-1 items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-lime-400" />
                <span className="text-sm text-stone-400">Cargando workspace…</span>
              </div>
            )}

            {/* Contenido cargado */}
            {!cargando && data && (
              <WorkspaceContenido
                key={resetKey}
                data={data}
                initialStageId={data.oportunidad.stageId ?? initialStageId}
                initialPipelineId={data.oportunidad.pipelineId ?? pipeline.id}
                empresas={empresas}
                contactos={contactos}
                defaultCountryCode={defaultCountryCode}
                onClose={onClose}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Capa interior: todo el UI del workspace ───────────────────────────────────

interface WorkspaceContenidoProps {
  data: WorkspaceData;
  initialStageId: string | null;
  initialPipelineId: string | null;
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  defaultCountryCode: string;
  onClose: () => void;
  onUpdate: (updated: Oportunidad & { stageId?: string | null }) => void;
  onDelete: (id: string) => void;
}

function WorkspaceContenido({
  data,
  initialStageId,
  initialPipelineId,
  empresas,
  contactos,
  defaultCountryCode,
  onClose,
  onUpdate,
  onDelete,
}: WorkspaceContenidoProps) {
  const { oportunidad, tagsDisponibles, todosPipelines, conversaciones, cuentasCanal } = data;

  const [stageActualId, setStageActualId] = useState<string | null>(initialStageId);
  const [pipelineActualId, setPipelineActualId] = useState<string | null>(initialPipelineId);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(
    (oportunidad.metadata as Record<string, unknown>) ?? {}
  );
  const [tagIds, setTagIds] = useState<string[]>(data.tagIds);
  const [guardandoStage, setGuardandoStage] = useState(false);
  const [secciones, setSecciones] = useState({
    info: true,
    contactos: false,
    empresa: false,
    etiquetas: false,
    campos: false,
  });

  const actualizarMutation = useActualizarOportunidadMutation(oportunidad.id);
  const eliminarMutation = useEliminarOportunidadMutation();
  const moverMutation = useMoverAStageMutation();

  const pipelineActual = todosPipelines.find((p) => p.id === pipelineActualId) ?? todosPipelines[0];
  const stageActual = pipelineActual?.stages.find((s) => s.id === stageActualId);
  const camposActuales: CampoPersonalizadoStage[] = stageActual?.campos ?? [];

  const contactoPrincipal =
    data.contactosIniciales.find((r) => r.principal)?.contacto ??
    data.contactosIniciales[0]?.contacto ??
    null;

  const empresa = (oportunidad as any).empresa ?? null;

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

  const toggleSeccion = (key: keyof typeof secciones) =>
    setSecciones((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCambiarStage = (nuevoStageId: string, nuevoPipelineId: string) => {
    if (nuevoStageId === stageActualId && nuevoPipelineId === pipelineActualId) return;
    setGuardandoStage(true);
    moverMutation.mutate(
      { oportunidadId: oportunidad.id, nuevoStageId, pipelineId: nuevoPipelineId },
      {
        onSuccess: () => {
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
        },
        onError: (err) => {
          toast.error(err.message ?? "Error al mover");
        },
        onSettled: () => setGuardandoStage(false),
      },
    );
  };

  const onSubmit = async (datos: ActualizarOportunidadInput) => {
    if (camposActuales.length > 0) {
      const resultadoCampos = await actualizarMetadataOportunidad(oportunidad.id, metadata);
      if (!resultadoCampos.exito) { toast.error(resultadoCampos.error); return; }
    }

    actualizarMutation.mutate(
      { ...datos, tagIds },
      {
        onSuccess: (datos) => {
          onUpdate({
            ...datos,
            stageId: stageActualId,
            tags: tagIds.map((tagId) => ({
              tagId,
              tag: tagsDisponibles.find((t) => t.id === tagId) ?? { id: tagId, nombre: "", color: null },
            })),
          });
        },
      },
    );
  };

  const handleDelete = () => {
    eliminarMutation.mutate(oportunidad.id, {
      onSuccess: () => {
        onDelete(oportunidad.id);
        onClose();
      },
    });
  };

  const nombreContacto = contactoPrincipal
    ? `${contactoPrincipal.nombre} ${contactoPrincipal.apellido}`.trim()
    : "Sin contacto";

  const valorFormateado = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: oportunidad.moneda,
    maximumFractionDigits: 0,
  }).format(Number(oportunidad.valor));

  return (
    <div className="flex flex-col h-full">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/10 bg-stone-950/60 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-xl bg-lime-500/15 border border-lime-400/20 flex items-center justify-center text-lime-300 font-bold text-sm shrink-0">
            {(contactoPrincipal?.nombre?.[0] ?? "?").toUpperCase()}
            {(contactoPrincipal?.apellido?.[0] ?? "").toUpperCase()}
          </div>

          {/* Nombre + contexto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-stone-50 leading-tight">
                {nombreContacto}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {empresa && (
                <span className="flex items-center gap-1 text-xs text-stone-400">
                  <Building2 className="h-3 w-3" />
                  {empresa.nombre}
                </span>
              )}
              {empresa && stageActual && (
                <span className="text-stone-700">·</span>
              )}
              {pipelineActual && (
                <span className="text-xs text-stone-500">{pipelineActual.nombre}</span>
              )}
              {stageActual && (
                <>
                  <span className="text-stone-700">›</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: stageActual.color ?? "#a3a3a3" }}
                  >
                    {stageActual.nombre}
                  </span>
                </>
              )}
              <span className="text-stone-700">·</span>
              <span className="text-xs font-semibold text-lime-400">{valorFormateado}</span>
            </div>
          </div>

          {/* Indicador de guardado */}
          <SaveIndicator
            isPending={actualizarMutation.isPending}
            isSuccess={actualizarMutation.isSuccess}
            isError={actualizarMutation.isError}
            error={actualizarMutation.error}
            className="shrink-0"
          />

          {/* Selector de stage */}
          <div className="shrink-0">
            <SelectorPipelineStage
              pipelineId={pipelineActualId}
              stageId={stageActualId}
              stageNombre={stageActual?.nombre}
              stageColor={stageActual?.color}
              onSelect={handleCambiarStage}
              cargando={guardandoStage}
            />
          </div>

          {/* Acciones rápidas */}
          <div className="flex items-center gap-1 shrink-0">
            {contactoPrincipal?.telefonoPrincipal && (
              <a
                href={`tel:${contactoPrincipal.telefonoPrincipal}`}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-100 hover:bg-white/8 transition-colors"
                title="Llamar"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-100 hover:bg-white/8 transition-colors"
              title="Video"
            >
              <Video className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-100 hover:bg-white/8 transition-colors"
              title="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
            <ButtonLink
              href={`/crm/oportunidades/${oportunidad.id}`}
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-stone-400 hover:text-stone-100 hover:bg-white/8"
              title="Ver página completa"
            >
              <ExternalLink className="h-4 w-4" />
            </ButtonLink>
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-100 hover:bg-white/8 transition-colors"
              title="Más opciones"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-100 hover:bg-white/8 transition-colors"
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Panel Chat — 68% ─────────────────────────────────────────────── */}
        <div className="flex flex-col min-w-0" style={{ width: "68%" }}>
          <PanelConversacion
            oportunidadId={oportunidad.id}
            contactoId={contactoPrincipal?.id ?? ""}
            nombreContacto={nombreContacto}
            telefonoContacto={contactoPrincipal?.telefonoPrincipal ?? null}
            cuentas={cuentasCanal}
            conversacionesIniciales={conversaciones}
          />
        </div>

        {/* Panel Info — 32% ─────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden" style={{ width: "32%" }}>
          <Form {...form}>
            <form
              id="form-workspace"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col h-full"
            >
              {/* Título editable */}
              <div className="px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <textarea
                          {...field}
                          rows={2}
                          className="w-full border-0 bg-transparent p-0 text-lg font-semibold leading-snug text-stone-100 placeholder:text-stone-600 focus:outline-none resize-none"
                          placeholder="Título de la oportunidad"
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Secciones acordeón — scrollables */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">

                {/* ── Información General ────────────────────────────── */}
                <Seccion
                  titulo="Información General"
                  icono={<svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  abierto={secciones.info}
                  onToggle={() => toggleSeccion("info")}
                >
                  <div className="space-y-3 pt-1">
                    {/* Valor + Moneda */}
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="valor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Valor</FormLabel>
                            <FormControl>
                              <Input
                                type="number" min="0" step="0.01"
                                className="bg-white/4 border-white/10 rounded-xl h-8 text-sm"
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
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Moneda</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger className="bg-white/4 border-white/10 rounded-xl h-8 text-sm">
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

                    {/* Fecha de cierre */}
                    <FormField
                      control={form.control}
                      name="fechaCierre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Fecha de cierre</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500 pointer-events-none" />
                              <Input
                                type="date"
                                className="bg-white/4 border-white/10 rounded-xl h-8 text-sm pl-8"
                                value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                onBlur={field.onBlur} name={field.name} ref={field.ref}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Empresa */}
                    <FormField
                      control={form.control}
                      name="empresaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Empresa</FormLabel>
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

                    {/* Notas */}
                    <FormField
                      control={form.control}
                      name="notas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Notas</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              className="resize-none bg-white/4 border-white/10 rounded-xl text-sm text-stone-200 placeholder:text-stone-600"
                              placeholder="Notas sobre esta oportunidad..."
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Seccion>

                {/* ── Contactos ─────────────────────────────────────── */}
                <Seccion
                  titulo="Contactos"
                  icono={<User className="h-3 w-3" />}
                  abierto={secciones.contactos}
                  onToggle={() => toggleSeccion("contactos")}
                  badge={data.contactosIniciales.length}
                >
                  <div className="-mx-4">
                    <GestorContactosPanel
                      oportunidadId={oportunidad.id}
                      contactosIniciales={data.contactosIniciales}
                      todosContactos={contactos}
                      defaultCountryCode={defaultCountryCode}
                    />
                  </div>
                </Seccion>

                {/* ── Empresa ───────────────────────────────────────── */}
                {empresa && (
                  <Seccion
                    titulo="Empresa"
                    icono={<Building2 className="h-3 w-3" />}
                    abierto={secciones.empresa}
                    onToggle={() => toggleSeccion("empresa")}
                  >
                    <div className="space-y-2 pt-1">
                      <a
                        href={`/crm/empresas/${empresa.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-semibold text-lime-400 hover:text-lime-300 transition-colors"
                      >
                        {empresa.nombre}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      {empresa.industria && (
                        <div className="flex items-center gap-2 text-xs text-stone-400">
                          <Building2 className="h-3 w-3 shrink-0 text-stone-500" />
                          {empresa.industria}
                        </div>
                      )}
                      {empresa.email && (
                        <a
                          href={`mailto:${empresa.email}`}
                          className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-200 transition-colors"
                        >
                          <Mail className="h-3 w-3 shrink-0 text-stone-500" />
                          {empresa.email}
                        </a>
                      )}
                      {empresa.sitioWeb && (
                        <a
                          href={empresa.sitioWeb}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-200 transition-colors"
                        >
                          <Globe className="h-3 w-3 shrink-0 text-stone-500" />
                          {empresa.sitioWeb.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </div>
                  </Seccion>
                )}

                {/* ── Etiquetas ─────────────────────────────────────── */}
                {tagsDisponibles.length > 0 && (
                  <Seccion
                    titulo="Etiquetas"
                    icono={<TagIcon className="h-3 w-3" />}
                    abierto={secciones.etiquetas}
                    onToggle={() => toggleSeccion("etiquetas")}
                    badge={tagIds.length}
                  >
                    <div className="pt-1">
                      <SelectorTags
                        tags={tagsDisponibles}
                        seleccionados={tagIds}
                        onChange={setTagIds}
                      />
                    </div>
                  </Seccion>
                )}

                {/* ── Campos personalizados del stage ───────────────── */}
                {camposActuales.length > 0 && (
                  <Seccion
                    titulo={`Campos de ${stageActual?.nombre ?? "etapa"}`}
                    icono={<Layers className="h-3 w-3" />}
                    abierto={secciones.campos}
                    onToggle={() => toggleSeccion("campos")}
                  >
                    <div className="pt-1">
                      <CamposDinamicos
                        campos={camposActuales}
                        valores={metadata}
                        onChange={(clave, valor) =>
                          setMetadata((prev) => ({ ...prev, [clave]: valor }))
                        }
                      />
                    </div>
                  </Seccion>
                )}
              </div>

              {/* Footer: guardar / eliminar */}
              <div className="shrink-0 border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2 bg-stone-950/40">
                <ConfirmacionDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg text-xs"
                    >
                      Eliminar
                    </Button>
                  }
                  titulo="¿Eliminar oportunidad?"
                  descripcion={`Se eliminará permanentemente "${oportunidad.titulo}".`}
                  onConfirmar={handleDelete}
                />
                <Button
                  type="submit"
                  form="form-workspace"
                  size="sm"
                  disabled={form.formState.isSubmitting}
                  className="bg-lime-500/90 text-stone-950 hover:bg-lime-400 rounded-xl px-5 font-semibold shadow-lg transition-all hover:scale-[1.02] text-xs gap-1.5"
                >
                  {form.formState.isSubmitting ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Guardar</>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
