"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, Package, ImageIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/shared/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { useSesion } from "@/shared/auth/sesion-context";
import { eliminarProducto } from "../actions";
import type { Producto } from "../types";

function ImagenProducto({ src, nombre }: { src: string | null; nombre: string }) {
  if (!src) {
    return (
      <div className="h-8 w-8 rounded-lg bg-stone-100 dark:bg-white/8 border border-stone-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
        <Package className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={nombre}
      className="h-8 w-8 rounded-lg object-cover flex-shrink-0 border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function AccionesProducto({ producto }: { producto: Producto }) {
  const router = useRouter();
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);

  const handleEliminar = async () => {
    const resultado = await eliminarProducto(producto.id);
    if (resultado.exito) {
      toast.success("Producto desactivado");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Acciones</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/productos/${producto.id}/editar`)}>
            <Pencil className="mr-2 h-4 w-4" />Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmarDesactivar(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />Desactivar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmacionDialog
        open={confirmarDesactivar}
        onOpenChange={setConfirmarDesactivar}
        titulo="¿Desactivar producto?"
        descripcion={`"${producto.nombre}" se desactivará y no aparecerá en cotizaciones nuevas.`}
        textoConfirmar="Desactivar"
        onConfirmar={handleEliminar}
      />
    </>
  );
}

const columnasFijas: ColumnDef<Producto>[] = [
  {
    accessorKey: "nombre",
    header: ({ column }) => (
      <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Producto <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <ImagenProducto src={row.original.imagenUrl} nombre={row.original.nombre} />
        <div className="min-w-0">
          <span className="font-medium leading-tight truncate block">
            {row.original.nombre}
          </span>
          {row.original.descripcion && (
            <p className="text-xs text-stone-400 dark:text-stone-500 truncate max-w-xs">
              {row.original.descripcion}
            </p>
          )}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => row.original.sku
      ? <span className="font-mono text-xs bg-stone-100 dark:bg-white/8 border border-stone-200 dark:border-white/10 px-2 py-0.5 rounded-md text-stone-700 dark:text-stone-300">{row.original.sku}</span>
      : <span className="text-stone-400 dark:text-stone-600">—</span>,
  },
  {
    accessorKey: "categoria",
    header: "Categoría",
    cell: ({ row }) => row.original.categoria
      ? <Badge variant="secondary">{row.original.categoria}</Badge>
      : <span className="text-stone-400 dark:text-stone-600">—</span>,
  },
  {
    accessorKey: "precio",
    header: ({ column }) => (
      <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Precio <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    ),
    cell: ({ row }) => (
      <div className="text-right font-semibold tabular-nums text-stone-900 dark:text-stone-100">
        {row.original.moneda} {Number(row.original.precio).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
        {row.original.unidad && (
          <span className="ml-1 text-xs font-normal text-stone-400 dark:text-stone-500">/{row.original.unidad}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "activo",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.activo ? "default" : "secondary"}>
        {row.original.activo ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
];

interface ListaProductosProps {
  productos: Producto[];
}

export function ListaProductos({ productos }: ListaProductosProps) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("productos");

  const columnas: ColumnDef<Producto>[] = [
    ...columnasFijas,
    ...(puedeMod
      ? [{ id: "acciones", cell: ({ row }: { row: { original: Producto } }) => <AccionesProducto producto={row.original} /> }]
      : []),
  ];

  return (
    <DataTable
      columnas={columnas}
      datos={productos}
      filtroPor="nombre"
      placeholderFiltro="Buscar por nombre, SKU..."
    />
  );
}
