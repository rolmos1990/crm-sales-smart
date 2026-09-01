# Tasks: Perfil estructurado y versionado del agente de IA

**Input**: Design documents from `/specs/009-perfil-agente-estructurado-versionado/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

**Tests**: no se generan tareas de test end-to-end nuevas obligatorias (feature de back-office, no un flujo crítico de cliente) salvo las unitarias explícitamente requeridas por el plan (builder de prompt, versionado, detección de contradicciones) — incluidas dentro de cada historia.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencia de tareas incompletas)
- **[Story]**: US1, US2, US3 — historia de usuario a la que pertenece (spec.md)

## Phase 1: Setup

- [ ] T001 Agregar enum `EstadoVersionAgenteIA` (`BORRADOR`, `PUBLICADA`) y los campos nuevos descritos en `data-model.md` a `AgenteIAConfig` en `prisma/schema.prisma` (todos opcionales, sin tocar campos existentes)
- [ ] T002 Agregar modelo `AgenteIAConfigVersion` a `prisma/schema.prisma` según `data-model.md` (campos, índices `@@index([agenteIAConfigId, estado])`, `@@index([instanciaId])`, `@@unique([agenteIAConfigId, numero])`)
- [ ] T003 Agregar columna `agenteIAConfigVersionId` (FK opcional, `onDelete: SetNull`) e índice `@@index([agenteIAConfigVersionId])` al modelo `UsoIA` en `prisma/schema.prisma`
- [ ] T004 Generar y aplicar la migración Prisma aditiva (`npm run db:migrate`) para T001–T003, verificando que no incluye ningún `DROP`/rename de columnas existentes

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T005 Extender `AgenteIAConfigSchema` en `src/configuracion/ia/agente-schema.ts` con los campos nuevos de `data-model.md` (todos opcionales), incluyendo los enums lógicos (`longitudRespuesta`, `proactividad`, `intensidadComercial`, `estiloRecomendacion`) y las listas (`frasesPreferidas`, `frasesProhibidas`, `comportamientosProhibidos`, `reglasPersonalizadas`, `condicionesTransferenciaHumano`, `idiomasPermitidos`)
- [ ] T006 Agregar validación cruzada en el schema/action (no en Zod puro): una misma frase no puede estar en `frasesPreferidas` y `frasesProhibidas` a la vez — error bloqueante
- [ ] T007 [P] Crear `src/configuracion/ia/version-queries.ts` con `obtenerVersionPublicadaVigente(agenteIAConfigId)`, `obtenerBorradorActivo(agenteIAConfigId)` y `listarVersionesAgenteIA(agenteIAConfigId)` (contrato en `contracts/server-actions.md`), scoped a `instanciaId` de la sesión
- [ ] T008 [P] Crear `src/configuracion/ia/version-actions.ts` (`'use server'`) con `guardarBorradorAgenteIA`, `publicarVersionAgenteIA`, `duplicarVersionAgenteIA`, `restaurarVersionAgenteIA` según contratos de `contracts/server-actions.md`, todas dentro de transacciones Prisma donde corresponda (publicar/restaurar) y validando permiso `"ia"` + pertenencia a `instanciaId`
- [ ] T009 Actualizar `registrarUsoIA` en `src/ai/auditoria/logger.ts` para aceptar y persistir `agenteIAConfigVersionId` opcional
- [ ] T010 Actualizar `generarRespuesta`/`generarConHerramientas` en `src/ai/gateway/gateway.ts` para resolver la versión publicada vigente del agente (vía T007) y pasar su `id` a `registrarUsoIA`

**Checkpoint**: con Phase 2 completa, el modelo de datos y las mutaciones base de versionado existen y son testeables por separado del builder de prompt.

## Phase 3: User Story 1 - Configurar identidad, comunicación y reglas del agente sin escribir un prompt (Priority: P1) 🎯 MVP

**Goal**: un responsable de negocio configura identidad/comunicación/reglas mediante campos, y el prompt generado los refleja.

**Independent Test**: completar los campos nuevos para un agente, publicar, y confirmar (vía `generarSugerenciaIA` o inspección del prompt en desarrollo) que el tono, las reglas y las restricciones configuradas aparecen en el prompt generado.

- [ ] T011 [P] [US1] Test unitario en `src/ai/prompt/builder.test.ts` (nuevo): agente sin ningún campo nuevo configurado genera un prompt idéntico al comportamiento actual (retrocompatibilidad, SC-002/Escenario 5 de `quickstart.md`)
- [ ] T012 [P] [US1] Test unitario en `src/ai/prompt/builder.test.ts`: agente con `comportamientosProhibidos`, `frasesProhibidas`, `condicionesTransferenciaHumano` configurados produce un prompt que incluye esas secciones en el orden fijado en `research.md` (Decisión 3)
- [ ] T013 [P] [US1] Test unitario en `src/ai/prompt/builder.test.ts`: las reglas de comportamiento natural fijas (FR-005) están siempre presentes en el prompt, sin depender de configuración
- [ ] T014 [US1] Extender `ConfigAgenteParaPrompt` y `construirSystemPrompt` en `src/ai/prompt/builder.ts` para componer, en el orden de `research.md` (Decisión 3): identidad extendida (nombre, rol, idioma) → comunicación extendida (longitud, proactividad, intensidad comercial, estilo de recomendación) → especialidad (existente) → bloque fijo de comportamiento natural (FR-005, no configurable) → restricciones fijas existentes → reglas de negocio (frases preferidas/prohibidas, comportamientos prohibidos, reglas personalizadas, condiciones de transferencia) → instrucciones adicionales (existente) → contexto dinámico (existente) → `sistemaPrompt` libre (existente) → bloque anti prompt-injection (existente); cada sección nueva se omite si está vacía
- [ ] T015 [US1] Implementar la detección de contradicciones de FR-007 en `src/ai/prompt/contradicciones.ts` (nuevo): heurística léxica según `research.md` Decisión 4, expuesta como función pura `detectarContradicciones(sistemaPromptLibre, reglasEstructuradas): string[]`
- [ ] T016 [P] [US1] Test unitario en `src/ai/prompt/contradicciones.test.ts` (nuevo): casos evidentes de contradicción (ej. comportamiento prohibido "no prometer precios sin confirmar" + texto libre "puedes confirmar precios directamente") producen al menos una advertencia; casos sin relación no producen ninguna
- [ ] T017 [US1] Conectar `detectarContradicciones` en `publicarVersionAgenteIA` (T008) para devolver `advertencias` no bloqueantes según el contrato
- [ ] T018 [US1] Crear `src/configuracion/ia/components/seccion-identidad.tsx`: campos de nombre del agente, rol, idioma principal, idiomas permitidos (además de objetivo/personalidad ya existentes), usando `<Form>`/`<FormField>`
- [ ] T019 [US1] Crear `src/configuracion/ia/components/seccion-comunicacion.tsx`: campos de longitud de respuesta, proactividad, intensidad comercial, estilo de recomendación, integrados junto al `configuracionTono` ya existente
- [ ] T020 [US1] Crear `src/configuracion/ia/components/seccion-reglas.tsx`: listas editables de frases preferidas/prohibidas, comportamientos prohibidos, reglas personalizadas, condiciones de transferencia a humano, y el campo avanzado `sistemaPrompt` existente con la advertencia de contradicciones (T015) visible inline

**Checkpoint**: User Story 1 funciona de punta a punta de forma independiente (configurar → publicar → prompt reflejado), sin depender de US2 o US3.

## Phase 4: User Story 2 - Publicar cambios sin perder la versión anterior y saber qué versión generó cada respuesta (Priority: P2)

**Goal**: borrador vs. publicado, historial, duplicar, restaurar, trazabilidad en `UsoIA`.

**Independent Test**: editar un agente publicado, guardar sin publicar (el agente sigue respondiendo con la versión anterior), publicar, y verificar en `UsoIA` que las respuestas quedan asociadas a la versión correcta; restaurar una versión anterior y confirmar que vuelve a quedar publicada.

- [ ] T021 [P] [US2] Test de integración en `src/configuracion/ia/version-actions.test.ts` (nuevo): `guardarBorradorAgenteIA` no modifica `AgenteIAConfig` (la vigente)
- [ ] T022 [P] [US2] Test de integración en `src/configuracion/ia/version-actions.test.ts`: `publicarVersionAgenteIA` crea una nueva fila `PUBLICADA` con `numero` incremental, copia el contenido a `AgenteIAConfig`, y conserva la versión publicada anterior en el historial
- [ ] T023 [P] [US2] Test de integración en `src/configuracion/ia/version-actions.test.ts`: `restaurarVersionAgenteIA` crea una nueva versión `PUBLICADA` con el contenido restaurado sin eliminar ninguna versión existente
- [ ] T024 [P] [US2] Test de integración en `src/configuracion/ia/version-actions.test.ts`: `duplicarVersionAgenteIA` crea un nuevo borrador editable sin afectar la versión publicada vigente
- [ ] T025 [US2] Implementar el cuerpo completo de `guardarBorradorAgenteIA`, `publicarVersionAgenteIA`, `duplicarVersionAgenteIA`, `restaurarVersionAgenteIA` en `src/configuracion/ia/version-actions.ts` (creado en T008) con las transacciones Prisma descritas en `data-model.md`
- [ ] T026 [US2] Manejar el conflicto de edición concurrente en `guardarBorradorAgenteIA`: comparar `actualizadoEn` recibido desde el cliente contra el actual antes de sobrescribir el borrador (Edge Case de `spec.md`)
- [ ] T027 [US2] Crear `src/configuracion/ia/components/seccion-versiones.tsx`: lista de versiones (vía `listarVersionesAgenteIA`), acciones Publicar/Duplicar/Restaurar, indicador de borrador pendiente vs. publicada vigente
- [ ] T028 [US2] Agregar en la pantalla de estadísticas/uso de IA existente (`src/ai/queries.ts` + su UI) la visualización de `agenteIAConfigVersionId` por registro de `UsoIA`, para cumplir SC-004 ("identificar en menos de 3 pasos")

**Checkpoint**: User Story 2 funciona de forma independiente sobre la base de US1 (usa los mismos campos, pero no depende de que US1 esté visualmente completa — solo de los datos de Phase 2).

## Phase 5: User Story 3 - Encontrar cada tipo de configuración en su propia sección (Priority: P3)

**Goal**: navegación por sub-secciones dentro de la tab "Inteligencia Artificial".

**Independent Test**: abrir la configuración del agente y confirmar que Identidad, Comunicación, Reglas y Versiones son sub-secciones navegables independientes.

- [ ] T029 [US3] Localizar el formulario actual del agente en `src/configuracion/components/` (form plano existente) y reestructurarlo para orquestar `seccion-identidad.tsx`, `seccion-comunicacion.tsx`, `seccion-reglas.tsx` (US1) y `seccion-versiones.tsx` (US2) como sub-navegación (tabs internos o accordion, reutilizando primitivos de `src/components/ui/`)
- [ ] T030 [US3] Verificar que la navegación entre secciones no pierde cambios sin guardar del borrador activo (advertencia de "cambios sin guardar" si corresponde, consistente con el patrón ya usado en otros formularios largos de Karia)

**Checkpoint**: las tres historias de usuario están completas e integradas en una sola pantalla coherente.

## Phase 6: Polish & Cross-Cutting

- [ ] T031 [P] Ejecutar el `quickstart.md` completo (Escenarios 1–6) manualmente contra un ambiente de desarrollo con datos de prueba
- [ ] T032 [P] Revisar que ningún log nuevo (T008, T025) imprima el contenido completo de `sistemaPrompt` u otros campos configurados (Constitution V — no loguear prompts sensibles completos)
- [ ] T033 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `009` como implementada, sin alterar el resto del documento

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante, sin excepción (modelo de datos y mutaciones base).
- **User Story 1 (Phase 3)**: depende solo de Phase 2. Es el MVP.
- **User Story 2 (Phase 4)**: depende solo de Phase 2 (no de que US1 esté visualmente terminada — reutiliza `version-actions.ts`/`version-queries.ts` de T007/T008). Puede desarrollarse en paralelo a US1 por otra persona.
- **User Story 3 (Phase 5)**: depende de que existan los componentes de US1 (T018–T020) y US2 (T027) para tener algo que orquestar — es la única historia con dependencia real sobre las otras dos.
- **Polish (Phase 6)**: depende de que Phase 3, 4 y 5 estén completas.

## Parallel Example: User Story 1

```bash
Task: "Test unitario builder.ts retrocompatibilidad (T011)"
Task: "Test unitario builder.ts secciones nuevas (T012)"
Task: "Test unitario builder.ts comportamiento natural fijo (T013)"
# Los tres tests son archivos/casos independientes dentro del mismo archivo de test — coordinar antes de mergear T011-T013 al mismo archivo.
```

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1 (Setup) y Phase 2 (Foundational).
2. Completar Phase 3 (User Story 1) — configuración estructurada reflejada en el prompt.
3. **Validar**: correr Escenario 1, 2 y 5 de `quickstart.md` de forma independiente.
4. Publicar/demostrar si está listo — ya es valor entregable sin versionado avanzado ni reorganización de UI.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. User Story 1 → validar independientemente → demo (MVP).
3. User Story 2 → validar independientemente (Escenario 3 y 4 de `quickstart.md`) → demo.
4. User Story 3 → validar independientemente (Escenario 6) → integración final.
5. Polish.
