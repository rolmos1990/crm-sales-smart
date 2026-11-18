# Feature Specification: Segmentación comercial de Contactos

**Feature Branch**: `feature/041-contactos-segmentacion-comercial`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Mejorar el módulo de Contactos de Karia para convertirlo en una herramienta comercial que permita identificar rápidamente cuántos contactos hay, cuántos son clientes reales, cuántos están interesados, cuántos se pueden recuperar con seguimiento y cuáles requieren atención prioritaria — con indicadores interactivos, pestañas rápidas, filtros, una tabla con información comercial útil y un panel lateral, sin convertir Contactos en un dashboard: la tabla sigue siendo la protagonista. Fase 1 (sin IA nueva); el análisis con IA va en la spec 042."

## Contexto del problema

Hoy el listado de Contactos es una lista de personas: nombre, empresa, email, teléfono y un "estado" (Activo / Inactivo / Lead). No responde ninguna pregunta comercial:

- **No distingue clientes reales.** El estado "Lead" se asigna al crear el contacto y nunca cambia. Un contacto con diez compras sigue apareciendo como "Lead". "Activo" e "Inactivo" mezclan otra idea (si el registro está en uso) con la relación comercial.
- **No sabe quién está interesado ni quién quedó sin respuesta.** La información existe dispersa (pedidos, oportunidades, cotizaciones, conversaciones, actividades) pero el listado no la usa.
- **No escala.** La pantalla carga todos los contactos de la cuenta de una vez y busca solo por nombre. Con miles de contactos se vuelve lenta y no permite encontrar a alguien por teléfono o email.
- **El perfil del cliente (012) cuenta mal las compras.** Considera "compra" solo a los pedidos en el estado clásico "Entregado", sin respetar las etapas que el negocio marcó como "Cuenta como Venta" en su Flujo de Venta (038). En cuentas con flujo propio, clientes reales aparecen como si nunca hubieran comprado.
- **No hay forma de respetar a quien pidió no ser contactado.** Nada impide que la IA o un Workflow le escriban.

## Conceptos

Esta feature separa en **dimensiones independientes** lo que hoy está mezclado en un solo "estado":

| Dimensión | Valores | De dónde sale |
|---|---|---|
| **Tipo comercial** | Cliente · Interesado · Lead | Derivado en cada consulta (ver reglas abajo). Nunca se guarda. |
| **Nivel de interés** | Alto · Medio · Bajo · Sin evaluar | Guardado, con su origen (manual, regla o IA). |
| **Seguimiento** | Al día · Pendiente de seguimiento · Por recuperar · Inactivo | Derivado en cada consulta, con umbrales configurables. |
| **Preferencia de contacto** | Contactable · No contactar | Guardado, con quién y cuándo lo marcó. |

**Reglas de tipo comercial:**

- **Cliente**: tiene al menos un pedido que cuenta como venta según la configuración vigente del Flujo de Venta de la cuenta (la misma regla que usan los totales de Pedidos desde 038). Pedidos cancelados, pendientes o en etapas que no cuentan como venta no lo hacen cliente. Una cotización tampoco.
- **Interesado**: tiene interés Alto o Medio, **o** tiene una señal comercial objetiva vigente (una oportunidad abierta o una cotización activa) y su interés no fue fijado manualmente en Bajo.
- **Lead**: no es Cliente ni Interesado.

Cliente e Interesado **no son excluyentes**: un cliente que vuelve a consultar es ambas cosas. En la tabla se muestra el tipo principal (Cliente, si lo es) y el nivel de interés en su propia columna, de modo que un "Cliente · Alto" se lee de un vistazo.

## Clarifications

### Session 2026-11-18

- Q: Para calcular el seguimiento, ¿los mensajes enviados automáticamente por la IA o un Workflow cuentan como interacción? → A: No. La última interacción cuenta los mensajes del contacto, los mensajes enviados por una persona del equipo, las actividades y los pedidos. Los mensajes automáticos (IA o Workflow) no la actualizan, pero sí cuentan como respuesta para la regla de "mensaje sin responder".
- Q: ¿En qué orden aparece la lista al entrar? → A: Por prioridad de atención: primero "Responder" (mensaje sin contestar), luego "Pendiente de seguimiento", luego "Por recuperar", luego el resto; dentro de cada grupo, por última actividad más reciente.
- Q: ¿La tabla tiene casillas de selección y acciones en lote en esta spec? → A: No. Las casillas llegan en la 042 junto con "Analizar seleccionados".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entender mi cartera y encontrar contactos rápido (Priority: P1)

