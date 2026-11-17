# Feature Specification: Inbox agrupado por contacto

**Feature Branch**: `feature/035-inbox-agrupado-contacto`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Inbox agrupado por contacto: vista multicanal del Inbox que agrupa las conversaciones por contacto en vez de mostrar una fila plana por conversación. Solo presentación — no toca base de datos, ni worker, ni IA, ni Workflows, ni el resolver de mensajes entrantes. Incluye: lista agrupada con las conversaciones como hijos, badges agregados a nivel de grupo, banner cruzado 'también hay un mensaje nuevo por <canal>', y una sección 'Identidades / canales vinculados' en el panel derecho. Fuera de alcance: enrutamiento real del selector de canal, 'canal principal', separación de hilos por canal, fusión de contactos, consultas nuevas."

> **Por qué es Feature y no Hotfix**: el Inbox nunca mostró la relación entre las conversaciones de una
> misma persona. No hay un comportamiento prometido que esté fallando: hay una capacidad que falta —
> presentar el Inbox centrado en el contacto en vez de en la conversación suelta. Ver el árbol de decisión
> en `docs/SPEC-KIT-WORKFLOWS.md`.

> **Esta feature NO cambia cómo se agrupan los mensajes por dentro.** El resolver de mensajes entrantes
> queda idéntico: el correo sigue teniendo conversación propia y el resto de los canales sigue reutilizando
> la conversación del contacto. Lo que cambia es exclusivamente cómo se *presenta* lo que ya existe. La
> separación real de hilos por canal es otra feature, posterior y con migración.

---

## Contexto del cambio

El Inbox de Karia muestra hoy **una fila por conversación**. Como una misma persona puede tener más de una
conversación —el correo siempre abre la suya, y un buzón configurado por hilo abre una por asunto—, el mismo
cliente aparece varias veces en la lista sin ninguna señal de que se trata de la misma persona.

Eso produce tres problemas concretos para quien atiende:

1. **No se sabe a quién se está atendiendo.** Dos filas con el mismo nombre parecen dos clientes distintos.
2. **Se responde dos veces, o no se responde.** Si el cliente escribió por correo y por WhatsApp, quien
   abre una de las dos conversaciones no tiene forma de enterarse de la otra.
3. **La duplicación de identidades es invisible.** Un cliente que escribe por Instagram y por WhatsApp hoy
   son dos contactos distintos (el identificador de Instagram no se parece a un teléfono ni a un correo, así
   que nunca se deduplica solo). Nadie se entera nunca, porque el Inbox no muestra las identidades de un
   contacto en ningún lado.

El dato para resolver los tres ya está cargado en pantalla: la lista del Inbox trae todas las conversaciones
con su contacto y sus identificadores de canal. Esta feature no va a buscar información nueva — va a mostrar
la que hoy se descarta.

**Límite explícito de esta feature**: no promete nada que el sistema no haga hoy. Donde una persona tiene
una sola conversación, se ve una sola conversación. El canal del chat abierto se muestra como etiqueta de lo
que es, no como un selector que insinúe que se puede elegir por dónde responder.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver a quién estoy atendiendo, no cuántos hilos tengo (Priority: P1)

Como agente que atiende el Inbox, quiero que la lista me muestre **personas** y, dentro de cada persona, sus
conversaciones, para entender de un vistazo que esas tres filas que veo son en realidad un solo cliente con
tres conversaciones abiertas.

**Why this priority**: es el cambio que resuelve el problema de fondo (saber a quién se atiende) y del que
dependen los otros dos. Entregado solo, ya cambia la experiencia: la lista deja de mentir sobre cuántos
clientes hay esperando.

**Independent Test**: con un contacto que tenga dos o más conversaciones, abrir el Inbox y verificar que
aparece una sola fila de persona, con sus conversaciones adentro, y que al elegir cualquiera de ellas se
abre el chat correcto.

**Acceptance Scenarios**:

1. **Given** un contacto con dos conversaciones (una de correo y una de WhatsApp), **When** el agente abre
   el Inbox, **Then** ve una sola fila con el nombre de la persona, un indicador de cuántas conversaciones
   tiene, y las dos conversaciones listadas debajo, cada una con su canal y la hora de su último mensaje.
