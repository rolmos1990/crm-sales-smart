# Quickstart: Validación del context builder por capas

## Prerrequisitos

- Specs `009`, `011`, `012` implementadas.
- Un agente con reglas configuradas (`009`), sin estrategia asignada, sin perfil de cliente calculado — "agente legacy" de control.
- Un segundo agente con una estrategia asignada (`011`) y un contacto con perfil calculado (`012`) — "agente completo" de prueba.

## Escenario 1 — Retrocompatibilidad exacta (Historia 1, SC-001)

1. Antes del refactor: guardar el prompt generado para el "agente legacy" (captura de referencia).
2. Aplicar el refactor de esta spec.
3. Generar el prompt para el mismo "agente legacy" en el mismo estado.
4. **Verificar**: el texto es idéntico byte a byte a la captura de referencia.

## Escenario 2 — Estrategia y perfil incorporados de verdad (Historia 2)

1. Con el "agente completo", generar una respuesta real para una conversación de un contacto con perfil calculado.
2. **Verificar**: el prompt enviado al proveedor incluye el contenido de la estrategia seleccionada por `011` y las señales del perfil de `012`, en el orden de precedencia documentado (estrategia antes que perfil).
3. Revisar `SeleccionEstrategiaLog` (de `011`) — **verificar**: se registró una entrada nueva para esta conversación real (no solo para invocaciones de prueba).

## Escenario 3 — Regla obligatoria prevalece (Historia 2, escenario 3)

1. Configurar en el agente una regla obligatoria (`009`) que prohíba ofrecer descuentos sin aprobación.
2. Asignarle una estrategia cuyo contenido sugiera "ofrecer un descuento si el cliente duda".
3. Generar el prompt para una conversación donde esa estrategia calificaría.
4. **Verificar**: la regla obligatoria aparece en el prompt antes y con mayor peso estructural (por ejemplo, en la sección de reglas obligatorias, no diluida dentro del texto de la estrategia) que la sugerencia de la estrategia.

## Escenario 4 — Ausencia de estrategia/perfil no bloquea (Historia 2, escenario 4)

1. Generar una respuesta para un agente sin estrategia asignada y un contacto sin perfil calculado todavía.
2. **Verificar**: la generación se completa normalmente, sin error, con las capas 4 y 5 omitidas del prompt.

## Escenario 5 — Placeholders reservados y neutros (Historia 3)

1. Revisar el código de `datos-conocidos-faltantes.ts`, `info-operativa.ts`, `ejemplos-piloto.ts`.
2. **Verificar**: cada uno existe, está documentado con referencia a su spec futura, y devuelve `null` siempre — ningún prompt generado hoy contiene contenido de estas tres capas.
