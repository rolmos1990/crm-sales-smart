"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { editarZonaEntrega } from "../zonas/actions";
import { EditarZonaEntregaSchema, type EditarZonaEntregaInput } from "../zonas/schema";
import { editarTarifa } from "../tarifas/actions";
import { EditorUbicacionesZona, type UbicacionEditable } from "./editor-ubicaciones-zona";

export interface ZonaEditable {
  id: string;
  nombre: string;
  ubicaciones: UbicacionEditable[];
}

export interface TarifaEditable {
  id: string;
  servicioTransportistaId: string;
  costoInterno: number;
  precioCliente: number;
  tiempoMinimoDias: number | null;
  tiempoMaximoDias: number | null;
}

interface DialogEditarZonaProps {
  zona: ZonaEditable;
  /** Tarifas ya configuradas para esta zona en este transportista. */
  tarifas: TarifaEditable[];
  servicios: { id: string; nombre: string }[];
  paisId: string;
  paisLabel: string;
  moneda: string;
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Alta de la primera tarifa: la hace DialogTarifa, no este modal. */
  onAgregarTarifa: (zonaId: string) => void;
}

interface FormularioTarifas {
  tarifas: TarifaEditable[];
}

// Edición de una zona y de sus tarifas en un solo modal con dos pestañas.
// Zona y tarifas son entidades distintas con acciones propias
// (editarZonaEntrega / editarTarifa), así que NO se guardan juntas: el pie
// guarda solo la pestaña activa y lo dice en el botón, para no dejar una de
// las dos a medias sin que se note.
export function DialogEditarZona({
  zona, tarifas, servicios, paisId, paisLabel, moneda, abierto, onOpenChange, onAgregarTarifa,
}: DialogEditarZonaProps) {
  const [pestana, setPestana] = useState("zona");
  const [guardandoZona, iniciarGuardadoZona] = useTransition();
  const [guardandoTarifas, iniciarGuardadoTarifas] = useTransition();

  const formZona = useForm<EditarZonaEntregaInput>({
    resolver: zodResolver(EditarZonaEntregaSchema),
    defaultValues: { id: zona.id, nombre: zona.nombre, descripcion: "", ubicaciones: zona.ubicaciones },
  });

  const formTarifas = useForm<FormularioTarifas>({ defaultValues: { tarifas } });
  const { fields } = useFieldArray({ control: formTarifas.control, name: "tarifas" });

  // Los formularios se recargan al abrir, no en cada render: así los cambios
  // sin guardar sobreviven al ir y volver entre pestañas.
  useEffect(() => {
    if (!abierto) return;
    setPestana("zona");
    formZona.reset({ id: zona.id, nombre: zona.nombre, descripcion: "", ubicaciones: zona.ubicaciones });
    formTarifas.reset({ tarifas });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, zona.id]);

  const erroresUbicaciones = formZona.formState.errors.ubicaciones;
  const indicesConError = Array.isArray(erroresUbicaciones)
    ? erroresUbicaciones.flatMap((e, i) => (e ? [i] : []))
    : undefined;

  const formatearImporte = (valor: number) => {
    try {
      return new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda, currencyDisplay: "narrowSymbol" }).format(valor);
    } catch {
      return `${moneda} ${valor.toFixed(2)}`;
    }
  };

  const guardarZona = (valores: EditarZonaEntregaInput) => {
    iniciarGuardadoZona(async () => {
      const resultado = await editarZonaEntrega(valores);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Zona actualizada");
      onOpenChange(false);
    });
  };

  const guardarTarifas = (valores: FormularioTarifas) => {
    iniciarGuardadoTarifas(async () => {
      // Cada tarifa es una fila independiente: se guardan en paralelo y se
      // informa cuántas fallaron en vez de abortar al primer error, que
      // dejaría el resto guardado sin avisar.
      const resultados = await Promise.all(
        valores.tarifas.map((t) =>
          editarTarifa({
            id: t.id,
            zonaEntregaId: zona.id,
            servicioTransportistaId: t.servicioTransportistaId,
            costoInterno: t.costoInterno,
            precioCliente: t.precioCliente,
            tiempoMinimoDias: t.tiempoMinimoDias ?? null,
            tiempoMaximoDias: t.tiempoMaximoDias ?? null,
          }),
        ),
      );

      const fallidas = resultados.filter((r) => !r.exito);
      if (fallidas.length === resultados.length) {
        toast.error(fallidas[0]?.exito === false ? fallidas[0].error : "No se pudieron guardar las tarifas");
        return;
      }
      if (fallidas.length > 0) {
        toast.warning(
          `Se guardaron ${resultados.length - fallidas.length} de ${resultados.length} tarifas — revisa las que quedaron con error`,
        );
        return;
      }
      for (const r of resultados) {
        if (r.exito && r.advertencia) toast.warning(r.advertencia);
      }
      toast.success(resultados.length === 1 ? "Tarifa actualizada" : "Tarifas actualizadas");
      onOpenChange(false);
    });
  };

  const serviciosItems = Object.fromEntries(servicios.map((s) => [s.id, s.nombre]));
  const enZona = pestana === "zona";
  const guardando = guardandoZona || guardandoTarifas;

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-14">
          <DialogTitle>Editar zona de entrega</DialogTitle>
          <p className="text-sm text-muted-foreground">{zona.nombre}</p>
        </DialogHeader>

        <Tabs value={pestana} onValueChange={setPestana} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="shrink-0 px-6 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="zona" className="flex-1 gap-1.5">
                <MapPin aria-hidden className="h-4 w-4" />
                Zona
              </TabsTrigger>
              <TabsTrigger value="tarifas" className="flex-1 gap-1.5">
                <Tag aria-hidden className="h-4 w-4" />
                Tarifas
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Ambas pestañas quedan montadas: cambiar de pestaña no debe tirar
              los cambios sin guardar de la otra. */}
          <TabsContent
            value="zona"
            keepMounted
            className={cn("min-h-0 flex-1 flex-col", enZona ? "flex" : "hidden")}
          >
            <Form {...formZona}>
              <form
                id="form-editar-zona"
                onSubmit={formZona.handleSubmit(guardarZona)}
                className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4"
              >
                <FormField
                  control={formZona.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem className="shrink-0">
                      <FormLabel>Nombre de la zona</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={formZona.control}
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
              </form>
            </Form>
          </TabsContent>

          <TabsContent
            value="tarifas"
            keepMounted
            className={cn("min-h-0 flex-1 flex-col", enZona ? "hidden" : "flex")}
          >
            {fields.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <Tag aria-hidden className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Esta zona todavía no tiene tarifas</p>
                  <p className="text-sm text-muted-foreground">Agrégale una para que aparezca en la tabla de tarifas.</p>
                </div>
                <Button type="button" variant="outline" className="gap-1.5" onClick={() => onAgregarTarifa(zona.id)}>
                  <Plus className="h-4 w-4" />
                  Agregar tarifa
                </Button>
              </div>
            ) : (
              <Form {...formTarifas}>
                <form
                  id="form-editar-tarifas"
                  onSubmit={formTarifas.handleSubmit(guardarTarifas)}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4"
                >
                  {fields.map((f, idx) => (
                    <TarjetaTarifa
                      key={f.id}
                      idx={idx}
                      form={formTarifas}
                      servicios={servicios}
                      serviciosItems={serviciosItems}
                      formatearImporte={formatearImporte}
                    />
                  ))}
                </form>
              </Form>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mx-0 mb-0 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={enZona ? "form-editar-zona" : "form-editar-tarifas"}
            disabled={guardando || (!enZona && fields.length === 0)}
          >
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {enZona ? "Guardar zona" : "Guardar tarifas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TarjetaTarifaProps {
  idx: number;
  form: ReturnType<typeof useForm<FormularioTarifas>>;
  servicios: { id: string; nombre: string }[];
  serviciosItems: Record<string, string>;
  formatearImporte: (valor: number) => string;
}

function TarjetaTarifa({ idx, form, servicios, serviciosItems, formatearImporte }: TarjetaTarifaProps) {
  // Mismo cálculo que ya usa DialogTarifa: margen = precio − costo.
  const costoInterno = form.watch(`tarifas.${idx}.costoInterno`) ?? 0;
  const precioCliente = form.watch(`tarifas.${idx}.precioCliente`) ?? 0;
  const margen = precioCliente - costoInterno;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <FormField
        control={form.control}
        name={`tarifas.${idx}.servicioTransportistaId`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Servicio</FormLabel>
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
          name={`tarifas.${idx}.costoInterno`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Costo interno</FormLabel>
              <FormControl>
                <DecimalInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`tarifas.${idx}.precioCliente`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Precio al cliente</FormLabel>
              <FormControl>
                <DecimalInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <p className={cn("text-xs", margen < 0 ? "text-danger" : "text-muted-foreground")}>
        Margen: {formatearImporte(margen)}
        {margen < 0 && " — el precio al cliente es menor que el costo interno"}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name={`tarifas.${idx}.tiempoMinimoDias`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Días mínimo</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`tarifas.${idx}.tiempoMaximoDias`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Días máximo</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
