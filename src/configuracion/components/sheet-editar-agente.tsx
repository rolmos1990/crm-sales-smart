"use client";

import { useState, useTransition, useEffect } from "react";
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
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { editarUsuario } from "@/configuracion/usuarios/actions";
import { guardarAgenteIA, cargarConfigAgenteIA } from "@/configuracion/ia/agente-actions";
import { EditarUsuarioSchema, type EditarUsuarioInput } from "@/configuracion/usuarios/schema";
import {
  AgenteIAConfigSchema,
  type AgenteIAConfigInput,
  type ConfiguracionTonoInput,
} from "@/configuracion/ia/agente-schema";
import type { UsuarioInstanciaDetalle } from "@/configuracion/usuarios/types";

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

const TONOS = ["Cálido", "Profesional", "Directo", "Empático", "Entusiasta"] as const;
const FORMALIDADES = ["Formal", "Semi Formal", "Informal"] as const;

interface SheetEditarAgenteProps {
  agente: UsuarioInstanciaDetalle | null;
  onCerrar: () => void;
  onExito: () => void;
}

type ConfigCargada = Awaited<ReturnType<typeof cargarConfigAgenteIA>>;

export function SheetEditarAgente({ agente, onCerrar, onExito }: SheetEditarAgenteProps) {
  const [isPendingBasico, startBasico] = useTransition();
  const [isPendingIA, startIA] = useTransition();
  const [configIA, setConfigIA] = useState<ConfigCargada>(null);
  const [cargandoConfig, setCargandoConfig] = useState(false);
  const [activandoIA, startActivar] = useTransition();
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false);

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
    },
  });

  const canalesActivos = formIA.watch("canalesPermitidos") ?? [];
  const herramientasActivas = formIA.watch("herramientas") ?? [];
  const configuracionTono = formIA.watch("configuracionTono");

  useEffect(() => {
    if (!agente?.usuarioId || !agente.agenteIAConfig) return;

    setCargandoConfig(true);
    cargarConfigAgenteIA(agente.usuarioId)
      .then((config) => {
        setConfigIA(config);
        if (config) {
          formIA.reset({
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

  function handleActivarIA() {
    if (!agente) return;
    startActivar(async () => {
      const resultado = await guardarAgenteIA(agente.usuarioId, {
        memoriaHabilitada: true,
        limiteTokensCtx: 4000,
        canalesPermitidos: null,
        temperaturaOverride: null,
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
    <Sheet open={!!agente} onOpenChange={handleCerrar}>
      <SheetContent className="bg-stone-950/98 border-white/10 w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-stone-50">
            <Bot className="h-5 w-5 text-purple-400" />
            {agente?.nombre ?? "Agente"}
          </SheetTitle>
          <SheetDescription className="text-stone-500 text-xs">{agente?.email}</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="general" className="flex flex-col gap-4">
          <TabsList className="bg-white/5 border border-white/10 w-fit">
            <TabsTrigger
              value="general"
              className="data-[state=active]:bg-stone-800 data-[state=active]:text-stone-50 text-stone-400 gap-1.5"
            >
              <Settings2 className="h-3.5 w-3.5" />
              General
            </TabsTrigger>
            <TabsTrigger
              value="ia"
              className="data-[state=active]:bg-stone-800 data-[state=active]:text-stone-50 text-stone-400 gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Configuración IA
              {tieneConfigIA && (
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400 ml-1" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: General */}
          <TabsContent value="general">
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

                <Button
                  type="submit"
                  disabled={isPendingBasico}
                  className="self-end rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
                >
                  {isPendingBasico ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
                </Button>
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
                <form onSubmit={formIA.handleSubmit(onSubmitIA)} className="flex flex-col gap-6">

                  {/* ── Sección: Objetivo ── */}
                  <FormField
                    control={formIA.control}
                    name="objetivo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Objetivo del agente</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ayudar al cliente a encontrar el producto ideal y cerrar la venta"
                            className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* ── Sección: Capacidades ── */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">Capacidades</p>
                      <p className="text-stone-500 text-xs mt-0.5">Qué acciones puede ejecutar el agente</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {HERRAMIENTAS_DISPONIBLES.map(({ nombre, label, descripcion, Icono }) => {
                        const activo = herramientasActivas.includes(nombre);
                        return (
                          <button
                            key={nombre}
                            type="button"
                            onClick={() => toggleHerramienta(nombre)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                              activo
                                ? "bg-lime-500/10 border-lime-500/25 text-lime-300"
                                : "bg-white/3 border-white/8 text-stone-400 hover:border-white/15 hover:text-stone-300",
                            )}
                          >
                            <div className={cn(
                              "p-1.5 rounded-lg flex-shrink-0",
                              activo ? "bg-lime-500/20" : "bg-white/5",
                            )}>
                              <Icono className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-none">{label}</p>
                              <p className="text-xs text-stone-500 mt-0.5">{descripcion}</p>
                            </div>
                            {activo
                              ? <CheckSquare className="h-4 w-4 text-lime-400 flex-shrink-0" />
                              : <Square className="h-4 w-4 text-stone-600 flex-shrink-0" />
                            }
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Sección: Tono ── */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-stone-300 text-xs uppercase tracking-wide font-medium">Tono de conversación</p>
                      <p className="text-stone-500 text-xs mt-0.5">Cómo se expresa el agente al hablar</p>
                    </div>

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
                  </div>

                  {/* ── Sección: Canales ── */}
                  <FormField
                    control={formIA.control}
                    name="canalesPermitidos"
                    render={() => (
                      <FormItem>
                        <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Canales donde actúa</FormLabel>
                        <FormDescription className="text-stone-500 text-xs">Vacío = actúa en todos</FormDescription>
                        <div className="flex flex-wrap gap-2 mt-2">
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

                  {/* ── Sección: Memoria ── */}
                  <FormField
                    control={formIA.control}
                    name="memoriaHabilitada"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                        <div>
                          <FormLabel className="text-stone-200 text-sm">Memoria habilitada</FormLabel>
                          <FormDescription className="text-stone-500 text-xs">
                            El agente recuerda contexto de conversaciones anteriores
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

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

                  <Button
                    type="submit"
                    disabled={isPendingIA}
                    className="self-end rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
                  >
                    {isPendingIA ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar configuración IA"}
                  </Button>
                </form>
              </Form>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
