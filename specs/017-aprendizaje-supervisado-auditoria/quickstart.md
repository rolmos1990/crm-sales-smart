# Quickstart: Validación del registro de aprendizaje supervisado

## Prerrequisitos

- Specs `009`, `011`, `014`, `016` implementadas.
- Un agente con estrategia asignada, ejemplos aprobados, y al menos una tool operativa habilitada.

## Escenario 1 — Registro completo en el camino automático (Historia 1)

1. Generar una respuesta que se envía automáticamente (categoría `AUTO_REPLY_SAFE_INTENTS`), usando una tool y con una estrategia/ejemplos aplicables.
2. **Verificar**: el registro resultante tiene `estado: ENVIADA_AUTOMATICAMENTE`, `herramientasEjecutadas` no vacío, `estrategiaUtilizadaId` y `ejemplosUtilizadosIds` presentes si aplicaron, y por relación (`usoIAId`) se puede obtener versión del agente/modelo/tiempo/consumo.

## Escenario 2 — Registro completo en el camino de revisión, con y sin edición (Historia 1)

1. Generar una respuesta que queda pendiente (`SUGGESTION_ONLY`), aprobarla sin cambios.
2. **Verificar**: `estado: ENVIADA_TAL_CUAL`, respuesta final idéntica a la propuesta.
3. Generar otra, editarla y enviarla.
4. **Verificar**: `estado: EDITADA_Y_ENVIADA`, ambas versiones (propuesta y final) distinguibles.

## Escenario 3 — Motivo de transferencia (Historia 1, escenario 4)

1. Generar una respuesta donde el agente ejecuta `transferir_a_humano`.
2. **Verificar**: el registro incluye `motivoTransferencia` con el texto correspondiente.

## Escenario 4 — Evaluación posterior (Historia 2)

1. Tomar un registro ya existente sin evaluación.
2. **Verificar**: el campo de evaluación aparece explícitamente ausente.
3. Agregar una evaluación `BUENA` con comentario.
4. **Verificar**: queda asociada al registro.
5. Agregar una segunda evaluación `NECESITA_MEJORA` para el mismo registro.
6. **Verificar**: ambas evaluaciones quedan conservadas, ninguna se pierde.

## Escenario 5 — Correcciones como insumo de recomendaciones, sin auto-aplicar (Historia 3)

1. Con varias respuestas `EDITADA_Y_ENVIADA` registradas para situaciones similares, ejecutar `ejecutarAnalisisPiloto` con `incluirCorreccionesRecientes: true`.
2. **Verificar**: se generan recomendaciones en estado `PENDIENTE`.
3. **Verificar**: la configuración publicada del agente (`AgenteIAConfig`) no cambió como resultado de este análisis.

## Escenario 6 — Fallo de registro no bloquea la respuesta (Edge Case, FR-010)

1. Simular un fallo de base de datos al intentar persistir el registro de una respuesta que de todas formas debe enviarse.
2. **Verificar**: la respuesta se envía igual al cliente; el fallo del registro solo queda en el log del servidor.

## Escenario 7 — Aislamiento multi-tenant (FR-011)

1. Intentar consultar `listarRegistrosRespuesta` o `agregarEvaluacion` sobre un registro de otra instancia.
2. **Verificar**: rechazado.
