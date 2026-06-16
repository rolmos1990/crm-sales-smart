"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FormCotizacion } from "./form-cotizacion";
import { obtenerDatosFormularioCotizacion } from "../actions";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import type { ProductoCatalogo } from "@/shared/productos/types";
import type { DestinatarioCotizacionInput } from "../schema";

interface SheetNuevaCotizacionProps {
  oportunidadId: string;
  oportunidadTitulo?: string;
  contactoId?: string;
  empresaId?: string;
  destinatario?: Partial<DestinatarioCotizacionInput>;
}

interface DatosFormulario {
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  productos: ProductoCatalogo[];
  monedaDefault: string;
}

export function SheetNuevaCotizacion({
  oportunidadId,
  oportunidadTitulo,
  contactoId,
  empresaId,
  destinatario,
}: SheetNuevaCotizacionProps) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState<DatosFormulario | null>(null);

  const handleOpenChange = async (siguiente: boolean) => {
    setOpen(siguiente);
    if (siguiente && !datos) {
      setCargando(true);
      try {
        const resultado = await obtenerDatosFormularioCotizacion();
        setDatos(resultado);
      } finally {
        setCargando(false);
      }
    }
  };

  const sinContacto = !contactoId;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
        disabled={sinContacto}
        title={sinContacto ? "Agrega un contacto a la oportunidad para crear una cotización" : undefined}
        className="gap-1.5"
      >
        <FileText className="h-3.5 w-3.5" />
        Nueva cotización
      </Button>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-5xl bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10 shadow-2xl"
      >
        <SheetHeader className="border-b border-stone-100 dark:border-white/10 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-lime-500/10 dark:bg-lime-400/10 p-1.5">
              <FileText className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Nueva cotización
              </SheetTitle>
              {oportunidadTitulo && (
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  {oportunidadTitulo}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {cargando && (
            <div className="flex items-center justify-center h-40 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-lime-500 dark:text-lime-400" />
              <span className="text-sm text-stone-400">Cargando formulario…</span>
            </div>
          )}

          {!cargando && datos && (
            <div className="px-6 py-6">
              <FormCotizacion
                empresas={datos.empresas}
                contactos={datos.contactos}
                productos={datos.productos}
                oportunidadId={oportunidadId}
                monedaDefault={datos.monedaDefault}
                defaultValues={{
                  contactoId: contactoId ?? "",
                  empresaId: empresaId ?? "",
                  destinatario: {
                    nombre: destinatario?.nombre ?? "",
                    apellido: destinatario?.apellido ?? "",
                    telefono: destinatario?.telefono ?? "",
                    email: destinatario?.email ?? "",
                  },
                }}
                contactoOrigen={destinatario}
                contactoFijo
                empresaFija
                onSuccess={() => setOpen(false)}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
