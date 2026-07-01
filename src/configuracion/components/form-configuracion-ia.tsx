"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { guardarConfiguracionIA } from "@/configuracion/ia/actions";
import { ConfiguracionIASchema, type ConfiguracionIAInput } from "@/configuracion/ia/schema";

interface FormConfiguracionIAProps {
  inicial: ConfiguracionIAInput | null;
}

export function FormConfiguracionIA({ inicial }: FormConfiguracionIAProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ConfiguracionIAInput>({
    resolver: zodResolver(ConfiguracionIASchema),
    defaultValues: {
      habilitado: inicial?.habilitado ?? false,
      modeloDefault: inicial?.modeloDefault ?? "claude-sonnet-4-6",
      temperaturaDefault: inicial?.temperaturaDefault ?? 0.7,
      limiteTokensDiarios: inicial?.limiteTokensDiarios ?? null,
      limiteTokensMensual: inicial?.limiteTokensMensual ?? null,
      fallbackHabilitado: inicial?.fallbackHabilitado ?? true,
    },
  });

  function onSubmit(datos: ConfiguracionIAInput) {
    startTransition(async () => {
      const resultado = await guardarConfiguracionIA(datos);
      if (!resultado.exito) {
        toast.error(resultado.error ?? "Error al guardar");
        return;
      }
      toast.success("Configuración IA guardada");
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <FormField
          control={form.control}
          name="habilitado"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
              <div>
                <FormLabel className="text-stone-50 text-sm font-medium">Activar IA</FormLabel>
                <FormDescription className="text-stone-400 text-xs mt-0.5">
                  Habilita el uso de inteligencia artificial en esta instancia
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="data-[state=checked]:bg-lime-500"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="modeloDefault"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">
                  Modelo por defecto
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="claude-sonnet-4-6"
                    className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="temperaturaDefault"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">
                  Temperatura (0–2)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    className="bg-white/5 border-white/10 text-stone-50"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="limiteTokensDiarios"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">
                  Límite tokens / día
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Sin límite"
                    className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="limiteTokensMensual"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-stone-300 text-xs uppercase tracking-wide">
                  Límite tokens / mes
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Sin límite"
                    className="bg-white/5 border-white/10 text-stone-50 placeholder:text-stone-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="fallbackHabilitado"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
              <div>
                <FormLabel className="text-stone-50 text-sm font-medium">Fallback automático</FormLabel>
                <FormDescription className="text-stone-400 text-xs mt-0.5">
                  Si el proveedor principal falla, usar el siguiente disponible
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="data-[state=checked]:bg-lime-500"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isPending}
          className="self-start rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02] font-semibold"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Guardar configuración
        </Button>
      </form>
    </Form>
  );
}
