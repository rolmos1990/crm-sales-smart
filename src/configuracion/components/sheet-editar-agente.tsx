"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Bot,
  Loader2,
  Sparkles,
  Settings2,
  CheckSquare,
  Square,
  Package,
  FileText,
  ShoppingCart,
  Tag,
  UserPen,
  User,
  ArrowRightLeft,
  ChevronDown,
  History,
  Plus,
  X,
  BookOpen,
  Search,
  Target,
  MessageCircle,
  Radio,
  Brain,
  IdCard,
  SlidersHorizontal,
  ShieldAlert,
  Layers,
  Wrench,
  Route,
  Gauge,
  PlayCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES } from "@/ai/tools/constantes";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TextareaConReferencias } from "@/shared/ui/textarea-con-referencias";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { editarUsuario } from "@/configuracion/usuarios/actions";
import {
  guardarAgenteIA,
  cargarConfigAgenteIA,
  guardarBorradorAgenteIA,
} from "@/configuracion/ia/agente-actions";
import { EditarUsuarioSchema, type EditarUsuarioInput } from "@/configuracion/usuarios/schema";
import {
  AgenteIAConfigSchema,
  type AgenteIAConfigInput,
  type ConfiguracionTonoInput,
  type RespuestaGuiaInput,
  INTENCIONES_RESPUESTA_GUIA,
} from "@/configuracion/ia/agente-schema";
import { plantillaDeTipo, TIPO_AGENTE_POR_DEFECTO } from "@/configuracion/ia/plantillas-agente";
import { MAX_INSTRUCCIONES_AGENTE } from "@/configuracion/ia/agente-schema";
import type { TipoAgenteIA } from "@/generated/prisma/enums";
import type { UsuarioInstanciaDetalle } from "@/configuracion/usuarios/types";
import { SeccionVersionesAgente } from "./seccion-versiones-agente";
import { EditorRespuestasGuia } from "./editor-respuestas-guia";
import { AsignarEstrategiasAgente } from "@/ai/estrategia/components/asignar-estrategias-agente";
import { SeccionAutomatizacion } from "@/ai/autonomia/components/seccion-automatizacion";
import { PanelSimulador } from "@/ai/simulador/components/panel-simulador";
import { ComparadorVersiones } from "@/ai/simulador/components/comparador-versiones";

// 009-perfil-agente-estructurado-versionado — etiquetas de las nuevas
// dimensiones de comunicación (mismos valores que agente-schema.ts).
const LONGITUDES = [
  { valor: "CORTA", etiqueta: "Corta" },
  { valor: "MEDIA", etiqueta: "Media" },
  { valor: "LARGA", etiqueta: "Larga" },
] as const;
const PROACTIVIDADES = [
  { valor: "BAJA", etiqueta: "Baja" },
  { valor: "MEDIA", etiqueta: "Media" },
  { valor: "ALTA", etiqueta: "Alta" },
] as const;
const INTENSIDADES_COMERCIALES = [
  { valor: "SUAVE", etiqueta: "Suave" },
  { valor: "MODERADA", etiqueta: "Moderada" },
  { valor: "DIRECTA", etiqueta: "Directa" },
] as const;
const ESTILOS_RECOMENDACION = [
  { valor: "CONSULTIVO", etiqueta: "Consultivo" },
  { valor: "DIRECTO", etiqueta: "Directo" },
  { valor: "COMPARATIVO", etiqueta: "Comparativo" },
] as const;

const CANALES_DISPONIBLES = [
  { valor: "whatsapp_lite", etiqueta: "WhatsApp Lite" },
  { valor: "whatsapp_business", etiqueta: "WhatsApp Business" },
  { valor: "email", etiqueta: "Email" },
  { valor: "instagram", etiqueta: "Instagram" },
  { valor: "tiktok", etiqueta: "TikTok" },
  { valor: "web", etiqueta: "Chat Web" },
];

const HERRAMIENTAS_DISPONIBLES = [
  { nombre: "buscar_productos",          label: "Acceso a Productos",    descripcion: "Precio y disponibilidad", Icono: Package },
  { nombre: "crear_cotizacion",          label: "Crear Cotizaciones",    descripcion: "Genera cotizaciones",     Icono: FileText },
  { nombre: "crear_pedido",              label: "Crear Pedidos",         descripcion: "Registra pedidos",        Icono: ShoppingCart },
  { nombre: "agregar_etiqueta_contacto", label: "Calificar Prospecto",   descripcion: "Agrega etiquetas",        Icono: Tag },
  { nombre: "actualizar_info_contacto",  label: "Actualizar Contacto",   descripcion: "Pide y guarda datos",     Icono: UserPen },
  { nombre: "obtener_info_cliente",      label: "Leer Info del Cliente", descripcion: "Accede al perfil",        Icono: User },
  { nombre: "transferir_a_humano",       label: "Transferir a Humano",   descripcion: "Pasa a un agente",        Icono: ArrowRightLeft },
];

// 018-simulador-agente (Historia 4, "Conocimiento") — herramientas
// operativas de solo lectura de 015, siempre disponibles (no son
// togglables como HERRAMIENTAS_DISPONIBLES) — se muestran informativamente.
// 024-alias-ubicaciones-transportistas — HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES
// se importa ahora de @/ai/tools/constantes (única fuente de verdad, ver
// import arriba) — también autoriza su ejecución real (research.md §6).

const TONOS = ["Cálido", "Profesional", "Directo", "Empático", "Entusiasta"] as const;
const FORMALIDADES = ["Formal", "Semi Formal", "Informal"] as const;

// Navegación vertical del modal. Mismos destinos que las pestañas anteriores
// —ninguno se eliminó— reordenados de lo más usado a lo más ocasional.
const DESTINOS: { valor: string; etiqueta: string; Icono: LucideIcon }[] = [
  { valor: "general", etiqueta: "General", Icono: Settings2 },
  { valor: "ia", etiqueta: "Configuración IA", Icono: Sparkles },
  { valor: "conocimiento", etiqueta: "Conocimiento", Icono: BookOpen },
  { valor: "estrategias", etiqueta: "Estrategias", Icono: Route },
  { valor: "automatizacion", etiqueta: "Automatización", Icono: Gauge },
  { valor: "simulador", etiqueta: "Simulador", Icono: PlayCircle },
  { valor: "versiones", etiqueta: "Versiones", Icono: History },
];

