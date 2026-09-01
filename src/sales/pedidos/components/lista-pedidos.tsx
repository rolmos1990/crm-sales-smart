"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Trash2, ArrowUpDown, Sparkles } from "lucide-react";
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
import { eliminarPedido, confirmarPedidoGeneradoPorIA } from "../actions";
import { moverPedidoAction } from "@/sales/flujo-venta/actions";
import { calcularSiguientesEtapas } from "@/sales/flujo-venta/types";
import type { Pedido, EstadoPedido } from "../types";
import { ESTADO_PEDIDO_CONFIG } from "../types";
import { METODO_ENTREGA_LABELS } from "../constantes";
import { fechaYMDEnZona, rangoDiaEnZona } from "../utils/fechas-zona";
import { cn } from "@/lib/utils";

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(valor);

/**
 * "Hoy"/"Mañana" se calculan comparando por día calendario en la zona
 * horaria de negocio (no la del navegador de quien mira la pantalla) —
 * misma referencia que usa el filtro "Entrega estimada" del servidor, para
 * que ambos coincidan siempre.
 */
function EntregaEstimadaCell({ pedido, zonaHoraria }: { pedido: Pedido; zonaHoraria: string }) {
  if (!pedido.fechaEntrega) return <span className="text-stone-400 dark:text-stone-600">—</span>;

  const fecha = new Date(pedido.fechaEntrega);
  const ymd = fechaYMDEnZona(fecha, zonaHoraria);
  const ymdHoy = fechaYMDEnZona(rangoDiaEnZona(zonaHoraria, 0).desde, zonaHoraria);
  const ymdManana = fechaYMDEnZona(rangoDiaEnZona(zonaHoraria, 1).desde, zonaHoraria);
  const esHoy = ymd === ymdHoy;
  const esManana = ymd === ymdManana;
  const fechaFormateada = format(fecha, "dd MMM yyyy", { locale: es });

  return (
    <span
      className={cn(
        "text-sm",
        esHoy && "text-emerald-600 dark:text-emerald-400 font-medium",
        esManana && "text-sky-500 dark:text-sky-400 font-medium",
        !esHoy && !esManana && "text-stone-600 dark:text-stone-400"
      )}
    >
      {esHoy ? `Hoy · ${fechaFormateada}` : esManana ? `Mañana · ${fechaFormateada}` : fechaFormateada}
    </span>
  );
}

function ExpiracionCell({ pedido }: { pedido: Pedido }) {
  if (!pedido.fechaExpiracion) return <span className="text-stone-400 dark:text-stone-600">—</span>;

  const fecha = new Date(pedido.fechaExpiracion);
  const cerrado = pedido.estado === "ENTREGADO" || pedido.estado === "CANCELADO";
  const vencido = !cerrado && fecha < new Date();
  const porVencer = !cerrado && !vencido && fecha.getTime() - Date.now() < 3 * 86400000; // < 3 días

  return (
    <span
      className={cn(
        "text-sm font-medium",
        vencido && "text-red-500 dark:text-red-400",
        porVencer && "text-amber-500 dark:text-amber-400",
        (cerrado || (!vencido && !porVencer)) && "text-emerald-600 dark:text-emerald-400"
      )}
    >
      {format(fecha, "dd MMM yyyy", { locale: es })}
    </span>
  );
}

type EtapaResumen = { id: string; nombre: string; color: string | null; esFinal: boolean; esCancelacion: boolean; esSecuencial: boolean; orden: number; parentId: string | null } | null;

function EstadoBadge({ estado, etapa }: { estado: EstadoPedido; etapa: EtapaResumen }) {
  if (etapa) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border"
        style={{ backgroundColor: `${etapa.color}18`, color: etapa.color ?? undefined, borderColor: `${etapa.color}40` }}
      >
        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: etapa.color ?? undefined }} />
        {etapa.nombre}
      </span>
    );
  }
  const config = ESTADO_PEDIDO_CONFIG[estado];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.color)}>
      {config.etiqueta}
    </span>
  );
}

type EtapaFlujo = { id: string; nombre: string; color: string | null; esFinal: boolean; esCancelacion: boolean; esSecuencial: boolean; orden: number; parentId: string | null };

