"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { FormCotizacion } from "./form-cotizacion";
import { obtenerDatosFormularioCotizacion, obtenerDatosEdicionCotizacionAction } from "../actions";
import type { DestinatarioCotizacionInput } from "../schema";

// Cotización como panel lateral del Workspace, no como Sheet.
//
// El Sheet tapaba la conversación y, al cerrarlo, desmontaba FormCotizacion:
// react-hook-form se llevaba el borrador con él. Entonces buscar un dato en el
// chat —qué modelo pidió, qué dirección dio— costaba perder lo cargado.
//
// Acá el formulario se monta UNA vez y al plegar solo se oculta (`hidden` en
// el padre), así que productos, cantidades, precios y notas siguen ahí. Por
// eso este componente no debe desmontarse mientras haya borrador: quien lo usa
// controla la visibilidad, no el montaje.
//
// Lo demás ya lo resolvía FormCotizacion: con `onSuccess` no navega, y ante un
// error muestra el toast y se queda con los datos cargados.

interface PanelCotizacionWorkspaceProps {
  /**
   * Con id abre esa cotización para editarla; sin id, una nueva. Quien lo usa
   * debe darle `key` distinta por id: al cambiar de cotización el formulario
   * tiene que remontarse para cargar los datos de la otra.
   */
  cotizacionId?: string;
  oportunidadId: string;
  contactoId?: string;
  empresaId?: string;
  destinatario?: Partial<DestinatarioCotizacionInput>;
  /** Se llama solo cuando la cotización se creó bien. */
  onCreada: () => void;
  /** Plegar: oculta el panel sin perder lo cargado. */
  onPlegar: () => void;
  /** Descartar: saca la cotización de la pantalla y pierde el borrador. */
  onDescartar: () => void;
}

type DatosFormulario = Awaited<ReturnType<typeof obtenerDatosFormularioCotizacion>>;
type DatosEdicion = NonNullable<Awaited<ReturnType<typeof obtenerDatosEdicionCotizacionAction>>>;

// Datos vigentes del contacto ligado a la cotización (no la copia guardada en
// destinatario) — es contra esto que FormCotizacion decide si mostrar la
// tarjeta compacta del contacto o el formulario editable. Mismo criterio que
// <SheetEditarCotizacion>.
function contactoVinculado(datos: DatosEdicion) {
  const contacto = datos.contactosDetalle.find((c) => c.id === datos.defaultValues.contactoId);
  if (!contacto) return undefined;
  return {
    nombre: contacto.nombre,
    apellido: contacto.apellido,
    telefono: contacto.telefonoPrincipal ?? undefined,
    email: contacto.email ?? undefined,
  };
}

export function PanelCotizacionWorkspace({
  cotizacionId,
  oportunidadId,
  contactoId,
  empresaId,
  destinatario,
  onCreada,
  onPlegar,
  onDescartar,
}: PanelCotizacionWorkspaceProps) {
  const [datos, setDatos] = useState<DatosFormulario | null>(null);
  const [edicion, setEdicion] = useState<DatosEdicion | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Una sola vez, al montarse. El padre monta este componente recién cuando se
  // abre por primera vez, así que no hay carga anticipada.
  useEffect(() => {
    let vivo = true;
    const cargar = cotizacionId
      ? obtenerDatosEdicionCotizacionAction(cotizacionId).then((r) => {
          if (!vivo) return;
          if (!r) setError("No se pudo cargar la cotización");
          else setEdicion(r);
        })
      : obtenerDatosFormularioCotizacion().then((r) => { if (vivo) setDatos(r); });

    cargar.catch((e) => {
      if (vivo) setError(e instanceof Error ? e.message : "Error al cargar el formulario");
    });
    return () => { vivo = false; };
  }, [cotizacionId]);

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-border">
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button type="button" onClick={onDescartar} className="text-xs text-muted-foreground underline">
            Cerrar
          </button>
        </div>
      ) : cotizacionId && edicion && !edicion.editable ? (
        // Igual que <SheetEditarCotizacion>: fuera de borrador no hay nada que
        // editar. Se ofrece la ficha completa, que sí muestra todo.
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Solo se pueden editar cotizaciones en estado borrador.
          </p>
          <a
            href={`/sales/cotizaciones/${cotizacionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline"
          >
            Ver la cotización {edicion.numero}
          </a>
          <button type="button" onClick={onDescartar} className="text-xs text-muted-foreground underline">
            Cerrar
          </button>
        </div>
      ) : cotizacionId && edicion?.editable ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FormCotizacion
            contactos={edicion.contactos}
            contactosDetalle={edicion.contactosDetalle}
            empresas={edicion.empresas}
            productos={edicion.productos}
            transportistas={edicion.transportistas}
            monedaDefault={edicion.monedaDefault}
            defaultCountryCode={edicion.defaultCountryCode}
            filtroCatalogoInicial={edicion.filtroCatalogoInicial}
            cotizacionId={cotizacionId}
            numero={edicion.numero}
            defaultValues={edicion.defaultValues}
            contactoOrigen={contactoVinculado(edicion)}
            onSuccess={onCreada}
            onCerrar={onPlegar}
            accionCerrar="plegar"
            onDescartar={onDescartar}
          />
        </div>
      ) : !datos && !edicion ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {cotizacionId ? "Cargando cotización…" : "Cargando formulario…"}
        </div>
      ) : datos ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FormCotizacion
            contactos={datos.contactos}
            contactosDetalle={datos.contactosDetalle}
            empresas={datos.empresas}
            productos={datos.productos}
            transportistas={datos.transportistas}
            monedaDefault={datos.monedaDefault}
            defaultCountryCode={datos.defaultCountryCode}
            filtroCatalogoInicial={datos.filtroCatalogoInicial}
            oportunidadId={oportunidadId}
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
            // Mismo criterio que el Sheet: la cotización nace atada al
            // contacto y la empresa de la oportunidad, no se eligen acá.
            contactoOrigen={destinatario}
            contactoFijo
            empresaFija
            onSuccess={onCreada}
            // Cerrar acá es plegar: el formulario queda montado con su
            // borrador — ver el comentario de arriba.
            onCerrar={onPlegar}
            accionCerrar="plegar"
            onDescartar={onDescartar}
          />
        </div>
      ) : null}
    </div>
  );
}
