"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { COLUMNAS_DESTINO, ETIQUETAS_COLUMNA_DESTINO, COLUMNAS_DESTINO_REQUERIDAS, type ColumnaDestino, type MapeoColumnasDestino } from "../types";

interface PasoMapeoColumnasProps {
  encabezados: string[];
  mapeo: MapeoColumnasDestino;
  onChange: (mapeo: MapeoColumnasDestino) => void;
}

const OPCIONES_SELECT = [{ valor: "", etiqueta: "Ignorar esta columna" }, ...COLUMNAS_DESTINO.map((c) => ({ valor: c, etiqueta: ETIQUETAS_COLUMNA_DESTINO[c] }))];
const ITEMS_SELECT = Object.fromEntries(OPCIONES_SELECT.map((o) => [o.valor, o.etiqueta]));

// 024-alias-ubicaciones-transportistas — a diferencia de CAMPOS_POR_ENTIDAD
// (src/crm/datos/), las columnas destino son fijas (no configurables por el
// usuario) — este paso solo pide mapear cada columna del archivo a una de
// ellas o ignorarla.
export function PasoMapeoColumnas({ encabezados, mapeo, onChange }: PasoMapeoColumnasProps) {
  const columnasMapeadas = new Set(Object.values(mapeo).filter(Boolean));
  const faltantes = COLUMNAS_DESTINO_REQUERIDAS.filter((c) => !columnasMapeadas.has(c));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Indicá a qué columna del sistema corresponde cada columna de tu archivo.</p>
      <div className="rounded-xl border border-border divide-y divide-border">
        {encabezados.map((encabezado) => (
          <div key={encabezado} className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm font-medium text-foreground truncate">{encabezado}</span>
            <Select
              items={ITEMS_SELECT}
              value={mapeo[encabezado] ?? ""}
              onValueChange={(valor) => onChange({ ...mapeo, [encabezado]: (valor ?? "") as ColumnaDestino | "" })}
            >
              <SelectTrigger className="w-56"><SelectValue placeholder="Ignorar" /></SelectTrigger>
              <SelectContent>
                {OPCIONES_SELECT.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>{o.etiqueta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      {faltantes.length > 0 && (
        <p className="text-xs text-danger">
          Faltan columnas obligatorias: {faltantes.map((c) => ETIQUETAS_COLUMNA_DESTINO[c]).join(", ")}
        </p>
      )}
    </div>
  );
}
