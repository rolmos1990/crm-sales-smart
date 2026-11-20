# Feature Specification: Pantallas de error con la identidad de Karia

**Feature Branch**: `feature/044-pantallas-de-error`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "Cuando abro una URL que no existe veo una pantalla negra. ¿Esto da cobertura para que un 404, un 500 o cualquier error quede dentro del marco de la app, mostrando el menú y parte de la información según si hay sesión o no?"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un 404 dentro de la app no expulsa al usuario (Priority: P1)

Un vendedor abre el enlace a un contacto que un compañero borró, o pega una URL con un identificador mal copiado. Hoy aterriza en una pantalla negra, sin menú, sin marca y sin ninguna salida que no sea el botón "atrás" del navegador. Debe recibir, en cambio, una pantalla que siga siendo Karia: el menú lateral en su sitio, un mensaje claro de que ese registro no existe, y un camino de vuelta.

**Why this priority**: Es el caso que se reporta y el más frecuente — enlaces compartidos entre compañeros, registros borrados, URLs mal copiadas. También es el de mayor rendimiento por esfuerzo: la app ya monta el menú en los seis segmentos autenticados, así que la pantalla lo hereda sin trabajo extra.

**Independent Test**: Abrir `/crm/contactos/<identificador-inexistente>` con sesión iniciada y comprobar que el menú lateral sigue visible y hay un botón de regreso. Entregable por sí solo: cubre los seis módulos de la app autenticada.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión iniciada, **When** abre el detalle de un contacto que no existe, **Then** ve el menú lateral, un mensaje de "no encontramos este contacto" y una acción para volver al listado.
2. **Given** las mismas condiciones en Pedidos, Cotizaciones, Oportunidades, Empresas o Productos, **When** el registro no existe, **Then** ve la misma pantalla, adaptada al módulo donde está.
3. **Given** un usuario que entra a un módulo para el que su rol no tiene permiso, **When** se le niega el acceso, **Then** también conserva el menú — hoy esa pantalla lo pierde, aunque solo se llega a ella con sesión iniciada.
4. **Given** un contacto que sí existe, **When** el usuario lo abre, **Then** no ve ninguna pantalla de error: este cambio no altera el camino normal.

---

### User Story 2 - Un error inesperado no tumba la aplicación entera (Priority: P1)

Algo falla al cargar una sección: una consulta revienta, un dato llega con una forma que el código no esperaba. El usuario debe poder reintentar esa sección sin perder el resto de la aplicación ni volver a iniciar sesión.

**Why this priority**: Es la mitad que falta del trabajo de 043. Ese hotfix logró que los fallos dejen de esconderse; esta historia es la que decide qué ve el usuario cuando aparecen. Sin ella, un fallo real muestra hoy la pantalla cruda del framework.

**Independent Test**: Forzar el fallo de la carga de un listado y comprobar que el menú sigue presente, que hay un botón de reintentar, y que ese botón recarga solo esa sección.

**Acceptance Scenarios**:

1. **Given** un usuario en el listado de Pedidos, **When** la carga del listado falla, **Then** ve el menú, un mensaje comprensible y un botón "Reintentar" que vuelve a cargar solo esa sección.
2. **Given** la misma pantalla de error, **When** el usuario pulsa "Reintentar" y la causa ya se resolvió, **Then** la sección carga normalmente sin recargar la página entera.
3. **Given** la misma pantalla, **When** el usuario prefiere irse, **Then** tiene una acción secundaria para volver al inicio.
4. **Given** cualquier pantalla de error, **When** el usuario la mira, **Then** el mensaje nunca expone detalles técnicos (nombres de tabla, rutas de archivo, texto de la excepción).

---

### User Story 3 - Una dirección que no existe sigue pareciendo Karia (Priority: P2)

Alguien abre una URL inventada, un enlace viejo de un correo, o una dirección mal escrita que no corresponde a ninguna sección. No se puede saber a qué módulo pertenece, así que no hay menú que mostrar — pero la pantalla debe ser reconocible como Karia y ofrecer una salida.

**Why this priority**: Es menos frecuente que la historia 1 y tiene un techo más bajo: por cómo funciona el enrutado, una dirección que no coincide con ninguna sección no puede traer el menú de ninguna sección. Va en P2 porque lo alcanzable es "que se vea como Karia y tenga salida", no "que tenga menú".

