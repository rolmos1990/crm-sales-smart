"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { actualizarServicioPedido } from "../actions";
import { ActualizarServicioPedidoSchema, type ActualizarServicioPedidoInput } from "../schema";
import { MODALIDAD_SERVICIO_LABELS } from "../constantes";

interface ServicioActual {
  modalidad?: string | null;
  fecha?: Date | string | null;
  hora?: string | null;
  duracion?: string | null;
  ubicacion?: string | null;
  direccion?: string | null;
  responsable?: string | null;
  instrucciones?: string | null;
  observaciones?: string | null;
}

interface FormServicioProps {
  pedidoId: string;
  servicio?: ServicioActual | null;
}

export function FormServicio({ pedidoId, servicio }: FormServicioProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ActualizarServicioPedidoInput>({
    resolver: zodResolver(ActualizarServicioPedidoSchema),
    defaultValues: {
      pedidoId,
      modalidad:     (servicio?.modalidad ?? null) as ActualizarServicioPedidoInput["modalidad"],
      fecha:         servicio?.fecha ? new Date(servicio.fecha).toISOString() : null,
      hora:          servicio?.hora ?? "",
      duracion:      servicio?.duracion ?? "",
      ubicacion:     servicio?.ubicacion ?? "",
      direccion:     servicio?.direccion ?? "",
      responsable:   servicio?.responsable ?? "",
      instrucciones: servicio?.instrucciones ?? "",
      observaciones: servicio?.observaciones ?? "",
    },
  });

  const onSubmit = (valores: ActualizarServicioPedidoInput) => {
    startTransition(async () => {
      const resultado = await actualizarServicioPedido(valores);
      if (resultado.exito) toast.success("Servicio actualizado");
      else toast.error(resultado.error);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="modalidad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modalidad</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "__ninguna__" ? null : v)}
                  defaultValue={field.value ?? "__ninguna__"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>{field.value ? MODALIDAD_SERVICIO_LABELS[field.value] : "Sin especificar"}</SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__ninguna__">Sin especificar</SelectItem>
                    {Object.entries(MODALIDAD_SERVICIO_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fecha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ? new Date(field.value).toISOString().slice(0, 10) : ""}
                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="hora"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora / franja horaria</FormLabel>
                <FormControl>
                  <Input placeholder="10:00 am, mañana..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="duracion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duración</FormLabel>
                <FormControl>
                  <Input placeholder="1 hora, 2 sesiones..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="responsable"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Responsable / Técnico</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del responsable..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ubicacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ubicación</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del lugar..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="direccion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección</FormLabel>
                <FormControl>
                  <Input placeholder="Dirección completa..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="instrucciones"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instrucciones</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Instrucciones para el técnico o responsable..."
                  className="resize-none"
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="observaciones"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observaciones</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Notas sobre el servicio..."
                  className="resize-none"
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar servicio
          </Button>
        </div>
      </form>
    </Form>
  );
}
