"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, IdCard, Layers, MapPin, Package, Phone, StickyNote, Store, Truck, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FechaHora } from "@/shared/fechas/fecha-hora";
import { METODO_ENTREGA_LABELS } from "@/sales/pedidos/constantes";
import { registrarAvanceLineaAction } from "../actions";
import { lineaCompleta, pedidoCompleto } from "../utils/avance";
import type { DatosEntregaTarjeta, TarjetaPreparacion as Tarjeta } from "../types";

/**
 * - `detalle`: productos con checks y datos de despacho completos — es la que
 *   se usa para armar.
 * - `resumen`: lo esencial para reconocer el pedido; aparece en el modo "solo
 *   el seleccionado" para las tarjetas que no están abiertas.
 * - `preparado`: el resumen de un pedido en la columna final; ya no hay nada
 *   que marcar, así que no repite el listado.
 */
export type VarianteTarjeta = "detalle" | "resumen" | "preparado";

interface Props {
  tarjeta: Tarjeta;
  puedeMod: boolean;
  variante?: VarianteTarjeta;
  /** Resaltado de la tarjeta elegida. Es el único lugar donde la tarjeta usa el
   *  color de acento: con 20-30 pedidos en pantalla, un borde de color en todas
   *  cansa y deja de indicar algo. */
  seleccionada?: boolean;
  /** El tablero pasa false mientras la tarjeta se arrastra (overlay). */
  interactiva?: boolean;
  className?: string;
}

// En una tarjeta no seleccionada se cortan los pedidos muy largos para que la
// columna se siga recorriendo; la seleccionada muestra todo.
const MAX_LINEAS_VISIBLES = 5;

