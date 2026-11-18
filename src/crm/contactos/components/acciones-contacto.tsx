"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmacionDialog } from "@/shared/ui/confirmacion-dialog";
import { eliminarContacto } from "../actions";

// 041 — Menú de acciones de una fila (Ver detalle, Editar, Eliminar), extraído
// sin cambios de la lista anterior para conservar su comportamiento (FR-017).

type ContactoAcciones = { id: string; nombre: string; apellido: string | null };

export function AccionesContacto({ contacto }: { contacto: ContactoAcciones }) {
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
