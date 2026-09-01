# Tasks: Perfil estructurado y versionado del agente de IA

**Input**: Design documents from `/specs/009-perfil-agente-estructurado-versionado/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

**Tests**: no se generan tareas de test end-to-end nuevas obligatorias (feature de back-office, no un flujo crítico de cliente) salvo las unitarias explícitamente requeridas por el plan (builder de prompt, versionado, detección de contradicciones) — incluidas dentro de cada historia.

> **Nota de implementación (post-mortem)**: durante la ejecución se confirmó que el proyecto solo tiene dos niveles de test reales — Vitest para funciones puras (sin DB) y Playwright para todo lo que toca base de datos/UI real — no existe un tercer nivel de "test de integración con Prisma" dentro de Vitest. Las tareas T021-T024 (test de integración de `version-actions`) se adaptaron a esa convención: la lógica se validó por tipo-chequeo estricto + build de producción + revisión manual de las transacciones, y se dejó pendiente un test Playwright dedicado al flujo de versionado (ver T022 más abajo) como seguimiento explícito, no silencioso. También se consolidaron `version-queries.ts`/`version-actions.ts` (T007/T008) dentro de los archivos ya existentes `agente-queries.ts`/`agente-actions.ts` en vez de crear archivos nuevos — mismo contrato funcional, menos dispersión en un módulo que ya existía. Los componentes de UI (T018-T020, T027, T029) se integraron dentro del `Sheet` de edición de agente ya existente (`sheet-editar-agente.tsx`, con una nueva pestaña "Versiones" vía `seccion-versiones-agente.tsx`) en vez de en `src/configuracion/ia/components/`, porque ese Sheet es el lugar real donde hoy se edita un agente — crear una ubicación paralela hubiera duplicado la pantalla existente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencia de tareas incompletas)
- **[Story]**: US1, US2, US3 — historia de usuario a la que pertenece (spec.md)

## Phase 1: Setup

- [X] T001 Agregar enum `EstadoVersionAgenteIA` (`BORRADOR`, `PUBLICADA`) y los campos nuevos descritos en `data-model.md` a `AgenteIAConfig` en `prisma/schema.prisma` (todos opcionales, sin tocar campos existentes)
- [X] T002 Agregar modelo `AgenteIAConfigVersion` a `prisma/schema.prisma` según `data-model.md` (campos, índices `@@index([agenteIAConfigId, estado])`, `@@index([instanciaId])`, `@@unique([agenteIAConfigId, numero])`)
- [X] T003 Agregar columna `agenteIAConfigVersionId` (FK opcional, `onDelete: SetNull`) e índice `@@index([agenteIAConfigVersionId])` al modelo `UsoIA` en `prisma/schema.prisma`
- [X] T004 Generar y aplicar la migración Prisma aditiva (`npm run db:migrate`) para T001–T003 — migración `20260901055957_agente_ia_config_estructurado_versionado`, verificada sin ningún `DROP`/rename de columnas existentes

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T005 Extender `AgenteIAConfigSchema` en `src/configuracion/ia/agente-schema.ts` con los campos nuevos de `data-model.md` (todos opcionales), incluyendo los enums lógicos (`longitudRespuesta`, `proactividad`, `intensidadComercial`, `estiloRecomendacion`) y las listas (`frasesPreferidas`, `frasesProhibidas`, `comportamientosProhibidos`, `reglasPersonalizadas`, `condicionesTransferenciaHumano`, `idiomasPermitidos`)
- [X] T006 Agregar validación cruzada en el schema/action (no en Zod puro): una misma frase no puede estar en `frasesPreferidas` y `frasesProhibidas` a la vez — error bloqueante (`validarSinConflictoDeFrases` en `agente-actions.ts`)
- [X] T007 [P] Consolidado en `src/configuracion/ia/agente-queries.ts`: `obtenerBorradorActivo(agenteIAConfigId)`, `listarVersionesAgenteIA(agenteIAConfigId, instanciaId)`, `obtenerVersionAgenteIA(versionId, instanciaId)`
- [X] T008 [P] Consolidado en `src/configuracion/ia/agente-actions.ts` (`'use server'`): `guardarBorradorAgenteIA`, `publicarVersionAgenteIA`, `duplicarVersionAgenteIA`, `restaurarVersionAgenteIA`, `listarVersionesAgenteIA` — publicar/restaurar dentro de `prisma.$transaction`, todas validando permiso `"ia"` + pertenencia a `instanciaId`
- [X] T009 Actualizar `registrarUsoIA` en `src/ai/auditoria/logger.ts` para aceptar y persistir `agenteIAConfigVersionId` opcional
- [X] T010 Actualizar `generarRespuesta`/`generarConHerramientas` en `src/ai/gateway/gateway.ts` para resolver la versión publicada vigente del agente (nueva `obtenerVersionPublicadaVigenteId` en `src/ai/queries.ts`) y pasar su `id` a `registrarUsoIA`. Adicional (no listado originalmente, necesario para FR-008/FR-012): `src/ai/contexto/constructor.ts` extendido para leer y pasar los campos nuevos a `construirSystemPrompt`.

**Checkpoint**: con Phase 2 completa, el modelo de datos y las mutaciones base de versionado existen y son testeables por separado del builder de prompt. ✅ Verificado con `tsc --noEmit` y `npm run build` sin errores nuevos.

## Phase 3: User Story 1 - Configurar identidad, comunicación y reglas del agente sin escribir un prompt (Priority: P1) 🎯 MVP

**Goal**: un responsable de negocio configura identidad/comunicación/reglas mediante campos, y el prompt generado los refleja.

**Independent Test**: completar los campos nuevos para un agente, publicar, y confirmar (vía `generarSugerenciaIA` o inspección del prompt en desarrollo) que el tono, las reglas y las restricciones configuradas aparecen en el prompt generado.

- [X] T011 [P] [US1] Test unitario en `src/ai/prompt/builder.test.ts`: agente sin ningún campo nuevo configurado genera un prompt idéntico al comportamiento actual (retrocompatibilidad, SC-002)
- [X] T012 [P] [US1] Test unitario en `src/ai/prompt/builder.test.ts`: agente con `comportamientosProhibidos`, `frasesProhibidas`, `condicionesTransferenciaHumano`, identidad y comunicación extendida configurados produce un prompt que incluye esas secciones en el orden fijado en `research.md` (Decisión 3)
- [X] T013 [P] [US1] Test unitario en `src/ai/prompt/builder.test.ts`: las reglas de comportamiento natural fijas (FR-005) están siempre presentes en el prompt, sin depender de configuración
- [X] T014 [US1] Extender `ConfigAgenteParaPrompt` y `construirSystemPrompt` en `src/ai/prompt/builder.ts` con el orden completo de `research.md` Decisión 3
- [X] T015 [US1] Implementar `detectarContradicciones` en `src/ai/prompt/contradicciones.ts` (heurística léxica, research.md Decisión 4)
- [X] T016 [P] [US1] Test unitario en `src/ai/prompt/contradicciones.test.ts`: casos evidentes de contradicción producen advertencia; casos sin relación o solo mencionados sin patrón de permiso no producen ninguna (5 casos)
- [X] T017 [US1] Conectar `detectarContradicciones` en `publicarVersionAgenteIA` — devuelve `advertencias` no bloqueantes, publica igual con `{ forzar: true }`
- [X] T018 [US1] Campos de identidad (nombre del agente, rol, idioma principal) agregados dentro de la tab "Configuración IA" de `sheet-editar-agente.tsx` (en vez de un componente separado `seccion-identidad.tsx` — ver nota de implementación)
- [X] T019 [US1] Campos de comunicación extendida (longitud, proactividad, intensidad comercial, estilo de recomendación) agregados junto al `configuracionTono` ya existente, mismo archivo
- [X] T020 [US1] Listas editables de reglas (frases preferidas/prohibidas, comportamientos prohibidos, reglas personalizadas, condiciones de transferencia) vía el nuevo componente reutilizable `EditorListaTexto`, mismo archivo; el campo `sistemaPrompt` existente ya muestra sus propias advertencias de contradicción en la pestaña Versiones al intentar publicar

**Checkpoint**: ✅ User Story 1 completa. Verificado por tests unitarios (12/12) y build de producción.

## Phase 4: User Story 2 - Publicar cambios sin perder la versión anterior y saber qué versión generó cada respuesta (Priority: P2)

**Goal**: borrador vs. publicado, historial, duplicar, restaurar, trazabilidad en `UsoIA`.

**Independent Test**: editar un agente publicado, guardar sin publicar (el agente sigue respondiendo con la versión anterior), publicar, y verificar en `UsoIA` que las respuestas quedan asociadas a la versión correcta; restaurar una versión anterior y confirmar que vuelve a quedar publicada.

- [~] T021-T024 [US2] **Adaptado** — el proyecto no tiene un runner de "test de integración con Prisma" en Vitest (ver nota de implementación al inicio del archivo). La lógica de `guardarBorradorAgenteIA`/`publicarVersionAgenteIA`/`duplicarVersionAgenteIA`/`restaurarVersionAgenteIA` se implementó siguiendo exactamente `data-model.md` (transacciones para publicar/restaurar, upsert de borrador único por agente) y se verificó por tipo-chequeo + build, pero **queda pendiente un test Playwright end-to-end del flujo completo** (borrador → publicar → historial → restaurar → duplicar) antes de considerar esta historia con cobertura automatizada completa — seguimiento explícito, no descartado.
- [X] T025 [US2] Implementado el cuerpo completo de las 4 acciones en `src/configuracion/ia/agente-actions.ts`, con las transacciones Prisma descritas en `data-model.md`
- [X] T026 [US2] Conflicto de edición concurrente manejado en `guardarBorradorAgenteIA` (parámetro `actualizadoEnEsperado`, comparado contra `borrador.actualizadoEn`)
- [X] T027 [US2] Creado `src/configuracion/components/seccion-versiones-agente.tsx` (en vez de `src/configuracion/ia/components/seccion-versiones.tsx` — ver nota de implementación): lista de versiones, Publicar (con flujo de advertencias→forzar), Duplicar, Restaurar, indicador de "vigente"
- [ ] T028 [US2] **Pendiente** — no se agregó todavía la visualización de `agenteIAConfigVersionId` en la pantalla de estadísticas de uso de IA existente; el dato ya se persiste (T009/T010) y es consultable, pero falta la superficie visual. Seguimiento explícito.

**Checkpoint**: Historia 2 funcionalmente completa y verificada por build; cobertura de test automatizada parcial (ver T021-T024, T028 pendientes).

## Phase 5: User Story 3 - Encontrar cada tipo de configuración en su propia sección (Priority: P3)

**Goal**: navegación por sub-secciones dentro de la tab "Inteligencia Artificial".

**Independent Test**: abrir la configuración del agente y confirmar que Identidad, Comunicación, Reglas y Versiones son sub-secciones navegables independientes.

- [X] T029 [US3] `sheet-editar-agente.tsx` reestructurado: nueva pestaña "Versiones" agregada junto a "General"/"Configuración IA"; Identidad/Comunicación/Reglas viven como secciones tituladas dentro de "Configuración IA" (no como tabs propios — ver nota de implementación, es una adaptación menor de alcance dentro de la misma historia)
- [ ] T030 [US3] **No implementado** — advertencia de "cambios sin guardar" al navegar entre tabs con el borrador sin guardar. Riesgo bajo (no hay pérdida de datos silenciosa más allá de la UX), queda como mejora de seguimiento.

**Checkpoint**: navegación funcional; falta el detalle de advertencia de cambios sin guardar (T030).

## Phase 6: Polish & Cross-Cutting

- [~] T031 [P] Quickstart ejecutado parcialmente: Escenarios 1, 3 y 5 verificados por tests unitarios + build; Escenarios 2, 4 y 6 (contradicciones en UI, trazabilidad visible en `UsoIA`, navegación) requieren una sesión manual contra un entorno corriendo — no ejecutados en esta sesión de implementación.
- [X] T032 [P] Revisado: ningún log nuevo (`agente-actions.ts`, `gateway.ts`, `logger.ts`) imprime `sistemaPrompt` ni ningún campo configurado completo — cero `console.*` agregado en los archivos tocados.
- [X] T033 Actualizado `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `009` como implementada.

## Dependencies & Execution Order

(sin cambios respecto al plan original)

## Resumen de estado

**Completo y verificado** (tipo-chequeo estricto + `npm run build` + 112 tests unitarios en verde, incluidos los 12 nuevos de esta spec): modelo de datos, Zod, prompt builder con las 11 capas nuevas, detección de contradicciones, Server Actions de versionado (guardar borrador/publicar/duplicar/restaurar/listar), trazabilidad en `UsoIA`, UI de identidad/comunicación/reglas/versiones dentro del Sheet de edición de agente existente.

**Pendiente, explícitamente señalado (no oculto)**: test Playwright del flujo de versionado end-to-end (T021-T024/T030), visualización de versión en el panel de estadísticas de uso (T028), advertencia de cambios sin guardar al navegar entre pestañas (T030), validación manual completa del `quickstart.md` contra un entorno corriendo (T031).
