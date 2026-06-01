"use client";

import { useState } from "react";
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
import { AvatarContacto } from "./avatar-contacto";
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
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  const handleEliminar = async () => {
    const resultado = await eliminarContacto(contacto.id);
    if (resultado.exito) {
      toast.success("Contacto eliminado");
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
          <DropdownMenuItem onClick={() => router.push(`/crm/contactos/${contacto.id}`)}>
            Ver detalle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/crm/contactos/${contacto.id}/editar`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmarEliminar(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmacionDialog
        open={confirmarEliminar}
        onOpenChange={setConfirmarEliminar}
        titulo={`¿Eliminar a ${contacto.nombre}${contacto.apellido ? ` ${contacto.apellido}` : ""}?`}
        descripcion={
          <div className="space-y-3 text-sm">
            <p>Esta acción es permanente y no se puede deshacer.</p>
            <div>
              <p className="font-medium text-foreground mb-1">Se eliminará:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                <li>Todas sus conversaciones y mensajes</li>
                <li>Sus identificadores de canal (teléfono, email, etc.)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Se conserva:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                <li>Las oportunidades quedan sin contacto asignado</li>
                <li>Actividades, cotizaciones y pedidos quedan sin contacto</li>
              </ul>
            </div>
          </div>
        }
        textoConfirmar="Sí, eliminar contacto"
        onConfirmar={handleEliminar}
      />
    </>
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
      const { nombre, apellido, avatarUrl, id } = row.original;
      const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ") || "Sin nombre";
      return (
        <Link href={`/crm/contactos/${id}`} className="flex items-center gap-3 hover:underline min-w-0">
          <AvatarContacto nombre={nombre} apellido={apellido} avatarUrl={avatarUrl} size="sm" />
          <span className="font-medium truncate">{nombreCompleto}</span>
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
