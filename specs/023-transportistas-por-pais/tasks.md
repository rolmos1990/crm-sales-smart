---

description: "Task list template for feature implementation"
---

# Tasks: Transportistas por país

**Input**: Design documents from `/specs/023-transportistas-por-pais/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/server-actions.md](contracts/server-actions.md), [quickstart.md](quickstart.md)

**Tests**: Incluidos — mismo criterio que specs 019/022 de este proyecto (Vitest para lógica de servidor, Playwright para el flujo e2e).

**Organization**: Tareas agrupadas por historia de usuario para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1–US4)

## Path Conventions

Proyecto único Next.js — `src/`, `prisma/`, `scripts/`, `tests/` en la raíz del repo (ver plan.md → Project Structure).

---

## Phase 1: Setup

**Purpose**: Cambio de esquema compartido por todas las historias

- [X] T001 Modificar `prisma/schema.prisma`: agregar `paisId String?` + relación `pais Pais? @relation(fields: [paisId], references: [id], onDelete: Restrict)` a `Transportista`, `@@index([paisId])`, y la relación inversa `transportistas Transportista[]` en `model Pais` (ver [data-model.md](data-model.md))
- [X] T002 Ejecutar `npm run db:migrate` para generar la migración de `Transportista.paisId` (nullable) y confirmar que el Prisma Client se regeneró sin errores — *nota: la BD no era alcanzable desde este entorno; migración escrita a mano siguiendo el estilo exacto de las migraciones existentes, `prisma generate` corrido y verificado offline; queda pendiente aplicarla contra una BD real (`prisma migrate deploy` o `db:migrate` con conectividad)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lo que todas las historias necesitan leer, antes de que cualquiera pueda implementarse

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase

- [X] T003 [P] Modificar `src/sales/transportistas/queries.ts`: `obtenerTransportista` y `obtenerTransportistas` agregan `include: { pais: true }` y devuelven `tienePaisBloqueado: boolean` (a partir de `prisma.tarifaTransportistaZona.count({ where: { transportistaId } })` sin filtrar por `activa`, distinto del `zonasActivas` ya existente) — ver [contracts/server-actions.md](contracts/server-actions.md)
- [X] T004 [P] Tests Vitest en `src/sales/transportistas/queries.test.ts` (crear si no existe): `obtenerTransportista`/`obtenerTransportistas` devuelven `pais` correctamente cuando está asignado y `null` cuando no; `tienePaisBloqueado` es `true` solo cuando existe al menos una `TarifaTransportistaZona` (activa o inactiva) para ese transportista — 6/6 passing

**Checkpoint**: Fundación lista — las historias de usuario pueden empezar

---

## Phase 3: User Story 1 - Asignar el país de operación de un transportista (Priority: P1) 🎯 MVP

**Goal**: País obligatorio al crear un transportista; visible en su información; bloqueado en edición una vez que tiene tarifas configuradas.

**Independent Test**: Crear dos transportistas con el mismo nombre y país distinto y confirmar que son registros totalmente independientes; sobre uno con tarifas ya configuradas, intentar cambiarle el país y confirmar que se rechaza.

### Tests for User Story 1

- [X] T005 [P] [US1] Tests Vitest en `src/sales/transportistas/actions.test.ts` (extender): `crearTransportista` falla sin `paisId` y lo persiste cuando viene; `editarTransportista` rechaza el cambio de país cuando `tienePaisBloqueado` (ver T003) y lo permite cuando no; el historial registra `paisId` en `valorAnterior`/`valorNuevo` — 15/15 passing

### Implementation for User Story 1

- [X] T006 [US1] Modificar `src/sales/transportistas/schema.ts`: agregar `paisId: z.string().min(1, "Selecciona un país")` a `CrearTransportistaSchema`; agregar `paisId: z.string().min(1).optional()` a `EditarTransportistaSchema`
- [X] T007 [US1] Modificar `src/sales/transportistas/actions.ts`: `crearTransportista` persiste `paisId`; `editarTransportista` verifica `prisma.tarifaTransportistaZona.count({ where: { transportistaId: id } })` antes de aceptar un `paisId` distinto del actual y devuelve `{ exito: false, error: "..." }` si es mayor a 0; ambas agregan `paisId` al payload de `registrarHistorialTransportista` (depende de T006)
- [X] T008 [US1] Modificar `src/sales/transportistas/components/form-transportista.tsx`: agregar el campo País con `<SelectorPais>` (importado de `@/shared/entregas/components/selector-pais`), obligatorio, junto al campo Tipo
- [X] T009 [US1] Modificar `src/sales/transportistas/components/seccion-informacion-transportista.tsx`: agregar el campo País con `<SelectorPais>`; deshabilitado con ícono de candado y texto explicativo cuando `tienePaisBloqueado` es `true` (T003); banner "País pendiente" cuando `transportista.paisId` es `null` (depende de T003) — *nota: introduce un error de tipos transitorio en `panel-transportista.tsx` (prop `transportista` no es aún `TransportistaConPais`), resuelto en T018*

**Checkpoint**: User Story 1 funcional de forma independiente

---

## Phase 4: User Story 2 - Configurar zonas y tarifas usando el catálogo real de estados/provincias (Priority: P1)

**Goal**: Al agregar una zona desde un transportista, el país queda fijo al del transportista y la provincia/estado se elige de un catálogo real; el selector de zonas para tarifas solo muestra zonas del país del transportista.

**Independent Test**: Abrir "Agregar zona" en un transportista con país asignado, confirmar que el país aparece pre-completado y bloqueado, y que la provincia/estado ofrece únicamente opciones reales de ese país.

### Tests for User Story 2

- [X] T010 [P] [US2] Tests Vitest en `src/sales/transportistas/zonas/actions.test.ts` (extender): `listarZonasEntregaAction`/`listarZonasEntrega` devuelven solo zonas con alguna ubicación del `paisId` pasado; sin `paisId`, devuelven el catálogo completo (comportamiento actual sin cambios) — 11/11 passing

### Implementation for User Story 2

- [X] T011 [US2] Modificar `src/sales/transportistas/zonas/queries.ts`: `listarZonasEntrega` gana el parámetro opcional `paisId`; cuando viene, agrega `ubicaciones: { some: { paisId } }` al `where`
- [X] T012 [US2] Modificar `src/sales/transportistas/zonas/actions.ts`: `listarZonasEntregaAction` acepta y reenvía el mismo parámetro opcional `paisId` (depende de T011)
- [X] T013 [US2] Modificar `src/sales/transportistas/tarifas/queries.ts`: en `listarTarifas`, el `select` de `zonaEntrega` pasa a `include` con `ubicaciones: { include: { pais: true } }` para poder mostrar la provincia/estado real de cada tarifa
- [X] T014 [US2] Modificar `src/app/sales/transportistas/[id]/page.tsx`: pasar `transportista.paisId` a `listarZonasEntrega`, y mapear en cada tarifa una etiqueta de ubicación real (ej. `"Panamá — Panamá Centro"`) a partir de `zonaEntrega.ubicaciones` (T013) antes de pasarla a `PanelTransportista` (depende de T011, T013)
- [X] T015 [US2] Modificar `src/sales/transportistas/components/dialog-zona-entrega.tsx`: cambiar la interfaz a `{ paisId, paisLabel, onCreada }`; el campo país se renderiza deshabilitado (candado) con `paisLabel`, preselecciona `ubicaciones[0].paisId = paisId` sin `<SelectorPais>`; reemplazar el `<Input>` de "Provincia/Estado" por `<SelectorEstadoProvincia paisId={paisId} value={...} onChange={...} />` (importado de `@/shared/entregas/components/selector-estado-provincia`)
- [X] T016 [US2] Modificar `src/sales/transportistas/components/seccion-zonas-tarifas.tsx`: recibir `paisId`/`paisLabel` del transportista y pasarlos a `DialogZonaEntrega`; deshabilitar los botones "Agregar zona" y "Agregar tarifa" (con tooltip "Completa el país del transportista para configurar zonas") cuando `paisId` es `null`; agregar la columna "Estado/Provincia" a la tabla usando la etiqueta de T014 (depende de T014, T015) — *nota: `PanelTransportista` (T018) todavía no pasa las nuevas props `pais`/`paisId` — error de tipos transitorio, resuelto ahí*

**Checkpoint**: User Stories 1 y 2 funcionan juntas de forma independiente

---

## Phase 5: User Story 3 - Distinguir a simple vista transportistas del mismo courier en distintos países (Priority: P2)

**Goal**: Ver el país (bandera + nombre) de cada transportista en la lista y en el encabezado de detalle.

**Independent Test**: Con dos transportistas del mismo nombre en países distintos, confirmar que se distinguen sin abrir el detalle de cada uno.

### Implementation for User Story 3

*(Sin tests nuevos — es presentación sobre datos ya cubiertos por T003/T004)*

- [X] T017 [P] [US3] Modificar `src/sales/transportistas/components/lista-transportistas.tsx`: mostrar bandera + nombre de `transportista.pais` junto al nombre comercial en cada fila; badge "País pendiente" cuando `pais` es `null`
- [X] T018 [P] [US3] Modificar `src/sales/transportistas/components/panel-transportista.tsx`: mostrar bandera + nombre del país en el encabezado; mismo badge "País pendiente" cuando corresponde — también resuelve los tipos pendientes de T009/T016 y cablea `pais`/`paisId` hacia `SeccionZonasTarifas`; `npx tsc --noEmit` sin errores nuevos en `src/sales/transportistas/**`

**Checkpoint**: User Story 3 funcional de forma independiente

---

## Phase 6: User Story 4 - Completar el país de transportistas creados antes de este cambio (Priority: P2)

**Goal**: Los transportistas existentes antes de este cambio quedan operando con normalidad — con país inferido automáticamente cuando es posible, o marcados "país pendiente" sin bloquear su uso histórico.

**Independent Test**: Correr el script de backfill sobre un transportista con tarifas de un único país (debe quedar asignado) y sobre uno con tarifas de países distintos o sin tarifas (debe quedar pendiente); correrlo dos veces no debe alterar un transportista ya asignado.

### Tests for User Story 4

- [X] T019 [P] [US4] Tests Vitest para la lógica de inferencia de `scripts/backfill-pais-transportista.ts` (extraer la consulta de países distintos por transportista a una función exportada y testeable, ej. `scripts/backfill-pais-transportista.test.ts`): un único país entre sus tarifas → se asigna; cero o más de un país distinto → queda `null`; ejecutar la inferencia dos veces sobre el mismo transportista ya asignado no lo modifica — 8/8 passing (requirió sumar `scripts/**/*.test.ts` a `vitest.config.ts`)

### Implementation for User Story 4

- [X] T020 [US4] Crear `scripts/backfill-pais-transportista.ts` (mismo patrón de conexión que `scripts/seed-geografia.ts`): para cada `Transportista` con `paisId IS NULL`, infiere el país a partir de los `paisId` distintos de las `ZonaEntregaUbicacion` de las zonas usadas en sus `TarifaTransportistaZona`; asigna si hay exactamente uno, deja `null` si no; loguea cada caso y un resumen final (depende de T001, T002, T019) — pendiente de ejecutarse contra una BD real (ver nota en T002)

**Checkpoint**: Todas las historias de usuario funcionan de forma independiente

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validación end-to-end y cierre

- [X] T021 [P] Escenario Playwright en `tests/e2e/sales/transportistas.spec.ts` (extender): crear un transportista con país obligatorio, agregar una zona con el país heredado y una provincia real del catálogo, confirmar que el país queda bloqueado tras crear una tarifa — 3 tests agregados (TR-08/09/10), `playwright test --list` los reconoce; **no ejecutados** (sin BD/app real disponible en este entorno) — nota agregada al inicio de esa sección sobre el drift preexistente de TR-01/03/05/07 respecto a la UI actual de 022
- [ ] T022 [P] Ejecutar los 5 escenarios de [quickstart.md](quickstart.md) contra una base real y confirmar cada uno — **bloqueado**: la BD no es alcanzable desde este entorno (ver nota T002); pendiente de correr manualmente
- [X] T023 Ejecutar `npm run test:unit` completo y confirmar que todo pasa en verde — 50 archivos, 348/348 tests passing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — empieza de inmediato
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA todas las historias
- **User Stories (Phase 3–6)**: todas dependen de Foundational; US1 y US2 son ambas P1 y pueden avanzar en paralelo entre sí una vez lista la fundación, pero dentro de cada una el orden interno importa (ver abajo); US3 solo necesita lectura de datos de US1 (T003); US4 es independiente de UI y puede correr en paralelo a US1–US3
- **Polish (Phase 7)**: depende de que US1–US4 estén completas

### User Story Dependencies

- **US1 (P1)**: depende solo de Foundational
- **US2 (P1)**: depende de Foundational; usa `paisId`/`pais` del transportista que ya expone T003, pero no depende de que la UI de US1 (T008/T009) esté terminada para poder implementarse — sí depende de que el campo exista en el modelo (T001)
- **US3 (P2)**: depende de Foundational (T003) — es puramente presentación
- **US4 (P2)**: depende de Setup (T001, T002) — no depende de ninguna historia de UI

### Parallel Opportunities

- T003 y T004 en paralelo (Foundational)
- T005 puede escribirse en paralelo a T006–T009 (tests antes de implementación, mismo criterio TDD del proyecto)
- T017 y T018 en paralelo (US3, archivos distintos)
- T019 en paralelo al resto de US1–US3 (US4 no comparte archivos con ellas)
- T021 y T022 en paralelo (Polish)

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (crítico — bloquea todo)
3. Completar Phase 3 (US1) y Phase 4 (US2) — juntas forman el MVP real: sin US2, US1 permite asignar país pero no resuelve el problema original de la provincia/estado en texto libre
4. **Validar** con los escenarios 1–3 de [quickstart.md](quickstart.md)

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 + US2 → MVP (país obligatorio + catálogo real de zonas) → validar → desplegar
3. US3 → mejora de UX en lista/encabezado → validar → desplegar
4. US4 → backfill de datos existentes (necesario antes de desplegar a producción con datos reales, aunque puede desarrollarse en paralelo) → validar con escenarios 4–5 → desplegar
5. Polish → e2e + validación completa de quickstart.md
