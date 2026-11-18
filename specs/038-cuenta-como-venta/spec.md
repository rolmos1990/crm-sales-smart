# Feature Specification: Cuenta como Venta en el Flujo de Venta

**Feature Branch**: `feature/038-cuenta-como-venta`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "En el Flujo de Ventas al editar los estados debo tener otra opción que diga Cuenta como Venta, esto permite contabilizar en los totales este estado como una venta realizada. Entendería que es solo necesario más que la fecha de creación del Pedido y la Fecha de Estimación. No es necesario la fecha de expiración del pedido (ya que el pedido no expira, este campo se puede borrar y cualquier relación con el Pedido para la Fecha de Expiración). Importante no confundir la Fecha de Expiración de la Cotización. Aquellos estados de Flujo de Venta que estén marcados como 'Cuenta como Venta' deben ser los que cuentan en los Totales de Venta por Mes y Totales de Venta (Filtradas). Cada Etapa del Pedido (Estado) genera fecha y debo evaluar cómo se puede tomar en cuenta para los filtros, ya que cada pedido que esté en ese estado es contabilizado en el Total de Ventas y cuando se filtre por Fecha es tomado en cuenta."

## Contexto del problema

El listado de Pedidos muestra seis tarjetas de indicadores. Dos de ellas son de dinero —"Total ventas" y "Total ventas · mes actual"— y hoy suman **todos** los pedidos que pasan el filtro activo, sin mirar en qué etapa del Flujo de Venta están. Un pedido recién creado, uno en preparación y uno ya entregado pesan exactamente igual. El negocio no tiene ninguna forma de declararle a Karia qué significa "vendido" dentro de su propio proceso comercial.

Además, el Pedido arrastra una "fecha de expiración" que no corresponde al negocio —un pedido no vence— y que sin embargo es el eje de cálculo de otras dos tarjetas ("Pendientes" y "Expirados"), ocupa una columna del listado, viaja en el CSV exportado, aparece en el formulario de creación/edición y figura en el catálogo de campos de las Reglas de validación.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Declarar qué etapas cuentan como venta (Priority: P1)

Como responsable comercial, al configurar el Flujo de Venta quiero marcar una o más etapas con la opción **"Cuenta como Venta"**, para que los totales de dinero del listado de Pedidos reflejen únicamente las ventas reales de mi negocio y no todo lo que entró al embudo.

**Why this priority**: Es el núcleo del pedido. Sin esto, los dos indicadores de dinero del módulo siguen sin significar nada confiable, y ningún otro trabajo de esta feature tiene valor por separado.

**Independent Test**: Se puede probar por completo entrando a la configuración del Flujo de Venta, marcando una etapa como "Cuenta como Venta" y comprobando que "Total ventas" en el listado de Pedidos pasa a sumar solo los pedidos que están en esa etapa.

**Acceptance Scenarios**:

1. **Given** un flujo con las etapas "Nuevo", "En proceso", "Entregado" y "Cancelado", y solo "Entregado" marcada como Cuenta como Venta, **When** el responsable abre el listado de Pedidos, **Then** "Total ventas" suma únicamente los pedidos que están en "Entregado", y los que están en "Nuevo", "En proceso" o "Cancelado" quedan fuera.
2. **Given** ese mismo flujo, **When** el responsable marca además "En proceso" como Cuenta como Venta y vuelve al listado, **Then** el total pasa a incluir también los pedidos de "En proceso", sin que nadie ejecute ninguna migración, recálculo ni tarea de mantenimiento.
3. **Given** que "En proceso" quedó marcada, **When** el responsable la desmarca, **Then** el total vuelve de inmediato al valor que tenía antes de marcarla.
4. **Given** un flujo donde el responsable desmarcó todas las etapas, **When** abre el listado, **Then** "Total ventas" y "Total ventas · mes actual" muestran cero, sin error y sin bloquear la pantalla.
5. **Given** una cuenta que nunca configuró un Flujo de Venta, **When** abre el listado, **Then** los totales siguen calculándose por el estado de pedido clásico ("Entregado"), exactamente como antes de esta feature.

---

### User Story 2 - Atribuir la venta a la fecha en que se concretó (Priority: P1)

Como responsable comercial, cuando filtro los Pedidos por un rango de fechas quiero que cada venta se cuente en el período en que **se concretó** —cuándo el pedido llegó a la etapa que cuenta como venta— y no en el período en que se creó el pedido, para poder cerrar correctamente el mes.