2. **Given** un contacto con una sola conversación, **When** el agente abre el Inbox, **Then** ve una fila
   simple equivalente a la de hoy, sin nivel extra de anidamiento ni indicadores de grupo.
3. **Given** una persona con dos conversaciones donde solo una tiene mensajes sin leer, **When** el agente
   mira la fila de la persona, **Then** el indicador de no leídos de la fila refleja el total de la persona
   y la conversación concreta que los tiene queda identificada dentro del grupo.
4. **Given** una persona cuya conversación requiere atención humana, **When** el agente mira la lista,
   **Then** el aviso de atención humana es visible en la fila de la persona aunque el grupo esté colapsado.
5. **Given** un grupo colapsado, **When** el agente lo expande o lo colapsa, **Then** el estado se conserva
   mientras siga en el Inbox, incluso después de que la lista se refresque sola.
6. **Given** una conversación abierta en el chat, **When** la lista se refresca sola, **Then** la selección
   y la posición del scroll se mantienen como hoy.

---

### User Story 2 - Enterarme de que el mismo cliente escribió por otro canal (Priority: P2)

Como agente que está respondiendo una conversación, quiero que me avise si esa misma persona escribió algo
más nuevo por otro canal, para no responder a medias ni duplicar la respuesta.

**Why this priority**: es el error más caro del día a día y el que el cliente nota. Depende de la
agrupación de la P1 para saber qué conversaciones son de la misma persona.

**Independent Test**: con un contacto que tenga dos conversaciones y un mensaje sin leer más reciente en la
segunda, abrir la primera y verificar que aparece el aviso con acceso a la otra.

**Acceptance Scenarios**:

1. **Given** un contacto con una conversación abierta en pantalla y otra conversación del mismo contacto con
   un mensaje sin leer más reciente, **When** el agente mira el chat, **Then** ve un aviso que nombra el
   otro canal y cuándo escribió.
2. **Given** ese aviso visible, **When** el agente lo usa para saltar, **Then** el Inbox abre la otra
   conversación de la misma persona.
3. **Given** ese aviso visible, **When** el agente lo descarta, **Then** el aviso desaparece para esa
   conversación y no vuelve a aparecer por el mismo mensaje.
4. **Given** un contacto cuya otra conversación no tiene mensajes sin leer, o los tiene más viejos que el
   hilo abierto, **When** el agente abre el chat, **Then** no se muestra ningún aviso.

---

### User Story 3 - Ver todas las identidades por las que me puede escribir un cliente (Priority: P3)

Como agente, quiero ver en el panel del contacto todos los canales e identificadores con los que esa persona
está registrada (correo, usuario de Instagram, número de WhatsApp), para saber por dónde me puede escribir y
para detectar cuándo dos registros son en realidad la misma persona.

**Why this priority**: es la que menos urgencia operativa tiene en el momento, pero es la que hace visible
el problema de identidades duplicadas y prepara la fusión de contactos de una feature posterior.

**Independent Test**: abrir cualquier conversación de un contacto que tenga más de un identificador de canal
y verificar que todos aparecen listados en el panel derecho.

**Acceptance Scenarios**:

1. **Given** un contacto con identificadores de correo e Instagram, **When** el agente abre cualquiera de sus
   conversaciones, **Then** el panel derecho lista ambos, cada uno con su canal y su identificador o usuario
   visible.
2. **Given** una identidad que tiene una conversación cargada en el Inbox, **When** el agente la elige desde
   el panel, **Then** se abre esa conversación.
3. **Given** una identidad sin conversación cargada en el Inbox, **When** el agente la mira, **Then** la ve
   listada como canal registrado, sin acción de apertura y sin fecha de última actividad.
4. **Given** un contacto con una sola identidad, **When** el agente abre el panel, **Then** la sección se
   muestra igual, con esa única identidad.

---

### Edge Cases

- **Persona sin nombre registrado** (contacto creado automáticamente desde un canal): la fila de la persona
  se identifica con el dato disponible —teléfono, correo o usuario del canal— y mantiene la marca de "sin
  identificar" que ya existe hoy.
- **Dos conversaciones del mismo canal** (un buzón de correo agrupado por hilo): se listan las dos como
  hijos del mismo grupo y se distinguen por su asunto, no solo por el canal.
