# Quickstart: validar la plantilla de ejemplo de importación de destinos

## Prerrequisitos

- Repo en la rama `025-plantilla-ejemplo-importacion-destinos` con la feature implementada.
- `npm install` ya corrido (no se agregan dependencias nuevas — `xlsx` y `papaparse` ya están en `package.json`).
- Un transportista existente con al menos un país habilitado (para poder abrir el asistente de importación de destinos desde la UI).

## 1. Validar la función pura (sin levantar el servidor)

```bash
npx vitest run src/sales/transportistas/importacion-destinos/utils/plantilla-ejemplo-destinos.test.ts
```

**Resultado esperado**: el test pasa y cubre, como mínimo (ver `data-model.md` invariantes):
- `encabezados.length === filaEjemplo.length === 11` (una por cada `ColumnaDestino`).
- Las 5 columnas de `COLUMNAS_DESTINO_REQUERIDAS` (zona, provincia/estado, servicio, costo transportista, precio al cliente) aparecen en `encabezados` con el sufijo `" *"`.
- El valor de ejemplo de `alias` contiene al menos dos valores separados por `;`.

## 2. Validar el flujo end-to-end en la UI

```bash
npm run dev
```

1. Ir a la ficha de un transportista → sección de destinos y tarifas → abrir el asistente de importación ("Importar destinos" o equivalente).
2. En el paso 1 ("Subir archivo"), confirmar que aparece la opción de descargar plantilla **antes** de elegir un archivo propio (Acceptance Scenario 1 de US1).
3. Descargar en formato **CSV**:
   - Abrir el archivo descargado y confirmar que trae 1 fila de encabezados + 1 fila de ejemplo.
   - Confirmar que las columnas obligatorias llevan `" *"` en el nombre (US3).
   - Confirmar que la columna de alias muestra dos valores separados por `;` (Acceptance Scenario 2 de US1).
4. Descargar en formato **Excel (.xlsx)**:
   - Abrir el archivo y confirmar el mismo contenido que el CSV (mismas columnas, mismo orden, misma fila de ejemplo) — Acceptance Scenario de US2.
5. **Re-subida sin romper el flujo** (Acceptance Scenario 3 de US1 / FR-006):
   - Tomar cualquiera de los dos archivos descargados, reemplazar la fila de ejemplo por un destino real (dejando los encabezados con `" *"` tal cual), y subirlo en el mismo paso del asistente.
   - Confirmar que el asistente avanza normalmente al paso "Mapear columnas" sin error de lectura del archivo.
   - En "Mapear columnas", confirmar que se puede mapear cada columna del archivo (con o sin el sufijo `" *"` en el nombre) a su columna de destino correspondiente sin problema.

## 3. Chequeo de alcance (Assumptions del spec)

- Confirmar que la opción de descarga **no** cambia según el transportista o país seleccionado (la plantilla es genérica) — abrir el asistente para dos transportistas distintos y confirmar que el archivo descargado es idéntico en ambos casos.
- Confirmar que ningún dato del archivo descargado corresponde a un destino, zona, tarifa o transportista real existente en la base (FR-007) — los valores deben ser claramente ilustrativos (p. ej. nombres de zona/ciudad de ejemplo, no nombres reales de la instancia).
