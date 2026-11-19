"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useSesion } from "@/shared/auth/sesion-context";
import {
  crearBorradorDesdePlantillaAction,
  guardarBorradorCriterioAction,
  publicarCriterioAction,
} from "@/crm/contactos/analisis/criterio/actions";
import type { CriterioParaEdicion } from "@/crm/contactos/analisis/criterio/queries";
import {
  CriterioContenidoSchema,
  LARGO_MAXIMO_INSTRUCCIONES,
  type CriterioContenido,
  type PlantillaCriterio,
} from "@/crm/contactos/analisis/criterio/schema";

/**
 * 042 (Historia 3) — Editor del criterio con el que la IA analiza los
 * contactos de la cuenta. Las listas se editan una por línea y los pesos en
 * porcentaje; al guardar se convierten al contenido validado por
 * `CriterioContenidoSchema` (la misma validación que hace el servidor).
 */

const PESOS = [
  ["compras", "Compras"],
  ["recencia", "Interacción reciente"],
  ["documentosAbiertos", "Cotizaciones y oportunidades abiertas"],
  ["actividadAgendada", "Actividad agendada"],
  ["esperaRespuesta", "Mensaje sin responder"],
] as const;

const FormularioSchema = z.object({
  instrucciones: z.string().max(LARGO_MAXIMO_INSTRUCCIONES),
  senalesCompra: z.string(),
  objecionesTipicas: z.string(),
  comprasRecurrente: z.coerce.number().int().min(2).max(50),
  diasInactivo: z.coerce.number().int().min(15).max(730),
  compras: z.coerce.number().min(0).max(100),
  recencia: z.coerce.number().min(0).max(100),
  documentosAbiertos: z.coerce.number().min(0).max(100),
  actividadAgendada: z.coerce.number().min(0).max(100),
  esperaRespuesta: z.coerce.number().min(0).max(100),
});
type Formulario = z.input<typeof FormularioSchema>;

const lineas = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

function aFormulario(c: CriterioContenido): Formulario {
  return {
    instrucciones: c.instrucciones,
    senalesCompra: c.senalesCompra.join("\n"),
    objecionesTipicas: c.objecionesTipicas.join("\n"),
    comprasRecurrente: c.umbrales.comprasRecurrente,
    diasInactivo: c.umbrales.diasInactivo,
    compras: Math.round(c.pesos.compras * 100),
    recencia: Math.round(c.pesos.recencia * 100),
    documentosAbiertos: Math.round(c.pesos.documentosAbiertos * 100),
    actividadAgendada: Math.round(c.pesos.actividadAgendada * 100),
    esperaRespuesta: Math.round(c.pesos.esperaRespuesta * 100),
  };
}

function aContenido(f: z.output<typeof FormularioSchema>) {
  return CriterioContenidoSchema.safeParse({
    instrucciones: f.instrucciones,
    senalesCompra: lineas(f.senalesCompra),
    objecionesTipicas: lineas(f.objecionesTipicas),
    umbrales: { comprasRecurrente: f.comprasRecurrente, diasInactivo: f.diasInactivo },
    pesos: {
      compras: f.compras / 100,
      recencia: f.recencia / 100,
      documentosAbiertos: f.documentosAbiertos / 100,
      actividadAgendada: f.actividadAgendada / 100,
      esperaRespuesta: f.esperaRespuesta / 100,
    },
  });
}

