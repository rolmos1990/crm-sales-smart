"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, Send, CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DataTable } from "@/shared/ui/data-table";
import { useSesion } from "@/shared/auth/sesion-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { eliminarCotizacion, cambiarEstadoCotizacion, aprobarCotizacion, confirmarCotizacionGeneradaPorIA } from "../actions";
import type { Cotizacion, EstadoCotizacion } from "../types";
import { ESTADO_COTIZACION_CONFIG } from "../types";

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(valor);

function AccionesCotizacion({ cotizacion }: { cotizacion: Cotizacion }) {
  const router = useRouter();

  const handleRevisar = async () => {
    const resultado = await cambiarEstadoCotizacion(cotizacion.id, "REVISADA");
    if (resultado.exito) toast.success("Cotización marcada como revisada");
    else toast.error(resultado.error);
  };

  const handleAprobar = async () => {
    const resultado = await aprobarCotizacion(cotizacion.id);
    if (resultado.exito) {
      // El pedido se genera en segundo plano (ver CotizacionAprobadaSuscriptor)
      // — todavía no hay pedidoId/numero en este punto para enlazarlo.
      toast.success("Cotización aprobada", {
        description: "El pedido se está generando y va a aparecer en Pedidos en unos segundos.",
        duration: 6000,
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

  const handleConfirmarGeneradaPorIA = async () => {
    const resultado = await confirmarCotizacionGeneradaPorIA(cotizacion.id);
    if (resultado.exito) toast.success("Cotización confirmada");
    else toast.error(resultado.error);
  };

  const puedeAprobar = cotizacion.estado === "REVISADA" || cotizacion.estado === "BORRADOR";
  // Solo se puede modificar/descartar mientras no haya sido enviada
  const esModificable = cotizacion.estado === "BORRADOR";
  // 015-herramientas-operativas-inventario-envios-acciones: modo borrador del agente IA
  const pendienteConfirmacion = cotizacion.generadoPorIA && !cotizacion.confirmadoPorHumano;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/sales/cotizaciones/${cotizacion.id}`)}>
          <ExternalLink className="mr-2 h-4 w-4" />Ver detalle
        </DropdownMenuItem>
        {esModificable && (
          <DropdownMenuItem onClick={() => router.push(`/sales/cotizaciones/${cotizacion.id}/editar`)}>
            <Pencil className="mr-2 h-4 w-4" />Editar
          </DropdownMenuItem>
        )}
        {pendienteConfirmacion && (
          <DropdownMenuItem onClick={handleConfirmarGeneradaPorIA} className="text-lime-600 dark:text-lime-400 focus:text-lime-700 dark:focus:text-lime-300">
            <Sparkles className="mr-2 h-4 w-4" />Confirmar (generada por IA)
          </DropdownMenuItem>
        )}
        {cotizacion.estado === "BORRADOR" && (
          <DropdownMenuItem onClick={handleRevisar}>
            <Send className="mr-2 h-4 w-4" />Marcar revisada
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
        {esModificable && (
          <>
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
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columnasFijas: ColumnDef<Cotizacion>[] = [
  {
    accessorKey: "numero",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Número <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Link href={`/sales/cotizaciones/${row.original.id}`} className="font-mono font-medium hover:underline">
          {row.original.numero}
        </Link>
        {row.original.generadoPorIA && !row.original.confirmadoPorHumano && (
          <Badge variant="outline" className="gap-1 text-lime-600 dark:text-lime-400 border-lime-500/30">
            <Sparkles className="h-3 w-3" />generado por IA · pendiente
          </Badge>
        )}
      </div>
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
];

export function ListaCotizaciones({ cotizaciones }: { cotizaciones: Cotizacion[] }) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("cotizaciones");

  const columnas: ColumnDef<Cotizacion>[] = [
    ...columnasFijas,
    ...(puedeMod
      ? [{ id: "acciones", cell: ({ row }: { row: { original: Cotizacion } }) => <AccionesCotizacion cotizacion={row.original} /> }]
      : []),
  ];

  return <DataTable columnas={columnas} datos={cotizaciones} filtroPor="numero" placeholderFiltro="Buscar cotización..." />;
}