**Independent Test**: Abrir una URL inventada y comprobar que la pantalla usa la identidad visual del producto y ofrece un enlace al inicio.

**Acceptance Scenarios**:

1. **Given** cualquier usuario, **When** abre una dirección que no corresponde a ninguna sección, **Then** ve una pantalla con la identidad de Karia, un mensaje claro y un enlace al inicio.
2. **Given** un usuario **sin** sesión en esa misma pantalla, **When** pulsa el enlace, **Then** llega al inicio de sesión en lugar de a una pantalla vacía.
3. **Given** un usuario **con** sesión, **When** pulsa el enlace, **Then** llega a su inicio dentro de la aplicación.

---

### User Story 4 - El último recurso también está controlado (Priority: P3)

Falla algo tan arriba que ni el menú se puede construir: la resolución de la sesión, o el armazón mismo de la página. Debe aparecer una pantalla simple y controlada, no una en blanco.

**Why this priority**: Es el caso más raro y el de menor margen de diseño — por definición, lo que falló es lo que daría el marco. Va último porque sin las tres historias anteriores no se llega acá casi nunca, y porque es la que menos puede prometerse.

**Independent Test**: Forzar el fallo de la resolución de sesión y comprobar que aparece una pantalla con mensaje y acción, no una pantalla en blanco.

**Acceptance Scenarios**:

1. **Given** un fallo al resolver la sesión o las preferencias del usuario, **When** el usuario carga cualquier página autenticada, **Then** ve una pantalla controlada con un mensaje y una acción de recarga, sin menú.
2. **Given** un fallo en el armazón más externo de la aplicación, **When** ocurre, **Then** el usuario ve una pantalla mínima y legible en lugar de una en blanco.
3. **Given** cualquiera de esas pantallas, **When** el usuario la mira, **Then** encuentra un código corto de soporte.

---

### Edge Cases

- **El usuario perdió la sesión mientras miraba una página.** Pulsar "Reintentar" debe llevarlo a iniciar sesión, no a un bucle de errores.
- **La pantalla de error falla al renderizarse.** El último recurso debe depender de lo mínimo posible; cuanto más arriba está la pantalla, menos puede apoyarse en el resto del producto. La pantalla más externa necesariamente se verá distinta de las demás, y eso se asume.
- **Reintentar sobre algo que no es recuperable.** Si la causa persiste, el usuario queda pulsando un botón que siempre falla. La pantalla debe ofrecer siempre una salida alternativa además del reintento.
- **Un fallo a mitad de la transmisión de la página.** Una página que ya empezó a enviarse no puede reemplazarse entera por una pantalla de error; el resultado será una página truncada.
- **Modo claro y oscuro, y pantallas angostas.** Las pantallas de error aparecen en cualquier contexto, incluido el móvil, y la más externa no puede apoyarse en la preferencia de tema del usuario.
- **Un 404 dentro de una sección a la que el rol no tiene acceso.** Debe prevalecer el mensaje de permiso, no el de "no existe" — nunca debe confirmarse la existencia de un registro a quien no puede verlo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cuando un registro solicitado no exista dentro de un módulo autenticado, el sistema MUST mostrar una pantalla de "no encontrado" que conserve el menú de navegación y el marco de la aplicación.
- **FR-002**: Cuando una sección falle de forma inesperada, el sistema MUST mostrar una pantalla de error que conserve el menú y ofrezca reintentar esa sección sin recargar la aplicación entera.
- **FR-003**: Toda pantalla de error MUST ofrecer al menos dos salidas: reintentar (cuando aplique) y volver a un lugar conocido de la aplicación.
- **FR-004**: Toda pantalla de error MUST mostrar un código corto que el usuario pueda transmitir a soporte, y que permita localizar el evento en los registros del servidor.
- **FR-005**: El sistema MUST NOT exponer detalles técnicos al usuario: nombres de tablas o columnas, rutas de archivo, trazas, ni el texto crudo de la excepción.
- **FR-006**: Cuando la dirección no corresponda a ninguna sección de la aplicación, el sistema MUST mostrar una pantalla con la identidad visual del producto y un enlace al inicio, aun cuando no pueda mostrar el menú.
- **FR-007**: El destino del enlace de salida MUST depender de si hay sesión: a la aplicación si la hay, al inicio de sesión si no.
  - *Implementado por redirección en el borde, no por lectura de sesión en la pantalla*: leerla ahí volvía dinámicas las nueve páginas públicas. El resultado para el usuario es el mismo. Ver `plan.md` § Desviaciones.
