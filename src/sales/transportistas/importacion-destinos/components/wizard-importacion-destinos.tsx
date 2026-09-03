"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DatosArchivo } from "@/crm/datos/types";
import { revisarImportacionDestinosAction, confirmarImportacionDestinosAction } from "../actions";
import type {
  ColumnaDestino, DecisionFilaDestino, FilaRevisionDestino, MapeoColumnasDestino, PasoImportacionDestinos, ResumenRevisionDestinos,
} from "../types";
import { COLUMNAS_DESTINO_REQUERIDAS } from "../types";
import { PasoArchivo } from "./paso-archivo";
import { PasoMapeoColumnas } from "./paso-mapeo-columnas";
import { PasoRevision } from "./paso-revision";
import { PasoConfirmacion } from "./paso-confirmacion";

interface WizardImportacionDestinosProps {
  transportistaId: string;
  paisId: string;
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  onImportado: () => void;
}

const TITULOS: Record<PasoImportacionDestinos, string> = {
  archivo: "1. Subir archivo",
  mapeo: "2. Mapear columnas",
  revision: "3. Revisar",
  confirmacion: "4. Confirmar",
};

function mapearFila(fila: Record<string, string>, mapeo: MapeoColumnasDestino): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const [columnaArchivo, columnaDestino] of Object.entries(mapeo)) {
    if (columnaDestino) resultado[columnaDestino] = fila[columnaArchivo] ?? "";
  }
  return resultado;
}

export function WizardImportacionDestinos({ transportistaId, paisId, abierto, onOpenChange, onImportado }: WizardImportacionDestinosProps) {
  const [paso, setPaso] = useState<PasoImportacionDestinos>("archivo");
  const [datosArchivo, setDatosArchivo] = useState<DatosArchivo | null>(null);
  const [mapeo, setMapeo] = useState<MapeoColumnasDestino>({});
  const [filasRevision, setFilasRevision] = useState<FilaRevisionDestino[]>([]);
  const [resumen, setResumen] = useState<ResumenRevisionDestinos | null>(null);
  const [decisiones, setDecisiones] = useState<DecisionFilaDestino[]>([]);
  const [resultado, setResultado] = useState<{ creados: number; actualizados: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setPaso("archivo");
    setDatosArchivo(null);
    setMapeo({});
    setFilasRevision([]);
    setResumen(null);
    setDecisiones([]);
    setResultado(null);
  }

  const columnasMapeadas = new Set(Object.values(mapeo).filter(Boolean));
  const faltanRequeridas = COLUMNAS_DESTINO_REQUERIDAS.some((c) => !columnasMapeadas.has(c));

  function handleRevisar() {
    if (!datosArchivo) return;
    startTransition(async () => {
      const filas = datosArchivo.filas.map((f) => mapearFila(f, mapeo));
      const resultadoAccion = await revisarImportacionDestinosAction({ transportistaId, paisId, filas });
      if (!resultadoAccion.exito) {
        toast.error(resultadoAccion.error);
        return;
      }
      setFilasRevision(resultadoAccion.data!.filas);
      setResumen(resultadoAccion.data!.resumen);
      setDecisiones(
        resultadoAccion.data!.filas.map<DecisionFilaDestino>((f) =>
          f.estado === "ALIAS_AMBIGUO" || f.estado === "INCOMPLETA" ? { incluir: false } : { incluir: true },
        ),
      );
      setPaso("revision");
    });
  }

  function handleConfirmar() {
    if (!datosArchivo) return;
    setPaso("confirmacion");
    startTransition(async () => {
      const filas = datosArchivo.filas.map((f) => mapearFila(f, mapeo));
      const resultadoAccion = await confirmarImportacionDestinosAction({
        transportistaId,
        paisId,
        archivoNombre: datosArchivo.nombre,
        archivoTipo: datosArchivo.tipo,
        archivoPeso: datosArchivo.peso,
        filas,
        decisiones,
      });
      if (!resultadoAccion.exito) {
        toast.error(resultadoAccion.error);
        setPaso("revision");
        return;
      }
      setResultado(resultadoAccion.data!);
      onImportado();
    });
  }

  const hayFilaAmbiguaIncluida = filasRevision.some((f, idx) => decisiones[idx]?.incluir && (f.estado === "ALIAS_AMBIGUO" || f.estado === "INCOMPLETA"));

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITULOS[paso]}</DialogTitle>
        </DialogHeader>

        {paso === "archivo" && (
          <PasoArchivo
            onArchivoParseado={(datos) => {
              setDatosArchivo(datos);
              setMapeo(Object.fromEntries(datos.encabezados.map((h) => [h, ""])));
              setPaso("mapeo");
            }}
          />
        )}

        {paso === "mapeo" && datosArchivo && (
          <>
            <PasoMapeoColumnas encabezados={datosArchivo.encabezados} mapeo={mapeo} onChange={setMapeo} />
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPaso("archivo")}>Atrás</Button>
              <Button type="button" size="sm" disabled={faltanRequeridas || isPending} onClick={handleRevisar}>
                {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Revisar
              </Button>
            </div>
          </>
        )}

        {paso === "revision" && resumen && (
          <>
            <PasoRevision
              filas={filasRevision}
              decisiones={decisiones}
              resumen={resumen}
              onDecisionChange={(idx, decision) => setDecisiones((prev) => prev.map((d, i) => (i === idx ? decision : d)))}
            />
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPaso("mapeo")}>Atrás</Button>
              <Button type="button" size="sm" disabled={hayFilaAmbiguaIncluida || isPending} onClick={handleConfirmar}>
                {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Importar
              </Button>
            </div>
          </>
        )}

        {paso === "confirmacion" && (
          <>
            <PasoConfirmacion cargando={isPending} resultado={resultado} />
            {resultado && (
              <div className="flex justify-end pt-2">
                <Button type="button" size="sm" onClick={() => onOpenChange(false)}>Cerrar</Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
