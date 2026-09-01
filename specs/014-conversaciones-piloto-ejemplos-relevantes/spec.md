# Feature Specification: Conversaciones piloto y recuperación de ejemplos relevantes

**Feature Branch**: `[014-conversaciones-piloto-ejemplos-relevantes]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Permitir seleccionar conversaciones existentes como ejemplos piloto (positivo/negativo, anonimizadas, etiquetadas, con explicación, incluidas/excluidas del perfil del agente). Analizar las seleccionadas para producir recomendaciones de comportamiento (no cambios automáticos) que el administrador aprueba/modifica/rechaza/convierte en regla o ejemplo. No enviar todas las conversaciones piloto en cada solicitud al modelo — recuperar entre 2 y 4 ejemplos relevantes según intención/tipo de cliente/estrategia/producto/estado comercial/similitud semántica/calidad, respetando tenant/agente/negocio, con abstracción lista para embeddings a futuro."

## Diagnóstico previo (investigación de código)

- Karia no tiene hoy ningún mecanismo de few-shot, memoria de ejemplos, ni proceso de análisis de conversaciones pasadas — es una capacidad nueva de punta a punta. El modelo `MemoriaAgenteIA` (episódico/semántico/procedural) existe en el schema pero está confirmado sin uso en ningún flujo real (ver `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` §2.2) — no es la base de esto; se deja como está, sin reutilizar ni eliminar.
- `Conversacion` y `Mensaje` ya existen con todo el contenido histórico necesario para servir de fuente de una conversación piloto; `Conversacion.clasificacion` (`ClasificacionConversacion`) y el catálogo de `IntencionComercial`/`TipoRelacionCliente` ya definidos en `011` son el vocabulario natural para etiquetar una conversación piloto por intención y tipo de cliente.
- No existe ningún mecanismo de anonimización en Karia hoy — ni para este propósito ni para ningún otro. Debe construirse desde cero, y su alcance realista es sustitución determinística de los datos identificables ya conocidos del contacto (nombre, email, teléfono) en el texto de los mensajes — no una garantía de eliminar cualquier dato personal que el cliente haya escrito en texto libre (ver Assumptions).
- El context builder de `013-context-builder-capas-precedencia` ya reserva la capa 9 ("ejemplos piloto relevantes") como placeholder documentado, listo para que esta spec la complete sin reordenar nada — es la integración de salida de esta spec.
- El enrutamiento de `010` ya permite asignar un proveedor económico al objetivo de "resumen"/"clasificación" — el análisis de conversaciones piloto (generación de recomendaciones) es candidato natural a ese mismo enrutamiento, reutilizándolo en vez de crear un mecanismo de selección de modelo paralelo.
- No existe hoy infraestructura de embeddings/búsqueda vectorial en el proyecto (confirmado, sin `pgvector` ni librería de embeddings) — la recuperación de ejemplos relevantes de esta spec se construye con filtros estructurados (intención, tipo de cliente, estrategia, producto/categoría, estado comercial) más un desempate simple, dejando explícitamente una interfaz reemplazable para cuando exista una capacidad de similitud semántica real.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Marcar conversaciones reales como ejemplos piloto (Priority: P1)

Como administrador, quiero poder elegir conversaciones ya existentes, marcarlas como ejemplo positivo o negativo, anonimizarlas, etiquetarlas (intención, producto, tipo de cliente, estrategia) y explicar por qué representan una buena o mala atención, para construir una base de ejemplos reales que ayude a mejorar cómo responde el agente.

**Why this priority**: Es la base de datos sobre la que se apoya todo lo demás — sin conversaciones piloto seleccionadas no hay nada que analizar ni recuperar.

**Independent Test**: Elegir una conversación real, marcarla como ejemplo positivo, anonimizarla, etiquetarla con una intención y un tipo de cliente, escribir una explicación, e incluirla en el perfil del agente; confirmar que queda guardada con todos esos datos y sin la información identificable original visible.

**Acceptance Scenarios**:

1. **Given** una conversación existente, **When** un administrador la selecciona como piloto, **Then** puede marcarla como ejemplo positivo o negativo, agregar etiquetas de intención/producto/tipo de cliente/estrategia, y escribir una explicación.
2. **Given** una conversación marcada como piloto, **When** se anonimiza, **Then** el nombre, email y teléfono conocidos del contacto ya no aparecen en el texto guardado como ejemplo.
3. **Given** una conversación piloto ya creada, **When** el administrador la marca como excluida del perfil del agente, **Then** deja de participar en cualquier análisis o recuperación futura, sin eliminarse.
4. **Given** una conversación piloto, **When** el administrador consulta su origen, **Then** puede identificar de qué conversación real proviene sin que ese vínculo exponga datos sensibles al modelo de IA (el vínculo es solo para auditoría humana).

---

### User Story 2 - Analizar conversaciones piloto y producir recomendaciones que un humano aprueba (Priority: P2)

Como administrador, quiero que el sistema analice las conversaciones piloto seleccionadas y me proponga recomendaciones de comportamiento (patrones de tono, forma de responder, manejo de ambigüedad, técnicas de cierre, comportamientos a evitar), para poder decidir si las aprueba, las modifico, las rechazo, o las convierto en una regla o un ejemplo reutilizable — sin que el sistema cambie la configuración publicada del agente por sí solo.

**Why this priority**: Es el mecanismo de aprendizaje supervisado pedido — muy valioso, pero depende de que exista una base de conversaciones piloto (Historia 1) y no bloquea la recuperación de ejemplos (Historia 3), que puede funcionar con ejemplos ya aprobados manualmente si el análisis automático aún no corrió.

**Independent Test**: Con al menos 3 conversaciones piloto etiquetadas, ejecutar el análisis y confirmar que produce una o más recomendaciones con su descripción, regla sugerida y nivel de confianza, en estado pendiente; aprobar una y confirmar que no se aplicó ningún cambio automático a la configuración publicada del agente.

**Acceptance Scenarios**:

1. **Given** un conjunto de conversaciones piloto etiquetadas e incluidas, **When** se ejecuta el análisis, **Then** se generan una o más recomendaciones, cada una con título, descripción, regla sugerida, nivel de confianza y estado pendiente.
2. **Given** una recomendación pendiente, **When** el administrador la aprueba, **Then** la recomendación queda marcada como aprobada, pero la configuración publicada del agente no cambia automáticamente por esa acción.
3. **Given** una recomendación pendiente, **When** el administrador la rechaza, **Then** queda marcada como rechazada y no se vuelve a proponer de forma idéntica en el próximo análisis.
4. **Given** una recomendación aprobada, **When** el administrador elige convertirla en regla, **Then** se le ofrece incorporarla a las reglas estructuradas del agente (de `009`), como una acción explícita y separada de la aprobación misma.
5. **Given** una recomendación aprobada, **When** el administrador elige convertirla en ejemplo, **Then** se crea un ejemplo reutilizable a partir de la conversación piloto que la originó.
6. **Given** que una recomendación se basa en una conversación piloto cuyo contenido contradice una regla obligatoria del agente, **When** el administrador la revisa, **Then** el sistema no permite que se convierta en regla o ejemplo sin que el administrador reconozca explícitamente esa contradicción — nunca se aplica en silencio.

---

### User Story 3 - Recuperar solo los ejemplos relevantes para cada respuesta (Priority: P1)

Como negocio, quiero que el agente use entre 2 y 4 ejemplos realmente relevantes a la situación actual (no todos los ejemplos piloto disponibles) al generar una respuesta, para que el comportamiento aprendido se aplique sin inflar el costo ni la complejidad de cada solicitud a la IA.

**Why this priority**: Es el valor de negocio que hace utilizable en producción todo lo recolectado en la Historia 1 — sin esto, los ejemplos piloto son solo una base de datos sin efecto en las respuestas reales.

**Independent Test**: Con 6 o más ejemplos aprobados con etiquetas variadas, generar una respuesta para una situación con intención y tipo de cliente conocidos, y confirmar que se seleccionan entre 2 y 4 ejemplos cuyas etiquetas coinciden con la situación, no una muestra aleatoria ni el conjunto completo.

**Acceptance Scenarios**:

1. **Given** 6 o más ejemplos aprobados con etiquetas variadas, **When** se solicita una recomendación de ejemplos para una situación con intención y tipo de cliente conocidos, **Then** se devuelven entre 2 y 4 ejemplos, priorizando los que coinciden en más etiquetas (intención, tipo de cliente, estrategia activa, producto/categoría).
2. **Given** que ningún ejemplo coincide con la situación actual, **When** se solicita la recuperación, **Then** el sistema devuelve una lista vacía en vez de ejemplos irrelevantes, y la generación de respuesta continúa normalmente sin ejemplos.
3. **Given** ejemplos de una instancia distinta a la del agente que solicita, **When** se ejecuta la recuperación, **Then** esos ejemplos nunca se incluyen, sin excepción.
4. **Given** que un ejemplo fue marcado como excluido del perfil del agente (Historia 1) o su recomendación de origen fue rechazada (Historia 2), **When** se ejecuta la recuperación, **Then** ese ejemplo nunca se incluye en el resultado.

### Edge Cases

- ¿Qué pasa si una conversación seleccionada como piloto se elimina o se anonimiza mal (queda con datos identificables visibles)? El sistema MUST impedir marcarla como incluida en el perfil del agente hasta confirmar que la anonimización se aplicó.
- ¿Qué pasa si el análisis de conversaciones piloto no encuentra ningún patrón claro? El sistema MUST devolver que no hay recomendaciones nuevas, sin inventar una recomendación de baja calidad solo para mostrar algo.
- ¿Qué pasa si se solicitan ejemplos relevantes para un agente sin ningún ejemplo aprobado todavía? El sistema MUST devolver una lista vacía, sin error, y la generación de respuesta MUST continuar con normalidad.
- ¿Qué pasa si alguien intenta recuperar ejemplos de otro tenant, agente o negocio distinto al que hace la solicitud? El sistema MUST rechazarlo — ningún ejemplo de otra instancia MUST ser accesible.
- ¿Qué pasa si una misma conversación piloto queda etiquetada con una intención y un tipo de cliente que luego cambian de catálogo? El sistema MUST seguir funcionando con las etiquetas existentes hasta que un administrador las actualice explícitamente — no MUST re-etiquetar automáticamente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir seleccionar cualquier conversación existente de la instancia y marcarla como conversación piloto.
- **FR-002**: El sistema MUST permitir marcar una conversación piloto como ejemplo positivo o negativo, con una explicación en texto de por qué representa una buena o mala atención.
- **FR-003**: El sistema MUST permitir etiquetar una conversación piloto con intención, tipo de cliente, producto/categoría y estrategia relacionada.
- **FR-004**: El sistema MUST anonimizar el nombre, email y teléfono conocidos del contacto en el contenido guardado de una conversación piloto antes de que pueda incluirse en el perfil del agente.
- **FR-005**: El sistema MUST permitir incluir o excluir una conversación piloto del perfil del agente sin eliminarla.
- **FR-006**: El sistema MUST conservar una referencia al origen de cada conversación piloto, visible solo para auditoría humana, nunca expuesta al modelo de IA.
- **FR-007**: El sistema MUST permitir ejecutar un análisis sobre el conjunto de conversaciones piloto incluidas y producir recomendaciones de comportamiento, cada una con título, descripción, regla sugerida y nivel de confianza.
- **FR-008**: El sistema MUST NOT modificar automáticamente la configuración publicada de ningún agente como resultado del análisis — toda recomendación queda en estado pendiente hasta una acción humana explícita.
- **FR-009**: El sistema MUST permitir a un administrador aprobar, modificar y aprobar, rechazar, convertir en regla, convertir en ejemplo, o asociar con una estrategia específica cada recomendación.
- **FR-010**: El sistema MUST recuperar, para cada solicitud de generación de respuesta, entre 2 y 4 ejemplos aprobados relevantes según intención, tipo de cliente, estrategia activa, producto/categoría, estado comercial y calidad/aprobación del ejemplo.
- **FR-011**: El sistema MUST devolver una lista vacía de ejemplos cuando ninguno es relevante o no existe ninguno disponible, sin bloquear la generación de la respuesta.
- **FR-012**: El sistema MUST restringir la recuperación de ejemplos exclusivamente a los del mismo tenant, negocio y agente que solicita, sin excepción.
- **FR-013**: El sistema MUST excluir de la recuperación cualquier ejemplo cuya conversación piloto de origen esté marcada como excluida o cuya recomendación de origen haya sido rechazada.
- **FR-014**: El mecanismo de recuperación de ejemplos MUST estar diseñado de forma que un criterio de similitud semántica pueda incorporarse más adelante sin cambiar cómo el resto del sistema consume el resultado.

### Key Entities *(include if feature involves data)*

- **Conversación piloto**: referencia anonimizada a una conversación real, con clasificación positiva/negativa, explicación, etiquetas (intención, tipo de cliente, producto/categoría, estrategia), estado incluida/excluida, y referencia de origen solo para auditoría humana.
- **Recomendación de comportamiento**: resultado del análisis de un conjunto de conversaciones piloto — título, descripción, regla sugerida, nivel de confianza, estado (pendiente/aprobada/rechazada/convertida), y la acción tomada por el administrador.
- **Ejemplo (para recuperación)**: contenido reutilizable derivado de una conversación piloto aprobada, con las mismas etiquetas que su origen, listo para ser recuperado como referencia al generar una respuesta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede convertir una conversación real en un ejemplo piloto etiquetado y anonimizado en un solo flujo, sin pasos manuales fuera del sistema.
- **SC-002**: El 100% de las conversaciones piloto incluidas en el perfil del agente tienen el nombre, email y teléfono conocidos del contacto ya sustituidos, verificable por inspección.
- **SC-003**: Ninguna recomendación de comportamiento generada por el análisis modifica la configuración publicada de un agente sin una acción humana explícita.
- **SC-004**: Cada solicitud de generación de respuesta recibe entre 0 y 4 ejemplos, nunca el conjunto completo de ejemplos disponibles.
- **SC-005**: El 100% de los ejemplos recuperados para un agente pertenecen a su misma instancia; ningún intento de recuperar ejemplos de otro tenant tiene éxito.

## Assumptions

- La anonimización de esta spec es de mejor esfuerzo sobre los campos identificables ya conocidos del contacto (nombre, email, teléfono) — no garantiza eliminar cualquier dato personal que el cliente haya mencionado en texto libre (por ejemplo, una dirección escrita a mano en el chat); esa limitación se comunica explícitamente al administrador en la pantalla de anonimización, no se oculta.
- El análisis de conversaciones piloto (Historia 2) usa el gateway de IA ya existente (candidato natural al enrutamiento económico de `010`, dado que es una tarea de resumen/clasificación de patrones, no una conversación en tiempo real).
- La recuperación de ejemplos relevantes (Historia 3) se implementa en esta fase con filtros estructurados por etiquetas y un desempate por calidad/recencia — "similitud semántica" queda como criterio futuro habilitado por el diseño (FR-014), no implementado con embeddings en esta spec, siguiendo el pedido explícito de "comenzar con filtros y búsqueda tradicional".
- El vocabulario de intención y tipo de cliente reutiliza el catálogo cerrado ya definido en `011` (`src/ai/estrategia/tipos.ts`).
- La integración del resultado de esta spec dentro del prompt real ocurre a través de la capa 9 ("ejemplos piloto relevantes") ya reservada por `013-context-builder-capas-precedencia` — esta spec completa esa capa, no la vuelve a diseñar.
- Convertir una recomendación en "regla" (FR-009) crea una entrada en las reglas estructuradas del agente definidas por `009`, como una acción manual iniciada por el administrador — no una escritura automática fuera de ese flujo ya validado por `009`.
