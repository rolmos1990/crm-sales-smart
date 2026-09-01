# Feature Specification: Registro de aprendizaje supervisado y auditoría de respuestas de IA

**Feature Branch**: `[017-aprendizaje-supervisado-auditoria]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Cuando el agente sugiera una respuesta, registrar: mensaje del cliente, respuesta propuesta, respuesta final enviada, si fue aprobada sin cambios, cambios realizados, producto identificado, estrategia utilizada, ejemplos utilizados, herramientas ejecutadas, nivel de confianza, motivo de transferencia humana, versión del agente, modelo utilizado, tiempo y consumo, evaluación posterior si existe. Las correcciones deben servir para generar recomendaciones futuras, pero nunca deben modificar automáticamente el agente publicado."

## Diagnóstico previo (investigación de código)

- Los datos que esta spec necesita **ya existen, pero repartidos en piezas separadas que ninguna consulta junta hoy**: `UsoIA` (`009`/existente) ya tiene modelo, tokens, tiempo y — tras `009` — la versión del agente; `SeleccionEstrategiaLog` (`011`) ya tiene la estrategia usada y su motivo; `RespuestaPendienteRevision` (`016`) ya tiene mensaje del cliente, respuesta propuesta, respuesta final (si fue editada) y si fue aprobada sin cambios — pero **solo para el camino de revisión humana** (`SuggestionOnly`/`ConditionalAutomation` no cumplida); las respuestas enviadas automáticamente (`AutoReplySafeIntents`/`ConditionalAutomation` cumplida) no dejan ningún rastro de ese mismo detalle hoy.
- No existe hoy ningún registro de qué ejemplos piloto (`014`) se usaron en una generación puntual, ni de qué herramientas se ejecutaron para producir una respuesta concreta, ni de un "producto identificado" por la conversación, ni de una "evaluación posterior" (una calificación de calidad hecha por un humano después del hecho, distinta de la aprobación/edición en el momento).
- El motivo de transferencia a humano ya se captura como argumento de la tool `transferir_a_humano` (`motivo`, `prioridad`) pero **no se persiste en ningún lado** — solo se usa para actualizar `Conversacion.clasificacion` y se devuelve como texto de la tool, sin quedar en un registro consultable después.
- Esta spec no crea un registro paralelo a `RespuestaPendienteRevision` de `016` — la extiende (columnas aditivas) para que exista una única traza por respuesta generada, sea que se haya enviado automáticamente o haya pasado por revisión humana, evitando dos tablas casi idénticas con propósitos que se solapan.
- El requisito de "las correcciones nunca modifican automáticamente el agente publicado" ya está garantizado por diseño en `009` (toda publicación requiere una acción humana explícita de publicar un borrador) y en `014` (el análisis de conversaciones piloto solo produce recomendaciones pendientes) — esta spec no necesita un mecanismo nuevo para esa garantía, solo debe respetarla al conectar sus correcciones como insumo del análisis de `014`, nunca como una escritura directa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cada respuesta generada por el agente queda registrada con su traza completa (Priority: P1)

Como responsable de calidad de mi negocio, quiero que cada vez que el agente genera una respuesta —se haya enviado automáticamente o haya pasado por revisión humana— quede un registro con el mensaje del cliente, la respuesta propuesta, la respuesta final realmente enviada, si hubo cambios, la estrategia y los ejemplos usados, las herramientas ejecutadas, el nivel de confianza, la versión del agente y el modelo utilizado, y el tiempo y consumo de esa generación, para poder auditar y mejorar el comportamiento del agente con datos reales.

**Why this priority**: Es la base de todo aprendizaje supervisado — sin un registro completo y confiable, no hay nada que analizar ni de dónde sacar recomendaciones futuras.

**Independent Test**: Generar una respuesta que se envía automáticamente y otra que pasa por revisión humana con una edición, y confirmar que ambas quedan registradas con todos los campos disponibles para cada caso.

**Acceptance Scenarios**:

1. **Given** una respuesta generada y enviada automáticamente, **When** se revisa su registro, **Then** incluye el mensaje del cliente, la respuesta enviada, la versión del agente, el modelo utilizado, el tiempo y consumo de tokens, y — si aplicaron — la estrategia y los ejemplos usados.
2. **Given** una respuesta que un humano editó antes de enviar, **When** se revisa su registro, **Then** incluye tanto la respuesta propuesta original como la respuesta final enviada, y queda claro que hubo una edición (no una aprobación sin cambios).
3. **Given** una respuesta que un humano aprobó sin cambios, **When** se revisa su registro, **Then** queda claro que la respuesta final es idéntica a la propuesta, sin ambigüedad de si hubo o no una corrección.
4. **Given** una respuesta que resultó en una transferencia a un agente humano, **When** se revisa su registro, **Then** incluye el motivo de esa transferencia.
5. **Given** una respuesta generada usando una o más herramientas operativas, **When** se revisa su registro, **Then** incluye cuáles herramientas se ejecutaron.

---

### User Story 2 - Un responsable puede calificar la calidad de una respuesta ya enviada (Priority: P2)

Como responsable de calidad, quiero poder calificar, después del hecho, si una respuesta ya enviada al cliente fue buena o necesitaba mejorar, para dejar una evaluación que no dependa de que la respuesta haya pasado por el flujo de revisión en el momento.

**Why this priority**: Complementa la Historia 1 con una señal de calidad adicional, útil incluso para respuestas que se enviaron automáticamente y nunca pasaron por revisión — pero no bloquea el valor central del registro de trazabilidad.

**Independent Test**: Tomar una respuesta ya enviada (automática o revisada) y agregarle una evaluación posterior; confirmar que queda asociada a su registro original.

**Acceptance Scenarios**:

1. **Given** cualquier respuesta ya registrada, **When** un responsable la evalúa después del hecho, **Then** la evaluación queda asociada a esa respuesta específica, sin sobrescribir ningún dato de la traza original.
2. **Given** una respuesta sin ninguna evaluación posterior, **When** se consulta su registro, **Then** el campo de evaluación aparece explícitamente como ausente, no como una calificación neutral o inventada.

---

### User Story 3 - Las correcciones alimentan recomendaciones futuras, nunca cambian el agente publicado automáticamente (Priority: P2)

Como responsable de negocio, quiero que las correcciones que los humanos hacen a las respuestas del agente se puedan usar como insumo para generar recomendaciones de mejora, sin que eso implique que el agente cambie de comportamiento por sí solo.

**Why this priority**: Cierra el ciclo de aprendizaje supervisado pedido — depende de que exista el registro completo de la Historia 1, y reutiliza el mecanismo de recomendaciones ya construido en `014`, sin duplicar su garantía de no aplicar cambios automáticos.

**Independent Test**: Con varias correcciones registradas para un mismo tipo de situación, incluirlas como insumo de un análisis de conversaciones piloto, y confirmar que el resultado son recomendaciones pendientes, no un cambio directo a la configuración del agente.

**Acceptance Scenarios**:

1. **Given** un conjunto de respuestas con correcciones humanas registradas, **When** se usan como insumo de un análisis, **Then** el resultado son recomendaciones en estado pendiente, igual que cualquier otra recomendación de `014`.
2. **Given** cualquier cantidad de correcciones registradas, **When** se revisa la configuración publicada del agente, **Then** no muestra ningún cambio que no haya pasado por una publicación explícita de un humano.

### Edge Cases

- ¿Qué pasa si una respuesta se generó sin usar ninguna herramienta, estrategia o ejemplo? El sistema MUST registrar esos campos como ausentes, no como error ni con datos inventados.
- ¿Qué pasa si el registro de una respuesta falla por un problema técnico? El sistema MUST evitar que ese fallo impida el envío o la revisión de la respuesta misma — el registro es una consecuencia de la generación, no una condición para que ocurra.
- ¿Qué pasa si se intenta usar el registro de correcciones para modificar directamente la configuración publicada de un agente sin pasar por una acción humana explícita? El sistema MUST impedirlo — ninguna vía automática de esta spec MUST escribir en la configuración publicada del agente.
- ¿Qué pasa si dos evaluaciones posteriores se registran para la misma respuesta? El sistema MUST conservar ambas o dejar claro cuál es la vigente, sin perder ninguna silenciosamente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST registrar, para cada respuesta generada por el agente (enviada automáticamente o mediante revisión humana), el mensaje del cliente que la originó y la respuesta propuesta.
- **FR-002**: El sistema MUST registrar la respuesta final efectivamente enviada al cliente, distinguiendo si fue idéntica a la propuesta o si tuvo cambios.
- **FR-003**: El sistema MUST registrar, cuando existan, la estrategia comercial utilizada, los ejemplos de referencia utilizados, y las herramientas operativas ejecutadas durante la generación de una respuesta.
- **FR-004**: El sistema MUST registrar el nivel de confianza asociado a una respuesta, cuando esa información esté disponible.
- **FR-005**: El sistema MUST registrar el motivo de una transferencia a humano cuando una respuesta resulte en esa acción.
- **FR-006**: El sistema MUST registrar la versión del agente y el modelo de IA utilizados para generar cada respuesta.
- **FR-007**: El sistema MUST registrar el tiempo y el consumo (tokens/costo estimado) de cada generación de respuesta.
- **FR-008**: El sistema MUST permitir a un responsable agregar una evaluación de calidad a una respuesta ya registrada, en cualquier momento posterior a su envío.
- **FR-009**: El sistema MUST permitir usar el conjunto de correcciones registradas como insumo de un proceso de generación de recomendaciones, sin que ese uso modifique por sí mismo la configuración publicada de ningún agente.
- **FR-010**: El sistema MUST continuar generando y enviando (o dejando pendiente, según el nivel de autonomía) una respuesta aunque el registro de su traza falle por un problema técnico.
- **FR-011**: El sistema MUST restringir la consulta de estos registros al tenant al que pertenecen.

### Key Entities *(include if feature involves data)*

- **Registro de respuesta de IA**: traza completa de una respuesta generada por el agente — mensaje de origen, respuesta propuesta, respuesta final, si hubo cambios, estrategia/ejemplos/herramientas usados, confianza, motivo de transferencia si aplica, versión del agente, modelo, tiempo y consumo.
- **Evaluación posterior**: calificación de calidad agregada por un humano a un registro de respuesta ya existente, en un momento distinto al de su generación o revisión inicial.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las respuestas generadas por cualquier agente, sin importar su nivel de autonomía, quedan con un registro consultable de su traza.
- **SC-002**: Un responsable puede determinar, para cualquier respuesta registrada, si fue enviada tal cual o corregida, en un único registro, sin cruzar manualmente varias fuentes de datos.
- **SC-003**: Ninguna corrección registrada produce, por sí sola, un cambio en la configuración publicada de un agente sin una acción humana explícita de publicación.
- **SC-004**: El 100% de los registros de respuesta pertenecen a la instancia del agente que las generó, sin excepción.

## Assumptions

- Esta spec extiende (columnas aditivas) el registro ya introducido por `016-niveles-autonomia-automatizacion` para el camino de revisión humana, y lo generaliza para que también exista un registro equivalente en el camino de envío automático — no crea una segunda tabla paralela con el mismo propósito.
- "Producto identificado" se registra cuando alguna tool de producto (`buscar_productos` u otras de `015`) devolvió un resultado usado en la respuesta — es de mejor esfuerzo, no garantiza identificar un producto en cada conversación.
- El uso de correcciones como insumo de recomendaciones (Historia 3) se apoya en el proceso de análisis ya definido en `014-conversaciones-piloto-ejemplos-relevantes`; esta spec no construye un segundo motor de recomendaciones, provee el insumo adicional a ese ya existente.
- La "evaluación posterior" es una calificación simple (por ejemplo, buena/necesita mejora, más un comentario opcional) — no se define en esta spec un sistema de puntuación complejo ni multi-criterio.
