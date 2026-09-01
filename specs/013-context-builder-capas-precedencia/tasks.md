# Tasks: Construcción del contexto de IA por capas con precedencia

**Input**: Design documents from `/specs/013-context-builder-capas-precedencia/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/context-builder.md, quickstart.md, y las specs `009`, `011`, `012` ya implementadas

> **Notas de implementación (post-mortem)**:
> 1. **Resolución de una tensión real entre SC-001 y FR-002**: el bloque fijo anti prompt-injection (capa 1, "políticas de seguridad") ya vivía al FINAL del texto del prompt antes de esta spec, no al principio — moverlo al principio para que "posición = precedencia" de forma literal hubiera roto SC-001 (retrocompatibilidad byte a byte). Se resolvió manteniendo su posición textual actual (al final, sin cambios) y logrando la precedencia real (FR-002/FR-006) posicionando el contenido de menor precedencia (estrategia, perfil) siempre DESPUÉS de las reglas obligatorias/de negocio (capas 1-3), nunca mezclado ni antes — verificado explícitamente por test (`context-builder.test.ts`, caso "la regla obligatoria queda posicionada antes que el contenido de la estrategia").
> 2. **No se creó un archivo por cada una de las 11 capas** como sugería la granularidad original de `tasks.md` — se extendió `construirSystemPrompt` (`builder.ts`) con un tercer parámetro opcional (`CapasAdicionalesPrompt`) para las capas 4/5/7-9, en vez de reescribir su lógica interna ya probada en piezas separadas. Esto logra el mismo resultado (capas identificables, retrocompatibilidad, precedencia) con muchísimo menor riesgo de introducir una diferencia textual accidental en un refactor de 11 archivos. Sí se crearon como archivos propios las dos capas con lógica real nueva (`capas/estrategia-activa.ts`, `capas/perfil-cliente.ts`) y los 3 placeholders (`capas/placeholders.ts`, agrupados en un archivo por ser triviales).
> 3. Las capas 6 (estado de conversación), 10 (herramientas permitidas) y 11 (instrucción final) no son texto de `systemPrompt` en la arquitectura actual (son, respectivamente, el array de mensajes de chat, la lista pasada al parámetro `tools` de la API, y un mensaje de usuario aparte agregado por el suscriptor) — formalizarlas como "capa de texto en el prompt" hubiera sido incorrecto. Quedan documentadas en `context-builder.ts` como parte del pipeline conceptual de 11 capas, sin necesitar una función productora de texto.
> 4. **Bug real encontrado y corregido, arrastrado de `011`**: `activarEstrategia`/`desactivarEstrategia` en `src/ai/estrategia/actions.ts` estaban definidas como `export const x = (id) => otraFuncion(id, ...)` — Next.js exige que toda función exportada de un archivo `"use server"` sea una declaración `async function` directa, no un const que envuelve otra (aunque devuelva una Promise); si no, el build falla con "Server Actions must be async functions". El chequeo de build de `011` no lo detectó porque se verificó con `npm run build | tail -N`, que **enmascara el exit code real** del build (siempre reporta el de `tail`, nunca el de `npm run build`) — desde esta spec, todo build se verifica con exit code explícito (`npm run build > log; echo $?`), nunca solo por inspección del tail de la salida.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 **Adaptado** — en vez de capturar manualmente el prompt de 2-3 "agentes legacy" contra un entorno corriendo, se usó `construirSystemPrompt` invocado directamente como referencia de comparación dentro del propio test de retrocompatibilidad (más preciso y reproducible que una captura manual).

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T002 `InsumosContexto`, `ContextoCompuesto` definidos en `src/ai/contexto/context-builder.ts` (`CapaContexto` no se materializó como tipo genérico — ver nota 2, se usan funciones productoras concretas en su lugar)
- [X] T003-T007 **Adaptado** — ver nota 2: no se extrajo cada capa 1-3/6/10/11 a un archivo propio; su lógica ya probada se mantuvo en `builder.ts`/`constructor.ts`, extendida con un punto de inserción para las capas nuevas
- [X] T008 Los 3 placeholders creados en `src/ai/contexto/capas/placeholders.ts`
- [X] T009 `construirContextoCompuesto` implementado en `context-builder.ts`, orquestando capas 1-3 (vía `construirSystemPrompt` existente), 7-9 (placeholders) — capas 4/5 conectadas directamente en esta misma implementación (no en dos pasos separados como sugería el plan original, ver Phase 4)

**Checkpoint**: ✅ Verificado con `tsc --noEmit`, `npm run build`, 144 tests preexistentes sin regresión.

## Phase 3: User Story 1 - El prompt se compone en capas con precedencia verificable (Priority: P1) 🎯 MVP

- [X] T010 [P] [US1] Test de regresión en `context-builder.test.ts`: `construirContextoCompuesto` sin agente/contacto y con capas 4/5 resolviendo `null` produce un `systemPrompt` **idéntico** (`toBe`, no `toContain`) al de `construirSystemPrompt` invocado directamente — retrocompatibilidad exacta verificada por test, no solo por inspección
- [X] T011 [P] [US1] Cubierto por el mismo test: una capa ausente no deja rastro (ya lo garantizaba `builder.ts` desde `009`, confirmado que se preserva)
- [X] T012 [US1] `construirSystemPrompt` extendido con el tercer parámetro opcional `CapasAdicionalesPrompt` — firma pública compatible (parámetro nuevo opcional, llamadas existentes sin cambios)
- [X] T013 [US1] `construirContexto` (`constructor.ts`) reescrito para delegar en `construirContextoCompuesto`, firma pública sin cambios, `ContextoIA` extendido con 2 campos opcionales (`estrategiaSeleccionada`, `perfilClienteUsado`)
- [X] T014 [US1] Suite completa de `src/ai/` y `src/configuracion/ia/` corrida: 144/144 tests preexistentes en verde, cero regresiones

**Checkpoint**: ✅ Historia 1 completa — retrocompatibilidad verificada por test automatizado, no solo por revisión.

## Phase 4: User Story 2 - La estrategia y el perfil se incorporan de verdad (Priority: P1)

- [X] T015 [P] [US2] Test en `context-builder.test.ts`: con una estrategia seleccionada simulada, el texto aparece en el `systemPrompt` y la metadata se expone correctamente
- [X] T016 [P] [US2] Test en `context-builder.test.ts`: con un perfil simulado, el texto distingue "Datos objetivos" de contenido "interpretada, no confirmada"
- [X] T017 [P] [US2] Test en `context-builder.test.ts`: una regla obligatoria configurada (comportamiento prohibido) queda posicionada antes que el texto de una estrategia contradictoria — verificación explícita de índice de substring, no solo de presencia
- [X] T018 [US2] `capas/perfil-cliente.ts` implementado — llama a `PerfilClienteService.obtenerPerfil` (012), tolerante a fallo
- [X] T019 [US2] `capas/estrategia-activa.ts` implementado — llama a `listarAsignacionesDeAgente` + `seleccionarEstrategia` + `registrarSeleccionEstrategia` (011), tolerante a fallo
- [X] T020 [US2] Conectadas en `construirContextoCompuesto`: perfil se resuelve primero (provee señales), estrategia después (las consume) — orden de cómputo distinto del orden de precedencia textual, tal como diseñado en `research.md` Decisión 2
- [X] T021 [US2] Try/catch explícito en ambas capas (`estrategia-activa.ts`, `perfil-cliente.ts`) — un fallo en cualquiera nunca bloquea la generación del resto del prompt

**Checkpoint**: ✅ Historias 1 y 2 completas — el trabajo de `011` y `012` tiene efecto real en el flujo de generación por primera vez, con 6 tests dedicados que verifican tanto la retrocompatibilidad como la precedencia correcta.

## Phase 5: User Story 3 - Placeholders reservados para capas futuras (Priority: P3)

- [X] T022 [US3] Los 3 placeholders (`producirCapaDatosConocidosFaltantes`, `producirCapaInfoOperativa`, `producirCapaEjemplosPiloto`) están en `capas/placeholders.ts`, se invocan dentro de `construirContextoCompuesto` en su posición correcta (después de perfil, antes de retornar), y siempre devuelven `null` — verificado que ningún test detecta contenido de estas capas en el `systemPrompt`

**Checkpoint**: ✅ Las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [~] T023 [P] Verificado por tests unitarios (6 nuevos + 144 preexistentes) + build; validación manual completa del `quickstart.md` contra un entorno corriendo con RabbitMQ no ejecutada en esta sesión.
- [X] T024 Actualizado `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `013` como implementada.

## Resumen de estado

**Completo y verificado** (`tsc --noEmit`, `npm run build`, 150 tests unitarios en verde, 6 nuevos de esta spec): las specs `009`, `011` y `012` — que hasta ahora existían aisladas entre sí — quedan conectadas al flujo real de generación de respuesta por primera vez. Retrocompatibilidad exacta verificada por test (`toBe`, no aproximación). Precedencia de reglas obligatorias sobre estrategia/perfil verificada explícitamente por posición de substring en el texto generado.

**Decisión de diseño documentada (no un defecto)**: la implementación se simplificó respecto a la granularidad de archivos sugerida originalmente (11 archivos de capa) sin perder ninguna garantía funcional — ver nota 2. Cualquier spec futura que necesite tocar una capa específica encuentra su lógica en `builder.ts` (capas 1-3, vía `CapasAdicionalesPrompt`), `context-builder.ts` (orquestación), o `capas/` (capas 4, 5, 7-9).

**Pendiente, explícito**: validación manual del `quickstart.md` contra un entorno con RabbitMQ corriendo.