Como responsable comercial, al entrar a Contactos quiero ver de inmediato cuántos contactos tengo, cuántos son clientes reales, cuántos están interesados, cuántos están por recuperar y cuántos son leads, y poder pasar de cualquiera de esos números a la lista de esas personas con un clic, para decidir a quién atender sin armar reportes.

**Why this priority**: Es el corazón del pedido y la base de las demás historias: sin una lista paginada con tipo comercial e indicadores, el panel lateral y el seguimiento no tienen dónde vivir. Por sí sola ya responde "¿cuántos clientes reales tengo?" y "¿cuántos están interesados?".

**Independent Test**: En una cuenta con contactos, pedidos en etapas que cuentan y no cuentan como venta, oportunidades abiertas y cotizaciones activas, abrir Contactos y comprobar que cada indicador muestra el conteo correcto, que al hacer clic la tabla muestra exactamente esos contactos y que la búsqueda por teléfono o email encuentra al contacto.

**Acceptance Scenarios**:

1. **Given** una cuenta con 1.248 contactos, de los cuales 312 tienen al menos un pedido en una etapa marcada "Cuenta como Venta", **When** el usuario abre Contactos, **Then** ve cinco indicadores compactos bajo el título —Total contactos 1.248, Clientes 312, Interesados, Por recuperar y Leads con sus conteos— y una tabla paginada que muestra la primera página y el texto "Mostrando 1–50 de 1.248 contactos".
2. **Given** un contacto cuyo único pedido está en una etapa que no cuenta como venta (por ejemplo "Nuevo") o en una etapa de cancelación, **When** se calculan los indicadores, **Then** ese contacto no cuenta como Cliente.
3. **Given** que el responsable marca una etapa adicional del Flujo de Venta como "Cuenta como Venta", **When** vuelve a Contactos, **Then** el indicador Clientes refleja el cambio en esa misma visita, sin ningún recálculo ni tarea de mantenimiento.
4. **Given** un cliente con interés Alto, **When** se calculan los indicadores, **Then** cuenta tanto en Clientes como en Interesados, y un ícono de información en los indicadores explica que las categorías se superponen y no tienen por qué sumar el total.
5. **Given** la pantalla abierta, **When** el usuario hace clic en el indicador "Interesados", **Then** la tabla se filtra a los interesados, el indicador queda resaltado de forma sutil y la pestaña rápida "Interesados" queda seleccionada; y viceversa, al elegir una pestaña se resalta su indicador.
6. **Given** un contacto con teléfono "+507 6123-4567", **When** el usuario escribe "6123" en la búsqueda, **Then** la tabla muestra ese contacto. Lo mismo ocurre buscando por nombre, apellido, email o teléfono secundario.
7. **Given** filtros aplicados (búsqueda, tipo, interés, canal o última actividad) y la página 3 abierta, **When** el usuario avanza o retrocede de página, **Then** los filtros y la búsqueda se conservan; **When** pulsa "Limpiar", **Then** vuelve a la vista por defecto (Todos, sin filtros, página 1).
8. **Given** la tabla recién abierta, **When** el usuario mira la primera página, **Then** aparecen primero los contactos con mensaje sin responder, luego los pendientes de seguimiento, luego los por recuperar y después el resto. **When** ordena por nombre, por última actividad o por interés, **Then** el orden se aplica sobre todos los contactos que cumplen el filtro (no solo sobre la página visible).
9. **Given** un usuario con permiso para modificar contactos, **When** abre el menú de acciones de una fila, **Then** sigue teniendo "Ver detalle", "Editar" y "Eliminar" con el mismo comportamiento que hoy.
10. **Given** un dispositivo móvil, **When** el usuario abre Contactos, **Then** los indicadores se acomodan sin desplazamiento horizontal de la página y cada contacto se muestra como una tarjeta compacta con nombre, tipo, interés y última actividad.