**Why this priority**: Sin esto, "Total ventas · mes actual" sigue mintiendo: un pedido que se creó a fin de octubre y se entregó en noviembre se atribuye a octubre, que es justamente el error que vuelve inservible el cierre mensual.

**Independent Test**: Se puede probar creando un pedido con fecha del mes anterior, moviéndolo hoy a una etapa que cuenta como venta, y verificando que aparece en el total del mes en curso.

**Acceptance Scenarios**:

1. **Given** un pedido creado el 28 de octubre y movido a la etapa "Entregado" el 3 de noviembre, **When** el responsable filtra el listado por el mes de noviembre, **Then** ese pedido suma en "Total ventas".
2. **Given** ese mismo pedido, **When** el responsable filtra por el mes de octubre, **Then** ese pedido **no** suma en "Total ventas".
3. **Given** un pedido que llegó a la etapa de venta a las 23:30 hora local del último día del mes, **When** se calculan los totales, **Then** se atribuye a ese mes y no al siguiente.
4. **Given** cualquier filtro de fecha activo en pantalla, **When** se muestra "Total ventas · mes actual", **Then** sigue cubriendo del día 1 del mes en curso hasta el final del día de hoy, sin dejarse afectar por ese filtro.

---

### User Story 3 - Eliminar la fecha de expiración del pedido (Priority: P2)

Como usuario del módulo de Pedidos, quiero que la "fecha de expiración" desaparezca del pedido, para dejar de completar y de interpretar un dato que mi negocio no usa. El pedido queda con dos fechas: cuándo se creó y para cuándo se estima la entrega.

**Why this priority**: Es limpieza de un concepto equivocado y arrastra consigo el recálculo de dos tarjetas. Valioso, pero el negocio ya obtiene el beneficio principal con las dos historias anteriores.

**Independent Test**: Se puede probar recorriendo creación de pedido, edición, detalle, listado y exportación a CSV, y comprobando que no queda ningún rastro del campo.

**Acceptance Scenarios**:

1. **Given** el formulario de creación o de edición de un pedido, **When** el usuario lo abre, **Then** no existe ningún campo de fecha de expiración.
2. **Given** el listado de Pedidos, **When** el usuario lo recorre y exporta el CSV, **Then** no aparece la columna "Expiración" ni en pantalla ni en el archivo.
3. **Given** la pantalla de detalle de un pedido, **When** el usuario la abre, **Then** no se muestra ninguna indicación de expiración ni de pedido vencido.
4. **Given** la configuración de Reglas de validación, **When** el usuario arma una condición, **Then** "Fecha de expiración" ya no figura entre los campos disponibles del pedido.
5. **Given** una cotización con fecha de vencimiento y un pedido con entrega digital que caduca, **When** se aplica esta feature, **Then** ambas conservan su fecha intacta y su comportamiento sin cambios.

---

### User Story 4 - Indicadores de pendientes y atrasados sobre la entrega estimada (Priority: P2)

Como responsable de operaciones, quiero que las tarjetas "Pendientes" y "Expirados" se calculen contra la **fecha de entrega estimada**, para seguir viendo de un vistazo qué pedidos están por entregarse y cuáles ya se pasaron de fecha.

**Why this priority**: Es la contrapartida necesaria de la historia 3: al quitar la fecha de expiración esas dos tarjetas se quedan sin base de cálculo y hay que reemplazarla para no perder la señal operativa.

**Independent Test**: Se puede probar dejando un pedido abierto con entrega estimada de ayer y otro con entrega de mañana, y verificando en qué tarjeta cae cada uno.

**Acceptance Scenarios**:

1. **Given** un pedido abierto cuya entrega estimada es mañana, **When** se muestran los indicadores, **Then** cuenta en "Pendientes" y no en "Expirados".
2. **Given** un pedido abierto cuya entrega estimada fue ayer, **When** se muestran los indicadores, **Then** cuenta en "Expirados" y no en "Pendientes".
3. **Given** un pedido ya cerrado (etapa final o de cancelación) cuya entrega estimada fue ayer, **When** se muestran los indicadores, **Then** no cuenta en ninguna de las dos tarjetas.
4. **Given** un pedido abierto cuya entrega estimada es hoy, **When** se muestran los indicadores, **Then** cuenta en "Pendientes" durante todo el día de hoy en la zona horaria del negocio.

---

### Edge Cases