export function EditorCriterio({ criterio }: { criterio: CriterioParaEdicion }) {
  const router = useRouter();
  const { puedeModificar } = useSesion();
  const editable = puedeModificar("ia");
  const [pendiente, iniciar] = useTransition();
  const [plantilla, setPlantilla] = useState<PlantillaCriterio>(criterio.vigente.plantillaAplicada ?? "GENERAL");
  const [reevaluar, setReevaluar] = useState(false);

  const base = criterio.borrador?.contenido ?? criterio.publicada?.contenido ?? criterio.vigente.contenido;
  const form = useForm<Formulario, unknown, z.output<typeof FormularioSchema>>({
    resolver: zodResolver(FormularioSchema),
    defaultValues: aFormulario(base),
  });
  const valores = useWatch({ control: form.control });
  const sumaPesos = PESOS.reduce((s, [clave]) => s + Number(valores[clave] ?? 0), 0);
  const itemsPlantilla = Object.fromEntries(criterio.plantillas.map((p) => [p.clave, p.nombre]));

  const usarPlantilla = () =>
    iniciar(async () => {
      const r = await crearBorradorDesdePlantillaAction({ plantilla });
      if (!r.exito) return void toast.error(r.error);
      toast.success("Borrador creado a partir de la plantilla");
      router.refresh();
    });

  const guardar = (publicar: boolean) =>
    form.handleSubmit((f) =>
      iniciar(async () => {
        const contenido = aContenido(f);
        if (!contenido.success) return void toast.error(contenido.error.issues[0]?.message ?? "El criterio no es válido");
        const borrador = await guardarBorradorCriterioAction({ contenido: contenido.data });
        if (!borrador.exito) return void toast.error(borrador.error);
        if (!publicar) {
          toast.success("Borrador guardado");
          return router.refresh();
        }
        const r = await publicarCriterioAction({ versionId: borrador.datos.versionId, reevaluar });
        if (!r.exito) return void toast.error(r.error);
        toast.success(
          `Criterio publicado (versión ${r.datos.numero})` + (reevaluar ? ` · ${r.datos.reevaluados} contactos se reevaluarán` : ""),
        );
        router.refresh();
      }),
    )();

  return (
    <div data-slot="editor-criterio" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-foreground">Criterio de análisis</h4>
        <p className="text-xs text-muted-foreground">
          {criterio.publicada
            ? `Versión publicada ${criterio.publicada.numero}.`
            : "Se usa la plantilla General: todavía no publicaste un criterio propio."}
          {criterio.borrador ? " Hay un borrador sin publicar." : ""}
        </p>
      </div>

      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Plantilla por rubro</span>
            <Select items={itemsPlantilla} value={plantilla} onValueChange={(v) => v && setPlantilla(v as PlantillaCriterio)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {criterio.plantillas.map((p) => (
                  <SelectItem key={p.clave} value={p.clave}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={pendiente} onClick={usarPlantilla}>
            Usar plantilla
          </Button>
        </div>
      )}

      <Form {...form}>
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <fieldset disabled={!editable || pendiente} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="instrucciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instrucciones del negocio</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Ej.: vendemos materiales de construcción a maestros de obra…" {...field} />
                  </FormControl>
                  <FormDescription>
                    Cómo interpretar a tus contactos. No cambia el formato del análisis ni las reglas de Karia.{" "}
                    {String(valores.instrucciones ?? "").length}/{LARGO_MAXIMO_INSTRUCCIONES}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="senalesCompra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Señales de compra</FormLabel>
                    <FormControl>
                      <Textarea rows={5} {...field} />
                    </FormControl>
                    <FormDescription>Una por línea, hasta 15.</FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="objecionesTipicas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objeciones típicas</FormLabel>
                    <FormControl>
                      <Textarea rows={5} {...field} />
                    </FormControl>
                    <FormDescription>Una por línea, hasta 15.</FormDescription>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="comprasRecurrente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente recurrente desde</FormLabel>
                    <FormControl>
                      <Input type="number" min={2} max={50} {...field} value={String(field.value ?? "")} />
                    </FormControl>
                    <FormDescription>compras confirmadas</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="diasInactivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente inactivo después de</FormLabel>
                    <FormControl>
                      <Input type="number" min={15} max={730} {...field} value={String(field.value ?? "")} />
                    </FormControl>
                    <FormDescription>días sin comprar</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Peso de cada factor en el puntaje</span>
              <div className="grid gap-3 sm:grid-cols-5">
                {PESOS.map(([clave, etiqueta]) => (
                  <FormField
                    key={clave}
                    control={form.control}
                    name={clave}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{etiqueta}</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={100} {...field} value={String(field.value ?? "")} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <p className={sumaPesos === 100 ? "text-xs text-muted-foreground" : "text-xs text-danger-text"}>
                Suma: {sumaPesos}% {sumaPesos === 100 ? "" : "— tiene que dar 100%"}
              </p>
            </div>
          </fieldset>

          {editable && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button type="button" size="sm" variant="outline" disabled={pendiente} onClick={() => guardar(false)}>
                Guardar borrador
              </Button>
              <Button type="button" size="sm" disabled={pendiente || sumaPesos !== 100} onClick={() => guardar(true)}>
                {pendiente && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                Publicar
              </Button>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={reevaluar} onCheckedChange={(v) => setReevaluar(v === true)} />
                Reevaluar contactos con el nuevo criterio
              </label>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
