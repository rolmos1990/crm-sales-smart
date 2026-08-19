"use client";

import { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Search, Calendar as CalendarIcon, SlidersHorizontal, RotateCcw, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Combobox, type OpcionCombobox } from "@/shared/ui/combobox";
import { cn } from "@/lib/utils";
import { ESTADO_PEDIDO_CONFIG } from "../types";
import { METODO_ENTREGA_LABELS } from "../constantes";
import type { Pedido } from "../types";
import { exportarPedidosCsv } from "../utils/exportar-csv";

interface PedidosFiltrosProps {
  contactos: OpcionCombobox[];
  productos: OpcionCombobox[];
  pedidosFiltrados: Pedido[];
}

function parametroActivo(searchParams: URLSearchParams): boolean {
  const claves = ["q", "desde", "hasta", "estado", "metodo", "contactoId", "productoId"];
  return claves.some((k) => searchParams.get(k));
}

export function PedidosFiltrosBar({ contactos, productos, pedidosFiltrados }: PedidosFiltrosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");
  const [masFiltrosAbierto, setMasFiltrosAbierto] = useState(false);
  const [rangoAbierto, setRangoAbierto] = useState(false);

  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const rango: DateRange | undefined = useMemo(
    () => (desde || hasta ? { from: desde ? new Date(desde) : undefined, to: hasta ? new Date(hasta) : undefined } : undefined),
    [desde, hasta]
  );

  const hayFiltros = parametroActivo(searchParams);

  const actualizarParam = (clave: string, valor: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleBuscarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    actualizarParam("q", busqueda || null);
  };

  const handleRango = (r: DateRange | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (r?.from) params.set("desde", format(r.from, "yyyy-MM-dd")); else params.delete("desde");
    if (r?.to) params.set("hasta", format(r.to, "yyyy-MM-dd")); else params.delete("hasta");
    router.push(`${pathname}?${params.toString()}`);
    if (r?.from && r?.to) setRangoAbierto(false);
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

        <Select value={searchParams.get("estado") ?? "todos"} onValueChange={(v) => actualizarParam("estado", v === "todos" ? null : v)}>
          <SelectTrigger className="w-[170px] rounded-xl"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Estado: Todos</SelectItem>
            {Object.entries(ESTADO_PEDIDO_CONFIG).map(([valor, cfg]) => (
              <SelectItem key={valor} value={valor}>{cfg.etiqueta}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={searchParams.get("metodo") ?? "todos"} onValueChange={(v) => actualizarParam("metodo", v === "todos" ? null : v)}>
          <SelectTrigger className="w-[190px] rounded-xl"><SelectValue placeholder="Método de envío" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Método de envío: Todos</SelectItem>
            {Object.entries(METODO_ENTREGA_LABELS).map(([valor, etiqueta]) => (
              <SelectItem key={valor} value={valor}>{etiqueta}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
  );
}
