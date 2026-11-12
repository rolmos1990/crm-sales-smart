"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Bot, Loader2, Sparkles, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { crearAgenteConIA, crearUsuario } from "@/configuracion/usuarios/actions";
import { CrearUsuarioSchema, type CrearUsuarioInput } from "@/configuracion/usuarios/schema";
import type { AgenteIAConfigInput } from "@/configuracion/ia/agente-schema";
import {
  PLANTILLAS_AGENTE,
  TIPO_AGENTE_POR_DEFECTO,
  TIPOS_AGENTE_SELECCIONABLES,
  plantillaDeTipo,
} from "@/configuracion/ia/plantillas-agente";
import type { TipoAgenteIA } from "@/generated/prisma/enums";

// Etiquetas del <Select>: su value (COMERCIAL) no coincide con lo que se ve
// ("Agente de Ventas"), así que el Select necesita `items` — ver docs/selects.md.
const ETIQUETAS_TIPO = Object.fromEntries(
  TIPOS_AGENTE_SELECCIONABLES.map((t) => [t, PLANTILLAS_AGENTE[t].etiqueta]),
);

interface DialogNuevoAgenteProps {
  abierto: boolean;
  onCerrar: () => void;
  onExito: () => void;
}

export function DialogNuevoAgente({ abierto, onCerrar, onExito }: DialogNuevoAgenteProps) {
  const [isPending, startTransition] = useTransition();
  const [esAgenteComercial, setEsAgenteComercial] = useState(false);
  const [tipoAgente, setTipoAgente] = useState<TipoAgenteIA>(TIPO_AGENTE_POR_DEFECTO);

  const formUsuario = useForm<CrearUsuarioInput>({
    resolver: zodResolver(CrearUsuarioSchema),
    defaultValues: { nombre: "", email: "", tipo: "AGENTE", rol: "AGENTE", cargo: "", telefono: "" },
  });

  const formIA = useForm<Partial<AgenteIAConfigInput>>({
    defaultValues: {
      objetivo: "",
      personalidad: "",
      especialidad: "",
      instruccionesAgente: plantillaDeTipo(TIPO_AGENTE_POR_DEFECTO).instrucciones,
      memoriaHabilitada: true,
      limiteTokensCtx: 4000,
    },
  });

  // Cambiar de tipo reescribe las instrucciones: cada tipo trae su plantilla y
  // mezclar dos no tendría sentido.
  function cambiarTipo(tipo: TipoAgenteIA) {
    setTipoAgente(tipo);
    formIA.setValue("instruccionesAgente", plantillaDeTipo(tipo).instrucciones);
  }

  function handleCerrar() {
    formUsuario.reset();
    formIA.reset();
    setEsAgenteComercial(false);
    setTipoAgente(TIPO_AGENTE_POR_DEFECTO);
    onCerrar();
  }

  function onSubmit(datosUsuario: CrearUsuarioInput) {
    startTransition(async () => {
      const base = { ...datosUsuario, tipo: "AGENTE" as const, rol: "AGENTE" as const };

      let resultado;
      if (esAgenteComercial) {
        const configIA = formIA.getValues();
        resultado = await crearAgenteConIA(
          base,
          {
            objetivo: configIA.objetivo || undefined,
            personalidad: configIA.personalidad || undefined,
            especialidad: configIA.especialidad || undefined,
            instruccionesAgente: configIA.instruccionesAgente || undefined,
            memoriaHabilitada: configIA.memoriaHabilitada ?? true,
            limiteTokensCtx: configIA.limiteTokensCtx ?? 4000,
            temperaturaOverride: null,
            canalesPermitidos: null,
          },
          tipoAgente,
        );
      } else {
        resultado = await crearUsuario(base);
      }

      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Agente creado correctamente");
      handleCerrar();
      onExito();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent
        className={cn(
          "bg-stone-950/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] p-0 ring-0",
          esAgenteComercial
            ? "w-[820px] sm:max-w-[820px] max-w-[calc(100vw-2rem)]"
            : "w-full sm:max-w-md",
        )}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/8">
          <DialogTitle className="flex items-center gap-2.5 text-stone-50">
            <div className={cn(
              "flex items-center justify-center h-7 w-7 rounded-lg border",
              esAgenteComercial
                ? "bg-lime-500/15 border-lime-500/30"
                : "bg-purple-500/15 border-purple-500/30",
            )}>
              {esAgenteComercial
                ? <Sparkles className="h-3.5 w-3.5 text-lime-400" />
                : <Bot className="h-3.5 w-3.5 text-purple-400" />
              }
            </div>
            Nuevo agente
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto max-h-[85vh]">
          {/* Selector tipo — segmented control compacto */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setEsAgenteComercial(false)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                !esAgenteComercial
                  ? "bg-stone-800 text-stone-50 shadow-sm"
                  : "text-stone-500 hover:text-stone-300",
              )}
            >
              <Bot className="h-3.5 w-3.5" />
              Solo bot
            </button>
            <button
              type="button"
              onClick={() => setEsAgenteComercial(true)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                esAgenteComercial
                  ? "bg-lime-500/90 text-stone-950 shadow-sm"
                  : "text-stone-500 hover:text-stone-300",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Agente Comercial IA
            </button>
          </div>

          {/* Descripción del tipo seleccionado */}
          <p className="text-xs text-stone-500 -mt-2">
            {esAgenteComercial
              ? "Este agente usará IA para responder conversaciones automáticamente según su configuración."
              : "Un agente del sistema que puede asignarse a tareas y conversaciones sin necesitar login."}
          </p>

          <Form {...formUsuario}>
            <form onSubmit={formUsuario.handleSubmit(onSubmit)} className="flex flex-col gap-5">
              {/* Layout: una columna normal o dos columnas IA */}
              <div className={cn(
                "gap-6",
                esAgenteComercial ? "grid grid-cols-2" : "flex flex-col",
              )}>

                {/* Columna izquierda — siempre visible */}
                <div className="flex flex-col gap-4">
                  {esAgenteComercial && (
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-500">
                      Datos del agente
                    </p>
                  )}

                  <FormField
                    control={formUsuario.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-stone-300">Nombre</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ej: Bot de ventas"
                            className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-600"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formUsuario.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-stone-300">Email interno</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="bot@empresa.com"
                            className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-600"
                          />
                        </FormControl>
                        <FormDescription className="text-stone-600 text-xs">
                          Solo como identificador, no recibe correos
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={formUsuario.control}
                    name="cargo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-stone-300">
                          Descripción{" "}
                          <span className="text-stone-600 font-normal">(opcional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ej: Asistente de atención al cliente"
                            className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-600"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Columna derecha — solo si Agente Comercial IA */}
                {esAgenteComercial && (
                  <div className="flex flex-col gap-4 pl-6 border-l border-white/8">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-lime-500/80">
                      Configuración IA
                    </p>

                    <FormItem>
                      <FormLabel className="text-stone-300">Tipo de agente</FormLabel>
                      <Select
                        items={ETIQUETAS_TIPO}
                        value={tipoAgente}
                        onValueChange={(v) => v && cambiarTipo(v as TipoAgenteIA)}
                      >
                        <SelectTrigger className="w-full bg-white/5 border-white/10 text-stone-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_AGENTE_SELECCIONABLES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {PLANTILLAS_AGENTE[t].etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-stone-600 text-xs">
                        {plantillaDeTipo(tipoAgente).descripcion}
                      </FormDescription>
                    </FormItem>

                    <FormField
                      control={formIA.control}
                      name="objetivo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-stone-300">Objetivo principal</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ej: Cerrar ventas y resolver dudas de productos"
                              className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-600"
                            />
                          </FormControl>
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
                            <FormLabel className="text-stone-300">Personalidad</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="profesional y amigable"
                                className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-600 text-sm"
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
                            <FormLabel className="text-stone-300">Especialidad</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="ventas B2B, soporte…"
                                className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-600 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={formIA.control}
                      name="instruccionesAgente"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-stone-300">Instrucciones del agente</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value ?? ""}
                              rows={10}
                              className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-600 font-mono text-xs leading-relaxed"
                            />
                          </FormControl>
                          <FormDescription className="text-stone-600 text-xs">
                            Rol, estilo y proceso de atención. Vienen de la plantilla del tipo; edítalas
                            ahora o después desde la configuración del agente.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-white/8 mt-1">
                {esAgenteComercial ? (
                  <div className="flex items-center gap-1.5 text-stone-500">
                    <Zap className="h-3 w-3 text-lime-500" />
                    <span className="text-xs">Se creará con IA activa</span>
                  </div>
                ) : (
                  <span />
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCerrar}
                    className="border-white/10 bg-white/5 hover:bg-white/8 text-stone-300 rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className={cn(
                      "rounded-xl shadow-lg transition-all hover:scale-[1.02] font-semibold gap-1.5",
                      esAgenteComercial
                        ? "bg-lime-500/90 text-stone-950 hover:bg-lime-400"
                        : "bg-purple-500/90 text-stone-50 hover:bg-purple-400",
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {esAgenteComercial && <Sparkles className="h-3.5 w-3.5" />}
                        {esAgenteComercial ? "Crear Agente Comercial IA" : "Crear agente"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
