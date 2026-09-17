# Feature Specification: Preparación de pedidos — tablero operativo con estados configurables

**Feature Branch**: `[026-preparacion-pedidos]`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "ayudame a mejorar una idea tener un preparación (menu Karia). esta se encargaria de tener el control de todo lo que tengo preparado por cliente, entiendo que debe haber una funcionalidad tambien donde pueda relacionar el pedido a la preparación. Los estados son configurables, ya que hay usuarios (empresas) que solo necesitan dos estados y otras 4 estados. de alguna forma tambien este estado debe mostrarse en la lista de pedidos y en el detalle de pedidos (para saber si ya esta preparado o no). Esta vista puede ser configurable es decir, puedo decir que estados de pedido quiero que aparezcan aqui."

## Clarifications

### Session 2026-09-17

- Q: Hoy el bloque de Entrega del pedido ya tiene un estado `PREPARANDO`. ¿El nuevo eje de preparación lo reemplaza, se sincronizan, o conviven? → A: **Conviven sin tocarse** — significan cosas distintas y cada uno tiene su dueño: la *preparación* es el armado interno del pedido (qué se armó, quién lo armó, cuándo), y el *estado de entrega* es la logística del envío. Ningún movimiento en el tablero de preparación modifica el estado de entrega, ni al revés. Para que no se confundan, ambos MUST presentarse en bloques y con etiquetas claramente distintas (FR-036a).
- Q: ¿Marcar un ítem como preparado debe reservar o descontar inventario? → A: **No afecta el stock en esta feature**. Preparar es registro operativo; el inventario se sigue manejando exclusivamente donde se maneja hoy (feature 015). Se puede incorporar más adelante sin rehacer el modelo.

## Decisiones de diseño ya acordadas

Estas decisiones se tomaron con el usuario antes de escribir el spec y **no** son supuestos del agente. Se registran acá para que `/speckit-plan` las herede sin re-litigarlas.

1. **Eje propio.** Los estados de preparación son una máquina de estados nueva e independiente del Flujo de Venta. No se reutilizan las etapas del flujo. Un pedido puede estar en etapa comercial "Pagado" y, en paralelo, en estado de preparación "Preparando". Se evaluó reusar las etapas del flujo (menos duplicación) y el usuario eligió explícitamente el eje propio por independencia respecto del estado comercial.
2. **Control ítem por ítem.** El avance se registra por línea de pedido con cantidad preparada (admite parciales: "2 de 3"), no solo marcando el pedido completo.
3. **Sellado de fechas y responsable.** El inicio se sella al entrar al estado marcado como "marca inicio"; la finalización se sella al entrar al estado final; el responsable registrado es **quien movió el pedido al estado final**. Retroceder desde el estado final limpia la finalización y el responsable, dejando traza en el historial.
4. **Entrada declarativa.** Los pedidos entran al tablero por configuración (qué etapas del Flujo de Venta habilitan la preparación), no por una automatización que el usuario pueda borrar por accidente.
5. **Sin sincronización inversa.** Que terminar la preparación mueva la etapa comercial del pedido queda **fuera de alcance** de esta feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operar el tablero de preparación con los estados que mi empresa necesita (Priority: P1)

Como responsable de operaciones o preparador, quiero ver en un tablero todos los pedidos que tengo que preparar, organizados en las columnas que mi empresa definió (dos estados si mi operación es simple, cuatro o más si necesito distinguir etapas), y mover cada pedido de columna a medida que avanza — para saber en todo momento qué está preparado y qué no, algo que hoy Karia no permite registrar en ningún lado.

**Why this priority**: Es el núcleo de la funcionalidad. Sin tablero y sin estados configurables no hay nada que mostrar en pedidos ni nada que medir. Entrega valor por sí sola aunque no se construya ninguna otra historia.

**Independent Test**: Configurar un flujo de preparación con cuatro estados (Por preparar, Preparando, Preparado, Listo para despacho), abrir el tablero con pedidos reales, arrastrar un pedido de la primera a la última columna y verificar que quedan registrados el momento de inicio, el momento de finalización, el responsable y el historial completo de movimientos.

**Acceptance Scenarios**:

