# Feature Specification: Permitir configurar edición de pedidos en etapas Final/Cancelación

**Feature Branch**: `027-fix-permitir-editar-pedidos-etapa-final`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Permite corregir pedidos: Pedidos en estado final (Entregados) permite escoger en el Flujo de Venta si puede ser editado o no, que ya quede a criterio de la empresa si se puede o no editar los pedidos finalizados. Por ahora esta bloqueado es decir no permite editarlo, pero es posible que quiera editarlo asi que debe ser una opción habilitada, si escojo la opción como Edición Permitida, el pedido entregado puede ser modificado sin problemas."

## Diagnóstico previo (investigación de código)

- **Qué se investigó y dónde**: `src/sales/flujo-venta/components/panel-config-etapas.tsx` (diálogo de edición de etapa del Flujo de Venta), `src/sales/flujo-venta/actions.ts` (Server Actions `crearEtapa`/`actualizarEtapa`, que persisten la etapa), `src/sales/pedidos/actions.ts:262-269` (Server Action que bloquea la edición de un pedido), `src/app/sales/pedidos/[id]/page.tsx:129` (cálculo de `permiteEditar` en la página de detalle del pedido), y el modelo `FlujoVentaEtapa` en `prisma/schema.prisma`.
- **Qué se confirmó que SÍ funciona (no se toca)**:
  - El modelo de datos ya tiene los campos `permiteEditarPedido` y `permiteEditarEntrega` por etapa, pensados exactamente para este propósito (permiso de edición configurable por etapa).
  - El enforcement que **consume** el flag (`src/sales/pedidos/actions.ts` y `[id]/page.tsx`) ya lee correctamente el valor persistido de la etapa actual del pedido — bloquea solo si el flag es `false`. No hay ningún `if (etapa.esFinal) bloquear` hardcodeado ahí.
- **Causa raíz exacta — dos capas, no una** (la investigación inicial solo encontró la primera; la segunda se confirmó durante la implementación, al ver con un test end-to-end que el toggle se guardaba pero el pedido seguía bloqueado):
  1. **UI** (`panel-config-etapas.tsx`, `DialogEditarEtapa`): `permiteLocked = esInicial || esFinal || esCancelacion` deshabilitaba el control "Edición permitida" para Final/Cancelación, y `permiteEfectivo = (esFinal || esCancelacion) ? false : ...` forzaba el valor a `false` al guardar sin importar lo que el usuario eligiera. Lo mismo para "Entrega editable" (`permiteEntregaEfectivo`).
  2. **Servidor** (`flujo-venta/actions.ts`, `crearEtapa` y `actualizarEtapa`): el mismo patrón `(esFinal || esCancelacion) ? false : ...` estaba duplicado ahí, re-forzando `permiteEditarPedido`/`permiteEditarEntrega` a `false` en el momento de persistir — **independientemente de lo que mandara el cliente**. Como el servidor es la autoridad (Principio II de la constitución del proyecto), arreglar solo la UI no alcanzaba: el Server Action seguía pisando el valor elegido.
- **Por qué el síntoma se explica por esta causa y no otra**: el pedido nunca puede editarse en una etapa Final porque **ninguna de las dos capas** permitía guardar `permiteEditarPedido: true` para ella — no es un límite del motor de permisos que lo consume (que sí soporta el caso), sino un candado duplicado en la UI de configuración y en el Server Action que la respalda.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Habilitar edición en una etapa Final existente (Priority: P1)

Como administrador del Flujo de Venta, quiero poder activar "Edición permitida" en una etapa marcada como Final (p. ej. "Entregado"), para que los pedidos que llegan a esa etapa puedan seguir editándose si mi negocio lo necesita (corregir datos, ajustar cantidades, etc.).

**Why this priority**: Es el pedido explícito del usuario y el que desbloquea el caso de uso concreto (corregir un pedido ya entregado).

**Independent Test**: Editar una etapa Final existente desde Flujo de Venta, activar el toggle "Edición permitida", guardar, y confirmar que un pedido en esa etapa ahora se puede editar desde su página de detalle.

**Acceptance Scenarios**:

1. **Given** una etapa marcada como Final, **When** el administrador abre "Editar etapa" en Flujo de Venta, **Then** el control "Edición permitida" ya no está bloqueado/deshabilitado y puede activarse.
2. **Given** una etapa Final con "Edición permitida" activada y guardada, **When** un usuario abre un pedido que está en esa etapa, **Then** el pedido se puede editar sin bloqueos (mismo comportamiento que un pedido en una etapa intermedia con edición permitida).
3. **Given** una etapa Final con "Edición permitida" dejada en su valor por defecto (desactivada), **When** un usuario abre un pedido en esa etapa, **Then** el pedido sigue bloqueado para edición, igual que hoy — nada cambia si el administrador no activa la opción explícitamente.

---

### User Story 2 - Habilitar edición en una etapa de Cancelación (Priority: P2)

Como administrador del Flujo de Venta, quiero el mismo control sobre etapas de Cancelación que sobre etapas Final, para decidir también si un pedido cancelado puede corregirse.

**Why this priority**: Mismo mecanismo que la User Story 1, pero sobre el otro tipo de etapa de cierre (Cancelación). Se confirmó con el usuario que debe tratarse igual que Final, no queda como caso especial bloqueado.

**Independent Test**: Repetir el mismo flujo de la User Story 1 sobre una etapa marcada como Cancelación.

**Acceptance Scenarios**:

1. **Given** una etapa marcada como Cancelación, **When** el administrador abre "Editar etapa", **Then** el control "Edición permitida" no está bloqueado y puede activarse igual que en una etapa Final.
2. **Given** una etapa de Cancelación con "Edición permitida" activada, **When** un usuario abre un pedido en esa etapa, **Then** el pedido se puede editar sin bloqueos.

