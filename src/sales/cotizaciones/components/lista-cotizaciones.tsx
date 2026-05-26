"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, Send, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DataTable } from "@/shared/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { eliminarCotizacion, cambiarEstadoCotizacion, aprobarCotizacion } from "../actions";
import type { Cotizacion, EstadoCotizacion } from "../types";
import { ESTADO_COTIZACION_CONFIG } from "../types";

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(valor);

function AccionesCotizacion({ cotizacion }: { cotizacion: Cotizacion }) {
  const router = useRouter();

  const handleEnviar = async () => {
    const resultado = await cambiarEstadoCotizacion(cotizacion.id, "ENVIADA");
    if (resultado.exito) toast.success("Cotización marcada como enviada");
    else toast.error(resultado.error);
  };

  const handleAprobar = async () => {
    const resultado = await aprobarCotizacion(cotizacion.id);
    if (resultado.exito) {
      const { pedidoId, numeroPedido } = resultado.datos;
      toast.success(`Pedido ${numeroPedido} generado`, {
        description: "La cotización fue aprobada y el pedido fue creado.",
        action: {
          label: "Ver pedido",
          onClick: () => router.push(`/sales/pedidos/${pedidoId}`),
        },
        duration: 8000,
      });
    } else {
      toast.error("No se pudo aprobar", { description: resultado.error, duration: 7000 });
    }
  };

  const handleEliminar = async () => {
    const resultado = await eliminarCotizacion(cotizacion.id);
    if (resultado.exito) toast.success("Cotización eliminada");
    else toast.error(resultado.error);
  };

  const puedeAprobar = cotizacion.estado === "ENVIADA" || cotizacion.estado === "BORRADOR";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/sales/cotizaciones/${cotizacion.id}`)}>
          <ExternalLink className="mr-2 h-4 w-4" />Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/sales/cotizaciones/${cotizacion.id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />Editar
        </DropdownMenuItem>
        {cotizacion.estado === "BORRADOR" && (
          <DropdownMenuItem onClick={handleEnviar}>
            <Send className="mr-2 h-4 w-4" />Marcar enviada
          </DropdownMenuItem>
        )}
        {puedeAprobar && (
          <ConfirmacionDialog
            trigger={
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-emerald-600 dark:text-emerald-400 focus:text-emerald-700 dark:focus:text-emerald-300"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />Aprobar y generar pedido
              </DropdownMenuItem>
            }
            titulo="¿Aprobar cotización?"
            descripcion={`Se aprobará la cotización ${cotizacion.numero} y se generará un pedido confirmado automáticamente. Si algún producto no tiene stock suficiente, la operación fallará.`}
            onConfirmar={handleAprobar}
          />
        )}
        <DropdownMenuSeparator />
        <ConfirmacionDialog
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Eliminar
            </DropdownMenuItem>
          }
          titulo="¿Eliminar cotización?"
          descripcion={`Se eliminará la cotización ${cotizacion.numero}.`}
          onConfirmar={handleEliminar}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columnas: ColumnDef<Cotizacion>[] = [
  {
    accessorKey: "numero",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Número <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link href={`/sales/cotizaciones/${row.original.id}`} className="font-mono font-medium hover:underline">
        {row.original.numero}
      </Link>
    ),
  },
  {
    accessorKey: "empresa",
    header: "Empresa / Contacto",
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
    cell: ({ getValue }) => {
      const estado = getValue<EstadoCotizacion>();
      const config = ESTADO_COTIZACION_CONFIG[estado];
      return <Badge variant={config.variante}>{config.etiqueta}</Badge>;
    },
  },
  {
    accessorKey: "fechaEmision",
    header: "Emisión",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(getValue<Date>()), "dd MMM yyyy", { locale: es })}
      </span>
    ),
  },
  {
    id: "acciones",
    cell: ({ row }) => <AccionesCotizacion cotizacion={row.original} />,
  },
];

export function ListaCotizaciones({ cotizaciones }: { cotizaciones: Cotizacion[] }) {
  return <DataTable columnas={columnas} datos={cotizaciones} filtroPor="numero" placeholderFiltro="Buscar cotización..." />;
}