1. **Given** que soy una empresa nueva sin nada configurado, **When** entro por primera vez al menú Preparación, **Then** el tablero ya funciona con un flujo por defecto de dos estados y no me obliga a configurar nada antes de usarlo.
2. **Given** que mi operación necesita cuatro estados, **When** los creo con nombre, color y orden, **Then** el tablero muestra esas cuatro columnas en el orden que definí.
3. **Given** un pedido en la primera columna, **When** lo muevo a la columna marcada como "marca inicio", **Then** queda registrada la fecha y hora de inicio de preparación.
4. **Given** un pedido en preparación, **When** lo muevo al estado final, **Then** quedan registradas la fecha y hora de finalización y el usuario que lo movió como responsable de la preparación.
5. **Given** un flujo de solo dos estados donde ningún estado está marcado como "marca inicio", **When** un pedido entra al tablero, **Then** la fecha de inicio queda igual al momento en que el pedido entró al tablero (nunca vacía).
6. **Given** un pedido ya marcado como preparado, **When** lo devuelvo a una columna anterior, **Then** se limpian la finalización y el responsable, y el retroceso queda registrado en el historial.
7. **Given** cualquier movimiento de un pedido entre columnas, **When** consulto la actividad reciente, **Then** veo qué pedido se movió, desde qué estado, a qué estado, quién lo movió y cuándo.
8. **Given** que dos operarios tienen el tablero abierto, **When** ambos mueven el mismo pedido al mismo tiempo, **Then** solo se aplica el primer movimiento y el segundo recibe un aviso claro y la pantalla actualizada, sin que se pierda ni se duplique nada.
9. **Given** un pedido que llega a una etapa comercial final o de cancelación, **When** se actualiza el tablero, **Then** el pedido desaparece del tablero pero su registro de preparación (qué se preparó, cuándo y quién) se conserva.

---

### User Story 2 - Saber desde Pedidos si algo ya está preparado (Priority: P1)

Como agente de ventas atendiendo a un cliente que pregunta por su pedido, quiero ver el estado de preparación directamente en la lista de pedidos y en el detalle del pedido, sin tener que abrir otro módulo — para responder al instante si ya está preparado o todavía no.

**Why this priority**: Es un pedido explícito del usuario y el punto donde la información de preparación llega a quien atiende al cliente. Es testeable de forma independiente en cuanto exista el estado de preparación de la historia 1.

**Independent Test**: Con pedidos en distintos estados de preparación, abrir la lista de pedidos y verificar que cada uno muestra su estado de preparación diferenciado del estado comercial; abrir el detalle de uno y verificar que además se ven inicio, finalización y responsable.

**Acceptance Scenarios**:

1. **Given** un pedido que está en el tablero de preparación, **When** veo la lista de pedidos, **Then** veo su estado de preparación con su color, claramente diferenciado y subordinado visualmente al estado comercial del pedido.
2. **Given** un pedido que nunca entró a preparación, **When** veo la lista de pedidos, **Then** no se muestra ningún estado de preparación para ese pedido y la fila no pierde información respecto de hoy.
3. **Given** un pedido preparado, **When** abro su detalle, **Then** veo el estado de preparación, cuándo se inició, cuándo se completó y quién lo completó.
4. **Given** que una empresa no usa el módulo de Preparación, **When** sus usuarios ven la lista y el detalle de pedidos, **Then** la pantalla se comporta exactamente como hoy, sin columnas ni espacios vacíos añadidos.
5. **Given** un pedido con estado de preparación y con estado de entrega al mismo tiempo, **When** abro su detalle, **Then** ambos se muestran en bloques separados y con etiquetas que dejan claro que uno es el armado interno y el otro la logística del envío.

---

### User Story 3 - Controlar qué pedidos entran al tablero y cómo se ve (Priority: P2)

Como responsable de operaciones, quiero definir qué pedidos entran al tablero (según su etapa en el flujo de venta), en qué orden se muestran las columnas, qué agrupación uso por defecto y sobre qué rango de fechas trabajo — para que el tablero muestre solo lo que mi equipo tiene que preparar hoy y no todo el historial.

**Why this priority**: Sin esto el tablero funciona igual (con la configuración por defecto), pero se vuelve inmanejable en cuanto la empresa tiene volumen. Es la diferencia entre una pantalla usable y una lista infinita.