---

### User Story 2 - Ver el contexto de un contacto y corregir su clasificación (Priority: P2)

Como vendedor, al seleccionar un contacto en la lista quiero ver en un panel lateral su información general, su actividad comercial y acciones rápidas, y poder corregir su nivel de interés o marcarlo como "No contactar", sin salir de la lista.

**Why this priority**: Convierte la lista en una herramienta de trabajo diario y es la única forma de que el interés deje de ser "Sin evaluar" antes de que exista el análisis con IA (042). La preferencia "No contactar" protege al negocio y al contacto. Depende de la lista de la Historia 1, pero no de la Historia 3.

**Independent Test**: Seleccionar un contacto, verificar que el panel muestra su última compra, oportunidades y actividades pendientes reales; cambiar su interés a Alto y comprobar que pasa a contar como Interesado; marcarlo "No contactar" y comprobar que la IA y los Workflows ya no le envían mensajes y que un vendedor recibe un aviso al escribirle.

**Acceptance Scenarios**:

1. **Given** la lista de contactos, **When** el usuario hace clic en una fila, **Then** se abre un panel lateral (sin salir de la lista y sin perder filtros ni página) con: información general (nombre, teléfonos, email, canales vinculados, empresa, etiquetas, tipo comercial e interés), actividad comercial (última compra o "Sin compras", oportunidades abiertas, actividades pendientes, última actividad), una sección "Análisis de IA" que indica "Sin analizar" y acciones rápidas.
2. **Given** el panel abierto, **When** el usuario usa las acciones rápidas, **Then** puede abrir la conversación del contacto, crear una actividad para él, actualizar su clasificación, ver sus oportunidades y abrir la ficha completa del contacto, que sigue existiendo igual que hoy.
3. **Given** un contacto con interés "Sin evaluar", **When** un usuario con permiso de modificación lo cambia a "Alto", **Then** el contacto pasa a contar como Interesado, el panel y la fila reflejan el nuevo valor y queda registrado quién lo cambió, cuándo, el valor anterior y que el origen fue manual.
4. **Given** un interés fijado manualmente, **When** cualquier proceso automático posterior propone otro valor, **Then** el valor manual se mantiene; solo una persona puede cambiarlo o liberarlo.
5. **Given** un contacto con una oportunidad abierta, **When** un usuario fija su interés manualmente en "Bajo", **Then** el contacto deja de contar como Interesado.
6. **Given** un contacto contactable, **When** un usuario con permiso de modificación lo marca "No contactar", **Then** queda registrado quién y cuándo, la fila y el panel muestran un indicador discreto de "No contactar", y desde ese momento la IA conversacional y los Workflows no le envían ningún mensaje saliente.
7. **Given** un contacto marcado "No contactar", **When** un vendedor intenta enviarle un mensaje manualmente desde la conversación, **Then** ve un aviso claro de que el contacto pidió no ser contactado, y puede enviarlo igualmente si lo decide.
8. **Given** un contacto marcado "No contactar", **When** se calcula su seguimiento, **Then** nunca aparece como "Pendiente de seguimiento" ni "Por recuperar", y su recomendación es "No contactar".
9. **Given** un contacto marcado "No contactar", **When** un usuario con permiso de modificación lo vuelve a "Contactable", **Then** el cambio se registra con quién y cuándo. Ningún proceso automático puede hacer este cambio.
10. **Given** un usuario con permiso de solo lectura sobre Contactos, **When** abre el panel, **Then** ve toda la información pero no puede cambiar el interés ni la preferencia de contacto.

---

### User Story 3 - Saber a quién dar seguimiento y qué hacer (Priority: P3)

Como responsable comercial, quiero que cada contacto muestre su estado de seguimiento y una recomendación de próxima acción basada en reglas claras, y poder filtrar por ellos, para detectar oportunidades que estoy dejando pasar sin revisar contacto por contacto.

**Why this priority**: Responde "¿cuáles necesitan seguimiento?" y "¿qué oportunidades estoy dejando pasar?". Es la base que el análisis con IA (042) luego enriquecerá. Necesita la lista (Historia 1); se beneficia, pero no depende, de la clasificación manual (Historia 2).

