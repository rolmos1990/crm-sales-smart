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
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { crearActividad } from "../actions";
import { CrearActividadSchema, type CrearActividadInput } from "../schema";

interface FormActividadProps {
  contactos: OpcionCombobox[];
  empresas: OpcionCombobox[];
  oportunidades: OpcionCombobox[];
  preseleccion?: {
    contactoId?: string;
    empresaId?: string;
    oportunidadId?: string;
  };
}

export function FormActividad({ contactos, empresas, oportunidades, preseleccion }: FormActividadProps) {
  const router = useRouter();
  const ahora = new Date();
  ahora.setMinutes(0, 0, 0);

  const form = useForm<CrearActividadInput>({
    resolver: zodResolver(CrearActividadSchema),
    defaultValues: {
      tipo: "TAREA",
      titulo: "",
      descripcion: "",
      fecha: ahora,
      contactoId: preseleccion?.contactoId ?? "",
      empresaId: preseleccion?.empresaId ?? "",
      oportunidadId: preseleccion?.oportunidadId ?? "",
    },
  });

  const onSubmit = async (datos: CrearActividadInput) => {
    const resultado = await crearActividad(datos);
    if (resultado.exito) {
      toast.success("Actividad creada");
      router.back();
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="tipo" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de actividad</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="TAREA">✅ Tarea</SelectItem>
                  <SelectItem value="LLAMADA">📞 Llamada</SelectItem>
                  <SelectItem value="EMAIL">✉️ Email</SelectItem>
                  <SelectItem value="REUNION">🤝 Reunión</SelectItem>
                  <SelectItem value="NOTA">📝 Nota</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="fecha" render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha y hora *</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ""}
                  onChange={(e) => field.onChange(new Date(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="titulo" render={({ field }) => (
          <FormItem>
            <FormLabel>Título *</FormLabel>
            <FormControl><Input placeholder="Llamada de seguimiento..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="descripcion" render={({ field }) => (
          <FormItem>
            <FormLabel>Descripción</FormLabel>
            <FormControl>
              <Textarea placeholder="Detalles de la actividad..." className="resize-none" rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="contactoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Contacto</FormLabel>
              <FormControl>
                <Combobox opciones={contactos} valor={field.value} onChange={field.onChange} placeholder="Seleccionar contacto..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="empresaId" render={({ field }) => (
            <FormItem>
              <FormLabel>Empresa</FormLabel>
              <FormControl>
                <Combobox opciones={empresas} valor={field.value} onChange={field.onChange} placeholder="Seleccionar empresa..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="oportunidadId" render={({ field }) => (
            <FormItem>
              <FormLabel>Oportunidad</FormLabel>
              <FormControl>
                <Combobox opciones={oportunidades} valor={field.value} onChange={field.onChange} placeholder="Seleccionar oportunidad..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Guardando..." : "Crear actividad"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