- **FR-008**: Cuando falle la resolución de la sesión o el armazón de la aplicación, el sistema MUST mostrar una pantalla controlada en lugar de una pantalla en blanco.
- **FR-009**: Todas las pantallas de error MUST compartir una misma anatomía visual, de modo que agregar una nueva no implique rediseñarla.
- **FR-010**: Las pantallas MUST ser legibles en modo claro y oscuro y en pantallas angostas, con la excepción de la más externa, que no puede acceder a la preferencia de tema.
- **FR-011**: La pantalla de acceso denegado MUST integrarse a esta misma familia visual y conservar el menú, dado que solo se alcanza con sesión iniciada.
- **FR-012 (NO ALTERAR LO EXISTENTE)**: El sistema MUST NOT cambiar el comportamiento del camino normal: los registros que existen se siguen abriendo igual, los estados vacíos legítimos se siguen mostrando igual, y los 404 por registro inexistente se siguen emitiendo en los mismos casos que hoy.
- **FR-013**: El sistema MUST NOT modificar el contrato de retorno de las acciones de escritura, la validación por campo de los formularios, ni introducir infraestructura de registro estructurado. Ese alcance pertenece a un trabajo posterior (ver Assumptions).

### Key Entities

Sin entidades nuevas ni cambios en el modelo de datos. La funcionalidad es de presentación.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de los módulos autenticados, un identificador inexistente produce una pantalla con menú visible y al menos una salida; en ninguno produce una pantalla sin marco.
- **SC-002**: En el 100% de los módulos autenticados, un fallo inesperado de carga produce una pantalla con menú visible y un reintento que afecta solo a esa sección.
- **SC-003**: Desde cualquier pantalla de error, el usuario puede volver a una pantalla funcional en una sola acción.
- **SC-004**: El 100% de las pantallas de error muestra un código de soporte, y ese código permite localizar el evento correspondiente en los registros del servidor.
- **SC-005**: Ninguna pantalla de error muestra texto técnico: verificable revisando el texto visible de cada una de las pantallas de la familia.
- **SC-006**: Con la aplicación sana, el 100% de los recorridos existentes se comporta igual que antes del cambio: mismos listados, mismos estados vacíos, mismos 404 en los mismos casos.
- **SC-007**: Todas las pantallas de la familia son legibles en modo claro y oscuro y a 360 px de ancho, salvo la más externa, para la que solo se exige legibilidad.

## Assumptions

- **Esta Feature continúa el trabajo de 043 y depende de él.** Aquel hotfix logró que los fallos de lectura dejen de esconderse detrás de listas vacías y 404 falsos; sin él, estas pantallas casi nunca se dispararían porque el error no llegaba hasta ellas. 043 ya está en la rama principal.
- **Hay dos casos en los que el menú es técnicamente imposible, y se asumen como tales**: una dirección que no corresponde a ninguna sección (no hay módulo del que tomar el menú) y un fallo del propio armazón autenticado (lo que falló es justamente lo que construye el menú). Para ambos, el objetivo es identidad visual y una salida, no menú.
- **Fuera de alcance, para un trabajo posterior**: unificar el contrato de retorno de las acciones de escritura con códigos distinguibles (sesión vencida, sin permiso, validación, fallo temporal), los errores de validación por campo en los formularios, el registro estructurado con ruta y operación, y la idempotencia de las operaciones que pueden duplicarse al reintentar (crear pedido, enviar mensaje). Son necesarios para cerrar el manejo de errores completo, pero no para que las pantallas dejen de ser una pantalla negra.
- Se asume que el código de soporte que ya genera el entorno al registrar un error es suficiente para correlacionar, y que no hace falta inventar un identificador propio.
- Se asume que la anatomía visual puede construirse extendiendo los componentes que el producto ya usa para estados vacíos, sin introducir primitivos nuevos.
- Se asume que la aplicación tiene seis módulos autenticados que comparten armazón, y que cualquier módulo nuevo que se agregue después deberá sumar sus propias pantallas; el trabajo no incluye un mecanismo que las genere automáticamente.