**Independent Test**: Con umbrales por defecto, preparar contactos interesados con distintas antigüedades de última interacción, uno con actividad pendiente, uno con mensaje entrante sin responder y uno "No contactar", y comprobar el estado de seguimiento y la recomendación de cada uno, el conteo del indicador "Por recuperar" y el filtro por seguimiento.

**Acceptance Scenarios**:

1. **Given** un contacto Interesado cuya última interacción fue hace 9 días, sin actividades pendientes y contactable, **When** se muestra la lista, **Then** su seguimiento es "Por recuperar", cuenta en el indicador "Por recuperar" y su recomendación es "Retomar conversación".
2. **Given** ese mismo contacto con una actividad pendiente programada para el futuro, **When** se muestra la lista, **Then** no es "Por recuperar" (ya tiene un seguimiento activo) y su seguimiento es "Al día".
3. **Given** un contacto cuyo último mensaje lo escribió él y nadie le respondió, **When** se muestra la lista, **Then** su seguimiento es "Pendiente de seguimiento" y su recomendación es "Responder", sin importar cuántos días pasaron; nunca se trata como alguien que abandonó la conversación.
4. **Given** un contacto Interesado con interés Alto cuya última interacción fue hace 4 días, **When** se muestra la lista, **Then** su seguimiento es "Pendiente de seguimiento" y su recomendación es "Contactar hoy".
5. **Given** un Lead sin señales comerciales y sin interacción hace 70 días, **When** se muestra la lista, **Then** su seguimiento es "Inactivo" y **no** aparece como "Por recuperar": la inactividad sola no lo hace recuperable.
6. **Given** un administrador de la cuenta, **When** cambia en la configuración los días que definen "Pendiente", "Por recuperar" o "Inactivo", **Then** el seguimiento, la recomendación y el indicador "Por recuperar" reflejan los nuevos umbrales en la siguiente visita a Contactos.
7. **Given** la lista, **When** el usuario abre "Más filtros" y elige un estado de seguimiento, **Then** la tabla muestra solo los contactos en ese estado, combinado con los demás filtros activos.
8. **Given** un cliente sin señales de interés actual y sin interacción hace más del umbral de inactividad, contactable, **When** se muestra la lista, **Then** su recomendación es "Ofrecer novedades" (posible recompra) y no "Retomar conversación".

---

### Edge Cases

- **Cuenta sin Flujo de Venta configurado**: Cliente se determina por el estado clásico de pedido "Entregado", igual que los totales de Pedidos (038).
- **Flujo de Venta sin ninguna etapa marcada "Cuenta como Venta"**: no hay Clientes (el indicador muestra 0, sin error). No debe "simplificarse" a contar todos los pedidos.
- **Contacto sin ninguna interacción registrada**: "Última actividad" muestra "Sin actividad"; para el seguimiento se usa la fecha de creación del contacto.
- **Contacto con varios canales**: la columna Canal muestra el de su conversación más reciente; el filtro por canal incluye al contacto si tiene cualquier identificador en ese canal.
- **Contacto sin canal** (creado a mano, sin conversaciones): la columna Canal muestra "—" y no aparece al filtrar por un canal concreto.
- **Cuenta sin contactos**: se muestra el estado vacío actual con la acción "Crear primer contacto"; los indicadores no se muestran.
- **Filtros que no devuelven resultados**: la tabla muestra un mensaje "Sin resultados para estos filtros" con la acción "Limpiar", y los indicadores siguen visibles.
- **Contacto eliminado mientras el panel está abierto**: el panel se cierra con un aviso y la lista se refresca.
- **Pedido cancelado después de haber contado como venta**: si deja de estar en una etapa que cuenta como venta, el contacto deja de ser Cliente (si no tiene otra compra) en la siguiente consulta.
- **Contacto de otra cuenta**: nunca aparece en indicadores, lista, búsqueda ni panel, aunque se conozca su identificador.
- **Cambio de umbral a un valor inválido** (cero, negativo, o "Por recuperar" menor que "Pendiente"): se rechaza con un mensaje claro y se conservan los valores anteriores.

## Requirements *(mandatory)*

### Functional Requirements

**Lista e indicadores (Historia 1)**

