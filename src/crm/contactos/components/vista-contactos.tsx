"use client";

import { useCallback, useState } from "react";
import { useVistaFiltrada, ZonaResultados } from "@/shared/ui/vista-filtrada";
import { queryKeys } from "@/shared/query-keys";
import { consultarVistaContactosAction } from "../actions";
import { FILTROS_VISTA_CONTACTOS_DEFECTO, type FiltrosVistaContactos } from "../schema";
import type { Segmento } from "../segmentacion/condiciones";
import type { VistaContactos as DatosVistaContactos } from "../types";
import { ContactosFiltros, ContactosPestanas } from "./contactos-filtros";
import { ContactosIndicadores } from "./contactos-indicadores";
import { PanelContacto } from "./panel-contacto";
import { TablaContactos } from "./tabla-contactos";

// Cambiar de página, de tamaño o de orden conserva la página; cualquier otro
// filtro vuelve a la primera.
const CLAVES_QUE_CONSERVAN_PAGINA = new Set<keyof FiltrosVistaContactos>(["pagina", "tamanoPagina", "orden", "direccion"]);

/**
 * 041 — Indicadores, pestañas, filtros, tabla y panel lateral. Los filtros son
 * estado de este componente (no van en la URL): arrancan en el default cada
 * vez que se entra, igual que Pedidos. Abrir o cerrar el panel no los toca.
 */
export function VistaContactos({ inicial }: { inicial: DatosVistaContactos }) {
  const [filtros, setFiltros] = useState<FiltrosVistaContactos>(FILTROS_VISTA_CONTACTOS_DEFECTO);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const esDefecto = JSON.stringify(filtros) === JSON.stringify(FILTROS_VISTA_CONTACTOS_DEFECTO);

  const { datos, actualizando } = useVistaFiltrada({
    clave: queryKeys.contactos.vista(),
    filtros,
    esDefecto,
    inicial,
    consultar: consultarVistaContactosAction,
  });

  const cambiar = useCallback((cambios: Partial<FiltrosVistaContactos>) => {
    const reiniciaPagina = Object.keys(cambios).some((k) => !CLAVES_QUE_CONSERVAN_PAGINA.has(k as keyof FiltrosVistaContactos));
    setFiltros((prev) => ({ ...prev, ...cambios, ...(reiniciaPagina ? { pagina: 1 } : {}) }));
  }, []);

  const limpiar = useCallback(() => setFiltros(FILTROS_VISTA_CONTACTOS_DEFECTO), []);
  const cerrarPanel = useCallback(() => setSeleccionadoId(null), []);

  const seleccionarSegmento = useCallback(
    (segmento: Segmento) => cambiar({ segmento: filtros.segmento === segmento && segmento !== "TODOS" ? "TODOS" : segmento }),
    [cambiar, filtros.segmento],
  );

  return (
    <div className="flex flex-col gap-4">
      <ContactosIndicadores indicadores={datos.indicadores} segmento={filtros.segmento} onSeleccionar={seleccionarSegmento} />
      <ContactosPestanas indicadores={datos.indicadores} segmento={filtros.segmento} onSeleccionar={seleccionarSegmento} />
      <ContactosFiltros
        filtros={filtros}
        onCambiar={cambiar}
        onLimpiar={limpiar}
        hayFiltrosActivos={datos.hayFiltrosActivos}
        mostrarAvanzados
      />
      <ZonaResultados actualizando={actualizando}>
        <TablaContactos
          filas={datos.filas}
          total={datos.total}
          pagina={datos.pagina}
          tamanoPagina={datos.tamanoPagina}
          filtros={filtros}
          hayFiltrosActivos={datos.hayFiltrosActivos}
          seleccionadoId={seleccionadoId}
          mostrarRecomendacion
          onCambiar={cambiar}
          onLimpiar={limpiar}
          onSeleccionar={setSeleccionadoId}
        />
      </ZonaResultados>
      <PanelContacto contactoId={seleccionadoId} onCerrar={cerrarPanel} />
    </div>
  );
}
