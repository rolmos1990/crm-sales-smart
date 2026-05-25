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
import { crearOportunidad, actualizarOportunidad } from "../actions";
import { CrearOportunidadSchema, type CrearOportunidadInput } from "../schema";
import type { Oportunidad } from "../types";

interface FormOportunidadProps {
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  inicial?: Partial<Oportunidad>;
  modo?: "crear" | "editar";
}

export function FormOportunidad({ empresas, contactos, inicial, modo = "crear" }: FormOportunidadProps) {
  const router = useRouter();
  const form = useForm<CrearOportunidadInput>({
    resolver: zodResolver(CrearOportunidadSchema),
    defaultValues: {
      titulo: inicial?.titulo ?? "",
      valor: inicial?.valor ?? 0,
      moneda: inicial?.moneda ?? "PEN",
      etapa: inicial?.etapa ?? "PROSPECTO",
      probabilidad: inicial?.probabilidad ?? 20,
      fechaCierre: inicial?.fechaCierre ? new Date(inicial.fechaCierre) : undefined,
      notas: inicial?.notas ?? "",
      empresaId: inicial?.empresaId ?? "",
      contactoId: "",
    },
  });

  const onSubmit = async (datos: CrearOportunidadInput) => {
    const resultado = modo === "crear"
      ? await crearOportunidad(datos)
      : await actualizarOportunidad(inicial!.id!, datos);

    if (resultado.exito) {
      toast.success(modo === "crear" ? "Oportunidad creada" : "Oportunidad actualizada");
      router.push("/crm/oportunidades");
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="titulo" render={({ field }) => (
          <FormItem>
            <FormLabel>Título *</FormLabel>
            <FormControl><Input placeholder="Proyecto de implementación ERP..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="valor" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor *</FormLabel>
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="PEN">PEN (S/)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="probabilidad" render={({ field }) => (
            <FormItem>
              <FormLabel>Probabilidad (%)</FormLabel>
              <FormControl>
                <Input
                  type="number" min="0" max="100"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="etapa" render={({ field }) => (
            <FormItem>
              <FormLabel>Etapa</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="PROSPECTO">Prospecto</SelectItem>
                  <SelectItem value="CALIFICADO">Calificado</SelectItem>
                  <SelectItem value="PROPUESTA">Propuesta</SelectItem>
                  <SelectItem value="NEGOCIACION">Negociación</SelectItem>
                  <SelectItem value="GANADO">Ganado</SelectItem>
                  <SelectItem value="PERDIDO">Perdido</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="fechaCierre" render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de cierre</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                  onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                />
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
          <FormField control={form.control} name="contactoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Contacto principal</FormLabel>
              <FormControl>
                <Combobox opciones={contactos} valor={field.value} onChange={field.onChange} placeholder="Seleccionar contacto..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="notas" render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea placeholder="Detalles de la oportunidad..." className="resize-none" rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Guardando..." : modo === "crear" ? "Crear oportunidad" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