- **FR-001**: El sistema MUST mostrar en Contactos cinco indicadores compactos —Total contactos, Clientes, Interesados, Por recuperar, Leads— calculados sobre todos los contactos de la cuenta, independientes de la página visible.
- **FR-002**: Los indicadores MUST ser interactivos: al seleccionar uno, la tabla se filtra a ese segmento y el indicador queda resaltado de forma sutil. Seleccionar "Total contactos" equivale a "Todos".
- **FR-003**: El sistema MUST mostrar una fila de pestañas rápidas —Todos, Clientes, Interesados, Por recuperar, Leads— con su conteo, que comparte el mismo estado de filtro que los indicadores.
- **FR-004**: El sistema MUST explicar, mediante un elemento de información discreto, que los segmentos pueden superponerse y no tienen por qué sumar el total.
- **FR-005**: El sistema MUST NOT mostrar tendencias ("vs. mes anterior") ni ningún dato que no salga de registros reales de la cuenta.
- **FR-006**: El tipo Cliente MUST derivarse en cada consulta de los pedidos que cuentan como venta según la configuración vigente del Flujo de Venta (misma regla que los totales de Pedidos), y MUST NOT guardarse en el contacto ni deducirse de la IA.
- **FR-007**: El tipo Interesado y el tipo Lead MUST calcularse según las reglas de la sección "Conceptos".
- **FR-008**: La tabla MUST mostrar las columnas Contacto (avatar o iniciales, nombre completo y un dato secundario —teléfono o email—), Tipo, Interés, Última actividad, Canal, Recomendación y Acciones, con insignias pequeñas y de color suave que no compitan con el nombre.
- **FR-009**: La tabla MUST paginarse en el servidor: cada página trae solo sus filas, y el total y los indicadores se calculan sin cargar todos los contactos. El usuario MUST poder elegir el tamaño de página.
- **FR-010**: La búsqueda MUST encontrar contactos por nombre, apellido, email, teléfono principal y teléfono secundario, con coincidencia parcial y sin distinguir mayúsculas.
- **FR-011**: El sistema MUST ofrecer como filtros visibles Tipo, Interés, Canal y Última actividad (Hoy, Últimos 7 días, Últimos 30 días, Más de 30 días, Sin actividad), y en "Más filtros" el estado de Seguimiento y la preferencia de contacto, más una acción "Limpiar".
- **FR-012**: El orden por defecto MUST ser por prioridad de atención: (1) contactos con mensaje sin responder, (2) Pendiente de seguimiento, (3) Por recuperar, (4) el resto; dentro de cada grupo, por última actividad de la más reciente a la más antigua (los contactos sin actividad al final). El usuario MUST poder cambiarlo a nombre, última actividad o interés, y volver al orden por prioridad. Cualquier orden se aplica a todo el conjunto filtrado, no solo a la página visible.
- **FR-013**: La búsqueda, los filtros y el orden MUST conservarse al cambiar de página y al abrir o cerrar el panel lateral. No se guardan en la dirección de la página ni sobreviven a salir del módulo (mismo comportamiento que Pedidos y Preparación).
- **FR-014**: La "última actividad" de un contacto MUST reflejar su interacción más reciente: mensaje escrito por el contacto, mensaje enviado por una persona del equipo, actividad registrada o pedido creado. Los mensajes enviados automáticamente por la IA o por un Workflow MUST NOT actualizarla, para que los envíos automáticos no oculten a quien dejó de responder. El mismo valor alimenta la columna "Última actividad", su filtro y el seguimiento. Los contactos existentes MUST obtener este dato a partir de su historial al activarse la feature.
- **FR-015**: Los rangos de fecha de "Última actividad" y de seguimiento MUST calcularse en la zona horaria del negocio configurada en la cuenta.
- **FR-016**: La columna y el estado "Activo / Inactivo / Lead" actuales MUST dejar de mostrarse en el listado; el dato existente no se borra.
- **FR-017**: El menú de acciones de cada fila (Ver detalle, Editar, Eliminar) MUST conservar su comportamiento y sus permisos actuales.
- **FR-018**: En pantallas pequeñas, la lista MUST presentarse como tarjetas compactas y los indicadores MUST acomodarse sin desplazamiento horizontal de la página.

