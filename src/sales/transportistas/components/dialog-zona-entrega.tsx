"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { crearZonaEntrega } from "../zonas/actions";
import { CrearZonaEntregaSchema, type CrearZonaEntregaInput } from "../zonas/schema";
import { EditorUbicacionesZona, type UbicacionEditable } from "./editor-ubicaciones-zona";

interface DialogZonaEntregaProps {
  /** La zona nace ligada a este transportista — ver ZonaEntrega.transportistaId. */
  transportistaId: string;
  // 023-transportistas-por-pais — el país ya no se elige acá: viene fijo
  // del transportista (research.md Decisión 1 / FR-004).
  paisId: string;
  paisLabel: string;
  /** Las ubicaciones viajan de vuelta tal como se enviaron: sin ellas, editar
   *  la zona recién creada la mostraría vacía hasta recargar la página. */
  onCreada: (zona: { id: string; nombre: string; ubicaciones: UbicacionEditable[] }) => void;
}

// 022-transportistas-zonas-tarifas — crear una zona sin salir del flujo de
// configuración de tarifas (FR-012); usado desde SeccionZonasTarifas. La
// edición vive en DialogEditarZona, que comparte el editor de ubicaciones.
export function DialogZonaEntrega({ transportistaId, paisId, paisLabel, onCreada }: DialogZonaEntregaProps) {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();

  const valoresIniciales = (): CrearZonaEntregaInput => ({
    transportistaId,
    nombre: "",
    descripcion: "",
    ubicaciones: [{ paisId, provinciaEstado: "", distritoCiudad: "" }],
  });

  const form = useForm<CrearZonaEntregaInput>({
    resolver: zodResolver(CrearZonaEntregaSchema),
    defaultValues: valoresIniciales(),
  });

  const erroresUbicaciones = form.formState.errors.ubicaciones;
  const indicesConError = Array.isArray(erroresUbicaciones)
    ? erroresUbicaciones.flatMap((e, i) => (e ? [i] : []))
    : undefined;

  const onSubmit = (valores: CrearZonaEntregaInput) => {
    startTransition(async () => {
      const resultado = await crearZonaEntrega(valores);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Zona creada");
      onCreada({
        id: resultado.data!.id,
        nombre: resultado.data!.nombre,
        ubicaciones: valores.ubicaciones.map((u) => ({
          paisId: u.paisId,
          provinciaEstado: u.provinciaEstado ?? "",
          distritoCiudad: u.distritoCiudad ?? "",
        })),
      });
      form.reset(valoresIniciales());
      setAbierto(false);
    });
  };

  return (
    <>
      <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={() => setAbierto(true)}>
        <Plus className="h-4 w-4" />
        Agregar zona
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        {/* flex en columna + max-h: el encabezado y el pie quedan fijos y solo
            la lista de ubicaciones desplaza. `min-h-0` en cada eslabón de la
            cadena es lo que permite que el área de scroll ceda altura. */}
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-14">
            <DialogTitle>Nueva zona de entrega</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem className="shrink-0">
                      <FormLabel>Nombre de la zona</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Lima Norte" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ubicaciones"
                  render={({ field }) => (
                    <EditorUbicacionesZona
                      valor={field.value as UbicacionEditable[]}
                      onChange={field.onChange}
                      paisId={paisId}
                      paisLabel={paisLabel}
                      indicesConError={indicesConError}
                    />
                  )}
                />
              </div>

              <DialogFooter className="mx-0 mb-0 shrink-0">
                <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear zona
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
