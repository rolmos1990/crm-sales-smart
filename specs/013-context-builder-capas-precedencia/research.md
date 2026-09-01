# Research: Construcción del contexto de IA por capas con precedencia

## Decisión 1 — Mapeo capa → fuente de datos real (o placeholder)

| # | Capa | Fuente real en esta spec |
|---|---|---|
| 1 | Políticas globales de seguridad | Bloque fijo anti prompt-injection, ya existente en `construirSystemPrompt` — se mueve tal cual a `politicas-seguridad.ts`. |
| 2 | Identidad y comportamiento del agente | Campos de `009` (`nombreAgente`, `rol`, comunicación, etc.) vía la versión publicada vigente de `AgenteIAConfig`. |
| 3 | Reglas específicas del negocio | Comportamiento natural fijo + reglas estructuradas de `009` (frases/comportamientos prohibidos, reglas personalizadas, condiciones de transferencia). |
| 4 | Playbook/estrategia activa | `seleccionarEstrategia` de `011`, con las estrategias asignadas al agente y las señales disponibles (tipo de relación/intención del perfil, capa 5, calculadas primero). |
| 5 | Perfil dinámico del cliente | `PerfilClienteService.obtenerPerfil` de `012`. |
| 6 | Estado actual de la conversación | Mensajes recientes ya resueltos por `resolverDecisionContexto`/`construirContexto` existente. |
| 7 | Datos conocidos y faltantes | **Placeholder** — sin fuente real hoy; devuelve vacío. Documentado para que una spec futura (fuera del plan de 10 specs actual) lo complete comparando lo que el perfil/conversación ya sabe contra lo que una plantilla de estrategia necesitaría. |
| 8 | Información operativa verificada | **Placeholder** — fuente real: `015-herramientas-operativas-inventario-envios-acciones` (resultados de tools de inventario/envío ya ejecutadas en la conversación actual). |
| 9 | Ejemplos piloto relevantes | **Placeholder** — fuente real: `014-conversaciones-piloto-ejemplos-relevantes`. |
| 10 | Herramientas permitidas | Lista ya calculada hoy por `obtenerHerramientasPermitidas` en el suscriptor — se formaliza como capa informativa (menciona qué puede hacer el agente), sin cambiar cómo `ejecutarHerramienta` valida la lista blanca. |
| 11 | Instrucción final | El texto ya existente ("Redacta la siguiente respuesta para enviar al cliente...") — se mueve a `instruccion-final.ts`. |

**Rationale de dejar 7, 8 y 9 como placeholders explícitos en vez de omitir la capa por completo**: FR-008 pide que la posición quede reservada y documentada — un placeholder que siempre devuelve `""`/`null` dentro del array ordenado logra exactamente eso sin necesidad de tocar el array cuando `014`/`015` completen su función real (solo reemplazan la función productora, no su posición).

## Decisión 2 — Tipo `CapaContexto` y orden de ejecución vs. orden de precedencia

**Decisión**: cada capa es `{ nombre: string; precedencia: number; producir: (insumos: InsumosContexto) => Promise<string | null> }`. El array de 11 capas está ordenado por `precedencia` ascendente (1 = mayor peso, políticas de seguridad) y se ejecuta en ese mismo orden — la ejecución no es paralela porque la capa 4 (estrategia) necesita el resultado de la capa 5 (perfil, ya calculado antes por `012`, no dentro de esta ejecución) para sus señales, y en general el orden de aparición en el texto final debe coincidir con el orden de precedencia para que "mayor precedencia" sea también "aparece antes / con más peso posicional" (FR-002, FR-006).

**Rationale**: mantener orden de ejecución = orden de precedencia = orden de aparición en el texto es la forma más simple de garantizar FR-006 (nada de menor precedencia puede pesar más) sin necesitar un mecanismo de arbitraje: en un prompt de texto secuencial, lo que aparece primero y con mayor énfasis estructural (títulos, bloques) ya es lo que un LLM instruction-tuned pondera más — igual criterio que ya usa hoy `construirSystemPrompt` (rol y restricciones antes que el override libre).

**Alternativas consideradas**: ejecutar todas las capas en paralelo (`Promise.all`) y luego ordenar el resultado — rechazada porque la capa 4 depende conceptualmente del resultado de la 5 (las señales del perfil alimentan al selector de estrategia), y ejecutar en paralelo obligaría a resolver esa dependencia de otra forma sin ganar nada, dado que ninguna capa hace I/O pesado nuevo (perfil y estrategia ya están precalculados por sus propios servicios).

## Decisión 3 — Retrocompatibilidad textual exacta (SC-001)

**Decisión**: `politicas-seguridad.ts`, `identidad-agente.ts`, `reglas-negocio.ts`, `estado-conversacion.ts` e `instruccion-final.ts` se implementan copiando literalmente la lógica de texto que hoy vive en `construirSystemPrompt`/`construirContexto` (post-`009`), sin reformular ninguna frase. El test de retrocompatibilidad (`tasks.md`) compara byte a byte el prompt generado antes y después del refactor para un conjunto fijo de configuraciones de agente de prueba.

**Rationale**: es un refactor de estructura, no de contenido — cualquier diferencia textual, aunque sea de redacción, es un riesgo no aceptado por esta spec (Constitution V: cambios deben pasar tests, y el riesgo aquí es alto porque toca el flujo de producción real de generación de respuestas).

**Alternativas consideradas**: aprovechar el refactor para "mejorar" la redacción de alguna sección existente — rechazado explícitamente; cualquier mejora de redacción es una decisión de producto que debe pasar por su propia spec, no colarse en un refactor arquitectónico.

## Decisión 4 — Dónde se registra la selección de estrategia dentro del flujo real

**Decisión**: `estrategia-activa.ts` (capa 4) llama a `seleccionarEstrategia` (función pura de `011`) y luego a `registrarSeleccionEstrategia` (side effect de `011`) con el `conversacionId` disponible en `InsumosContexto` — este es el primer punto real donde el selector de `011` se conecta a una conversación de verdad (antes solo era invocable manualmente/desde tests, según su propio quickstart).

**Rationale**: cierra el círculo de auditoría de `011` (SC-003 de esa spec, "identificar la estrategia elegida en menos de 3 pasos") con datos reales de producción, no solo de prueba.
