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
import { actualizarEntregaPedido } from "../actions";
import { ActualizarEntregaPedidoSchema, type ActualizarEntregaPedidoInput } from "../schema";
import type { Transportista } from "@/sales/transportistas/types";

const METODO_LABELS: Record<string, string> = {
  COURIER_EXTERNO:      "Courier externo",
  MENSAJERO_PROPIO:     "Mensajero propio",
  RETIRO_TIENDA:        "Retiro en tienda",
  DIGITAL:              "Entrega digital",
  INSTALACION_SERVICIO: "Instalación / Servicio",
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE:  "Pendiente",
  PREPARANDO: "Preparando",
  EN_CAMINO:  "En camino",
  ENTREGADO:  "Entregado",
  FALLIDO:    "Fallido",
  CANCELADO:  "Cancelado",
  DEVUELTO:   "Devuelto",
};

interface EntregaActual {
  metodoEntrega:  string;
  estadoEntrega:  string;
  transportistaId?: string | null;
  numeroGuia?:    string | null;
  urlSeguimiento?: string | null;
  fechaEstimada?: Date | string | null;
  observaciones?: string | null;
}

interface FormEntregaProps {
  pedidoId: string;
  entrega?: EntregaActual | null;
  transportistas: Transportista[];
}

export function FormEntrega({ pedidoId, entrega, transportistas }: FormEntregaProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ActualizarEntregaPedidoInput>({
    resolver: zodResolver(ActualizarEntregaPedidoSchema),
    defaultValues: {
      pedidoId,
      metodoEntrega:   (entrega?.metodoEntrega ?? "COURIER_EXTERNO") as ActualizarEntregaPedidoInput["metodoEntrega"],
      estadoEntrega:   (entrega?.estadoEntrega ?? "PENDIENTE") as ActualizarEntregaPedidoInput["estadoEntrega"],
      transportistaId: entrega?.transportistaId ?? null,
      numeroGuia:      entrega?.numeroGuia ?? "",
      urlSeguimiento:  entrega?.urlSeguimiento ?? "",
      fechaEstimada:   entrega?.fechaEstimada
        ? new Date(entrega.fechaEstimada as string).toISOString()
        : null,
      observaciones:   entrega?.observaciones ?? "",
    },
  });

  const onSubmit = (valores: ActualizarEntregaPedidoInput) => {
    startTransition(async () => {
      const resultado = await actualizarEntregaPedido(valores);
      if (resultado.exito) toast.success("Entrega actualizada");
      else toast.error(resultado.error);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="metodoEntrega"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Método de entrega</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>{METODO_LABELS[field.value] ?? field.value}</SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(METODO_LABELS).map(([v, l]) => (
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
            name="estadoEntrega"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado de entrega</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>{ESTADO_LABELS[field.value] ?? field.value}</SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(ESTADO_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {transportistas.length > 0 && (
          <FormField
            control={form.control}
            name="transportistaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transportista</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "__ninguno__" ? null : v)}
                  defaultValue={field.value ?? "__ninguno__"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>
                        {field.value
                          ? (transportistas.find(t => t.id === field.value)?.nombre ?? "Sin transportista")
                          : "Sin transportista"}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__ninguno__">Sin transportista</SelectItem>
                    {transportistas.filter(t => t.activo).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="numeroGuia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de guía</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: 1234567890" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fechaEstimada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha estimada de entrega</FormLabel>
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

        <FormField
          control={form.control}
          name="urlSeguimiento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL de seguimiento</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} value={field.value ?? ""} />
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
                  placeholder="Instrucciones de entrega, notas para el mensajero, etc."
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
            Guardar entrega
          </Button>
        </div>
      </form>
    </Form>
  );
}