**Independent Test**: Configurar que solo los pedidos en las etapas "Confirmado" y "Pagado" entren al tablero, verificar que un pedido en etapa "Pendiente" no aparece y que al moverlo a "Confirmado" aparece automáticamente; cambiar el orden de las columnas y el rango por defecto, y verificar que se respeta al recargar.

**Acceptance Scenarios**:

1. **Given** que configuro qué etapas del flujo de venta habilitan la preparación, **When** un pedido llega a una de esas etapas, **Then** aparece automáticamente en el tablero en la primera columna.
2. **Given** un pedido en una etapa que no habilita preparación, **When** abro el tablero, **Then** el pedido no aparece.
3. **Given** que reordeno las columnas del tablero, **When** guardo y vuelvo a entrar, **Then** el orden se conserva y es independiente del orden de las etapas del flujo de venta.
4. **Given** las pestañas de rango (Hoy, Mañana, Esta semana, Personalizado), **When** selecciono una, **Then** veo solo los pedidos cuya fecha de entrega cae en ese rango, calculado en la zona horaria de mi empresa, y el contador de cada pestaña coincide con lo que se muestra.
5. **Given** un pedido sin fecha de entrega, **When** uso cualquier rango, **Then** el pedido sigue siendo visible en una agrupación "Sin fecha" y no desaparece del tablero.
6. **Given** que busco por número de pedido, nombre de cliente o nombre de producto, **When** escribo en el buscador, **Then** el tablero filtra a los pedidos que coinciden sin perder la separación por columnas.
7. **Given** un estado de preparación con pedidos asignados, **When** intento eliminarlo, **Then** el sistema lo impide; **When** lo desactivo, **Then** el sistema me exige indicar a qué estado migrar esos pedidos.
8. **Given** que una etapa del flujo de venta configurada como entrada se desactiva o elimina, **When** abro el tablero, **Then** el tablero sigue funcionando con el resto de la configuración y me avisa que esa entrada ya no es válida.

---

### User Story 4 - Controlar qué ítems están preparados y qué falta comprar/armar (Priority: P3)

Como preparador, quiero marcar el avance producto por producto dentro de cada pedido (incluso parcialmente: "preparé 2 de 3 globos") y ver un resumen consolidado de cuántas unidades de cada producto necesito para todo el rango — para preparar por lote en vez de ir pedido por pedido, y para saber exactamente qué falta.

**Why this priority**: Es lo que convierte el tablero en control real de inventario preparado en vez de un simple kanban de estados. Depende de que el tablero exista, por eso va después.

**Independent Test**: En un pedido de tres productos, marcar dos como preparados y uno parcialmente, verificar que la tarjeta refleja el avance; cambiar la agrupación a "Por producto" y verificar que el resumen consolida las unidades pendientes y preparadas de todos los pedidos del rango.

**Acceptance Scenarios**:

1. **Given** un pedido con varias líneas, **When** marco una línea como preparada, **Then** queda registrada la cantidad preparada, cuándo y quién la preparó.
2. **Given** una línea de 3 unidades, **When** registro 2 unidades preparadas, **Then** la tarjeta muestra el avance parcial y el pedido no figura como completamente preparado.
3. **Given** un rango de fechas seleccionado, **When** consulto el resumen por producto, **Then** veo por cada producto las unidades totales requeridas y cuántas ya están preparadas, sumando todos los pedidos del rango.
4. **Given** que cambio la agrupación a "Por producto", **When** veo el tablero, **Then** los pedidos se agrupan por producto en lugar de por pedido, conservando las mismas columnas de estado.
5. **Given** un pedido cuyas líneas ya estaban todas preparadas, **When** se le agrega una línea nueva por edición del pedido, **Then** el pedido vuelve a figurar con avance incompleto.
6. **Given** que intento registrar más unidades preparadas que las pedidas, **When** confirmo, **Then** el sistema lo rechaza con un mensaje claro.

---

### Edge Cases

