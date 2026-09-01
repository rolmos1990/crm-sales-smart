# Tasks: Enrutamiento de modelos de IA por objetivo

**Input**: Design documents from `/specs/010-enrutamiento-modelos-ia-por-objetivo/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

> **Nota de implementación**: `resolverProveedorPorObjetivo` se implementó como función **síncrona pura** que recibe la lista de proveedores ya cargada (en vez de recibir `instanciaId` y volver a consultarla, como sugería el contrato original) — evita una segunda consulta a base de datos dentro de `seleccionarProveedor`, que ya tenía los proveedores en memoria. Mismo comportamiento observable, firma más simple y más testeable.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Agregar `IDENTIFICACION_PRODUCTO` al enum `TareaIA` en `prisma/schema.prisma` (aditivo)
- [X] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`) — migración `20260901061920_enrutamiento_ia_por_objetivo`, confirmada puramente aditiva (`ALTER TYPE ... ADD VALUE`)

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T003 Tipado `CasosDeUsoProveedor`/`ObjetivoEnrutamientoIA` agregado en `src/ai/proveedores/types.ts`
- [X] T004 Implementado `resolverProveedorPorObjetivo(proveedores, tarea, requiereRazonamientoSuperior?)` en `src/ai/orquestador/orquestador.ts` (ver nota de implementación — firma sin `instanciaId`)
- [X] T005 Integrado en `seleccionarProveedor`: si `resolverProveedorPorObjetivo` devuelve un proveedor, se antepone al orden por `tipoAgenteIA` (respeta circuit breaker vía el mismo loop); si devuelve `null`, orden idéntico al anterior a esta spec
- [X] T006 [P] `SolicitudIA` (`src/ai/gateway/types.ts`) y `SolicitudConHerramientas` (`src/ai/gateway/gateway.ts`) extendidas con `requiereRazonamientoSuperior?: boolean`; `SolicitudIASchema` (`src/ai/gateway/schema.ts`) actualizado con el nuevo valor de `tarea` y el campo nuevo
- [X] T007 `generarRespuesta`/`generarConHerramientas` pasan `tarea`/`requiereRazonamientoSuperior` a `seleccionarProveedor`

**Checkpoint**: ✅ Verificado con `tsc --noEmit`, 6 tests unitarios nuevos en verde, y build de producción.

## Phase 3: User Story 1 - Asignar qué proveedor de IA usar para cada objetivo (Priority: P1) 🎯 MVP

- [~] T008 [P] [US1] **Adaptado** — en vez de un test unitario aislado, la validación de FR-003 (rechazar proveedor inactivo/de otra instancia) se implementó y se verificó por tipo-chequeo + revisión manual del código (`guardarAsignacionesObjetivoIA` en `actions.ts`); no se agregó un archivo de test dedicado dado que requiere datos de Prisma reales (ver nota sobre convención de testing en `specs/009-.../tasks.md`).
- [X] T009 [US1] `ObjetivoEnrutamientoSchema`/`AsignacionObjetivoIASchema`/`AsignacionesObjetivoIASchema` agregados en `src/configuracion/ia/schema.ts`
- [X] T010 [US1] `guardarAsignacionesObjetivoIA` implementado en `src/configuracion/ia/actions.ts` — valida proveedor activo por instancia, recalcula `casosDeUso` por proveedor dentro de una transacción
- [X] T011 [US1] `obtenerAsignacionesObjetivoIA` implementado en `src/configuracion/ia/queries.ts`, incluyendo `proveedorInvalido`
- [X] T012 [US1] `src/configuracion/components/seccion-enrutamiento.tsx` creado — tabla de 7 objetivos con `<Select>` (con `items` pasado al `<Select>` raíz, `docs/selects.md`), integrada en `tab-ia.tsx`

**Checkpoint**: ✅ Historia 1 completa.

## Phase 4: User Story 2 - El sistema usa realmente el proveedor asignado a cada objetivo (Priority: P1)

- [X] T013 [P] [US2] Test unitario en `src/ai/orquestador/orquestador.test.ts`: asignación exacta resuelve el proveedor correcto
- [X] T014 [P] [US2] Test unitario: sin asignación devuelve `null` (retrocompatibilidad, SC-003) — cubierto explícitamente
- [X] T015 [P] [US2] Test unitario: `CHAT` + `requiereRazonamientoSuperior` resuelve `CHAT_RAZONAMIENTO_SUPERIOR`, distinto de `CHAT` estándar — cubierto, más 2 tests adicionales (desempate por prioridad, `casosDeUso` malformado)
- [X] T016 [US2] Circuit breaker/resguardo verificado por inspección: `resolverProveedorPorObjetivo` solo reordena, el loop de `estaCircuitBreakerAbierto`/`registrarFalla` en `seleccionarProveedor` no cambió
- [X] T017 [US2] Indicador de "asignación inválida" implementado en `seccion-enrutamiento.tsx` (vía `proveedorInvalido` de la query)

**Checkpoint**: ✅ Historias 1 y 2 completas — 6/6 tests unitarios en verde.

## Phase 5: User Story 3 - Ver qué proveedor atendió cada llamada y por qué (Priority: P3)

- [X] T018 [US3] Confirmado por inspección: `UsoIA` ya registra `tarea` y `proveedorIAId` por llamada (sin cambios necesarios — dato ya completo desde antes de esta spec)
- [ ] T019 [US3] **No implementado** — no existe hoy ninguna pantalla de detalle de uso de IA (solo agregados en tarjetas KPI); el propio task pide "sin crear una pantalla nueva", pero no hay ninguna existente que extender. Construir una es trabajo nuevo fuera del alcance mínimo de esta spec — queda como mejora de seguimiento explícita, no oculta.

**Checkpoint**: dato ya expuesto (T018); superficie visual de detalle pendiente (T019).

## Phase 6: Polish & Cross-Cutting

- [~] T020 [P] Verificado por tests unitarios + build; validación manual completa contra un entorno con 2+ proveedores activos no ejecutada en esta sesión (requiere sesión interactiva).
- [X] T021 Actualizado `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `010` como implementada.

## Resumen de estado

**Completo y verificado** (`tsc --noEmit`, `npm run build`, 118 tests unitarios en verde, 6 nuevos de esta spec): enum `TareaIA` extendido, enrutamiento por objetivo con precedencia sobre `tipoAgenteIA`, señal `requiereRazonamientoSuperior` para chat complejo, UI de asignación con indicador de proveedor inválido, retrocompatibilidad total verificada por test.

**Pendiente, explícito**: panel de detalle de uso de IA por objetivo/proveedor (T019 — no existía ninguna pantalla de detalle antes de esta spec), validación manual del `quickstart.md` contra un entorno corriendo (T020).
