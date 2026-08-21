"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown } from "lucide-react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { eliminarOportunidad } from "../actions";
import type { Oportunidad } from "../types";
import { EtapaBadge } from "./etapa-badge";

function AccionesOportunidad({ oportunidad }: { oportunidad: Oportunidad }) {
  const router = useRouter();
  const handleEliminar = async () => {
    const resultado = await eliminarOportunidad(oportunidad.id);
    if (resultado.exito) toast.success("Oportunidad eliminada");
    else toast.error(resultado.error);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/crm/oportunidades/${oportunidad.id}`)}>Ver detalle</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/crm/oportunidades/${oportunidad.id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ConfirmacionDialog
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Eliminar
            </DropdownMenuItem>
          }
          titulo="¿Eliminar oportunidad?"
          descripcion={`Se eliminará permanentemente "${oportunidad.titulo}".`}
          onConfirmar={handleEliminar}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const formatearMoneda = (valor: number, moneda: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda }).format(valor);

const columnasFijas: ColumnDef<Oportunidad>[] = [
  {
    accessorKey: "titulo",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Oportunidad <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link href={`/crm/oportunidades/${row.original.id}`} className="font-medium hover:underline">
        {row.original.titulo}
      </Link>
    ),
  },
  {
    id: "contacto",
    header: "Contacto",
    cell: ({ row }) => {
      const contacto = row.original.contactos?.[0]?.contacto;
      return contacto ? (
        <Link href={`/crm/contactos/${contacto.id}`} className="text-sm text-muted-foreground hover:underline">
          {contacto.nombre} {contacto.apellido}
        </Link>
      ) : <span className="text-muted-foreground text-sm">—</span>;
    },
  },
  {
    accessorKey: "empresa",
    header: "Empresa",
    cell: ({ row }) => row.original.empresa ? (
      <Link href={`/crm/empresas/${row.original.empresa.id}`} className="text-sm text-muted-foreground hover:underline">
        {row.original.empresa.nombre}
      </Link>
    ) : <span className="text-muted-foreground text-sm">—</span>,
  },
  {
    accessorKey: "valor",
    header: "Valor",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatearMoneda(row.original.valor, row.original.moneda)}</span>
    ),
  },
  {
    accessorKey: "etapa",
    header: "Etapa",
    cell: ({ row }) => <EtapaBadge etapa={row.original.etapa} stage={row.original.stage} />,
  },
  {
    accessorKey: "probabilidad",
    header: "Prob.",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">{getValue<number>()}%</span>
    ),
  },
  {
    accessorKey: "fechaCierre",
    header: "Vencimiento",
    cell: ({ getValue }) => {
      const fecha = getValue<Date | null>();
      return fecha ? (
        <span className="text-sm text-muted-foreground">
          {format(new Date(fecha), "dd MMM yyyy", { locale: es })}
        </span>
      ) : <span className="text-muted-foreground text-sm">—</span>;
    },
  },
];

export function ListaOportunidades({ oportunidades }: { oportunidades: Oportunidad[] }) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("oportunidades");

  const columnas: ColumnDef<Oportunidad>[] = [
    ...columnasFijas,
    ...(puedeMod
      ? [{ id: "acciones", cell: ({ row }: { row: { original: Oportunidad } }) => <AccionesOportunidad oportunidad={row.original} /> }]
      : []),
  ];

  return <DataTable columnas={columnas} datos={oportunidades} />;
}
