"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { crearContacto, actualizarContacto } from "../actions";
import { CrearContactoSchema, type CrearContactoInput } from "../schema";
import type { Contacto } from "../types";

interface FormContactoProps {
  empresas: OpcionCombobox[];
  inicial?: Partial<Contacto>;
  modo?: "crear" | "editar";
}

export function FormContacto({ empresas, inicial, modo = "crear" }: FormContactoProps) {
  const router = useRouter();

  const form = useForm<CrearContactoInput>({
    resolver: zodResolver(CrearContactoSchema),
    defaultValues: {
      nombre: inicial?.nombre ?? "",
      apellido: inicial?.apellido ?? "",
      email: inicial?.email ?? "",
      telefono: inicial?.telefono ?? "",
      cargo: inicial?.cargo ?? "",
      notas: inicial?.notas ?? "",
      estado: inicial?.estado ?? "LEAD",
      empresaId: inicial?.empresaId ?? "",
    },
  });

  const onSubmit = async (datos: CrearContactoInput) => {
    const resultado = modo === "crear"
      ? await crearContacto(datos)
      : await actualizarContacto(inicial!.id!, datos);

    if (resultado.exito) {
      toast.success(modo === "crear" ? "Contacto creado" : "Contacto actualizado");
      router.push("/crm/contactos");
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input placeholder="Juan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apellido"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido *</FormLabel>
                <FormControl>
                  <Input placeholder="Pérez" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="juan@empresa.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefono"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input placeholder="+51 999 999 999" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cargo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo</FormLabel>
                <FormControl>
                  <Input placeholder="Gerente de Compras" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="INACTIVO">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="empresaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Empresa</FormLabel>
              <FormControl>
                <Combobox
                  opciones={empresas}
                  valor={field.value}
                  onChange={field.onChange}
                  placeholder="Seleccionar empresa..."
                  placeholderBusqueda="Buscar empresa..."
                  mensajeVacio="No se encontró la empresa"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Notas adicionales sobre el contacto..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Guardando..."
              : modo === "crear"
              ? "Crear contacto"
              : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
