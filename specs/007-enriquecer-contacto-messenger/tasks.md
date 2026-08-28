---

description: "Task list for enriching Facebook Messenger contacts with name/photo"
---

# Tasks: Enriquecer el contacto al recibir mensajes de Facebook Messenger

**Input**: Design documents from `/specs/007-enriquecer-contacto-messenger/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No se pidieron explícitamente y no se agrega un test unitario nuevo — `obtenerPerfilRemitenteIG` (la función hermana que ya existe para Instagram, mismo patrón exacto) tampoco tiene test hoy, por no estar extraída como función pura. Se mantiene el mismo nivel de riesgo/cobertura que el código ya en producción; la validación principal es manual vía `quickstart.md`.

**Organization**: Una sola historia de usuario (US1, P1) — coincide con la única historia de `spec.md`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

No aplica — no hay inicialización de proyecto ni dependencias nuevas (research.md).

---

## Phase 2: Foundational

No aplica — no hay infraestructura compartida bloqueante; la lógica de creación/actualización de contacto (`procesarMensajeEntrante`) ya es genérica y ya cumple FR-003 sin cambios (confirmado en `data-model.md`).

---

## Phase 3: User Story 1 - Ver el nombre y la foto del contacto al recibir un mensaje de Messenger (Priority: P1) 🎯 MVP

**Goal**: Que un contacto nuevo de Facebook Messenger se cree con nombre y foto de perfil completados automáticamente, igual que ya sucede con Instagram.

**Independent Test**: Escribirle a una Página conectada desde una cuenta de prueba con nombre/foto públicos y confirmar que el contacto creado ya los trae (quickstart.md, Escenario 1).

### Implementation for User Story 1

- [X] T001 [US1] En `src/app/api/webhooks/instagram/route.ts`, agregado `obtenerPerfilRemitenteFacebook(psid, cuentaCanal)`: mismo patrón que `obtenerPerfilRemitenteIG` (mismo `accessToken` descifrado de `cuentaCanal.configuracion`, host fijo `graph.facebook.com`), pidiendo `fields=first_name,last_name,profile_pic`; combina `first_name`+`last_name` en `pushName` (sin `handleCanal`); `try/catch` que devuelve `{}` en cualquier error — nunca tira (FR-001, FR-002, FR-004, research.md R1/R3)
- [X] T002 [US1] Generalizado el bloque que antes solo corría `if (canalResuelto === "instagram")`: el chequeo de "falta perfil" ahora consulta `ContactoIdentificadorCanal` con `canal: canalResuelto` (en vez de `"instagram"` fijo) para ambos canales, y despacha a `obtenerPerfilRemitenteIG` u `obtenerPerfilRemitenteFacebook` según corresponda (FR-001, FR-002, FR-003 — reutiliza la regla de no-sobrescritura ya existente en `procesarMensajeEntrante`, sin tocarla). Typecheck limpio + 96/96 tests del repo en verde

**Checkpoint**: US1 completa — un mensaje nuevo de Messenger debe crear el contacto con nombre/foto cuando Meta los entregue, sin romper nada si no los entrega.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T003 [P] Validado a nivel de código: la generalización queda byte-idéntica para `canalResuelto === "instagram"` (mismo `canal`, misma función); `obtenerPerfilRemitenteFacebook` nunca lanza (try/catch → `{}`); `procesarMensajeEntrante` (sin tocar) ya no sobrescribe nombre/foto existentes. Typecheck limpio + 96/96 tests del repo en verde. **Pendiente de quien implementa**: probar en vivo escribiéndole a la Página desde una cuenta de Facebook real (como ya hizo el usuario) para confirmar visualmente que el contacto llega con nombre/foto
- [X] T004 [P] Actualizado `docs/META-FACEBOOK-MESSENGER-INTEGRACION.md`: agregada la dependencia de `Business Asset User Profile Access` en "Permisos de Meta usados", y la limitación "Sin prefetch de nombre/foto" pasó a "Prefetch — implementado" con la aclaración de qué funciona hoy (testers) vs qué falta para producción completa (aprobación de Meta)

---

## Dependencies & Execution Order

T001 → T002 (T002 llama a la función de T001) → T003/T004 en paralelo. Sin paralelismo real entre T001/T002 al ser el mismo archivo y depender uno del otro.

## Implementation Strategy

Cambio de una sola historia — no aplica MVP incremental ni entrega por fases más allá de T001→T002→validar.