---

### User Story 3 - Habilitar edición de datos de entrega en etapas de cierre (Priority: P3)

Como administrador del Flujo de Venta, quiero poder activar también "Entrega editable" (datos de envío/tracking) en etapas Final o Cancelación, con el mismo criterio configurable que "Edición permitida".

**Why this priority**: Confirmado con el usuario como parte del mismo pedido, pero es un control secundario (datos de entrega, no el pedido completo) — menor prioridad que las dos historias anteriores.

**Independent Test**: En una etapa Final o de Cancelación, activar "Entrega editable", guardar, y confirmar que los datos de entrega/tracking de un pedido en esa etapa pueden modificarse.

**Acceptance Scenarios**:

1. **Given** una etapa Final o de Cancelación, **When** el administrador abre "Editar etapa", **Then** el control "Entrega editable" ya no está deshabilitado y puede activarse.
2. **Given** una etapa Final/Cancelación con "Entrega editable" activada, **When** un usuario intenta actualizar datos de entrega de un pedido en esa etapa, **Then** la actualización se permite.

---

### Edge Cases

- Una etapa que ya estaba marcada como Final/Cancelación **antes** de este cambio tiene guardado `permiteEditarPedido: false` (forzado por el código anterior) — al editarla después de este cambio, el toggle debe arrancar reflejando ese valor guardado (`false`), no saltar automáticamente a `true`. El administrador decide activarlo manualmente; no hay migración de datos.
- Una etapa Inicial sigue sin poder desactivar "Edición permitida" (regla existente, fuera de alcance de este cambio) — este cambio no debe tocar ese comportamiento.
- Una etapa intermedia (ni Inicial, ni Final, ni Cancelación) mantiene exactamente el comportamiento actual de ambos toggles — este cambio no debe alterar su lógica.
- Si un administrador marca una etapa como Final/Cancelación mientras el diálogo está abierto (toggleando los botones "Final"/"Cancelación" antes de guardar) y ya había activado "Edición permitida", el valor elegido se conserva — dejar de forzarlo a `false` al vuelo es justamente el cambio pedido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir que el control "Edición permitida" (`permiteEditarPedido`) sea editable (no deshabilitado) en el diálogo de edición de etapa cuando la etapa es Final o Cancelación, igual que ya lo es para una etapa intermedia.
- **FR-002**: El sistema MUST guardar el valor que el administrador elija para `permiteEditarPedido` en una etapa Final o Cancelación, sin forzarlo a `false` al momento de persistir.
- **FR-003**: El sistema MUST permitir que el control "Entrega editable" (`permiteEditarEntrega`) sea editable (no deshabilitado) en el diálogo de edición de etapa cuando la etapa es Final o Cancelación.
- **FR-004**: El sistema MUST guardar el valor que el administrador elija para `permiteEditarEntrega` en una etapa Final o Cancelación, sin forzarlo a `false` al momento de persistir.
- **FR-005**: El sistema MUST seguir aplicando el enforcement existente (Server Action `actions.ts` y página de detalle `[id]/page.tsx`) sin cambios — un pedido en una etapa con `permiteEditarPedido: true` debe poder editarse; con `false`, debe seguir bloqueado.
- **FR-006**: El sistema MUST NOT alterar el comportamiento existente de etapas Iniciales (edición siempre permitida, control bloqueado en `true`) ni de etapas intermedias (edición ya configurable libremente hoy).
- **FR-007**: El sistema MUST mostrar, al abrir "Editar etapa" sobre una etapa Final/Cancelación ya existente, el valor de `permiteEditarPedido`/`permiteEditarEntrega` tal como está guardado en base de datos (probablemente `false` para etapas creadas antes de este cambio) — no debe asumirse `true` por defecto solo por quitar el candado de la UI.

### Key Entities

- **FlujoVentaEtapa**: etapa del flujo de venta configurable por el negocio; ya tiene los campos `esFinal`, `esCancelacion`, `permiteEditarPedido` y `permiteEditarEntrega`. Este cambio no agrega campos nuevos — solo deja de forzar dos de ellos a `false` en la UI de configuración para dos tipos de etapa concretos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede activar la edición de pedidos para una etapa Final o de Cancelación en menos de 30 segundos, sin necesitar cambios de código ni soporte técnico.
- **SC-002**: El 100% de los pedidos en una etapa con "Edición permitida" activada quedan editables desde su página de detalle, sin excepciones.
- **SC-003**: El 100% de los pedidos en etapas que no cambiaron su configuración (Iniciales, intermedias, o Final/Cancelación dejadas en su valor por defecto) mantienen exactamente el mismo comportamiento de edición que tenían antes de este cambio (cero regresión).

## Assumptions

- El alcance de este cambio es exclusivamente el diálogo de configuración de etapas del Flujo de Venta (`panel-config-etapas.tsx`); no se requiere tocar el enforcement en `actions.ts` ni en `[id]/page.tsx`, que ya soportan correctamente el flag por etapa.
- No se requiere migración de datos: las etapas Final/Cancelación existentes conservan el valor `permiteEditarPedido`/`permiteEditarEntrega` que tengan guardado (probablemente `false`, por haber sido forzado hasta ahora); el administrador decide manualmente si lo activa.
- Se confirmó con el usuario que el criterio configurable aplica igual a etapas Final y de Cancelación, y a ambos controles ("Edición permitida" y "Entrega editable") — no quedan como excepciones bloqueadas.
- Las etapas Iniciales no son parte de este pedido y mantienen su regla actual (edición siempre permitida, sin poder desactivarla).
