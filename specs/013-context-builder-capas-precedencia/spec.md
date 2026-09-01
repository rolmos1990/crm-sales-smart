# Feature Specification: Construcción del contexto de IA por capas con precedencia

**Feature Branch**: `[013-context-builder-capas-precedencia]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Crear un AgentContextBuilder/PromptComposer con capas independientes: políticas globales de seguridad, identidad y comportamiento del agente, reglas del negocio, playbook activo, perfil dinámico del cliente, estado de la conversación, datos conocidos/faltantes, información operativa verificada, ejemplos piloto relevantes, herramientas permitidas, instrucción final. Con precedencia clara: políticas de Karia > reglas obligatorias del negocio > configuración del agente > estrategia comercial > preferencias del cliente > ejemplos recuperados. Una conversación piloto nunca puede sobrescribir una regla obligatoria."

## Diagnóstico previo (investigación de código)

- Karia ya compone el prompt en capas de forma procedural en `src/ai/prompt/builder.ts` (`construirSystemPrompt`) y ensambla contexto adicional en `src/ai/contexto/constructor.ts` (`construirContexto`) — la idea de "capas" no es nueva, pero hoy vive como una secuencia de `if` que concatena strings, sin una estructura explícita de capas nombradas ni de precedencia documentada en código (solo en comentarios).
- Tras las specs `009` (reglas/identidad estructuradas del agente + versionado), `011` (playbook/estrategia con selector explicable) y `012` (perfil dinámico del cliente), existen tres fuentes de contenido que **hoy no están conectadas entre sí en el flujo real de generación**: el selector de `011` calcula una estrategia pero nada la inserta en el prompt; el servicio de `012` calcula un perfil pero nada lo consulta antes de generar una respuesta. Esta spec es, en esencia, el punto de integración que las tres specs anteriores dejaron preparado a propósito para no reescribirse mutuamente.
- El bloque fijo de seguridad anti prompt-injection ya existe al final de `construirSystemPrompt` — es, de hecho, la única capa que hoy ya tiene una precedencia implícita clara (siempre al final, siempre presente, sin poder desactivarse). Esta spec formaliza ese mismo criterio para todas las demás capas.
- `resolverDecisionContexto` (`src/ai/contexto/router.ts`) ya decide cuántos mensajes de conversación incluir según presupuesto de tokens — esa lógica de presupuesto se mantiene y se generaliza a las capas nuevas (una capa vacía o sin datos disponibles simplemente no ocupa espacio, igual que ya ocurre hoy con `especialidad`/`instrucciones` cuando están vacías).
- Dos de las once capas pedidas no tienen todavía ninguna fuente de datos real en Karia: "ejemplos piloto relevantes" (spec `014`, no implementada aún) e "información operativa verificada" más allá de lo que las tools actuales ya devuelven (spec `015`, no implementada aún). Esta spec debe dejar esas dos capas definidas como puntos de extensión explícitos y vacíos por ahora, no simularlas ni inventar contenido — de modo que `014` y `015` solo tengan que registrar su capa, sin tocar el orden ni la precedencia ya establecidos acá.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El prompt se compone en capas nombradas con precedencia verificable (Priority: P1)

Como responsable técnico de Karia, quiero que el prompt final que recibe el proveedor de IA se arme a partir de capas claramente identificadas y en un orden de precedencia fijo y documentado, para poder razonar, depurar y extender el comportamiento del agente sin tener que leer una cadena de concatenaciones de texto.

**Why this priority**: Es el refactor base — sin una estructura de capas explícita, no hay forma confiable de conectar `011` y `012` al prompt real, ni de agregar `014`/`015` después sin volver a tocar todo.

**Independent Test**: Generar el prompt de un agente con configuración de `009` ya definida (reglas, identidad) y confirmar que el resultado es textualmente idéntico al que producía el sistema antes de esta spec para ese mismo agente (sin estrategia ni perfil disponibles todavía).

**Acceptance Scenarios**:

1. **Given** un agente con identidad, comunicación y reglas configuradas (spec `009`) pero sin ninguna estrategia asignada ni perfil de cliente disponible, **When** se genera su prompt, **Then** el contenido y el orden son equivalentes a los que producía el sistema antes de esta spec para ese mismo agente.
2. **Given** el prompt generado para cualquier agente, **When** se inspecciona su estructura interna (no el texto final, sino cómo se construyó), **Then** cada sección es atribuible a una capa nombrada de la lista de once, en el orden de precedencia documentado.
3. **Given** una capa sin contenido disponible (por ejemplo, sin estrategia seleccionada), **When** se genera el prompt, **Then** esa capa no ocupa espacio ni dejan un espacio vacío o un placeholder visible en el resultado final.

---

### User Story 2 - La estrategia seleccionada y el perfil del cliente se incorporan de verdad al prompt (Priority: P1)

Como negocio que configuró playbooks (`011`) y que ya cuenta con perfiles de cliente calculados (`012`), quiero que esa información se use de verdad al generar cada respuesta — no solo que exista en sus propias pantallas — respetando siempre que ninguna estrategia o dato del cliente puede anular una regla obligatoria del agente.

**Why this priority**: Es el valor de negocio que unifica todo el trabajo previo — sin esto, `011` y `012` son capacidades aisladas sin efecto en la conversación real.

**Independent Test**: Con una estrategia seleccionada por `011` y un perfil calculado por `012` para una conversación de prueba, generar el prompt y confirmar que ambos contenidos aparecen, en el orden de precedencia correcto, y que una regla obligatoria del agente sigue presente y no contradicha.

**Acceptance Scenarios**:

1. **Given** que el selector de `011` eligió una estrategia para la conversación actual, **When** se genera el prompt, **Then** el contenido de esa estrategia aparece incluido, después de las reglas del agente y antes de las preferencias del cliente, según la precedencia documentada.
2. **Given** que existe un perfil de cliente calculado por `012` para el contacto de la conversación actual, **When** se genera el prompt, **Then** sus señales objetivas (y su interpretación, si existe) aparecen incluidas como contexto, sin mezclar lo objetivo con lo interpretado (mismo criterio de `012`).
3. **Given** una estrategia seleccionada cuyo contenido sugiere algo que contradice una regla obligatoria del agente (por ejemplo, la estrategia dice "ofrecer un descuento" y el agente tiene la regla obligatoria de no ofrecer descuentos sin aprobación), **When** se genera el prompt, **Then** la regla obligatoria del agente permanece intacta y con mayor peso posicional/textual que el contenido de la estrategia.
4. **Given** que no hay estrategia seleccionada ni perfil de cliente disponible para una conversación, **When** se genera el prompt, **Then** el sistema continúa generando una respuesta normalmente, sin error ni degradación.

---

### User Story 3 - Las capas todavía no implementadas quedan como puntos de extensión explícitos (Priority: P3)

Como responsable técnico, quiero que las capas de "ejemplos piloto relevantes" e "información operativa verificada" (que dependen de trabajo futuro) existan como posiciones reservadas y documentadas en el orden de precedencia, para que agregarlas más adelante no requiera rediseñar el orden ni tocar las capas ya integradas.

**Why this priority**: Es una garantía de mantenibilidad hacia las specs `014` y `015` — no aporta valor observable hoy, pero evita retrabajo cuando esas specs se implementen.

**Independent Test**: Confirmar en el código que existen los puntos de extensión para ambas capas, en su posición correcta, y que actualmente no producen ningún contenido (comportamiento neutro).

**Acceptance Scenarios**:

1. **Given** el orden de capas documentado, **When** se revisa la implementación, **Then** las capas de "ejemplos piloto relevantes" e "información operativa verificada" existen en su posición correspondiente y no producen contenido alguno todavía, sin afectar el resultado del prompt.

### Edge Cases

- ¿Qué pasa si dos capas intentan aportar contenido contradictorio (por ejemplo, la estrategia sugiere una acción que el perfil del cliente hace inapropiada, como recomendar algo ya comprado)? Esta spec no MUST resolver contradicciones de contenido entre capas de igual o menor precedencia que las reglas obligatorias — solo MUST garantizar que ninguna capa de menor precedencia contradice a una de mayor precedencia (en particular, nunca a las reglas obligatorias). Resolver ambigüedades de negocio entre estrategia y perfil queda fuera de este alcance.
- ¿Qué pasa si falta información para una capa que normalmente estaría presente (por ejemplo, no se pudo calcular el perfil del cliente a tiempo)? El sistema MUST continuar generando el prompt con las demás capas disponibles, sin bloquear ni fallar por la ausencia de una capa opcional.
- ¿Qué pasa con agentes ya en producción antes de esta spec? MUST seguir generando el mismo prompt que generaban antes, mientras no tengan una estrategia asignada ni dependan de un perfil de cliente que antes no se consultaba.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST componer el prompt final de cada respuesta a partir de capas identificables individualmente, correspondientes a: políticas globales de seguridad, identidad y comportamiento del agente, reglas específicas del negocio, playbook/estrategia activa, perfil dinámico del cliente, estado actual de la conversación, datos conocidos y faltantes, información operativa verificada, ejemplos piloto relevantes, herramientas permitidas, e instrucción final.
- **FR-002**: El sistema MUST aplicar el orden de precedencia: políticas de Karia > reglas obligatorias del negocio > configuración del agente > estrategia comercial > preferencias/perfil del cliente > ejemplos recuperados, de forma que ninguna capa de menor precedencia pueda quedar posicionada o redactada de forma que contradiga a una de mayor precedencia.
- **FR-003**: El sistema MUST omitir cualquier capa sin contenido disponible, sin dejar placeholders vacíos ni texto indicando ausencia de datos, salvo que esa ausencia sea en sí misma información relevante ya prevista por una capa existente (por ejemplo, "datos faltantes" es una capa que por definición describe ausencias).
- **FR-004**: El sistema MUST incorporar el contenido de la estrategia seleccionada por el selector de estrategia (`011`) en la capa correspondiente, cuando exista una selección para la conversación actual.
- **FR-005**: El sistema MUST incorporar el perfil dinámico del cliente (`012`) en la capa correspondiente, cuando exista un perfil calculado para el contacto de la conversación actual, preservando la distinción entre datos objetivos e interpretados.
- **FR-006**: El sistema MUST garantizar que una regla obligatoria del agente nunca queda anulada, contradicha o de menor peso posicional frente al contenido de una estrategia o de un perfil de cliente.
- **FR-007**: El sistema MUST mantener el comportamiento de generación de prompt sin cambios para cualquier agente sin estrategia asignada y sin perfil de cliente disponible.
- **FR-008**: El sistema MUST definir explícitamente las capas de "información operativa verificada" y "ejemplos piloto relevantes" como puntos de extensión en su posición correspondiente del orden de precedencia, sin producir contenido propio en esta spec.
- **FR-009**: El sistema MUST continuar generando una respuesta cuando cualquier capa opcional (estrategia, perfil de cliente) no esté disponible, sin bloquear el flujo de generación.

### Key Entities *(include if feature involves data)*

- **Capa de contexto**: unidad de contenido con nombre, posición de precedencia fija, y una función que produce texto (o nada) a partir de los datos disponibles para esa solicitud de generación.
- **Contexto compuesto**: el resultado ordenado de aplicar todas las capas disponibles para una solicitud de generación concreta, previo a convertirse en el prompt final enviado al proveedor de IA.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El prompt generado para cualquier agente sin estrategia ni perfil de cliente disponible es textualmente idéntico al que se generaba antes de esta spec.
- **SC-002**: El 100% de las selecciones de estrategia realizadas por `011` para una conversación real se reflejan en el prompt generado para esa conversación.
- **SC-003**: El 100% de los perfiles de cliente calculados por `012` para un contacto se reflejan en el prompt generado en la siguiente respuesta a ese contacto.
- **SC-004**: Ninguna combinación de estrategia y perfil de cliente logra que una respuesta generada contradiga una regla obligatoria del agente, verificable por revisión de una muestra de prompts generados.
- **SC-005**: Agregar contenido a las capas reservadas de "ejemplos piloto" o "información operativa verificada" (en specs futuras) no requiere modificar el orden ni el contenido de ninguna otra capa ya implementada.

## Assumptions

- Esta spec es un refactor e integración arquitectónica sobre trabajo ya diseñado en `009`, `011` y `012` — no introduce ningún campo de configuración nuevo visible para el usuario de negocio; su valor es que lo ya configurado en esas specs empiece a tener efecto real en las respuestas generadas.
- La resolución de contradicciones de *contenido* (no de precedencia) entre capas de igual nivel queda fuera de alcance — se resuelve mediante buen diseño de las reglas obligatorias del agente (que siempre pueden acotar cualquier sugerencia de una estrategia), no mediante un mecanismo de arbitraje automático entre capas.
- Las capas de "ejemplos piloto relevantes" e "información operativa verificada" se implementan en `014-conversaciones-piloto-ejemplos-relevantes` y `015-herramientas-operativas-inventario-envios-acciones` respectivamente; esta spec solo reserva su posición y contrato de integración.
- "Herramientas permitidas" como capa ya existe de facto en el flujo actual (la lista de herramientas habilitadas del agente, ya usada por `ejecutarHerramienta`) — esta spec la formaliza como una capa nombrada dentro del mismo orden, sin cambiar cómo se determinan las herramientas permitidas hoy.
