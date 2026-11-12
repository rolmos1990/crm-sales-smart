"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown, CircleDot, FolderOpen, LayoutGrid, Layers, MonitorSmartphone, MoreHorizontal, Package, Pencil,
  RotateCcw, Search, Settings2, ShoppingCart, Tags, Trash2, Wrench, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataTable } from "@/shared/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { useSesion } from "@/shared/auth/sesion-context";
import { actualizarProducto, eliminarProducto } from "../actions";
import { TIPO_PRODUCTO_LABELS, type ProductoListado, type TipoProducto } from "../types";
import {
  FILTROS_INICIALES, PESTANAS_PRODUCTOS, categoriasDisponibles, contarPorPestana, filtrarProductos, hayFiltrosActivos,
  type EstadoFiltro, type FiltrosProductos, type PestanaProductos, type VentaFiltro,
} from "../filtros-productos";
import { ChipEtiqueta } from "../etiquetas/components/chip-etiqueta";
import { GestorEtiquetasProducto } from "../etiquetas/components/gestor-etiquetas-producto";
import type { EtiquetaProducto } from "../etiquetas/types";
import { FiltroMultiple, FiltroUnico } from "./filtros-barra";

type Icono = ComponentType<{ className?: string }>;

const ICONO_PESTANA: Record<PestanaProductos, Icono> = {
  TODOS: LayoutGrid,
  COMBOS: Layers,
  VENTA_DIRECTA: ShoppingCart,
  SERVICIOS: Wrench,
  DIGITALES: MonitorSmartphone,
};

const ICONO_TIPO: Record<TipoProducto, Icono> = { FISICO: Package, SERVICIO: Wrench, DIGITAL: MonitorSmartphone };

const TONOS = {
  violeta: "border-stage-purple-border bg-stage-purple-muted text-stage-purple-text",
  lavanda: "border-stage-lavender-border bg-stage-lavender-muted text-stage-lavender-text",
  cian: "border-stage-cyan-border bg-stage-cyan-muted text-stage-cyan-text",
  ambar: "border-stage-amber-border bg-stage-amber-muted text-stage-amber-text",
  exito: "border-success-border bg-success-muted text-success-text",
  peligro: "border-danger-border bg-danger-muted text-danger-text",
  neutro: "border-border bg-muted text-muted-foreground",
} as const;

function Pildora({ Icono, tono, children, title }: { Icono?: Icono; tono: keyof typeof TONOS; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONOS[tono])}
    >
      {Icono && <Icono className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

function ImagenProducto({ src, nombre }: { src: string | null; nombre: string }) {
  const [fallo, setFallo] = useState(false);
  if (!src || fallo) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
        <Package className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={nombre} onError={() => setFallo(true)} className="h-9 w-9 shrink-0 rounded-lg border border-border bg-muted object-cover" />
  );
}

