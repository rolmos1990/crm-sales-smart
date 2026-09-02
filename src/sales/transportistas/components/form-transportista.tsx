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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { crearTransportista } from "../actions";
import { CrearTransportistaSchema, type CrearTransportistaInput } from "../schema";
import { TIPO_TRANSPORTISTA_LABELS } from "../types";
import type { Transportista } from "../types";

const TIPOS = Object.entries(TIPO_TRANSPORTISTA_LABELS) as [string, string][];
const TIPOS_ITEMS = Object.fromEntries(TIPOS);

interface FormTransportistaProps {
  onExito: (transportista: Transportista) => void;
}

// 022-transportistas-zonas-tarifas — recortado a nombre/tipo/estado (FR-001);
// el resto de la configuración (contacto, zonas, tarifas, condiciones) vive
// en el panel /sales/transportistas/[id].
export function FormTransportista({ onExito }: FormTransportistaProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CrearTransportistaInput>({
    resolver: zodResolver(CrearTransportistaSchema),
    defaultValues: { nombre: "", tipo: "COURIER_EXTERNO" },
  });

  const onSubmit = (valores: CrearTransportistaInput) => {
    startTransition(async () => {
      const resultado = await crearTransportista(valores);

      if (resultado.exito) {
        toast.success("Transportista creado");
        onExito(resultado.data!);
      } else {
        toast.error(resultado.error);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Ej: DHL, FedEx, Mensajero propio" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select items={TIPOS_ITEMS} onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TIPOS.map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor}>{etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending} className="rounded-xl bg-lime-500/90 text-stone-950 hover:bg-lime-400 shadow-lg transition-all hover:scale-[1.02]">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear transportista
          </Button>
        </div>
      </form>
    </Form>
  );
}