- **Un filtro deja visible solo una parte de las conversaciones de la persona**: la fila de la persona se
  muestra con las conversaciones que pasan el filtro, y su contador refleja únicamente esas.
- **Una búsqueda coincide con el nombre de la persona pero no con sus mensajes**: la persona aparece con
  todas sus conversaciones; si la coincidencia es con el contenido de una conversación concreta, aparece con
  esa.
- **La conversación abierta deja de pasar el filtro activo** (por ejemplo, se cierra): el chat sigue abierto
  como hoy; la feature no cambia ese comportamiento.
- **La persona tiene conversaciones en estados distintos** (una abierta y una cerrada): el grupo se muestra
  bajo el criterio de orden de la conversación más prioritaria, y cada conversación conserva su estado
  propio.
- **Llega un mensaje nuevo mientras el grupo está colapsado**: el aviso de no leídos aparece en la fila de la
  persona sin forzar la expansión.
- **El contacto de una conversación cambia mientras el Inbox está abierto** (alguien la vincula a otra
  persona): en el siguiente refresco la conversación aparece bajo la persona correcta.
- **Pantalla angosta**: la lista agrupada ocupa el ancho completo y se oculta al abrir una conversación,
  exactamente como hoy.

## Requirements *(mandatory)*

### Functional Requirements

#### Lista agrupada

- **FR-001**: El Inbox MUST presentar sus conversaciones agrupadas por contacto: una fila por persona, con
  sus conversaciones listadas dentro.
- **FR-002**: Cada conversación dentro del grupo MUST mostrar su canal, la hora de su último mensaje y si
  tiene mensajes sin leer.
- **FR-003**: La fila de la persona MUST indicar cuántas conversaciones tiene cuando son más de una.
- **FR-004**: Un contacto con una sola conversación MUST verse como una fila simple, sin anidamiento ni
  indicadores de grupo.
- **FR-005**: La fila de la persona MUST agregar, sobre sus conversaciones visibles, el indicador de
  mensajes sin leer, el aviso de atención humana y el estado, sin que se pierda el detalle de cada
  conversación.
- **FR-006**: Los grupos de más de una conversación MUST poder expandirse y colapsarse, y el estado de
  expansión MUST sobrevivir a los refrescos automáticos de la lista.
- **FR-007**: Elegir una conversación dentro de un grupo MUST abrir esa conversación en el chat, con el
  mismo comportamiento que hoy.

#### Filtros, búsqueda y orden

- **FR-008**: Los contadores de los filtros MUST seguir contando **conversaciones**, no personas, para no
  cambiar el significado de los números que el agente ya conoce.
- **FR-009**: Una persona MUST aparecer en la lista si al menos una de sus conversaciones pasa el filtro
  activo, y MUST mostrar únicamente las conversaciones que lo pasan.
- **FR-010**: La búsqueda MUST seguir operando sobre los mismos datos que hoy (nombre, teléfono y contenido
  del último mensaje) y MUST mostrar la persona cuando cualquiera de sus conversaciones coincide.
- **FR-011**: El orden de la lista MUST seguir el mismo criterio que hoy, aplicado a la conversación más
  prioritaria de cada persona.

#### Aviso de otro canal

- **FR-012**: Cuando la conversación abierta pertenece a una persona que tiene otra conversación con
  mensajes sin leer más recientes, el chat MUST mostrar un aviso que nombre el otro canal y cuándo escribió.
- **FR-013**: El aviso MUST permitir saltar a esa otra conversación.
- **FR-014**: El aviso MUST poder descartarse, y una vez descartado no MUST volver a mostrarse por el mismo
  mensaje.
- **FR-015**: El aviso MUST calcularse únicamente con las conversaciones ya cargadas en el Inbox, sin pedir
  información adicional al servidor.

#### Identidades del contacto

- **FR-016**: El panel del contacto MUST listar todas las identidades de canal registradas de esa persona,
  con su canal y su identificador o usuario visible.
- **FR-017**: Una identidad cuya conversación esté cargada en el Inbox MUST permitir abrirla desde el panel.
- **FR-018**: Una identidad sin conversación cargada MUST mostrarse como canal registrado, sin acción de
  apertura y sin fecha de última actividad.

#### Límites y no regresión

