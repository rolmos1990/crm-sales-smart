"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, Package } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { eliminarProducto } from "../actions";
import type { Producto } from "../types";

function AccionesProducto({ producto }: { producto: Producto }) {
  const router = useRouter();

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
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/productos/${producto.id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ConfirmacionDialog
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Desactivar
            </DropdownMenuItem>
          }
          titulo="¿Desactivar producto?"
          descripcion={`"${producto.nombre}" se desactivará y no aparecerá en cotizaciones nuevas.`}
          onConfirmar={handleEliminar}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columnas: ColumnDef<Producto>[] = [
  {
    accessorKey: "nombre",
    header: ({ column }) => (
      <button className="flex items-center gap-1 font-medium" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Nombre <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Link href={`/productos/${row.original.id}`} className="font-medium hover:underline">
          {row.original.nombre}
        </Link>
      </div>
    ),
  },
  {
    accessorKey: "categoria",
    header: "Categoría",
    cell: ({ row }) => row.original.categoria ? <Badge variant="secondary">{row.original.categoria}</Badge> : <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "precio",
    header: ({ column }) => (
      <button className="flex items-center gap-1 font-medium ml-auto" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Precio <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {row.original.moneda} {Number(row.original.precio).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
      </div>
    ),
  },
  {
    accessorKey: "unidad",
    header: "Unidad",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.unidad ?? "—"}</span>,
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
  {
    id: "acciones",
    cell: ({ row }) => <AccionesProducto producto={row.original} />,
  },
];

interface ListaProductosProps {
  productos: Producto[];
}

export function ListaProductos({ productos }: ListaProductosProps) {
  return (
    <DataTable
      columnas={columnas}
      datos={productos}
      filtroPor="nombre"
      placeholderFiltro="Buscar productos..."
    />
  );
}
