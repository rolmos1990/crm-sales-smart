# Feature Specification: Enrutamiento de modelos de IA por objetivo

**Feature Branch**: `[010-enrutamiento-modelos-ia-por-objetivo]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Debe poder configurarse diferentes IA económica (un dropdown de IA cada IA sería una integración con API), dependiendo del objetivo que necesite llamar a una IA diferente: modelo económico para clasificación de intención, extracción de datos, resumen, identificación inicial de productos, detección de sentimiento; modelo superior para conversaciones complejas, recomendaciones, clientes molestos, ambigüedad elevada, situaciones que requieren mayor razonamiento."

## Diagnóstico previo (investigación de código)

- Karia ya soporta múltiples proveedores de IA por instancia (`ProveedorIA`: Anthropic, OpenAI, Gemini, DeepSeek, NVIDIA, Local), cada uno con sus propios modelos disponibles, prioridad y costo por token — la base multi-proveedor ya existe, no hay que construirla.
- El enum `TareaIA` (`CHAT`, `RESUMEN`, `CLASIFICACION`, `SENTIMIENTO`, `EXTRACCION_ENTIDADES`, `REPORTE`, `EMBEDDINGS`) ya modela distintos objetivos de invocación y ya se registra en cada `UsoIA` — falta el enum `IDENTIFICACION_PRODUCTO` explícito que pide el usuario (hoy se solaparía con `EXTRACCION_ENTIDADES`, pero el pedido lo distingue).
- El campo `ProveedorIA.casosDeUso` (`Json?`) **existe en el schema pero no se lee ni se escribe en ningún lado del código de aplicación** (confirmado por búsqueda en todo `src/`) — es el punto de extensión pensado para esto y hoy está muerto.
- `seleccionarProveedor` (`src/ai/orquestador/orquestador.ts`) hoy solo prioriza por `TipoAgenteIA` (`COMERCIAL`/`GERENCIA`, el rol del agente) — un eje totalmente distinto al de "qué tan económico o potente debe ser el modelo para esta tarea puntual". Los dos ejes están mezclados hoy en la misma función y deben desacoplarse.
- No existe hoy ningún campo ni señal de "complejidad" de una conversación (ambigüedad, cliente molesto) en ningún punto del código — es información que en el futuro proveerá el perfil dinámico del cliente (spec `012-perfil-dinamico-cliente`, fuera de este alcance), pero esta spec debe dejar el mecanismo de enrutamiento listo para recibir esa señal cuando exista, sin bloquear su propio valor mientras tanto.
- Todos los llamadores actuales del gateway (`generarRespuesta`, `generarConHerramientas`) ya pasan `tarea: TareaIA` en cada solicitud — el dato para enrutar ya viaja hasta el punto de selección de proveedor, solo falta que se use.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Asignar qué proveedor de IA usar para cada objetivo (Priority: P1)

Como responsable de configurar la IA de mi negocio, quiero elegir desde un menú desplegable qué proveedor de IA (de los que ya tengo activos) se usa para cada objetivo — clasificación de intención, extracción de datos, resumen, identificación de productos, detección de sentimiento, conversación, recomendaciones — para poder usar modelos económicos en las tareas simples y reservar el modelo más potente (y más caro) para lo que realmente lo necesita.

**Why this priority**: Es el pedido explícito y el valor central — sin esto no hay forma de diferenciar costos por objetivo.

**Independent Test**: Con al menos dos proveedores activos configurados, asignar uno como económico para "Clasificación de intención" y otro como superior para "Conversación compleja", guardar, y verificar que la asignación queda visible y persistida.

**Acceptance Scenarios**:

1. **Given** que tengo dos o más proveedores de IA activos, **When** entro a la configuración de enrutamiento por objetivo, **Then** veo una lista de objetivos (clasificación de intención, extracción de datos, resumen, identificación de productos, detección de sentimiento, conversación, recomendaciones) cada uno con un menú desplegable de proveedores disponibles.
2. **Given** que asigno un proveedor a un objetivo y guardo, **When** vuelvo a entrar a la pantalla, **Then** la asignación sigue reflejada.
3. **Given** que no asigno explícitamente ningún proveedor a un objetivo, **When** reviso la configuración, **Then** el sistema indica claramente cuál sería el proveedor usado por defecto (comportamiento actual, sin romper nada).
4. **Given** que intento asignar un proveedor que no está activo para mi instancia, **When** intento guardar, **Then** el sistema no me lo permite y me indica que ese proveedor no está disponible.

---

### User Story 2 - El sistema usa realmente el proveedor asignado a cada objetivo (Priority: P1)

Como negocio, quiero que cuando el sistema necesite clasificar una intención, extraer datos, resumir una conversación o detectar sentimiento, efectivamente use el proveedor económico que configuré para eso, y que cuando genere una respuesta de conversación compleja o una recomendación, use el proveedor superior configurado — para que el ahorro de costos configurado en la Historia 1 se aplique de verdad, no sea solo una pantalla decorativa.

**Why this priority**: Sin este enforcement, la Historia 1 no tiene ningún efecto real — es la mitad que entrega el valor de negocio (ahorro de costos).

**Independent Test**: Configurar un proveedor de bajo costo para "Resumen" y otro para "Conversación"; disparar una tarea de resumen y una de conversación real; confirmar en el registro de uso de IA qué proveedor atendió cada una.

**Acceptance Scenarios**:

1. **Given** un proveedor económico asignado al objetivo "Clasificación de intención", **When** el sistema necesita clasificar la intención de un mensaje, **Then** la llamada se realiza usando ese proveedor.
2. **Given** un proveedor superior asignado al objetivo "Conversación compleja", **When** el sistema genera una respuesta de conversación marcada como compleja, **Then** la llamada se realiza usando ese proveedor.
3. **Given** que el proveedor asignado a un objetivo deja de estar disponible (falla o se desactiva), **When** el sistema necesita usarlo, **Then** recurre al mecanismo de resguardo ya existente (siguiente proveedor activo por prioridad) en vez de fallar sin respuesta.
4. **Given** una conversación de chat que no fue marcada como compleja, ambigua o con cliente molesto, **When** el sistema genera la respuesta, **Then** usa el proveedor configurado por defecto para conversación estándar (no necesariamente el más costoso), preservando el comportamiento actual si no hay una asignación específica configurada.

---

### User Story 3 - Ver qué proveedor atendió cada llamada y por qué (Priority: P3)

Como responsable de costos de IA de mi negocio, quiero poder ver, para cada llamada de IA registrada, qué objetivo tenía y qué proveedor la atendió, para poder auditar que el enrutamiento configurado efectivamente está ahorrando costos donde corresponde.

**Why this priority**: Es visibilidad sobre lo que ya hacen las Historias 1 y 2 — valiosa para confiar en la configuración, pero no bloquea el ahorro de costos en sí mismo.

**Independent Test**: Generar algunas llamadas de distintos objetivos y verificar en el panel de estadísticas de uso de IA que cada una muestra el objetivo y el proveedor que la atendió.

**Acceptance Scenarios**:

1. **Given** llamadas de IA ya registradas con distintos objetivos, **When** el responsable revisa el panel de uso de IA, **Then** puede ver, para cada una, el objetivo y el proveedor/modelo que la atendió.

### Edge Cases

- ¿Qué pasa si ningún proveedor está asignado a ningún objetivo (instancia recién configurada)? El sistema MUST seguir seleccionando proveedor con el criterio actual (prioridad + tipo de agente), sin exigir configuración de enrutamiento por objetivo antes de poder generar respuestas.
- ¿Qué pasa si el único proveedor activo de la instancia es el mismo para todos los objetivos? El sistema MUST permitirlo sin advertencias — no hay obligación de tener proveedores distintos por objetivo.
- ¿Qué pasa si se desactiva un proveedor que estaba asignado a uno o más objetivos? El sistema MUST seguir funcionando para esos objetivos recurriendo al resguardo existente, y MUST señalar en la configuración que esa asignación quedó inválida para que el responsable la corrija.
- ¿Qué pasa si llega una señal de "conversación compleja/cliente molesto/ambigüedad" para un objetivo que no sea conversación? La señal de complejidad MUST aplicar solo al objetivo de conversación — no tiene efecto sobre clasificación, extracción, resumen o detección de sentimiento, que siempre usan su asignación configurada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir asignar, por instancia, un proveedor de IA activo a cada uno de estos objetivos: clasificación de intención, extracción de datos, resumen, identificación inicial de productos, detección de sentimiento, conversación estándar y conversación/recomendación de mayor razonamiento.
- **FR-002**: El sistema MUST mostrar la asignación de proveedor por objetivo como un menú desplegable de selección única, poblado únicamente con los proveedores de IA activos de la instancia.
- **FR-003**: El sistema MUST impedir asignar a un objetivo un proveedor que no esté activo para la instancia.
- **FR-004**: El sistema MUST usar el proveedor asignado a un objetivo al momento de realizar cualquier llamada de IA marcada con ese objetivo, en lugar del criterio de selección genérico actual.
- **FR-005**: El sistema MUST seguir usando el criterio de selección de proveedor actual (prioridad configurada + resguardo ante fallas) para cualquier objetivo sin asignación explícita configurada, sin bloquear ni degradar el funcionamiento existente.
- **FR-006**: El sistema MUST permitir que quien invoca una generación de conversación indique explícitamente que requiere mayor capacidad de razonamiento (por ejemplo, por ambigüedad detectada o por señal de cliente molesto), y en ese caso MUST usar el proveedor asignado a "conversación/recomendación de mayor razonamiento" en vez del asignado a "conversación estándar".
- **FR-007**: El sistema MUST aplicar el mismo mecanismo de resguardo ante fallas ya existente (siguiente proveedor activo disponible) cuando el proveedor asignado a un objetivo no esté disponible al momento de la llamada.
- **FR-008**: El sistema MUST señalar visiblemente en la configuración cuando la asignación de un objetivo apunta a un proveedor que ya no está activo, para que el responsable la corrija.
- **FR-009**: El sistema MUST registrar, en el historial de uso de IA existente, el objetivo y el proveedor/modelo que efectivamente atendió cada llamada, de forma consultable.
- **FR-010**: El sistema MUST mantener el comportamiento actual de selección de proveedor para cualquier instancia que no configure ninguna asignación por objetivo tras este cambio.

### Key Entities *(include if feature involves data)*

- **Asignación de objetivo a proveedor**: vínculo, por instancia, entre un objetivo (clasificación, extracción, resumen, identificación de productos, sentimiento, conversación estándar, conversación de mayor razonamiento) y un proveedor de IA activo elegido para atenderlo.
- **Señal de complejidad de conversación**: indicador opcional, provisto por quien solicita una generación de conversación, de que esa conversación puntual requiere el proveedor de mayor razonamiento en vez del estándar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un responsable de negocio puede asignar un proveedor distinto a cada uno de los 7 objetivos definidos sin ninguna intervención técnica ni cambio de código.
- **SC-002**: El 100% de las llamadas de IA de un objetivo con proveedor asignado usan efectivamente ese proveedor, verificable en el historial de uso.
- **SC-003**: Ninguna instancia existente antes de este cambio sufre alteración en su comportamiento de selección de proveedor hasta que su responsable configure al menos una asignación.
- **SC-004**: Dado el historial de uso de IA, un responsable puede identificar el objetivo y el proveedor de cualquier llamada registrada después de este cambio en menos de 3 pasos.

## Assumptions

- Los "objetivos" de enrutamiento se apoyan en el enum `TareaIA` ya existente, extendido con un valor nuevo para "identificación inicial de productos" (hoy no distinguido de extracción de datos) y con una distinción entre conversación estándar y conversación de mayor razonamiento dentro del objetivo de chat (vía la señal de complejidad de FR-006, no como dos tareas separadas en el historial de uso salvo por el proveedor efectivamente usado).
- La determinación automática de cuándo una conversación es "ambigua" o tiene un "cliente molesto" (para activar FR-006 sin intervención humana) es responsabilidad de una spec posterior (perfil dinámico del cliente / context builder); esta spec solo entrega el mecanismo para que, dada esa señal, se enrute al proveedor correcto — no la lógica que detecta la señal.
- Un objetivo sin asignación explícita no es un error de configuración — es el estado esperado para cualquier instancia que no necesite diferenciar por costo.
- No se requiere un límite de presupuesto ni alertas de costo en esta spec — eso ya existe parcialmente a nivel de instancia (`limiteTokensDiarios`/`limiteTokensMensual` en `ConfiguracionIA`) y no se modifica.
- Fuera de alcance de esta spec: la detección automática de intención/sentimiento/ambigüedad en sí misma (son consumidores del enrutamiento, no parte de él), el perfil dinámico del cliente, y el context builder por capas — todos cubiertos por specs independientes.