- **Dos o más etapas marcadas como venta**: manda la **primera** a la que el pedido llegó. Con "Pagado" y "Entregado" marcadas, un pedido que hace `Pagado 03-nov → Entregado 20-nov` queda fechado el 03-nov. Debe quedar explicado en la interfaz de configuración.
- **Marcar una etapa anterior del flujo después del despliegue**: los pedidos ya sellados conservan su fecha; solo los que todavía no cruzaron usan la etapa nueva. No hay recálculo retroactivo, y es una diferencia real respecto de la pertenencia, que sí se reevalúa siempre.
- **Pedido sin fecha de venta en una etapa que cuenta**: suma en el total sin filtro de fechas, pero queda fuera de cualquier total filtrado por rango. Es el estado de los pedidos abiertos antes de cruzar, y el motivo por el que el backfill no los sella con una fecha estimada.
- **Ninguna etapa marcada**: los dos totales de dinero muestran cero. No es un error del sistema sino una configuración incompleta de la cuenta.
- **Pedido sin etapa del flujo dinámico**: las cuentas que nunca configuraron un Flujo de Venta siguen contando por el estado de pedido clásico ("Entregado"), sin cambios respecto de hoy.
- **Pedido sin fecha de entrega estimada**: no cuenta en "Pendientes" ni en "Expirados" — mismo comportamiento que hoy, donde un pedido sin fecha de expiración tampoco caía en ninguna de las dos.
- **Pedido devuelto a una etapa anterior**: deja de contar como venta en el acto, porque la pertenencia se evalúa siempre sobre la etapa en la que el pedido está ahora. Su fecha de venta NO se borra: si vuelve a cerrarse, sigue valiendo la original.
- **Etapa marcada como venta y además como cancelación**: debe impedirse o advertirse; contabilizar una cancelación como venta no tiene sentido de negocio.
- **Lista y total miran poblaciones distintas**: con un rango de fechas activo, un pedido creado en octubre y vendido en noviembre suma en el total de noviembre pero no aparece en la lista filtrada por noviembre (la lista se ordena por fecha de creación). Es una consecuencia deliberada de la historia 2 y la interfaz debe dejar claro qué mide cada tarjeta para que no se lea como un defecto.
- **Reglas de validación que usaban la fecha de expiración**: si alguna cuenta tiene una regla construida sobre ese campo, al eliminarlo la regla no debe quedar bloqueando silenciosamente el avance de los pedidos.
- **Totales menores tras el despliegue**: los totales bajarán respecto de los de hoy, porque hoy suman pedidos que todavía no son venta. Es la corrección buscada, no una regresión.

## Requirements *(mandatory)*

### Functional Requirements

#### Configuración de etapas

- **FR-001**: El sistema MUST permitir marcar y desmarcar cada etapa del Flujo de Venta con el atributo "Cuenta como Venta", desde la pantalla donde hoy se editan las demás propiedades de la etapa.
- **FR-002**: El sistema MUST permitir que más de una etapa esté marcada como "Cuenta como Venta" dentro del mismo flujo.
- **FR-003**: El sistema MUST mostrar en el listado de etapas de la configuración cuáles están marcadas como "Cuenta como Venta", junto a los distintivos ya existentes de Inicial, Final y Cancelación.
- **FR-004**: El sistema MUST explicar en la propia pantalla de configuración que, si hay varias etapas marcadas, la venta se atribuye a la fecha en que el pedido llegó a la etapa en la que está actualmente.
- **FR-005**: El sistema MUST impedir, o advertir explícitamente, que una etapa de cancelación quede marcada como "Cuenta como Venta".

#### Cálculo de los totales

- **FR-006**: "Total ventas" y "Total ventas · mes actual" MUST sumar exclusivamente los pedidos cuya etapa actual esté marcada como "Cuenta como Venta".
- **FR-007**: El sistema MUST determinar si un pedido cuenta como venta leyendo la configuración vigente de su etapa en el momento de la consulta, sin depender de ningún valor copiado al pedido.
- **FR-008**: Un cambio en la marca "Cuenta como Venta" de cualquier etapa MUST reflejarse en los totales en la siguiente consulta del listado, sin requerir migración de datos, recálculo, reproceso ni intervención de soporte.
- **FR-009**: Si ninguna etapa del flujo está marcada como "Cuenta como Venta", los dos totales de dinero MUST mostrar cero sin producir error.
- **FR-010**: En cuentas sin Flujo de Venta configurado, los dos totales MUST calcularse sobre los pedidos en estado "Entregado", preservando el comportamiento actual.
- **FR-011**: Los dos totales MUST seguir excluyendo el costo de envío del monto sumado, tal como hoy.
- **FR-012**: La tarjeta que hoy cuenta "Entregados" MUST pasar a contar los pedidos que cuentan como venta, de modo que la tarjeta de cantidad y las de dinero describan la misma población.