function AccionesProducto({ producto }: { producto: ProductoListado }) {
  const router = useRouter();
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);

  const desactivar = async () => {
    const r = await eliminarProducto(producto.id);
    if (r.exito) toast.success("Producto desactivado");
    else toast.error(r.error);
  };

  const reactivar = async () => {
    const r = await actualizarProducto(producto.id, { activo: true });
    if (r.exito) toast.success("Producto reactivado");
    else toast.error(r.error);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg outline-none transition-all hover:bg-muted hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/productos/${producto.id}/editar`)}>
            <Pencil className="mr-2 h-4 w-4" />Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {producto.activo ? (
            <DropdownMenuItem onClick={() => setConfirmarDesactivar(true)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Desactivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={reactivar}>
              <RotateCcw className="mr-2 h-4 w-4" />Reactivar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmacionDialog
        open={confirmarDesactivar}
        onOpenChange={setConfirmarDesactivar}
        titulo="¿Desactivar producto?"
        descripcion={`"${producto.nombre}" se desactivará y no aparecerá en cotizaciones nuevas. Puedes reactivarlo desde el filtro Estado.`}
        textoConfirmar="Desactivar"
        onConfirmar={desactivar}
      />
    </>
  );
}

function EncabezadoOrdenable({ titulo, onClick, className }: { titulo: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={cn("flex items-center gap-1 font-semibold uppercase", className)} onClick={onClick}>
      {titulo} <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

function CeldaStock({ producto }: { producto: ProductoListado }) {
  if (producto.tipo !== "FISICO" && !producto.esCombo) return <span className="text-muted-foreground">—</span>;
  if (producto.stock === null) {
    return (
      <span className="text-xs text-muted-foreground" title="No controla inventario">
        Sin control
      </span>
    );
  }
  const agotado = producto.stock <= 0;
  return (
    <span
      className={cn("tabular-nums text-sm", agotado ? "font-medium text-danger-text" : "text-foreground")}
      title={producto.esCombo ? "Calculado con el stock de sus componentes" : undefined}
    >
      {agotado ? "Agotado" : producto.stock.toLocaleString("es-PE")}
      {producto.esCombo && <span className="ml-1 text-xs font-normal text-muted-foreground">(combos)</span>}
    </span>
  );
}

const MAX_ETIQUETAS_FILA = 3;

const columnasFijas: ColumnDef<ProductoListado>[] = [
  {
    accessorKey: "nombre",
    header: ({ column }) => <EncabezadoOrdenable titulo="Producto" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
    cell: ({ row }) => (
      <div className="flex min-w-48 items-center gap-2.5">
        <ImagenProducto src={row.original.imagenUrl} nombre={row.original.nombre} />
        <div className="min-w-0">
          <span className={cn("block truncate font-medium leading-tight", !row.original.activo && "text-muted-foreground")}>
            {row.original.nombre}
          </span>
          {row.original.descripcion && <p className="max-w-xs truncate text-xs text-muted-foreground">{row.original.descripcion}</p>}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) =>
      row.original.sku ? (
        <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{row.original.sku}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "tipo",
    header: "Tipo",
    cell: ({ row }) =>
      row.original.esCombo ? (
        <Pildora Icono={Layers} tono="lavanda" title="Se arma con otros productos; su stock sale de ellos">
          Combo
        </Pildora>
      ) : (
        <Pildora Icono={ICONO_TIPO[row.original.tipo]} tono={row.original.tipo === "FISICO" ? "violeta" : "cian"}>
          {TIPO_PRODUCTO_LABELS[row.original.tipo]}
        </Pildora>
      ),
  },
  {
    id: "venta",
    header: "Venta",
    cell: ({ row }) =>
      row.original.ventaDirecta ? (
        <Pildora Icono={ShoppingCart} tono="exito">Venta directa</Pildora>
      ) : (
        <Pildora Icono={Layers} tono="neutro" title="No se ofrece suelto: solo como parte de un combo">
          Solo en combos
        </Pildora>
      ),
  },
  {
    accessorKey: "categoria",
    header: "Categoría",
    cell: ({ row }) =>
      row.original.categoria ? (
        <Pildora Icono={FolderOpen} tono="neutro">{row.original.categoria}</Pildora>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "etiquetas",
    header: "Etiquetas",
    cell: ({ row }) => {
      const { etiquetas } = row.original;
      if (etiquetas.length === 0) return <span className="text-muted-foreground">—</span>;
      const resto = etiquetas.slice(MAX_ETIQUETAS_FILA);
      return (
        <div className="flex max-w-64 flex-wrap gap-1">
          {etiquetas.slice(0, MAX_ETIQUETAS_FILA).map((e) => (
            <ChipEtiqueta key={e.id} etiqueta={e} />
          ))}
          {resto.length > 0 && (
            <span className="rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground" title={resto.map((e) => e.nombre).join(", ")}>
              +{resto.length}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "precio",
    header: ({ column }) => (
      <EncabezadoOrdenable titulo="Precio" className="ml-auto" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
    ),
    cell: ({ row }) => (
      <div className="text-right font-semibold whitespace-nowrap tabular-nums text-foreground">
        {row.original.moneda} {row.original.precio.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        {row.original.unidad && <span className="ml-1 text-xs font-normal text-muted-foreground">/{row.original.unidad}</span>}
      </div>
    ),
  },
  {
    id: "stock",
    header: "Stock",
    cell: ({ row }) => <CeldaStock producto={row.original} />,
  },
  {
    accessorKey: "activo",
    header: "Estado",
    cell: ({ row }) =>
      row.original.activo ? <Pildora tono="exito">Activo</Pildora> : <Pildora tono="neutro">Inactivo</Pildora>,
  },
];

const OPCIONES_ESTADO: { valor: EstadoFiltro; etiqueta: string }[] = [
  { valor: "ACTIVOS", etiqueta: "Activos" },
  { valor: "INACTIVOS", etiqueta: "Inactivos" },
  { valor: "TODOS", etiqueta: "Todos" },
];
const OPCIONES_TIPO: { valor: FiltrosProductos["tipo"]; etiqueta: string }[] = [
  { valor: "TODOS", etiqueta: "Todos" },
  { valor: "FISICO", etiqueta: TIPO_PRODUCTO_LABELS.FISICO },
  { valor: "SERVICIO", etiqueta: TIPO_PRODUCTO_LABELS.SERVICIO },
  { valor: "DIGITAL", etiqueta: TIPO_PRODUCTO_LABELS.DIGITAL },
];
const OPCIONES_VENTA: { valor: VentaFiltro; etiqueta: string }[] = [
  { valor: "TODOS", etiqueta: "Todos" },
  { valor: "VENTA_DIRECTA", etiqueta: "Venta directa" },
  { valor: "SOLO_COMBOS", etiqueta: "Solo en combos" },
];

interface ListaProductosProps {
  productos: ProductoListado[];
  etiquetas: EtiquetaProducto[];
}

export function ListaProductos({ productos, etiquetas }: ListaProductosProps) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("productos");
  const [filtros, setFiltros] = useState<FiltrosProductos>(FILTROS_INICIALES);
  const [gestorAbierto, setGestorAbierto] = useState(false);

  const cambiar = (cambios: Partial<FiltrosProductos>) => setFiltros((f) => ({ ...f, ...cambios }));
  const alternarEtiqueta = (id: string) =>
    cambiar({
      etiquetaIds: filtros.etiquetaIds.includes(id) ? filtros.etiquetaIds.filter((x) => x !== id) : [...filtros.etiquetaIds, id],
    });

  const visibles = useMemo(() => filtrarProductos(productos, filtros), [productos, filtros]);
  const conteos = useMemo(() => contarPorPestana(productos, filtros), [productos, filtros]);
  const categorias = useMemo(() => categoriasDisponibles(productos), [productos]);

  const columnas: ColumnDef<ProductoListado>[] = [
    ...columnasFijas,
    ...(puedeMod
      ? [{ id: "acciones", cell: ({ row }: { row: { original: ProductoListado } }) => <AccionesProducto producto={row.original} /> }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4" data-slot="lista-productos">
      {/* Pestañas */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tipo de catálogo">
        {PESTANAS_PRODUCTOS.map(({ valor, etiqueta }) => {
          const Icono = ICONO_PESTANA[valor];
          const activa = filtros.pestana === valor;
          return (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => cambiar({ pestana: valor })}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                activa
                  ? "border-stage-purple-border bg-stage-purple-muted font-medium text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icono className="h-4 w-4" />
              {etiqueta}
              <span className="text-xs tabular-nums opacity-70">({conteos[valor]})</span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:min-w-64 sm:flex-1 lg:max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filtros.busqueda}
            onChange={(e) => cambiar({ busqueda: e.target.value })}
            placeholder="Buscar por nombre, SKU, etiqueta…"
            aria-label="Buscar productos"
            className="h-9 rounded-xl pl-9"
          />
        </div>
        <FiltroUnico Icono={CircleDot} etiqueta="Estado" valor={filtros.estado} opciones={OPCIONES_ESTADO} porDefecto="ACTIVOS" onChange={(estado) => cambiar({ estado })} />
        <FiltroUnico Icono={Layers} etiqueta="Tipo" valor={filtros.tipo} opciones={OPCIONES_TIPO} porDefecto="TODOS" onChange={(tipo) => cambiar({ tipo })} />
        <FiltroUnico Icono={ShoppingCart} etiqueta="Venta" valor={filtros.venta} opciones={OPCIONES_VENTA} porDefecto="TODOS" onChange={(venta) => cambiar({ venta })} />
        <FiltroMultiple
          Icono={FolderOpen}
          etiqueta="Categoría"
          seleccionados={filtros.categorias}
          opciones={categorias.map((c) => ({ valor: c, etiqueta: c }))}
          onChange={(categorias) => cambiar({ categorias })}
          vacio="Ningún producto tiene categoría."
        />
        <FiltroMultiple
          Icono={Tags}
          etiqueta="Etiquetas"
          seleccionados={filtros.etiquetaIds}
          opciones={etiquetas.map((e) => ({ valor: e.id, etiqueta: e.nombre, color: e.color }))}
          onChange={(etiquetaIds) => cambiar({ etiquetaIds })}
          vacio="Aún no hay etiquetas."
          nota={filtros.etiquetaIds.length > 1 ? "Con todas las elegidas" : undefined}
        />
        {hayFiltrosActivos(filtros) && (
          <button
            type="button"
            onClick={() => setFiltros({ ...FILTROS_INICIALES, pestana: filtros.pestana })}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* Etiquetas rápidas */}
      {(etiquetas.length > 0 || puedeMod) && (
        <div className="flex flex-wrap items-center gap-2">
          {etiquetas.length > 0 && <span className="text-xs font-medium text-muted-foreground">Etiquetas rápidas:</span>}
          {etiquetas.map((e) => (
            <ChipEtiqueta key={e.id} etiqueta={e} activa={filtros.etiquetaIds.includes(e.id)} onClick={() => alternarEtiqueta(e.id)} />
          ))}
          {puedeMod && (
            <button
              type="button"
              onClick={() => setGestorAbierto(true)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <Settings2 className="h-3 w-3" />
              {etiquetas.length > 0 ? "Gestionar etiquetas" : "Crear etiquetas para clasificar tu catálogo"}
            </button>
          )}
        </div>
      )}

      <DataTable columnas={columnas} datos={visibles} opcionesTamanoPagina={[25, 50, 100]} />

      {puedeMod && <GestorEtiquetasProducto etiquetas={etiquetas} abierto={gestorAbierto} onAbiertoChange={setGestorAbierto} />}
    </div>
  );
}