- **Empresa sin configuración**: un tenant que nunca entró a Preparación debe encontrar el tablero funcionando con dos estados por defecto, no una pantalla vacía o un error.
- **Pedido cancelado en pleno armado**: si el pedido se cancela mientras está en una columna intermedia, sale del tablero pero su registro de preparación se conserva para auditoría.
- **Retroceso desde el estado final**: limpia finalización y responsable, pero el historial conserva ambos movimientos (quién lo cerró y quién lo reabrió).
- **Movimiento simultáneo**: dos operarios moviendo la misma tarjeta — gana el primero, el segundo ve un aviso y la pantalla actualizada.
- **Estado de preparación desactivado con pedidos dentro**: no se puede eliminar; desactivar exige estado destino para migrar los pedidos afectados.
- **Etapa de entrada eliminada del flujo de venta**: el tablero no debe romperse; la entrada inválida se ignora y se avisa en la configuración.
- **Pedido sin fecha de entrega**: visible en una agrupación "Sin fecha", nunca oculto por el filtro de rango.
- **Pedido con entrega vencida**: visible en cualquier rango y marcado como atrasado (FR-019a). Es el caso más frecuente en una instancia con operación real y el que más fácil se esconde detrás de un filtro "hacia adelante".
- **Pedidos digitales o de servicio**: entran al tablero si su etapa lo habilita, igual que los físicos; la empresa decide por configuración si quiere excluirlos eligiendo etapas distintas.
- **Pedido editado después de preparado**: agregar líneas reabre el avance; quitar líneas recalcula el avance sin borrar el historial.
- **Cliente sin contacto en el CRM**: el tablero debe mostrar igual el nombre del comprador registrado en el pedido (hoy 12 de 82 pedidos no tienen contacto asociado).
- **Pedido "preparado" pero con entrega en estado `PREPARANDO`** (o cualquier otra combinación cruzada): es un estado válido, no un error — los dos ejes son independientes y el detalle del pedido debe mostrar ambos sin sugerir contradicción.

## Requirements *(mandatory)*

### Functional Requirements

**Configuración de estados**

- **FR-001**: El sistema MUST permitir a cada empresa definir sus propios estados de preparación, con nombre, color y orden, soportando desde dos estados hasta la cantidad que la operación necesite.
- **FR-002**: El sistema MUST permitir marcar un estado como inicial (donde caen los pedidos al entrar al tablero), como "marca inicio" (sella el inicio de preparación) y como final (sella la finalización).
- **FR-003**: El sistema MUST crear un flujo de preparación por defecto con dos estados para toda empresa que no haya configurado ninguno, de modo que el módulo sea usable sin configuración previa.
- **FR-004**: El sistema MUST impedir eliminar un estado que tenga pedidos asociados, y MUST exigir un estado destino al desactivarlo para migrar los pedidos afectados.
- **FR-005**: El sistema MUST mantener el estado de preparación de un pedido independiente de su etapa en el flujo de venta: mover un pedido en un eje NO cambia el otro.

**Entrada y salida del tablero**

- **FR-006**: El sistema MUST permitir configurar qué etapas del flujo de venta habilitan la preparación de un pedido.
- **FR-007**: El sistema MUST incorporar automáticamente al tablero, en el estado inicial, todo pedido que alcance una etapa habilitada.
- **FR-008**: El sistema MUST retirar del tablero los pedidos que alcancen una etapa final o de cancelación, conservando su registro de preparación como historial.
- **FR-009**: El sistema MUST seguir funcionando cuando una etapa configurada como entrada se desactiva o elimina, ignorando esa entrada y avisándolo en la configuración.

**Operación del tablero**

