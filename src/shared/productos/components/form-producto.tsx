"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { crearProducto, actualizarProducto } from "../actions";
import { CrearProductoSchema, type CrearProductoInput } from "../schema";
import type { Producto } from "../types";
import { UploadImagenProducto } from "./upload-imagen-producto";

interface FormProductoProps {
  inicial?: Partial<Producto>;
  modo?: "crear" | "editar";
}

export function FormProducto({ inicial, modo = "crear" }: FormProductoProps) {
  const router = useRouter();
  const [productoId, setProductoId] = useState<string | null>(inicial?.id ?? null);

  const form = useForm<CrearProductoInput>({
    resolver: zodResolver(CrearProductoSchema),
    defaultValues: {
      sku: inicial?.sku ?? "",
      nombre: inicial?.nombre ?? "",
      descripcion: inicial?.descripcion ?? "",
      precio: inicial?.precio ?? 0,
      moneda: inicial?.moneda ?? "PEN",
      categoria: inicial?.categoria ?? "",
      unidad: inicial?.unidad ?? "",
      imagenUrl: inicial?.imagenUrl ?? "",
      activo: inicial?.activo ?? true,
      manejaStock: inicial?.manejaStock ?? false,
      cantidadDisponible: inicial?.cantidadDisponible ?? 0,
    },
  });

  const onSubmit = async (datos: CrearProductoInput) => {
    if (modo === "crear") {
      // 1. Crear sin imagen para obtener el ID
      const sinImagen = await crearProducto({ ...datos, imagenUrl: "" });
      if (!sinImagen.exito) { toast.error(sinImagen.error); return; }

      const nuevoId = sinImagen.datos.id;
      setProductoId(nuevoId);

      // 2. Si hay imagen pendiente, subirla ahora que tenemos el ID
      const imagenUrl = datos.imagenUrl?.trim();
      if (imagenUrl && !imagenUrl.startsWith("http") && !imagenUrl.startsWith("/")) {
        // no es URL externa ni ruta — ignorar
      } else if (imagenUrl) {
        await actualizarProducto(nuevoId, { imagenUrl });
      }

      toast.success("Producto creado");
      router.push("/productos");
    } else {
      const resultado = await actualizarProducto(inicial!.id!, datos);
      if (resultado.exito) {
        toast.success("Producto actualizado");
        router.push("/productos");
      } else {
        toast.error(resultado.error);
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* SKU + Nombre */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField control={form.control} name="sku" render={({ field }) => (
            <FormItem>
              <FormLabel>SKU / Código</FormLabel>
              <FormControl>
                <Input
                  placeholder="PROD-001"
                  {...field}
                  value={field.value ?? ""}
                  className="font-mono"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="md:col-span-3">
            <FormField control={form.control} name="nombre" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Servicio de consultoría..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* Precio + Moneda + Unidad */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="precio" render={({ field }) => (
            <FormItem>
              <FormLabel>Precio *</FormLabel>
              <FormControl>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="moneda" render={({ field }) => (
            <FormItem>
              <FormLabel>Moneda</FormLabel>
              {/* value controlled para evitar hydration mismatch */}
              <Select onValueChange={field.onChange} value={field.value ?? "PEN"}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="PEN">PEN (S/)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="unidad" render={({ field }) => (
            <FormItem>
              <FormLabel>Unidad</FormLabel>
              <FormControl>
                <Input placeholder="unid, hora, kg..." {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="categoria" render={({ field }) => (
          <FormItem>
            <FormLabel>Categoría</FormLabel>
            <FormControl>
              <Input placeholder="Software, Consultoría, Hardware..." {...field} value={field.value ?? ""} />
            </FormControl>
          </FormItem>
        )} />

        <FormField control={form.control} name="descripcion" render={({ field }) => (
          <FormItem>
            <FormLabel>Descripción</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Descripción detallada del producto o servicio..."
                className="resize-none"
                rows={3}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
          </FormItem>
        )} />

        {/* Imagen */}
        <FormField control={form.control} name="imagenUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>Imagen del producto</FormLabel>
            {modo === "crear" && !productoId && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                Para subir un archivo, guarda el producto primero. Puedes pegar una URL externa ahora.
              </p>
            )}
            <UploadImagenProducto
              productoId={productoId}
              value={field.value ?? ""}
              onChange={field.onChange}
            />
            <FormMessage />
          </FormItem>
        )} />

        {/* Control de stock */}
        <div className="rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-stone-400" />
                Control de inventario
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                Activar para validar stock al crear pedidos
              </p>
            </div>
            <FormField control={form.control} name="manejaStock" render={({ field }) => (
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  field.value
                    ? "bg-lime-500 dark:bg-lime-500"
                    : "bg-stone-300 dark:bg-white/20"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  field.value ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            )} />
          </div>

          {form.watch("manejaStock") && (
            <FormField control={form.control} name="cantidadDisponible" render={({ field }) => (
              <FormItem>
                <FormLabel>Cantidad disponible en stock</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? (modo === "crear" ? "Creando..." : "Guardando...")
              : (modo === "crear" ? "Crear producto" : "Guardar cambios")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
