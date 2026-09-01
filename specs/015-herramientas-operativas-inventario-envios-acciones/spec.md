# Feature Specification: Herramientas operativas de inventario, envíos y acciones comerciales controladas

**Feature Branch**: `[015-herramientas-operativas-inventario-envios-acciones]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Herramientas controladas para que el agente consulte disponibilidad/cantidad/precio actual/promociones, valide combinaciones de productos; consulte métodos de entrega disponibles, calcule costo de envío, estime fecha de entrega, valide cobertura, obtenga ubicaciones de retiro, valide restricciones por producto/zona; y para acciones comerciales (crear borrador de cotización, agregar productos a oportunidad, crear borrador de pedido, solicitar intervención humana). El modelo nunca consulta la base de datos directamente. Cada herramienta valida tenant/permisos, recibe parámetros estructurados, retorna información mínima, registra su ejecución, maneja errores, y no permite acciones irreversibles sin autorización — pasar cotización/pedido a modo borrador configurable, con el comportamiento actual como default."

## Diagnóstico previo (investigación de código)

- Karia ya tiene el patrón completo para esto: `IProveedorTool`/`ToolRegistry`/`ejecutarHerramienta` (`src/ai/tools/`), con 7 tools ya funcionando y validando `instanciaId` desde el contexto del servidor, nunca desde los argumentos del LLM. Esta spec agrega tools nuevas siguiendo exactamente ese mismo patrón — no rediseña nada de la infraestructura de tools.
- `Producto` ya tiene `manejaStock`, `cantidadDisponible`, `precio`, `moneda`, `categoria` — **suficiente para disponibilidad/cantidad/precio actual sin ningún dato nuevo**. Confirmado: Karia **no tiene variantes de producto** (no existe un modelo de variante por color/talla/etc.) — las tools de esta spec operan a nivel de `Producto` completo, no de variante; el pedido original menciona "variantes" como concepto de Karia, pero no existe hoy, así que las tools no lo asumen (ver Assumptions).
- **No existe ninguna promoción** en el schema (`Producto` no tiene precio promocional, vigencia ni descuento configurado) — "consultar promociones activas" no tiene fuente de datos hoy; se deja como tool que siempre devuelve "sin promociones configuradas" hasta que exista una fuente real (fuera de este alcance, ver Assumptions).
- **No existe ninguna configuración de métodos de envío, zonas de cobertura, costos ni ubicaciones de retiro** — hoy `Cotizacion.costoEnvio`/`Pedido` guardan un monto ya decidido manualmente por un humano al crear el documento, no hay ninguna tabla de tarifas ni de cobertura que una tool pueda consultar. Esta es la brecha más grande de esta spec: se necesita modelar una configuración mínima de métodos de entrega/zonas/ubicaciones de retiro **antes** de que cualquier tool pueda "consultar" algo real — sin esa configuración, el sistema no debe inventar costos ni fechas (ver Requisitos).
- `Cotizacion.estado` ya tiene `BORRADOR` como **valor por defecto del enum** (`EstadoCotizacion @default(BORRADOR)`) — confirmado que `crear_cotizacion` ya crea la cotización con ese estado. El problema real, confirmado por inspección de `crear-cotizacion.tool.ts`, no es el estado del documento sino que **el registro se crea y persiste de inmediato, visible para todo el equipo en las listas de Cotizaciones/Pipeline, sin que ningún humano lo haya revisado o confirmado** — eso es lo que la decisión de negocio ya tomada ("pasar a borrador, configurable, default = comportamiento actual") pide poder controlar.
- La decisión de negocio para esta spec ya fue tomada por el usuario antes de iniciar el plan de specs (ver `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` §9): el modo borrador de acciones comerciales es **opt-in**, y el comportamiento por defecto (creación directa, igual que hoy) **no cambia** para ningún negocio que no lo active explícitamente.
- `transferir_a_humano` ya cumple el rol de "solicitar intervención humana" pedido en esta sección — esta spec no crea una tool nueva para eso, solo confirma que sigue disponible y la documenta como parte del catálogo formal de acciones comerciales.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El agente consulta inventario y precios reales antes de responder (Priority: P1)

Como negocio, quiero que el agente consulte la disponibilidad, cantidad y precio actual de un producto directamente desde el catálogo real antes de mencionárselo a un cliente, para que nunca invente ni suponga esa información.

**Why this priority**: Es el requisito no negociable más repetido del pedido original ("no debe prometer disponibilidad, precio o entrega sin consultar") — sin estas tools, cualquier otra mejora de comportamiento queda expuesta a que el agente siga inventando datos operativos.

**Independent Test**: Con un producto con stock limitado y otro sin stock, pedirle al agente (o invocar la tool directamente) que consulte disponibilidad de ambos, y confirmar que la respuesta refleja exactamente el dato real del catálogo.

**Acceptance Scenarios**:

1. **Given** un producto con `manejaStock` activo y cantidad disponible conocida, **When** se consulta su disponibilidad, **Then** la respuesta indica si está disponible y la cantidad exacta.
2. **Given** un producto sin stock disponible, **When** se consulta su disponibilidad, **Then** la respuesta indica claramente que no hay stock, sin ambigüedad.
3. **Given** un producto que no maneja stock (servicio o digital), **When** se consulta su disponibilidad, **Then** la respuesta lo indica como disponible sin cantidad limitante, reflejando su naturaleza real.
4. **Given** cualquier producto, **When** se consulta su precio actual, **Then** la respuesta refleja el precio vigente en el catálogo en ese momento, no un valor recordado de una conversación anterior.
5. **Given** que no existe ninguna promoción configurada para un producto, **When** se consultan sus promociones activas, **Then** la respuesta indica que no hay promociones vigentes, sin inventar ninguna.

---

### User Story 2 - El agente consulta métodos de entrega, costo y cobertura reales (Priority: P2)

Como negocio, quiero configurar mis métodos de entrega disponibles, sus costos y zonas de cobertura, para que el agente pueda consultarlos y nunca invente un costo de envío, una fecha estimada o si cubre una zona.

**Why this priority**: Es el segundo requisito no negociable explícito del pedido — depende de que exista una configuración real de métodos/zonas/costos (que hoy no existe), por eso es P2 y no P1: primero hay que modelar la fuente de verdad antes de poder consultarla.

**Independent Test**: Configurar al menos dos métodos de entrega con costos distintos y una zona sin cobertura; consultar costo de envío para una zona cubierta y para una no cubierta, y confirmar que la respuesta refleja exactamente lo configurado.

**Acceptance Scenarios**:

1. **Given** métodos de entrega configurados para la instancia, **When** se consultan los disponibles, **Then** la respuesta lista exactamente los configurados como activos.
2. **Given** una zona con cobertura y costo configurados, **When** se calcula el costo de envío para esa zona, **Then** la respuesta refleja el costo configurado, no un valor inventado.
3. **Given** una zona sin cobertura configurada, **When** se valida la cobertura, **Then** la respuesta indica claramente que no hay cobertura para esa zona.
4. **Given** un método de entrega con tiempo estimado configurado, **When** se estima la fecha de entrega, **Then** la respuesta se basa en ese tiempo configurado, nunca en una suposición.
5. **Given** ubicaciones de retiro configuradas y activas, **When** se consultan, **Then** la respuesta lista exactamente las configuradas.
6. **Given** que no existe ninguna configuración de métodos de entrega para la instancia, **When** se consulta cualquiera de estas tools, **Then** la respuesta indica que no hay información configurada, sin inventar ni bloquear la conversación.

---

### User Story 3 - Las acciones comerciales del agente respetan el modo de confirmación configurado (Priority: P1)

Como negocio, quiero decidir si las cotizaciones y pedidos que el agente genera se crean directamente (como ya funciona hoy) o quedan pendientes de confirmación humana antes de considerarse definitivas, para poder mantener el comportamiento actual o exigir más control según lo necesite.

**Why this priority**: Es el requisito de autorización sobre acciones irreversibles pedido explícitamente, resuelto según la decisión de negocio ya tomada — mismo nivel de prioridad que la Historia 1 porque protege directamente contra el riesgo ya identificado en el diagnóstico previo.

**Independent Test**: Con el modo de confirmación desactivado (default), generar una cotización vía el agente y confirmar que se comporta exactamente igual que hoy; con el modo activado, generar otra y confirmar que queda marcada como pendiente de confirmación humana antes de considerarse parte del flujo comercial normal.

**Acceptance Scenarios**:

1. **Given** que un negocio no activó el modo de confirmación humana, **When** el agente crea una cotización o un pedido, **Then** se comporta exactamente igual que antes de esta spec — sin ningún cambio observable.
2. **Given** que un negocio activó el modo de confirmación humana, **When** el agente crea una cotización o un pedido, **Then** el documento queda marcado de forma visible como generado por IA y pendiente de confirmación, sin perder ninguno de sus datos.
3. **Given** un documento generado por IA pendiente de confirmación, **When** un humano lo revisa y confirma, **Then** pasa a comportarse como cualquier documento normal del flujo comercial.
4. **Given** que el agente necesita agregar productos a una oportunidad existente, **When** ejecuta esa acción, **Then** los productos quedan asociados a la oportunidad, siguiendo las mismas reglas de validación que ya aplican cuando lo hace un humano.
5. **Given** que el agente no puede resolver la situación o el cliente lo solicita explícitamente, **When** invoca la solicitud de intervención humana, **Then** la conversación queda marcada para atención humana, igual que ya sucede hoy.

### Edge Cases

- ¿Qué pasa si se consulta disponibilidad, precio o método de entrega de un producto/configuración de otra instancia? El sistema MUST rechazarlo — aislamiento multi-tenant sin excepción, igual que las tools existentes.
- ¿Qué pasa si una herramienta operativa falla (error de base de datos, timeout)? El sistema MUST devolver un error controlado a quien la invocó, sin exponer detalles internos, y sin interrumpir el resto de la conversación.
- ¿Qué pasa si se intenta crear una cotización o un pedido con datos incompletos o inválidos? El sistema MUST rechazar la acción con un error claro, igual criterio de validación que ya aplican las tools existentes.
- ¿Qué pasa si el modo de confirmación humana se desactiva después de tener documentos pendientes de confirmación ya creados? Esos documentos MUST conservar su estado de pendiente de confirmación hasta que un humano los revise explícitamente — desactivar el modo no confirma retroactivamente nada.
- ¿Qué pasa si se pide validar una combinación de productos donde uno de ellos no existe o está inactivo? El sistema MUST señalarlo como una combinación inválida, sin fallar de forma opaca.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST proveer una herramienta para consultar la disponibilidad y cantidad disponible de un producto, basada en su estado real de inventario.
- **FR-002**: El sistema MUST proveer una herramienta para consultar el precio actual de un producto, siempre desde el catálogo vigente.
- **FR-003**: El sistema MUST proveer una herramienta para consultar promociones activas de un producto, devolviendo la ausencia de promociones cuando no exista ninguna configurada, sin inventar ninguna.
- **FR-004**: El sistema MUST proveer una herramienta para validar si una combinación de productos solicitada es válida (todos existen, están activos, y son combinables según las reglas ya existentes del catálogo).
- **FR-005**: El sistema MUST permitir configurar, por instancia, los métodos de entrega disponibles, su costo, su tiempo estimado de entrega, y las zonas donde tienen o no cobertura.
- **FR-006**: El sistema MUST permitir configurar, por instancia, ubicaciones de retiro disponibles.
- **FR-007**: El sistema MUST proveer herramientas para consultar los métodos de entrega disponibles, calcular el costo de envío para una zona, estimar la fecha de entrega, validar cobertura de una zona, y obtener las ubicaciones de retiro configuradas — todas basadas exclusivamente en la configuración real de la instancia.
- **FR-008**: El sistema MUST indicar claramente cuando no existe configuración de métodos de entrega/zonas/ubicaciones para una instancia, sin inventar valores por defecto genéricos.
- **FR-009**: El sistema MUST permitir configurar, por agente, si las acciones comerciales que crean cotizaciones o pedidos requieren confirmación humana antes de considerarse parte del flujo comercial normal, con la creación directa (comportamiento actual) como valor por defecto.
- **FR-010**: Cuando el modo de confirmación humana está activo, el sistema MUST marcar de forma visible cualquier cotización o pedido creado por el agente como generado por IA y pendiente de confirmación.
- **FR-011**: El sistema MUST permitir a un humano confirmar un documento generado por IA pendiente de confirmación, tras lo cual deja de estar marcado como pendiente.
- **FR-012**: El sistema MUST proveer una herramienta para agregar productos a una oportunidad existente, aplicando las mismas validaciones que ya rigen esa operación cuando la realiza un humano.
- **FR-013**: El sistema MUST mantener disponible la herramienta de solicitar intervención humana ya existente, sin cambios en su comportamiento.
- **FR-014**: Cada herramienta operativa nueva MUST validar el tenant y los permisos del contexto de ejecución antes de retornar cualquier dato, exactamente igual que las herramientas ya existentes.
- **FR-015**: Cada herramienta operativa nueva MUST registrar su ejecución de forma auditable, sin incluir datos sensibles innecesarios en ese registro.
- **FR-016**: El sistema MUST mantener el comportamiento actual de creación directa de cotizaciones y pedidos para cualquier agente que no active explícitamente el modo de confirmación humana.

### Key Entities *(include if feature involves data)*

- **Configuración de método de entrega**: por instancia, un método de entrega disponible, su costo base, tiempo estimado, y estado activo/inactivo.
- **Zona de cobertura**: asociada a uno o más métodos de entrega, indica si una zona está cubierta y su costo/tiempo adicional si corresponde.
- **Ubicación de retiro**: dirección y estado activo/inactivo, disponible para consulta cuando el método de entrega lo permite.
- **Marca de generación por IA**: indicador en una cotización o pedido de que fue creado por el agente y, si el modo de confirmación está activo, si sigue pendiente o ya fue confirmado por un humano.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las respuestas del agente sobre disponibilidad, precio o promoción de un producto coinciden exactamente con el estado real del catálogo al momento de la consulta.
- **SC-002**: Ninguna respuesta del agente sobre costo de envío, cobertura o fecha estimada de entrega se genera sin haber consultado la configuración real de la instancia.
- **SC-003**: El 100% de los negocios que no activan el modo de confirmación humana no experimentan ningún cambio de comportamiento en la creación de cotizaciones/pedidos por el agente.
- **SC-004**: El 100% de los documentos creados por el agente bajo el modo de confirmación humana quedan identificables como pendientes hasta que un humano los confirma explícitamente.
- **SC-005**: Ninguna herramienta operativa nueva permite consultar o modificar datos de una instancia distinta a la del agente que la invoca.

## Assumptions

- Karia no tiene hoy variantes de producto (color, talla, etc.) — las herramientas de esta spec operan sobre `Producto` completo. Si Karia agrega variantes en el futuro, extender estas herramientas es trabajo de una spec posterior, no de esta.
- No existe hoy ningún dato de promociones — la herramienta de promociones se entrega funcional pero siempre devolverá "sin promociones" hasta que exista una fuente real de datos de promociones (fuera de este alcance).
- La configuración de métodos de entrega, zonas de cobertura y ubicaciones de retiro es información nueva que cada negocio deberá cargar — esta spec construye dónde y cómo se configura, no migra datos existentes (no existían).
- "Modo de confirmación humana" se implementa marcando el documento (cotización/pedido) como generado por IA y pendiente, reutilizando el estado `BORRADOR` ya existente como parte de ese flujo — no se introduce un tipo de documento paralelo a `Cotizacion`/`Pedido`.
- La automatización de cuándo un agente debe pedir confirmación por intención (recomendaciones, precios, disponibilidad, cotizaciones, etc. mantenidos "supervisados") corresponde a `016-niveles-autonomia-automatizacion`; esta spec entrega el mecanismo de marca/confirmación sobre el documento, no la política de cuándo automatizar el envío de la respuesta al cliente.
- Fuera de alcance: cálculo de impuestos por zona, múltiples monedas por método de entrega, y logística de transportistas externos más allá de lo que Karia ya modela hoy (`Transportista`, sin cambios).
