"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  X, Phone, Video, Search, MoreHorizontal, ExternalLink, Loader2,
  ChevronDown, Building2, Layers, Mail, Globe,
  Save, Tag as TagIcon, User, FileText, CheckCircle2, Trash2,
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
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
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
import type { PipelineConStages } from "@/crm/pipeline/types";
import { validarCamposRequeridos } from "./campos-dinamicos";
import { CamposDinamicos } from "./campos-dinamicos";
import { DialogCamposRequeridos } from "./dialog-campos-requeridos";
import { GestorContactosPanel, type ContactoEnPanel } from "./gestor-contactos-panel";
import {
  obtenerConversacionesPorOportunidadAction,
  obtenerCuentasCanalAction,
} from "@/conversaciones/actions";
import type { ConversacionResumen, CuentaCanalResumen } from "@/conversaciones/types";
import { MONEDAS } from "@/shared/moneda/constants";
import { SheetNuevaCotizacion } from "@/sales/cotizaciones/components/sheet-nueva-cotizacion";
import { SheetEditarCotizacion } from "@/sales/cotizaciones/components/sheet-editar-cotizacion";
import {
  cambiarEstadoCotizacion,
  aprobarCotizacion,
  eliminarCotizacion,
  obtenerCotizacionesPorOportunidadAction,
} from "@/sales/cotizaciones/actions";
import { ESTADO_COTIZACION_CONFIG } from "@/sales/cotizaciones/types";
import { useSesion } from "@/shared/auth/sesion-context";

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

type CotizacionResumen = {
  id: string;
  numero: string;
  estado: string;
  total: number;
  moneda: string;
  creadoEn: Date;
};

interface DataCritica {
  oportunidad: OportunidadFetched;
  todosPipelines: PipelineConStages[];
  tagIds: string[];
  contactosIniciales: ContactoEnPanel[];
}

interface DataDiferida {
  tagsDisponibles: Tag[];
  conversaciones: ConversacionResumen[];
  cuentasCanal: CuentaCanalResumen[];
  cotizaciones: CotizacionResumen[];
}

// ── Accordion helper ──────────────────────────────────────────────────────────

