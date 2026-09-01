"use client";

import { useTransition, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Zap, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { crearProveedorIA, actualizarProveedorIA } from "@/configuracion/ia/actions";
import { ProveedorIASchema, type ProveedorIAInput } from "@/configuracion/ia/schema";

const MODELOS_POR_PROVEEDOR: Record<string, string> = {
  ANTHROPIC: "claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-opus-4-8",
  OPENAI: "gpt-4o, gpt-4o-mini, gpt-4-turbo",
  GEMINI: "gemini-1.5-pro, gemini-1.5-flash",
  DEEPSEEK: "deepseek-chat, deepseek-reasoner, deepseek-v3, deepseek-v4, deepseek-r1, deepseek-coder",
  NVIDIA: "meta/llama-3.3-70b-instruct, deepseek-ai/deepseek-v4-pro, deepseek-ai/deepseek-r1, nvidia/llama-3.1-nemotron-70b-instruct, meta/llama-3.1-405b-instruct",
  LOCAL: "llama3, mistral",
};

// 021-alias-proveedores-ia — datos de un agente ya creado para precargar el
// formulario en modo edición (nunca incluye la API key: la Server Action no
// la devuelve al cliente — un apiKey vacío al editar significa "no cambiarla").
export interface ProveedorIAExistente {
  id: string;
  alias: string;
  proveedor: ProveedorIAInput["proveedor"];
  tipoAgenteIA: ProveedorIAInput["tipoAgenteIA"];
  baseUrl: string | null;
  modelosDisponibles: string;
  prioridad: number;
  limitePorMinuto: number | null;
  limitePorDia: number | null;
  timeoutMs: number;
  reintentosMax: number;
}

interface FormProveedorIAProps {
  abierto: boolean;
  onCerrar: () => void;
  onExito: () => void;
  proveedorExistente?: ProveedorIAExistente | null;
}

const VALORES_DEFECTO: ProveedorIAInput = {
  alias: "",
  proveedor: "ANTHROPIC",
  tipoAgenteIA: "COMERCIAL",
  apiKey: "",
  baseUrl: "",
  modelosDisponibles: MODELOS_POR_PROVEEDOR["ANTHROPIC"],
  prioridad: 1,
  timeoutMs: 30000,
  reintentosMax: 2,
  limitePorMinuto: null,
  limitePorDia: null,
};

function valoresDesdeExistente(p: ProveedorIAExistente): ProveedorIAInput {
  return {
    alias: p.alias,
    proveedor: p.proveedor,
    tipoAgenteIA: p.tipoAgenteIA,
    apiKey: "",
    baseUrl: p.baseUrl ?? "",
    modelosDisponibles: p.modelosDisponibles,
    prioridad: p.prioridad,
    timeoutMs: p.timeoutMs,
    reintentosMax: p.reintentosMax,
    limitePorMinuto: p.limitePorMinuto,
    limitePorDia: p.limitePorDia,
  };
}

export function FormProveedorIA({ abierto, onCerrar, onExito, proveedorExistente }: FormProveedorIAProps) {
  const [isPending, startTransition] = useTransition();
  const [mostrarApiKey, setMostrarApiKey] = useState(false);
  const modoEdicion = Boolean(proveedorExistente);

  const form = useForm<ProveedorIAInput>({
    resolver: zodResolver(ProveedorIASchema),
    defaultValues: proveedorExistente ? valoresDesdeExistente(proveedorExistente) : VALORES_DEFECTO,
  });

  // Recarga el formulario cada vez que se abre con un agente distinto (o en
  // modo creación), para no arrastrar valores de una edición anterior.
  useEffect(() => {
    if (!abierto) return;
    form.reset(proveedorExistente ? valoresDesdeExistente(proveedorExistente) : VALORES_DEFECTO);
  }, [abierto, proveedorExistente, form]);

  const proveedorSeleccionado = form.watch("proveedor");

  function handleProveedorChange(valor: string | null) {
    if (!valor) return;
    form.setValue("proveedor", valor as ProveedorIAInput["proveedor"]);
    form.setValue("modelosDisponibles", MODELOS_POR_PROVEEDOR[valor] ?? "");
  }

  function handleCerrar() {
    form.reset(VALORES_DEFECTO);
    onCerrar();
  }

  function onSubmit(datos: ProveedorIAInput) {
    startTransition(async () => {
      const resultado = modoEdicion
        ? await actualizarProveedorIA(proveedorExistente!.id, datos)
        : await crearProveedorIA(datos);
      if (!resultado.exito) {
        toast.error(resultado.error ?? (modoEdicion ? "Error al guardar los cambios" : "Error al crear proveedor"));
        return;
      }
      toast.success(modoEdicion ? "Agente actualizado" : "Proveedor IA agregado");
      form.reset(VALORES_DEFECTO);
      onExito();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent className="bg-stone-950/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-50">
            <Zap className="h-5 w-5 text-lime-400" />
            {modoEdicion ? "Editar agente IA" : "Agregar proveedor IA"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <FormField
              control={form.control}
              name="alias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Alias</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej: DeepSeek Ventas"
                      className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                    />
                  </FormControl>
                  <FormDescription className="text-stone-500 text-xs">
                    Único — así vas a identificar este agente en el enrutamiento por objetivo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="proveedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Proveedor</FormLabel>
                    <Select value={field.value} onValueChange={handleProveedorChange} disabled={modoEdicion}>
                      <FormControl>
                        <SelectTrigger className="bg-white/5 border-white/10 text-stone-50">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-stone-900 border-white/10">
                        {["ANTHROPIC", "OPENAI", "GEMINI", "DEEPSEEK", "NVIDIA", "LOCAL"].map((p) => (
                          <SelectItem key={p} value={p} className="text-stone-50 focus:bg-white/10">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {modoEdicion && (
                      <FormDescription className="text-stone-500 text-xs">
                        No se puede cambiar después de creado
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipoAgenteIA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Tipo de agente</FormLabel>
                    <Select
                      value={field.value ?? "general"}
                      onValueChange={(v: string | null) => field.onChange(v === "general" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white/5 border-white/10 text-stone-50">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-stone-900 border-white/10">
                        <SelectItem value="general" className="text-stone-50 focus:bg-white/10">General (fallback)</SelectItem>
                        <SelectItem value="COMERCIAL" className="text-stone-50 focus:bg-white/10">Comercial</SelectItem>
                        <SelectItem value="GERENCIA" className="text-stone-50 focus:bg-white/10">Gerencia</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-stone-500 text-xs">
                      Este proveedor actúa como gateway para ese tipo de agente
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prioridad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">
                      Prioridad (1–10)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="bg-white/5 border-white/10 text-stone-50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">
                    API Key{proveedorSeleccionado === "LOCAL" && <span className="text-stone-500 normal-case ml-1">(no requerida para LOCAL)</span>}
                  </FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupInput
                        {...field}
                        type={mostrarApiKey ? "text" : "password"}
                        placeholder={
                          modoEdicion
                            ? "Dejar vacío para no cambiarla"
                            : proveedorSeleccionado === "ANTHROPIC" ? "sk-ant-..." : proveedorSeleccionado === "OPENAI" ? "sk-..." : ""
                        }
                        className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 font-mono"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          size="icon-xs"
                          aria-label={mostrarApiKey ? "Ocultar API Key" : "Mostrar API Key"}
                          onClick={() => setMostrarApiKey((v) => !v)}
                        >
                          {mostrarApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </FormControl>
                  <FormDescription className="text-stone-500 text-xs">
                    {modoEdicion
                      ? "Se almacena de forma segura — dejar en blanco conserva la que ya está guardada"
                      : "Se almacena de forma segura y nunca se muestra después de guardar"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {proveedorSeleccionado === "LOCAL" && (
              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">URL del servidor</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="http://localhost:11434"
                        className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="modelosDisponibles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Modelos</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="modelo-1, modelo-2"
                      className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500 font-mono text-sm"
                    />
                  </FormControl>
                  <FormDescription className="text-stone-500 text-xs">
                    Separados por comas. El primero es el modelo por defecto de este proveedor.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timeoutMs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Timeout (ms)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="bg-white/5 border-white/10 text-stone-50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reintentosMax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">Reintentos</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="5"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="bg-white/5 border-white/10 text-stone-50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCerrar}
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-stone-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : modoEdicion ? "Guardar cambios" : "Agregar proveedor"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
