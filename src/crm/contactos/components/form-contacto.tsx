"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { PhoneInput } from "@/components/ui/phone-input";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { SelectorTags } from "@/crm/tags/components/selector-tags";
import { CrearContactoSchema, type CrearContactoInput } from "../schema";
import { useCrearContactoMutation, useActualizarContactoMutation } from "../hooks";
import type { Contacto } from "../types";
import type { Tag } from "@/crm/tags/types";

interface FormContactoProps {
  empresas: OpcionCombobox[];
  tags?: Tag[];
  tagIdsIniciales?: string[];
  inicial?: Partial<Contacto>;
  modo?: "crear" | "editar";
  defaultCountryCode?: string;
}

export function FormContacto({
  empresas,
  tags = [],
  tagIdsIniciales = [],
  inicial,
  modo = "crear",
  defaultCountryCode = "PA",
}: FormContactoProps) {
  const router = useRouter();
  const crearMutation = useCrearContactoMutation();
  const actualizarMutation = useActualizarContactoMutation(inicial?.id ?? "");
  const mutation = modo === "crear" ? crearMutation : actualizarMutation;

  const form = useForm<CrearContactoInput>({
    resolver: zodResolver(CrearContactoSchema),
    defaultValues: {
      nombre:             inicial?.nombre             ?? "",
      apellido:           inicial?.apellido           ?? "",
      email:              inicial?.email              ?? "",
      telefonoPrincipal:  inicial?.telefonoPrincipal  ?? "",
      telefonoSecundario: inicial?.telefonoSecundario ?? "",
      cargo:              inicial?.cargo              ?? "",
      notas:              inicial?.notas              ?? "",
      estado:             inicial?.estado             ?? "LEAD",
      empresaId:          inicial?.empresaId          ?? "",
      tagIds:             tagIdsIniciales,
    },
  });

  const onSubmit = (datos: CrearContactoInput) => {
    mutation.mutate(datos, {
      onSuccess: () => router.push("/crm/contactos"),
    });
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
            name="telefonoPrincipal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono principal</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    defaultCountryCode={defaultCountryCode}
                    placeholder="000 000 0000"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefonoSecundario"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono secundario</FormLabel>
                <FormControl>
                  <PhoneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    defaultCountryCode={defaultCountryCode}
                    placeholder="000 000 0000"
                  />
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

        {tags.length > 0 && (
          <FormField
            control={form.control}
            name="tagIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Etiquetas</FormLabel>
                <FormControl>
                  <SelectorTags
                    tags={tags}
                    seleccionados={field.value ?? []}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
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
