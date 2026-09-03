# Research: Plantilla de ejemplo para importar destinos y tarifas

No quedaban `NEEDS CLARIFICATION` en el Technical Context del plan (proyecto, stack y dependencias ya están fijados por el codebase existente). Este documento resuelve las decisiones de diseño abiertas para que Phase 1 no tenga que improvisarlas.

## 1. Dónde vive el botón/opción de descarga

**Decision**: Se agrega dentro de `paso-archivo.tsx` (el mismo componente del paso "Subir archivo"), arriba o junto al `<Button>` "Elegir archivo" existente — no se crea un paso nuevo del wizard.

**Rationale**: FR-001 exige que la descarga esté disponible "antes de que el usuario elija su propio archivo", en el mismo paso 1 (`archivo`) que ya existe. `wizard-importacion-destinos.tsx` no necesita cambios de estado/navegación porque la descarga no consume ni produce datos del wizard (no hay `onArchivoParseado` de por medio).

**Alternatives considered**:
- Modal/paso dedicado "¿Cómo armar tu archivo?": rechazado — agrega un paso más al flujo para una acción secundaria (descargar), en contra de mantener el wizard corto (4 pasos ya definidos en `PasoImportacionDestinos`).
- Link fijo fuera del wizard (p. ej. en la página del transportista): rechazado — el pedido original es explícito en que la ayuda debe estar en el momento de "Subí un archivo CSV o Excel...", es decir dentro del paso 1.

## 2. Cómo ofrecer elegir CSV vs. Excel (US2)

**Decision**: Un único control con dos acciones — botón "Descargar plantilla de ejemplo" con un menú desplegable (`DropdownMenu` de `src/components/ui/dropdown-menu.tsx`, ya usado en el proyecto) con dos ítems: "Formato CSV" y "Formato Excel (.xlsx)". Cada ítem invoca su propia función `descargarPlantillaDestinosCsv()` / `descargarPlantillaDestinosExcel()`.

**Rationale**: Evita duplicar botones en un paso que ya es visualmente simple (dropzone + botón). El patrón `DropdownMenu` ya es parte del design system del proyecto (no se introduce un componente primitivo nuevo, coherente con el skill `design-systems`: "inspeccionar primero `src/components/ui/` — no crear duplicados").

**Alternatives considered**:
- Dos botones separados ("Descargar CSV" / "Descargar Excel") uno al lado del otro: rechazado por ocupar más espacio horizontal en un layout ya centrado y angosto (`paso-archivo.tsx` usa `flex flex-col items-center`); el dropdown resuelve esto con un solo punto de entrada.
- Un solo botón que siempre descarga CSV (sin elegir formato), dejando Excel fuera: rechazado — contradice explícitamente el pedido del usuario ("descargar plantilla de ejemplo excel o csv") y la Historia de Usuario 2 del spec.

## 3. Contenido de la fila (o filas) de ejemplo

**Decision**: Una sola fila de ejemplo, con valores plausibles para las 11 columnas de `COLUMNAS_DESTINO`, incluyendo:
- `alias` con dos valores separados por `;` (para ilustrar el caso "Alias (separados por \";\")" sin necesitar una segunda fila).
- `costoInterno`/`precioCliente` como números simples sin símbolo de moneda ni separador de miles (p. ej. `120.50`), coherente con `FilaDestinoImportSchema` (`z.coerce.number()`).
- `tiempoMinimoDias`/`tiempoMaximoDias` como enteros (p. ej. `2` y `5`).
- Columnas opcionales sin valor completo (`distritoCiudad`, `corregimiento`, `sectorOCodigoPostal`) se dejan con un valor de ejemplo igual (no vacías), porque una plantilla con celdas vacías desde el vamos es más difícil de interpretar como "opcional pero así se ve un valor válido" — el usuario ya puede borrar el contenido si no le aplica.

**Rationale**: Cubre en una sola fila todos los matices de formato mencionados en el Acceptance Scenario 2 de la Historia 1 (alias múltiples, números sin moneda, días enteros) sin sumar una segunda fila que complique la lectura. `parsearArchivo()` ya trunca la vista previa a 50 filas — 1 fila de ejemplo es insignificante en ese límite.

**Alternatives considered**:
- Dos filas de ejemplo (una con todos los campos completos, otra solo con los obligatorios) para mostrar explícitamente que las opcionales pueden ir vacías: rechazado por ahora — el marcado visual de obligatoriedad en el encabezado (ver Decisión 4) ya comunica eso sin necesitar una segunda fila; se documenta como posible mejora futura, no bloquea esta feature (ver Assumptions del spec).

## 4. Cómo marcar visualmente las columnas obligatorias (US3 / FR-004)

