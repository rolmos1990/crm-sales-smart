---

description: "Task list for exposing the Facebook Messenger config link"
---

# Tasks: Acceso al login/configuración de Facebook Messenger desde Integraciones

**Input**: Design documents from `/specs/006-fix-facebook-messenger-setup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No se pidieron y no aplican — es una condición de render pura, sin lógica de negocio (ver plan.md, Technical Context → Testing).

**Organization**: Una sola historia de usuario (US1, P1) — el fix es de un solo archivo.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

No aplica — no hay inicialización de proyecto ni dependencias nuevas (research.md).

---

## Phase 2: Foundational

No aplica — no hay infraestructura compartida bloqueante para esta historia.

---

## Phase 3: User Story 1 - Llegar al login de Meta después de activar Facebook Messenger (Priority: P1) 🎯 MVP

**Goal**: Que el botón "Configurar" de Facebook Messenger aparezca en la tarjeta de Integraciones cuando está activa, llevando a `/integraciones/facebook-messenger`.

**Independent Test**: Activar Facebook Messenger desde Integraciones y confirmar que aparece "Configurar" y lleva a la pantalla correcta (quickstart.md, Escenario 1).

### Implementation for User Story 1

- [X] T001 [US1] En `src/integraciones/components/lista-integraciones.tsx` (`CardIntegracion`), agregado el tercer bloque condicional `instalada.estado === "ACTIVA" && integracion.clave === "facebook_messenger"` con `<Link href="/integraciones/facebook-messenger">Configurar</Link>`, mismo formato/estilo que los bloques ya existentes de `"whatsapp_lite"` e `"instagram"` (research.md R1). Typecheck limpio

**Checkpoint**: US1 completa — es la única tarea de esta feature.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T002 Validado a nivel de código: (1) el bloque nuevo solo renderiza con `estado === "ACTIVA"` y `clave === "facebook_messenger"`, apuntando a `/integraciones/facebook-messenger` (ruta confirmada existente desde 005); (2) ningún bloque "Configurar" renderiza mientras `estado !== "ACTIVA"` — se sigue viendo solo "Activar"; (3) los bloques de `whatsapp_lite`/`instagram` quedaron sin tocar y el resto del catálogo (`!instalada`, `proximamente`) usa una rama de render totalmente separada. Typecheck limpio + 96/96 tests unitarios del repo en verde (sin tests dedicados a este archivo — cambio de solo presentación)

---

## Dependencies & Execution Order

T001 → T002 (validar después de implementar). Sin paralelismo real dado el tamaño del cambio (un archivo, una tarea de código).

## Implementation Strategy

Cambio de una sola tarea — no aplica MVP incremental ni entrega por fases.
