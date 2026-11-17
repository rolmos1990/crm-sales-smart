# Feature Specification: Mostrar quién recibe en el listado de Pedidos

**Feature Branch**: `feature/037-destinatario-en-listado-pedidos`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "En el listado de Pedidos, donde muestra el cliente, también mostrar quién recibe en caso que lo tenga, como se ve en la foto." (mockup adjunto: bajo el nombre del cliente aparece un chip `Recibe: <nombre>`)

## Por qué es Feature y no Hotfix

Karia nunca mostró el destinatario en el listado: el dato existe (`EntregaPedido.nombreDestinatario`, capturado en el formulario de entrega y mostrado en el detalle del pedido y de la cotización con la etiqueta "Recibe"), pero la columna "Cliente" de la tabla nunca lo leyó. Es una capacidad nueva, no algo que dejó de funcionar — mismo criterio que el caso `007` en `docs/SPEC-KIT-WORKFLOWS.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver de un vistazo quién recibe cada pedido (Priority: P1)

Como persona de operaciones que mira el listado de Pedidos para coordinar entregas, quiero ver quién recibe cada pedido junto al nombre del cliente, para no tener que abrir pedido por pedido cuando quien compra y quien recibe no son la misma persona.

**Why this priority**: Es el pedido completo del usuario y es entregable por sí solo — una sola columna enriquecida, sin depender de nada más.

**Independent Test**: Abrir el listado de Pedidos con al menos un pedido que tenga destinatario cargado en su entrega y comprobar que aparece bajo el nombre del cliente.

**Acceptance Scenarios**:

1. **Given** un pedido cuya entrega tiene destinatario ("Julio Ortiz"), **When** el usuario mira la columna "Cliente" del listado, **Then** ve el nombre del cliente y, debajo, `Recibe: Julio Ortiz`.
2. **Given** un pedido sin destinatario cargado (o sin entrega registrada), **When** el usuario mira esa fila, **Then** la celda se ve exactamente como antes de esta feature: solo cliente, sin espacio reservado ni etiqueta vacía.
3. **Given** un pedido con destinatario pero sin ningún dato de cliente, **When** el usuario mira esa fila, **Then** sigue viendo el `—` de "sin cliente" y además el destinatario — un dato no reemplaza al otro.

---

### User Story 2 - No romper la lectura de la tabla con destinatarios largos (Priority: P2)

Como usuario del listado, quiero que un destinatario largo no deforme la tabla ni empuje las demás columnas, para que la fila siga siendo legible.

**Why this priority**: Depende de la US1, pero no es un detalle estético opcional: en producción hay destinatarios cargados como texto libre con teléfono y ciudad adentro (p. ej. `"Julio Ortiz  6394-4040  8-947-2275  Chitré"`, PED-2026-0244). Sin acotarlo, esa fila desacomoda la tabla.

**Independent Test**: Abrir el listado con un pedido cuyo destinatario sea un texto largo y comprobar que la columna mantiene su ancho.

**Acceptance Scenarios**:

1. **Given** un pedido con un destinatario muy largo, **When** el usuario mira el listado, **Then** el texto se corta con puntos suspensivos y el ancho de la columna no cambia respecto de las demás filas.
2. **Given** ese mismo pedido, **When** el usuario deja el cursor sobre el destinatario cortado, **Then** puede ver el valor completo.

---

### Edge Cases

- **Destinatario vacío o solo espacios**: se trata como "sin destinatario" — no se muestra un chip con la etiqueta y nada después.
- **Pedido sin entrega registrada** (servicio, entrega digital, envío aún sin registrar): nada que mostrar, la celda queda igual que hoy.
- **Destinatario igual al cliente**: se muestra igual. Se evaluó ocultarlo por redundante y se descartó (ver `research.md`, Decisión 3): en producción no hay ni un caso de coincidencia exacta y sí varios de coincidencia parcial ("Yirali P." vs "Yirali Paz"), donde esconder el dato sería peor que repetirlo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El listado de Pedidos MUST mostrar el destinatario de la entrega en la columna "Cliente", debajo del nombre del cliente, cuando el pedido tenga uno cargado.
- **FR-002**: El destinatario MUST rotularse con la misma palabra que ya usa el resto del producto para ese dato: **"Recibe"** (ver detalle del pedido y detalle de la cotización).
- **FR-003**: El sistema MUST NOT mostrar nada —ni etiqueta, ni espacio reservado— cuando el pedido no tiene destinatario, no tiene entrega, o el destinatario es texto vacío.
- **FR-004**: Un destinatario largo MUST truncarse visualmente sin alterar el ancho de la columna, y su valor completo MUST quedar accesible al pasar el cursor.
- **FR-005**: El sistema MUST NOT alterar el resto del listado: columnas, orden, filtros, KPIs, exportación a CSV y acciones por fila siguen comportándose igual.
- **FR-006**: El dato MUST leerse de la entrega del pedido; no se introduce un campo nuevo ni se duplica el destinatario en otra tabla.

### Key Entities

- **EntregaPedido**: registro de envío del pedido (opcional, uno por pedido). Ya guarda `nombreDestinatario` — quién recibe físicamente el envío.
- **Pedido**: no cambia. Su cliente (contacto/empresa del CRM o los datos del comprador cargados a mano) sigue siendo lo principal de la columna.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para los pedidos que tienen destinatario cargado, el usuario puede saber quién recibe sin abrir el pedido — 0 clics, contra 1 apertura de detalle por pedido hoy.
- **SC-002**: Las filas sin destinatario se ven idénticas a antes de la feature (verificable comparando contra el listado actual).
- **SC-003**: Ninguna fila del listado desborda horizontalmente ni cambia el ancho de la columna "Cliente", sin importar el largo del destinatario.

## Assumptions

- "Quien recibe" es `EntregaPedido.nombreDestinatario`, el mismo dato que el detalle del pedido muestra como "Recibe". No se refiere al transportista ni al usuario de Karia que gestiona el pedido.
- El alcance es el listado de Pedidos. La exportación a CSV y la búsqueda por destinatario quedan fuera (ver "Fuera de alcance").
- El dato es de adopción reciente: hoy 9 de 251 pedidos de la cuenta principal lo tienen cargado, así que la mayoría de las filas no cambiará hasta que se use más el campo.

## Fuera de alcance

- **Buscar por destinatario**: el buscador del listado sigue mirando número, cliente y razón social. Agregarlo es un cambio de query (y de su índice) que amerita su propia decisión.
- **Exportación a CSV**: el archivo exportado mantiene sus columnas actuales.
- **Listado de Cotizaciones**: no se toca, aunque `EntregaCotizacion` tiene el mismo campo.
