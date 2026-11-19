"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useSesion } from "@/shared/auth/sesion-context";
import { guardarInterruptoresAnalisisAction } from "@/crm/contactos/analisis/configuracion/actions";
import {
  InterruptoresAnalisisSchema,
  type InterruptoresAnalisis,
} from "@/crm/contactos/analisis/configuracion/schema";

/**
 * 042 (FR-030a) — Los dos controles que el administrador necesita desde el
 * primer día en que la IA analiza contactos: apagarla y pausar la
 * clasificación de los contactos que ya existían.
 */
export function InterruptoresAnalisis({ inicial }: { inicial: InterruptoresAnalisis }) {
  const { puedeModificar } = useSesion();
  const editable = puedeModificar("ia");
  const [guardando, iniciar] = useTransition();

  const form = useForm<InterruptoresAnalisis>({
    resolver: zodResolver(InterruptoresAnalisisSchema),
    defaultValues: inicial,
  });

  const guardar = (datos: InterruptoresAnalisis) =>
    iniciar(async () => {
      const r = await guardarInterruptoresAnalisisAction(datos);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      form.reset(datos);
      toast.success("Configuración del análisis guardada");
    });

  return (
    <Form {...form}>
      <form data-slot="interruptores-analisis" onSubmit={form.handleSubmit(guardar)} className="flex flex-col gap-3">
        <FormField
          control={form.control}
          name="habilitado"
          render={({ field }) => (
            <FormItem className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-1">
                <FormLabel className="text-foreground">Analizar contactos con IA</FormLabel>
                <FormDescription>
                  Interpreta las conversaciones para estimar la intención de compra y sugerir la próxima acción. Usa los
                  proveedores de IA de esta cuenta: el consumo corre por tu cuenta. Apagado, los contactos se siguen
                  analizando solo con reglas, sin costo.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!editable} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="historicoPausado"
          render={({ field }) => (
            <FormItem className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-1">
                <FormLabel className="text-foreground">Pausar la clasificación inicial</FormLabel>
                <FormDescription>
                  Detiene el análisis de los contactos que ya existían. Los contactos con mensajes o pedidos nuevos se
                  siguen analizando.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!editable} />
              </FormControl>
            </FormItem>
          )}
        />
        {editable && (
          <div>
            <Button type="submit" size="sm" disabled={guardando || !form.formState.isDirty}>
              {guardando && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Guardar
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