export function TarjetaPreparacion({
  tarjeta,
  puedeMod,
  variante = "detalle",
  seleccionada = false,
  interactiva = true,
  className,
}: Props) {
  const [expandida, setExpandida] = useState(false);

  // Avance local: el check se pinta en el mismo frame del clic y la escritura
  // viaja al servidor por detrás. Esperar la Server Action (que además
  // revalida el tablero entero) hacía que marcar un producto se sintiera
  // lento, que es justo lo contrario de lo que tiene que pasar en un tablero
  // de armado donde se marcan decenas de ítems seguidos.
  const [avanceLocal, setAvanceLocal] = useState<Record<string, number>>({});
  // Última cantidad enviada por línea: si llega el error de una petición vieja
  // (porque el usuario siguió clickeando) no se revierte lo que ya se mostró.
  const ultimoEnviado = useRef<Record<string, number>>({});

  // Reconciliación con el servidor: se descarta lo local SOLO de las líneas que
  // el servidor ya refleja. Si se borrara todo de una, marcar varios ítems
  // seguidos haría parpadear los checks — la revalidación de la primera marca
  // llegaría sin las siguientes, que todavía están viajando.
  useEffect(() => {
    setAvanceLocal((prev) => {
      const pendientes: Record<string, number> = {};
      for (const l of tarjeta.lineas) {
        const local = prev[l.id];
        if (local !== undefined && local !== l.cantidadPreparada) pendientes[l.id] = local;
      }
      return pendientes;
    });
  }, [tarjeta.lineas]);

  const lineas = useMemo(
    () =>
      tarjeta.lineas.map((l) => {
        const cantidadPreparada = avanceLocal[l.id] ?? l.cantidadPreparada;
        return { ...l, cantidadPreparada, completa: lineaCompleta({ cantidad: l.cantidad, cantidadPreparada }) };
      }),
    [tarjeta.lineas, avanceLocal],
  );

  const avanceCompleto = pedidoCompleto(lineas);
  const listas = lineas.filter((l) => l.completa).length;
  const mostrarTodas = expandida || seleccionada;
  const lineasVisibles = mostrarTodas ? lineas : lineas.slice(0, MAX_LINEAS_VISIBLES);
  const ocultas = lineas.length - lineasVisibles.length;
  const editable = puedeMod && interactiva;

  const alternarLinea = async (lineaId: string, cantidad: number, cantidadPreparada: number) => {
    if (!editable) return;
    const objetivo = cantidadPreparada >= cantidad ? 0 : cantidad;
    const previo = cantidadPreparada;

    setAvanceLocal((prev) => ({ ...prev, [lineaId]: objetivo }));
    ultimoEnviado.current[lineaId] = objetivo;

    const r = await registrarAvanceLineaAction(lineaId, objetivo);
    if (!r.exito && ultimoEnviado.current[lineaId] === objetivo) {
      setAvanceLocal((prev) => ({ ...prev, [lineaId]: previo }));
      toast.error(r.error);
    }
  };

  const esDetalle = variante === "detalle";
  const terminado = variante === "preparado" || avanceCompleto;
  const { datosEntrega } = tarjeta;
  const notas = [datosEntrega.observaciones, tarjeta.notas?.trim()].filter(Boolean) as string[];

  return (
    <article
      data-slot="tarjeta-preparacion"
      data-variante={variante}
      data-seleccionada={seleccionada || undefined}
      className={cn(
        "rounded-xl bg-card p-3 shadow-xs ring-1 ring-transparent transition-[background-color,box-shadow]",
        interactiva && !seleccionada && "hover:bg-card-hover",
        seleccionada && "ring-primary/50 shadow-sm",
        className,
      )}
    >
      <header className="flex items-center gap-2">
        <IndicadorAvance terminado={terminado} preparado={variante === "preparado"} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate font-mono text-sm font-semibold text-foreground">{tarjeta.numero}</span>
          {/* Entrega vencida: el pedido se muestra en cualquier rango, así que
              necesita decir por qué está acá. */}
          {tarjeta.atrasado && (
            <span className="shrink-0 rounded-full bg-danger-muted px-1.5 text-[10px] font-medium text-danger-text">
              Atrasado
            </span>
          )}
          {/* Sin fecha de entrega: también se muestra en cualquier rango, pero
              vive en su columna de estado para poder arrastrarse. */}
          {tarjeta.sinFechaEntrega && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              Sin fecha
            </span>
          )}
        </span>
        <FechaHora
          valor={tarjeta.fechaPedido}
          modo="hora"
          className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
        />
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-7">
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{tarjeta.cliente}</span>
        {datosEntrega.nombreDestinatario && (
          <Chip Icono={User} title={`Recibe: ${datosEntrega.nombreDestinatario}`} className="max-w-full">
            Recibe: {datosEntrega.nombreDestinatario}
          </Chip>
        )}
        {esDetalle && datosEntrega.telefono && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="size-3" aria-hidden />
            <span className="sr-only">Teléfono</span>
            {datosEntrega.telefono}
          </span>
        )}
      </div>

      <FilaEntrega
        datos={datosEntrega}
        completa={esDetalle}
        totalProductos={esDetalle ? null : tarjeta.totalProductos}
      />

      {esDetalle && (
        <>
          {datosEntrega.identificacion && (
            <p className="mt-1 flex items-center gap-1 pl-7 text-[11px] text-muted-foreground">
              <IdCard className="size-3 shrink-0" aria-hidden />
              <span className="sr-only">Identificación</span>
              {datosEntrega.identificacion}
            </p>
          )}

          {notas.length > 0 && (
            <div className="mt-2 ml-7 flex gap-2 rounded-lg bg-muted/60 px-2.5 py-2">
              <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {/* Se leen enteras: son instrucciones de armado, truncarlas las
                  vuelve inútiles. */}
              <div className="min-w-0 space-y-1 text-xs leading-snug text-foreground">
                {notas.map((n) => (
                  <p key={n} className="break-words">
                    {n}
                  </p>
                ))}
              </div>
            </div>
          )}

          <ul className="mt-2.5 space-y-1">
            {lineasVisibles.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => alternarLinea(l.id, l.cantidad, l.cantidadPreparada)}
                  aria-pressed={l.completa}
                  aria-label={l.completa ? `Desmarcar ${l.descripcion}` : `Marcar ${l.descripcion} como preparado`}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors",
                    editable ? "hover:bg-muted/60" : "cursor-default",
                  )}
                >
                  <MiniaturaProducto url={l.producto?.imagenUrl ?? null} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs font-medium",
                        l.completa ? "text-muted-foreground line-through" : "text-foreground",
                      )}
                    >
                      {l.cantidad} × {l.descripcion}
                    </span>
                    {/* El parcial es el caso que el check binario no puede contar. */}
                    {!l.completa && l.cantidadPreparada > 0 && (
                      <span className="block text-[11px] text-stage-amber-text">
                        {l.cantidadPreparada} de {l.cantidad} preparadas
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors",
                      l.completa ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                      !editable && "opacity-70",
                    )}
                  >
                    {l.completa && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {ocultas > 0 && (
            <button
              type="button"
              onClick={() => setExpandida(true)}
              className="mt-1 pl-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              +{ocultas} producto{ocultas > 1 ? "s" : ""} más
            </button>
          )}
        </>
      )}

      {variante !== "preparado" && (
        <footer className="mt-2 flex items-center justify-between gap-2 pl-7 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Package className="size-3" aria-hidden />
            {listas}/{lineas.length} listos · {tarjeta.totalUnidades} unidad{tarjeta.totalUnidades === 1 ? "" : "es"}
          </span>
          {tarjeta.fechaEntrega && (
            <span className={cn(tarjeta.atrasado && "text-danger-text")}>
              Entrega: <FechaHora valor={tarjeta.fechaEntrega} modo="corta" />
            </span>
          )}
        </footer>
      )}
    </article>
  );
}

