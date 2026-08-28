---

description: "Task list for fixing Facebook Messenger reactions (both directions)"
---

# Tasks: Corregir reacciones en Facebook Messenger

**Input**: Design documents from `/specs/008-fix-facebook-messenger-reacciones/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Se agregan tests unitarios acotados a `enviarReaccion` (mismo patrón que ya tiene `enviarMensaje` en `facebook-messenger.test.ts`) — es lógica nueva y aislada, no un cambio de bajo riesgo. No se agregan tests para `procesarReaccionIG` generalizada (no está extraída como función pura, mismo criterio ya aplicado en specs anteriores para ese archivo).

**Organization**: Dos historias de usuario, ambas P1 e independientes entre sí (una es de envío, la otra de recepción — no comparten código).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

No aplica — no hay inicialización de proyecto ni dependencias nuevas (research.md).

---

## Phase 2: Foundational

No aplica — US1 (envío) y US2 (recepción) son completamente independientes en código; no hay infraestructura compartida bloqueante entre ellas.

---

## Phase 3: User Story 1 - Un agente reacciona desde Karia y el cliente la ve en Facebook (Priority: P1) 🎯 MVP

**Goal**: Que reaccionar a un mensaje de Messenger desde Karia llegue realmente a la conversación de Facebook del cliente.

**Independent Test**: Reaccionar a un mensaje desde Karia y confirmar en la conversación real de Facebook (quickstart.md, Escenario 1).

### Tests for User Story 1

- [X] T001 [P] [US1] Agregados tests en `facebook-messenger.test.ts` para `enviarReaccion`: reaccionar, quitar reacción, Meta rechaza, y sin credenciales — mismo patrón que los tests ya existentes de `enviarMensaje`. 12/12 tests del archivo en verde

### Implementation for User Story 1

- [X] T002 [US1] En `src/conversaciones/providers/facebook-messenger.ts`: implementado `enviarReaccion(payload: ReaccionCanalPayload)` calcado de `InstagramProvider.enviarReaccion`, `capacidades.reacciones` ahora `true` (research.md R1). Typecheck limpio

**Checkpoint**: US1 completa y testeable de forma independiente — reaccionar desde Karia debe llegar a Facebook.

---

## Phase 4: User Story 2 - El cliente reacciona desde Facebook y el agente la ve en Karia (Priority: P1)

**Goal**: Que las reacciones que un cliente pone desde Facebook lleguen a la conversación en Karia.

**Independent Test**: Reaccionar desde una cuenta de Facebook de prueba y confirmar que aparece en Karia (quickstart.md, Escenario 2).

### Implementation for User Story 2

- [X] T003 [US2] En `src/integraciones/facebook-messenger/conectar.ts`, sumado `message_reactions` a `subscribed_fields` en `suscribirWebhookFacebookMessenger` — ahora `messages,message_reactions` (research.md R2)
- [X] T004 [US2] En `src/app/api/webhooks/instagram/route.ts`: generalizada `procesarReaccionIG` para recibir el canal resuelto como parámetro y usarlo al persistir `MensajeReaccion.canal`; quitado el `if (canalResuelto === "instagram")` que descartaba las reacciones de Messenger — ahora se llama para ambos canales (research.md R3). Typecheck limpio
- [X] T005 [US2] Creado `scripts/resuscribir-reacciones-messenger.ts` (mismo patrón que `scripts/reparar-oportunidades-pipeline.ts`): recorre `CuentaCanal` de `canal: "facebook_messenger"` y `activa: true`, descifra el `accessToken` y vuelve a llamar `suscribirWebhookFacebookMessenger` por cada una, logueando éxito/fallo. Agregado `"script:resuscribir-reacciones-messenger"` a `package.json`. Typecheck limpio (research.md R4, FR-005)

**Checkpoint**: US2 completa — reaccionar desde Facebook debe reflejarse en Karia, incluso en Páginas conectadas antes de este cambio (después de correr el script una vez).

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T006 [P] Validado a nivel de código: la cadena completa queda correcta (gate de `toggleReaccion` ahora pasa para Messenger; `procesarReaccionIG` generalizada persiste el canal correcto; Instagram queda con el mismo comportamiento, solo recibe explícitamente `"instagram"` como tercer parámetro). Typecheck limpio + 100/100 tests del repo en verde. **Pendiente de quien implementa**: probar en vivo con una Página y una cuenta de Facebook reales (quickstart.md) — no puedo simular el lado de Meta yo mismo
- [X] T007 [P] Actualizado `docs/META-FACEBOOK-MESSENGER-INTEGRACION.md`: "Sin reacciones" pasó a "Reacciones — implementado", con la aclaración del paso manual de `npm run script:resuscribir-reacciones-messenger` para Páginas ya conectadas

---

## Dependencies & Execution Order

### Phase Dependencies

- US1 y US2 no dependen entre sí — pueden implementarse y probarse en cualquier orden o en paralelo.
- Dentro de US1: T001 y T002 pueden ir en paralelo (test primero si se sigue TDD, o junto con la implementación).
- Dentro de US2: T003 → T005 (el script depende de que la función ya pida el campo correcto); T004 es independiente de T003/T005 (archivo distinto).
- Polish (T006, T007) depende de que US1 y US2 estén completas.

### Parallel Opportunities

- T001 (US1) en paralelo con T003/T004 (US2) — archivos e historias distintas.
- T004 en paralelo con T003 (archivos distintos), pero T005 espera a T003.
- T006 y T007 en paralelo entre sí.

---

## Implementation Strategy

### MVP First (User Story 1)

US1 por sí sola ya arregla la mitad del problema reportado (el agente ve que la reacción "no llegó de verdad" sin sentir que Karia miente). No depende de US2.

### Incremental Delivery

1. US1 (envío) → validar con Escenario 1 → demo/deploy si se necesita algo rápido
2. US2 (recepción) → validar con Escenarios 2 y 3 (retroactivo)
3. Polish → Escenario 4 (cero regresión en Instagram) antes de cerrar
