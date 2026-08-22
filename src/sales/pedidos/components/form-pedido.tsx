"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
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
import { crearPedido, editarPedido } from "../actions";
import { EditarPedidoSchema, type EditarPedidoInput } from "../schema";

export interface PedidoParaEdicion {
  id: string;
  moneda: string | null;
  impuesto: number | null;
  notas: string | null;
  fechaEntrega: Date | null;
  fechaExpiracion: Date | null;
  contactoId: string | null;
  empresaId: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  ruc: string | null;
  empresaNombre: string | null;
  lineas: Array<{
    id: string;
    productoId: string | null;
    descripcion: string | null;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
  }>;
}

interface FormPedidoProps {
  contactos: OpcionCombobox[];
  empresas: OpcionCombobox[];
  productos?: ProductoCatalogo[];
  monedaDefault?: string;
  /** ISO alpha-2 del país configurado en Configuración → Empresa — el
   *  <PhoneInput> de "Datos del comprador" lo usa como prefijo por defecto
   *  en vez de +51 (Perú), su fallback interno. */
  defaultCountryCode?: string;
  pedidoExistente?: PedidoParaEdicion;
  onGuardado?: () => void;
}

export function FormPedido({
  contactos, empresas, productos = [], monedaDefault = "PEN", defaultCountryCode = "PA",
  pedidoExistente, onGuardado,
}: FormPedidoProps) {
  const router = useRouter();
  const esEdicion = Boolean(pedidoExistente);

  const form = useForm<EditarPedidoInput>({
    resolver: zodResolver(EditarPedidoSchema),
    defaultValues: pedidoExistente
      ? {
          estado: "PENDIENTE",
          moneda: pedidoExistente.moneda ?? monedaDefault,
          impuesto: pedidoExistente.impuesto ?? 18,
          notas: pedidoExistente.notas ?? "",
          fechaEntrega: pedidoExistente.fechaEntrega ?? undefined,
          fechaExpiracion: pedidoExistente.fechaExpiracion ?? undefined,
          contactoId: pedidoExistente.contactoId ?? "",
          empresaId: pedidoExistente.empresaId ?? "",
          nombre: pedidoExistente.nombre ?? "",
          apellido: pedidoExistente.apellido ?? "",
          telefono: pedidoExistente.telefono ?? "",
          email: pedidoExistente.email ?? "",
          ruc: pedidoExistente.ruc ?? "",
          empresaNombre: pedidoExistente.empresaNombre ?? "",
          lineas: pedidoExistente.lineas.map(l => ({
            id: l.id,
            productoId: l.productoId ?? "",
            descripcion: l.descripcion ?? "",
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            descuento: l.descuento,
          })),
        }
      : {
          estado: "PENDIENTE" as const,
          moneda: monedaDefault,
          impuesto: 18,
          notas: "",
          contactoId: "",
          empresaId: "",
          nombre: "",
          apellido: "",
          telefono: "",
          email: "",
          ruc: "",
          empresaNombre: "",
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

  const onSubmit = async (datos: EditarPedidoInput) => {
    if (esEdicion && pedidoExistente) {
      const resultado = await editarPedido(pedidoExistente.id, datos);
      if (resultado.exito) {
        toast.success("Pedido actualizado correctamente");
        onGuardado?.();
      } else {
        toast.error(resultado.error);
      }
    } else {
      const resultado = await crearPedido(datos);
      if (resultado.exito) {
        toast.success("Pedido creado correctamente");
        router.push("/sales/pedidos");
      } else {
        toast.error(resultado.error);
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <DecimalInput
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="fechaEntrega" render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de entrega</FormLabel>
              <FormControl>
                <SmartDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Selecciona fecha de entrega"
                />
              </FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="fechaExpiracion" render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de expiración</FormLabel>
              <FormControl>
                <SmartDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Límite para tener en cuenta el pedido"
                />
              </FormControl>
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="empresaId" render={({ field }) => (
            <FormItem>
              <FormLabel>Empresa (CRM)</FormLabel>
              <FormControl>
                <Combobox opciones={empresas} valor={field.value} onChange={field.onChange} placeholder="Seleccionar empresa..." />
              </FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="contactoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Contacto (CRM)</FormLabel>
              <FormControl>
                <Combobox opciones={contactos} valor={field.value} onChange={field.onChange} placeholder="Seleccionar contacto..." />
              </FormControl>
            </FormItem>
          )} />
        </div>

        {/* Datos del comprador — pedido manual */}
        <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-4 space-y-4">
          <p className="text-sm font-medium flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <User className="h-4 w-4 text-stone-400" />
            Datos del comprador
            <span className="text-xs font-normal text-stone-400 dark:text-stone-500">(opcional — para pedidos sin contacto en CRM)</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="nombre" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Juan" {...field} value={field.value ?? ""} />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="apellido" render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input placeholder="Pérez" {...field} value={field.value ?? ""} />
                </FormControl>
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="telefono" render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <PhoneInput value={field.value ?? ""} onChange={field.onChange} defaultCountryCode={defaultCountryCode} />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="correo@ejemplo.com" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="ruc" render={({ field }) => (
              <FormItem>
                <FormLabel>RUC</FormLabel>
                <FormControl>
                  <Input placeholder="20123456789" {...field} value={field.value ?? ""} />
                </FormControl>
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="empresaNombre" render={({ field }) => (
            <FormItem>
              <FormLabel>Razón social / Empresa</FormLabel>
              <FormControl>
                <Input placeholder="Empresa SAC" {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Líneas del pedido</h3>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => append({ descripcion: "", productoId: "", cantidad: 1, precioUnitario: 0, descuento: 0 })}
            >
              <Plus className="h-4 w-4" />Agregar línea
            </Button>
          </div>

          <div className="rounded-xl border border-stone-200/70 dark:border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 dark:bg-white/[0.03]">
                <tr className="text-xs text-stone-500 dark:text-stone-400">
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
                    <tr key={field.id} className="border-t border-stone-100 dark:border-white/5">
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
                        <DecimalInput
                          className="h-8 text-sm text-right"
                          value={lineas[idx]?.cantidad}
                          onChange={(valor) => form.setValue(`lineas.${idx}.cantidad`, valor)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <DecimalInput
                          className="h-8 text-sm text-right"
                          value={lineas[idx]?.precioUnitario}
                          onChange={(valor) => form.setValue(`lineas.${idx}.precioUnitario`, valor)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <DecimalInput
                          className="h-8 text-sm text-right"
                          value={lineas[idx]?.descuento}
                          onChange={(valor) => form.setValue(`lineas.${idx}.descuento`, valor)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums text-stone-900 dark:text-stone-100">
                        {moneda} {subLinea.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-7 w-7 text-stone-400 hover:text-destructive"
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

            <div className="border-t border-stone-100 dark:border-white/5 bg-stone-50/60 dark:bg-white/[0.02] px-4 py-3 flex flex-col items-end gap-1">
              <div className="flex gap-8 text-sm">
                <span className="text-stone-500 dark:text-stone-400">Subtotal</span>
                <span className="tabular-nums text-stone-700 dark:text-stone-300">{moneda} {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex gap-8 text-sm">
                <span className="text-stone-500 dark:text-stone-400">IGV ({impuesto}%)</span>
                <span className="tabular-nums text-stone-700 dark:text-stone-300">{moneda} {impuestoMonto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator className="my-1 w-52 bg-stone-200 dark:bg-white/10" />
              <div className="flex gap-8 items-baseline">
                <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">Total</span>
                <span className="text-lg font-bold tabular-nums text-stone-900 dark:text-stone-50">{moneda} {total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <FormField control={form.control} name="notas" render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea placeholder="Instrucciones especiales, condiciones de entrega..." rows={3} className="resize-none" {...field} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => onGuardado ? onGuardado() : router.back()}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-sm transition-all hover:scale-[1.02]"
          >
            {form.formState.isSubmitting
              ? (esEdicion ? "Guardando..." : "Creando...")
              : (esEdicion ? "Guardar cambios" : "Crear pedido")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
