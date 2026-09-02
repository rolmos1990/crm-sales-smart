# Feature Specification: Gestión integral de transportistas — zonas, tarifas y condiciones

**Feature Branch**: `[022-transportistas-zonas-tarifas]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "necesito hacer un refactor a los transportistas para poder poblar y llenar de mas información. Necesito mejorar integralmente el módulo de transportistas de Karia App para administrar información general, zonas de cobertura, tarifas y condiciones operativas, y utilizar esa configuración al crear cotizaciones y pedidos [...] esta información utilizada por transportistas es la que puede utilizar la IA por MCP que pueda obtener la tabla por Transportistas con Precio y disponibilidad según horario, si es previo pago o contra pago [...] jamás reveles información personal del sistema a nivel de transportistas ni ID nada de esto."

## Clarifications

### Session 2026-09-01

- Q: ¿La dirección de entrega del cliente debe quedar guardada de forma reutilizable en el Contacto, o "la dirección del cliente" se refiere únicamente a los datos de destino que ya se capturan de forma independiente en cada cotización/pedido? → A: Solo destino por documento — cada cotización/pedido sigue capturando su propio destino de forma independiente, ahora con más niveles de detalle (distrito, corregimiento, sector); esta funcionalidad no agrega ningún modelo de dirección al Contacto.
- Q: ¿La configuración de cobertura país+provincia/estado ya existente (spec 019, `TransportistaCoberturaGeografica`) debe migrarse al nuevo modelo de zonas y retirarse como pantalla independiente, o debe seguir funcionando en paralelo? → A: Se reemplaza — cada cobertura país+provincia existente se migra a una zona equivalente con una tarifa "Estándar" que reproduce el mismo costo, y la pantalla/flujo de cobertura país+provincia de spec 019 se retira en favor del nuevo tab "Zonas y tarifas".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar un transportista completo: información, zonas y tarifas (Priority: P1)

Como responsable de operaciones/ventas, quiero crear rápidamente un transportista con lo mínimo (nombre, tipo, estado) y luego abrir un panel de configuración amplio donde completo sus datos de contacto, defino las zonas de entrega que cubre, y para cada zona configuro uno o varios servicios con su costo interno, precio al cliente, margen y tiempo estimado — para poder representar con precisión cómo opera cada transportista, algo que hoy el sistema no permite (solo captura nombre, tipo y una cobertura por país+provincia con un costo único).

**Why this priority**: Es el bloqueo actual — sin esto no existe ningún dato nuevo que "usar" en cotizaciones y pedidos. Es la base de todo lo demás.

**Independent Test**: Crear un transportista nuevo desde el modal rápido (nombre, tipo, estado), verificar que abre el panel de configuración; completar la pestaña Información; en Zonas y tarifas crear una zona con 2 ubicaciones, y dos tarifas para esa zona (Estándar y Express) con costo/precio distintos; guardar y verificar que el margen se calculó correctamente y ambas tarifas quedan listadas.

**Acceptance Scenarios**:

1. **Given** que estoy en el listado de transportistas, **When** creo uno nuevo indicando solo nombre, tipo y estado, **Then** el transportista se guarda y se abre automáticamente su panel de configuración completo.
2. **Given** que estoy en el panel de un transportista, **When** completo persona de contacto, teléfono, correo y notas internas y guardo, **Then** los datos quedan persistidos y visibles la próxima vez que entro al panel.
3. **Given** que estoy en la pestaña Zonas y tarifas, **When** creo una zona nueva sin salir del flujo (por ejemplo mientras configuro una tarifa), **Then** la zona queda disponible inmediatamente para seleccionarla en esa misma tarifa.
4. **Given** que una zona tiene varias ubicaciones (ej. distrito, corregimiento), **When** la guardo, **Then** todas las ubicaciones quedan asociadas a esa única zona.
5. **Given** que configuro una tarifa con costo interno $3.50 y precio al cliente $5.00, **When** la guardo, **Then** el margen mostrado es $1.50.
6. **Given** que intento guardar una tarifa con precio al cliente menor que el costo interno, **When** confirmo, **Then** el sistema me muestra una advertencia de pérdida pero permite guardar si insisto.
7. **Given** que intento crear una segunda tarifa activa para el mismo transportista, misma zona y mismo servicio, **When** guardo, **Then** el sistema rechaza el duplicado.
8. **Given** que una tarifa nunca fue usada en ninguna cotización o pedido, **When** la elimino, **Then** se borra completamente; **When** intento eliminar una que sí fue usada, **Then** el sistema solo me permite desactivarla.
9. **Given** que estoy viendo la tabla de tarifas, **When** duplico una fila, **Then** se crea una copia editable (para otra zona o servicio) sin afectar la original.
10. **Given** que reviso la pestaña Zonas y tarifas, **When** la abro, **Then** veo el costo promedio y el margen promedio de las tarifas activas.

---

### User Story 2 - Encontrar y usar automáticamente el transportista correcto al crear una cotización o pedido (Priority: P1)

Como agente de ventas, quiero que al indicar el destino de entrega el sistema identifique automáticamente la zona correspondiente y me muestre las opciones de transporte activas ordenadas de menor a mayor precio, para poder elegir rápido sin tener que memorizar qué transportista cubre cada zona.

**Why this priority**: Es la razón de negocio del refactor — configurar zonas y tarifas (Historia 1) no genera valor si el flujo de venta sigue sin usarlas.

**Independent Test**: Con al menos dos transportistas activos configurados para la misma zona con precios distintos, crear una cotización indicando un destino que cae en esa zona, y verificar que el sistema lista ambas opciones ordenadas por precio ascendente y permite elegir cualquiera.

**Acceptance Scenarios**:

1. **Given** que indico un destino que coincide con una zona configurada, **When** el sistema resuelve las opciones, **Then** veo los transportistas activos que cubren esa zona con sus servicios y precios, ordenados de menor a mayor.
2. **Given** varias opciones disponibles, **When** elijo una distinta a la sugerida por defecto, **Then** la cotización usa la que yo elegí.
3. **Given** que la zona detectada automáticamente no es correcta, **When** la cambio manualmente, **Then** el sistema recalcula las opciones para la nueva zona y registra que el cambio fue manual y quién lo hizo.
4. **Given** que el destino no coincide con ninguna zona configurada, **When** reviso la cotización, **Then** veo "Costo de entrega por confirmar" y puedo seguir cotizando sin bloqueo.
5. **Given** una cotización con costo de envío "por confirmar", **When** intento convertirla en pedido, **Then** el sistema exige confirmar el costo antes de continuar, salvo que la configuración de la empresa permita continuar sin confirmar.
6. **Given** un producto que no requiere envío (servicio o entrega digital), **When** genero su cotización, **Then** no se dispara ninguna resolución de zona/transportista.

---

### User Story 3 - Conservar los valores de envío usados al convertir una cotización en pedido (Priority: P2)

Como responsable de operaciones, quiero que al aprobar una cotización el pedido resultante guarde una copia fija de los datos de envío (transportista, zona, servicio, costo, precio, margen, tiempo, condiciones, tarifa de origen), para que cambios posteriores en las tarifas no alteren pedidos ya comprometidos con el cliente.

**Why this priority**: Es una garantía de integridad de negocio (facturación e historial), pero depende de que ya exista una tarifa que copiar (Historias 1 y 2).

**Independent Test**: Crear una cotización usando una tarifa concreta, convertirla en pedido, luego modificar o desactivar esa tarifa, y verificar que el pedido ya creado sigue mostrando los valores originales sin cambios.

**Acceptance Scenarios**:

1. **Given** una cotización con un transportista/servicio/tarifa asignados, **When** se convierte en pedido, **Then** el pedido guarda su propia copia de transportista, zona, servicio, costo interno, precio, margen, tiempo estimado, dirección de entrega, condiciones relevantes e identificador de la tarifa original.
2. **Given** un pedido ya creado, **When** la tarifa original cambia de precio o se desactiva, **Then** el pedido sigue mostrando los valores que tenía al momento de crearse.
3. **Given** que reviso un pedido, **When** abro su sección de entrega, **Then** veo con claridad el transportista, servicio, tiempo y costo usados, sin ambigüedad.

---

### User Story 4 - Consultar las condiciones operativas del transportista desde cotizaciones y pedidos (Priority: P2)

Como agente de ventas, quiero poder consultar las condiciones generales de un transportista (días de entrega, restricciones de peso, si acepta pago contra entrega, etc.) mientras trabajo en una cotización o pedido, para poder informar correctamente al cliente sin tener que salir del flujo.

**Why this priority**: Aporta valor una vez que ya existe la selección de transportista (Historia 2); es información de apoyo, no bloqueante.

**Independent Test**: Configurar condiciones operativas completas para un transportista, seleccionarlo en una cotización, y verificar que sus condiciones relevantes (días de entrega, peso máximo, pago contra entrega) se pueden consultar desde ahí.

**Acceptance Scenarios**:

1. **Given** un transportista con condiciones operativas configuradas, **When** lo selecciono en una cotización o pedido, **Then** puedo consultar sus condiciones sin salir de la pantalla.
2. **Given** que una condición (por ejemplo el tiempo de entrega) varía por zona o servicio, **When** reviso la tarifa correspondiente, **Then** encuentro ese dato ahí y no duplicado en las condiciones generales.

---

### User Story 5 - Proteger los costos internos y márgenes según permisos (Priority: P2)

Como administrador, quiero que solo el personal autorizado vea el costo interno y el margen de un envío, para que el equipo comercial sin ese permiso solo vea el precio que se le cobra al cliente.

**Why this priority**: Es un requisito de seguridad de datos financieros explícito del pedido, aplicable transversalmente a las Historias 1-4.

**Independent Test**: Con un usuario sin permiso financiero, verificar que en el listado de tarifas, en la cotización y en el pedido puede ver el precio al cliente pero no el costo interno ni el margen; con un usuario que sí tiene el permiso, verificar que ve ambos.

**Acceptance Scenarios**:

1. **Given** un usuario sin permiso financiero, **When** revisa tarifas, cotizaciones o pedidos, **Then** ve el precio al cliente pero no el costo interno ni el margen en ninguna de esas pantallas.
2. **Given** un usuario con permiso financiero, **When** revisa las mismas pantallas, **Then** ve costo interno y margen con normalidad.
3. **Given** un usuario con permiso para sobrescribir tarifas manualmente, **When** define un costo manual en una cotización, **Then** la acción se le permite y queda registrada; **When** un usuario sin ese permiso lo intenta, **Then** se le impide.

---

### User Story 6 - Auditar cambios sensibles del módulo de transportistas (Priority: P3)

Como administrador, quiero que todo cambio relevante (tarifas, activación/desactivación, condiciones, selección manual de zona, sobrescritura manual de costos) quede registrado con usuario, fecha, valor anterior y valor nuevo, para poder investigar discrepancias de precio o disponibilidad.

**Why this priority**: Es trazabilidad y confianza sobre lo que ya funciona en las historias anteriores; no bloquea el uso diario.

**Independent Test**: Modificar una tarifa, desactivar un transportista, y cambiar manualmente una zona en una cotización; verificar que las tres acciones aparecen en el registro de auditoría con usuario, fecha y valores antes/después.

**Acceptance Scenarios**:

1. **Given** que modifico el precio de una tarifa, **When** reviso el registro de auditoría, **Then** veo quién lo cambió, cuándo, el valor anterior y el nuevo.
2. **Given** que desactivo un transportista, **When** reviso el registro, **Then** la acción queda registrada de la misma forma.
3. **Given** que cambio manualmente la zona detectada en una cotización, **When** reviso el registro, **Then** queda registrado quién hizo el cambio manual.

---

### User Story 7 - Ofrecer opciones de envío al agente de IA sin exponer datos internos (Priority: P3)

Como negocio que atiende conversaciones con IA, quiero que el agente pueda consultar qué opciones de envío existen para un destino dado (transportista, servicio, tiempo estimado, precio, si es contra entrega o pago previo) para poder recomendar una opción al cliente y responder consultas de horario o retiro, sin que la respuesta exponga jamás identificadores internos, datos de contacto del transportista ni su costo interno o margen.

**Why this priority**: Es valioso pero depende de que ya exista la configuración de zonas/tarifas/condiciones (Historias 1 y 4); es un consumidor adicional del mismo dato, no la fuente.

**Independent Test**: Con zonas, tarifas y condiciones configuradas, invocar la consulta de opciones de envío para un destino cubierto y verificar que la respuesta incluye nombre público, servicio, tiempo, precio y modalidad de pago, y no incluye ningún identificador interno, teléfono, correo, notas internas, costo interno ni margen.

**Acceptance Scenarios**:

1. **Given** un destino cubierto por una o más tarifas activas, **When** se consulta la disponibilidad de envío, **Then** la respuesta lista cada opción con nombre público del transportista, servicio, tiempo estimado, precio al cliente y si acepta pago contra entrega.
2. **Given** esa misma consulta, **When** reviso su contenido, **Then** no aparece ningún ID interno de base de datos, ni teléfono, correo, persona de contacto o notas internas del transportista, ni costo interno ni margen.
3. **Given** un producto que no requiere envío (servicio o entrega digital), **When** se procesa la conversación, **Then** esta consulta no se activa.
4. **Given** un transportista de flota propia o mensajero independiente, **When** se consulta su disponibilidad, **Then** la respuesta se resuelve por zona y precio de la misma forma que para un courier externo.

### Edge Cases

- ¿Qué pasa si una zona no tiene ningún transportista activo que la cubra? El sistema MUST mostrar "Costo de entrega por confirmar" en vez de fallar.
- ¿Qué pasa si una tarifa tiene vigencia (`vigente desde/hasta`) y la fecha actual queda fuera de ese rango? MUST tratarse como no disponible para nuevas cotizaciones, igual que una tarifa inactiva.
- ¿Qué pasa si se desactiva un transportista que tiene tarifas activas? Las tarifas MUST dejar de ofrecerse en nuevas cotizaciones aunque no se borren, y los pedidos/cotizaciones ya creados con ese transportista MUST seguir mostrando su información sin cambios.
- ¿Qué pasa si dos usuarios intentan crear al mismo tiempo una tarifa duplicada (mismo transportista+zona+servicio)? El sistema MUST rechazar el duplicado aunque ambos intentos ocurran simultáneamente.
- ¿Qué pasa si el destino coincide con más de una zona configurada (zonas superpuestas)? El sistema MUST mostrar las opciones de todas las zonas coincidentes en vez de elegir arbitrariamente una sola.
- ¿Qué pasa si se intenta cambiar manualmente la zona o el transportista de un pedido ya creado (no una cotización)? MUST impedirse — el pedido es un snapshot inmutable (Historia 3); cualquier corrección se hace mediante los mecanismos existentes de gestión de pedidos, no editando el snapshot de envío.
- ¿Qué pasa con transportistas de tipo Retiro en tienda? No requieren zona de entrega ni transportista externo — MUST seguir funcionando con el flujo de ubicaciones de retiro ya existente, sin obligarlos a tener zonas/tarifas configuradas.
- ¿Qué pasa si un país no usa todos los niveles administrativos de una ubicación (por ejemplo, "corregimiento" no aplica fuera de Panamá)? Los niveles no aplicables MUST poder quedar vacíos sin impedir guardar la zona.

## Requirements *(mandatory)*

### Functional Requirements

**Transportista — información general**

- **FR-001**: El sistema MUST permitir crear un transportista solicitando únicamente nombre, tipo y estado, y abrir automáticamente su panel de configuración completo al guardar.
- **FR-002**: El sistema MUST soportar los tipos de transportista: Courier externo, Flota propia, Mensajero independiente y Retiro en tienda, preservando el comportamiento de los tipos ya existentes que no correspondan a envío físico (entrega digital, instalación/servicio).
- **FR-003**: El panel de configuración de un transportista MUST mostrar un encabezado con nombre, tipo y estado, un botón para volver al listado, un botón para guardar cambios, y pestañas separadas para Información, Zonas y tarifas, y Condiciones.
- **FR-004**: La pestaña Información MUST permitir editar nombre, tipo, estado, persona de contacto, teléfono, correo electrónico y notas internas.
- **FR-005**: El sistema MUST exigir el nombre del transportista y validar el formato de teléfono y correo únicamente cuando se proporcionen (ambos son opcionales).
- **FR-006**: Un transportista inactivo MUST NOT aparecer como opción al crear nuevas cotizaciones o pedidos.
- **FR-007**: Desactivar un transportista MUST NOT eliminar sus registros históricos (tarifas, entregas en cotizaciones/pedidos ya creados).
- **FR-008**: La pestaña Información MUST ofrecer una acción explícita para desactivar el transportista.

**Zonas de entrega (catálogo reutilizable por empresa)**

- **FR-009**: El sistema MUST mantener un catálogo de zonas de entrega reutilizable por empresa, independiente de cualquier transportista específico, de modo que varios transportistas puedan configurar tarifas para la misma zona.
- **FR-010**: Una zona MUST poder contener una o varias ubicaciones, cada una compuesta por país y, opcionalmente, provincia/estado, distrito/ciudad, corregimiento y sector/barriada/código postal.
- **FR-011**: El sistema MUST permitir crear una zona con ubicaciones de distintos niveles administrativos y países, sin limitarla a una única provincia o país.
- **FR-012**: El sistema MUST permitir crear una zona nueva sin abandonar el flujo de configuración de tarifas (creación en línea).
- **FR-013**: El sistema MUST permitir buscar zonas por nombre.

**Tarifas por transportista, zona y servicio**

- **FR-014**: La pestaña Zonas y tarifas MUST mostrar una tabla editable de tarifas con las columnas: Zona, Servicio, Costo, Precio al cliente, Margen, Tiempo de entrega, Estado y Acciones.
- **FR-015**: Cada tarifa MUST asociar transportista, zona y tipo de servicio, y registrar costo interno, precio al cliente, margen, tiempo mínimo y máximo de entrega, estado activo/inactivo y vigencia desde/hasta (opcional).
- **FR-016**: El sistema MUST ofrecer los tipos de servicio iniciales Estándar, Express y Personalizado por transportista, permitiendo que cada transportista los renombre o agregue servicios adicionales propios.
- **FR-017**: El sistema MUST permitir editar una tarifa directamente en la tabla.
- **FR-018**: El sistema MUST permitir duplicar una tarifa existente como punto de partida para una nueva (por ejemplo, para otra zona o servicio).
- **FR-019**: El sistema MUST permitir activar o desactivar una tarifa de forma independiente.
- **FR-020**: El sistema MUST permitir eliminar una tarifa únicamente si nunca fue usada en ninguna cotización o pedido; una tarifa ya utilizada solo MUST poder desactivarse.
- **FR-021**: El sistema MUST permitir aplicar un cambio de precio o condición a varias zonas a la vez para el mismo transportista y servicio.
- **FR-022**: La pestaña Zonas y tarifas MUST mostrar el costo promedio y el margen promedio de las tarifas activas del transportista.
- **FR-023**: El margen de una tarifa MUST calcularse como precio al cliente menos costo interno, y mostrarse siempre recalculado cuando cualquiera de los dos valores cambie.
- **FR-024**: El sistema MUST impedir guardar costo interno o precio al cliente con valores negativos.
- **FR-025**: El sistema MUST mostrar una advertencia (sin bloquear el guardado) cuando el precio al cliente sea menor que el costo interno.
- **FR-026**: El sistema MUST impedir que exista más de una tarifa activa para la misma combinación de transportista, zona y servicio.
- **FR-027**: Una tarifa inactiva o fuera de su vigencia MUST NOT ofrecerse como opción en nuevas cotizaciones.
- **FR-028**: Modificar, desactivar o eliminar una tarifa MUST NOT alterar los valores ya copiados en cotizaciones o pedidos existentes.

**Condiciones operativas**

- **FR-029**: La pestaña Condiciones MUST permitir configurar, para el transportista, los días de entrega, la hora límite para entrega el mismo día, el tiempo adicional de preparación y si permite entregas el mismo día.
- **FR-030**: La pestaña Condiciones MUST permitir configurar peso máximo por envío, si requiere dirección completa, si permite artículos frágiles, si permite pago contra entrega, y observaciones adicionales.
- **FR-031**: La pestaña Condiciones MUST permitir configurar el método de pago al transportista, la frecuencia de facturación, el responsable interno de coordinar y las instrucciones de coordinación.
- **FR-032**: Las condiciones operativas de un transportista MUST poder consultarse desde las pantallas de cotización y de pedido cuando ese transportista está seleccionado.
- **FR-033**: Una condición que varía por zona o servicio (por ejemplo el tiempo de entrega o el peso máximo de una tarifa específica) MUST almacenarse en la tarifa correspondiente y no duplicarse en las condiciones generales del transportista.

**Integración con direcciones**

- **FR-034**: El sistema MUST resolver la zona de entrega a partir del destino capturado de forma independiente en cada cotización o pedido (país, provincia/estado, distrito/ciudad, corregimiento, sector); esta funcionalidad MUST NOT introducir un modelo de dirección persistida y reutilizable en el Contacto — cada documento sigue registrando su propio destino.
- **FR-035**: Al registrar o seleccionar el destino de entrega, el sistema MUST intentar identificar automáticamente la zona de entrega correspondiente.
- **FR-036**: El sistema MUST buscar los transportistas activos que cubran la zona identificada, junto con sus servicios y tarifas activas y vigentes, y mostrarlos ordenados de menor a mayor precio al cliente.
- **FR-037**: El sistema MUST permitir seleccionar manualmente una opción distinta a la sugerida por defecto.
- **FR-038**: El sistema MUST permitir cambiar manualmente la zona detectada cuando la identificación automática no sea correcta, registrando quién realizó el cambio.
- **FR-039**: Si el destino no coincide con ninguna zona configurada, el sistema MUST mostrar "Costo de entrega por confirmar" sin bloquear la creación de la cotización.
- **FR-040**: El sistema MUST exigir la confirmación del costo de envío antes de convertir una cotización con costo "por confirmar" en pedido, salvo que exista una configuración empresarial que permita continuar sin esa confirmación.

**Integración con cotizaciones**

- **FR-041**: Al crear o editar una cotización, el sistema MUST mostrar la dirección de entrega, la zona identificada, el transportista, el servicio, el tiempo estimado y el precio de envío para el cliente.
- **FR-042**: El costo interno y el margen del envío MUST mostrarse únicamente a usuarios con permiso financiero (Historia 5).
- **FR-043**: El precio de envío MUST agregarse al total de la cotización como un concepto claramente identificado, igual que el costo de envío ya existente hoy.
- **FR-044**: El sistema MUST permitir, al definir el envío de una cotización, elegir entre usar una tarifa configurada, definir un costo manual (con la autorización correspondiente) o marcarlo como "por confirmar".
- **FR-045**: El sistema MUST permitir cambiar el transportista o el servicio de una cotización en cualquier momento antes de que sea aprobada/convertida en pedido.

**Integración con pedidos**

- **FR-046**: Al convertir una cotización en pedido, el sistema MUST copiar de forma inmutable el transportista, la zona, el servicio, el costo interno, el precio cobrado, el margen, el tiempo estimado, la dirección de entrega, las condiciones relevantes y el identificador de la tarifa original usada.
- **FR-047**: Los valores de envío de un pedido ya creado MUST permanecer sin cambios aunque la tarifa original se modifique, desactive o elimine posteriormente.
- **FR-048**: El pedido MUST mostrar su información de entrega de forma clara y completa.

**Seguridad y permisos**

- **FR-049**: El sistema MUST definir permisos separados para: consultar transportistas, crear transportistas, editar transportistas, configurar zonas, configurar tarifas, ver costos internos y márgenes, sobrescribir manualmente una tarifa, y desactivar transportistas.
- **FR-050**: Un usuario sin permiso para ver costos internos MUST poder ver el precio cobrado al cliente pero nunca el costo interno ni el margen, en ninguna pantalla del sistema (transportistas, cotizaciones o pedidos).

**Auditoría**

- **FR-051**: El sistema MUST registrar, con usuario, fecha, valor anterior y valor nuevo, la creación y modificación de transportistas, los cambios de tarifas, la activación/desactivación de transportistas y tarifas, las modificaciones de condiciones operativas, la selección manual de zona y la sobrescritura manual de un costo de envío.

**Compatibilidad y migración**

- **FR-052**: La migración MUST preservar todos los transportistas existentes sin pérdida de datos.
- **FR-053**: La migración MUST preservar los datos de cobertura y costo ya configurados hoy (por país y provincia/estado), sin eliminarlos.
- **FR-054**: La migración MUST convertir cada configuración de cobertura país+provincia/estado ya existente en una zona equivalente con una tarifa de servicio "Estándar" que reproduzca el mismo costo, y la pantalla/flujo de configuración de cobertura país+provincia MUST retirarse en favor del nuevo tab "Zonas y tarifas" una vez completada la migración.
- **FR-055**: Todo modelo nuevo introducido por esta funcionalidad MUST mantener aislamiento completo por empresa/instancia, igual que el resto del sistema.

**Consulta de opciones de envío para IA**

- **FR-056**: El sistema MUST exponer una consulta, utilizable por el agente de IA, de las opciones de envío disponibles para un destino dado, incluyendo por cada opción: nombre público del transportista, servicio, tiempo estimado de entrega, precio al cliente, y si acepta pago contra entrega o requiere pago previo.
- **FR-057**: Esta consulta MUST activarse únicamente para productos que requieren envío o transportista físico; MUST NOT activarse para productos de tipo servicio o entrega digital.
- **FR-058**: Para transportistas de flota propia o mensajero independiente, la consulta MUST resolverse por zona y precio de forma equivalente a como se resuelve para un courier externo.
- **FR-059**: La respuesta de esta consulta MUST NOT incluir en ningún caso identificadores internos de base de datos, teléfono, correo electrónico, persona de contacto o notas internas del transportista, ni su costo interno o margen.
- **FR-060**: Esta consulta MUST considerar únicamente transportistas y tarifas activas y vigentes al momento de la consulta.

### Key Entities *(include if feature involves data)*

- **Transportista**: proveedor de entregas de la empresa (courier externo, flota propia, mensajero independiente o retiro en tienda); ahora incluye datos de contacto operativo (persona de contacto, teléfono, correo, notas internas) además de nombre, tipo y estado.
- **Zona de entrega**: agrupación reutilizable, por empresa, de una o varias ubicaciones geográficas que se atienden de forma equivalente; no está limitada a un único país o nivel administrativo.
- **Ubicación de zona**: un punto geográfico dentro de una zona, descrito por país y, según aplique, provincia/estado, distrito/ciudad, corregimiento y sector/código postal.
- **Servicio de transportista**: modalidad de envío que ofrece un transportista concreto (por ejemplo Estándar, Express, o uno personalizado que el transportista defina).
- **Tarifa de transportista por zona y servicio**: costo interno, precio al cliente, margen, tiempo estimado de entrega, vigencia y estado, para la combinación específica de un transportista, una zona y un servicio.
- **Condiciones operativas del transportista**: reglas generales de operación, restricciones y cobro/coordinación que aplican a todas las zonas y servicios de ese transportista, salvo que una tarifa puntual indique un valor distinto.
- **Snapshot de envío**: copia congelada, guardada en el pedido al momento de su creación, de todos los datos de envío usados (transportista, zona, servicio, costo, precio, margen, tiempo, condiciones y tarifa de origen), independiente de cambios posteriores a la tarifa.
- **Registro de auditoría de transportistas**: historial de quién cambió qué, cuándo y con qué valores anteriores/nuevos, para transportistas, tarifas, condiciones y decisiones manuales (zona o costo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un responsable de operaciones puede crear un transportista con información completa, al menos dos zonas y dos servicios con tarifas configuradas, sin intervención técnica.
- **SC-002**: Cuando existe al menos una tarifa activa y vigente que cubre el destino de una cotización, el sistema sugiere automáticamente una opción de envío en el 100% de los casos.
- **SC-003**: Cuando ningún transportista cubre el destino, el 100% de las cotizaciones muestran "Costo de entrega por confirmar" en vez de bloquear o fallar el flujo de venta.
- **SC-004**: El 100% de los pedidos generados a partir de una cotización conservan sus valores de envío sin cambios, incluso después de modificar o desactivar la tarifa original.
- **SC-005**: El 0% de las pantallas del sistema (transportistas, cotizaciones, pedidos) muestran costo interno o margen a un usuario sin el permiso financiero correspondiente.
- **SC-006**: El 100% de los transportistas y configuraciones de cobertura existentes antes de esta funcionalidad siguen presentes y operativos después de la migración.
- **SC-007**: Una consulta de opciones de envío para un destino cubierto siempre devuelve, cuando corresponde, al menos una opción con nombre público, servicio, tiempo y precio, y en el 100% de los casos omite identificadores internos y datos de contacto del transportista.
- **SC-008**: Un administrador puede encontrar, para cualquier cambio de tarifa o desactivación de transportista realizado tras esta funcionalidad, quién lo hizo y cuáles fueron los valores anterior y nuevo, en menos de 3 pasos.

## Assumptions

- Los tres tipos de servicio iniciales (Estándar, Express, Personalizado) se crean como valores de partida editables por transportista, no como un catálogo global fijo — cada transportista puede renombrarlos o agregar los suyos propios, según el modelo de dominio sugerido por el usuario (`ServicioTransportista` asociado al transportista).
- "Permite pago contra entrega" es una condición operativa general del transportista (pestaña Condiciones), no un campo repetido en el transportista raíz ni en cada tarifa — evita la duplicación que la propia funcionalidad pide prevenir.
- Solo puede existir una tarifa **activa** a la vez por combinación de transportista+zona+servicio (FR-026); tarifas inactivas o con vigencia vencida para esa misma combinación pueden conservarse como historial de precios pasados sin violar esa regla.
- El campo "vigente desde/hasta" de una tarifa es opcional: una tarifa sin vigencia definida se considera vigente de forma indefinida mientras esté activa.
- La resolución automática de zona por destino puede encontrar más de una zona coincidente (zonas superpuestas); en ese caso se muestran las opciones de todas las zonas que coincidan, sin forzar una única zona "ganadora".
- Los transportistas de tipo Retiro en tienda, entrega digital o instalación/servicio (ya existentes) no requieren zonas ni tarifas para seguir funcionando — el nuevo modelo de zonas/tarifas aplica a los tipos que representan un envío físico a una dirección.
- La consulta de opciones de envío para IA (Historia 7) se implementa reutilizando el mecanismo de herramientas de IA ya existente en el proyecto (el mismo patrón usado hoy para consultas de costo de envío y cobertura), en vez de levantar infraestructura de protocolo externa nueva — es la interpretación que respeta la instrucción explícita de reutilizar los patrones ya existentes del proyecto.
- "Horario o cuándo retira" mencionado por el usuario se resuelve con los datos ya cubiertos por las condiciones operativas (días de entrega, hora límite, tiempo de preparación) y, cuando aplique, las ubicaciones de retiro ya existentes en el sistema — no se introduce un concepto nuevo de horario más allá de esos campos.
- Fuera de alcance de esta especificación: integraciones con APIs externas de transportistas (cotización en tiempo real, tracking automático, webhooks de estado), y persistir una dirección reutilizable en el Contacto (Clarificación, sesión 2026-09-01) — cada cotización/pedido sigue capturando su propio destino.
- El motor de resolución de costo ya usado por spec 019 (`resolverCostoEnvio`) MUST adaptarse para operar sobre el nuevo modelo de zonas en vez del par país+provincia/estado, dado que este último se retira (Clarificación, sesión 2026-09-01); no se introduce un motor de resolución paralelo.
