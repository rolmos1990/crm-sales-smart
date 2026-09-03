"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { guardarCondicionesTransportista } from "../condiciones/actions";
import { CondicionesTransportistaSchema, type CondicionesTransportistaInput } from "../condiciones/schema";
import type { CondicionesTransportista } from "../types";

interface SeccionCondicionesTransportistaProps {
  transportistaId: string;
  transportistaNombre: string;
  condiciones: CondicionesTransportista | null;
  puedeModificar: boolean;
}

const DIAS = [
  { valor: "LUN", etiqueta: "Lun" },
  { valor: "MAR", etiqueta: "Mar" },
  { valor: "MIE", etiqueta: "Mié" },
  { valor: "JUE", etiqueta: "Jue" },
  { valor: "VIE", etiqueta: "Vie" },
  { valor: "SAB", etiqueta: "Sáb" },
  { valor: "DOM", etiqueta: "Dom" },
] as const;

function valoresIniciales(transportistaId: string, condiciones: CondicionesTransportista | null): CondicionesTransportistaInput {
  return {
    transportistaId,
    diasEntrega: (condiciones?.diasEntrega as string[] | undefined)?.length
      ? ((condiciones!.diasEntrega as CondicionesTransportistaInput["diasEntrega"]))
      : ["LUN", "MAR", "MIE", "JUE", "VIE"],
    horaLimiteMismoDia: condiciones?.horaLimiteMismoDia ?? "",
    tiempoPreparacionDias: condiciones?.tiempoPreparacionDias ?? 0,
    permiteEntregaMismoDia: condiciones?.permiteEntregaMismoDia ?? true,
    pesoMaximoKg: condiciones?.pesoMaximoKg != null ? Number(condiciones.pesoMaximoKg) : undefined,
    requiereDireccionCompleta: condiciones?.requiereDireccionCompleta ?? true,
    permiteArticulosFragiles: condiciones?.permiteArticulosFragiles ?? true,
    permitePagoContraEntrega: condiciones?.permitePagoContraEntrega ?? false,
    observaciones: condiciones?.observaciones ?? "",
    metodoPagoTransportista: condiciones?.metodoPagoTransportista ?? "",
    frecuenciaFacturacion: condiciones?.frecuenciaFacturacion ?? "",
    responsableCoordinacion: condiciones?.responsableCoordinacion ?? "",
    instruccionesCoordinacion: condiciones?.instruccionesCoordinacion ?? "",
  };
}

// 022-transportistas-zonas-tarifas (Historia 4, T050-T053, completada) —
// reemplaza el <dl> de solo lectura por un formulario editable, organizado
// en los 3 bloques ya definidos en el diseño original de la pestaña:
// Operación / Restricciones / Cobro y coordinación.
export function SeccionCondicionesTransportista({ transportistaId, transportistaNombre, condiciones, puedeModificar }: SeccionCondicionesTransportistaProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CondicionesTransportistaInput>({
    resolver: zodResolver(CondicionesTransportistaSchema),
    defaultValues: valoresIniciales(transportistaId, condiciones),
  });

  const diasSeleccionados = form.watch("diasEntrega");

  function toggleDia(dia: (typeof DIAS)[number]["valor"]) {
    const actuales = form.getValues("diasEntrega");
    form.setValue(
      "diasEntrega",
      actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia],
      { shouldDirty: true },
    );
  }

  const onSubmit = (valores: CondicionesTransportistaInput) => {
    startTransition(async () => {
      const resultado = await guardarCondicionesTransportista(valores);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Condiciones actualizadas");
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 max-w-xl">
        <fieldset disabled={!puedeModificar || isPending} className="flex flex-col gap-6">
          {/* Operación */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Operación</p>

            <FormField
              control={form.control}
              name="diasEntrega"
              render={() => (
                <FormItem>
                  <FormLabel className="text-xs">Días de entrega</FormLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAS.map((d) => (
                      <Button
                        key={d.valor}
                        type="button"
                        size="sm"
                        variant={diasSeleccionados.includes(d.valor) ? "default" : "outline"}
                        className="h-7 w-12 text-xs px-0"
                        onClick={() => toggleDia(d.valor)}
                      >
                        {d.etiqueta}
                      </Button>
                    ))}
                  </div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="horaLimiteMismoDia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Hora límite mismo día</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: 11:00" maxLength={5} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tiempoPreparacionDias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Preparación (días)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="permiteEntregaMismoDia"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-2.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <span className="text-sm text-foreground">Permite entrega el mismo día</span>
                  </label>
                </FormItem>
              )}
            />
          </div>

          {/* Restricciones */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Restricciones</p>

            <FormField
              control={form.control}
              name="pesoMaximoKg"
              render={({ field }) => (
                <FormItem className="max-w-40">
                  <FormLabel className="text-xs">Peso máximo (kg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="Sin límite"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requiereDireccionCompleta"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-2.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <span className="text-sm text-foreground">Requiere dirección completa</span>
                  </label>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permiteArticulosFragiles"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-2.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <span className="text-sm text-foreground">Permite artículos frágiles</span>
                  </label>
                </FormItem>
              )}
            />
          </div>

          {/* Cobro y coordinación */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cobro y coordinación</p>

            <FormField
              control={form.control}
              name="permitePagoContraEntrega"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-2.5">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <span className="text-sm text-foreground">Acepta pago contra entrega</span>
                  </label>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="metodoPagoTransportista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Método de pago al transportista</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Transferencia" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frecuenciaFacturacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Frecuencia de facturación</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Quincenal" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="responsableCoordinacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Responsable de coordinación</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre o rol" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instruccionesCoordinacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Instrucciones de coordinación</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Cómo coordinar retiros/entregas con este transportista..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Observaciones</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Notas internas sobre este transportista..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        {puedeModificar && (
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Estas condiciones se aplicarán al crear cotizaciones y pedidos con {transportistaNombre}.
        </p>
      </form>
    </Form>
  );
}
