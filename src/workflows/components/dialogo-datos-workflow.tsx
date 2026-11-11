"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DatosWorkflowSchema, type DatosWorkflow } from "../schema";

// Crear un Workflow o renombrarlo: mismo formulario (nombre + descripción).
export function DialogoDatosWorkflow({
  abierto,
  onAbiertoChange,
  titulo,
  descripcion,
  textoAccion,
  inicial,
  onGuardar,
}: {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  titulo: string;
  descripcion: string;
  textoAccion: string;
  inicial?: DatosWorkflow;
  onGuardar: (datos: DatosWorkflow) => Promise<{ exito: true } | { exito: false; error: string }>;
}) {
  const [guardando, startGuardando] = useTransition();
  const form = useForm<DatosWorkflow>({
    resolver: zodResolver(DatosWorkflowSchema),
    values: inicial ?? { nombre: "", descripcion: "" },
  });

  const enviar = form.handleSubmit((datos) =>
    startGuardando(async () => {
      const r = await onGuardar(datos);
      if (!r.exito) {
        toast.error(r.error);
        return;
      }
      onAbiertoChange(false);
      form.reset();
    }),
  );

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={enviar} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Seguimiento de cotización" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="¿Para qué sirve este flujo?" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onAbiertoChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                {textoAccion}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
