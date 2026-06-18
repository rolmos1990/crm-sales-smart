"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, Building2, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/shared/ui/data-table";
import { useSesion } from "@/shared/auth/sesion-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { eliminarEmpresa } from "../actions";
import type { EmpresaConRelaciones } from "../types";

const INDUSTRIA_LABELS: Record<string, string> = {
  tecnologia: "Tecnología",
  retail: "Retail",
  manufactura: "Manufactura",
  servicios: "Servicios",
  salud: "Salud",
  educacion: "Educación",
  construccion: "Construcción",
  financiero: "Financiero",
  otro: "Otro",
};

const TAMANO_LABELS: Record<string, string> = {
  micro: "Micro",
  pequena: "Pequeña",
  mediana: "Mediana",
  grande: "Grande",
};

function AccionesEmpresa({ empresa }: { empresa: EmpresaConRelaciones }) {
  const router = useRouter();
  const handleEliminar = async () => {
    const resultado = await eliminarEmpresa(empresa.id);
    if (resultado.exito) toast.success("Empresa desactivada");
    else toast.error(resultado.error);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted hover:text-foreground transition-all outline-none">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/crm/empresas/${empresa.id}`)}>
          Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/crm/empresas/${empresa.id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ConfirmacionDialog
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Desactivar
            </DropdownMenuItem>
          }
          titulo="¿Desactivar empresa?"
          descripcion={`Se desactivará "${empresa.nombre}". Los datos asociados se conservarán.`}
          textoConfirmar="Desactivar"
          onConfirmar={handleEliminar}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columnasFijas: ColumnDef<EmpresaConRelaciones>[] = [
  {
    accessorKey: "nombre",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Empresa <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link href={`/crm/empresas/${row.original.id}`} className="flex items-center gap-2 hover:underline font-medium">
        <div className="rounded-md bg-muted p-1.5">
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
        {row.original.nombre}
      </Link>
    ),
  },
  {
    accessorKey: "industria",
    header: "Industria",
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      return <span className="text-sm text-muted-foreground">{val ? (INDUSTRIA_LABELS[val] ?? val) : "—"}</span>;
    },
  },
  {
    accessorKey: "tamano",
    header: "Tamaño",
    cell: ({ getValue }) => {
      const val = getValue<string | null>();
      return val ? <Badge variant="outline">{TAMANO_LABELS[val] ?? val}</Badge> : <span className="text-muted-foreground text-sm">—</span>;
    },
  },
  {
    id: "contactos",
    header: "Contactos",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original._count?.contactos ?? 0}</span>
    ),
  },
  {
    id: "oportunidades",
    header: "Oportunidades",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original._count?.oportunidades ?? 0}</span>
    ),
  },
];

export function ListaEmpresas({ empresas }: { empresas: EmpresaConRelaciones[] }) {
  const { puedeModificar } = useSesion();
  const puedeMod = puedeModificar("empresas");

  const columnas: ColumnDef<EmpresaConRelaciones>[] = [
    ...columnasFijas,
    ...(puedeMod
      ? [{ id: "acciones", cell: ({ row }: { row: { original: EmpresaConRelaciones } }) => <AccionesEmpresa empresa={row.original} /> }]
      : []),
  ];

  return <DataTable columnas={columnas} datos={empresas} filtroPor="nombre" placeholderFiltro="Buscar empresa..." />;
}
