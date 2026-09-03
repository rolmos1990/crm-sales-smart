# Contract: generación y descarga de la plantilla de ejemplo

No hay Server Action, Route Handler ni endpoint público nuevo — esta feature es 100% cliente (ver `research.md` Decisión 5: se descarta el endpoint de servidor por latencia/complejidad innecesaria). El "contrato" relevante es el de las funciones que exponen los nuevos archivos de `utils/`, consumidas por `components/paso-archivo.tsx`.

## `utils/plantilla-ejemplo-destinos.ts` (función pura, testable en Vitest)

```ts
export interface PlantillaEjemploDestinos {
  encabezados: string[]; // longitud === COLUMNAS_DESTINO.length, columnas requeridas con sufijo " *"
  filaEjemplo: string[]; // longitud === encabezados.length, mismo orden que encabezados
}

export function construirPlantillaEjemploDestinos(): PlantillaEjemploDestinos;
```

**Garantías**:
- Determinística: sin argumentos, sin IO, sin `Date.now()`/aleatoriedad — misma salida siempre.
- `encabezados[i]` y `filaEjemplo[i]` corresponden a la misma columna de `COLUMNAS_DESTINO[i]`.
- No lanza excepciones.

**No garantiza** (fuera de alcance de esta función): formato de archivo final (CSV vs. Excel), ni el disparo de la descarga en el navegador — eso lo resuelven los wrappers de abajo.

## `utils/descargar-plantilla-destinos.ts` (wrappers browser-only, sin test unitario — mismo criterio que `exportar-csv.ts`)

```ts
export function descargarPlantillaDestinosCsv(): void;
export function descargarPlantillaDestinosExcel(): void;
```

**Garantías**:
- Cada función llama internamente a `construirPlantillaEjemploDestinos()` y dispara una descarga de archivo en el navegador (`.csv` o `.xlsx` respectivamente) con un nombre de archivo fijo y reconocible (p. ej. `plantilla-destinos-transportista.csv` / `.xlsx`).
- No reciben parámetros — la plantilla es genérica (no depende de `transportistaId`/`paisId`, ver Assumptions del spec).
- No devuelven valor ni Promise resuelta con datos — el efecto observable es la descarga del archivo por el navegador.
- Solo pueden invocarse en un Client Component (usan `Blob`/`document`/`XLSX.writeFile`, no disponibles en el servidor).

## Consumo desde `components/paso-archivo.tsx`

El componente importa ambos wrappers y los conecta a un `DropdownMenu` con dos `DropdownMenuItem` ("Formato CSV" / "Formato Excel (.xlsx)"), sin pasarles props — no hay nuevo estado de componente involucrado (no afecta `PasoArchivoProps` existente).
