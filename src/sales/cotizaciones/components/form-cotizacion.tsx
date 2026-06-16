"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { SelectorProductoLinea } from "@/shared/productos/components/selector-producto-linea";
import { PhoneInput } from "@/components/ui/phone-input";
import type { ProductoCatalogo } from "@/shared/productos/types";
import { crearCotizacion, actualizarCotizacion } from "../actions";
import { CrearCotizacionSchema, type CrearCotizacionInput, type DestinatarioCotizacionInput } from "../schema";

interface FormCotizacionProps {
  contactos: OpcionCombobox[];
  empresas: OpcionCombobox[];
  productos?: ProductoCatalogo[];
  oportunidadId?: string;
  cotizacionId?: string;
  defaultValues?: Partial<CrearCotizacionInput>;
  onSuccess?: () => void;
  /** Datos del contacto de la oportunidad para el toggle "Misma info del contacto" */
  contactoOrigen?: Partial<DestinatarioCotizacionInput>;
  /** Cuando viene del pipeline, el contacto ya está fijado y no se puede cambiar */
  contactoFijo?: boolean;
  /** Cuando viene del pipeline, la empresa ya está fijada y no se puede cambiar */
  empresaFija?: boolean;
  /** Moneda preferida de la instancia; se usa solo al crear */
  monedaDefault?: string;
}

const nv = (v: number | undefined | null): number | string =>
  v !== undefined && v !== null && !Number.isNaN(v) ? v : "";

const parseNum = (e: React.ChangeEvent<HTMLInputElement>): number =>
  Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber;

const tieneContactoOrigen = (c?: Partial<DestinatarioCotizacionInput>) =>
  !!(c?.nombre || c?.apellido || c?.telefono || c?.email);

