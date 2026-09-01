# Quickstart: Validación de niveles de autonomía

## Prerrequisitos

- Migraciones y seed de esta spec aplicados.
- Un agente "sin tocar" (representa una instancia que existía antes del seed, sin filas de `AutonomiaIntencionConfig`) y un agente "con seed" (16 filas según la clasificación inicial).

## Escenario 1 — Comportamiento por defecto intacto (Historia 2, SC-001)

1. Con el agente "sin tocar", enviar mensajes de varias categorías distintas (saludo, reclamo, consulta de precio).
2. **Verificar**: todos se responden automáticamente, sin ninguna clasificación adicional ni respuesta pendiente — igual que antes de esta spec.

## Escenario 2 — Clasificación sembrada aplica correctamente (Historia 2)

1. Con el agente "con seed", enviar un saludo → **verificar**: se envía automáticamente (`AUTO_REPLY_SAFE_INTENTS`).
2. Enviar un mensaje de reclamo → **verificar**: no se genera ni se envía ninguna respuesta automática (`HUMAN_ONLY`).
3. Enviar una consulta de precio → **verificar**: se genera una respuesta pero queda en `RespuestaPendienteRevision` (`SUGGESTION_ONLY`), no se envía.

## Escenario 3 — Bandeja de revisión (Historia 3)

1. Tomar la respuesta pendiente del paso 3 del Escenario 2.
2. Editarla y enviarla → **verificar**: se envía al cliente, `estado: EDITADA_Y_ENVIADA`, `respuestaEditada` guardada.
3. Generar otra respuesta pendiente y descartarla → **verificar**: `estado: DESCARTADA`, nunca llega al cliente.

## Escenario 4 — `ConditionalAutomation`

1. Configurar "Recomendación" como `CONDITIONAL_AUTOMATION` con `confianzaMinimaClasificacion: 0.8`.
2. Simular una clasificación con confianza 0.9 → **verificar**: se envía automáticamente.
3. Simular una clasificación con confianza 0.5 → **verificar**: queda pendiente.

## Escenario 5 — Doble categoría y nivel más restrictivo (Edge Case)

1. Simular una clasificación que devuelve dos categorías candidatas: una `AUTO_REPLY_SAFE_INTENTS` y otra `HUMAN_ONLY`.
2. **Verificar**: se aplica `HUMAN_ONLY` (no se genera respuesta automática).

## Escenario 6 — Fallo de clasificación no bloquea (Edge Case)

1. Con el agente "con seed", simular un fallo del clasificador (proveedor caído).
2. **Verificar**: el mensaje se responde automáticamente, igual que el comportamiento por defecto (Decisión 3), sin quedar atascado sin respuesta.

## Escenario 7 — Cambiar nivel no afecta pendientes ya existentes (FR-013)

1. Con una respuesta ya pendiente por `SUGGESTION_ONLY`, cambiar esa categoría a `AUTO_REPLY_SAFE_INTENTS`.
2. **Verificar**: la respuesta pendiente existente sigue en `PENDIENTE`, no se envía automáticamente de forma retroactiva.
