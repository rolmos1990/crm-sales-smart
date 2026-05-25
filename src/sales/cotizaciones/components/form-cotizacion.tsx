"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { crearCotizacion } from "../actions";
import { CrearCotizacionSchema, type CrearCotizacionInput } from "../schema";

interface FormCotizacionProps {
  contactos: OpcionCombobox[];
  empresas: OpcionCombobox[];
}

export function FormCotizacion({ contactos, empresas }: FormCotizacionProps) {
  const router = useRouter();

  const form = useForm<CrearCotizacionInput>({
    resolver: zodResolver(CrearCotizacionSchema),
    defaultValues: {
      estado: "BORRADOR",
      moneda: "PEN",
      impuesto: 18,
      notas: "",
      contactoId: "",
      empresaId: "",
      lineas: [{ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineas" });

  const lineas = form.watch("lineas");
  const impuesto = form.watch("impuesto") ?? 18;
  const moneda = form.watch("moneda") ?? "PEN";

  const subtotal = lineas.reduce((acc, l) => {
    const base = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
    return acc + base * (1 - (l.descuento ?? 0) / 100);
  }, 0);
  const impuestoMonto = subtotal * (impuesto / 100);
  const total = subtotal + impuestoMonto;

  const onSubmit = async (datos: CrearCotizacionInput) => {
    const resultado = await crearCotizacion(datos);
    if (resultado.exito) {
      toast.success("Cotización creada correctamente");
      router.push("/sales/cotizaciones");
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="moneda" render={({ field }) => (
            <FormItem>
              <FormLabel>Moneda</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value ?? "PEN"}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="PEN">PEN (S/)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="impuesto" render={({ field }) => (
            <FormItem>
              <FormLabel>IGV (%)</FormLabel>
              <FormControl>
                <Input
                  type="number" min="0" max="100" step="0.1"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="fechaVencimiento" render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha vencimiento</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                />
              </FormControl>
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="empresaId" render={({ field }) => (
            <FormItem>
              <FormLabel>Empresa</FormLabel>
              <FormControl>
                <Combobox opciones={empresas} valor={field.value} onChange={field.onChange} placeholder="Seleccionar empresa..." />
              </FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="contactoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Contacto</FormLabel>
              <FormControl>
                <Combobox opciones={contactos} valor={field.value} onChange={field.onChange} placeholder="Seleccionar contacto..." />
              </FormControl>
            </FormItem>
          )} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Líneas de cotización</h3>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => append({ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 })}
            >
              <Plus className="h-4 w-4" />Agregar línea
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Descripción</th>
                  <th className="text-right px-3 py-2 font-medium w-20">Cant.</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Precio</th>
                  <th className="text-right px-3 py-2 font-medium w-20">Desc.%</th>
                  <th className="text-right px-3 py-2 font-medium w-28">Subtotal</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, idx) => {
                  const cantidad = lineas[idx]?.cantidad ?? 0;
                  const precio = lineas[idx]?.precioUnitario ?? 0;
                  const descuento = lineas[idx]?.descuento ?? 0;
                  const subLinea = cantidad * precio * (1 - descuento / 100);

                  return (
                    <tr key={field.id} className="border-t">
                      <td className="px-2 py-1.5">
                        <Input
                          placeholder="Producto o descripción..."
                          className="h-8 text-sm"
                          {...form.register(`lineas.${idx}.descripcion`)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number" min="0.01" step="0.01" className="h-8 text-sm text-right"
                          value={lineas[idx]?.cantidad ?? ""}
                          onChange={(e) => form.setValue(`lineas.${idx}.cantidad`, e.target.valueAsNumber)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number" min="0" step="0.01" className="h-8 text-sm text-right"
                          value={lineas[idx]?.precioUnitario ?? ""}
                          onChange={(e) => form.setValue(`lineas.${idx}.precioUnitario`, e.target.valueAsNumber)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number" min="0" max="100" step="0.1" className="h-8 text-sm text-right"
                          value={lineas[idx]?.descuento ?? ""}
                          onChange={(e) => form.setValue(`lineas.${idx}.descuento`, e.target.valueAsNumber)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {moneda} {subLinea.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          disabled={fields.length === 1}
                          onClick={() => remove(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="border-t bg-muted/30 px-3 py-3 flex flex-col items-end gap-1">
              <div className="flex gap-8 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{moneda} {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex gap-8 text-sm">
                <span className="text-muted-foreground">IGV ({impuesto}%)</span>
                <span className="tabular-nums">{moneda} {impuestoMonto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator className="my-1 w-52" />
              <div className="flex gap-8 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{moneda} {total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <FormField control={form.control} name="notas" render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea placeholder="Condiciones, términos de pago..." rows={3} className="resize-none" {...field} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creando..." : "Crear cotización"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