#### Fecha de la venta y filtros

- **FR-013**: El sistema MUST registrar, para cada pedido, la fecha y hora en que entró **por primera vez** a una etapa marcada como "Cuenta como Venta".
- **FR-014**: Esa fecha MUST registrarse en todos los caminos por los que un pedido llega a una etapa: creación manual del pedido, conversión desde una cotización aprobada, movimiento manual por el usuario y movimiento automático por una automatización.
- **FR-014b**: Una vez registrada, esa fecha MUST NO volver a modificarse. Si hay varias etapas marcadas como venta, manda la primera a la que el pedido llegó: pasar después a otra etapa que también cuenta NO mueve la fecha. Volver a una etapa que no cuenta tampoco la borra — el pedido deja de sumar, pero conserva cuándo se vendió.
- **FR-015**: Esa fecha MUST coincidir con el momento que queda asentado en el historial de etapas del pedido para ese mismo movimiento.
- **FR-016**: Marcar o desmarcar etapas MUST NO alterar las fechas ya registradas. Como la fecha se sella con la configuración vigente en ese momento, marcar más adelante una etapa anterior del flujo solo afecta a los pedidos que todavía no cruzaron; no hay recálculo retroactivo.
- **FR-017**: Cuando hay un rango de fechas aplicado en el listado, "Total ventas" MUST tomar como eje la fecha de venta registrada, no la fecha de creación del pedido.
- **FR-018**: "Total ventas · mes actual" MUST cubrir desde el día 1 del mes en curso hasta el final del día de hoy sobre ese mismo eje, ignorando los filtros de fecha aplicados en pantalla, tal como hace hoy.
- **FR-019**: Todos los rangos de fecha MUST resolverse en la zona horaria de negocio de la cuenta.
- **FR-020**: La interfaz MUST indicar en las tarjetas de dinero que lo que se mide es "vendido en este rango", para distinguirlas de las tarjetas y del listado que se ordenan por fecha de creación.
- **FR-021**: La tarjeta "Total pedidos" y el listado de pedidos MUST seguir usando la fecha de creación como eje, sin cambios.

#### Eliminación de la fecha de expiración del pedido

- **FR-022**: El sistema MUST eliminar por completo la fecha de expiración del pedido: del almacenamiento, de los formularios de creación y edición, de la columna del listado, de la pantalla de detalle, de la exportación a CSV y del catálogo de campos de las Reglas de validación.
- **FR-023**: El sistema MUST conservar sin cambios la fecha de vencimiento de la **cotización** y la fecha de caducidad de las **entregas digitales**, que son conceptos distintos.
- **FR-024**: El sistema MUST depurar las Reglas de validación existentes que referencien la fecha de expiración del pedido, de modo que ninguna quede bloqueando el avance de pedidos tras la eliminación del campo. Una regla que quede sin condiciones MUST dejar de evaluarse en lugar de evaluarse como incumplida.
- **FR-025**: La depuración de reglas MUST dejar registro de qué reglas fueron modificadas, para que la cuenta pueda revisarlas.

#### Indicadores de pendientes y atrasados

- **FR-026**: "Pendientes" MUST contar los pedidos abiertos cuya fecha de entrega estimada sea hoy o posterior, en la zona horaria de negocio.
- **FR-027**: "Expirados" MUST contar los pedidos abiertos cuya fecha de entrega estimada ya pasó, en la zona horaria de negocio.
- **FR-028**: Ambas tarjetas MUST excluir los pedidos cerrados, entendiendo por cerrados los que están en una etapa final o de cancelación, o en estado "Entregado"/"Cancelado" en cuentas sin flujo configurado.
- **FR-029**: Ambas tarjetas MUST excluir los pedidos sin fecha de entrega estimada, preservando el comportamiento actual.

#### Migración

- **FR-030**: Al desplegar, el sistema MUST dejar marcadas como "Cuenta como Venta" las etapas que hoy son finales y no son de cancelación, que es la definición con la que hoy se calcula la tarjeta "Entregados".
- **FR-031**: Al desplegar, el sistema MUST completar la fecha de venta de los pedidos que **ya cuentan como venta** con su fecha de entrega estimada, y recurrir a la fecha de creación cuando no tengan entrega estimada. Los pedidos abiertos MUST quedar sin fecha, para recibir la real al cruzar a una etapa que cuenta.
- **FR-032**: La migración MUST ser segura para los datos existentes y no debe perder el historial de etapas de ningún pedido.

