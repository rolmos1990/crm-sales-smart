"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Trash2, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DataTable } from "@/shared/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { eliminarPedido, actualizarEstadoPedido } from "../actions";
import type { Pedido, EstadoPedido } from "../types";
import { ESTADO_PEDIDO_CONFIG } from "../types";
import { cn } from "@/lib/utils";

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(valor);

function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  const config = ESTADO_PEDIDO_CONFIG[estado];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.color)}>
      {config.etiqueta}
    </span>
  );
}

function AccionesPedido({ pedido }: { pedido: Pedido }) {
  const router = useRouter();

  const SIGUIENTE_ESTADO: Partial<Record<EstadoPedido, EstadoPedido>> = {
    PENDIENTE: "CONFIRMADO",
    CONFIRMADO: "EN_PROCESO",
    EN_PROCESO: "ENVIADO",
    ENVIADO: "ENTREGADO",
  };

  const siguiente = SIGUIENTE_ESTADO[pedido.estado];

  const handleAvanzar = async () => {
    if (!siguiente) return;
    const resultado = await actualizarEstadoPedido(pedido.id, { estado: siguiente });
    if (resultado.exito) toast.success(`Estado actualizado a ${ESTADO_PEDIDO_CONFIG[siguiente].etiqueta}`);
    else toast.error(resultado.error);
  };

  const handleEliminar = async () => {
    const resultado = await eliminarPedido(pedido.id);
    if (resultado.exito) toast.success("Pedido eliminado");
    else toast.error(resultado.error);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/sales/pedidos/${pedido.id}`)}>Ver detalle</DropdownMenuItem>
        {siguiente && (
          <DropdownMenuItem onClick={handleAvanzar}>
            → {ESTADO_PEDIDO_CONFIG[siguiente].etiqueta}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <ConfirmacionDialog
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Eliminar
            </DropdownMenuItem>
          }
          titulo="¿Eliminar pedido?"
          descripcion={`Se eliminará el pedido ${pedido.numero}.`}
          onConfirmar={handleEliminar}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columnas: ColumnDef<Pedido>[] = [
  {
    accessorKey: "numero",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Número <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link href={`/sales/pedidos/${row.original.id}`} className="font-mono font-medium hover:underline">
        {row.original.numero}
      </Link>
    ),
  },
  {
    accessorKey: "empresa",
    header: "Cliente",
    cell: ({ row }) => (
      <div className="text-sm">
        {row.original.empresa && <p className="font-medium">{row.original.empresa.nombre}</p>}
        {row.original.contacto && (
          <p className="text-muted-foreground">{row.original.contacto.nombre} {row.original.contacto.apellido}</p>
        )}
        {!row.original.empresa && !row.original.contacto && <span className="text-muted-foreground">—</span>}
      </div>
    ),
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums">{formatearMoneda(row.original.total, row.original.moneda)}</span>
    ),
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ getValue }) => <EstadoBadge estado={getValue<EstadoPedido>()} />,
  },
  {
    accessorKey: "fechaPedido",
    header: "Fecha",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(getValue<Date>()), "dd MMM yyyy", { locale: es })}
      </span>
    ),
  },
  {
    id: "acciones",
    cell: ({ row }) => <AccionesPedido pedido={row.original} />,
  },
];

export function ListaPedidos({ pedidos }: { pedidos: Pedido[] }) {
  return <DataTable columnas={columnas} datos={pedidos} filtroPor="numero" placeholderFiltro="Buscar pedido..." />;
}
