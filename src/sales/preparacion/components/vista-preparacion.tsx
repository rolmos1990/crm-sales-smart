"use client";

import { useState, type ReactNode } from "react";
import { PackageCheck, SearchX } from "lucide-react";
import { EmptyState } from "@/shared/ui/empty-state";
import { useVistaFiltrada, ZonaResultados } from "@/shared/ui/vista-filtrada";
import { queryKeys } from "@/shared/query-keys";
import { consultarVistaPreparacionAction } from "../actions";
import { LIMITE_POR_ESTADO } from "../constantes";
import { FILTROS_VISTA_PREPARACION_DEFECTO, type FiltrosVistaPreparacion } from "../schema";
import type { VistaPreparacion as DatosVistaPreparacion } from "../vista";
import { PreparacionTabsRango, type VistaTablero } from "./preparacion-tabs-rango";
import { ResumenPorProducto } from "./resumen-por-producto";
import { TableroCliente } from "./tablero-cliente";
import { TableroLista } from "./tablero-lista";

interface Props {
  /** Tablero con los filtros por defecto, ya resuelto en el servidor. */
  inicial: DatosVistaPreparacion;
  puedeMod: boolean;
  zonaNegocio: string;
  /** No depende de los filtros: llega renderado desde el servidor. */
  actividad: ReactNode;
}

/** Barra de rango + tablero + resumen. Los filtros son estado de este
 *  componente: arrancan en el default cada vez que se entra al módulo. */
export function VistaPreparacion({ inicial, puedeMod, zonaNegocio, actividad }: Props) {
  const [filtros, setFiltros] = useState<FiltrosVistaPreparacion>(FILTROS_VISTA_PREPARACION_DEFECTO);
  const [vista, setVista] = useState<VistaTablero>("kanban");
  const esDefecto = JSON.stringify(filtros) === JSON.stringify(FILTROS_VISTA_PREPARACION_DEFECTO);

  const { datos, actualizando } = useVistaFiltrada({
    clave: queryKeys.preparacion.vista(),
    filtros,
    esDefecto,
    inicial,
    consultar: consultarVistaPreparacionAction,
  });

  const cambiar = (cambios: Partial<FiltrosVistaPreparacion>) => setFiltros((prev) => ({ ...prev, ...cambios }));

  const cargarMas = (estadoId: string) =>
    setFiltros((prev) => ({
      ...prev,
      limites: { ...prev.limites, [estadoId]: (prev.limites[estadoId] ?? LIMITE_POR_ESTADO) + LIMITE_POR_ESTADO },
    }));

  const { tablero, resumen } = datos;
  const totalTarjetas = tablero.columnas.reduce((acc, c) => acc + c.tarjetas.length, 0);

  return (
    <>
      <PreparacionTabsRango
        filtros={filtros}
        onCambiar={cambiar}
        vista={vista}
        onVista={setVista}
        contadores={tablero.contadores}
        actualizando={actualizando}
        zonaNegocio={zonaNegocio}
      />

      <ZonaResultados actualizando={actualizando}>
        {totalTarjetas === 0 ? (
          filtros.q ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16">
              <SearchX className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Ningún pedido coincide con esa búsqueda en este rango.
              </p>
            </div>
          ) : (
            <EmptyState
              Icono={PackageCheck}
              titulo="Nada para preparar en este rango"
              descripcion="Cuando un pedido llegue a una etapa que habilita la preparación, aparecerá acá automáticamente."
            />
          )
        ) : vista === "lista" ? (
          <TableroLista columnas={tablero.columnas} />
        ) : (
          <TableroCliente
            columnas={tablero.columnas}
            puedeMod={puedeMod}
            agrupacion={tablero.configuracion.agrupacionDefecto}
            onCargarMas={cargarMas}
          />
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <ResumenPorProducto resumen={resumen} />
          {actividad}
        </div>
      </ZonaResultados>
    </>
  );
}