function Seccion({
  titulo,
  icono,
  abierto,
  onToggle,
  children,
  badge,
  bloqueado = false,
}: {
  titulo: string;
  icono: React.ReactNode;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
  bloqueado?: boolean;
}) {
  return (
    <div className="border-b border-stone-200 dark:border-white/8 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-white/3 transition-colors"
      >
        <span className="flex items-center justify-center h-5 w-5 rounded-md bg-stone-100 dark:bg-white/5 text-stone-500 dark:text-stone-400 shrink-0">
          {icono}
        </span>
        <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">
          {titulo}
        </span>
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-white/8 text-stone-500 dark:text-stone-400">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-stone-400 dark:text-stone-500 transition-transform duration-200",
            abierto && "rotate-180"
          )}
        />
      </button>
      {abierto && (
        <fieldset disabled={bloqueado} className="contents">
          <div className="px-4 pb-4">{children}</div>
        </fieldset>
      )}
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
  const [dataCritica, setDataCritica] = useState<DataCritica | null>(null);
  const [dataDiferida, setDataDiferida] = useState<DataDiferida | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const fetchedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!oportunidadId) {
      fetchedIdRef.current = null;
      setDataCritica(null);
      setDataDiferida(null);
      return;
    }
    if (fetchedIdRef.current === oportunidadId) return;
    fetchedIdRef.current = oportunidadId;
    setCargando(true);
    setDataDiferida(null);

    // Fase 1: solo datos críticos — abre el workspace de inmediato
    Promise.all([
      obtenerOportunidadAction(oportunidadId),
      obtenerPipelinesAction(),
    ]).then(([oportunidad, pipelines]) => {
      if (!oportunidad) { setCargando(false); return; }

      const tagIds = (oportunidad as any).tags?.map((t: { tagId: string }) => t.tagId) ?? [];
      const contactosIniciales: ContactoEnPanel[] = ((oportunidad as any).contactos ?? []).map(
        (rel: any) => ({
          contactoId: rel.contactoId,
          principal: rel.principal,
          contacto: rel.contacto,
        })
      );

      setDataCritica({
        oportunidad,
        todosPipelines: pipelines as PipelineConStages[],
        tagIds,
        contactosIniciales,
      });
      setResetKey((k) => k + 1);
      setCargando(false);

      // Fase 2: datos diferidos — popula conversaciones, tags y cotizaciones
      Promise.all([
        obtenerTagsAction(),
        obtenerConversacionesPorOportunidadAction(oportunidadId),
        obtenerCuentasCanalAction(),
        obtenerCotizacionesPorOportunidadAction(oportunidadId),
      ]).then(([tags, conversaciones, cuentasCanal, cotizaciones]) => {
        setDataDiferida({
          tagsDisponibles: tags as Tag[],
          conversaciones: conversaciones as ConversacionResumen[],
          cuentasCanal: cuentasCanal as CuentaCanalResumen[],
          cotizaciones: cotizaciones as CotizacionResumen[],
        });
        marcarMensajeLeido(oportunidadId);
      });
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
          <div className="w-[96vw] h-[94vh] max-w-[1800px] rounded-2xl border border-stone-200 dark:border-white/10 shadow-2xl dark:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden bg-white dark:bg-[radial-gradient(ellipse_at_top,_theme(colors.stone.900)_0%,_theme(colors.neutral.950)_60%,_theme(colors.black)_100%)]">

            {/* Spinner inicial — solo hasta que los datos críticos lleguen */}
            {cargando && (
              <div className="flex flex-1 items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-lime-600 dark:text-lime-400" />
                <span className="text-sm text-stone-500 dark:text-stone-400">Cargando workspace…</span>
              </div>
            )}

            {/* Workspace con carga progresiva — aparece en cuanto llegan datos críticos */}
            {!cargando && dataCritica && (
              <WorkspaceContenido
                key={resetKey}
                critica={dataCritica}
                diferida={dataDiferida}
                initialStageId={dataCritica.oportunidad.stageId ?? initialStageId}
                initialPipelineId={dataCritica.oportunidad.pipelineId ?? pipeline.id}
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
  critica: DataCritica;
  diferida: DataDiferida | null;
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
  critica,
  diferida,
  initialStageId,
  initialPipelineId,
  empresas,
  contactos,
  defaultCountryCode,
  onClose,
  onUpdate,
  onDelete,
}: WorkspaceContenidoProps) {
  const { oportunidad, todosPipelines } = critica;
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("oportunidades");
  const puedeModCotizaciones = puedeModificar("cotizaciones");
  const formBloqueado = !puedeMod;

  const [stageActualId, setStageActualId] = useState<string | null>(initialStageId);
  const [pipelineActualId, setPipelineActualId] = useState<string | null>(initialPipelineId);
  const [metadata, setMetadata] = useState<Record<string, unknown>>(
    (oportunidad.metadata as Record<string, unknown>) ?? {}
  );
  const [tagIds, setTagIds] = useState<string[]>(critica.tagIds);
  const [guardandoStage, setGuardandoStage] = useState(false);
  const [bloqueoPendiente, setBloqueoPendiente] = useState<{
    stageNombre: string;
    stageColor: string | null;
    campos: string[];
  } | null>(null);
  const camposSeccionRef = useRef<HTMLDivElement>(null);
  const [cotizaciones, setCotizaciones] = useState<CotizacionResumen[]>(diferida?.cotizaciones ?? []);

  // Sincroniza cotizaciones cuando llegan los datos diferidos
  useEffect(() => {
    if (diferida?.cotizaciones) {
      setCotizaciones(diferida.cotizaciones);
    }
  }, [diferida]);
  const [secciones, setSecciones] = useState({
    info: true,
    contactos: false,
    empresa: false,
    etiquetas: false,
    campos: false,
    cotizaciones: false,
  });

  const refrescarCotizaciones = async () => {
    const nuevas = await obtenerCotizacionesPorOportunidadAction(oportunidad.id);
    setCotizaciones(nuevas as CotizacionResumen[]);
  };

  const actualizarMutation = useActualizarOportunidadMutation(oportunidad.id);
  const eliminarMutation = useEliminarOportunidadMutation();
  const moverMutation = useMoverAStageMutation();

  const pipelineActual = todosPipelines.find((p) => p.id === pipelineActualId) ?? todosPipelines[0];
  const stageActual = pipelineActual?.stages.find((s) => s.id === stageActualId);
  const camposPipeline = pipelineActual?.campos ?? [];

  const contactoPrincipal =
    critica.contactosIniciales.find((r) => r.principal)?.contacto ??
    critica.contactosIniciales[0]?.contacto ??
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

  const handleCambiarStage = (
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
              tag: (diferida?.tagsDisponibles ?? []).find((t) => t.id === tagId) ?? { id: tagId, nombre: "", color: null },
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
    const camposFaltantes = validarCamposRequeridos(camposPipeline, stageActualId, metadata);
    if (camposFaltantes.length > 0) {
      toast.error(`Completa los campos obligatorios: ${camposFaltantes.join(", ")}`);
      return;
    }

    if (camposPipeline.length > 0) {
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
              tag: (diferida?.tagsDisponibles ?? []).find((t) => t.id === tagId) ?? { id: tagId, nombre: "", color: null },
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
      <div className="shrink-0 border-b border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-950/60">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-xl bg-lime-500/10 dark:bg-lime-500/15 border border-lime-500/25 dark:border-lime-400/20 flex items-center justify-center text-lime-700 dark:text-lime-300 font-bold text-sm shrink-0">
            {(contactoPrincipal?.nombre?.[0] ?? "?").toUpperCase()}
            {(contactoPrincipal?.apellido?.[0] ?? "").toUpperCase()}
          </div>

          {/* Nombre + contexto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-stone-900 dark:text-stone-50 leading-tight">
                {nombreContacto}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {empresa && (
                <span className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                  <Building2 className="h-3 w-3" />
                  {empresa.nombre}
                </span>
              )}
              {empresa && stageActual && (
                <span className="text-stone-300 dark:text-stone-700">·</span>
              )}
              {pipelineActual && (
                <span className="text-xs text-stone-400 dark:text-stone-500">{pipelineActual.nombre}</span>
              )}
              {stageActual && (
                <>
                  <span className="text-stone-300 dark:text-stone-700">›</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: stageActual.color ?? "#a3a3a3" }}
                  >
                    {stageActual.nombre}
                  </span>
                </>
              )}
              <span className="text-stone-300 dark:text-stone-700">·</span>
              <span className="text-xs font-semibold text-lime-600 dark:text-lime-400">{valorFormateado}</span>
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
          {puedeMod && (
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
          )}

          {/* Acciones rápidas */}
          <div className="flex items-center gap-1 shrink-0">
            {contactoPrincipal?.telefonoPrincipal && (
              <a
                href={`tel:${contactoPrincipal.telefonoPrincipal}`}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
                title="Llamar"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
              title="Video"
            >
              <Video className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
              title="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
            <ButtonLink
              href={`/crm/oportunidades/${oportunidad.id}`}
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/8"
              title="Ver página completa"
            >
              <ExternalLink className="h-4 w-4" />
            </ButtonLink>
            <button
              type="button"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
              title="Más opciones"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <div className="w-px h-5 bg-stone-200 dark:bg-white/10 mx-1" />
            {puedeMod && (
              <SheetNuevaCotizacion
                oportunidadId={oportunidad.id}
                oportunidadTitulo={oportunidad.titulo}
                contactoId={contactoPrincipal?.id}
                empresaId={(oportunidad as any).empresaId ?? undefined}
                destinatario={{
                  nombre: contactoPrincipal?.nombre,
                  apellido: contactoPrincipal?.apellido,
                  telefono: (contactoPrincipal as any)?.telefonoPrincipal ?? undefined,
                  email: (contactoPrincipal as any)?.email ?? undefined,
                }}
                onCreada={() => {
                  refrescarCotizaciones();
                  setSecciones((prev) => ({ ...prev, cotizaciones: true }));
                }}
              />
            )}
            <div className="w-px h-5 bg-stone-200 dark:bg-white/10 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
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
          {diferida ? (
            <PanelConversacion
              oportunidadId={oportunidad.id}
              contactoId={contactoPrincipal?.id ?? ""}
              nombreContacto={nombreContacto}
              telefonoContacto={contactoPrincipal?.telefonoPrincipal ?? null}
              cuentas={diferida.cuentasCanal}
              conversacionesIniciales={diferida.conversaciones}
            />
          ) : (
            <div className="flex flex-col flex-1 p-4 gap-3 animate-pulse">
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 rounded-full bg-stone-200 dark:bg-white/8 shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-3 w-48 rounded bg-stone-200 dark:bg-white/8" />
                  <div className="h-10 w-64 rounded-xl bg-stone-200 dark:bg-white/8" />
                </div>
              </div>
              <div className="flex items-end gap-2 flex-row-reverse">
                <div className="space-y-1.5">
                  <div className="h-3 w-32 rounded bg-stone-200 dark:bg-white/8 ml-auto" />
                  <div className="h-10 w-52 rounded-xl bg-stone-200 dark:bg-white/8" />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 rounded-full bg-stone-200 dark:bg-white/8 shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-3 w-36 rounded bg-stone-200 dark:bg-white/8" />
                  <div className="h-16 w-72 rounded-xl bg-stone-200 dark:bg-white/8" />
                </div>
              </div>
              <div className="flex items-end gap-2 flex-row-reverse">
                <div className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-stone-200 dark:bg-white/8 ml-auto" />
                  <div className="h-10 w-44 rounded-xl bg-stone-200 dark:bg-white/8" />
                </div>
              </div>
              <div className="flex-1" />
              <div className="h-12 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/8" />
            </div>
          )}
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
              <fieldset disabled={formBloqueado} className="contents">
              <div className="px-4 pt-4 pb-3 border-b border-stone-200 dark:border-white/8 shrink-0">
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <textarea
                          {...field}
                          rows={2}
                          className="w-full border-0 bg-transparent p-0 text-lg font-semibold leading-snug text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-600 focus:outline-none resize-none"
                          placeholder="Título de la oportunidad"
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </fieldset>

              {/* Secciones acordeón — scrollables */}
              <div className="flex-1 inbox-scroll">

                {/* ── Información General ────────────────────────────── */}
                <Seccion
                  titulo="Información General"
                  bloqueado={formBloqueado}
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
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">Valor</FormLabel>
                            <FormControl>
                              <Input
                                type="number" min="0" step="0.01"
                                className="bg-stone-50 dark:bg-white/4 border-stone-200 dark:border-white/10 rounded-xl h-8 text-sm"
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
                            <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">Moneda</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger className="bg-stone-50 dark:bg-white/4 border-stone-200 dark:border-white/10 rounded-xl h-8 text-sm">
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

                    {/* Fecha de cierre */}
                    <FormField
                      control={form.control}
                      name="fechaCierre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">Fecha de cierre</FormLabel>
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

                    {/* Empresa */}
                    <FormField
                      control={form.control}
                      name="empresaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">Empresa</FormLabel>
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
                          <FormLabel className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">Notas</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              className="resize-none bg-stone-50 dark:bg-white/4 border-stone-200 dark:border-white/10 rounded-xl text-sm text-stone-700 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-600"
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
                  bloqueado={formBloqueado}
                  icono={<User className="h-3 w-3" />}
                  abierto={secciones.contactos}
                  onToggle={() => toggleSeccion("contactos")}
                  badge={critica.contactosIniciales.length}
                >
                  <div className="-mx-4">
                    <GestorContactosPanel
                      key={oportunidad.id}
                      oportunidadId={oportunidad.id}
                      contactosIniciales={critica.contactosIniciales}
                      todosContactos={contactos}
                      defaultCountryCode={defaultCountryCode}
                    />
                  </div>
                </Seccion>

                {/* ── Empresa ───────────────────────────────────────── */}
                {empresa && (
                  <Seccion
                    titulo="Empresa"
                    bloqueado={formBloqueado}
                    icono={<Building2 className="h-3 w-3" />}
                    abierto={secciones.empresa}
                    onToggle={() => toggleSeccion("empresa")}
                  >
                    <div className="space-y-2 pt-1">
                      <a
                        href={`/crm/empresas/${empresa.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-semibold text-lime-600 dark:text-lime-400 hover:text-lime-700 dark:hover:text-lime-300 transition-colors"
                      >
                        {empresa.nombre}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      {empresa.industria && (
                        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                          <Building2 className="h-3 w-3 shrink-0 text-stone-400 dark:text-stone-500" />
                          {empresa.industria}
                        </div>
                      )}
                      {empresa.email && (
                        <a
                          href={`mailto:${empresa.email}`}
                          className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                        >
                          <Mail className="h-3 w-3 shrink-0 text-stone-400 dark:text-stone-500" />
                          {empresa.email}
                        </a>
                      )}
                      {empresa.sitioWeb && (
                        <a
                          href={empresa.sitioWeb}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                        >
                          <Globe className="h-3 w-3 shrink-0 text-stone-400 dark:text-stone-500" />
                          {empresa.sitioWeb.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </div>
                  </Seccion>
                )}

                {/* ── Etiquetas ─────────────────────────────────────── */}
                {(diferida === null || diferida.tagsDisponibles.length > 0) && (
                  <Seccion
                    titulo="Etiquetas"
                    bloqueado={formBloqueado}
                    icono={<TagIcon className="h-3 w-3" />}
                    abierto={secciones.etiquetas}
                    onToggle={() => toggleSeccion("etiquetas")}
                    badge={tagIds.length}
                  >
                    <div className="pt-1">
                      {diferida ? (
                        <SelectorTags
                          tags={diferida.tagsDisponibles}
                          seleccionados={tagIds}
                          onChange={setTagIds}
                        />
                      ) : (
                        <div className="flex gap-1.5 flex-wrap animate-pulse">
                          <div className="h-5 w-16 rounded-full bg-stone-200 dark:bg-white/8" />
                          <div className="h-5 w-20 rounded-full bg-stone-200 dark:bg-white/8" />
                          <div className="h-5 w-12 rounded-full bg-stone-200 dark:bg-white/8" />
                        </div>
                      )}
                    </div>
                  </Seccion>
                )}

                {/* ── Cotizaciones ──────────────────────────────────── */}
                <Seccion
                  titulo="Cotizaciones"
                  bloqueado={formBloqueado}
                  icono={<FileText className="h-3 w-3" />}
                  abierto={secciones.cotizaciones}
                  onToggle={() => toggleSeccion("cotizaciones")}
                  badge={diferida ? cotizaciones.length : undefined}
                >
                  <div className="space-y-2 pt-1">
                    {diferida === null ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-12 rounded-lg bg-stone-100 dark:bg-white/6 border border-stone-200 dark:border-white/8" />
                        <div className="h-12 rounded-lg bg-stone-50 dark:bg-white/4 border border-stone-200 dark:border-white/6" />
                      </div>
                    ) : cotizaciones.length === 0 ? (
                      <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-3">Sin cotizaciones</p>
                    ) : (
                      cotizaciones.map((c) => {
                        const conf = ESTADO_COTIZACION_CONFIG[c.estado as keyof typeof ESTADO_COTIZACION_CONFIG];
                        // BORRADOR/REVISADA: pre-aprobación — acá se puede seguir moviendo
                        // el flujo manual (ver "Marcar enviada" y "Generar pedido" abajo).
                        const esEditable = c.estado === "BORRADOR" || c.estado === "REVISADA";
                        return (
                          <div key={c.id} className="rounded-lg bg-stone-50 dark:bg-white/4 border border-stone-200 dark:border-white/8 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-mono text-stone-700 dark:text-stone-300 truncate">{c.numero}</span>
                                <span className={cn(
                                  "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                  c.estado === "BORRADOR" && "bg-stone-100 dark:bg-stone-500/20 text-stone-600 dark:text-stone-400",
                                  c.estado === "REVISADA" && "bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400",
                                  c.estado === "ENVIADA" && "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
                                  c.estado === "APROBADA" && "bg-green-50 dark:bg-green-500/20 text-green-700 dark:text-green-400",
                                  c.estado === "RECHAZADA" && "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400",
                                  c.estado === "VENCIDA" && "bg-yellow-50 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
                                )}>
                                  {conf?.etiqueta ?? c.estado}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {puedeModCotizaciones && c.estado === "BORRADOR" && (
                                  <>
                                    <SheetEditarCotizacion
                                      cotizacionId={c.id}
                                      onActualizada={refrescarCotizaciones}
                                    />
                                    <ConfirmacionDialog
                                      trigger={
                                        <button
                                          type="button"
                                          className="h-5 w-5 flex items-center justify-center rounded text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                          title="Eliminar cotización"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      }
                                      titulo="¿Eliminar cotización?"
                                      descripcion={`Se eliminará la cotización ${c.numero}.`}
                                      onConfirmar={async () => {
                                        const r = await eliminarCotizacion(c.id);
                                        if (r.exito) { toast.success("Cotización eliminada"); refrescarCotizaciones(); }
                                        else toast.error(r.error);
                                      }}
                                    />
                                  </>
                                )}
                                <a
                                  href={`/sales/cotizaciones/${c.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="h-5 w-5 flex items-center justify-center rounded text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1.5 gap-2">
                              <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums">
                                {c.moneda} {c.total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                              </span>
                              {esEditable && (
                                <div className="flex items-center gap-1">
                                  {c.estado === "BORRADOR" && (
                                    <button
                                      type="button"
                                      className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 border border-stone-200 dark:border-white/10 transition-colors"
                                      onClick={async () => {
                                        // Internamente ahora avanza a REVISADA (Enviada pasó a ser
                                        // el estado final, después de Aprobada) — el botón se deja
                                        // igual a propósito, sin cambios visuales en el Workspace.
                                        const r = await cambiarEstadoCotizacion(c.id, "REVISADA");
                                        if (r.exito) { toast.success("Marcada como enviada"); refrescarCotizaciones(); }
                                        else toast.error(r.error);
                                      }}
                                    >
                                      Marcar enviada
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="text-[10px] px-2 py-0.5 rounded bg-lime-50 dark:bg-lime-500/15 hover:bg-lime-100 dark:hover:bg-lime-500/25 text-lime-700 dark:text-lime-400 hover:text-lime-800 dark:hover:text-lime-300 border border-lime-300 dark:border-lime-400/20 transition-colors flex items-center gap-1"
                                    onClick={async () => {
                                      // El pedido se genera en segundo plano (CotizacionAprobadaSuscriptor)
                                      // — ya no hay pedidoId/numero sincrónico para mostrar acá.
                                      const r = await aprobarCotizacion(c.id);
                                      if (r.exito) {
                                        toast.success("Cotización aprobada — generando pedido");
                                        refrescarCotizaciones();
                                      } else {
                                        toast.error(r.error);
                                      }
                                    }}
                                  >
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Generar pedido
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Seccion>

                {/* ── Campos personalizados del pipeline ───────────── */}
                {camposPipeline.length > 0 && (
                  <div ref={camposSeccionRef}>
                    <Seccion
                      titulo="Campos"
                      bloqueado={formBloqueado}
                      icono={<Layers className="h-3 w-3" />}
                      abierto={secciones.campos}
                      onToggle={() => toggleSeccion("campos")}
                    >
                      <div className="pt-1">
                        <CamposDinamicos
                          campos={camposPipeline}
                          stageId={stageActualId}
                          valores={metadata}
                          onChange={(clave, valor) =>
                            setMetadata((prev) => ({ ...prev, [clave]: valor }))
                          }
                        />
                      </div>
                    </Seccion>
                  </div>
                )}
              </div>

              {/* Footer: guardar / eliminar */}
              {puedeMod && (
                <div className="shrink-0 border-t border-stone-200 dark:border-white/10 px-4 py-3 flex items-center justify-between gap-2 bg-stone-50 dark:bg-stone-950/40">
                  <ConfirmacionDialog
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 rounded-lg text-xs"
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
              )}
            </form>
          </Form>
        </div>
      </div>

      <DialogCamposRequeridos
        open={bloqueoPendiente !== null}
        onClose={() => setBloqueoPendiente(null)}
        stageNombre={bloqueoPendiente?.stageNombre ?? ""}
        stageColor={bloqueoPendiente?.stageColor}
        camposFaltantes={bloqueoPendiente?.campos ?? []}
        onIrACampos={() => {
          setSecciones((prev) => ({ ...prev, campos: true }));
          setTimeout(() => camposSeccionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        }}
      />
    </div>
  );
}
