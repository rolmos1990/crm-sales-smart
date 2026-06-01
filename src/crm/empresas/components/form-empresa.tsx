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
import { CrearEmpresaSchema, type CrearEmpresaInput } from "../schema";
import { useCrearEmpresaMutation, useActualizarEmpresaMutation } from "../hooks";
import type { Empresa } from "../types";

interface FormEmpresaProps {
  inicial?: Partial<Empresa>;
  modo?: "crear" | "editar";
}

export function FormEmpresa({ inicial, modo = "crear" }: FormEmpresaProps) {
  const router = useRouter();
  const crearMutation = useCrearEmpresaMutation();
  const actualizarMutation = useActualizarEmpresaMutation(inicial?.id ?? "");
  const mutation = modo === "crear" ? crearMutation : actualizarMutation;

  const form = useForm<CrearEmpresaInput>({
    resolver: zodResolver(CrearEmpresaSchema),
    defaultValues: {
      nombre: inicial?.nombre ?? "",
      ruc: inicial?.ruc ?? "",
      industria: inicial?.industria ?? "",
      tamano: (inicial?.tamano as CrearEmpresaInput["tamano"]) ?? undefined,
      sitioWeb: inicial?.sitioWeb ?? "",
      telefono: inicial?.telefono ?? "",
      email: inicial?.email ?? "",
      notas: inicial?.notas ?? "",
    },
  });

  const onSubmit = (datos: CrearEmpresaInput) => {
    mutation.mutate(datos, {
      onSuccess: () => router.push("/crm/empresas"),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="nombre" render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre *</FormLabel>
              <FormControl><Input placeholder="Empresa S.A.C." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="ruc" render={({ field }) => (
            <FormItem>
              <FormLabel>RUC</FormLabel>
              <FormControl><Input placeholder="20000000000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="industria" render={({ field }) => (
            <FormItem>
              <FormLabel>Industria</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleccionar industria" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {["tecnologia", "retail", "manufactura", "servicios", "salud", "educacion", "construccion", "financiero", "otro"].map(i => (
                    <SelectItem key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="tamano" render={({ field }) => (
            <FormItem>
              <FormLabel>Tamaño</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tamaño" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="micro">Micro (1-10)</SelectItem>
                  <SelectItem value="pequena">Pequeña (11-50)</SelectItem>
                  <SelectItem value="mediana">Mediana (51-250)</SelectItem>
                  <SelectItem value="grande">Grande (250+)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="telefono" render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono</FormLabel>
              <FormControl><Input placeholder="+51 01 234 5678" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" placeholder="contacto@empresa.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="sitioWeb" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Sitio Web</FormLabel>
              <FormControl><Input placeholder="https://empresa.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="notas" render={({ field }) => (
          <FormItem>
            <FormLabel>Notas</FormLabel>
            <FormControl>
              <Textarea placeholder="Información adicional..." className="resize-none" rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando..." : modo === "crear" ? "Crear empresa" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
