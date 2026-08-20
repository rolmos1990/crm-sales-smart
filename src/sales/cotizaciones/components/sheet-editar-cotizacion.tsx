"use client";

import { useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FormCotizacion } from "./form-cotizacion";
import { obtenerDatosEdicionCotizacionAction } from "../actions";

interface SheetEditarCotizacionProps {
  cotizacionId: string;
  onActualizada?: () => void;
}

type DatosEdicion = NonNullable<Awaited<ReturnType<typeof obtenerDatosEdicionCotizacionAction>>>;

// Mismo patrón que <SheetNuevaCotizacion>: un Sheet lateral que carga sus
// propios datos al abrir. Se usa desde el Workspace de Oportunidades para
// editar una cotización sin salir del workspace (antes navegaba a
// /sales/cotizaciones/[id]/editar y perdía el contexto).
export function SheetEditarCotizacion({ cotizacionId, onActualizada }: SheetEditarCotizacionProps) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosEdicion | null>(null);

  const handleOpenChange = async (siguiente: boolean) => {
    setOpen(siguiente);
    if (siguiente) {
      // A diferencia de "Nueva cotización", acá siempre se recarga al abrir —
      // la cotización pudo cambiar de estado desde la última vez.
      setCargando(true);
      setError(null);
      setDatos(null);
      try {
        const resultado = await obtenerDatosEdicionCotizacionAction(cotizacionId);
        if (!resultado) setError("No se pudo cargar la cotización");
        else setDatos(resultado);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar el formulario");
      } finally {
        setCargando(false);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="h-5 w-5 flex items-center justify-center rounded text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/8 transition-colors"
        title="Editar cotización"
      >
        <Pencil className="h-3 w-3" />
      </button>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-5xl bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10 shadow-2xl"
        showCloseButton={false}
      >
        {/* El título visual real lo pinta FormCotizacion en su propio header;
            este solo cumple el requisito de accesibilidad del Sheet. */}
        <SheetHeader className="sr-only">
          <SheetTitle>Editar cotización{datos ? ` ${datos.numero}` : ""}</SheetTitle>
        </SheetHeader>

        {cargando && (
          <div className="flex items-center justify-center h-40 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-lime-500 dark:text-lime-400" />
            <span className="text-sm text-stone-400">Cargando cotización…</span>
          </div>
        )}

        {!cargando && error && (
          <div className="flex items-center justify-center h-40 px-6">
            <p className="text-sm text-red-500 text-center">{error}</p>
          </div>
        )}

        {!cargando && datos && !datos.editable && (
          <div className="flex items-center justify-center h-40 px-6">
            <p className="text-sm text-stone-500 dark:text-stone-400 text-center">
              Solo se pueden editar cotizaciones en estado borrador.
            </p>
          </div>
        )}

        {!cargando && datos && datos.editable && (
          <FormCotizacion
            empresas={datos.empresas}
            contactos={datos.contactos}
            contactosDetalle={datos.contactosDetalle}
            productos={datos.productos}
            transportistas={datos.transportistas}
            monedaDefault={datos.monedaDefault}
            cotizacionId={cotizacionId}
            numero={datos.numero}
            defaultValues={datos.defaultValues}
            onCerrar={() => setOpen(false)}
            onSuccess={() => {
              setOpen(false);
              onActualizada?.();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
