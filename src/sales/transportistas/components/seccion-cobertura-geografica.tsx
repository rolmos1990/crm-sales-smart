"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { SelectorPais } from "@/shared/entregas/components/selector-pais";
import { SelectorEstadoProvincia } from "@/shared/entregas/components/selector-estado-provincia";
import { obtenerModoGeograficoAction } from "@/configuracion/empresa/actions";
import { queryKeys } from "@/shared/query-keys";
import {
  listarCoberturaGeograficaAction,
  guardarCoberturaGeografica,
  eliminarCoberturaGeografica,
} from "../actions";

interface SeccionCoberturaGeograficaProps {
  transportistaId: string;
}

// 019-cobertura-geografica-envios — FR-001/FR-002. Embebido en
// dialog-transportista.tsx tanto al crear (una vez que el transportista ya
// existe) como al editar.
export function SeccionCoberturaGeografica({ transportistaId }: SeccionCoberturaGeograficaProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [paisId, setPaisId] = useState<string | null>(null);
  const [estadoProvinciaId, setEstadoProvinciaId] = useState<string | null>(null);
  const [costo, setCosto] = useState(0);

  const coberturaKey = ["transportistas", transportistaId, "cobertura-geografica"] as const;

  const { data: cobertura } = useQuery({
    queryKey: coberturaKey,
    queryFn: () => listarCoberturaGeograficaAction(transportistaId),
  });

  const { data: modo } = useQuery({
    queryKey: queryKeys.geografia.modo(),
    queryFn: () => obtenerModoGeograficoAction(),
    staleTime: 60_000,
  });

  const esUnSoloPais = modo?.modoGeografico === "UN_SOLO_PAIS";

  function agregarZona() {
    if (!estadoProvinciaId) {
      toast.error("Elige un estado/provincia");
      return;
    }
    if (!esUnSoloPais && !paisId) {
      toast.error("Elige un país");
      return;
    }
    startTransition(async () => {
      const resultado = await guardarCoberturaGeografica({
        transportistaId,
        paisId: paisId ?? modo?.paisOperacionId ?? "",
        estadoProvinciaId,
        costoEnvio: costo,
        activo: true,
      });
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Zona de cobertura guardada");
      setPaisId(null);
      setEstadoProvinciaId(null);
      setCosto(0);
      queryClient.invalidateQueries({ queryKey: coberturaKey });
    });
  }

  function quitarZona(id: string) {
    startTransition(async () => {
      const resultado = await eliminarCoberturaGeografica(id);
      if (!resultado.exito) {
        toast.error(resultado.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: coberturaKey });
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" /> Zonas de cobertura y costo de envío
      </p>

      {cobertura && cobertura.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {cobertura.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="text-foreground">
                {c.estadoProvincia.nombre}
                <span className="text-muted-foreground"> · {c.pais.banderaEmoji} {c.pais.nombre}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{Number(c.costoEnvio).toFixed(2)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={isPending}
                  onClick={() => quitarZona(c.id)}
                  aria-label={`Quitar cobertura de ${c.estadoProvincia.nombre}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sin zonas configuradas — el agente no podrá informar un costo real para este transportista.</p>
      )}

      <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
        {!esUnSoloPais && (
          <SelectorPais value={paisId} onChange={setPaisId} />
        )}
        <SelectorEstadoProvincia
          paisId={esUnSoloPais ? (modo?.paisOperacionId ?? null) : paisId}
          value={estadoProvinciaId}
          onChange={setEstadoProvinciaId}
        />
        <DecimalInput value={costo} onChange={setCosto} className="w-28" />
        <Button type="button" size="icon" disabled={isPending} onClick={agregarZona} aria-label="Agregar zona de cobertura">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
