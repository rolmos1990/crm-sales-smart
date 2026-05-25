"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

interface FormProductoProps {
  inicial?: Partial<Producto>;
  modo?: "crear" | "editar";
}

export function FormProducto({ inicial, modo = "crear" }: FormProductoProps) {
  const router = useRouter();

  const form = useForm<CrearProductoInput>({
    resolver: zodResolver(CrearProductoSchema),
    defaultValues: {
      nombre: inicial?.nombre ?? "",
      descripcion: inicial?.descripcion ?? "",
      precio: inicial?.precio ?? 0,
      moneda: inicial?.moneda ?? "PEN",
      categoria: inicial?.categoria ?? "",
      unidad: inicial?.unidad ?? "",
      activo: inicial?.activo ?? true,
    },
  });

  const onSubmit = async (datos: CrearProductoInput) => {
    const resultado = modo === "crear"
      ? await crearProducto(datos)
      : await actualizarProducto(inicial!.id!, datos);

    if (resultado.exito) {
      toast.success(modo === "crear" ? "Producto creado" : "Producto actualizado");
      router.push("/productos");
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField control={form.control} name="nombre" render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre *</FormLabel>
            <FormControl><Input placeholder="Servicio de consultoría..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

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
              <Select onValueChange={field.onChange} defaultValue={field.value ?? "PEN"}>
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
              <FormControl><Input placeholder="unid, hora, kg..." {...field} /></FormControl>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="categoria" render={({ field }) => (
          <FormItem>
            <FormLabel>Categoría</FormLabel>
            <FormControl><Input placeholder="Software, Consultoría, Hardware..." {...field} /></FormControl>
          </FormItem>
        )} />

        <FormField control={form.control} name="descripcion" render={({ field }) => (
          <FormItem>
            <FormLabel>Descripción</FormLabel>
            <FormControl>
              <Textarea placeholder="Descripción detallada del producto o servicio..." className="resize-none" rows={3} {...field} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? modo === "crear" ? "Creando..." : "Guardando..."
              : modo === "crear" ? "Crear producto" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