/** Tarjeta de una sección del modal: ícono, título, descripción y contenido. */
function SeccionConfig({
  Icono,
  titulo,
  descripcion,
  accion,
  children,
  className,
}: {
  Icono: LucideIcon;
  titulo: string;
  descripcion: string;
  accion?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-stone-300">
          <Icono className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium leading-tight text-stone-100">{titulo}</h3>
          <p className="mt-0.5 text-xs leading-snug text-stone-500">{descripcion}</p>
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </header>
      {children}
    </section>
  );
}

/**
 * Editor del prompt del agente. Es el campo más largo del modal (hasta 20.000
 * caracteres de markdown) metido en un diálogo de alto fijo, así que tiene su
 * propia caja con scroll interno y un modo expandido a pantalla completa —
 * sin eso editarlo obliga a leer por una rendija de 16 líneas.
 */
function EditorPromptAgente({
  value,
  onChange,
  tipoAgente,
}: {
  value: string;
  onChange: (valor: string) => void;
  tipoAgente: TipoAgenteIA | null | undefined;
}) {
  const [expandido, setExpandido] = useState(false);
  const plantilla = plantillaDeTipo(tipoAgente);

  function restaurarPlantilla() {
    if (value.trim() && !window.confirm(`Se reemplazarán las instrucciones actuales por la plantilla «${plantilla.etiqueta}». ¿Continuar?`)) {
      return;
    }
    onChange(plantilla.instrucciones);
    toast.success(`Instrucciones restauradas desde «${plantilla.etiqueta}»`);
  }

  const editor = (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]",
        expandido && "h-full",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/8 bg-white/[0.02] px-3 py-2">
        <FileText className="h-4 w-4 shrink-0 text-stone-400" />
        <span className="text-xs font-medium text-stone-200">Prompt del agente</span>

        <span className="ml-auto hidden text-[11px] tabular-nums text-stone-500 sm:block">
          {value.length.toLocaleString("es")} / {MAX_INSTRUCCIONES_AGENTE.toLocaleString("es")}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={restaurarPlantilla}
          title={`Restaurar desde la plantilla «${plantilla.etiqueta}»`}
          className="h-7 gap-1.5 rounded-lg px-2 text-[11px] text-stone-400 hover:bg-white/10 hover:text-stone-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="max-sm:hidden">Plantilla</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setExpandido((v) => !v)}
          aria-label={expandido ? "Contraer editor" : "Expandir editor"}
          title={expandido ? "Contraer" : "Expandir a pantalla completa"}
          className="h-7 w-7 shrink-0 rounded-lg text-stone-400 hover:bg-white/10 hover:text-stone-100"
        >
          {expandido ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
      </header>

      <div className={cn("p-2", expandido && "min-h-0 flex-1")}>
        <TextareaConReferencias
          value={value}
          onChange={onChange}
          placeholder="# Rol y objetivo…"
          maxLength={MAX_INSTRUCCIONES_AGENTE}
          // field-sizing-fixed: sin esto el textarea crece con el contenido y
          // el prompt entero empuja el scroll del modal en vez de tener el
          // suyo propio.
          className={cn(
            "resize-none overflow-y-auto border-white/10 bg-stone-950/40 font-mono text-xs leading-relaxed text-stone-50 field-sizing-fixed placeholder:text-stone-500",
            expandido ? "h-full" : "h-[22rem] max-sm:h-[16rem]",
          )}
        />
      </div>
    </div>
  );

  if (!expandido) return editor;

  return (
    <>
      {/* Hueco del mismo alto para que el resto del formulario no salte
          cuando el editor se va a pantalla completa. */}
      <div className="h-[22rem] rounded-xl border border-dashed border-white/10 max-sm:h-[16rem]" />
      {/* Por portal a <body>: DialogContent se centra con `-translate-x-1/2`,
          y ese transform convierte al diálogo en el bloque contenedor de
          cualquier `position: fixed` que cuelgue de él — sin el portal esto
          cubriría solo el modal, no la pantalla. */}
      {createPortal(
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-stone-950/98 p-4 backdrop-blur-sm sm:p-6"
          onKeyDown={(e) => {
            // Esc contrae el editor en vez de cerrar el modal entero y
            // perder lo que se venía escribiendo.
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setExpandido(false);
            }
          }}
        >
          <div className="min-h-0 flex-1">{editor}</div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Encabezado de un grupo de secciones dentro del área de contenido. */
function TituloGrupo({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-tight text-stone-50">{titulo}</h2>
      <p className="text-sm text-stone-500">{descripcion}</p>
    </div>
  );
}

// 009-perfil-agente-estructurado-versionado — editor simple de listas de
// texto (frases preferidas/prohibidas, comportamientos prohibidos, reglas
// personalizadas, condiciones de transferencia a humano). Reutilizable entre
// los 5 campos de la sección Reglas.
function EditorListaTexto({
  valores,
  onChange,
  placeholder,
}: {
  valores: string[];
  onChange: (nuevos: string[]) => void;
  placeholder: string;
}) {
  const [nuevoValor, setNuevoValor] = useState("");

  function agregar() {
    const texto = nuevoValor.trim();
    if (!texto) return;
    onChange([...valores, texto]);
    setNuevoValor("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={nuevoValor}
          onChange={(e) => setNuevoValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder={placeholder}
          className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm"
        />
        <Button
          type="button"
          onClick={agregar}
          variant="outline"
          className="border-white/10 text-stone-300 hover:bg-white/10 flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {valores.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {valores.map((valor, indice) => (
            <li
              key={`${valor}-${indice}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5"
            >
              <span className="text-stone-300 text-sm">{valor}</span>
              <button
                type="button"
                onClick={() => onChange(valores.filter((_, i) => i !== indice))}
                className="text-stone-500 hover:text-stone-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SheetEditarAgenteProps {
  agente: UsuarioInstanciaDetalle | null;
  onCerrar: () => void;
  onExito: () => void;
}

type ConfigCargada = Awaited<ReturnType<typeof cargarConfigAgenteIA>>;

export function SheetEditarAgente({ agente, onCerrar, onExito }: SheetEditarAgenteProps) {
  const [isPendingBasico, startBasico] = useTransition();
  const [isPendingIA, startIA] = useTransition();
  const [isPendingBorrador, startBorrador] = useTransition();
  const [configIA, setConfigIA] = useState<ConfigCargada>(null);
  const [cargandoConfig, setCargandoConfig] = useState(false);
  const [activandoIA, startActivar] = useTransition();
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false);
  // Controlada: el pie del modal necesita saber qué sección está abierta para
  // ofrecer el guardado que corresponde.
  const [seccion, setSeccion] = useState<string>("general");
  const [busquedaHerramienta, setBusquedaHerramienta] = useState("");

  const formBasico = useForm<EditarUsuarioInput>({
    resolver: zodResolver(EditarUsuarioSchema),
    values: {
      nombre: agente?.nombre ?? "",
      rol: (agente?.rol as EditarUsuarioInput["rol"]) ?? "AGENTE",
      cargo: agente?.cargo ?? "",
      telefono: agente?.telefono ?? "",
    },
  });

  const formIA = useForm<AgenteIAConfigInput>({
    resolver: zodResolver(AgenteIAConfigSchema),
    defaultValues: {
      instruccionesAgente: "",
      sistemaPrompt: "",
      personalidad: "",
      objetivo: "",
      especialidad: "",
      temperaturaOverride: null,
      modeloPreferido: "",
      memoriaHabilitada: true,
      limiteTokensCtx: 4000,
      canalesPermitidos: null,
      herramientas: null,
      configuracionTono: null,
      nombreAgente: "",
      rol: "",
      idiomaPrincipal: "",
      idiomasPermitidos: null,
      longitudRespuesta: null,
      proactividad: null,
      intensidadComercial: null,
      estiloRecomendacion: null,
      frasesPreferidas: null,
      frasesProhibidas: null,
      comportamientosProhibidos: null,
      reglasPersonalizadas: null,
      condicionesTransferenciaHumano: null,
      respuestasGuia: null,
      catalogoEnContexto: true,
      limiteCatalogoContexto: 30,
    },
  });

  const canalesActivos = formIA.watch("canalesPermitidos") ?? [];
  const herramientasActivas = formIA.watch("herramientas") ?? [];
  const configuracionTono = formIA.watch("configuracionTono");
  const catalogoEnContexto = formIA.watch("catalogoEnContexto") ?? true;

  const herramientasFiltradas = HERRAMIENTAS_DISPONIBLES.filter(({ label, descripcion }) => {
    const q = busquedaHerramienta.trim().toLowerCase();
    return !q || label.toLowerCase().includes(q) || descripcion.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!agente?.usuarioId || !agente.agenteIAConfig) return;

    setCargandoConfig(true);
    cargarConfigAgenteIA(agente.usuarioId)
      .then((config) => {
        setConfigIA(config);
        if (config) {
          formIA.reset({
            instruccionesAgente: config.instruccionesAgente ?? "",
            sistemaPrompt: config.sistemaPrompt ?? "",
            personalidad: config.personalidad ?? "",
            objetivo: config.objetivo ?? "",
            especialidad: config.especialidad ?? "",
            temperaturaOverride: (config.temperaturaOverride as number | null) ?? null,
            modeloPreferido: config.modeloPreferido ?? "",
            memoriaHabilitada: config.memoriaHabilitada,
            limiteTokensCtx: config.limiteTokensCtx,
            canalesPermitidos: (config.canalesPermitidos as string[] | null) ?? null,
            herramientas: (config.herramientas as string[] | null) ?? null,
            configuracionTono: (config.configuracionTono as ConfiguracionTonoInput | null) ?? null,
            nombreAgente: config.nombreAgente ?? "",
            rol: config.rol ?? "",
            idiomaPrincipal: config.idiomaPrincipal ?? "",
            idiomasPermitidos: (config.idiomasPermitidos as string[] | null) ?? null,
            longitudRespuesta: (config.longitudRespuesta as AgenteIAConfigInput["longitudRespuesta"]) ?? null,
            proactividad: (config.proactividad as AgenteIAConfigInput["proactividad"]) ?? null,
            intensidadComercial: (config.intensidadComercial as AgenteIAConfigInput["intensidadComercial"]) ?? null,
            estiloRecomendacion: (config.estiloRecomendacion as AgenteIAConfigInput["estiloRecomendacion"]) ?? null,
            frasesPreferidas: (config.frasesPreferidas as string[] | null) ?? null,
            frasesProhibidas: (config.frasesProhibidas as string[] | null) ?? null,
            comportamientosProhibidos: (config.comportamientosProhibidos as string[] | null) ?? null,
            reglasPersonalizadas: (config.reglasPersonalizadas as string[] | null) ?? null,
            condicionesTransferenciaHumano: (config.condicionesTransferenciaHumano as string[] | null) ?? null,
            respuestasGuia: (config.respuestasGuia as RespuestaGuiaInput[] | null) ?? null,
            catalogoEnContexto: config.catalogoEnContexto,
            limiteCatalogoContexto: config.limiteCatalogoContexto,
          });
        }
      })
      .finally(() => setCargandoConfig(false));
  }, [agente?.usuarioId, agente?.agenteIAConfig?.id]);

  function toggleCanal(valor: string) {
    const actuales = formIA.getValues("canalesPermitidos") ?? [];
    if (actuales.includes(valor)) {
      formIA.setValue("canalesPermitidos", actuales.filter((c) => c !== valor));
    } else {
      formIA.setValue("canalesPermitidos", [...actuales, valor]);
    }
  }

  function toggleHerramienta(nombre: string) {
    const actuales = formIA.getValues("herramientas") ?? [];
    if (actuales.includes(nombre)) {
      formIA.setValue("herramientas", actuales.filter((h) => h !== nombre));
    } else {
      formIA.setValue("herramientas", [...actuales, nombre]);
    }
  }

  function getTonoActual(): ConfiguracionTonoInput {
    return formIA.getValues("configuracionTono") ?? {};
  }

  function setTono(tono: ConfiguracionTonoInput["tono"]) {
    const actual = getTonoActual();
    formIA.setValue("configuracionTono", { ...actual, tono: actual.tono === tono ? null : tono });
  }

  function setFormalidad(formalidad: ConfiguracionTonoInput["formalidad"]) {
    const actual = getTonoActual();
    formIA.setValue("configuracionTono", { ...actual, formalidad: actual.formalidad === formalidad ? null : formalidad });
  }

  function setTonoSwitch(campo: keyof Omit<ConfiguracionTonoInput, "tono" | "formalidad">, valor: boolean) {
    formIA.setValue("configuracionTono", { ...getTonoActual(), [campo]: valor });
  }

  function handleCerrar() {
    setConfigIA(null);
    onCerrar();
  }

  function onSubmitBasico(datos: EditarUsuarioInput) {
    if (!agente) return;
    startBasico(async () => {
      const resultado = await editarUsuario(agente.id, datos);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Agente actualizado");
      onExito();
    });
  }

  function onSubmitIA(datos: AgenteIAConfigInput) {
    if (!agente) return;
    startIA(async () => {
      const resultado = await guardarAgenteIA(agente.usuarioId, {
        ...datos,
        sistemaPrompt: datos.sistemaPrompt || undefined,
        personalidad: datos.personalidad || undefined,
        objetivo: datos.objetivo || undefined,
        especialidad: datos.especialidad || undefined,
        modeloPreferido: datos.modeloPreferido || undefined,
      });
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al guardar configuración IA");
        return;
      }
      toast.success("Configuración IA guardada");
      onExito();
    });
  }

  // 009-perfil-agente-estructurado-versionado (Historia 2) — guarda como
  // borrador en vez de sobrescribir la versión publicada vigente. El agente
  // en producción sigue usando la última versión publicada hasta que alguien
  // la publique explícitamente desde la sección Versiones.
  function onSubmitBorrador(datos: AgenteIAConfigInput) {
    if (!agente?.agenteIAConfig) return;
    startBorrador(async () => {
      const resultado = await guardarBorradorAgenteIA(agente.agenteIAConfig!.id, {
        ...datos,
        sistemaPrompt: datos.sistemaPrompt || undefined,
        personalidad: datos.personalidad || undefined,
        objetivo: datos.objetivo || undefined,
        especialidad: datos.especialidad || undefined,
        modeloPreferido: datos.modeloPreferido || undefined,
      });
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al guardar el borrador");
        return;
      }
      toast.success("Borrador guardado — publicalo desde la pestaña Versiones para que aplique");
    });
  }

  function handleActivarIA() {
    if (!agente) return;
    startActivar(async () => {
      const resultado = await guardarAgenteIA(agente.usuarioId, {
        memoriaHabilitada: true,
        limiteTokensCtx: 4000,
        canalesPermitidos: null,
        temperaturaOverride: null,
        // Activar la IA también es crear el agente: nace con la plantilla,
        // igual que si se hubiera creado desde "Nuevo agente".
        instruccionesAgente: plantillaDeTipo(TIPO_AGENTE_POR_DEFECTO).instrucciones,
      });
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al activar IA");
        return;
      }
      toast.success("Agente Comercial IA activado");
      onExito();
    });
  }

  const tieneConfigIA = !!agente?.agenteIAConfig;

  return (
    <Dialog open={!!agente} onOpenChange={handleCerrar}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[90vh] max-h-[90vh] w-[calc(100vw-2rem)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-2xl border border-white/10 bg-stone-950/98 p-0 text-stone-200 sm:max-w-[1120px] max-sm:h-screen max-sm:max-h-screen max-sm:w-screen max-sm:rounded-none"
      >
        {/* ── Encabezado fijo ── */}
        <header className="flex shrink-0 items-start gap-3 border-b border-white/8 px-5 py-4">
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/15 p-2">
            <Bot className="h-5 w-5 text-purple-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <DialogTitle className="text-base font-semibold text-stone-50">Editar agente</DialogTitle>
              <span className="truncate text-sm font-medium text-stone-300">{agente?.nombre ?? "Agente"}</span>
              {agente?.email && <span className="truncate text-xs text-stone-500">{agente.email}</span>}
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  tieneConfigIA
                    ? "border-lime-500/30 bg-lime-500/10 text-lime-300"
                    : "border-white/10 bg-white/5 text-stone-400",
                )}
              >
                {tieneConfigIA ? "IA activa" : "Sin IA"}
              </span>
            </div>
            <DialogDescription className="mt-0.5 text-xs text-stone-500">
              Configura el comportamiento, conocimiento y herramientas del agente.
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleCerrar}
            aria-label="Cerrar"
            className="shrink-0 text-stone-400 hover:bg-white/10 hover:text-stone-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* ── Cuerpo: navegación vertical + contenido desplazable ── */}
        <Tabs
          orientation="vertical"
          value={seccion}
          onValueChange={(v) => setSeccion(String(v))}
          className="flex min-h-0 flex-1 gap-0"
        >
          <TabsList
            variant="line"
            className="h-full w-56 shrink-0 flex-col items-stretch justify-start gap-1 overflow-y-auto border-r border-white/8 bg-white/[0.02] p-3 max-sm:w-44"
          >
            {DESTINOS.map(({ valor, etiqueta, Icono }) => (
              <TabsTrigger
                key={valor}
                value={valor}
                className="w-full flex-none justify-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-stone-400 after:hidden hover:bg-white/5 hover:text-stone-200 data-active:bg-lime-500/10 data-active:text-lime-300 data-active:ring-1 data-active:ring-lime-500/25"
              >
                <Icono className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{etiqueta}</span>
                {valor === "ia" && tieneConfigIA && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">

          {/* Tab: General */}
          <TabsContent value="general" className="flex flex-col gap-5">
            <TituloGrupo titulo="Datos del agente" descripcion="Cómo se identifica el agente dentro de Karia." />
            <Form {...formBasico}>
              <form onSubmit={formBasico.handleSubmit(onSubmitBasico)} className="flex flex-col gap-4">
                <FormField
                  control={formBasico.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-stone-300">Nombre</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formBasico.control}
                  name="cargo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-stone-300">
                        Descripción <span className="text-stone-500">(opcional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </form>
            </Form>
          </TabsContent>

          {/* Tab: Configuración IA */}
          <TabsContent value="ia">
            {!tieneConfigIA ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="p-4 rounded-2xl bg-white/5">
                  <Sparkles className="h-8 w-8 text-stone-500" />
                </div>
                <div>
                  <p className="text-stone-300 font-medium">Este agente no tiene IA configurada</p>
                  <p className="text-stone-500 text-sm mt-1">
                    Actívalo como Agente Comercial IA para que responda conversaciones automáticamente.
                  </p>
                </div>
                <Button
                  onClick={handleActivarIA}
                  disabled={activandoIA}
                  className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg font-semibold"
                >
                  {activandoIA ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      Activar como Agente Comercial IA
                    </>
                  )}
                </Button>
              </div>
            ) : cargandoConfig ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
              </div>
            ) : (
              <Form {...formIA}>
                <form onSubmit={formIA.handleSubmit(onSubmitIA)} className="flex flex-col gap-5">
                  <TituloGrupo
                    titulo="Comportamiento del agente"
                    descripcion="Define las reglas, respuestas y recursos que puede usar durante una conversación."
                  />

                  {/* ── Sección: Instrucciones ── */}
                  <SeccionConfig
                    Icono={FileText}
                    titulo="Instrucciones del agente"
                    descripcion="Rol y objetivo, estilo de comunicación, proceso de atención y reglas. Es lo que define cómo responde."
                  >
                    <FormField
                      control={formIA.control}
                      name="instruccionesAgente"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <EditorPromptAgente
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              tipoAgente={agente?.agenteIAConfig?.tipo}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SeccionConfig>

                  {/* ── Sección: Objetivo ── */}
                  <SeccionConfig
                    Icono={Target}
                    titulo="Objetivo del agente"
                    descripcion="En una frase, qué debe conseguir en cada conversación."
                  >
                    <FormField
                      control={formIA.control}
                      name="objetivo"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ayudar al cliente a encontrar el producto ideal y cerrar la venta"
                              className="border-white/10 bg-white/5 text-sm text-stone-50 placeholder:text-stone-500"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SeccionConfig>

                  {/* ── Sección: Catálogo con precios (028) ── */}
                  <SeccionConfig
                    Icono={Layers}
                    titulo="Catálogo con precios"
                    descripcion="El agente conoce los productos activos y sus precios reales, y puede buscar el resto. Nunca inventa un precio."
                    accion={
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs", catalogoEnContexto ? "text-lime-300" : "text-stone-500")}>
                          {catalogoEnContexto ? "Activo" : "Desactivado"}
                        </span>
                        <Switch
                          checked={catalogoEnContexto}
                          onCheckedChange={(v) => formIA.setValue("catalogoEnContexto", v, { shouldDirty: true })}
                          aria-label="Incluir catálogo con precios en las respuestas"
                        />
                      </div>
                    }
                  >
                    {catalogoEnContexto && (
                      <FormField
                        control={formIA.control}
                        name="limiteCatalogoContexto"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0 border-t border-white/8 pt-3">
                            <FormLabel className="text-stone-400 text-xs font-normal">Productos a incluir (máx.)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={field.value ?? 30}
                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                className="h-8 w-20 border-white/10 bg-white/5 text-sm text-stone-50"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </SeccionConfig>

                  {/* ── Sección: Herramientas habilitadas ── */}
                  <SeccionConfig
                    Icono={Wrench}
                    titulo="Herramientas habilitadas"
                    descripcion="Define las acciones comerciales que el agente puede ejecutar durante una conversación."
                    accion={
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-stone-400">
                          {herramientasActivas.length} de {HERRAMIENTAS_DISPONIBLES.length}
                        </span>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500" />
                          <Input
                            value={busquedaHerramienta}
                            onChange={(e) => setBusquedaHerramienta(e.target.value)}
                            placeholder="Buscar herramientas"
                            aria-label="Buscar herramientas"
                            className="h-8 w-48 border-white/10 bg-white/5 pl-8 text-sm text-stone-50 placeholder:text-stone-500"
                          />
                        </div>
                      </div>
                    }
                  >
                    <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/8">
                      {herramientasFiltradas.map(({ nombre, label, descripcion, Icono }) => {
                        const activo = herramientasActivas.includes(nombre);
                        return (
                          <li key={nombre} className="flex items-center gap-3 bg-white/[0.02] px-3 py-2.5">
                            <span
                              className={cn(
                                "shrink-0 rounded-lg p-1.5",
                                activo ? "bg-lime-500/15 text-lime-300" : "bg-white/5 text-stone-500",
                              )}
                            >
                              <Icono className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-[0_0_11rem]">
                              <p className="truncate text-sm font-medium leading-tight text-stone-200">{label}</p>
                            </div>
                            <p className="min-w-0 flex-1 truncate text-xs text-stone-500">{descripcion}</p>
                            <Switch
                              checked={activo}
                              onCheckedChange={() => toggleHerramienta(nombre)}
                              aria-label={`${label}: ${activo ? "habilitada" : "deshabilitada"}`}
                              className="shrink-0"
                            />
                          </li>
                        );
                      })}
                      {herramientasFiltradas.length === 0 && (
                        <li className="bg-white/[0.02] px-3 py-6 text-center text-xs text-stone-500">
                          Ninguna herramienta coincide con “{busquedaHerramienta}”.
                        </li>
                      )}
                    </ul>
                  </SeccionConfig>

                  {/* ── Sección: Tono ── */}
                  <SeccionConfig Icono={MessageCircle} titulo="Tono de conversación" descripcion="Cómo se expresa el agente al hablar.">

                    <div className="space-y-1.5">
                      <p className="text-stone-400 text-xs">Tono</p>
                      <div className="flex flex-wrap gap-2">
                        {TONOS.map((t) => {
                          const activo = configuracionTono?.tono === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTono(t)}
                              className={cn(
                                "text-xs px-3 py-1.5 rounded-lg border transition-all",
                                activo
                                  ? "bg-lime-500/15 border-lime-500/30 text-lime-300"
                                  : "bg-white/5 border-white/10 text-stone-500 hover:border-white/20 hover:text-stone-300",
                              )}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-stone-400 text-xs">Formalidad</p>
                      <div className="flex flex-wrap gap-2">
                        {FORMALIDADES.map((f) => {
                          const activo = configuracionTono?.formalidad === f;
                          return (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setFormalidad(f)}
                              className={cn(
                                "text-xs px-3 py-1.5 rounded-lg border transition-all",
                                activo
                                  ? "bg-lime-500/15 border-lime-500/30 text-lime-300"
                                  : "bg-white/5 border-white/10 text-stone-500 hover:border-white/20 hover:text-stone-300",
                              )}
                            >
                              {f}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { campo: "usoEmojis",            label: "Usa emojis" },
                          { campo: "llamaClientePorNombre", label: "Llama por nombre" },
                          { campo: "tuteo",                 label: "Tuteo (tú)" },
                          { campo: "respuestaLarga",        label: "Respuesta larga" },
                          { campo: "usaHumor",              label: "Usa humor" },
                        ] as const
                      ).map(({ campo, label }) => (
                        <div
                          key={campo}
                          className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3 py-2.5"
                        >
                          <span className="text-stone-300 text-sm">{label}</span>
                          <Switch
                            checked={configuracionTono?.[campo] ?? false}
                            onCheckedChange={(v) => setTonoSwitch(campo, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </SeccionConfig>

                  {/* ── Sección: Canales ── */}
                  <SeccionConfig
                    Icono={Radio}
                    titulo="Canales donde actúa"
                    descripcion="Sin ninguno marcado, el agente actúa en todos los canales."
                  >
                  <FormField
                    control={formIA.control}
                    name="canalesPermitidos"
                    render={() => (
                      <FormItem>
                        <div className="flex flex-wrap gap-2">
                          {CANALES_DISPONIBLES.map((canal) => {
                            const activo = canalesActivos.includes(canal.valor);
                            return (
                              <button
                                key={canal.valor}
                                type="button"
                                onClick={() => toggleCanal(canal.valor)}
                                className={cn(
                                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all",
                                  activo
                                    ? "bg-lime-500/15 border-lime-500/30 text-lime-300"
                                    : "bg-white/5 border-white/10 text-stone-500 hover:border-white/20 hover:text-stone-300",
                                )}
                              >
                                {activo ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                                {canal.etiqueta}
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </SeccionConfig>

                  {/* ── Sección: Memoria ── */}
                  <FormField
                    control={formIA.control}
                    name="memoriaHabilitada"
                    render={({ field }) => (
                      <SeccionConfig
                        Icono={Brain}
                        titulo="Memoria"
                        descripcion="El agente recuerda contexto de conversaciones anteriores con el mismo contacto."
                        accion={
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              aria-label="Memoria habilitada"
                            />
                          </FormControl>
                        }
                      />
                    )}
                  />

                  {/* ── Sección: Identidad (009-perfil-agente-estructurado-versionado) ── */}
                  <SeccionConfig Icono={IdCard} titulo="Identidad" descripcion="Nombre, rol e idioma del agente.">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={formIA.control}
                        name="nombreAgente"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Nombre del agente</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                placeholder="Sofía"
                                className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={formIA.control}
                        name="rol"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Rol</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                placeholder="Asesora comercial"
                                className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={formIA.control}
                      name="idiomaPrincipal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Idioma principal</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder="es"
                              className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm w-24"
                            />
                          </FormControl>
                          <FormDescription className="text-stone-500 text-xs">
                            Vacío = el agente responde en el idioma del cliente (comportamiento actual)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SeccionConfig>

                  {/* ── Sección: Comunicación extendida ── */}
                  <SeccionConfig Icono={SlidersHorizontal} titulo="Comunicación" descripcion="Longitud, proactividad, intensidad comercial y estilo de recomendación.">
                    {(
                      [
                        { campo: "longitudRespuesta" as const, etiqueta: "Longitud de respuesta", opciones: LONGITUDES },
                        { campo: "proactividad" as const, etiqueta: "Proactividad", opciones: PROACTIVIDADES },
                        { campo: "intensidadComercial" as const, etiqueta: "Intensidad comercial", opciones: INTENSIDADES_COMERCIALES },
                        { campo: "estiloRecomendacion" as const, etiqueta: "Estilo de recomendación", opciones: ESTILOS_RECOMENDACION },
                      ]
                    ).map(({ campo, etiqueta, opciones }) => {
                      const valorActual = formIA.watch(campo);
                      return (
                        <div key={campo} className="space-y-1.5">
                          <p className="text-stone-400 text-xs">{etiqueta}</p>
                          <div className="flex flex-wrap gap-2">
                            {opciones.map((opcion) => {
                              const activo = valorActual === opcion.valor;
                              return (
                                <button
                                  key={opcion.valor}
                                  type="button"
                                  onClick={() =>
                                    formIA.setValue(campo, activo ? null : (opcion.valor as never))
                                  }
                                  className={cn(
                                    "text-xs px-3 py-1.5 rounded-lg border transition-all",
                                    activo
                                      ? "bg-lime-500/15 border-lime-500/30 text-lime-300"
                                      : "bg-white/5 border-white/10 text-stone-500 hover:border-white/20 hover:text-stone-300",
                                  )}
                                >
                                  {opcion.etiqueta}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </SeccionConfig>

                  {/* ── Sección: Reglas ── */}
                  <SeccionConfig Icono={ShieldAlert} titulo="Reglas y límites" descripcion="Frases preferidas y prohibidas, comportamientos vetados y cuándo transferir a una persona.">

                    <div className="space-y-1.5">
                      <p className="text-stone-400 text-xs">Frases preferidas</p>
                      <EditorListaTexto
                        valores={formIA.watch("frasesPreferidas") ?? []}
                        onChange={(v) => formIA.setValue("frasesPreferidas", v)}
                        placeholder="Con gusto te ayudo"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-stone-400 text-xs">Frases prohibidas</p>
                      <EditorListaTexto
                        valores={formIA.watch("frasesProhibidas") ?? []}
                        onChange={(v) => formIA.setValue("frasesProhibidas", v)}
                        placeholder="no te vas a arrepentir"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-stone-400 text-xs">Comportamientos prohibidos</p>
                      <EditorListaTexto
                        valores={formIA.watch("comportamientosProhibidos") ?? []}
                        onChange={(v) => formIA.setValue("comportamientosProhibidos", v)}
                        placeholder="Presionar para comprar"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-stone-400 text-xs">Reglas personalizadas</p>
                      <EditorListaTexto
                        valores={formIA.watch("reglasPersonalizadas") ?? []}
                        onChange={(v) => formIA.setValue("reglasPersonalizadas", v)}
                        placeholder="Confirmar siempre el correo antes de enviar una cotización"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-stone-400 text-xs">Transferir a humano cuando…</p>
                      <EditorListaTexto
                        valores={formIA.watch("condicionesTransferenciaHumano") ?? []}
                        onChange={(v) => formIA.setValue("condicionesTransferenciaHumano", v)}
                        placeholder="el cliente menciona un reclamo o reembolso"
                      />
                    </div>
                  </SeccionConfig>

                  {/* ── Sección: Respuestas guía (028) ── */}
                  <SeccionConfig Icono={BookOpen} titulo="Respuestas guía" descripcion="Cómo responder cada tipo de consulta. El agente sigue el formato y completa los marcadores solo con datos reales.">
                    <EditorRespuestasGuia
                      valores={formIA.watch("respuestasGuia") ?? []}
                      onChange={(v) => formIA.setValue("respuestasGuia", v, { shouldDirty: true })}
                    />
                    {formIA.formState.errors.respuestasGuia && (
                      <p className="text-xs text-red-400">
                        Revisa las respuestas guía: cada una necesita "cuándo aplica" y un formato.
                      </p>
                    )}
                  </SeccionConfig>

                  {/* ── Sección: Avanzado (colapsable) ── */}
                  <div className="border border-white/10 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAvanzadoAbierto((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 text-stone-400 hover:text-stone-300 hover:bg-white/3 transition-all text-sm"
                    >
                      <span className="text-xs uppercase tracking-wide font-medium">Configuración avanzada</span>
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform", avanzadoAbierto && "rotate-180")}
                      />
                    </button>

                    {avanzadoAbierto && (
                      <div className="px-4 pb-4 flex flex-col gap-4 border-t border-white/8 pt-4">
                        <FormField
                          control={formIA.control}
                          name="sistemaPrompt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">System Prompt</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  rows={4}
                                  placeholder="Eres un asistente comercial de [Empresa]…"
                                  className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm resize-none"
                                />
                              </FormControl>
                              <FormDescription className="text-stone-500 text-xs">
                                Override avanzado — se añade al final del prompt generado.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={formIA.control}
                            name="personalidad"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Personalidad</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="profesional y amigable"
                                    className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm"
                                  />
                                </FormControl>
                                <FormDescription className="text-stone-500 text-xs">Ignorado si hay tono configurado</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={formIA.control}
                            name="especialidad"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Especialidad</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="ventas B2B, soporte…"
                                    className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <FormField
                            control={formIA.control}
                            name="modeloPreferido"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Modelo</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="claude-sonnet-4-6"
                                    className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 font-mono text-xs"
                                  />
                                </FormControl>
                                <FormDescription className="text-stone-500 text-xs">Vacío = default</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={formIA.control}
                            name="temperaturaOverride"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Temperatura</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    placeholder="0.7"
                                    value={field.value ?? ""}
                                    onChange={(e) =>
                                      field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))
                                    }
                                    className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm"
                                  />
                                </FormControl>
                                <FormDescription className="text-stone-500 text-xs">Vacío = default</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={formIA.control}
                            name="limiteTokensCtx"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Contexto</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1000"
                                    max="100000"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    className="bg-white/5 border-white/10 text-stone-50 text-sm"
                                  />
                                </FormControl>
                                <FormDescription className="text-stone-500 text-xs">tokens</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </form>
              </Form>
            )}
          </TabsContent>

          {/* Tab: Versiones (009-perfil-agente-estructurado-versionado) */}
          <TabsContent value="versiones" className="flex flex-col gap-5">
            <TituloGrupo titulo="Versiones" descripcion="Historial de configuraciones publicadas. Puedes duplicar o restaurar cualquiera." />
            {!tieneConfigIA ? (
              <p className="text-stone-500 text-sm text-center py-8">
                Activá primero el Agente Comercial IA para ver su historial de versiones.
              </p>
            ) : (
              <SeccionVersionesAgente agenteIAConfigId={agente!.agenteIAConfig!.id} />
            )}
          </TabsContent>

          {/* Tab: Estrategias (011-playbook-estrategia-comercial) */}
          <TabsContent value="estrategias" className="flex flex-col gap-5">
            <TituloGrupo titulo="Estrategias" descripcion="Playbooks comerciales que el agente aplica según la situación." />
            {!tieneConfigIA ? (
              <p className="text-stone-500 text-sm text-center py-8">
                Activá primero el Agente Comercial IA para asignarle estrategias.
              </p>
            ) : (
              <AsignarEstrategiasAgente agenteIAConfigId={agente!.agenteIAConfig!.id} />
            )}
          </TabsContent>

          {/* Tab: Automatización (016-niveles-autonomia-automatizacion) */}
          <TabsContent value="automatizacion" className="flex flex-col gap-5">
            <TituloGrupo titulo="Automatización" descripcion="Cuánta autonomía tiene el agente para actuar sin revisión humana." />
            {!tieneConfigIA ? (
              <p className="text-stone-500 text-sm text-center py-8">
                Activá primero el Agente Comercial IA para configurar su autonomía.
              </p>
            ) : (
              <SeccionAutomatizacion agenteIAConfigId={agente!.agenteIAConfig!.id} />
            )}
          </TabsContent>

          {/* Tab: Simulador (018-simulador-agente) */}
          <TabsContent value="simulador" className="flex flex-col gap-5">
            <TituloGrupo titulo="Simulador" descripcion="Prueba el agente con conversaciones de ejemplo antes de publicarlo." />
            {!tieneConfigIA ? (
              <p className="text-stone-500 text-sm text-center py-8">
                Activá primero el Agente Comercial IA para poder simular conversaciones.
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                <PanelSimulador agenteIAConfigId={agente!.agenteIAConfig!.id} />
                <div className="border-t border-white/8 pt-6">
                  <p className="text-stone-300 text-xs uppercase tracking-wide font-medium mb-3">
                    Comparar publicada vs. borrador
                  </p>
                  <ComparadorVersiones agenteIAConfigId={agente!.agenteIAConfig!.id} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab: Conocimiento (018-simulador-agente, Historia 4) — vista de
              solo lectura, sin campos editables nuevos (contracts/simulador.md). */}
          <TabsContent value="conocimiento" className="flex flex-col gap-5">
            <TituloGrupo titulo="Conocimiento del agente" descripcion="Resumen de solo lectura de lo que el agente sabe y puede usar. Se edita desde Configuración IA." />
            {!tieneConfigIA || !configIA ? (
              <p className="text-stone-500 text-sm text-center py-8">
                Activá primero el Agente Comercial IA para ver su conocimiento configurado.
              </p>
            ) : (
              <div className="flex flex-col gap-6 text-sm">
                <SeccionConfig Icono={ShieldAlert} titulo="Reglas personalizadas" descripcion="Instrucciones propias que guían el comportamiento del agente en todo momento.">
                  {((configIA.reglasPersonalizadas as string[] | null) ?? []).length === 0 ? (
                    <p className="text-stone-500 text-xs">Sin reglas personalizadas configuradas.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {((configIA.reglasPersonalizadas as string[] | null) ?? []).map((r, i) => (
                        <li key={i} className="text-stone-400 text-xs">- {r}</li>
                      ))}
                    </ul>
                  )}
                </SeccionConfig>

                <SeccionConfig Icono={MessageCircle} titulo="Frases preferidas y prohibidas" descripcion="Expresiones que debe usar y las que nunca debe decir.">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-stone-500 mb-1">Preferidas</p>
                      {((configIA.frasesPreferidas as string[] | null) ?? []).map((f, i) => <p key={i} className="text-stone-400">- {f}</p>)}
                    </div>
                    <div>
                      <p className="text-stone-500 mb-1">Prohibidas</p>
                      {((configIA.frasesProhibidas as string[] | null) ?? []).map((f, i) => <p key={i} className="text-stone-400">- {f}</p>)}
                    </div>
                  </div>
                </SeccionConfig>

                <SeccionConfig Icono={BookOpen} titulo="Respuestas guía y catálogo" descripcion="Formatos aprobados por tipo de consulta, y si el catálogo con precios viaja en el contexto.">
                  {((configIA.respuestasGuia as RespuestaGuiaInput[] | null) ?? []).filter((r) => r.activa).length === 0 ? (
                    <p className="text-stone-500 text-xs">Sin respuestas guía activas.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {((configIA.respuestasGuia as RespuestaGuiaInput[] | null) ?? [])
                        .filter((r) => r.activa)
                        .map((r) => (
                          <li key={r.id} className="text-stone-400 text-xs">
                            - [{INTENCIONES_RESPUESTA_GUIA[r.intencion]}] {r.cuandoAplica}
                          </li>
                        ))}
                    </ul>
                  )}
                  <p className="text-stone-500 text-xs mt-2">
                    Catálogo con precios: {configIA.catalogoEnContexto ? `activo (hasta ${configIA.limiteCatalogoContexto} productos)` : "desactivado"}
                  </p>
                </SeccionConfig>

                <SeccionConfig Icono={Wrench} titulo="Herramientas habilitadas" descripcion="Acciones comerciales que el agente puede ejecutar.">
                  {herramientasActivas.length === 0 ? (
                    <p className="text-stone-500 text-xs">Ninguna herramienta comercial habilitada todavía.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {herramientasActivas.map((h: string) => {
                        // El identificador técnico solo se muestra si no hay
                        // una herramienta conocida con ese nombre.
                        const def = HERRAMIENTAS_DISPONIBLES.find((d) => d.nombre === h);
                        const Icono = def?.Icono;
                        return (
                          <li key={h} className="flex items-center gap-2 text-xs text-stone-300">
                            {Icono && <Icono className="h-3.5 w-3.5 shrink-0 text-lime-400" />}
                            <span className="font-medium">{def?.label ?? h}</span>
                            {def && <span className="truncate text-stone-500">· {def.descripcion}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SeccionConfig>

                <SeccionConfig Icono={Layers} titulo="Datos operativos siempre disponibles" descripcion="Consultas de solo lectura que el agente puede hacer sin habilitarlas (015).">
                  <div className="flex flex-wrap gap-1.5">
                    {HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES.map((h) => (
                      <span key={h} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-stone-500">{h}</span>
                    ))}
                  </div>
                </SeccionConfig>
              </div>
            )}
          </TabsContent>
          </div>
        </Tabs>

        {/* ── Pie fijo ── Guarda la sección abierta: General y Configuración IA
            tienen cada una su formulario, igual que antes. El resto de
            secciones guardan con sus propios controles internos. */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/8 px-5 py-3.5">
          <p className="hidden text-xs text-stone-500 sm:block">
            {seccion === "general"
              ? "Nombre y descripción del agente."
              : seccion === "ia"
                ? "Publica los cambios o guárdalos como borrador para probarlos antes."
                : "Esta sección se guarda con sus propios controles."}
          </p>

          <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCerrar}
              className="rounded-xl border-white/10 bg-white/5 text-stone-300 hover:bg-white/10"
            >
              Cancelar
            </Button>

            {seccion === "ia" && tieneConfigIA && !cargandoConfig && (
              <Button
                type="button"
                variant="outline"
                disabled={isPendingBorrador}
                onClick={formIA.handleSubmit(onSubmitBorrador)}
                className="rounded-xl border-white/10 bg-white/5 text-stone-300 hover:bg-white/10"
              >
                {isPendingBorrador ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar como borrador"}
              </Button>
            )}

            {(seccion === "general" || (seccion === "ia" && tieneConfigIA && !cargandoConfig)) && (
              <Button
                type="button"
                disabled={seccion === "general" ? isPendingBasico : isPendingIA}
                onClick={
                  seccion === "general"
                    ? formBasico.handleSubmit(onSubmitBasico)
                    : formIA.handleSubmit(onSubmitIA)
                }
                className="rounded-xl bg-lime-500/90 font-semibold text-stone-950 shadow-lg transition-all hover:bg-lime-400"
              >
                {(seccion === "general" ? isPendingBasico : isPendingIA) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