**Panel lateral, interés y No contactar (Historia 2)**

- **FR-019**: Al seleccionar un contacto, el sistema MUST abrir un panel lateral con información general, actividad comercial, una sección de análisis de IA (mostrando "Sin analizar" hasta que exista la spec 042) y acciones rápidas, sin perder el estado de la lista.
- **FR-020**: La ficha completa del contacto MUST seguir disponible y accesible desde el panel.
- **FR-021**: Los usuarios con permiso de modificación sobre Contactos MUST poder cambiar el nivel de interés (Alto, Medio, Bajo, Sin evaluar). Un cambio manual MUST quedar fijado y MUST NOT ser sobrescrito por ningún proceso automático; solo una persona puede cambiarlo o liberarlo.
- **FR-022**: Cada cambio de interés y de preferencia de contacto MUST quedar registrado con valor anterior, valor nuevo, origen (manual, regla o IA), usuario si lo hubo y fecha, y MUST poder consultarse desde el panel.
- **FR-023**: Los usuarios con permiso de modificación MUST poder marcar un contacto como "No contactar" y volver a marcarlo "Contactable". Ningún proceso automático MUST poder pasar un contacto de "No contactar" a "Contactable".
- **FR-024**: Mientras un contacto esté en "No contactar", la IA conversacional y los Workflows MUST NOT enviarle ningún mensaje saliente. El bloqueo MUST aplicarse en cada punto del sistema desde el que la IA o un Workflow emiten mensajes.
- **FR-025**: Mientras un contacto esté en "No contactar", un envío manual de un usuario MUST mostrar un aviso visible antes de enviar, pero MUST NOT bloquearse.
- **FR-026**: Al activarse la feature, el nivel de interés de los contactos que ya tienen una intención comercial interpretada en su perfil MUST sembrarse a partir de ella, con origen IA, siguiendo una tabla de equivalencias documentada; el resto queda en "Sin evaluar". Esta siembra ocurre una sola vez.
- **FR-027**: El perfil del cliente MUST contar las compras con la misma regla de venta que FR-006, para que el panel, la ficha y los indicadores nunca se contradigan.

**Seguimiento y recomendación (Historia 3)**

- **FR-028**: El estado de seguimiento MUST derivarse en cada consulta, sin guardarse, con estas reglas en orden de precedencia:
  1. **Pendiente de seguimiento** si el último mensaje de la conversación más reciente lo escribió el contacto y no tiene respuesta (una respuesta automática de la IA o de un Workflow sí cuenta como respuesta), o si tiene una actividad pendiente vencida.
  2. **Al día** si tiene una actividad pendiente no vencida, o si su última interacción es más reciente que el umbral "Pendiente".
  3. Si es **Interesado**, es contactable y su interés no fue fijado manualmente en Bajo: **Pendiente de seguimiento** si su última interacción está entre el umbral "Pendiente" y el umbral "Por recuperar"; **Por recuperar** si es igual o más antigua que el umbral "Por recuperar".
  4. **Inactivo** si su última interacción es igual o más antigua que el umbral "Inactivo".
  5. **Al día** en cualquier otro caso.
- **FR-029**: Un contacto en "No contactar" MUST NOT quedar nunca en "Pendiente de seguimiento" ni "Por recuperar" por reglas de fechas.
- **FR-030**: Los umbrales en días ("Pendiente", "Por recuperar", "Inactivo") MUST ser configurables por cuenta por un usuario con permiso de configuración, con valores por defecto de 3, 7 y 60 días, y MUST validarse como enteros positivos con Pendiente < Por recuperar ≤ Inactivo.
- **FR-031**: Cada contacto MUST mostrar una recomendación derivada por reglas, la primera que aplique: "No contactar" (preferencia activa) → "Responder" (mensaje del contacto sin respuesta) → "Retomar conversación" (Por recuperar) → "Contactar hoy" (Pendiente con interés Alto) → "Dar seguimiento" (Pendiente) → "Ofrecer novedades" (Cliente inactivo sin interés actual) → "Evaluar" (Lead con interés Sin evaluar) → "Sin urgencia".
- **FR-032**: La recomendación MUST ser solo una sugerencia: el sistema MUST NOT enviar mensajes, crear actividades ni modificar registros a partir de ella.

