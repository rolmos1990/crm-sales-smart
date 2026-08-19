"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp,
  ShoppingCart, User, Loader2,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { SelectorProductoLinea } from "@/shared/productos/components/selector-producto-linea";
import { PhoneInput } from "@/components/ui/phone-input";
import type { ProductoCatalogo } from "@/shared/productos/types";
import { editarPedido } from "../actions";
import { EditarPedidoSchema, type EditarPedidoInput } from "../schema";
import type { PedidoParaEdicion } from "./form-pedido";

interface SheetEditarPedidoProps {
  pedido: PedidoParaEdicion;
  contactos: OpcionCombobox[];
  empresas: OpcionCombobox[];
  productos?: ProductoCatalogo[];
}

function FormEditarPedido({
  pedido,
  contactos,
  empresas,
  productos = [],
  onGuardado,
}: SheetEditarPedidoProps & { onGuardado: () => void }) {
  const [mostrarDatosFacturacion, setMostrarDatosFacturacion] = useState(
    !!(pedido.nombre || pedido.apellido || pedido.telefono || pedido.email || pedido.ruc || pedido.empresaNombre)
  );
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditarPedidoInput>({
    resolver: zodResolver(EditarPedidoSchema),
    defaultValues: {
      estado: "PENDIENTE" as const,
      moneda: pedido.moneda ?? "PEN",
      impuesto: pedido.impuesto ?? 18,
      notas: pedido.notas ?? "",
      fechaEntrega: pedido.fechaEntrega ?? undefined,
      fechaExpiracion: pedido.fechaExpiracion ?? undefined,
      contactoId: pedido.contactoId ?? "",
      empresaId: pedido.empresaId ?? "",
      nombre: pedido.nombre ?? "",
      apellido: pedido.apellido ?? "",
      telefono: pedido.telefono ?? "",
      email: pedido.email ?? "",
      ruc: pedido.ruc ?? "",
      empresaNombre: pedido.empresaNombre ?? "",
      lineas: pedido.lineas.map(l => ({
        id: l.id,
        productoId: l.productoId ?? "",
        descripcion: l.descripcion ?? "",
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        descuento: l.descuento,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineas" });

  const lineas = form.watch("lineas");
  const impuesto = form.watch("impuesto") ?? 18;
  const moneda = form.watch("moneda") ?? "PEN";
  const simbolo = moneda === "USD" ? "$" : "S/";

  const subtotal = lineas.reduce((acc, l) => {
    const base = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
    return acc + base * (1 - (l.descuento ?? 0) / 100);
  }, 0);
  const impuestoMonto = subtotal * (impuesto / 100);
  const total = subtotal + impuestoMonto;

  const onSubmit = (datos: EditarPedidoInput) => {
    startTransition(async () => {
      const resultado = await editarPedido(pedido.id, datos);
      if (resultado.exito) {
        toast.success("Pedido actualizado correctamente");
        onGuardado();
      } else {
        toast.error(resultado.error);
      }
    });
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

        {/* Datos de facturación (colapsable) */}
        <div className="rounded-lg border border-border">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-muted/40 transition-colors rounded-lg"
            onClick={() => setMostrarDatosFacturacion(!mostrarDatosFacturacion)}
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Datos de facturación
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </span>
            {mostrarDatosFacturacion
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {mostrarDatosFacturacion && (
            <div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
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
                <FormField control={form.control} name="telefono" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value ?? ""} onChange={field.onChange} />
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
                <FormField control={form.control} name="empresaNombre" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razón social / Empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Empresa SAC" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Líneas del pedido</h3>
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
                            onLimpiar={() => form.setValue(`lineas.${idx}.productoId`, "")}
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
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {simbolo} {subLinea.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
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
                <span className="tabular-nums">{simbolo} {subtotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex gap-8 text-sm">
                <span className="text-muted-foreground">IGV ({impuesto}%)</span>
                <span className="tabular-nums">{simbolo} {impuestoMonto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator className="my-1 w-52" />
              <div className="flex gap-8 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{simbolo} {total.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <FormField control={form.control} name="notas" render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Instrucciones especiales, condiciones de entrega..."
                rows={3}
                className="resize-none"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onGuardado}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando...</>
              : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function DialogEditarPedido({ pedido, contactos, empresas, productos = [] }: SheetEditarPedidoProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Pencil className="h-3.5 w-3.5" />
        Editar pedido
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-5xl bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10 shadow-2xl"
          showCloseButton={false}
        >
          <SheetHeader className="border-b border-stone-100 dark:border-white/10 px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-lime-500/10 dark:bg-lime-400/10 p-1.5">
                <ShoppingCart className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Editar pedido
                </SheetTitle>
                <p className="text-xs text-stone-400 dark:text-stone-500 font-mono mt-0.5">
                  {pedido.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-6">
              <FormEditarPedido
                pedido={pedido}
                contactos={contactos}
                empresas={empresas}
                productos={productos}
                onGuardado={() => setOpen(false)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