- **FR-010**: Los usuarios MUST poder ver los pedidos en preparación como tablero de columnas o como lista, con la misma información en ambas vistas.
- **FR-011**: Los usuarios MUST poder mover un pedido de un estado de preparación a otro desde el tablero.
- **FR-012**: El sistema MUST sellar la fecha y hora de inicio cuando el pedido entra a un estado marcado como "marca inicio", y solo la primera vez.
- **FR-013**: El sistema MUST usar como inicio el momento de entrada al tablero cuando ningún estado esté marcado como "marca inicio".
- **FR-014**: El sistema MUST sellar la fecha y hora de finalización y registrar como responsable al usuario que movió el pedido al estado final.
- **FR-015**: El sistema MUST limpiar finalización y responsable cuando un pedido retrocede desde el estado final, conservando ambos movimientos en el historial.
- **FR-016**: El sistema MUST registrar en un historial cada movimiento entre estados, con estado origen, estado destino, usuario y momento.
- **FR-017**: El sistema MUST resolver los movimientos simultáneos sobre el mismo pedido aplicando solo el primero y avisando al segundo usuario con la pantalla actualizada.
- **FR-018**: Los usuarios MUST poder filtrar el tablero por rango de fecha de entrega (hoy, mañana, esta semana, personalizado), calculado en la zona horaria configurada de la empresa.
- **FR-019**: El sistema MUST mostrar los pedidos sin fecha de entrega en una agrupación "Sin fecha", visible en cualquier rango.
- **FR-019a**: El sistema MUST mostrar los pedidos con fecha de entrega **vencida** en cualquier rango seleccionado, marcados visualmente como atrasados, y MUST exponer cuántos hay. Los rangos (hoy / mañana / esta semana) miran hacia adelante, así que sin esta regla un pedido abierto con entrega vencida no caería en ninguna pestaña y quedaría invisible justo el que más urge — contradiciendo FR-007. *(Agregado durante la implementación: al validar contra datos reales, 45 de 47 pedidos abiertos tenían entrega vencida y el tablero se veía vacío.)*
- **FR-020**: Los usuarios MUST poder buscar dentro del tablero por número de pedido, nombre del cliente o nombre de producto.
- **FR-021**: El sistema MUST mostrar el nombre del comprador registrado en el pedido cuando el pedido no tiene un contacto del CRM asociado.
- **FR-022**: Los usuarios MUST poder configurar el orden de las columnas del tablero y la agrupación por defecto, de forma independiente del orden de las etapas del flujo de venta.
- **FR-023**: El sistema MUST mostrar la actividad reciente del tablero a partir del historial de movimientos.

**Visibilidad en Pedidos**

- **FR-024**: El sistema MUST mostrar el estado de preparación en la lista de pedidos, visualmente diferenciado y subordinado al estado comercial del pedido.
- **FR-025**: El sistema MUST mostrar en el detalle del pedido el estado de preparación, el inicio, la finalización y el responsable.
- **FR-026**: El sistema MUST NO alterar el comportamiento actual de la lista ni del detalle de pedidos para los pedidos que nunca entraron a preparación.

**Avance por ítem**

- **FR-027**: Los usuarios MUST poder registrar cuántas unidades de cada línea del pedido están preparadas, admitiendo avances parciales.
- **FR-028**: El sistema MUST registrar cuándo y quién preparó cada línea.
- **FR-029**: El sistema MUST rechazar registrar más unidades preparadas que las pedidas en la línea.
- **FR-030**: El sistema MUST recalcular el avance del pedido cuando se agregan o quitan líneas después de haberse preparado, sin borrar el historial.
- **FR-031**: El sistema MUST ofrecer un resumen por producto del rango seleccionado, con unidades requeridas y unidades ya preparadas consolidadas de todos los pedidos.
- **FR-032**: Los usuarios MUST poder agrupar el tablero por pedido o por producto.

**Transversales**

- **FR-033**: El sistema MUST restringir el acceso al módulo de Preparación mediante un permiso propio, separable del permiso sobre Pedidos (un preparador puede modificar preparación sin poder modificar pedidos).
- **FR-034**: Toda consulta y mutación del módulo MUST estar acotada a la empresa autenticada.
- **FR-035**: El sistema MUST emitir eventos de dominio al iniciarse una preparación, al completarse, y al prepararse una línea, con contrato versionado y compartido.
- **FR-036**: El sistema MUST NO modificar el estado de entrega del pedido como efecto de un movimiento en el tablero de preparación, ni modificar el estado de preparación como efecto de un cambio en el estado de entrega. Son ejes independientes: preparación = armado interno del pedido; entrega = logística del envío.
- **FR-036a**: El sistema MUST presentar el estado de preparación y el estado de entrega en bloques separados y con etiquetas que los distingan sin ambigüedad, de modo que un usuario no pueda confundir "preparando" (armado interno) con el estado de entrega homónimo del bloque logístico.
- **FR-037**: El sistema MUST NO reservar ni descontar inventario al marcar ítems como preparados; el stock se sigue gestionando exclusivamente en el módulo de inventario existente.

