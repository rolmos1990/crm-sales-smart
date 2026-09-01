"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SelectorPais } from "@/shared/entregas/components/selector-pais";
import { SelectorEstadoProvincia } from "@/shared/entregas/components/selector-estado-provincia";
import { obtenerModoGeograficoAction } from "@/configuracion/empresa/actions";
import { obtenerCostoSugerido } from "@/shared/entregas/actions";
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
  // 019-cobertura-geografica-envios
  paisId?: string | null;
  estadoProvinciaId?: string | null;
  ciudad?: string | null;
}

interface FormEntregaProps {
  pedidoId: string;
  entrega?: EntregaActual | null;
  transportistas: Transportista[];
  /** Vive en Pedido.costoEnvio, no en EntregaPedido — ver actions.ts. */
  costoEnvio: number;
}

export function FormEntrega({ pedidoId, entrega, transportistas, costoEnvio }: FormEntregaProps) {
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
      costoEnvio,
      paisId:            entrega?.paisId ?? null,
      estadoProvinciaId: entrega?.estadoProvinciaId ?? null,
      ciudad:            entrega?.ciudad ?? "",
    },
  });

  const onSubmit = (valores: ActualizarEntregaPedidoInput) => {
    startTransition(async () => {
      const resultado = await actualizarEntregaPedido(valores);
      if (resultado.exito) toast.success("Entrega actualizada");
      else toast.error(resultado.error);
    });
  };

  // El tipo de transportista usa el mismo enum que el método de entrega —
  // solo tiene sentido ofrecer transportistas cuyo tipo coincide con el
  // método elegido (ej. "Courier externo" → solo transportistas COURIER_EXTERNO).
  const metodoSeleccionado = form.watch("metodoEntrega");
  const transportistasFiltrados = transportistas.filter(
    (t) => t.activo && t.tipo === metodoSeleccionado
  );

  // 019-cobertura-geografica-envios — FR-011/FR-012
  const [modoGeografico, setModoGeografico] = useState<{ modoGeografico: "UN_SOLO_PAIS" | "MULTIPAIS"; paisOperacionId: string | null } | null>(null);
  useEffect(() => {
    obtenerModoGeograficoAction().then(setModoGeografico);
  }, []);
  const [sugiriendoCosto, setSugiriendoCosto] = useState(false);
  const paisEntregaId = form.watch("paisId");
  const estadoProvinciaEntregaId = form.watch("estadoProvinciaId");
  const transportistaIdSeleccionado = form.watch("transportistaId");

  async function sugerirCostoEnvio() {
    if (!estadoProvinciaEntregaId) {
      toast.error("Elige un estado/provincia primero");
      return;
    }
    setSugiriendoCosto(true);
    try {
      const resultado = await obtenerCostoSugerido({
        estadoProvinciaId: estadoProvinciaEntregaId,
        paisId: paisEntregaId,
        metodoEntrega: metodoSeleccionado,
        transportistaId: transportistaIdSeleccionado,
      });
      if (resultado.ambiguo) {
        toast.error("Hay más de un costo configurado para esa ubicación — ingrésalo manualmente");
      } else if (!resultado.cubierto || resultado.costo === null) {
        toast.error("Sin costo configurado para esa ubicación");
      } else {
        form.setValue("costoEnvio", resultado.costo);
        toast.success(`Costo sugerido: ${resultado.costo.toFixed(2)}`);
      }
    } finally {
      setSugiriendoCosto(false);
    }
  }

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
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    // Si el transportista ya elegido no coincide con el nuevo
                    // método, se limpia — evita guardar una combinación inválida.
                    const actual = transportistas.find((t) => t.id === form.getValues("transportistaId"));
                    if (actual && actual.tipo !== v) {
                      form.setValue("transportistaId", null);
                    }
                  }}
                  defaultValue={field.value}
                >
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

        {transportistasFiltrados.length > 0 ? (
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
                    {transportistasFiltrados.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            No hay transportistas activos de tipo &quot;{METODO_LABELS[metodoSeleccionado] ?? metodoSeleccionado}&quot;.
          </p>
        )}

        {/* 019-cobertura-geografica-envios — ubicación de destino; país solo
            se pide en modo MULTIPAIS (FR-011/FR-012). */}
        <div className="grid grid-cols-3 gap-4">
          {modoGeografico?.modoGeografico === "MULTIPAIS" && (
            <FormField
              control={form.control}
              name="paisId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>País</FormLabel>
                  <FormControl>
                    <SelectorPais value={field.value ?? null} onChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="estadoProvinciaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provincia / Estado</FormLabel>
                <FormControl>
                  <SelectorEstadoProvincia
                    paisId={modoGeografico?.modoGeografico === "UN_SOLO_PAIS" ? modoGeografico.paisOperacionId : paisEntregaId ?? null}
                    value={field.value ?? null}
                    onChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ciudad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ciudad <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                <FormControl>
                  <Input placeholder="Ciudad" {...field} value={field.value ?? ""} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

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
          name="costoEnvio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Costo de envío</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <DecimalInput value={field.value ?? 0} onChange={field.onChange} />
                </FormControl>
                <Button type="button" variant="outline" size="sm" disabled={sugiriendoCosto} onClick={sugerirCostoEnvio}>
                  Sugerir
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Se suma al total del pedido, no cuenta como ganancia en reportes</p>
              <FormMessage />
            </FormItem>
          )}
        />

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
