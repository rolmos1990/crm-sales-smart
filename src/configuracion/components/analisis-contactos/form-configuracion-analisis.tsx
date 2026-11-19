"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useSesion } from "@/shared/auth/sesion-context";
import { guardarConfiguracionAnalisisAction } from "@/crm/contactos/analisis/configuracion/actions";
import { ConfiguracionAnalisisSchema, type ConfiguracionAnalisis } from "@/crm/contactos/analisis/configuracion/schema";

/**
 * 042 (Historia 6, FR-050a) — Parámetros del análisis de la cuenta. Los
 * interruptores (activar / pausar) viven en su propio formulario y no se
 * repiten acá.
 */

const MODOS = [
  { valor: "SOLO_SUGERIR", etiqueta: "Solo sugerir", ayuda: "La IA propone un nivel de interés y una persona lo acepta o lo descarta." },
  { valor: "APLICAR_AUTOMATICO", etiqueta: "Aplicar automáticamente", ayuda: "La IA cambia el nivel de interés, salvo que alguien lo haya fijado a mano." },
] as const;
const ITEMS_MODO = Object.fromEntries(MODOS.map((m) => [m.valor, m.etiqueta]));

// En el formulario el presupuesto vacío es "", y la ventana se edita en minutos.
const FormularioSchema = z.object({
  modoInteres: z.enum(["SOLO_SUGERIR", "APLICAR_AUTOMATICO"]),
  mesesAntiguedadInicial: z.coerce.number().int().min(1).max(60),
  tamanoLote: z.coerce.number().int().min(1).max(50),
  maxLotesSimultaneos: z.coerce.number().int().min(1).max(10),
  presupuestoDiarioCosto: z.string(),
  presupuestoDiarioTokens: z.string(),
  ventanaMin: z.coerce.number().int().min(0).max(60),
  esperaMaximaMin: z.coerce.number().int().min(0).max(24 * 60),
});
type Formulario = z.input<typeof FormularioSchema>;

const opcional = (v: string) => (v.trim() === "" ? null : Number(v));

export function FormConfiguracionAnalisis({ inicial }: { inicial: ConfiguracionAnalisis }) {
  const { puedeModificar } = useSesion();
  const editable = puedeModificar("ia");
  const [guardando, iniciar] = useTransition();

  const form = useForm<Formulario, unknown, z.output<typeof FormularioSchema>>({
    resolver: zodResolver(FormularioSchema),
    defaultValues: {
      modoInteres: inicial.modoInteres,
      mesesAntiguedadInicial: inicial.mesesAntiguedadInicial,
      tamanoLote: inicial.tamanoLote,
      maxLotesSimultaneos: inicial.maxLotesSimultaneos,
      presupuestoDiarioCosto: inicial.presupuestoDiarioCosto?.toString() ?? "",
      presupuestoDiarioTokens: inicial.presupuestoDiarioTokens?.toString() ?? "",
      ventanaMin: Math.round(inicial.ventanaAgrupacionSeg / 60),
      esperaMaximaMin: Math.round(inicial.esperaMaximaSeg / 60),
    },
  });

  const guardar = (f: z.output<typeof FormularioSchema>) =>
    iniciar(async () => {
      const datos = ConfiguracionAnalisisSchema.safeParse({
        habilitado: inicial.habilitado,
        historicoPausado: inicial.historicoPausado,
        modoInteres: f.modoInteres,
        mesesAntiguedadInicial: f.mesesAntiguedadInicial,
        tamanoLote: f.tamanoLote,
        maxLotesSimultaneos: f.maxLotesSimultaneos,
        presupuestoDiarioCosto: opcional(f.presupuestoDiarioCosto),
        presupuestoDiarioTokens: opcional(f.presupuestoDiarioTokens),
        ventanaAgrupacionSeg: f.ventanaMin * 60,
        esperaMaximaSeg: f.esperaMaximaMin * 60,
      });
      if (!datos.success) return void toast.error(datos.error.issues[0]?.message ?? "Datos inválidos");
      const r = await guardarConfiguracionAnalisisAction(datos.data);
      if (!r.exito) return void toast.error(r.error);
      form.reset(f);
      toast.success("Configuración del análisis guardada");
    });

  const numero = (name: keyof Formulario, etiqueta: string, ayuda: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{etiqueta}</FormLabel>
          <FormControl>
            <Input inputMode="numeric" {...field} value={String(field.value ?? "")} />
          </FormControl>
          <FormDescription>{ayuda}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const modo = form.watch("modoInteres");

  return (
    <Form {...form}>
      <form
        data-slot="form-configuracion-analisis"
        onSubmit={form.handleSubmit(guardar)}
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      >
        <fieldset disabled={!editable || guardando} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="modoInteres"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nivel de interés sugerido por la IA</FormLabel>
                <Select items={ITEMS_MODO} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <FormControl>
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MODOS.map((m) => (
                      <SelectItem key={m.valor} value={m.valor}>
                        {m.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {MODOS.find((m) => m.valor === modo)?.ayuda} Cambiar el modo no modifica los intereses que ya tienen tus contactos.
                </FormDescription>
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {numero("mesesAntiguedadInicial", "Antigüedad para la clasificación inicial", "Meses. Los contactos sin actividad en ese plazo se analizan solo con reglas.")}
            {numero("presupuestoDiarioCosto", "Presupuesto diario (US$)", "Vacío = sin presupuesto propio; aplican los límites de tus proveedores.")}
            {numero("presupuestoDiarioTokens", "Presupuesto diario (tokens)", "Se usa si tu proveedor no tiene tarifas cargadas.")}
            {numero("tamanoLote", "Contactos por lote", "Entre 1 y 50.")}
            {numero("maxLotesSimultaneos", "Lotes simultáneos", "Entre 1 y 10.")}
            {numero("ventanaMin", "Agrupar cambios durante", "Minutos. Varios mensajes seguidos se analizan una sola vez.")}
            {numero("esperaMaximaMin", "Espera máxima", "Minutos. Aunque sigan llegando mensajes, el contacto se analiza pasado este tiempo.")}
          </div>
        </fieldset>
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