function AccionesPedido({ pedido, etapasFlujo }: { pedido: Pedido; etapasFlujo: EtapaFlujo[] }) {
  const router = useRouter();
  const etapaActualId = (pedido as any).flujoVentaEtapa?.id ?? null;
  const siguientesEtapas = calcularSiguientesEtapas(etapasFlujo, etapaActualId);

  const handleMover = async (etapaId: string, etapaNombre: string) => {
    const resultado = await moverPedidoAction(pedido.id, etapaId);
    if (resultado.exito) toast.success(`Pedido movido a "${etapaNombre}"`);
    else toast.error(resultado.error);
    router.refresh();
  };

  const handleEliminar = async () => {
    const resultado = await eliminarPedido(pedido.id);
    if (resultado.exito) toast.success("Pedido eliminado");
    else toast.error(resultado.error);
  };

  const handleConfirmarGeneradoPorIA = async () => {
    const resultado = await confirmarPedidoGeneradoPorIA(pedido.id);
    if (resultado.exito) toast.success("Pedido confirmado");
    else toast.error(resultado.error);
  };

  // 015-herramientas-operativas-inventario-envios-acciones: modo borrador del agente IA
  const pendienteConfirmacion = pedido.generadoPorIA && !pedido.confirmadoPorHumano;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/sales/pedidos/${pedido.id}`)}>Ver detalle</DropdownMenuItem>
        {pendienteConfirmacion && (
          <DropdownMenuItem onClick={handleConfirmarGeneradoPorIA} className="text-lime-600 dark:text-lime-400 focus:text-lime-700 dark:focus:text-lime-300">
            <Sparkles className="mr-2 h-4 w-4" />Confirmar (generado por IA)
          </DropdownMenuItem>
        )}
        {siguientesEtapas.length > 0 && <DropdownMenuSeparator />}
        {siguientesEtapas.map((etapa) => (
          <DropdownMenuItem
            key={etapa.id}
            onClick={() => handleMover(etapa.id, etapa.nombre)}
            className={cn(etapa.esCancelacion && "text-destructive focus:text-destructive")}
          >
            <span
              className="mr-2 h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: etapa.esCancelacion ? undefined : (etapa.color ?? undefined) }}
            />
            Mover a {etapa.nombre}
          </DropdownMenuItem>
        ))}
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

function construirColumnasFijas(zonaHoraria: string): ColumnDef<Pedido>[] {
  return [
  {
    accessorKey: "numero",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Número <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Link href={`/sales/pedidos/${row.original.id}`} className="font-mono font-medium hover:underline">
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
    cell: ({ row }) => (
      <EstadoBadge
        estado={row.original.estado}
        etapa={(row.original as any).flujoVentaEtapa ?? null}
      />
    ),
  },
  {
    id: "metodoEntrega",
    header: "Método de envío",
    cell: ({ row }) => {
      const metodo = row.original.entrega?.metodoEntrega;
      return (
        <span className="text-sm text-muted-foreground">
          {metodo ? (METODO_ENTREGA_LABELS[metodo] ?? metodo) : "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "fechaPedido",
    header: "Fecha pedido",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">
        {format(new Date(getValue<Date>()), "dd MMM yyyy", { locale: es })}
      </span>
    ),
  },
  {
    accessorKey: "fechaEntrega",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Entrega estimada <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <EntregaEstimadaCell pedido={row.original} zonaHoraria={zonaHoraria} />,
    sortUndefined: "last",
  },
  {
    id: "fechaExpiracion",
    header: "Expiración",
    cell: ({ row }) => <ExpiracionCell pedido={row.original} />,
  },
  ];
}

interface ListaPedidosProps {
  pedidos: Pedido[];
  etapasFlujo: EtapaFlujo[];
  zonaHoraria: string;
}


export function ListaPedidos({ pedidos, etapasFlujo, zonaHoraria }: ListaPedidosProps) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("pedidos");

  const columnas: ColumnDef<Pedido>[] = [
    ...construirColumnasFijas(zonaHoraria),
    ...(puedeMod
      ? [{ id: "acciones", cell: ({ row }: { row: { original: Pedido } }) => <AccionesPedido pedido={row.original} etapasFlujo={etapasFlujo} /> }]
      : []),
  ];

  return <DataTable columnas={columnas} datos={pedidos} />;
}
