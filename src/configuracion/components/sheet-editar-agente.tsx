"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Bot, Loader2, Sparkles, Settings2, CheckSquare, Square } from "lucide-react";
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
import { AgenteIAConfigSchema, type AgenteIAConfigInput } from "@/configuracion/ia/agente-schema";
import type { UsuarioInstanciaDetalle } from "@/configuracion/usuarios/types";

const CANALES_DISPONIBLES = [
  { valor: "whatsapp_lite", etiqueta: "WhatsApp Lite" },
  { valor: "whatsapp_business", etiqueta: "WhatsApp Business" },
  { valor: "email", etiqueta: "Email" },
  { valor: "instagram", etiqueta: "Instagram" },
  { valor: "tiktok", etiqueta: "TikTok" },
  { valor: "web", etiqueta: "Chat Web" },
];

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
    },
  });

  const canalesActivos = formIA.watch("canalesPermitidos") ?? [];

  // Cargar la config IA cuando abre el sheet y el agente tiene config
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
            temperaturaOverride: config.temperaturaOverride as number | null ?? null,
            modeloPreferido: config.modeloPreferido ?? "",
            memoriaHabilitada: config.memoriaHabilitada,
            limiteTokensCtx: config.limiteTokensCtx,
            canalesPermitidos: config.canalesPermitidos as string[] | null ?? null,
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
                <form onSubmit={formIA.handleSubmit(onSubmitIA)} className="flex flex-col gap-5">
                  <FormField
                    control={formIA.control}
                    name="sistemaPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">System Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={5}
                            placeholder="Eres un asistente comercial de [Empresa]…"
                            className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 text-sm resize-none"
                          />
                        </FormControl>
                        <FormDescription className="text-stone-500 text-xs">
                          Define la personalidad, rol y límites del agente.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
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

                  <FormField
                    control={formIA.control}
                    name="objetivo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Objetivo</FormLabel>
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