**Transversales**

- **FR-033**: Toda consulta, conteo, búsqueda y cambio MUST limitarse a la cuenta del usuario; un contacto de otra cuenta MUST NOT ser visible ni modificable.
- **FR-034**: Ver la lista, los indicadores y el panel MUST requerir el permiso de lectura existente del módulo Contactos; cambiar interés o preferencia de contacto MUST requerir el permiso de modificación existente.
- **FR-035**: Los cambios de interés y de preferencia de contacto MUST publicar eventos de dominio, nombrados en pasado y documentados junto al resto de eventos del sistema.
- **FR-036**: Los demás módulos que hoy listan o buscan contactos (Pipeline, selectores de contacto en Pedidos, Cotizaciones y Actividades) MUST conservar su comportamiento actual.
- **FR-037**: La pantalla MUST respetar la identidad visual actual de Karia en modo oscuro y claro: verde solo como acento, colores intensos solo para significado (tipo, interés, recomendación), sin gradientes llamativos, sombras excesivas ni cifras gigantes.
- **FR-038**: El botón "Analizar con IA" MUST NOT aparecer hasta que exista la spec 042.
- **FR-039**: La tabla MUST NOT mostrar casillas de selección de filas ni acciones en lote en esta spec; llegan en la 042 con "Analizar seleccionados".

### Key Entities

- **Contacto** *(existente)*: gana el nivel de interés (con origen y si fue fijado manualmente), la preferencia de contacto (No contactar desde cuándo, por quién y con qué origen) y la fecha de su última interacción. El estado actual (Activo / Inactivo / Lead) se conserva pero deja de mostrarse.
- **Cambio de clasificación del contacto** *(nuevo)*: registro histórico de cada cambio de nivel de interés o de preferencia de contacto: qué dimensión, valor anterior, valor nuevo, origen (manual, regla, IA), usuario y fecha.
- **Configuración de seguimiento** *(parte de la configuración de la cuenta)*: los tres umbrales en días que definen Pendiente, Por recuperar e Inactivo.
- **Pedido, Etapa del Flujo de Venta** *(existentes)*: determinan si un contacto es Cliente mediante la marca "Cuenta como Venta" de la etapa (038).
- **Oportunidad, Cotización** *(existentes)*: señales comerciales objetivas para Interesado.
- **Actividad** *(existente)*: actividades pendientes, vencidas o no, para el seguimiento.
- **Conversación, Mensaje, Identificador de canal** *(existentes)*: canal del contacto, mensajes sin responder y última interacción.
- **Perfil del cliente** *(existente, 012)*: fuente de la siembra inicial del interés; pasa a contar compras con la regla de venta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario responde "¿cuántos clientes reales tengo?", "¿cuántos están interesados?" y "¿cuántos están por recuperar?" en menos de 10 segundos desde que abre Contactos, sin aplicar filtros.
- **SC-002**: Un usuario llega desde la pantalla de Contactos a la lista de contactos por recuperar en un solo clic.
- **SC-003**: En una cuenta con 20.000 contactos, la primera página con sus indicadores aparece en menos de 2 segundos, y cambiar de página, filtro u orden muestra resultados en menos de 1 segundo en el 95 % de los casos.
- **SC-004**: El 100 % de los contactos que cuentan como Cliente tienen al menos un pedido en una etapa marcada "Cuenta como Venta" (o "Entregado" sin flujo), y ningún contacto con pedidos solo cancelados o en etapas que no cuentan aparece como Cliente.
- **SC-005**: Cero mensajes salientes de la IA o de Workflows a contactos marcados "No contactar" a partir del momento en que se marcan.
- **SC-006**: El 100 % de los cambios de interés y de preferencia de contacto quedan trazados con origen, usuario y fecha.
- **SC-007**: Encontrar un contacto conociendo solo parte de su teléfono o su email se logra con una sola búsqueda.
- **SC-008**: Las acciones existentes del listado (ver, editar, eliminar) y los selectores de contacto de los demás módulos siguen funcionando igual que antes, verificado por las pruebas existentes.

## Assumptions