function IndicadorAvance({ terminado, preparado }: { terminado: boolean; preparado: boolean }) {
  if (terminado) {
    return (
      <CheckCircle2
        className={cn("size-5 shrink-0", preparado ? "text-success" : "text-primary")}
        aria-label={preparado ? "Pedido preparado" : "Todos los productos listos"}
      />
    );
  }
  return (
    <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Package className="size-3" />
    </span>
  );
}

/**
 * Método de envío + dirección. El método va como chip porque es lo que decide
 * cómo se arma el paquete; la dirección en segundo plano. En las variantes
 * compactas se le suma el conteo de productos en la misma fila.
 */
function FilaEntrega({
  datos,
  completa,
  totalProductos,
}: {
  datos: DatosEntregaTarjeta;
  completa: boolean;
  totalProductos: number | null;
}) {
  const chip = resolverChipEntrega(datos);
  if (!chip && !datos.direccion && totalProductos === null) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-7 text-xs text-muted-foreground">
      {chip && (
        <Chip Icono={chip.Icono} tono={chip.tono} title={chip.texto}>
          {chip.texto}
        </Chip>
      )}
      {datos.direccion && (
        <span
          title={datos.direccion}
          className={cn("inline-flex min-w-0 items-start gap-1", completa ? "basis-full" : "max-w-[14rem]")}
        >
          <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="sr-only">Dirección</span>
          <span className={cn("min-w-0", completa ? "line-clamp-2 break-words" : "truncate")}>{datos.direccion}</span>
        </span>
      )}
      {totalProductos !== null && (
        <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
          <Layers className="size-3" aria-hidden />
          {totalProductos} producto{totalProductos === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

type ChipEntrega = { texto: string; Icono: typeof Truck; tono: "envio" | "retiro" | "neutro" };

function resolverChipEntrega(datos: DatosEntregaTarjeta): ChipEntrega | null {
  const metodo = datos.metodoEntrega;
  if (!metodo) return null;
  if (metodo === "RETIRO_TIENDA") return { texto: "Retiro en tienda", Icono: Store, tono: "retiro" };
  if (metodo === "COURIER_EXTERNO" || metodo === "MENSAJERO_PROPIO") {
    const quien = datos.transportista ?? METODO_ENTREGA_LABELS[metodo];
    return { texto: `Envío · ${quien}`, Icono: Truck, tono: "envio" };
  }
  return { texto: METODO_ENTREGA_LABELS[metodo] ?? metodo, Icono: Truck, tono: "neutro" };
}

function Chip({
  Icono,
  tono = "neutro",
  title,
  className,
  children,
}: {
  Icono: typeof Truck;
  tono?: ChipEntrega["tono"];
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex min-w-0 max-w-[16rem] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tono === "envio" && "bg-primary/10 text-primary",
        tono === "retiro" && "bg-stage-lavender-muted text-stage-lavender-text",
        tono === "neutro" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icono className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

function MiniaturaProducto({ url }: { url: string | null }) {
  const [rota, setRota] = useState(false);
  if (!url || rota) {
    return (
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Package className="size-3.5" />
      </span>
    );
  }
  return (
    // La URL es de cualquier origen que el comercio haya cargado en su
    // catálogo: next/image exigiría declarar cada dominio en next.config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setRota(true)}
      className="size-8 shrink-0 rounded-md bg-muted object-cover"
    />
  );
}
