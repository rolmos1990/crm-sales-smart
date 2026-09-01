# Feature Specification: Simulador de agente y experiencia de configuración consolidada

**Feature Branch**: `[018-simulador-agente]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Diseñar una pantalla de prueba donde el administrador pueda seleccionar un agente, seleccionar/simular un cliente, cambiar tipo de relación e intención, escribir mensajes de prueba, ver la respuesta generada, el perfil del cliente usado, la estrategia seleccionada, los ejemplos recuperados, las herramientas ejecutadas, la información operativa consultada, las reglas aplicadas, el nivel de confianza, la información faltante detectada, y comparar la versión actual con un borrador. Sin enviar mensajes reales ni crear pedidos definitivos. Organizar la configuración en 10 secciones: Identidad, Comunicación, Reglas, Estrategias, Conocimiento, Conversaciones piloto, Datos y herramientas, Automatización, Simulador, Versiones."

## Diagnóstico previo (investigación de código)

- No existe hoy ninguna pantalla de prueba ni modo de simulación en Karia — toda generación de respuesta pasa por el flujo real (`generarRespuesta`/`generarConHerramientas`), que ejecuta tools reales contra la base de datos (confirmado: `crear_cotizacion`/`crear_pedido`/`agregar_productos_oportunidad` escriben registros reales; `transferir_a_humano` modifica `Conversacion.clasificacion` real). No hay hoy ningún mecanismo para "ejecutar en seco" ese mismo flujo.
- Tras las specs `009` a `017`, cada pieza del pipeline completo ya existe por separado (identidad/reglas de `009`, enrutamiento de `010`, estrategia de `011`, perfil de `012`, capas de contexto de `013`, ejemplos de `014`, tools operativas de `015`, autonomía de `016`, registro de `017`) — esta spec es la primera que **ejercita el pipeline completo de punta a punta bajo demanda**, sin que ninguna de esas piezas necesite cambiar su diseño, salvo por un punto: las tools que escriben datos reales necesitan una forma explícita de no hacerlo cuando se invocan desde el simulador.
- Cada spec anterior fue agregando su propia sub-sección a la tab "Inteligencia Artificial" de `/configuracion` de forma incremental (`009`: Identidad/Comunicación/Reglas/Versiones; `011`: Estrategias; `014`: Conversaciones piloto; `015`: Datos y herramientas — parcialmente, la configuración de entregas vive en un módulo separado; `016`: Automatización) — hoy no hay garantía de que esas sub-secciones ya convivan bajo una navegación unificada y consistente, porque cada spec se implementó de forma independiente y en el orden que el negocio decida ejecutarlas. Esta spec consolida esa navegación en las 10 secciones nombradas y agrega la única que falta por completo: "Conocimiento" (un resumen de lo que el agente sabe — instrucciones adicionales ya existentes de `009`, y qué información operativa puede consultar según `015` — sin ser una capacidad nueva, sino una vista consolidada de configuración ya existente) y "Simulador" (el foco principal de esta spec).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Probar una conversación simulada de punta a punta sin efectos reales (Priority: P1)

Como administrador, quiero elegir un agente, simular un cliente con un tipo de relación e intención específicos, escribirle mensajes de prueba, y ver la respuesta que el agente generaría — junto con el perfil de cliente usado, la estrategia seleccionada, los ejemplos recuperados, las herramientas ejecutadas, la información operativa consultada, las reglas aplicadas, el nivel de confianza y la información que falta — para poder validar y ajustar el comportamiento del agente antes de que hable con clientes reales.

**Why this priority**: Es el valor central pedido — sin esto, cada pieza construida en las specs anteriores solo puede validarse en producción real, con el riesgo que eso implica.

**Independent Test**: Simular una conversación con un tipo de cliente e intención elegidos, escribir un mensaje de prueba, y confirmar que la respuesta generada viene acompañada de todo el diagnóstico (perfil, estrategia, ejemplos, herramientas, reglas, confianza), sin que se haya enviado ningún mensaje real ni creado ningún registro comercial real.

**Acceptance Scenarios**:

1. **Given** que elijo un agente y simulo un cliente con un tipo de relación e intención específicos, **When** escribo un mensaje de prueba, **Then** veo la respuesta que el agente generaría, junto con el perfil de cliente simulado usado, la estrategia seleccionada (si aplica), los ejemplos recuperados (si aplica), las herramientas ejecutadas, la información operativa consultada, las reglas aplicadas y el nivel de confianza.
2. **Given** que el mensaje de prueba activaría una acción comercial (crear cotización, crear pedido, agregar productos a una oportunidad), **When** se ejecuta la simulación, **Then** el sistema muestra qué acción se habría tomado y con qué datos, sin crear ningún registro real en el sistema.
3. **Given** que el mensaje de prueba activaría la transferencia a un humano, **When** se ejecuta la simulación, **Then** el sistema muestra que se habría transferido y por qué motivo, sin modificar el estado real de ninguna conversación.
4. **Given** que la simulación detecta que falta información necesaria para responder con seguridad (por ejemplo, no hay un método de entrega configurado para consultar), **When** se muestra el resultado, **Then** esa ausencia queda señalada explícitamente como información faltante.
5. **Given** cualquier simulación ejecutada, **When** reviso su resultado, **Then** ninguna conversación, mensaje, cotización, pedido o cambio de estado real de mi negocio se ve afectado.

---

### User Story 2 - Cambiar el tipo de cliente simulado y ver cómo cambia el comportamiento (Priority: P2)

Como administrador, quiero poder cambiar el tipo de relación y la intención del cliente simulado sin tener que crear un contacto real, para poder comparar cómo respondería el agente ante distintos perfiles de cliente con el mismo mensaje.

**Why this priority**: Amplifica el valor de la Historia 1 al permitir comparar escenarios, pero no es indispensable para obtener valor de una sola simulación puntual.

**Independent Test**: Simular el mismo mensaje con dos tipos de relación/intención distintos y confirmar que el diagnóstico (estrategia seleccionada, tono de la respuesta) refleja la diferencia cuando corresponde.

**Acceptance Scenarios**:

1. **Given** un mismo mensaje de prueba, **When** cambio el tipo de relación o la intención simulada, **Then** puedo ejecutar la simulación de nuevo y comparar los resultados sin tener que reconfigurar el resto del escenario.

---

### User Story 3 - Comparar la versión publicada con un borrador antes de publicar (Priority: P2)

Como administrador que editó un borrador de configuración de un agente (`009`), quiero poder simular una conversación usando el borrador en vez de la versión publicada, para ver el efecto de mis cambios antes de decidir publicarlos.

**Why this priority**: Cierra el ciclo de seguridad de `009` (versionado) con una forma real de "probar antes de publicar", que hoy `009` deja como capacidad declarada pero sin una superficie de prueba concreta hasta esta spec.

**Independent Test**: Con un borrador pendiente de publicar, simular el mismo mensaje contra la versión publicada y contra el borrador, y confirmar que las respuestas y el diagnóstico pueden compararse lado a lado.

**Acceptance Scenarios**:

1. **Given** un agente con una versión publicada y un borrador con cambios, **When** ejecuto una simulación en modo "comparar", **Then** veo la respuesta y el diagnóstico generado con cada una, identificados claramente cuál corresponde a cuál.

---

### User Story 4 - Encontrar cada aspecto de configuración del agente en su sección correspondiente (Priority: P3)

Como responsable de configurar el agente, quiero que toda la configuración (identidad, comunicación, reglas, estrategias, conocimiento, conversaciones piloto, datos y herramientas, automatización, simulador, versiones) esté organizada bajo una única navegación consistente, para no tener que recordar en qué pantalla vive cada cosa.

**Why this priority**: Es una consolidación de usabilidad sobre trabajo ya construido en specs anteriores — valiosa, pero no bloquea el valor de las Historias 1-3, que pueden entregarse aunque la navegación general todavía no esté perfectamente unificada.

**Independent Test**: Abrir la configuración de un agente y confirmar que las 10 secciones existen, cada una mostrando exactamente el contenido que su spec correspondiente ya definió, sin duplicación ni contenido faltante.

**Acceptance Scenarios**:

1. **Given** que abro la configuración de un agente, **When** navego por sus secciones, **Then** encuentro Identidad, Comunicación, Reglas, Estrategias, Conocimiento, Conversaciones piloto, Datos y herramientas, Automatización, Simulador y Versiones, cada una con el contenido correspondiente ya construido por su spec de origen.

### Edge Cases

- ¿Qué pasa si se simula una conversación para un agente sin ninguna estrategia, perfil o ejemplo configurado? El sistema MUST ejecutar la simulación igual, mostrando esas secciones del diagnóstico como no aplicables, sin error.
- ¿Qué pasa si una tool operativa real (por ejemplo, consultar disponibilidad) se ejecuta durante una simulación? El sistema MUST distinguir claramente entre tools de solo lectura (que sí pueden consultar datos reales, ya que no tienen efectos secundarios) y tools que escriben datos (que MUST NOT escribir nada real durante una simulación, mostrando en su lugar qué habrían escrito).
- ¿Qué pasa si se simula un mensaje que activaría un nivel de autonomía "solo humano" o "solo sugerencia"? El sistema MUST mostrar esa decisión de autonomía como parte del diagnóstico, sin crear ninguna respuesta pendiente real en la bandeja de revisión.
- ¿Qué pasa si el proveedor de IA falla durante una simulación? El sistema MUST mostrar el error de forma clara al administrador, sin que quede ningún rastro de esa simulación fallida mezclado con datos reales de uso o auditoría.
- ¿Qué pasa si dos administradores simulan al mismo tiempo sobre el mismo agente? Cada simulación MUST ser independiente y no interferir con la del otro, dado que ninguna modifica datos reales compartidos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST proveer una pantalla donde un administrador pueda seleccionar un agente existente para simular una conversación con él.
- **FR-002**: El sistema MUST permitir definir un cliente simulado, incluyendo su tipo de relación y su intención comercial, sin requerir un contacto real existente.
- **FR-003**: El sistema MUST permitir escribir uno o más mensajes de prueba y generar la respuesta que el agente daría para cada uno, ejecutando el mismo proceso de generación que se usa con clientes reales.
- **FR-004**: El sistema MUST mostrar, junto a cada respuesta simulada, el perfil de cliente usado, la estrategia seleccionada (si aplica), los ejemplos recuperados (si aplica), las herramientas ejecutadas, la información operativa consultada, las reglas aplicadas, y el nivel de confianza asociado.
- **FR-005**: El sistema MUST señalar explícitamente cuando falta información necesaria para responder con seguridad a un mensaje simulado.
- **FR-006**: El sistema MUST NOT enviar ningún mensaje real a un cliente como resultado de una simulación.
- **FR-007**: El sistema MUST NOT crear, modificar ni eliminar ningún registro comercial real (cotización, pedido, oportunidad, clasificación de conversación) como resultado de una simulación — cualquier acción comercial que el agente hubiera tomado MUST mostrarse como una previsualización, no ejecutarse de verdad.
- **FR-008**: El sistema MUST permitir simular el mismo mensaje contra distintos tipos de relación/intención del cliente sin necesidad de reconfigurar el resto del escenario.
- **FR-009**: El sistema MUST permitir simular una conversación usando la versión publicada de un agente o su borrador pendiente, y comparar ambos resultados de forma identificable.
- **FR-010**: El sistema MUST organizar la configuración de un agente en las secciones: Identidad, Comunicación, Reglas, Estrategias, Conocimiento, Conversaciones piloto, Datos y herramientas, Automatización, Simulador, y Versiones, reutilizando el contenido ya construido por cada spec correspondiente sin duplicarlo.
- **FR-011**: El sistema MUST mantener la sección "Conocimiento" como una vista de la configuración ya existente (instrucciones adicionales del agente, información operativa a la que tiene acceso), sin introducir una capacidad de conocimiento nueva no cubierta por otras specs.

### Key Entities *(include if feature involves data)*

- **Escenario de simulación**: agente elegido, cliente simulado (tipo de relación, intención), versión del agente a usar (publicada o borrador), y la conversación de prueba (mensajes y respuestas) generada durante esa sesión de simulación — no persiste como parte de la conversación real de ningún cliente.
- **Diagnóstico de una respuesta simulada**: el mismo tipo de información que produce el registro de aprendizaje supervisado (`017`) para una respuesta real, pero generado y mostrado sin persistirse como un registro de auditoría de producción.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede ejecutar una simulación completa (elegir agente, definir cliente, escribir mensaje, ver respuesta y diagnóstico) sin ninguna intervención técnica.
- **SC-002**: El 100% de las simulaciones ejecutadas no dejan ningún registro comercial real (cotización, pedido, oportunidad, clasificación de conversación) en el sistema.
- **SC-003**: El 100% de las simulaciones ejecutadas no envían ningún mensaje real a un cliente ni a ningún canal externo.
- **SC-004**: Un administrador puede comparar la versión publicada y un borrador de un mismo agente sobre el mismo mensaje de prueba en una sola sesión de simulación.
- **SC-005**: Un administrador puede llegar a cualquiera de las 10 secciones de configuración de un agente desde un único punto de navegación, sin necesidad de recordar en qué pantalla vive cada una.

## Assumptions

- El simulador reutiliza el mismo pipeline de generación de respuesta (`010`, `011`, `012`, `013`, `014`, `015`, `016`) que el flujo real, con la única diferencia de que las tools que escriben datos reales operan en modo de previsualización — esta spec no construye una segunda implementación paralela del pipeline.
- Las tools de solo lectura (consultar disponibilidad, precio, métodos de entrega, etc.) pueden ejecutarse contra datos reales durante una simulación sin infringir FR-006/FR-007, ya que no tienen efectos secundarios — la restricción aplica específicamente a las tools que crean o modifican datos.
- El registro de una simulación (diagnóstico mostrado en pantalla) no se persiste en las mismas tablas de auditoría de producción de `017` — puede conservarse temporalmente para la sesión del administrador, pero no debe mezclarse con las métricas de uso real de IA ni con el aprendizaje supervisado basado en conversaciones reales.
- "Conocimiento" como sección de navegación consolida configuración ya existente (`009` instrucciones, `015` qué herramientas/datos operativos ve el agente) — no introduce campos ni capacidades de configuración nuevas.
- Esta spec depende de que `009` a `017` estén implementadas para mostrar su diagnóstico completo; si alguna todavía no lo está al momento de implementar esta spec, la sección correspondiente del diagnóstico se omite de forma explícita (no se simula ni se inventa), no se bloquea el resto del simulador.
