"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { FormCotizacion } from "./form-cotizacion";
import { obtenerDatosFormularioCotizacion } from "../actions";
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

export function PanelCotizacionWorkspace({
  oportunidadId,
  contactoId,
  empresaId,
  destinatario,
  onCreada,
  onPlegar,
  onDescartar,
}: PanelCotizacionWorkspaceProps) {
  const [datos, setDatos] = useState<DatosFormulario | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Una sola vez, al montarse. El padre monta este componente recién cuando se
  // abre por primera vez, así que no hay carga anticipada.
  useEffect(() => {
    let vivo = true;
    obtenerDatosFormularioCotizacion()
      .then((r) => { if (vivo) setDatos(r); })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : "Error al cargar el formulario"); });
    return () => { vivo = false; };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-border">
      {error ? (
        <div className="p-4 text-sm text-danger">{error}</div>
      ) : !datos ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando formulario…
        </div>
      ) : (
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
      )}
    </div>
  );
}
