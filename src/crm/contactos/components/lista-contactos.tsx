"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/shared/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { eliminarContacto } from "../actions";
import type { Contacto, EstadoContacto } from "../types";

const ESTADO_CONFIG: Record<EstadoContacto, { etiqueta: string; variante: "default" | "secondary" | "outline" }> = {
  ACTIVO: { etiqueta: "Activo", variante: "default" },
  LEAD: { etiqueta: "Lead", variante: "secondary" },
  INACTIVO: { etiqueta: "Inactivo", variante: "outline" },
};

function AccionesContacto({ contacto }: { contacto: Contacto }) {
  const router = useRouter();

  const handleEliminar = async () => {
    const resultado = await eliminarContacto(contacto.id);
    if (resultado.exito) {
      toast.success("Contacto eliminado");
    } else {
      toast.error(resultado.error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Acciones</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/crm/contactos/${contacto.id}`)}>
          Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/crm/contactos/${contacto.id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ConfirmacionDialog
          trigger={
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          }
          titulo="¿Eliminar contacto?"
          descripcion={`Esta acción eliminará permanentemente a ${contacto.nombre} ${contacto.apellido} y no se puede deshacer.`}
          onConfirmar={handleEliminar}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columnas: ColumnDef<Contacto>[] = [
  {
    accessorKey: "nombre",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Nombre
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const { nombre, apellido, id } = row.original;
      const iniciales = `${nombre[0]}${apellido[0]}`.toUpperCase();
      return (
        <Link href={`/crm/contactos/${id}`} className="flex items-center gap-3 hover:underline">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{iniciales}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{nombre} {apellido}</span>
        </Link>
      );
    },
    filterFn: (row, _, filterValue) => {
      const nombre = `${row.original.nombre} ${row.original.apellido}`.toLowerCase();
      return nombre.includes((filterValue as string).toLowerCase());
    },
  },
  {
    accessorKey: "empresa",
    header: "Empresa",
    cell: ({ row }) => row.original.empresa ? (
      <Link href={`/crm/empresas/${row.original.empresa.id}`} className="text-sm hover:underline text-muted-foreground">
        {row.original.empresa.nombre}
      </Link>
    ) : <span className="text-muted-foreground text-sm">—</span>,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ getValue }) => {
      const email = getValue<string | null>();
      return email ? (
        <a href={`mailto:${email}`} className="text-sm text-muted-foreground hover:underline">{email}</a>
      ) : <span className="text-muted-foreground text-sm">—</span>;
    },
  },
  {
    accessorKey: "telefono",
    header: "Teléfono",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">{getValue<string | null>() ?? "—"}</span>
    ),
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ getValue }) => {
      const estado = getValue<EstadoContacto>();
      const config = ESTADO_CONFIG[estado];
      return <Badge variant={config.variante}>{config.etiqueta}</Badge>;
    },
  },
  {
    id: "acciones",
    cell: ({ row }) => <AccionesContacto contacto={row.original} />,
  },
];

export function ListaContactos({ contactos }: { contactos: Contacto[] }) {
  return (
    <DataTable
      columnas={columnas}
      datos={contactos}
      filtroPor="nombre"
      placeholderFiltro="Buscar por nombre..."
    />
  );
}
