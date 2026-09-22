"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, RotateCcw, Download, HelpCircle, Loader2 } from "lucide-react";
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
import { useNavegacionFiltros } from "@/shared/ui/navegacion-filtros";
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

/** Las tres opciones "vivas": se resuelven en el servidor en cada request, así
 *  que una URL guardada sigue significando "hoy". El rango personalizado, en
 *  cambio, congela dos días concretos y vive en <FiltroRangoFechas>. */
const ENTREGA_OPCIONES = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "manana", etiqueta: "Mañana" },
] as const;

function parametroActivo(searchParams: URLSearchParams): boolean {
  const claves = ["q", "desde", "hasta", "estado", "etapa", "metodo", "contactoId", "productoId", "entrega", "cerrados"];
  return claves.some((k) => searchParams.get(k));
}

export function PedidosFiltrosBar({ contactos, productos, pedidosFiltrados, etapasFlujo, zonaNegocio, cerradosForzados }: PedidosFiltrosProps) {
  const { navegar, pendiente } = useNavegacionFiltros();
  const searchParams = useSearchParams();

  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");
  const [masFiltrosAbierto, setMasFiltrosAbierto] = useState(false);

  const rangoPedido: RangoFechasYmd = {
    desde: searchParams.get("desde"),
    hasta: searchParams.get("hasta"),
  };

  const entregaActiva = searchParams.get("entrega") ?? "todos";
  const rangoEntrega: RangoFechasYmd = {
    desde: searchParams.get("entregaDesde"),
    hasta: searchParams.get("entregaHasta"),
  };

  const hayFiltros = parametroActivo(searchParams);
  const hayFlujoDinamico = etapasFlujo.length > 0;
  const verCerrados = searchParams.get("cerrados") === "1";
  const etapaSeleccionada = etapasFlujo.find((e) => e.id === searchParams.get("etapa"));

  // `navegar` viene de <ProveedorNavegacionFiltros>: envuelve el router en una
  // transición, así que la barra no se reemplaza por el loading.tsx del
  // segmento y la tabla solo se atenúa mientras el servidor responde.
  const actualizarParam = (clave: string, valor: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    navegar(params);
  };

  const handleBuscarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    actualizarParam("q", busqueda || null);
  };

  const handleRangoPedido = (r: RangoFechasYmd) => {
    const params = new URLSearchParams(searchParams.toString());
    if (r.desde) params.set("desde", r.desde); else params.delete("desde");
    if (r.hasta) params.set("hasta", r.hasta); else params.delete("hasta");
    navegar(params);
  };

  const seleccionarEntrega = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor === "todos") {
      params.delete("entrega");
      params.delete("entregaDesde");
      params.delete("entregaHasta");
    } else {
      params.set("entrega", valor);
      if (valor !== "personalizado") {
        params.delete("entregaDesde");
        params.delete("entregaHasta");
      }
    }
    navegar(params);
  };

  const handleRangoEntrega = (r: RangoFechasYmd) => {
    const params = new URLSearchParams(searchParams.toString());
    // Sin ningún extremo el modo "personalizado" no filtraría nada y además
    // dejaría el segmented control sin ninguna opción marcada: equivale a
    // volver a "Todos".
    if (!r.desde && !r.hasta) return seleccionarEntrega("todos");
    params.set("entrega", "personalizado");
    if (r.desde) params.set("entregaDesde", r.desde); else params.delete("entregaDesde");
    if (r.hasta) params.set("entregaHasta", r.hasta); else params.delete("entregaHasta");
    navegar(params);
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    navegar(new URLSearchParams());
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleBuscarSubmit} className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 dark:text-stone-500" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onBlur={() => actualizarParam("q", busqueda || null)}
            placeholder="Buscar pedido, cliente o número..."
            className="pl-9 bg-white dark:bg-white/5 border-stone-200 dark:border-white/10 rounded-xl"
          />
        </form>

        <FiltroRangoFechas
          valor={rangoPedido}
          onChange={handleRangoPedido}
          zonaNegocio={zonaNegocio}
          placeholder="Todas las fechas"
          presets={PRESETS_RANGO_PASADO}
          align="start"
        />

        {hayFlujoDinamico ? (
          <Select value={searchParams.get("etapa") ?? "todos"} onValueChange={(v) => actualizarParam("etapa", v === "todos" ? null : v)}>
            <SelectTrigger className="w-[180px] rounded-xl">
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
          <Select value={searchParams.get("estado") ?? "todos"} onValueChange={(v) => actualizarParam("estado", v === "todos" ? null : v)}>
            <SelectTrigger className="w-[170px] rounded-xl">
              <SelectValue>
                {searchParams.get("estado")
                  ? (ESTADO_PEDIDO_CONFIG[searchParams.get("estado") as EstadoPedido]?.etiqueta ?? searchParams.get("estado"))
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

        <Select value={searchParams.get("metodo") ?? "todos"} onValueChange={(v) => actualizarParam("metodo", v === "todos" ? null : v)}>
          <SelectTrigger className="w-[190px] rounded-xl">
            <SelectValue>
              {searchParams.get("metodo")
                ? (METODO_ENTREGA_LABELS[searchParams.get("metodo")!] ?? searchParams.get("metodo"))
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
        <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 p-1">
          <span className="hidden lg:inline pl-1.5 pr-0.5 text-xs text-stone-400 dark:text-stone-500">Entrega estimada</span>
          {ENTREGA_OPCIONES.map((op) => {
            const activo = entregaActiva === op.valor;
            return (
              <button
                key={op.valor}
                type="button"
                onClick={() => seleccionarEntrega(op.valor)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap",
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
          <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "rounded-xl gap-2")}>
            <SlidersHorizontal className="h-4 w-4" />
            Más filtros
            {(searchParams.get("contactoId") || searchParams.get("productoId")) && (
              <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                Cliente (Contacto)
              </label>
              <Combobox
                opciones={contactos}
                valor={searchParams.get("contactoId") ?? undefined}
                onChange={(v) => actualizarParam("contactoId", v || null)}
                placeholder="Cualquier contacto"
                placeholderBusqueda="Buscar contacto..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                Producto
              </label>
              <Combobox
                opciones={productos}
                valor={searchParams.get("productoId") ?? undefined}
                onChange={(v) => actualizarParam("productoId", v || null)}
                placeholder="Cualquier producto"
                placeholderBusqueda="Buscar producto..."
              />
            </div>
          </PopoverContent>
        </Popover>

        {hayFiltros && (
          <Button variant="ghost" onClick={limpiarFiltros} className="gap-1.5 text-stone-500 dark:text-stone-400">
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        )}

        {/* Los controles siguen habilitados mientras carga, para poder
            encadenar cambios sin esperar cada round-trip. */}
        {pendiente && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Actualizando…
          </span>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-dashed border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] px-4 py-2.5">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          💡 Tip: puedes exportar tus pedidos filtrados desde el menú de acciones.
        </p>
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  "flex items-center gap-2 select-none",
                  cerradosForzados ? "cursor-default opacity-70" : "cursor-pointer"
                )}
                onClick={cerradosForzados ? undefined : () => actualizarParam("cerrados", verCerrados ? null : "1")}
              >
                <Checkbox checked={verCerrados || cerradosForzados} className="pointer-events-none" />
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300">Ver cerrados</span>
                <HelpCircle className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
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
