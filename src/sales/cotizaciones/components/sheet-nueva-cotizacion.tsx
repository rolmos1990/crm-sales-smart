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
  onCreada?: () => void;
}

type DatosFormulario = Awaited<ReturnType<typeof obtenerDatosFormularioCotizacion>>;

export function SheetNuevaCotizacion({
  oportunidadId,
  oportunidadTitulo,
  contactoId,
  empresaId,
  destinatario,
  onCreada,
}: SheetNuevaCotizacionProps) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosFormulario | null>(null);

  const handleOpenChange = async (siguiente: boolean) => {
    setOpen(siguiente);
    if (siguiente && !datos) {
      setCargando(true);
      setError(null);
      try {
        const resultado = await obtenerDatosFormularioCotizacion();
        setDatos(resultado);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al cargar el formulario";
        setError(msg);
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
        showCloseButton={false}
      >
        {/* El título visual real lo pinta FormCotizacion en su propio header;
            este solo cumple el requisito de accesibilidad del Sheet. */}
        <SheetHeader className="sr-only">
          <SheetTitle>Nueva cotización{oportunidadTitulo ? ` — ${oportunidadTitulo}` : ""}</SheetTitle>
        </SheetHeader>

        {cargando && (
          <div className="flex items-center justify-center h-40 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-lime-500 dark:text-lime-400" />
            <span className="text-sm text-stone-400">Cargando formulario…</span>
          </div>
        )}

        {!cargando && error && (
          <div className="flex items-center justify-center h-40 px-6">
            <p className="text-sm text-red-500 text-center">{error}</p>
          </div>
        )}

        {!cargando && datos && (
          <FormCotizacion
            empresas={datos.empresas}
            contactos={datos.contactos}
            contactosDetalle={datos.contactosDetalle}
            productos={datos.productos}
            transportistas={datos.transportistas}
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
            onCerrar={() => setOpen(false)}
            onSuccess={() => {
              setOpen(false);
              onCreada?.();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
