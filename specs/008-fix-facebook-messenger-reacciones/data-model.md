# Data Model: Corregir reacciones en Facebook Messenger

**Feature**: `008-fix-facebook-messenger-reacciones` | **Date**: 2026-08-27

Sin tablas ni columnas nuevas. Se reutiliza íntegramente `MensajeReaccion`, ya existente y ya usado por Instagram/WhatsApp.

## Cambio de comportamiento (no de estructura)

| Campo | Antes | Después |
|---|---|---|
| `MensajeReaccion.canal` (al crear una reacción entrante) | Siempre `"instagram"`, sin importar el canal real del mensaje (`procesarReaccionIG` lo tenía fijo) | El canal real de la conversación (`"instagram"` o `"facebook_messenger"`), pasado como parámetro a la función que ya procesa la reacción (research.md R3) |

## Reglas de validación (heredadas, no nuevas)

- "Un contacto solo puede tener una reacción activa por mensaje" (borrar la anterior antes de crear la nueva) ya existe y aplica sin cambios a ambos canales — no se modifica esa regla, solo qué canal queda registrado.
- El envío de reacción al canal externo ya tolera cualquier error sin afectar el estado guardado en Karia (`toggleReaccion`, `conversaciones/actions.ts`) — FR-006 no requiere cambios ahí, ya está resuelto de forma genérica por canal.
- `CuentaCanal` (Facebook Messenger) no cambia de estructura — el fix de suscripción (R2/R4) actualiza qué eventos pide recibir de Meta, no ningún campo persistido en Karia.