- **Alcance sin IA nueva**: esta spec no agrega llamadas a modelos de IA. El análisis con IA, las estrategias de análisis configurables por cuenta, el puntaje 0–100 y el análisis masivo (solo administradores) son la spec 042, que reemplazará la recomendación por reglas por la de la IA donde exista.
- **Filtros fuera de la dirección de la página**: se sigue el patrón de Pedidos y Preparación por decisión del usuario; no se pueden compartir enlaces filtrados.
- **No contactar en envíos humanos**: solo avisa, no bloquea, por decisión del usuario. Para la IA y los Workflows bloquea siempre.
- **Umbrales por defecto** (3 / 7 / 60 días): valores razonables para comercio por mensajería; cada cuenta puede ajustarlos.
- **"Rechazo explícito"**: sin IA, se expresa fijando manualmente el interés en Bajo (lo excluye de Interesado y de Por recuperar) o marcando "No contactar". La detección automática llega con 042.
- **Siembra de interés única**: después de la siembra inicial, el interés no se actualiza automáticamente por la interpretación del perfil (012); solo por personas en esta spec y por la IA en 042.
- **Última actividad** cuenta mensajes del contacto o de personas del equipo, actividades y pedidos; no cuenta mensajes automáticos (IA o Workflow) ni ediciones de datos del contacto.
- **Canal mostrado**: el de la conversación más reciente; los canales posibles son los que Karia ya integra (WhatsApp, Instagram, Facebook Messenger, Email, etc.).
- **Permisos**: se reutilizan los permisos de lectura y modificación del módulo Contactos y el permiso de configuración existente para los umbrales; no se crean roles nuevos.
- **Seguimiento en la Historia 1**: el indicador "Por recuperar" y el orden por prioridad de la Historia 1 necesitan el cálculo de seguimiento (FR-028) con los umbrales por defecto, así que ese cálculo se entrega con la Historia 1. La Historia 3 suma la configuración de umbrales, el filtro por seguimiento y la columna Recomendación (FR-031); si la Historia 1 se publica sola, esa columna todavía no se muestra.
- **Fotos de los mockups**: se muestra el avatar si el contacto lo tiene y, si no, sus iniciales, como hoy.
- **Botón "Importar"** de los mockups: fuera de alcance de esta spec.

## Deuda técnica

Lo que queda fuera de esta spec a sabiendas, para retomarlo después. Nada de esto bloquea la 041.

| # | Pendiente | Por qué queda pendiente | Cuándo retomarlo |
|---|---|---|---|
| DT-01 | Validar que el orden por prioridad de atención (FR-012) cumple SC-003 con 20.000 contactos | Depende de cómo se calcule el seguimiento en la consulta; se mide en el plan o la implementación | Si no cumple, buscar una alternativa sin persistir el seguimiento (es derivado por diseño) |
| DT-02 | Qué valor toma el interés cuando una persona "libera" un valor fijado a mano | Caso poco frecuente. Hasta decidirlo, al liberar vuelve a "Sin evaluar" con origen manual y queda en el historial | Con la 042, cuando la IA pueda volver a proponer un valor |
| DT-03 | Tendencias "vs. mes anterior" en los indicadores | No hay historial de segmentos ni de interés; mostrarlas exige guardar fotos periódicas de los conteos | Cuando se decida guardar esas fotos (por ejemplo, una por mes desde el worker) |
| DT-04 | Botón "Importar" de los mockups | Fuera del alcance de la segmentación | Spec propia de importación de contactos |
| DT-05 | Búsqueda parcial a gran escala | La búsqueda por coincidencia parcial en cinco campos alcanza para decenas de miles de contactos, no para cientos de miles | Si una cuenta supera ~100.000 contactos o la búsqueda deja de cumplir SC-003 |
| DT-06 | Campos heredados sin uso en la UI: estado del contacto (Activo / Inactivo / Lead) y la marca "activo" | Se dejan de mostrar pero no se borran, para no romper integraciones ni datos existentes | Limpieza cuando se confirme que nada los lee |
| DT-07 | Colores escritos a mano (sin tokens del sistema de diseño) en la ficha completa del contacto | La 041 solo corrige los componentes que reutiliza en el panel lateral | Próximo cambio visual de la ficha |
