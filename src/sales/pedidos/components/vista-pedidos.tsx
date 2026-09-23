"use client";

import { useState } from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import { useVistaFiltrada, ZonaResultados } from "@/shared/ui/vista-filtrada";
import { queryKeys } from "@/shared/query-keys";
import { consultarVistaPedidosAction } from "../actions";
import { FILTROS_VISTA_PEDIDOS_DEFECTO, type FiltrosVistaPedidos } from "../schema";
import type { EtapaFlujoVista, VistaPedidos as DatosVistaPedidos } from "../vista";
import { ListaPedidos } from "./lista-pedidos";
import { PedidosFiltrosBar } from "./pedidos-filtros";
import { PedidosKpiCards } from "./pedidos-kpi-cards";

interface Props {
  /** Resultado con los filtros por defecto, ya resuelto en el servidor. */
  inicial: DatosVistaPedidos;
  contactos: OpcionCombobox[];
  productos: OpcionCombobox[];
  etapasFlujo: EtapaFlujoVista[];
  zonaNegocio: string;
  moneda: string;
  etiquetaMesActual: string;
}

/** Barra de filtros + KPIs + tabla. Los filtros son estado de este componente:
 *  arrancan en el default (solo pedidos activos) cada vez que se entra. */
export function VistaPedidos({ inicial, contactos, productos, etapasFlujo, zonaNegocio, moneda, etiquetaMesActual }: Props) {
  const [filtros, setFiltros] = useState<FiltrosVistaPedidos>(FILTROS_VISTA_PEDIDOS_DEFECTO);
  const esDefecto = JSON.stringify(filtros) === JSON.stringify(FILTROS_VISTA_PEDIDOS_DEFECTO);

  const { datos, actualizando } = useVistaFiltrada({
    clave: queryKeys.pedidos.vista(),
    filtros,
    esDefecto,
    inicial,
    consultar: consultarVistaPedidosAction,
  });

  const cambiar = (cambios: Partial<FiltrosVistaPedidos>) => setFiltros((prev) => ({ ...prev, ...cambios }));

  return (
    <>
      <PedidosFiltrosBar
        filtros={filtros}
        onCambiar={cambiar}
        actualizando={actualizando}
        contactos={contactos}
        productos={productos}
        pedidosFiltrados={datos.pedidos}
        etapasFlujo={etapasFlujo}
        zonaNegocio={zonaNegocio}
        cerradosForzados={datos.cerradosForzados}
      />
      <ZonaResultados actualizando={actualizando}>
        <PedidosKpiCards kpis={datos.kpis} moneda={moneda} hayRangoFecha={datos.hayRangoFecha} etiquetaMesActual={etiquetaMesActual} />
        {datos.pedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-200 dark:border-white/10 py-16">
            <div className="h-12 w-12 rounded-2xl bg-stone-100 dark:bg-white/5 flex items-center justify-center">
              <SearchX className="h-5 w-5 text-stone-300 dark:text-stone-600" />
            </div>
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
              {datos.hayFiltrosActivos
                ? "No encontramos pedidos con estos filtros."
                : "Todos tus pedidos están cerrados (entregados o cancelados)."}
            </p>
            {datos.hayFiltrosActivos ? (
              <Button variant="outline" size="sm" onClick={() => setFiltros(FILTROS_VISTA_PEDIDOS_DEFECTO)}>
                Limpiar filtros
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => cambiar({ cerrados: true })}>
                Ver cerrados
              </Button>
            )}
          </div>
        ) : (
          <ListaPedidos pedidos={datos.pedidos} etapasFlujo={etapasFlujo} zonaHoraria={zonaNegocio} />
        )}
      </ZonaResultados>
    </>
  );
}
