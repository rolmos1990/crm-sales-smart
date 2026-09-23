"use client";

import type { ComponentProps } from "react";
import { Loader2, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ProveedorFiltrosEnEstado,
  useQueryEnEstado,
  useVistaFiltrada,
  ZonaResultados,
} from "@/shared/ui/vista-filtrada";
import { queryKeys } from "@/shared/query-keys";
import { consultarVistaOportunidadesAction } from "../actions";
import type { VistaOportunidades as DatosVistaOportunidades } from "../vista";
import { ListaOportunidades } from "./lista-oportunidades";
import { OportunidadesFiltrosBar } from "./oportunidades-filtros";
import { OportunidadesKpiCards } from "./oportunidades-kpi-cards";

interface Props {
  /** Resultado sin filtros, ya resuelto en el servidor. */
  inicial: DatosVistaOportunidades;
  moneda: string;
  barra: ComponentProps<typeof OportunidadesFiltrosBar>;
}

/** KPIs + barra de filtros + tabla. Los filtros son estado de este
 *  componente: arrancan vacíos cada vez que se entra al módulo. */
export function VistaOportunidades({ inicial, moneda, barra }: Props) {
  const { query, params, navegar, filtros } = useQueryEnEstado();

  const { datos, actualizando } = useVistaFiltrada({
    clave: queryKeys.oportunidadesVista.lista(),
    filtros,
    esDefecto: query === "",
    inicial,
    consultar: consultarVistaOportunidadesAction,
  });

  return (
    <ProveedorFiltrosEnEstado params={params} navegar={navegar} actualizando={actualizando}>
      <OportunidadesKpiCards kpis={datos.kpis} moneda={moneda} />
      <div className="flex flex-col gap-2">
        <OportunidadesFiltrosBar {...barra} />
        {actualizando && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Actualizando…
          </span>
        )}
      </div>
      <ZonaResultados actualizando={actualizando}>
        {datos.oportunidades.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
              <SearchX className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No encontramos oportunidades con estos filtros.</p>
            <Button variant="outline" size="sm" onClick={() => navegar(new URLSearchParams())}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <ListaOportunidades oportunidades={datos.oportunidades} />
        )}
      </ZonaResultados>
    </ProveedorFiltrosEnEstado>
  );
}
