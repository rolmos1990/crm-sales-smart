"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { crearContacto } from "../actions";

const ContactoNuevoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefonoPrincipal: z.string().max(30).optional().or(z.literal("")),
});
type ContactoNuevoInput = z.infer<typeof ContactoNuevoSchema>;

const DEFAULTS: ContactoNuevoInput = { nombre: "", apellido: "", email: "", telefonoPrincipal: "" };

interface SelectorContactoProps {
  contactos: OpcionCombobox[];
  valor: string;
  onChange: (contactoId: string) => void;
  onContactoCreado?: (opcion: OpcionCombobox) => void;
  placeholder?: string;
  defaultCountryCode?: string;
  disabled?: boolean;
}

/**
 * Selector de contacto que permite tanto escoger uno existente (Combobox)
 * como crear uno nuevo sin salir del formulario actual.
 */
export function SelectorContacto({
  contactos,
  valor,
  onChange,
  onContactoCreado,
  placeholder = "Seleccionar contacto...",
  defaultCountryCode = "PA",
  disabled = false,
}: SelectorContactoProps) {
  const [modoCrear, setModoCrear] = useState(false);

  const form = useForm<ContactoNuevoInput>({
    resolver: zodResolver(ContactoNuevoSchema),
    defaultValues: DEFAULTS,
  });

  const handleCrear = async (datos: ContactoNuevoInput) => {
    const r = await crearContacto({
      nombre: datos.nombre,
      apellido: datos.apellido,
      email: datos.email || undefined,
      telefonoPrincipal: datos.telefonoPrincipal || undefined,
    });
    if (!r.exito) { toast.error(r.error); return; }

    onChange(r.datos.id);
    onContactoCreado?.({ valor: r.datos.id, etiqueta: `${r.datos.nombre} ${r.datos.apellido}` });
    setModoCrear(false);
    form.reset(DEFAULTS);
    toast.success("Contacto creado");
  };

  if (modoCrear) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-stone-300 dark:border-white/15 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-600 dark:text-stone-300">Nuevo contacto</p>
          <button
            type="button"
            onClick={() => { setModoCrear(false); form.reset(DEFAULTS); }}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />Cancelar
          </button>
        </div>
        <Form {...form}>
          <div className="grid grid-cols-2 gap-2">
            <FormField control={form.control} name="nombre" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Nombre</FormLabel>
                <FormControl><Input className="h-8" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="apellido" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Apellido</FormLabel>
                <FormControl><Input className="h-8" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Email</FormLabel>
              <FormControl><Input type="email" className="h-8" placeholder="correo@ejemplo.com" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="telefonoPrincipal" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Teléfono</FormLabel>
              <FormControl>
                <PhoneInput value={field.value ?? ""} onChange={field.onChange} defaultCountryCode={defaultCountryCode} placeholder="000 000 0000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button
            type="button"
            size="sm"
            disabled={form.formState.isSubmitting}
            onClick={form.handleSubmit(handleCrear)}
            className="w-full"
          >
            {form.formState.isSubmitting ? "Creando..." : "Crear y usar este contacto"}
          </Button>
        </Form>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Combobox opciones={contactos} valor={valor} onChange={onChange} placeholder={placeholder} disabled={disabled} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setModoCrear(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        <UserPlus className="h-3 w-3" />Crear nuevo contacto
      </button>
    </div>
  );
}
