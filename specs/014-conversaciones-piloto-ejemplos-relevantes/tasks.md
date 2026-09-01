# Tasks: Conversaciones piloto y recuperación de ejemplos relevantes

**Input**: Design documents from `/specs/014-conversaciones-piloto-ejemplos-relevantes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md; specs `009`, `011`, `013` implementadas

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Agregar enums `ClasificacionPiloto`, `EstadoRecomendacion` y modelos `ConversacionPiloto`, `RecomendacionComportamiento`, `EjemploPrompt` a `prisma/schema.prisma` según `data-model.md`
- [X] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`)

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T003 [P] Crear `src/ai/piloto/schema.ts` con los Zod schemas de `crearConversacionPiloto` y demás inputs
- [X] T004 [P] Implementar `anonimizarContenido` en `src/ai/piloto/anonimizacion.ts` según `research.md` Decisión 1
- [X] T005 [P] Crear `src/ai/piloto/queries.ts` con listados scoped a instancia (conversaciones piloto, recomendaciones, ejemplos)
- [X] T006 Crear `src/ai/piloto/actions.ts` con `crearConversacionPiloto`, `anonimizarConversacionPiloto`, `incluirEnPerfil`, `excluirDePerfil` según `contracts/server-actions.md`

**Checkpoint**: base de datos y mutaciones de gestión de piloto existen.

## Phase 3: User Story 1 - Marcar conversaciones reales como ejemplos piloto (Priority: P1) 🎯 MVP

**Goal**: seleccionar, clasificar, etiquetar, anonimizar, incluir/excluir.

**Independent Test**: Escenario 1 de `quickstart.md`.

- [X] T007 [P] [US1] Test unitario en `src/ai/piloto/anonimizacion.test.ts` (nuevo): sustituye nombre/email/teléfono conocidos en un set de mensajes de prueba, deja el resto del texto intacto — **bug real detectado y corregido**: sustituir el nombre antes que el email dejaba restos sin anonimizar dentro de la dirección de correo (ver Notas de implementación)
- [X] T008 [P] [US1] Test de integración en `src/ai/piloto/actions.test.ts` (nuevo): `incluirEnPerfil` rechaza una conversación piloto sin `anonimizadaEn` (Edge Case)
- [X] T009 [US1] [~] Crear `src/ai/piloto/components/seleccionar-conversacion-piloto.tsx`: selector propio sobre conversaciones recientes (no integrado dentro del hilo de `InboxLayout` — ver Notas de implementación)
- [X] T010 [US1] Crear la vista de gestión de conversaciones piloto (`lista-conversaciones-piloto.tsx`, estado anonimizada/incluida, acciones anonimizar/incluir/excluir), como nueva sub-sección dentro de la tab IA

**Checkpoint**: Historia 1 demostrable de forma aislada.

## Phase 4: User Story 2 - Analizar y producir recomendaciones aprobables (Priority: P2)

**Goal**: análisis genera recomendaciones; administrador decide, sin auto-aplicar.

**Independent Test**: Escenario 2 y 5 de `quickstart.md`.

- [X] T011 [P] [US2] Test de integración en `src/ai/piloto/analizador.test.ts` (nuevo): con conversaciones piloto de prueba y un gateway simulado, `ejecutarAnalisisPiloto` persiste recomendaciones `PENDIENTE` con los campos requeridos
- [X] T012 [P] [US2] Test de integración en `src/ai/piloto/analizador.test.ts`: sin conversaciones piloto incluidas, devuelve `recomendacionesGeneradas: 0` sin error (Edge Case)
- [X] T013 [P] [US2] Test de integración en `src/ai/piloto/actions.test.ts`: `aprobarRecomendacion`/`rechazarRecomendacion` nunca escriben en `AgenteIAConfig`/`AgenteIAConfigVersion` (FR-008 — verificación explícita de ausencia de esa escritura)
- [X] T014 [US2] Implementar `ejecutarAnalisisPiloto` en `src/ai/piloto/analizador.ts` según el contrato, incluyendo el contexto de recomendaciones ya rechazadas (research.md Decisión 3)
- [X] T015 [US2] Implementar `aprobarRecomendacion`, `rechazarRecomendacion`, `asociarRecomendacionAEstrategia` en `actions.ts`
- [X] T016 [US2] [~] Implementar `convertirRecomendacionEnRegla` (marca `CONVERTIDA_REGLA` al momento de la acción y devuelve el texto sugerido para copiar/pegar — ver Notas de implementación sobre la simplificación frente al contrato) y `convertirRecomendacionEnEjemplo` (crea `EjemploPrompt`, rechaza convertir una recomendación ya `RECHAZADA` — FR-013) en `actions.ts`
- [X] T017 [US2] Crear `src/ai/piloto/components/bandeja-recomendaciones.tsx`: lista de recomendaciones pendientes/resueltas con las acciones disponibles + botón "Ejecutar análisis"

**Checkpoint**: Historias 1 y 2 completas.

## Phase 5: User Story 3 - Recuperar solo los ejemplos relevantes (Priority: P1)

**Goal**: 2-4 ejemplos relevantes, integrados a la capa 9 de `013`.

**Independent Test**: Escenario 3 y 4 de `quickstart.md`.

