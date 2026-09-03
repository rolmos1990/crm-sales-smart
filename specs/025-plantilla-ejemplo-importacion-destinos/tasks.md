---

description: "Task list template for feature implementation"
---

# Tasks: Plantilla de ejemplo para importar destinos y tarifas

**Input**: Design documents from `/specs/025-plantilla-ejemplo-importacion-destinos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/plantilla-ejemplo-destinos.md](./contracts/plantilla-ejemplo-destinos.md), [quickstart.md](./quickstart.md)

**Tests**: Se incluyen tareas de test — el plan (Constitution Check, principio V) comprometió un test Vitest para la función pura generadora, proporcional al riesgo bajo de la feature (sin dinero, sin datos de tenant, sin mutación).

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para permitir implementación y prueba independientes de cada una.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Proyecto único (Next.js App Router). Todas las rutas son relativas a la raíz del repo, dentro del módulo ya existente `src/sales/transportistas/importacion-destinos/` (ver "Structure Decision" en plan.md).

---

## Phase 1: Setup

**Purpose**: Confirmar que no hace falta preparación de proyecto/dependencias antes de tocar código.

- [X] T001 Confirmar en `package.json` que `xlsx` (^0.18.5) y `papaparse` (^5.5.3) ya están instaladas (research.md Decisiones 5 y 6) — no se ejecuta `npm install`, no se agrega ninguna dependencia nueva.

**Checkpoint**: Nada que instalar — se puede pasar directo a Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: La función pura que arma el contenido de la plantilla (encabezados + fila de ejemplo, con el marcado de columnas obligatorias) es compartida por las tres historias — CSV (US1), Excel (US2) y el marcado de obligatoriedad (US3) parten todos de esta misma salida. Sin esto no se puede completar ninguna historia.

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta que esta fase esté completa.

- [X] T002 Crear `src/sales/transportistas/importacion-destinos/utils/plantilla-ejemplo-destinos.ts` con la función pura `construirPlantillaEjemploDestinos()` (firma exacta en [contracts/plantilla-ejemplo-destinos.md](./contracts/plantilla-ejemplo-destinos.md)): `encabezados` derivado de `COLUMNAS_DESTINO`/`ETIQUETAS_COLUMNA_DESTINO` (con sufijo `" *"` para las columnas de `COLUMNAS_DESTINO_REQUERIDAS`, research.md Decisión 4) y `filaEjemplo` con los valores de muestra descritos en research.md Decisión 3 (alias múltiples separados por `;`, costos/precios sin símbolo de moneda, tiempos como enteros). Agregar comentario de cabecera breve referenciando `025-plantilla-ejemplo-importacion-destinos` y por qué se genera dinámicamente en vez de hardcodear un archivo estático (research.md Decisión 5), siguiendo el mismo criterio de comentarios ya usado en este módulo (ver `types.ts`).
- [X] T003 Escribir `src/sales/transportistas/importacion-destinos/utils/plantilla-ejemplo-destinos.test.ts` (Vitest) verificando los invariantes de `data-model.md`: `encabezados.length === filaEjemplo.length === COLUMNAS_DESTINO.length` (11), y que el valor de ejemplo de `alias` contiene al menos dos valores separados por `;`. (Depende de T002.)

**Checkpoint**: `construirPlantillaEjemploDestinos()` existe, está testeada y lista para ser consumida por los wrappers de descarga de US1/US2.

---

## Phase 3: User Story 1 - Descargar la plantilla antes de subir el archivo (Priority: P1) 🎯 MVP

**Goal**: Un usuario en el paso "Subir archivo" puede descargar una plantilla de ejemplo (CSV) con las columnas, el marcado de obligatorias y una fila de ejemplo, antes de elegir su propio archivo.

**Independent Test**: Abrir el asistente de importación de destinos de cualquier transportista, en el paso 1 hacer clic en "Descargar plantilla de ejemplo", abrir el `.csv` descargado y confirmar que trae las 11 columnas (con `" *"` en las 5 obligatorias) y una fila de ejemplo; volver a subir ese mismo archivo (con la fila de ejemplo reemplazada por un destino real) y confirmar que el asistente avanza sin error de formato.

### Implementation for User Story 1

- [X] T004 [US1] Crear `src/sales/transportistas/importacion-destinos/utils/descargar-plantilla-destinos.ts` con `descargarPlantillaDestinosCsv()`: arma el texto CSV (encabezados + fila de ejemplo de `construirPlantillaEjemploDestinos()`, celdas escapadas, BOM UTF-8 al inicio) y dispara la descarga vía `Blob`/`URL.createObjectURL`/`<a download>` sintético, igual criterio que `src/sales/pedidos/utils/exportar-csv.ts` (research.md Decisión 6). Nombre de archivo fijo, p. ej. `plantilla-destinos-transportista.csv`.
- [X] T005 [US1] Modificar `src/sales/transportistas/importacion-destinos/components/paso-archivo.tsx`: agregar la opción "Descargar plantilla de ejemplo" (ícono `Download` de `lucide-react`) arriba/junto al botón "Elegir archivo" existente, visible sin que el usuario haya elegido ningún archivo todavía (FR-001), conectada a `descargarPlantillaDestinosCsv()`. *Nota: implementada en un mismo paso junto con T008 (dropdown con ambos formatos) — la ejecución fue directa al estado final en vez de pasar por un botón simple intermedio; el resultado cumple igualmente el acceptance scenario de US1 en CSV.*
- [ ] T006 [US1] Validación manual siguiendo [quickstart.md](./quickstart.md) §2 pasos 1–3 (la opción de descarga aparece antes de elegir archivo; el CSV trae columnas + marcado de obligatorias + alias de ejemplo) y paso 5 (re-subir el archivo completado con un destino real y confirmar que el asistente avanza sin error de formato). *Pendiente: no hay herramienta de automatización de navegador disponible en esta sesión para hacer el click-through real y capturar screenshot — se validó por vía indirecta (test unitario del contenido, `tsc --noEmit` limpio en los archivos tocados, y confirmación de que el servidor de desarrollo ya corriendo del usuario sigue respondiendo con normalidad tras el cambio). Recomendado hacer este paso a mano o con Playwright antes de dar la historia por cerrada.*

**Checkpoint**: User Story 1 completamente funcional y testeable de forma independiente — MVP entregable.

---

## Phase 4: User Story 2 - Elegir el formato de la plantilla (CSV o Excel) (Priority: P2)

**Goal**: El usuario puede elegir descargar la plantilla en Excel (`.xlsx`) además de CSV.

**Independent Test**: En el paso 1 del asistente, elegir "Formato Excel" desde el control de descarga y confirmar que el `.xlsx` resultante trae las mismas columnas, el mismo orden y la misma fila de ejemplo que el CSV de la Historia 1.

### Implementation for User Story 2

- [X] T007 [US2] Agregar `descargarPlantillaDestinosExcel()` a `src/sales/transportistas/importacion-destinos/utils/descargar-plantilla-destinos.ts`: arma un workbook con `XLSX.utils.aoa_to_sheet([encabezados, filaEjemplo])` (misma salida de `construirPlantillaEjemploDestinos()` que usa T004) y lo descarga con `XLSX.writeFile()` (research.md Decisión 5). Nombre de archivo fijo, p. ej. `plantilla-destinos-transportista.xlsx`.
- [X] T008 [US2] Modificar `src/sales/transportistas/importacion-destinos/components/paso-archivo.tsx`: reemplazar el botón simple de T005 por un `DropdownMenu` (`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` de `src/components/ui/dropdown-menu.tsx`) con dos ítems — "Formato CSV" (→ `descargarPlantillaDestinosCsv()`) y "Formato Excel (.xlsx)" (→ `descargarPlantillaDestinosExcel()`) — research.md Decisión 2. Agregar comentario breve referenciando `025-plantilla-ejemplo-importacion-destinos` explicando por qué se usa un dropdown en vez de dos botones (layout angosto del paso, ver research.md Decisión 2). (Depende de T005 y T007.)
- [ ] T009 [US2] Validación manual siguiendo [quickstart.md](./quickstart.md) §2 paso 4 (descargar en Excel y confirmar mismo contenido que el CSV de la Historia 1). *Pendiente — mismo motivo que T006 (sin herramienta de navegador en esta sesión); el contenido que produce `descargarPlantillaDestinosExcel()` es el mismo objeto `construirPlantillaEjemploDestinos()` ya cubierto por el test unitario, por lo que el riesgo de que difiera del CSV es bajo, pero falta la confirmación visual real del archivo `.xlsx`.*

**Checkpoint**: User Stories 1 y 2 funcionan de forma independiente — el usuario ya puede elegir CSV o Excel.

---

## Phase 5: User Story 3 - Distinguir columnas obligatorias de opcionales de un vistazo (Priority: P3)

**Goal**: Garantizar con una prueba de regresión dedicada que el marcado de obligatoriedad (ya construido en la función base de Foundational, consumido por ambos formatos de descarga) sea correcto y no se rompa en cambios futuros — el marcado en sí ya está entregado desde User Story 1 (Acceptance Scenario 2 del spec exige que ya sea reconocible desde la primera descarga); esta historia formaliza esa garantía con test y verificación explícita en ambos formatos.

**Independent Test**: Correr el test dedicado de T010 y confirmar visualmente, tanto en el `.csv` como en el `.xlsx` descargados, que únicamente las 5 columnas de `COLUMNAS_DESTINO_REQUERIDAS` (zona, provincia/estado, servicio, costo transportista, precio al cliente) llevan el sufijo `" *"`.

### Implementation for User Story 3

- [X] T010 [US3] Agregar un caso de test dedicado en `src/sales/transportistas/importacion-destinos/utils/plantilla-ejemplo-destinos.test.ts` que recorra `COLUMNAS_DESTINO_REQUERIDAS` y confirme que cada una aparece en `encabezados` con el sufijo `" *"`, y que ninguna columna opcional lo lleva (data-model.md, invariante de obligatoriedad).
- [ ] T011 [US3] Validación manual siguiendo [quickstart.md](./quickstart.md) §2 pasos 3–4 (chequeo específico del sufijo `" *"` en las columnas obligatorias) en ambos archivos descargados (CSV y Excel). *Pendiente — mismo motivo que T006/T009; cubierto indirectamente por el test dedicado de T010 sobre la función que alimenta a ambos formatos.*

**Checkpoint**: Las tres historias de usuario funcionan de forma independiente y están cubiertas por test de regresión.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final antes de dar la feature por terminada.

- [X] T012 [P] Correr `npx vitest run src/sales/transportistas/importacion-destinos/utils/plantilla-ejemplo-destinos.test.ts` y el build/typecheck del proyecto (`npm run build`) para confirmar que no hay regresiones. *Se corrió `vitest run` sobre todo el módulo (14/14 tests, incluyendo `actions.test.ts` existente) y `tsc --noEmit` completo del proyecto: los 8 errores preexistentes son ajenos a esta feature (scripts, mocks, providers de email/select no tocados); no se corrió `npm run build` completo (requiere infraestructura de build más pesada) — el typecheck ya cubre el mismo chequeo de tipos que hace `next build`.*
- [ ] T013 Ejecutar la validación completa de [quickstart.md](./quickstart.md) (§1, §2 y §3) como cierre final, incluyendo el chequeo de que la plantilla es genérica (igual para cualquier transportista/país) y no contiene datos reales (FR-007). *§1 (Vitest) completo y en verde. §2/§3 (flujo manual en UI) pendiente — ver notas en T006/T009/T011: no hay herramienta de navegador disponible en esta sesión para el click-through real.*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede arrancar de inmediato.
- **Foundational (Phase 2)**: Depende de Setup. BLOQUEA las tres historias de usuario.
- **User Story 1 (Phase 3)**: Depende de Foundational. Es el MVP.
- **User Story 2 (Phase 4)**: Depende de Foundational; T008 depende además de T005 (US1) porque modifica el mismo componente que introdujo el botón simple.
- **User Story 3 (Phase 5)**: Depende de Foundational (T002/T003); no depende de US1/US2 para el test (T010), pero la validación manual (T011) necesita los archivos descargables de ambas (T004/T007) para verificar los dos formatos.
- **Polish (Phase 6)**: Depende de que las historias que se quieran entregar ya estén completas.

### Within Each User Story

- US1: T004 (wrapper CSV) antes de T005 (UI) antes de T006 (validación manual).
- US2: T007 (wrapper Excel) puede hacerse en paralelo con T004/T005 de US1 (archivo distinto); T008 (UI) depende de que T005 ya exista (modifica el mismo botón) y de T007; T009 (validación) al final.
- US3: T010 (test) depende solo de Foundational, puede adelantarse; T011 (validación manual) depende de tener ambos formatos descargables (T004, T007).

### Parallel Opportunities

- T002 y T003 son secuenciales (el test importa la función), no paralelos entre sí.
- T007 (wrapper Excel, US2) puede desarrollarse en paralelo con T004/T005 (US1) — archivo `descargar-plantilla-destinos.ts` compartido con T004, pero son dos funciones independientes dentro del mismo archivo; si se prefiere evitar conflictos de merge, hacer T004 primero y T007 inmediatamente después en la misma rama.
- T010 (test de US3) puede adelantarse en paralelo a toda la Phase 3/4, ya que solo depende de Foundational.
- T012 (test run + build) es paralelizable respecto a tareas de documentación, pero en la práctica es el último paso antes de T013.

---

## Parallel Example: Foundational + User Story 3 en paralelo con User Story 1/2

```bash
# Una vez completada Foundational (T002, T003):
Task: "T010 [US3] Agregar caso de test de marcado de obligatoriedad en utils/plantilla-ejemplo-destinos.test.ts"
Task: "T004 [US1] Crear descargarPlantillaDestinosCsv() en utils/descargar-plantilla-destinos.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Completar Phase 1: Setup (T001 — confirmación, sin trabajo real).
2. Completar Phase 2: Foundational (T002, T003 — CRÍTICO, bloquea todo lo demás).
3. Completar Phase 3: User Story 1 (T004–T006).
4. **STOP y VALIDAR**: probar la descarga CSV de forma independiente (quickstart.md §2 pasos 1–3 y 5).
5. Con esto ya hay una plantilla de ejemplo descargable — valor entregado, aunque solo en CSV.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. User Story 1 (CSV) → validar → esto ya resuelve el pedido original del usuario en su forma mínima.
3. User Story 2 (agrega Excel) → validar → cubre el pedido completo ("excel o csv").
4. User Story 3 (test de regresión del marcado de obligatorias) → validar → blindaje contra regresiones futuras en FR-004.
5. Polish (T012–T013) → cierre.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- La suma de tareas es intencionalmente chica (13) — la feature es acotada (sin persistencia, sin servidor, un solo componente modificado dos veces de forma incremental).
- T005 y T008 tocan el mismo archivo (`paso-archivo.tsx`) en momentos distintos (US1 primero, US2 después) — no se paralelizan entre sí a propósito, para evitar conflictos de merge en el mismo bloque JSX.
- Verificar que T003/T010 (tests) efectivamente fallan antes de completar T002 y pasan después, si se sigue un flujo TDD; el proyecto no exige TDD estricto (ver `actions.test.ts` existente, escrito junto con la implementación).
