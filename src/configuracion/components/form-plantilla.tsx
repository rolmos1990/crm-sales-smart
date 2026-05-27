"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Badge } from "@/components/ui/badge";
import { CrearPlantillaSchema, normalizarAlias, type CrearPlantillaInput } from "@/configuracion/plantillas/schema";
import { crearPlantilla, actualizarPlantilla } from "@/configuracion/plantillas/actions";
import type { Plantilla } from "@/configuracion/plantillas/types";
import { MediaUploader } from "@/components/media/media-uploader";
import { vincularMediaArchivo } from "@/lib/media/server-actions";

interface FormPlantillaProps {
  instanciaId: string;
  inicial?: Plantilla;
  modo?: "crear" | "editar";
  onExito?: () => void;
}

export function FormPlantilla({ instanciaId, inicial, modo = "crear", onExito }: FormPlantillaProps) {
  const [plantillaId, setPlantillaId] = useState<string | null>(inicial?.id ?? null);
  const [pendingMediaId, setPendingMediaId] = useState<string | null>(null);

  const form = useForm<CrearPlantillaInput>({
    resolver: zodResolver(CrearPlantillaSchema),
    defaultValues: {
      nombre: inicial?.nombre ?? "",
      alias: inicial?.alias ?? "",
      descripcion: inicial?.descripcion ?? "",
      tipo: (inicial?.tipo as "TEXTO" | "TEXTO_IMAGEN") ?? "TEXTO",
      contenidoTexto: inicial?.contenidoTexto ?? "",
      imagenUrl: inicial?.imagenUrl ?? "",
      instanciaId,
    },
  });

  const tipo = useWatch({ control: form.control, name: "tipo" });
  const aliasValor = useWatch({ control: form.control, name: "alias" });
  const aliasPreview = normalizarAlias(aliasValor ?? "");

  const onSubmit = async (datos: CrearPlantillaInput) => {
    if (modo === "crear") {
      const resultado = await crearPlantilla(datos);
      if (!resultado.exito) { toast.error(resultado.error); return; }
      const nuevoId = resultado.datos!.id;
      setPlantillaId(nuevoId);
      if (pendingMediaId) {
        await vincularMediaArchivo(pendingMediaId, nuevoId, "plantilla");
      }
      toast.success("Plantilla creada");
      form.reset();
      onExito?.();
    } else {
      const resultado = await actualizarPlantilla(inicial!.id, datos);
      if (resultado.exito) {
        toast.success("Plantilla actualizada");
        onExito?.();
      } else {
        toast.error(resultado.error ?? "Error al guardar");
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="nombre" render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre *</FormLabel>
              <FormControl><Input placeholder="Saludo inicial" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="alias" render={({ field }) => (
            <FormItem>
              <FormLabel>Alias *</FormLabel>
              <FormControl>
                <Input
                  placeholder="saludo_inicial"
                  {...field}
                  onChange={(e) => field.onChange(normalizarAlias(e.target.value))}
                />
              </FormControl>
              {aliasPreview && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-stone-400 dark:text-stone-500">Vista previa:</span>
                  <Badge className="font-mono text-xs bg-lime-500/10 text-lime-700 dark:text-lime-400 border border-lime-500/20 hover:bg-lime-500/10">
                    /{aliasPreview}
                  </Badge>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="descripcion" render={({ field }) => (
          <FormItem>
            <FormLabel>Descripción</FormLabel>
            <FormControl>
              <Input placeholder="Descripción breve de cuándo usar esta plantilla" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="tipo" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de plantilla *</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="TEXTO">Solo texto</SelectItem>
                <SelectItem value="TEXTO_IMAGEN">Texto + imagen adjunta</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="contenidoTexto" render={({ field }) => (
          <FormItem>
            <FormLabel>Contenido *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Hola {{nombre}}, gracias por contactarnos..."
                className="resize-none min-h-[120px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {tipo === "TEXTO_IMAGEN" && (
          <FormField control={form.control} name="imagenUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>Imagen adjunta</FormLabel>
              <MediaUploader
                instanciaId={instanciaId}
                modulo="plantillas"
                entidadId={plantillaId ?? undefined}
                entidadTipo="plantilla"
                value={field.value ?? ""}
                onChange={(url, mediaId) => {
                  field.onChange(url);
                  if (mediaId) setPendingMediaId(mediaId);
                }}
              />
              <FormMessage />
            </FormItem>
          )} />
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]"
          >
            {form.formState.isSubmitting
              ? "Guardando..."
              : modo === "crear"
              ? "Crear plantilla"
              : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