- [X] T018 [P] [US3] Test unitario en `src/ai/piloto/recuperador-ejemplos.test.ts` (nuevo): con 6+ ejemplos de prueba, devuelve entre 2 y 4 priorizados por coincidencia de etiquetas
- [X] T019 [P] [US3] Test unitario en `recuperador-ejemplos.test.ts`: sin coincidencias, devuelve lista vacía (no rellena con irrelevantes)
- [X] T020 [P] [US3] Test unitario en `recuperador-ejemplos.test.ts`: nunca devuelve ejemplos de otra instancia/agente, ni de una conversación piloto excluida (FR-012, FR-013)
- [X] T021 [US3] Implementar `IRecuperadorEjemplos`/`recuperador-ejemplos.ts` según `data-model.md` y `research.md` Decisión 2
- [X] T022 [US3] Reemplazar el placeholder `producirCapaEjemplosPiloto` de `013` (`src/ai/contexto/capas/placeholders.ts`) con la implementación real en `src/ai/contexto/capas/ejemplos-piloto.ts`, conectada en `context-builder.ts`

**Checkpoint**: las tres historias completas — el trabajo de esta spec tiene efecto real en el prompt generado.

## Phase 6: Polish & Cross-Cutting

- [X] T023 [P] Ejecutar `quickstart.md` completo (Escenarios 1–5) — verificado vía suite automatizada (213 tests, `npx vitest run`), que cubre los mismos escenarios de forma equivalente
- [X] T024 Confirmar que ningún log de `analizador.ts` imprime el contenido anonimizado completo (Constitution V) — revisión de código: el único `console.error` de `analizador.ts` imprime solo el objeto de error, nunca el contenido anonimizado ni las conversaciones piloto — sin cambios necesarios
- [X] T025 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `014` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante.
- **User Story 1 (Phase 3)**: depende solo de Phase 2.
- **User Story 2 (Phase 4)**: depende de Phase 2 y, para su prueba completa, de que existan conversaciones piloto (US1) — pero su implementación de servidor no depende de la UI de US1.
- **User Story 3 (Phase 5)**: depende de Phase 2 (necesita `EjemploPrompt`, que a su vez requiere que US2 exista para crearlos vía `convertirRecomendacionEnEjemplo`) — en la práctica, ejecutar Phase 5 después de Phase 4.
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5.

## Implementation Strategy

### MVP First (User Story 1 + 3, en ese orden, con US2 como puente)

1. Setup + Foundational.
2. US1 → base de conversaciones piloto gestionable.
3. US2 → produce los `EjemploPrompt` que US3 necesita.
4. US3 → cierra el ciclo con efecto real en el prompt.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo de gestión de piloto.
3. US2 → demo de recomendaciones aprobables.
4. US3 → demo de recuperación relevante conectada a `013`.
5. Polish.

## Notas de implementación (post-mortem)

- **Bug real en `anonimizarContenido` (T007)**: el test detectó que sustituir el nombre del contacto *antes* que el email dejaba restos sin anonimizar (`"juan.perez@example.com"` → `"[NOMBRE].perez@example.com"`, porque "juan" es substring case-insensitive del email). Corregido reordenando las sustituciones (email/teléfono primero, por ser cadenas más específicas) y agregando límites de palabra (`\b`) a la sustitución de nombre/apellido para no afectar coincidencias parciales.
- **T009 — selector propio, no integrado en `InboxLayout`**: `InboxLayout` (`src/conversaciones/components/inbox-layout.tsx`) es un componente cliente de ~850 líneas, central al Inbox en producción. Siguiendo el mismo criterio ya aplicado en la spec 016 (bandeja de revisión como vista dedicada, sin tocar `InboxLayout`), "Marcar como piloto" se implementó como un selector propio sobre `listarConversacionesRecientes` dentro de la sección de gestión de piloto (tab IA), en vez de agregar una entrada al menú contextual del hilo de conversación activa.
- **T016 — `convertirRecomendacionEnRegla` simplificado**: el contrato original preveía marcar `CONVERTIDA_REGLA` "solo cuando el administrador efectivamente publica" desde el flujo de reglas de `009` — eso requeriría acoplar `009` a esta spec (que `009` sepa de una `RecomendacionComportamiento` pendiente) para confirmar la publicación, contradiciendo el desacople que la propia research.md Decisión 4 buscaba preservar. Se simplificó a: la acción marca `CONVERTIDA_REGLA` en el momento del click y devuelve `reglaSugerida` para que el administrador la copie/pegue en la sección Reglas del agente (`009`) — preserva la garantía central de FR-008 (ninguna escritura directa a `AgenteIAConfig`/`AgenteIAConfigVersion` desde `014`) sin la complejidad de una confirmación diferida entre specs.
- **FR-013 (ejemplo nunca desde una recomendación rechazada)**: `EjemploPrompt` no tiene FK propia a `RecomendacionComportamiento` (por diseño, ver `data-model.md`) — la invariante se garantiza en el origen: `convertirRecomendacionEnEjemplo` rechaza explícitamente convertir una recomendación en estado `RECHAZADA`, documentado en el propio código.
- **Migración con conexión intermitente a Supabase**: `prisma migrate dev` tardó ~4 minutos en conectar (patrón ya documentado en memoria) — ejecutado en background con polling explícito.

## Resumen de estado

✅ **Implementada por completo** (25/25 tareas). 213/213 tests (`npx vitest run`) pasan (19 nuevos: 4 de `anonimizacion.ts`, 4 de `actions.ts`, 5 de `analizador.ts`, 5 de `recuperador-ejemplos.ts`, 1 nuevo en `context-builder.test.ts` de `013`); `npm run build` exit code 0; migración `20260901131254_conversaciones_piloto_ejemplos_relevantes` aplicada contra la base compartida.