- **FR-019**: La vista MUST construirse exclusivamente con la información que el Inbox ya carga: la feature
  NO MUST agregar consultas al servidor ni aumentar la frecuencia de las existentes.
- **FR-020**: El canal de la conversación abierta MUST presentarse como una etiqueta de lo que es, NO como
  un selector que sugiera que se puede elegir por dónde se envía la respuesta.
- **FR-021**: La feature NO MUST introducir el concepto de "canal principal", que hoy no existe.
- **FR-022**: La feature NO MUST alterar el comportamiento existente del Inbox: selección de conversación,
  actualización en tiempo real, refresco automático, marcado de leídos, filtros, búsqueda, envío de
  mensajes, panel de contacto y comportamiento en pantallas angostas deben quedar idénticos.
- **FR-023**: La feature NO MUST modificar cómo se crean, agrupan o enrutan las conversaciones y los
  mensajes entrantes, ni el comportamiento de la IA, los Workflows o el procesamiento en segundo plano.

### Key Entities

- **Persona (contacto)**: quien escribe. Agrupa a todas sus conversaciones e identidades. Es el nuevo nivel
  superior de la lista.
- **Conversación**: un hilo de mensajes con su canal, su estado y sus mensajes sin leer. Sigue siendo la
  unidad que se abre, se responde y se cierra — la feature no cambia su naturaleza.
- **Identidad de canal**: la dirección, el número o el usuario por el que una persona está registrada en un
  canal. Hoy ya existe y no se muestra en ninguna parte.
- **Grupo de contacto**: agrupación de presentación, derivada en el momento a partir de las conversaciones
  ya cargadas. No se guarda en ningún lado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un cliente que tiene conversaciones en dos o más canales, el agente puede saber cuántos
  canales tiene activos y cuál escribió último **sin abrir ninguna conversación**.
- **SC-002**: En el 100% de los casos en que un cliente tiene un mensaje sin leer más reciente en otra
  conversación, el agente ve el aviso correspondiente antes de responder.
- **SC-003**: La vista agrupada NO aumenta la cantidad de consultas al servidor: misma carga inicial y mismo
  refresco periódico que la vista actual, medidos con el mismo Inbox y los mismos datos.
- **SC-004**: Con 200 conversaciones cargadas, filtrar, buscar y expandir grupos responde sin retraso
  perceptible para el agente (equivalente a la experiencia actual).
- **SC-005**: El 100% de los flujos del Inbox que funcionan hoy siguen funcionando igual después del cambio
  (selección, tiempo real, refresco, leídos, filtros, búsqueda, envío, panel de contacto, pantalla angosta).
- **SC-006**: Un agente que nunca vio la vista nueva puede identificar, sin ayuda, cuáles filas son una sola
  persona con varias conversaciones.

## Assumptions

- **La agrupación es por contacto registrado, no por persona real.** Dos registros distintos de la misma
  persona (caso típico: Instagram frente a WhatsApp) siguen siendo dos filas hasta que alguien los vincule.
  Esta feature los hace visibles; no los une. La fusión de contactos es una feature posterior.
- **El universo de la vista es lo que el Inbox ya carga** (conversaciones abiertas y en espera, más las
  últimas cerradas). Una conversación vieja fuera de esa carga no aparece en el grupo, igual que hoy no
  aparece en la lista.
- **El contador de la cabecera del grupo refleja las conversaciones visibles bajo el filtro activo**, para
  que la suma de los grupos cuadre con el contador del filtro.
- **Descartar el aviso de otro canal es una decisión local del agente** y dura mientras esa conversación
  siga abierta en su sesión; no se guarda ni se comparte con otros agentes.
- **La vista se arma en el momento, a partir de los datos ya cargados.** No se guarda ninguna agrupación ni
  preferencia en la base de datos.
- **Las identidades de canal ya viajan con los datos del Inbox** y hoy se descartan al presentarlos:
  mostrarlas no agrega trabajo a la base de datos.
- **El valor visible de la agrupación depende de la mezcla de canales de la cuenta.** En una cuenta con un
  solo canal de mensajería, la mayoría de los grupos tendrá una sola conversación y la lista se verá
  parecida a la de hoy; el beneficio completo aparece en cuentas con correo además de mensajería, y crece
  cuando una feature posterior separe los hilos por canal.