### Key Entities

- **Flujo de preparación**: la configuración de preparación de una empresa. Define sus estados, qué etapas del flujo de venta hacen entrar un pedido, la agrupación por defecto y el rango por defecto. Una empresa tiene uno.
- **Estado de preparación**: una columna del tablero. Tiene nombre, color, orden, y las marcas de inicial / marca inicio / final. Pertenece a un flujo de preparación.
- **Preparación del pedido**: el registro de preparación de un pedido concreto. Guarda en qué estado está, cuándo se inició, cuándo se completó, quién la completó y notas. Existe solo para pedidos que entraron al tablero, y sobrevive a la salida del pedido del tablero.
- **Movimiento de preparación**: cada cambio de estado de una preparación. Guarda estado origen, estado destino, si fue manual o automático, usuario y momento. Alimenta la actividad reciente.
- **Avance de línea**: por cada línea del pedido, cuántas unidades están preparadas, cuándo y por quién.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una empresa que nunca configuró nada puede abrir Preparación y mover su primer pedido a "preparado" en menos de 1 minuto, sin pasar por ninguna pantalla de configuración.
- **SC-002**: Una empresa puede pasar de dos a cuatro estados de preparación en menos de 3 minutos y sin perder el estado de ningún pedido en curso.
- **SC-003**: Un preparador identifica en menos de 10 segundos, desde el tablero, todos los pedidos que tiene que preparar para hoy.
- **SC-004**: Un agente de ventas responde "¿ya está preparado mi pedido?" sin salir de la lista de pedidos, en el 100% de los pedidos que entraron al tablero.
- **SC-005**: El 100% de los movimientos entre estados queda auditado con usuario y momento, y es consultable desde la actividad reciente.
- **SC-006**: En movimientos simultáneos sobre el mismo pedido, el sistema nunca pierde ni duplica un movimiento: se aplica exactamente uno y el otro usuario recibe aviso.
- **SC-007**: El resumen por producto permite saber cuántas unidades de cada producto hay que tener listas para el rango seleccionado, sin abrir ningún pedido.
- **SC-008**: Las pantallas de lista y detalle de pedidos de empresas que no usan Preparación se comportan exactamente igual que antes de esta feature (verificable con los casos de prueba existentes).

## Assumptions

- La unidad que entra al tablero es el **pedido**; agrupar varios pedidos en un lote único de preparación (preparar 12 unidades de un producto que cubren 5 pedidos) queda fuera de alcance — el resumen por producto cubre la necesidad de lote sin crear la entidad.
- La empresa tiene un flujo de preparación único; múltiples tableros por equipo, rol o sucursal quedan fuera de alcance de esta versión, pero el modelo no debe impedirlos más adelante.
- El rango de fechas se calcula sobre la **fecha de entrega** del pedido, con la misma definición de "hoy/mañana" en zona horaria de negocio que ya usa el listado de pedidos.
- Los pedidos digitales y de servicio entran al tablero igual que los físicos si su etapa lo habilita; excluirlos es decisión de configuración de la empresa, no una regla del sistema.
- Marcar ítems no es requisito para mover un pedido al estado final en esta versión (se puede cerrar la preparación sin haber marcado línea por línea).
- Que terminar la preparación mueva automáticamente la etapa comercial del pedido queda fuera de alcance; se evaluará como automatización posterior, con protección contra bucles.
- El módulo se apoya en el flujo de venta existente para saber qué pedidos entran; no lo modifica ni cambia sus reglas ni sus automatizaciones.
- El estado de entrega del pedido (incluido su valor `PREPARANDO`) mantiene su significado y su comportamiento actuales: esta feature no lo migra, no lo deprecia y no lo sincroniza. Un pedido puede tener estado de preparación y estado de entrega en cualquier combinación.
- El inventario no se toca: preparar un ítem no reserva ni descuenta stock. Si más adelante se decide que sí, el avance por línea ya registra cantidad, momento y responsable, que es lo que ese cambio necesitaría.
- Los volúmenes esperados por tablero son de decenas de pedidos por día, no miles; el diseño no necesita paginación infinita en esta versión.