### Key Entities

- **Etapa del Flujo de Venta**: paso del proceso comercial que una cuenta configura a su medida. Suma un nuevo atributo, "Cuenta como Venta", que declara si los pedidos ubicados en ella deben contabilizarse como venta realizada. Convive con los atributos existentes de Inicial, Final, Cancelación, Secuencial y permisos de edición.
- **Pedido**: suma el dato "fecha de venta" —cuándo se volvió venta por primera vez—, que es el eje temporal con el que se atribuye la venta a un período. Pierde el dato "fecha de expiración". Conserva su fecha de creación y su fecha de entrega estimada.
- **Historial de etapas del pedido**: registro ya existente de cada movimiento de un pedido entre etapas. No se usa para el backfill inicial (que toma la entrega estimada), pero conserva los datos necesarios si alguna vez se quisiera recalcular la fecha de venta contra otra configuración.
- **Regla de validación**: condición configurable que un pedido debe cumplir para avanzar de etapa. Pierde "Fecha de expiración" como campo evaluable y las reglas existentes que lo usaran deben depurarse.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un responsable comercial puede declarar qué etapas de su proceso cuentan como venta y ver el efecto en los totales en menos de un minuto, sin asistencia técnica ni intervención de soporte.
- **SC-002**: El 100% de los cambios en la configuración de "Cuenta como Venta" se reflejan en los totales en la siguiente carga del listado, sin ninguna tarea de mantenimiento, migración o reproceso de por medio.
- **SC-003**: El monto de "Total ventas · mes actual" coincide exactamente con la suma de los pedidos que llegaron a una etapa de venta dentro del mes en curso, verificado contra un conteo manual sobre un conjunto de prueba.
- **SC-004**: Ningún pedido creado en un período y vendido en otro se atribuye al período equivocado, para los 12 meses de un año calendario de prueba, incluyendo cambios de horario estacional de la zona de negocio.
- **SC-005**: El listado de Pedidos conserva su tiempo de respuesta actual: la introducción de esta feature no agrega consultas adicionales ni degrada perceptiblemente la carga de la pantalla, incluso en cuentas con historial extenso.
- **SC-006**: Tras el despliegue, no queda ninguna referencia a la fecha de expiración del pedido en ninguna pantalla, exportación ni catálogo de configuración.
- **SC-007**: Ninguna cuenta queda con pedidos bloqueados para avanzar de etapa a causa de la eliminación del campo de expiración.
- **SC-008**: Tras la migración, el 100% de los pedidos existentes que tienen etapa asignada tienen también su fecha de entrada a esa etapa.

## Assumptions

- **"Expirados" significa atrasados**: la tarjeta pasa a señalar pedidos abiertos cuya entrega estimada ya pasó. Es la lectura que mantiene coherente el par con "Pendientes" y con el subtítulo actual "Fuera de fecha". Si el negocio prefiere el nombre "Atrasados", es un cambio de etiqueta sin impacto en el cálculo.
- **Pedidos sin fecha de entrega estimada**: se los deja fuera de "Pendientes" y de "Expirados", replicando el comportamiento de hoy. La alternativa —contarlos como pendientes— cambiaría el número que los usuarios ven hoy sin que nadie lo haya pedido.
- **Varias etapas marcadas**: se acepta que mover un pedido entre dos etapas que cuentan como venta reubique la venta en el período de la segunda. Con una sola etapa marcada —el caso esperado— la situación no se presenta.
- **Divergencia entre lista y totales**: se asume aceptable que, con un rango de fechas activo, la lista (ordenada por creación) y los totales de dinero (por fecha de venta) muestren poblaciones distintas, siempre que la interfaz lo explique.
- **Punto de partida de la migración**: se asume que para toda cuenta la definición actual de "entregado" —etapa final que no es de cancelación— es el punto de partida correcto para "Cuenta como Venta", y que cada cuenta lo ajustará después según su proceso.
- **Comunicación del cambio de cifras**: se asume que la baja de los totales respecto de los de hoy es entendida como la corrección buscada. Si se requiere avisar a los usuarios dentro del producto, es un alcance adicional a definir.
- **Alcance acotado al módulo de Pedidos**: los totales de venta solo se calculan en el listado de Pedidos. No hay otros tableros, reportes ni cuotas que consuman estas cifras, de modo que no hay consumidores externos que ajustar.
