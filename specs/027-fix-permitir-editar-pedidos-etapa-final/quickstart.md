# Quickstart: Permitir configurar edición de pedidos en etapas Final/Cancelación

Guía de validación manual end-to-end. Requiere un usuario con acceso a **Ventas → Flujo de Venta** y al menos un pedido en una etapa Final.

## Prerrequisitos

- `npm run dev` corriendo, sesión autenticada con un rol que pueda editar el Flujo de Venta (Owner/Admin).
- Un Flujo de Venta con al menos una etapa marcada como **Final** y, si se quiere cubrir el escenario completo, otra marcada como **Cancelación**.
- Al menos un pedido (`Pedido`) ubicado en esa etapa Final (para el escenario 2).

## Escenario 1 — El toggle deja de estar bloqueado (FR-001, FR-003)

1. Ir a `/sales/flujo-venta`.
2. Abrir "Editar etapa" sobre una etapa marcada como **Final**.
3. **Verificar**: el control "Edición permitida" ya NO aparece atenuado/deshabilitado, y el tooltip fijo "Los pedidos en etapas finales o canceladas no pueden ser editados" ya no aparece al pasar el mouse.
4. **Verificar**: el control "Entrega editable" tampoco aparece deshabilitado.
5. Repetir los pasos 2-4 sobre una etapa marcada como **Cancelación** — mismo resultado esperado.

## Escenario 2 — Activar edición y confirmar que el pedido se puede editar (FR-002, FR-005, User Story 1)

1. Sobre la etapa Final del escenario 1, activar "Edición permitida" y guardar. Confirmar el toast "Etapa actualizada".
2. Abrir un pedido (`/sales/pedidos/[id]`) que esté en esa etapa.
3. **Verificar**: el pedido permite editarse (mismo comportamiento que un pedido en una etapa intermedia con edición permitida) — sin banner ni bloqueo de "pedido no editable".

## Escenario 3 — Cero regresión si no se activa nada (FR-007, SC-003)

1. Editar de nuevo la misma etapa Final, pero esta vez sin tocar el toggle (dejarlo en su valor actual).
2. Guardar.
3. Abrir un pedido en esa etapa.
4. **Verificar**: el comportamiento de edición coincide exactamente con el que tenía antes del cambio (si el toggle quedó desactivado, el pedido sigue bloqueado para edición).

## Escenario 4 — Etapas Iniciales e intermedias no cambian (FR-006)

1. Abrir "Editar etapa" sobre una etapa **Inicial**. **Verificar**: "Edición permitida" sigue bloqueado en `true` (sin cambios).
2. Abrir "Editar etapa" sobre una etapa intermedia (ni Inicial, ni Final, ni Cancelación). **Verificar**: el comportamiento de ambos toggles es idéntico al que tenían antes de este cambio (libremente configurables, como ya funcionaba).

## Resultado esperado

Los 4 escenarios pasan sin necesidad de tocar `actions.ts`, `[id]/page.tsx`, ni el schema de Prisma — el cambio está contenido en `panel-config-etapas.tsx`.
