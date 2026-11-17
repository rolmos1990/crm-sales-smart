"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, RotateCcw, Download, HelpCircle, Info, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import {
  FiltroRangoFechas,
  PRESETS_RANGO_FUTURO,
  PRESETS_RANGO_PASADO,
  type RangoFechasYmd,
} from "@/shared/fechas/components/filtro-rango-fechas";
import { FILTROS_VISTA_PEDIDOS_DEFECTO, type FiltrosVistaPedidos } from "../schema";
import { cn } from "@/lib/utils";
import { ESTADO_PEDIDO_CONFIG } from "../types";
import { METODO_ENTREGA_LABELS } from "../constantes";
import type { Pedido, EstadoPedido } from "../types";
import { exportarPedidosCsv } from "../utils/exportar-csv";

interface EtapaFlujoResumen {
  id: string;
  nombre: string;
  color: string | null;
}

interface PedidosFiltrosProps {
  filtros: FiltrosVistaPedidos;
  onCambiar: (cambios: Partial<FiltrosVistaPedidos>) => void;
  /** Hay una consulta en vuelo para los filtros recién elegidos. */
  actualizando: boolean;
  contactos: OpcionCombobox[];
  productos: OpcionCombobox[];
  pedidosFiltrados: Pedido[];
  /** Etapas del Flujo de Venta dinámico del tenant. Si hay alguna, el
   *  filtro "Estado" se arma con estas etapas (lo que realmente se ve en la
   *  tabla — ver EstadoBadge en lista-pedidos.tsx) en vez del enum legacy,
   *  que con flujo dinámico activo queda congelado y no representa el
   *  estado real del pedido. */
  etapasFlujo: EtapaFlujoResumen[];
  /** Zona de negocio de la instancia. Define qué día es "hoy" para los atajos
   *  de los filtros de fecha — ver docs/fechas-y-zonas-horarias.md. */
  zonaNegocio: string;
  /** Hay un rango de fechas activo, que obliga a mostrar también los pedidos
   *  cerrados aunque el usuario no haya marcado "Ver cerrados" (ver
   *  `hayFiltroFecha` en la página). El checkbox lo refleja en vez de mentir. */
  cerradosForzados: boolean;
}

/** Las tres opciones "vivas": se resuelven en el servidor en cada consulta, en
 *  la zona de negocio. El rango personalizado, en cambio, congela dos días
 *  concretos y vive en <FiltroRangoFechas>. */
const ENTREGA_OPCIONES = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "manana", etiqueta: "Mañana" },
] as const;

