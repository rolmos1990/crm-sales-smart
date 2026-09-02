"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { crearTarifa, editarTarifa } from "../tarifas/actions";
import { CrearTarifaSchema, type CrearTarifaInput } from "../tarifas/schema";

interface OpcionZonaOServicio {
  id: string;
  nombre: string;
}

export interface TarifaExistente {
  id: string;
  zonaEntregaId: string;
  servicioTransportistaId: string;
  costoInterno: number;
  precioCliente: number;
  tiempoMinimoDias: number | null;
  tiempoMaximoDias: number | null;
}

interface DialogTarifaProps {
  transportistaId: string;
  zonas: OpcionZonaOServicio[];
  servicios: OpcionZonaOServicio[];
  tarifaExistente?: TarifaExistente;
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  onGuardada: () => void;
}

// 022-transportistas-zonas-tarifas — crear o editar una TarifaTransportistaZona
// (FR-015 a FR-025). Abierto desde SeccionZonasTarifas, tanto para "Agregar
// tarifa" como para la acción "Editar" de cada fila.
export function DialogTarifa({ transportistaId, zonas, servicios, tarifaExistente, abierto, onOpenChange, onGuardada }: DialogTarifaProps) {
  const [isPending, startTransition] = useTransition();
  const esEdicion = !!tarifaExistente;

  const form = useForm<CrearTarifaInput>({
    resolver: zodResolver(CrearTarifaSchema),
    defaultValues: {
      transportistaId,
      zonaEntregaId: tarifaExistente?.zonaEntregaId ?? "",
      servicioTransportistaId: tarifaExistente?.servicioTransportistaId ?? "",
      costoInterno: tarifaExistente?.costoInterno ?? 0,
      precioCliente: tarifaExistente?.precioCliente ?? 0,
      tiempoMinimoDias: tarifaExistente?.tiempoMinimoDias ?? undefined,
      tiempoMaximoDias: tarifaExistente?.tiempoMaximoDias ?? undefined,
    },
  });

  useEffect(() => {
    if (abierto) {
      form.reset({
        transportistaId,
        zonaEntregaId: tarifaExistente?.zonaEntregaId ?? "",
        servicioTransportistaId: tarifaExistente?.servicioTransportistaId ?? "",
        costoInterno: tarifaExistente?.costoInterno ?? 0,
        precioCliente: tarifaExistente?.precioCliente ?? 0,
        tiempoMinimoDias: tarifaExistente?.tiempoMinimoDias ?? undefined,
        tiempoMaximoDias: tarifaExistente?.tiempoMaximoDias ?? undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tarifaExistente]);

  const costoInterno = form.watch("costoInterno") ?? 0;
  const precioCliente = form.watch("precioCliente") ?? 0;
  const margen = precioCliente - costoInterno;

  const zonasItems = Object.fromEntries(zonas.map((z) => [z.id, z.nombre]));
  const serviciosItems = Object.fromEntries(servicios.map((s) => [s.id, s.nombre]));

  const onSubmit = (valores: CrearTarifaInput) => {
    startTransition(async () => {
      const resultado = esEdicion
        ? await editarTarifa({ ...valores, id: tarifaExistente!.id })
        : await crearTarifa(valores);

      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      if (resultado.advertencia) toast.warning(resultado.advertencia);
      toast.success(esEdicion ? "Tarifa actualizada" : "Tarifa creada");
      onGuardada();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar tarifa" : "Nueva tarifa"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="zonaEntregaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zona</FormLabel>
                  <Select items={zonasItems} value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecciona una zona" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {zonas.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="servicioTransportistaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Servicio</FormLabel>
                  <Select items={serviciosItems} value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecciona un servicio" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {servicios.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="costoInterno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo interno</FormLabel>
                    <FormControl>
                      <DecimalInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="precioCliente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio al cliente</FormLabel>
                    <FormControl>
                      <DecimalInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className={`text-xs ${margen < 0 ? "text-danger" : "text-muted-foreground"}`}>
              Margen: {margen.toFixed(2)}
              {margen < 0 && " — el precio al cliente es menor que el costo interno"}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="tiempoMinimoDias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días mínimo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tiempoMaximoDias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días máximo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {esEdicion ? "Guardar cambios" : "Crear tarifa"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
