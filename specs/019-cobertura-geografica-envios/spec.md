# Feature Specification: Cobertura geográfica y costos de envío por transportista y delivery

**Feature Branch**: `[019-cobertura-geografica-envios]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Datos y herramientas — Entregas necesita un ajuste general de como trabaja. Transportista se debe poder configurar al crear o al editar zonas de cobertura, esto puede ser una integracion de paises y estados disponibles y costos para cada zona. Igual si es Delivery debe poder tenerse la opción de configurar costos por Zonas aproximadas, tambien dejar muy a criterio un check que indique si hace entrega a todos lados o es por evaluación ejemplo si es una zona (tener una sección de excepciones donde no se hace la entrega). En la tarea de IA debe poder hacer match con esto para poder responder esas preguntas, es decir no se configura en la IA el transportista si no que se integra con la configuración de costos que yo tengo por envio. Muy importante que si no hay una coincidencia clara del costo debe pasar a atención humana inmediatamente. Evalua la opción que pueda ser Multipais o un Solo Pais, esto ayudara a que al momento de agregar una Cotizacion o un Pedido no tenga que escoger el Pais si no unicamente la Pronvicia/Estado y en su defecto Ciudad."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar cobertura y costos de un transportista por país y estado (Priority: P1)

Como negocio, al crear o editar un transportista quiero definir en qué países y estados/provincias tiene cobertura y cuánto cuesta el envío en cada una de esas zonas, para que el costo de envío que se informa a un cliente siempre venga de una configuración real y no de un cálculo manual improvisado.

**Why this priority**: Es el primer ajuste explícito pedido y la base de datos que todo lo demás (incluida la respuesta del agente de IA) necesita consultar — sin esto no hay una fuente de verdad geográfica que reemplace las zonas de texto libre actuales.

**Independent Test**: Crear un transportista, configurarle cobertura en al menos dos estados/provincias de un mismo país con costos distintos, y confirmar que al consultar el costo de envío para cada uno de esos estados se obtiene exactamente el costo configurado.

**Acceptance Scenarios**:

1. **Given** que se está creando un nuevo transportista, **When** se completa su configuración, **Then** el negocio puede agregar una o más zonas de cobertura eligiendo país y estado/provincia, cada una con su propio costo de envío.
2. **Given** un transportista ya existente, **When** se edita su configuración, **Then** el negocio puede agregar, modificar o quitar zonas de cobertura (país/estado y costo) sin afectar las de otros transportistas.
3. **Given** un transportista con cobertura configurada en un estado/provincia, **When** se consulta el costo de envío para ese estado/provincia, **Then** el costo devuelto coincide exactamente con el configurado.
4. **Given** un transportista sin ninguna zona configurada para un estado/provincia determinado, **When** se consulta el costo de envío para ese estado/provincia con ese transportista, **Then** el sistema indica que no tiene cobertura ahí, sin inventar un costo.
5. **Given** un transportista con cobertura en varios países, **When** se revisa su configuración, **Then** las zonas quedan organizadas de forma que se distingue claramente a qué país pertenece cada estado/provincia configurado.

---

### User Story 2 - Configurar cobertura y costos de entrega propia (Delivery) por zonas aproximadas (Priority: P1)

Como negocio que hace sus propias entregas (Delivery, sin transportista externo), quiero configurar el costo de envío por zonas aproximadas y decidir si entrego a cualquier lugar (con excepciones puntuales) o solo evalúo caso por caso ciertas zonas, para reflejar cómo realmente opero sin forzarme a un modelo formal de país/estado que no aplica a mi forma de trabajar.

**Why this priority**: Es el segundo ajuste explícito pedido, con el mismo nivel de urgencia que la configuración de transportistas — sin esto, los negocios que reparten con personal propio no tienen forma de declarar su cobertura real.

**Independent Test**: Configurar un método de entrega propia con dos zonas aproximadas y sus costos, alternar entre "entrega a todos lados" y "solo zonas evaluadas", y confirmar en cada modo que la validación de cobertura de una zona no listada responde de forma coherente con el modo activo.

**Acceptance Scenarios**:

1. **Given** un método de entrega propia (Delivery), **When** se configura, **Then** el negocio puede definir una o más zonas aproximadas (por nombre/descripción, sin exigir país/estado formal) junto con su costo de envío.
2. **Given** un método de entrega propia, **When** se configura su alcance, **Then** el negocio puede elegir entre "entrega a todos lados" o "solo zonas evaluadas caso por caso".
3. **Given** que el modo elegido es "entrega a todos lados", **When** se configura la cobertura, **Then** el negocio puede declarar una lista de zonas de excepción donde explícitamente no se hace entrega.
4. **Given** que el modo elegido es "solo zonas evaluadas caso por caso", **When** se consulta la cobertura de una zona que no está en la lista configurada, **Then** el sistema indica que esa zona requiere evaluación, sin confirmar ni rechazar la entrega automáticamente.
5. **Given** que el modo elegido es "entrega a todos lados", **When** se consulta la cobertura de una zona que sí está en la lista de excepciones, **Then** el sistema indica claramente que ahí no se hace entrega.
6. **Given** que el modo elegido es "entrega a todos lados" y la zona consultada no está en la lista de excepciones, **When** se consulta su cobertura, **Then** el sistema la confirma como cubierta.

---

### User Story 3 - El agente de IA responde costo y cobertura de envío usando la configuración real, y escala cuando no hay una coincidencia clara (Priority: P1)

Como negocio, quiero que el agente de IA calcule el costo de envío y la cobertura consultando exactamente la misma configuración de transportistas y zonas de delivery que yo cargué — sin tener una configuración separada o propia — y que, si no encuentra una coincidencia clara del costo para lo que el cliente pregunta, pase la conversación a atención humana de inmediato en lugar de aproximar o adivinar.

**Why this priority**: Es el requisito señalado como "muy importante" en el pedido original — sin esto, todo el trabajo de modelar la cobertura real (Historias 1 y 2) no evita que el agente siga inventando o aproximando costos frente al cliente.

**Independent Test**: Con transportistas y/o delivery configurados para algunas zonas y no otras, preguntarle al agente el costo de envío para una zona con configuración clara (debe responder con el costo exacto), para una zona sin ninguna configuración (debe escalar a humano), y para una zona con más de una configuración con costos distintos y sin forma de distinguir cuál aplica (debe escalar a humano).

**Acceptance Scenarios**:

1. **Given** una zona con un único transportista o método de delivery que la cubre con un costo definido, **When** el agente responde una pregunta de costo de envío para esa zona, **Then** el costo informado coincide exactamente con el configurado.
2. **Given** una zona sin ninguna configuración de cobertura que la incluya, **When** el agente intenta calcular el costo de envío, **Then** la conversación pasa a atención humana de inmediato, sin dar al cliente un número aproximado o inventado.
3. **Given** una zona en modo "solo zonas evaluadas caso por caso" (Historia 2) que no está en la lista de zonas configuradas, **When** el agente intenta calcular el costo o confirmar cobertura, **Then** la conversación pasa a atención humana de inmediato.
4. **Given** más de una configuración de costo que aplicaría a la misma zona con valores distintos, sin un criterio para elegir cuál corresponde, **When** el agente intenta calcular el costo, **Then** la conversación pasa a atención humana de inmediato en vez de promediar, elegir arbitrariamente o listar ambos como si fueran una respuesta única.
5. **Given** que el negocio modifica una zona o un costo de transportista/delivery, **When** el agente vuelve a responder una pregunta sobre esa misma zona, **Then** la respuesta refleja el valor actualizado, no uno recordado de una conversación anterior.

---

### User Story 4 - El negocio opera en un solo país o en varios, y las cotizaciones/pedidos piden solo lo necesario (Priority: P2)

Como negocio que opera en un único país, quiero que al crear una cotización o un pedido no se me pida elegir el país (solo la provincia/estado y, si aplica, la ciudad), para agilizar la carga de datos; y como negocio multipaís, quiero poder seguir seleccionando el país correspondiente cuando corresponda.

**Why this priority**: Es una mejora de eficiencia que depende de que exista primero el modelo geográfico de las Historias 1 y 3 — no bloquea la configuración de cobertura ni la respuesta del agente, por eso es P2.

**Independent Test**: Configurar un negocio como "un solo país" y confirmar que el formulario de nueva cotización/pedido no muestra selector de país, solo provincia/estado y ciudad (opcional); configurar otro negocio como "multipaís" y confirmar que sí se pide país antes de provincia/estado.

**Acceptance Scenarios**:

1. **Given** un negocio configurado como "un solo país", **When** se crea una cotización o un pedido, **Then** el formulario pide únicamente provincia/estado y, opcionalmente, ciudad — sin pedir país.
2. **Given** un negocio configurado como "multipaís", **When** se crea una cotización o un pedido, **Then** el formulario pide primero el país y luego la provincia/estado correspondiente a ese país, y opcionalmente la ciudad.
3. **Given** un negocio configurado como "un solo país", **When** se consulta el costo de envío para una cotización o pedido, **Then** el sistema usa automáticamente el país configurado del negocio para encontrar la coincidencia de cobertura, sin pedírselo al usuario.
4. **Given** las provincias/estados que se ofrecen para elegir, **When** el usuario abre el selector, **Then** solo aparecen los estados/provincias reales del país aplicable, sin texto libre que no se pueda hacer coincidir luego con la configuración de cobertura.

### Edge Cases

- ¿Qué pasa si un negocio cambia de "multipaís" a "un solo país" teniendo zonas de transportista configuradas en más de un país? El sistema MUST conservar toda la configuración existente sin eliminarla, aunque el formulario de cotización/pedido deje de pedir país (se asume el país configurado del negocio); las zonas de otros países quedan disponibles pero no alcanzables desde una cotización/pedido nuevo mientras el negocio siga en modo "un solo país".
- ¿Qué pasa si se consulta el costo de envío indicando ciudad pero solo existe configuración a nivel de provincia/estado? El sistema MUST usar el costo configurado a nivel de provincia/estado como coincidencia válida — la ciudad es un refinamiento opcional, no un requisito para encontrar coincidencia.
- ¿Qué pasa si dos transportistas distintos cubren la misma provincia/estado con costos diferentes y no hay ningún dato (por ejemplo, el método de entrega solicitado) que permita elegir entre ellos? El sistema MUST tratarlo como coincidencia no clara y, en el caso del agente de IA, pasar a atención humana en vez de elegir uno arbitrariamente.
- ¿Qué pasa si se intenta guardar una zona de cobertura de transportista sin costo o con un país/estado inválido? El sistema MUST rechazar el guardado con un error claro.
- ¿Qué pasa si un método de delivery en modo "solo zonas evaluadas caso por caso" no tiene ninguna zona configurada todavía? El sistema MUST indicar que no hay cobertura configurada, igual que si toda consulta cayera en "requiere evaluación".
- ¿Qué pasa si se declara la misma zona como zona de cobertura y también como zona de excepción para el mismo método de delivery? El sistema MUST rechazar esa configuración con un error claro, ya que es contradictoria.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir, al crear o editar un transportista, configurar una o más zonas de cobertura definidas por país y estado/provincia, cada una con su propio costo de envío.
- **FR-002**: El sistema MUST permitir que un transportista tenga zonas de cobertura en más de un país cuando el negocio opera en varios países.
- **FR-003**: El sistema MUST permitir, para un método de entrega propia (Delivery, sin transportista externo), configurar el costo de envío por zonas aproximadas definidas libremente por el negocio (sin exigir la estructura formal de país/estado usada para transportistas).
- **FR-004**: El sistema MUST permitir, para cada método de entrega propia, elegir entre dos modos de cobertura: "entrega a todos lados" (con excepciones opcionales) o "solo zonas evaluadas caso por caso".
- **FR-005**: Cuando el modo elegido es "entrega a todos lados", el sistema MUST permitir declarar una lista de zonas de excepción donde explícitamente no se realiza la entrega.
- **FR-006**: Cuando el modo elegido es "solo zonas evaluadas caso por caso", el sistema MUST tratar cualquier zona no configurada explícitamente como pendiente de evaluación, sin confirmar ni descartar cobertura automáticamente.
- **FR-007**: El sistema MUST rechazar que una misma zona quede declarada simultáneamente como zona cubierta y como zona de excepción para el mismo método de entrega propia.
- **FR-008**: El agente de IA MUST calcular costo de envío y validar cobertura consultando exclusivamente la configuración real de transportistas y métodos de entrega propia del negocio — el sistema MUST NOT mantener una configuración de transportistas o costos separada o propia de la IA.
- **FR-009**: Cuando el agente de IA no encuentra una coincidencia clara y sin ambigüedad de costo/cobertura para la ubicación consultada (sin configuración, zona pendiente de evaluación, o más de una configuración aplicable con valores distintos sin criterio para elegir), el sistema MUST transferir la conversación a atención humana de inmediato, sin informar al cliente un costo aproximado, estimado o inventado.
- **FR-010**: El sistema MUST permitir configurar, por negocio, si opera en un solo país o en varios países.
- **FR-011**: Cuando el negocio está configurado como "un solo país", los formularios de creación de cotización y de pedido MUST pedir únicamente provincia/estado y, opcionalmente, ciudad — sin pedir selección de país.
- **FR-012**: Cuando el negocio está configurado como "multipaís", los formularios de creación de cotización y de pedido MUST pedir país y luego provincia/estado correspondiente a ese país, y opcionalmente ciudad.
- **FR-013**: Las provincias/estados ofrecidos para selección en la configuración de cobertura de transportistas y en los formularios de cotización/pedido MUST provenir de un catálogo real de países y estados/provincias, no de texto libre, para que la coincidencia con la configuración de costos sea siempre determinística.
- **FR-014**: La ciudad MUST ser un dato opcional adicional bajo la provincia/estado, usado para refinar la coincidencia de zona cuando esté disponible, pero nunca requerido para encontrar una coincidencia de costo válida a nivel de provincia/estado.
- **FR-015**: El sistema MUST conservar toda la configuración de cobertura existente de un negocio al cambiar entre modo "un solo país" y "multipaís", sin eliminar datos.
- **FR-016**: El sistema MUST rechazar el guardado de una zona de cobertura de transportista que no tenga costo definido o cuyo país/estado no exista en el catálogo.

### Key Entities *(include if feature involves data)*

- **Zona de cobertura de transportista**: asociada a un transportista, definida por país y estado/provincia, con su costo de envío.
- **Zona aproximada de delivery**: asociada a un método de entrega propia, definida libremente por el negocio (nombre/descripción), con su costo de envío.
- **Modo de cobertura de delivery**: por método de entrega propia, indica si entrega a todos lados (con excepciones) o solo a zonas evaluadas caso por caso.
- **Zona de excepción de delivery**: zona donde un método en modo "entrega a todos lados" explícitamente no realiza entregas.
- **Configuración geográfica del negocio**: indica si el negocio opera en un solo país o en varios, y determina qué campos geográficos se piden al crear cotizaciones y pedidos.
- **Ubicación de entrega de cotización/pedido**: país (solo si aplica modo multipaís), provincia/estado, y ciudad opcional, capturados al crear la cotización o el pedido.
- **Catálogo de países y estados/provincias**: fuente de verdad de valores válidos para país y estado/provincia, usada tanto en la configuración de cobertura como en los formularios de cotización/pedido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los costos de envío informados por el agente de IA para una zona con configuración clara coinciden exactamente con la configuración real de transportista o delivery vigente en ese momento.
- **SC-002**: El 100% de las conversaciones donde el agente no encuentra una coincidencia clara de costo/cobertura pasan a atención humana antes de darle al cliente cualquier cifra o confirmación de cobertura.
- **SC-003**: Un negocio puede configurar la cobertura completa de un transportista para al menos dos países con múltiples estados/provincias sin necesitar soporte técnico.
- **SC-004**: El 100% de los negocios configurados como "un solo país" completan la creación de una cotización o un pedido sin que se les pida seleccionar país en ningún momento.
- **SC-005**: Un negocio de tipo delivery puede alternar entre "entrega a todos lados" y "solo zonas evaluadas caso por caso" sin perder ninguna de las zonas o costos ya cargados.
- **SC-006**: El 100% de las provincias/estados mostrados en los selectores de configuración de cobertura y de cotización/pedido corresponden a un país válido del catálogo, sin valores de texto libre no reconocibles.

## Assumptions

- "Delivery" se interpreta como el método de entrega con personal o flota propia del negocio (sin transportista externo asociado) — la misma noción que hoy distingue un envío por transportista de uno gestionado directamente por el negocio.
- El costo de envío configurado por país/estado (transportista) o por zona aproximada (delivery) es el costo final para esa zona, no un adicional que se suma a otro costo base genérico — reemplaza cualquier cálculo de costo base + adicional por zona usado previamente.
- Cuando el agente de IA transfiere la conversación a atención humana por falta de coincidencia clara de costo, reutiliza el mecanismo de transferencia a humano ya existente en el sistema, sin necesidad de un flujo de transferencia distinto.
- El catálogo de países y estados/provincias es información de referencia estándar (no editable libremente por cada negocio) — el negocio elige entre esos valores, no los inventa.
- Los negocios sin ninguna configuración de cobertura cargada todavía (transportista o delivery) siguen el mismo criterio ya establecido: el sistema indica que no hay información configurada, sin bloquear la conversación ni inventar valores por defecto.
- La reconfiguración de zonas existentes (previamente basadas en nombres de zona en texto libre) al nuevo modelo de país/estado o zona aproximada de delivery es responsabilidad de cada negocio al adoptar esta funcionalidad — esta spec no migra automáticamente configuraciones previas de texto libre a la nueva estructura.
- Fuera de alcance: cálculo de impuestos por zona, conversión de moneda entre países, y logística de transportistas externos más allá de la configuración de cobertura y costo (tracking, integración con APIs de transportistas, etc.).
