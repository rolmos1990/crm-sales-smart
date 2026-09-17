"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Info,
  Lightbulb,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { cn } from "@/lib/utils";
import {
  actualizarPreferenciasTableroAction,
  configurarEtapasEntradaAction,
  crearEstadoPreparacionAction,
  editarColumnaPreparacionAction,
  eliminarEstadoPreparacionAction,
  reordenarEstadosPreparacionAction,
} from "../actions";
import { AGRUPACION_PREPARACION_LABELS, RANGO_PREPARACION_LABELS } from "../constantes";
import type {
  AgrupacionPreparacion,
  ConfiguracionPreparacion,
  EstadoPreparacionConUso,
  RangoPreparacion,
} from "../types";

const COLORES = ["#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4"];

export function PanelConfigPreparacion({ configuracion }: { configuracion: ConfiguracionPreparacion }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [guardando, setGuardando] = useState(false);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoColor, setNuevoColor] = useState(COLORES[0]);
  const [etapasSeleccionadas, setEtapasSeleccionadas] = useState<string[]>(
    configuracion.etapasEntrada.filter((e) => e.activa).map((e) => e.etapaId),
  );
  const [agrupacion, setAgrupacion] = useState<AgrupacionPreparacion>(configuracion.agrupacionDefecto);
  const [rango, setRango] = useState<RangoPreparacion>(configuracion.rangoDefecto);

  const estados = [...configuracion.estados].sort((a, b) => a.orden - b.orden);
  const ocupado = pendiente || guardando;

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

  // Un solo guardado al pie, como pide el diseño: las dos cosas que se editan
  // en formulario (entradas y preferencias) se guardan juntas. Crear, borrar y
  // reordenar estados siguen siendo inmediatos, porque son acciones y no campos.
  const guardarTodo = async () => {
    setGuardando(true);
    try {
      const entradas = await configurarEtapasEntradaAction(etapasSeleccionadas);
      if (!entradas.exito) {
        toast.error(entradas.error);
        return;
      }
      const prefs = await actualizarPreferenciasTableroAction({ agrupacionDefecto: agrupacion, rangoDefecto: rango });
      if (!prefs.exito) {
        toast.error(prefs.error);
        return;
      }
      toast.success("Configuración guardada");
      router.refresh();
      setAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      {/* El Sheet de este proyecto envuelve @base-ui/react, no Radix: no hay
          `asChild`, así que el trigger se estiliza directo. */}
      <SheetTrigger className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        <Settings className="h-4 w-4" />
        Configurar vista
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {/* pr-10: SheetContent pone su botón de cerrar en absolute top-3
            right-3, así que el título necesita dejarle lugar. */}
        <SheetHeader className="border-b border-border px-5 py-4 pr-10">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            >
              <UtensilsCrossed className="size-5" />
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-lg">Configurar vista de preparación</SheetTitle>
              <SheetDescription>
                Define qué pedidos se muestran y cómo se agrupan en esta vista.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {configuracion.entradasInvalidas.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Hay entradas que ya no son válidas</p>
                <p className="mt-0.5">
                  {configuracion.entradasInvalidas.join(", ")} — esas etapas se eliminaron o se desactivaron en el
                  flujo de venta. El tablero sigue funcionando con el resto.
                </p>
              </div>
            </div>
          )}

          {/* ── 1. Qué pedidos entran ──────────────────────────── */}
          <SeccionNumerada
            numero={1}
            titulo="Qué pedidos entran"
            ayuda="Selecciona los estados del flujo de venta que deben aparecer en la vista de preparación. Si no seleccionas ninguno, se muestran todos los pedidos no cancelados."
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {configuracion.etapasDisponibles.map((etapa) => {
                const activa = etapasSeleccionadas.includes(etapa.id);
                return (
                  <button
                    key={etapa.id}
                    type="button"
                    role="checkbox"
                    aria-checked={activa}
                    onClick={() =>
                      setEtapasSeleccionadas((prev) =>
                        activa ? prev.filter((id) => id !== etapa.id) : [...prev, etapa.id],
                      )
                    }
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                      activa
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card hover:border-foreground/20",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                        activa ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                      )}
                    >
                      {activa && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: etapa.color ?? undefined }}
                        />
                        <span className="truncate text-sm font-medium text-foreground">{etapa.nombre}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {etapa.descripcion?.trim() ||
                          (etapa.esCancelacion ? "No mostrar" : etapa.esFinal ? "Pedido cerrado" : "Pedido en curso")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <Banner Icono={Info}>Puedes cambiar estos estados en cualquier momento.</Banner>
          </SeccionNumerada>

          {/* ── 2. Columnas del tablero ─────────────────────────── */}
          <SeccionNumerada
            numero={2}
            titulo="Columnas del tablero"
            ayuda="Los estados por los que pasa el armado. Con dos alcanza; si tu operación los necesita, agregá más."
          >
            <ul className="space-y-2">
              {estados.map((estado, i) => (
                <FilaColumna
                  key={estado.id}
                  estado={estado}
                  esPrimera={i === 0}
                  esUltima={i === estados.length - 1}
                  nombreInicial={estados.find((e) => e.esInicial)?.nombre ?? null}
                  ocupado={ocupado}
                  onSubir={() => mover(i, -1)}
                  onBajar={() => mover(i, 1)}
                  onCambio={() => router.refresh()}
                />
              ))}
            </ul>

            <div className="rounded-xl border border-dashed border-border p-3">
              <Label htmlFor="nuevo-estado" className="text-xs text-muted-foreground">
                Nueva columna
              </Label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  id="nuevo-estado"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      crearEstado();
                    }
                  }}
                  placeholder="Ej. Listo para despacho"
                  className="min-w-40 flex-1"
                />
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color de la columna">
                  {COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={nuevoColor === c}
                      aria-label={`Color ${c}`}
                      onClick={() => setNuevoColor(c)}
                      className={cn(
                        "size-6 rounded-full transition-transform",
                        nuevoColor === c
                          ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                          : "hover:scale-110",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <Button size="sm" disabled={ocupado || !nuevoNombre.trim()} onClick={crearEstado}>
                  <Plus className="mr-1 size-4" />
                  Agregar
                </Button>
              </div>
            </div>

            <Banner Icono={Lightbulb} tono="tip">
              <span className="font-medium">Tip:</span> usá nombres simples y claros para que todo tu equipo los
              entienda igual.
            </Banner>
          </SeccionNumerada>

          {/* ── 3. Cómo se agrupa ──────────────────────────────── */}
          <SeccionNumerada
            numero={3}
            titulo="Cómo se agrupa"
            ayuda="Con qué vista y qué rango de entrega abre el tablero por defecto."
          >
            <fieldset>
              <legend className="text-xs text-muted-foreground">Agrupación</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["POR_PEDIDO", "POR_PRODUCTO"] as const).map((a) => (
                  <Opcion key={a} activa={agrupacion === a} onClick={() => setAgrupacion(a)}>
                    {AGRUPACION_PREPARACION_LABELS[a]}
                  </Opcion>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs text-muted-foreground">Rango por defecto</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["HOY", "MANANA", "SEMANA", "PERSONALIZADO"] as const).map((r) => (
                  <Opcion key={r} activa={rango === r} onClick={() => setRango(r)}>
                    {RANGO_PREPARACION_LABELS[r]}
                  </Opcion>
                ))}
              </div>
            </fieldset>
          </SeccionNumerada>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={() => setAbierto(false)} disabled={ocupado}>
            Cancelar
          </Button>
          <Button onClick={guardarTodo} disabled={ocupado}>
            {guardando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
            Guardar configuración
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Una columna del tablero: se ve, se edita en el lugar (nombre y color), se
 * reordena y se borra.
 *
 * El inicial y el final no se pueden borrar — son los extremos de la máquina de
 * estados — así que su botón queda deshabilitado con el motivo a la vista, en
 * vez de fallar recién al confirmar.
 */
function FilaColumna({
  estado,
  esPrimera,
  esUltima,
  nombreInicial,
  ocupado,
  onSubir,
  onBajar,
  onCambio,
}: {
  estado: EstadoPreparacionConUso;
  esPrimera: boolean;
  esUltima: boolean;
  nombreInicial: string | null;
  ocupado: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(estado.nombre);
  const [color, setColor] = useState(estado.color ?? COLORES[0]);
  const [guardando, setGuardando] = useState(false);

  const protegido = estado.esInicial || estado.esFinal;
  const motivoProtegido = estado.esInicial
    ? "No se puede eliminar: es donde entran los pedidos"
    : "No se puede eliminar: es el estado que cierra la preparación";

  const guardar = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    setGuardando(true);
    try {
      const r = await editarColumnaPreparacionAction(estado.id, { nombre: limpio, color });
      if (r.exito) {
        toast.success("Columna actualizada");
        setEditando(false);
        onCambio();
      } else {
        toast.error(r.error);
      }
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = () => {
    setNombre(estado.nombre);
    setColor(estado.color ?? COLORES[0]);
    setEditando(false);
  };

  if (editando) {
    return (
      <li className="rounded-xl border border-primary/50 bg-primary/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void guardar();
              }
              if (e.key === "Escape") cancelar();
            }}
            aria-label={`Nombre de ${estado.nombre}`}
            className="h-8 flex-1"
            autoFocus
          />
          <Button size="icon" className="size-8" disabled={guardando || !nombre.trim()} onClick={guardar} aria-label="Guardar columna">
            {guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" disabled={guardando} onClick={cancelar} aria-label="Cancelar edición">
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-2 flex items-center gap-1.5" role="radiogroup" aria-label="Color de la columna">
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                "size-5 rounded-full transition-transform",
                color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-110",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: estado.color ?? undefined }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{estado.nombre}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaEstado(estado)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={ocupado}
          onClick={() => setEditando(true)}
          aria-label={`Editar ${estado.nombre}`}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={esPrimera || ocupado}
          onClick={onSubir}
          aria-label={`Subir ${estado.nombre}`}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={esUltima || ocupado}
          onClick={onBajar}
          aria-label={`Bajar ${estado.nombre}`}
        >
          <ArrowDown className="size-4" />
        </Button>

        {protegido ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled
            title={motivoProtegido}
            aria-label={motivoProtegido}
          >
            <Lock className="size-4" />
          </Button>
        ) : (
          <ConfirmacionDialog
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                aria-label={`Eliminar ${estado.nombre}`}
              >
                <Trash2 className="size-4" />
              </Button>
            }
            titulo={`¿Eliminar "${estado.nombre}"?`}
            descripcion={
              estado.pedidosAsignados > 0
                ? `Tiene ${estado.pedidosAsignados} pedido(s). Se moverán a "${nombreInicial ?? "la columna inicial"}" y queda registrado en el historial.`
                : "No tiene pedidos asignados. La columna se elimina del tablero."
            }
            onConfirmar={async () => {
              const r = await eliminarEstadoPreparacionAction(estado.id);
              if (r.exito) {
                toast.success(
                  r.datos.pedidosMovidos > 0
                    ? `Columna eliminada · ${r.datos.pedidosMovidos} pedido(s) movidos a "${r.datos.estadoDestinoNombre}"`
                    : "Columna eliminada",
                );
                onCambio();
              } else {
                toast.error(r.error);
              }
            }}
          />
        )}
      </div>
    </li>
  );
}

/** Marcas del estado + cuántos pedidos tiene, en una sola línea legible. */
function metaEstado(estado: EstadoPreparacionConUso): string {
  const partes: string[] = [];
  if (estado.esInicial) partes.push("Estado inicial");
  if (estado.marcaInicio) partes.push("Marca inicio");
  if (estado.esFinal) partes.push("Estado final");
  partes.push(`${estado.pedidosAsignados} pedido${estado.pedidosAsignados === 1 ? "" : "s"}`);
  return partes.join(" · ");
}

function SeccionNumerada({
  numero,
  titulo,
  ayuda,
  children,
}: {
  numero: number;
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-muted/20 p-4">
      <header className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
        >
          {numero}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      </header>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{ayuda}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Banner({
  Icono,
  tono = "info",
  children,
}: {
  Icono: React.ComponentType<{ className?: string }>;
  tono?: "info" | "tip";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-xl border p-3 text-xs",
        tono === "tip"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icono className="mt-0.5 size-4 shrink-0" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

function Opcion({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
        activa
          ? "border-primary/50 bg-primary/10 font-medium text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