**Decision**: Sufijo `" *"` en el nombre de columna del encabezado de la plantilla para las 5 columnas de `COLUMNAS_DESTINO_REQUERIDAS` (p. ej. `"Nombre de la zona *"`), más una nota aclaratoria como primera fila del archivo antes del encabezado real — **descartada** (ver alternativa) a favor de mantenerlo simple: **solo el sufijo `" *"` en el header**, ya que agregar una fila de nota antes del encabezado real rompe la fila 1 = encabezado que tanto `parsearCSV` como `parsearExcel` asumen (`header: true` en Papa Parse, primera fila = encabezados en el parseo de Excel).

**Rationale**: `" *"` es una convención universalmente entendida (equivalente a "campo requerido" en formularios) que no interfiere con el parseo — es simplemente texto dentro del nombre de columna, igual que cualquier encabezado libre que ya soporta `paso-mapeo-columnas.tsx` (mapeo manual, sin matching exacto de texto). Cumple FR-004 sin arriesgar FR-006 (que la plantilla se pueda re-subir sin errores atribuibles a su formato).

**Alternatives considered**:
- Fila de notas/instrucciones antes de la fila de encabezados: rechazada — si el usuario sube la plantilla tal cual (edita solo los datos y no borra esa fila), el parseo tomaría esa fila de notas como encabezados reales, rompiendo FR-006.
- Dos hojas en el Excel (una "Instrucciones" y otra "Datos"): rechazada por sobre-ingeniería para el alcance pedido — el `parsearArchivo()` existente siempre lee `workbook.SheetNames[0]`, así que una hoja de instrucciones antes de la hoja de datos activamente rompería el flujo de re-subida si el usuario no supiera que debe ir a la segunda hoja.

## 5. Generación del archivo Excel (.xlsx) sin nueva dependencia

**Decision**: Usar `XLSX.utils.aoa_to_sheet()` (array-of-arrays → hoja) + `XLSX.utils.book_new()` / `XLSX.utils.book_append_sheet()` + `XLSX.writeFile()` de la librería `xlsx` ya instalada (usada hoy solo para *leer* en `parsearArchivo()`).

**Rationale**: Es la misma librería que el proyecto ya usa para el lado de lectura (`src/crm/datos/utils/parsear-archivo.ts`); usarla también para escritura evita agregar una dependencia nueva (regla del proyecto: "nuevas dependencias requieren una necesidad concreta y no deben duplicar una capacidad existente"). `XLSX.writeFile()` corre en el navegador (dispara la descarga directamente, sin pasar por `Blob`/`URL.createObjectURL` manual) — se ejecuta solo dentro del wrapper browser-only (`descargar-plantilla-destinos.ts`, `"use client"` transitivamente vía `paso-archivo.tsx`).

**Alternatives considered**:
- Generar el `.xlsx` en un endpoint de servidor (Route Handler) y ofrecer un link de descarga: rechazado — no hay necesidad de tocar el servidor para un archivo genérico sin datos de tenant; agregar una llamada de red introduce latencia y complejidad (autenticación de ruta, manejo de errores de red) sin beneficio, en contra de "Descarga percibida como instantánea" (Performance Goals del plan).
- Archivos `.xlsx`/`.csv` estáticos pre-generados en `public/` (mismo patrón que `src/crm/datos/utils/plantillas-config.ts` para el wizard genérico de CRM): rechazado — ese mecanismo obliga a mantener el archivo estático sincronizado a mano cada vez que cambien `COLUMNAS_DESTINO`/`ETIQUETAS_COLUMNA_DESTINO`/`COLUMNAS_DESTINO_REQUERIDAS`, mientras que generarlo dinámicamente desde esas constantes garantiza que la plantilla nunca queda desactualizada (ver Constraint del plan). Tampoco cubre Excel, solo CSV.

## 6. Generación del CSV

**Decision**: Reutilizar el mismo criterio que `src/sales/pedidos/utils/exportar-csv.ts` — encabezados + fila(s) unidas con `,`, celdas escapadas con comillas si contienen `,`/`"`/salto de línea, y BOM (`"﻿"`) al inicio del `Blob` para que Excel detecte UTF-8 (tildes, "ñ") correctamente. Mismo mecanismo de descarga (`Blob` → `URL.createObjectURL` → `<a download>` sintético → `click()` → `revokeObjectURL`).

**Rationale**: Es el patrón ya establecido y probado en el proyecto para exportar CSV desde el cliente; no hay razón para inventar uno nuevo. Mantiene consistencia de comportamiento entre distintos módulos (Ventas → Pedidos, Ventas → Transportistas).

**Alternatives considered**:
- Usar `Papa.unparse()` (papaparse ya expone esta función, contraparte de `Papa.parse()` usado para leer): considerada válida y técnicamente más corta, pero se descarta a favor de replicar `exportar-csv.ts` porque ese archivo ya resuelve el detalle no trivial del BOM para Excel y el escape de celdas, y es el precedente más cercano en el mismo dominio (Ventas) — minimiza el riesgo de un caso borde distinto (p. ej. separador `;` vs `,`) entre dos formas de generar CSV en el mismo proyecto.