export function FormCotizacion({
  contactos,
  empresas,
  productos = [],
  oportunidadId,
  cotizacionId,
  defaultValues,
  onSuccess,
  contactoOrigen,
  contactoFijo = false,
  empresaFija = false,
  monedaDefault = "PEN",
}: FormCotizacionProps) {
  const router = useRouter();
  const hayContactoOrigen = tieneContactoOrigen(contactoOrigen);

  const [mostrarCliente, setMostrarCliente] = useState(
    hayContactoOrigen ||
    !!(defaultValues?.destinatario?.nombre || defaultValues?.destinatario?.apellido ||
       defaultValues?.destinatario?.telefono || defaultValues?.destinatario?.email)
  );
  const [usarInfoContacto, setUsarInfoContacto] = useState(hayContactoOrigen);

  const modoEdicion = !!cotizacionId;

  const form = useForm<CrearCotizacionInput>({
    resolver: zodResolver(CrearCotizacionSchema),
    defaultValues: {
      estado: "BORRADOR",
      moneda: monedaDefault,
      impuesto: 18,
      notas: "",
      contactoId: "",
      empresaId: "",
      oportunidadId: oportunidadId ?? "",
      destinatario: { nombre: "", apellido: "", telefono: "", email: "" },
      lineas: [{ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 }],
      ...defaultValues,
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

  const handleToggleInfoContacto = (checked: boolean) => {
    setUsarInfoContacto(checked);
    if (checked && contactoOrigen) {
      form.setValue("destinatario.nombre", contactoOrigen.nombre ?? "");
      form.setValue("destinatario.apellido", contactoOrigen.apellido ?? "");
      form.setValue("destinatario.telefono", contactoOrigen.telefono ?? "");
      form.setValue("destinatario.email", contactoOrigen.email ?? "");
    }
  };

  const onSubmit = async (datos: CrearCotizacionInput) => {
    if (modoEdicion) {
      const resultado = await actualizarCotizacion(cotizacionId, datos);
      if (resultado.exito) {
        toast.success("Cotización actualizada correctamente");
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/sales/cotizaciones/${cotizacionId}`);
        }
      } else {
        toast.error(resultado.error);
      }
    } else {
      const resultado = await crearCotizacion(datos);
      if (resultado.exito) {
        toast.success("Cotización creada correctamente");
        if (onSuccess) {
          onSuccess();
        } else if (oportunidadId) {
          router.push(`/crm/oportunidades/${oportunidadId}`);
        } else {
          router.push("/sales/cotizaciones");
        }
      } else {
        toast.error(resultado.error);
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="moneda" render={({ field }) => (
            <FormItem>
              <FormLabel>Moneda</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? "PEN"}>
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
                  value={nv(field.value)}
                  onChange={(e) => field.onChange(parseNum(e))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="fechaVencimiento" render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha vencimiento</FormLabel>
              <FormControl>
                <SmartDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Selecciona fecha de vencimiento"
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
                <Combobox
                  opciones={empresas}
                  valor={field.value}
                  onChange={field.onChange}
                  placeholder="Seleccionar empresa..."
                  disabled={empresaFija}
                />
              </FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="contactoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Contacto</FormLabel>
              <FormControl>
                <Combobox
                  opciones={contactos}
                  valor={field.value}
                  onChange={field.onChange}
                  placeholder="Seleccionar contacto..."
                  disabled={contactoFijo}
                />
              </FormControl>
            </FormItem>
          )} />
        </div>

        {/* Sección Cliente */}
        <div className="rounded-lg border border-border">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-muted/40 transition-colors rounded-lg"
            onClick={() => setMostrarCliente(!mostrarCliente)}
          >
            <span className="flex items-center gap-2">
              <UserCircle2 className="h-4 w-4 text-muted-foreground" />
              Cliente
              <span className="text-xs text-muted-foreground font-normal">(datos para la cotización)</span>
            </span>
            {mostrarCliente ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {mostrarCliente && (
            <div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
              {/* Toggle "Misma información del contacto" */}
              {hayContactoOrigen && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={usarInfoContacto}
                    onChange={(e) => handleToggleInfoContacto(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 dark:border-white/20 text-lime-600 focus:ring-lime-500 accent-lime-500"
                  />
                  <span className="text-sm text-stone-600 dark:text-stone-400">
                    Usar información del contacto
                    {(contactoOrigen?.nombre || contactoOrigen?.apellido) && (
                      <span className="ml-1 font-medium text-stone-800 dark:text-stone-200">
                        ({[contactoOrigen.nombre, contactoOrigen.apellido].filter(Boolean).join(" ")})
                      </span>
                    )}
                  </span>
                </label>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="destinatario.nombre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Juan"
                        {...field}
                        value={field.value ?? ""}
                        disabled={usarInfoContacto && hayContactoOrigen}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="destinatario.apellido" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="García"
                        {...field}
                        value={field.value ?? ""}
                        disabled={usarInfoContacto && hayContactoOrigen}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="destinatario.telefono" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        disabled={usarInfoContacto && hayContactoOrigen}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="destinatario.email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="juan@email.com"
                        {...field}
                        value={field.value ?? ""}
                        disabled={usarInfoContacto && hayContactoOrigen}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
          )}
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
                        {productos.length > 0 && (
                          <SelectorProductoLinea
                            productos={productos}
                            productoId={lineas[idx]?.productoId ?? ""}
                            onSeleccionar={(p) => {
                              form.setValue(`lineas.${idx}.productoId`, p.id);
                              form.setValue(`lineas.${idx}.descripcion`, p.nombre);
                              form.setValue(`lineas.${idx}.precioUnitario`, p.precio);
                            }}
                            onLimpiar={() => {
                              form.setValue(`lineas.${idx}.productoId`, "");
                            }}
                          />
                        )}
                        <Input
                          placeholder="Producto o descripción..."
                          className="h-8 text-sm"
                          {...form.register(`lineas.${idx}.descripcion`)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number" min="0.01" step="0.01" className="h-8 text-sm text-right"
                          value={nv(lineas[idx]?.cantidad)}
                          onChange={(e) => form.setValue(`lineas.${idx}.cantidad`, parseNum(e))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number" min="0" step="0.01" className="h-8 text-sm text-right"
                          value={nv(lineas[idx]?.precioUnitario)}
                          onChange={(e) => form.setValue(`lineas.${idx}.precioUnitario`, parseNum(e))}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number" min="0" max="100" step="0.1" className="h-8 text-sm text-right"
                          value={nv(lineas[idx]?.descuento)}
                          onChange={(e) => form.setValue(`lineas.${idx}.descuento`, parseNum(e))}
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
              <Textarea placeholder="Condiciones, términos de pago..." rows={3} className="resize-none" {...field} value={field.value ?? ""} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => onSuccess ? onSuccess() : router.back()}>Cancelar</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? modoEdicion ? "Guardando..." : "Creando..."
              : modoEdicion ? "Guardar cambios" : "Crear cotización"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
