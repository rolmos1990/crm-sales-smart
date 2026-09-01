# Research: Registro de aprendizaje supervisado y auditoría de respuestas de IA

## Decisión 1 — Mapeo campo pedido → fuente

| Campo pedido | Fuente |
|---|---|
| Mensaje del cliente | Ya capturado por `016` (`RespuestaPendienteRevision.mensajeCliente`) — se generaliza a ambos caminos. |
| Respuesta propuesta | Ídem (`respuestaPropuesta`). |
| Respuesta final enviada | Ídem (`respuestaEditada` si hubo edición; si no, es la propuesta misma — `estado` ya lo distingue). |
| Aprobada sin cambios / cambios realizados | Derivable de `estado` (`ENVIADA_TAL_CUAL` vs `EDITADA_Y_ENVIADA`) más `respuestaEditada`, ya definido por `016`. |
| Producto identificado | **Nuevo** — columna `productoIdentificadoId` (`String?`), completada cuando `buscar_productos` u otra tool de `015` devolvió un resultado usado (research.md Decisión 2). |
| Estrategia utilizada | **Nuevo, por join** — se resuelve consultando `SeleccionEstrategiaLog` (`011`) por `conversacionId` + ventana de tiempo cercana a la generación, en vez de duplicar el dato (ya vive ahí con su propio motivo/auditoría). |
| Ejemplos utilizados | **Nuevo** — columna `ejemplosUtilizadosIds` (`Json`, `string[]` de `EjemploPrompt.id`), completada por el context builder (`013`) al ejecutar la capa 9 (`014`). |
| Herramientas ejecutadas | **Nuevo** — columna `herramientasEjecutadas` (`Json`, `string[]` de nombres de tool), completada por el loop de tool calling del suscriptor. |
| Nivel de confianza | **Nuevo** — columna `confianza` (`Float?`), tomada de la confianza de clasificación de `016` cuando exista, `null` si no aplica. |
| Motivo de transferencia humana | **Nuevo** — columna `motivoTransferencia` (`String?`), persistida por `transfer.tool.ts` (research.md Decisión 3). |
| Versión del agente | Ya existe vía `UsoIA.agenteIAConfigVersionId` (`009`) — se resuelve por join, no se duplica. |
| Modelo utilizado | Ya existe vía `UsoIA.modelo`/`proveedorIA` — por join. |
| Tiempo y consumo | Ya existe vía `UsoIA.tiempoMs`/`tokensInput`/`tokensOutput`/`costoEstimado` — por join. |
| Evaluación posterior | **Nuevo** — tabla `EvaluacionRespuestaIA` separada (Decisión 4), no una columna, porque puede no existir y puede (Edge Case) registrarse más de una vez. |

**Rationale general**: minimizar duplicación — todo lo que ya vive en `UsoIA`/`SeleccionEstrategiaLog` se resuelve por relación/join al consultar el registro completo, no se copia. Solo se agregan las columnas genuinamente nuevas que ningún otro lugar captura hoy.

## Decisión 2 — "Producto identificado" es de mejor esfuerzo, tomado del resultado de tools

**Decisión**: cuando el loop de tool calling del suscriptor ejecuta `buscar_productos` (u otra tool de `015` que identifique un producto concreto) y el resultado incluye uno o más productos, se toma el primero como `productoIdentificadoId` del registro — no se interpreta ni se infiere semánticamente cuál "el" producto relevante de la conversación es.

**Rationale**: coherente con la Assumption de la spec (mejor esfuerzo, no garantía); evita construir un clasificador de "producto principal de la conversación" que no fue pedido con ese nivel de detalle.

**Alternativas consideradas**: usar IA para determinar el producto más relevante mencionado — rechazado por costo/complejidad no justificados frente a un campo que la propia spec ya marca como best-effort.

## Decisión 3 — Persistir el motivo de transferencia en el registro de la respuesta actual, no en `Conversacion`

**Decisión**: `transfer.tool.ts` recibe (vía `ContextoTool`, ya existente) una referencia al registro de respuesta en curso — en la práctica, el suscriptor le pasa el `motivo` recibido por la tool de vuelta al ensamblador de registro (`registro.ts`) después de ejecutar el loop de tools, igual que ya hace con `herramientasEjecutadas`.

**Rationale**: el motivo de transferencia es información de *esa respuesta puntual*, no un atributo permanente de la conversación (`Conversacion.clasificacion` ya captura el efecto duradero) — separar ambos evita mezclar "por qué se transfirió esta vez" con "cómo está clasificada la conversación en general".

**Alternativas consideradas**: agregar `motivoTransferencia` a `Conversacion` — rechazado porque una conversación puede transferirse más de una vez con motivos distintos a lo largo del tiempo; el registro por respuesta ya es el lugar natural para eso.

## Decisión 4 — `EvaluacionRespuestaIA` como tabla separada, no columna

**Decisión**: tabla nueva `EvaluacionRespuestaIA` (`respuestaId` FK, `calificacion`, `comentario?`, `evaluadoPorUsuarioId`, `evaluadoEn`), sin restricción de unicidad — una misma respuesta puede tener más de una evaluación a lo largo del tiempo (Edge Case de la spec, "no perder ninguna silenciosamente"). La evaluación "vigente" para mostrar en una UI resumida es la más reciente, pero todas quedan consultables.

**Rationale**: cumple el Edge Case explícitamente sin necesitar una regla de "solo una evaluación permitida" que la propia spec no pide — más simple que forzar un `upsert` con reglas de reemplazo.

**Alternativas consideradas**: columna `evaluacion: Json?` en el propio registro de respuesta, sobrescrita en cada evaluación — rechazada porque pierde el historial de evaluaciones anteriores, violando el Edge Case.

## Decisión 5 — Correcciones como insumo de `014`, sin nueva escritura hacia `AgenteIAConfig`

**Decisión**: `ejecutarAnalisisPiloto` (`014`) gana un parámetro opcional para incluir, junto a las conversaciones piloto, un resumen de las respuestas con `estado: EDITADA_Y_ENVIADA` recientes (mensaje/propuesta/final) como contexto adicional para el modelo de análisis — el resultado sigue siendo `RecomendacionComportamiento` en estado `PENDIENTE`, exactamente el mismo mecanismo ya construido, sin ninguna ruta nueva de escritura.

**Rationale**: reutiliza al 100% la garantía de "nunca auto-aplica" ya validada por `014`, cumpliendo FR-009/SC-003 sin construir un segundo camino de generación de recomendaciones.

**Alternativas consideradas**: un proceso de análisis separado exclusivo para correcciones — rechazado por duplicar `analizador.ts` de `014` para el mismo propósito (generar recomendaciones pendientes de aprobación humana).
