"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { cn } from "@/lib/utils";
import {
  actualizarPreferenciasTableroAction,
  configurarEtapasEntradaAction,
  crearEstadoPreparacionAction,
  desactivarEstadoPreparacionAction,
  eliminarEstadoPreparacionAction,
  reordenarEstadosPreparacionAction,
} from "../actions";
import { AGRUPACION_PREPARACION_LABELS, RANGO_PREPARACION_LABELS } from "../constantes";
import type { AgrupacionPreparacion, ConfiguracionPreparacion, RangoPreparacion } from "../types";

const COLORES = ["#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4"];

export function PanelConfigPreparacion({ configuracion }: { configuracion: ConfiguracionPreparacion }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoColor, setNuevoColor] = useState(COLORES[0]);
  const [etapasSeleccionadas, setEtapasSeleccionadas] = useState<string[]>(
    configuracion.etapasEntrada.filter((e) => e.activa).map((e) => e.etapaId),
  );

  const estados = [...configuracion.estados].sort((a, b) => a.orden - b.orden);

  const ejecutar = (accion: () => Promise<{ exito: boolean; error?: string }>, exitoMsg: string) => {
    startTransition(async () => {
      const r = await accion();
      if (r.exito) {
        toast.success(exitoMsg);
        router.refresh();
      } else {
        toast.error(r.error ?? "No se pudo guardar");
      }
    });
  };

  const crearEstado = () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    ejecutar(
      () => crearEstadoPreparacionAction({ nombre, color: nuevoColor, esInicial: false, marcaInicio: false, esFinal: false }),
      `Estado "${nombre}" creado`,
    );
    setNuevoNombre("");
  };

  const mover = (indice: number, direccion: -1 | 1) => {
    const destino = indice + direccion;
    if (destino < 0 || destino >= estados.length) return;
    const reordenados = [...estados];
    [reordenados[indice], reordenados[destino]] = [reordenados[destino], reordenados[indice]];
    ejecutar(
      () => reordenarEstadosPreparacionAction(reordenados.map((e, i) => ({ id: e.id, orden: i }))),
      "Orden de columnas actualizado",
    );
  };

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      {/* El Sheet de este proyecto envuelve @base-ui/react, no Radix: no hay
          `asChild`, así que el trigger se estiliza directo (mismo patrón que
          conversaciones/components/historial-completo.tsx). */}
      <SheetTrigger className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        <Settings className="h-4 w-4" />
        Configurar vista
      </SheetTrigger>

      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Configurar vista de preparación</SheetTitle>
          <SheetDescription>
            Son dos cosas distintas: qué pedidos entran al tablero, y qué columnas tiene.
          </SheetDescription>
        </SheetHeader>

        {configuracion.entradasInvalidas.length > 0 && (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Hay entradas que ya no son válidas</p>
              <p className="mt-0.5">
                {configuracion.entradasInvalidas.join(", ")} — esas etapas se eliminaron o se desactivaron en el flujo de
                venta. El tablero sigue funcionando con el resto.
              </p>
            </div>
          </div>
        )}

        {/* ── Qué pedidos entran ─────────────────────────────── */}
        <section className="mt-6">
          <h3 className="text-sm font-medium text-foreground">Qué pedidos entran</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Etapas del flujo de venta que hacen que un pedido aparezca acá. Sin ninguna marcada, entran todos los
            pedidos que no estén cerrados ni cancelados.
          </p>

          <div className="mt-3 space-y-2">
            {configuracion.etapasDisponibles.map((etapa) => (
              <label key={etapa.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={etapasSeleccionadas.includes(etapa.id)}
                  onCheckedChange={(checked) =>
                    setEtapasSeleccionadas((prev) =>
                      checked ? [...prev, etapa.id] : prev.filter((id) => id !== etapa.id),
                    )
                  }
                />
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: etapa.color ?? undefined }} />
                <span className="text-foreground">{etapa.nombre}</span>
              </label>
            ))}
          </div>

          <Button
            size="sm"
            className="mt-3"
            disabled={pendiente}
            onClick={() => ejecutar(() => configurarEtapasEntradaAction(etapasSeleccionadas), "Entradas actualizadas")}
          >
            Guardar entradas
          </Button>
        </section>

        <Separator className="my-6" />

        {/* ── Columnas del tablero ───────────────────────────── */}
        <section>
          <h3 className="text-sm font-medium text-foreground">Columnas del tablero</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Los estados por los que pasa el armado. Con dos alcanza; si tu operación los necesita, agregá más.
          </p>

          <ul className="mt-3 space-y-2">
            {estados.map((estado, i) => (
              <li key={estado.id} className="rounded-xl border border-border bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: estado.color ?? undefined }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{estado.nombre}</span>

                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="size-7" disabled={i === 0 || pendiente} onClick={() => mover(i, -1)} aria-label="Subir">
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" disabled={i === estados.length - 1 || pendiente} onClick={() => mover(i, 1)} aria-label="Bajar">
                      <ArrowDown className="size-3.5" />
                    </Button>

                    {estado.pedidosAsignados === 0 ? (
                      <ConfirmacionDialog
                        trigger={
                          <Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label="Eliminar">
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        titulo={`¿Eliminar "${estado.nombre}"?`}
                        descripcion="No tiene pedidos asignados, así que se puede eliminar sin migrar nada."
                        onConfirmar={async () => {
                          const r = await eliminarEstadoPreparacionAction(estado.id);
                          if (r.exito) { toast.success("Estado eliminado"); router.refresh(); }
                          else toast.error(r.error);
                        }}
                      />
                    ) : (
                      <DesactivarEstado
                        estado={estado}
                        destinos={estados.filter((e) => e.id !== estado.id && e.activo)}
                        onHecho={() => router.refresh()}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {estado.esInicial && <span className="rounded-full bg-muted px-1.5 py-0.5">Inicial</span>}
                  {estado.marcaInicio && <span className="rounded-full bg-muted px-1.5 py-0.5">Marca inicio</span>}
                  {estado.esFinal && <span className="rounded-full bg-muted px-1.5 py-0.5">Final</span>}
                  {estado.pedidosAsignados > 0 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5">{estado.pedidosAsignados} pedido(s)</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="nuevo-estado" className="text-xs">Nuevo estado</Label>
              <Input
                id="nuevo-estado"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej. Listo para despacho"
              />
            </div>
            <div className="flex gap-1 pb-1.5">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setNuevoColor(c)}
                  className={cn("size-5 rounded-full border-2", nuevoColor === c ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button size="sm" disabled={pendiente || !nuevoNombre.trim()} onClick={crearEstado}>
              <Plus className="mr-1 size-4" />
              Agregar
            </Button>
          </div>
        </section>

        <Separator className="my-6" />

        {/* ── Preferencias ───────────────────────────────────── */}
        <section className="pb-8">
          <h3 className="text-sm font-medium text-foreground">Preferencias por defecto</h3>
          <Preferencias configuracion={configuracion} pendiente={pendiente} onGuardar={ejecutar} />
        </section>
      </SheetContent>
    </Sheet>
  );
}

function Preferencias({
  configuracion,
  pendiente,
  onGuardar,
}: {
  configuracion: ConfiguracionPreparacion;
  pendiente: boolean;
  onGuardar: (accion: () => Promise<{ exito: boolean; error?: string }>, msg: string) => void;
}) {
  const [agrupacion, setAgrupacion] = useState<AgrupacionPreparacion>(configuracion.agrupacionDefecto);
  const [rango, setRango] = useState<RangoPreparacion>(configuracion.rangoDefecto);

  return (
    <div className="mt-3 space-y-4">
      <fieldset>
        <legend className="text-xs text-muted-foreground">Agrupación</legend>
        <div className="mt-1.5 flex gap-2">
          {(["POR_PEDIDO", "POR_PRODUCTO"] as const).map((a) => (
            <Button key={a} type="button" variant={agrupacion === a ? "default" : "outline"} size="sm" onClick={() => setAgrupacion(a)}>
              {AGRUPACION_PREPARACION_LABELS[a]}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs text-muted-foreground">Rango por defecto</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(["HOY", "MANANA", "SEMANA", "PERSONALIZADO"] as const).map((r) => (
            <Button key={r} type="button" variant={rango === r ? "default" : "outline"} size="sm" onClick={() => setRango(r)}>
              {RANGO_PREPARACION_LABELS[r]}
            </Button>
          ))}
        </div>
      </fieldset>

      <Button
        size="sm"
        disabled={pendiente}
        onClick={() =>
          onGuardar(
            () => actualizarPreferenciasTableroAction({ agrupacionDefecto: agrupacion, rangoDefecto: rango }),
            "Preferencias guardadas",
          )
        }
      >
        Guardar preferencias
      </Button>
    </div>
  );
}

/** Desactivar un estado con pedidos exige destino: sin eso, las tarjetas
 *  quedarían en una columna invisible (FR-004). */
function DesactivarEstado({
  estado,
  destinos,
  onHecho,
}: {
  estado: { id: string; nombre: string; pedidosAsignados: number };
  destinos: Array<{ id: string; nombre: string }>;
  onHecho: () => void;
}) {
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? "");

  return (
    <ConfirmacionDialog
      trigger={
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Desactivar">
          <Trash2 className="size-3.5" />
        </Button>
      }
      titulo={`Desactivar "${estado.nombre}"`}
      descripcion={
        <span className="block">
          <span className="block">
            Tiene {estado.pedidosAsignados} pedido(s). Se moverán al estado que elijas y queda registrado en el
            historial.
          </span>
          <span className="mt-3 block">
            <Label htmlFor={`destino-${estado.id}`} className="text-xs">Mover los pedidos a</Label>
            <select
              id={`destino-${estado.id}`}
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </span>
        </span>
      }
      onConfirmar={async () => {
        if (!destinoId) {
          toast.error("Elegí un estado destino para los pedidos");
          return;
        }
        const r = await desactivarEstadoPreparacionAction(estado.id, destinoId);
        if (r.exito) {
          toast.success(`${r.datos.pedidosMigrados} pedido(s) migrados`);
          onHecho();
        } else {
          toast.error(r.error);
        }
      }}
    />
  );
}