export function PedidosFiltrosBar({ filtros, onCambiar, actualizando, contactos, productos, pedidosFiltrados, etapasFlujo, zonaNegocio, cerradosForzados }: PedidosFiltrosProps) {
  const [busqueda, setBusqueda] = useState(filtros.q ?? "");
  const [qPrevia, setQPrevia] = useState(filtros.q);
  // "Limpiar filtros" también existe fuera de la barra (estado vacío).
  if (qPrevia !== filtros.q) {
    setQPrevia(filtros.q);
    setBusqueda(filtros.q ?? "");
  }
  const [masFiltrosAbierto, setMasFiltrosAbierto] = useState(false);

  const rangoPedido: RangoFechasYmd = { desde: filtros.desde, hasta: filtros.hasta };
  const entregaActiva = filtros.entrega;
  const rangoEntrega: RangoFechasYmd = entregaActiva === "personalizado"
    ? { desde: filtros.entregaDesde, hasta: filtros.entregaHasta }
    : { desde: null, hasta: null };

  const hayFiltros = JSON.stringify({ ...filtros, q: filtros.q || null }) !== JSON.stringify(FILTROS_VISTA_PEDIDOS_DEFECTO);
  const hayFlujoDinamico = etapasFlujo.length > 0;
  const verCerrados = filtros.cerrados;
  const etapaSeleccionada = etapasFlujo.find((e) => e.id === filtros.etapa);

  // El filtro cambia en el acto (estado local del padre) y la tabla solo se
  // atenúa mientras llega la consulta — ver useVistaFiltrada.
  type ClaveTexto = "q" | "estado" | "etapa" | "metodo" | "contactoId" | "productoId";
  const actualizarParam = (clave: ClaveTexto, valor: string | null) => onCambiar({ [clave]: valor || null });

  const handleBuscarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    actualizarParam("q", busqueda || null);
  };

  const handleRangoPedido = (r: RangoFechasYmd) => onCambiar({ desde: r.desde, hasta: r.hasta });

  const seleccionarEntrega = (valor: FiltrosVistaPedidos["entrega"]) =>
    onCambiar({ entrega: valor, entregaDesde: null, entregaHasta: null });

  const handleRangoEntrega = (r: RangoFechasYmd) => {
    // Sin ningún extremo el modo "personalizado" no filtraría nada y además
    // dejaría el segmented control sin ninguna opción marcada: equivale a
    // volver a "Todos".
    if (!r.desde && !r.hasta) return seleccionarEntrega("todos");
    onCambiar({ entrega: "personalizado", entregaDesde: r.desde, entregaHasta: r.hasta });
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    onCambiar(FILTROS_VISTA_PEDIDOS_DEFECTO);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Panel de filtros: superficie apenas distinta a la de la página, para
          agrupar los controles sin competir con las KPIs ni con la tabla. */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-border-subtle bg-surface-1 p-3">
        {/* Fila 1 — búsqueda amplia + rango de fechas */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleBuscarSubmit} className="relative min-w-[240px] flex-1 sm:max-w-lg">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onBlur={() => actualizarParam("q", busqueda || null)}
              placeholder="Buscar pedido, cliente o número..."
              className="pl-9"
            />
          </form>

          <FiltroRangoFechas
            valor={rangoPedido}
            onChange={handleRangoPedido}
            zonaNegocio={zonaNegocio}
            placeholder="Todas las fechas"
            presets={PRESETS_RANGO_PASADO}
            align="start"
            className="shrink-0"
          />
        </div>

        {/* Fila 2 — estado, método, entrega estimada, más filtros, limpiar */}
        <div className="flex flex-wrap items-center gap-2">
        {hayFlujoDinamico ? (
          <Select value={filtros.etapa ?? "todos"} onValueChange={(v) => actualizarParam("etapa", v === "todos" ? null : v)}>
            <SelectTrigger className="w-[190px]">
              <SelectValue>
                {etapaSeleccionada ? etapaSeleccionada.nombre : "Estado: Todos"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Estado: Todos</SelectItem>
              {etapasFlujo.map((etapa) => (
                <SelectItem key={etapa.id} value={etapa.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: etapa.color ?? "#78716c" }} />
                    {etapa.nombre}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={filtros.estado ?? "todos"} onValueChange={(v) => actualizarParam("estado", v === "todos" ? null : v)}>
            <SelectTrigger className="w-[190px]">
              <SelectValue>
                {filtros.estado
                  ? (ESTADO_PEDIDO_CONFIG[filtros.estado as EstadoPedido]?.etiqueta ?? filtros.estado)
                  : "Estado: Todos"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Estado: Todos</SelectItem>
              {Object.entries(ESTADO_PEDIDO_CONFIG).map(([valor, cfg]) => (
                <SelectItem key={valor} value={valor}>{cfg.etiqueta}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filtros.metodo ?? "todos"} onValueChange={(v) => actualizarParam("metodo", v === "todos" ? null : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue>
              {filtros.metodo
                ? (METODO_ENTREGA_LABELS[filtros.metodo] ?? filtros.metodo)
                : "Método de envío: Todos"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Método de envío: Todos</SelectItem>
            {Object.entries(METODO_ENTREGA_LABELS).map(([valor, etiqueta]) => (
              <SelectItem key={valor} value={valor}>{etiqueta}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Entrega estimada — segmented control compacto, no 4 botones sueltos */}
        <div className="flex h-8 items-center gap-1 rounded-lg border border-input bg-background p-1 dark:bg-input/30">
          <span className="hidden pr-0.5 pl-1.5 text-xs text-muted-foreground lg:inline">Entrega estimada</span>
          {ENTREGA_OPCIONES.map((op) => {
            const activo = entregaActiva === op.valor;
            return (
              <button
                key={op.valor}
                type="button"
                onClick={() => seleccionarEntrega(op.valor)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  activo
                    ? op.valor === "todos"
                      ? "bg-muted text-foreground"
                      : "bg-primary-muted text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {op.etiqueta}
              </button>
            );
          })}
          <FiltroRangoFechas
            valor={rangoEntrega}
            onChange={handleRangoEntrega}
            onLimpiar={() => seleccionarEntrega("todos")}
            zonaNegocio={zonaNegocio}
            placeholder="Personalizado"
            presets={PRESETS_RANGO_FUTURO}
            align="end"
            compacto
          />
        </div>

        <Popover open={masFiltrosAbierto} onOpenChange={setMasFiltrosAbierto}>
          <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
            <SlidersHorizontal className="h-4 w-4" />
            Más filtros
            {(filtros.contactoId || filtros.productoId) && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Cliente (Contacto)
              </label>
              <Combobox
                opciones={contactos}
                valor={filtros.contactoId ?? undefined}
                onChange={(v) => actualizarParam("contactoId", v || null)}
                placeholder="Cualquier contacto"
                placeholderBusqueda="Buscar contacto..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Producto
              </label>
              <Combobox
                opciones={productos}
                valor={filtros.productoId ?? undefined}
                onChange={(v) => actualizarParam("productoId", v || null)}
                placeholder="Cualquier producto"
                placeholderBusqueda="Buscar producto..."
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Los controles siguen habilitados mientras carga, para poder
            encadenar cambios sin esperar cada round-trip. */}
        {actualizando && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Actualizando…
          </span>
        )}

        {hayFiltros && (
          <Button variant="ghost" onClick={limpiarFiltros} className="ml-auto gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-dashed border-border-subtle bg-background-subtle px-3 py-2">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Tip: puedes exportar tus pedidos filtrados desde el menú de acciones.
        </p>
        <div className="ml-auto flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  "flex items-center gap-2 select-none",
                  cerradosForzados ? "cursor-default opacity-70" : "cursor-pointer"
                )}
                onClick={cerradosForzados ? undefined : () => onCambiar({ cerrados: !verCerrados })}
              >
                <Checkbox checked={verCerrados || cerradosForzados} className="pointer-events-none" />
                <span className="text-xs font-medium text-foreground">Ver cerrados</span>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {cerradosForzados
                  ? "Con un rango de fechas activo se muestran todos los pedidos del rango, incluidos los cerrados — así la lista coincide con los montos de arriba."
                  : "Muestra los pedidos en etapa final o cancelados (cerrados) para ver el historial completo."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 rounded-lg")}>
              <Download className="h-3.5 w-3.5" />
              Exportar
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportarPedidosCsv(pedidosFiltrados)}>
                Exportar a CSV ({pedidosFiltrados.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
