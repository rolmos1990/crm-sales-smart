"use client";

import { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Search, Calendar as CalendarIcon, SlidersHorizontal, RotateCcw, Download, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
}

const ENTREGA_OPCIONES = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "manana", etiqueta: "Mañana" },
  { valor: "personalizado", etiqueta: "Personalizado" },
] as const;

function parametroActivo(searchParams: URLSearchParams): boolean {
  const claves = ["q", "desde", "hasta", "estado", "etapa", "metodo", "contactoId", "productoId", "entrega", "cerrados"];
  return claves.some((k) => searchParams.get(k));
}

export function PedidosFiltrosBar({ contactos, productos, pedidosFiltrados, etapasFlujo }: PedidosFiltrosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");
  const [masFiltrosAbierto, setMasFiltrosAbierto] = useState(false);
  const [rangoAbierto, setRangoAbierto] = useState(false);
  const [entregaPersonalizadaAbierta, setEntregaPersonalizadaAbierta] = useState(false);

  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const rango: DateRange | undefined = useMemo(
    () => (desde || hasta ? { from: desde ? new Date(desde) : undefined, to: hasta ? new Date(hasta) : undefined } : undefined),
    [desde, hasta]
  );

  const entregaActiva = searchParams.get("entrega") ?? "todos";
  const entregaDesdeStr = searchParams.get("entregaDesde");
  const entregaHastaStr = searchParams.get("entregaHasta");
  const rangoEntrega: DateRange | undefined = useMemo(
    () => (entregaDesdeStr || entregaHastaStr
      ? { from: entregaDesdeStr ? new Date(`${entregaDesdeStr}T00:00:00`) : undefined, to: entregaHastaStr ? new Date(`${entregaHastaStr}T00:00:00`) : undefined }
      : undefined),
    [entregaDesdeStr, entregaHastaStr]
  );

  const hayFiltros = parametroActivo(searchParams);
  const hayFlujoDinamico = etapasFlujo.length > 0;
  const verCerrados = searchParams.get("cerrados") === "1";
  const etapaSeleccionada = etapasFlujo.find((e) => e.id === searchParams.get("etapa"));

  // Importante: si `params` queda vacío, hay que pushear el pathname solo
  // (sin "?" colgante) — un "?" vacío al final produce la misma URL visible
  // que el navegador ya normaliza, y el router puede no disparar la
  // navegación (ej. limpiar el único filtro activo no hacía nada).
  const navegarConParams = (params: URLSearchParams) => {
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const actualizarParam = (clave: string, valor: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    navegarConParams(params);
  };

  const handleBuscarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    actualizarParam("q", busqueda || null);
  };

  const handleRango = (r: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (r?.from) params.set("desde", format(r.from, "yyyy-MM-dd")); else params.delete("desde");
    if (r?.to) params.set("hasta", format(r.to, "yyyy-MM-dd")); else params.delete("hasta");
    navegarConParams(params);
    if (r?.from && r?.to) setRangoAbierto(false);
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
    navegarConParams(params);
  };

  const handleRangoEntrega = (r: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("entrega", "personalizado");
    if (r?.from) params.set("entregaDesde", format(r.from, "yyyy-MM-dd")); else params.delete("entregaDesde");
    if (r?.to) params.set("entregaHasta", format(r.to, "yyyy-MM-dd")); else params.delete("entregaHasta");
    navegarConParams(params);
    if (r?.from && r?.to) setEntregaPersonalizadaAbierta(false);
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    router.push(pathname);
  };

  const etiquetaRango = rango?.from
    ? rango.to
      ? `${format(rango.from, "dd MMM yyyy", { locale: es })} - ${format(rango.to, "dd MMM yyyy", { locale: es })}`
      : format(rango.from, "dd MMM yyyy", { locale: es })
    : "Todas las fechas";

  const etiquetaEntregaPersonalizada = rangoEntrega?.from
    ? rangoEntrega.to && rangoEntrega.to.getTime() !== rangoEntrega.from.getTime()
      ? `${format(rangoEntrega.from, "dd MMM", { locale: es })} - ${format(rangoEntrega.to, "dd MMM", { locale: es })}`
      : format(rangoEntrega.from, "dd MMM yyyy", { locale: es })
    : "Personalizado";

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

        <Popover open={rangoAbierto} onOpenChange={setRangoAbierto}>
          <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "rounded-xl gap-2 justify-start font-normal")}>
            <CalendarIcon className="h-4 w-4 text-stone-400" />
            {etiquetaRango}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="range"
              selected={rango}
              onSelect={handleRango}
              defaultMonth={rango?.from ?? new Date()}
              numberOfMonths={2}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              locale={es as any}
            />
          </PopoverContent>
        </Popover>

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
            if (op.valor === "personalizado") {
              return (
                <Popover key={op.valor} open={entregaPersonalizadaAbierta} onOpenChange={setEntregaPersonalizadaAbierta}>
                  <PopoverTrigger
                    className={cn(
                      "px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap",
                      activo
                        ? "bg-lime-500/15 text-lime-700 dark:text-lime-400"
                        : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5"
                    )}
                  >
                    {activo ? etiquetaEntregaPersonalizada : op.etiqueta}
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      mode="range"
                      selected={rangoEntrega}
                      onSelect={handleRangoEntrega}
                      defaultMonth={rangoEntrega?.from ?? new Date()}
                      numberOfMonths={2}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      locale={es as any}
                    />
                  </PopoverContent>
                </Popover>
              );
            }
            return (
              <button
                key={op.valor}
                type="button"
                onClick={() => seleccionarEntrega(op.valor)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap",
                  activo
                    ? op.valor === "todos"
                      ? "bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-200"
                      : "bg-lime-500/15 text-lime-700 dark:text-lime-400"
                    : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5"
                )}
              >
                {op.etiqueta}
              </button>
            );
          })}
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
      </div>

      <div className="flex items-center justify-between rounded-xl border border-dashed border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.03] px-4 py-2.5">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          💡 Tip: puedes exportar tus pedidos filtrados desde el menú de acciones.
        </p>
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => actualizarParam("cerrados", verCerrados ? null : "1")}
              >
                <Checkbox checked={verCerrados} className="pointer-events-none" />
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300">Ver cerrados</span>
                <HelpCircle className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                Muestra los pedidos en etapa final o cancelados (cerrados) para ver el historial completo.
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
