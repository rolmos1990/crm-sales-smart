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
import { actualizarEntregaDigitalPedido } from "../actions";
import { ActualizarEntregaDigitalPedidoSchema, type ActualizarEntregaDigitalPedidoInput } from "../schema";
import { METODO_ENTREGA_DIGITAL_LABELS } from "../constantes";

interface EntregaDigitalActual {
  metodo?: string | null;
  email?: string | null;
  url?: string | null;
  archivo?: string | null;
  codigo?: string | null;
  usuarioAcceso?: string | null;
  fechaEntrega?: Date | string | null;
  fechaExpiracion?: Date | string | null;
  instrucciones?: string | null;
  observaciones?: string | null;
}

interface FormEntregaDigitalProps {
  pedidoId: string;
  entregaDigital?: EntregaDigitalActual | null;
}

export function FormEntregaDigital({ pedidoId, entregaDigital }: FormEntregaDigitalProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ActualizarEntregaDigitalPedidoInput>({
    resolver: zodResolver(ActualizarEntregaDigitalPedidoSchema),
    defaultValues: {
      pedidoId,
      metodo:          (entregaDigital?.metodo ?? null) as ActualizarEntregaDigitalPedidoInput["metodo"],
      email:           entregaDigital?.email ?? "",
      url:             entregaDigital?.url ?? "",
      archivo:         entregaDigital?.archivo ?? "",
      codigo:          entregaDigital?.codigo ?? "",
      usuarioAcceso:   entregaDigital?.usuarioAcceso ?? "",
      fechaEntrega:    entregaDigital?.fechaEntrega ? new Date(entregaDigital.fechaEntrega).toISOString() : null,
      fechaExpiracion: entregaDigital?.fechaExpiracion ? new Date(entregaDigital.fechaExpiracion).toISOString() : null,
      instrucciones:   entregaDigital?.instrucciones ?? "",
      observaciones:   entregaDigital?.observaciones ?? "",
    },
  });

  const onSubmit = (valores: ActualizarEntregaDigitalPedidoInput) => {
    startTransition(async () => {
      const resultado = await actualizarEntregaDigitalPedido(valores);
      if (resultado.exito) toast.success("Entrega digital actualizada");
      else toast.error(resultado.error);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="metodo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Método</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "__ninguno__" ? null : v)}
                  defaultValue={field.value ?? "__ninguno__"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue>{field.value ? METODO_ENTREGA_DIGITAL_LABELS[field.value] : "Sin especificar"}</SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__ninguno__">Sin especificar</SelectItem>
                    {Object.entries(METODO_ENTREGA_DIGITAL_LABELS).map(([v, l]) => (
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="cliente@email.com" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL / Link</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="archivo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Archivo / Recurso</FormLabel>
                <FormControl>
                  <Input placeholder="Nombre del archivo o recurso..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="codigo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código / Licencia</FormLabel>
                <FormControl>
                  <Input placeholder="Código de activación..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="usuarioAcceso"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Usuario / Referencia</FormLabel>
                <FormControl>
                  <Input placeholder="Usuario de acceso..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fechaEntrega"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de entrega</FormLabel>
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
          name="fechaExpiracion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de expiración</FormLabel>
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

        <FormField
          control={form.control}
          name="instrucciones"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instrucciones</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Instrucciones de acceso o uso..."
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
                  placeholder="Notas sobre la entrega digital..."
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
            Guardar entrega digital
          </Button>
        </div>
      </form>
    </Form>
  );
}
