# Feature Specification: Corregir reacciones (❤️ y demás) en Facebook Messenger

**Feature Branch**: `[008-fix-facebook-messenger-reacciones]`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "por algun motivo las reacciones para la integracion como los corazones y eso a pesar que en el sistema se hacen no se ven en la conversacion real de Facebook, y si el usuario tambien reacciona desde su cuenta de Facebook tampoco se ve en Karia App. Entiendo que en instagram se implemento y funciona pero en Facebook falla, necesito corregir para que funcione perfecto la reaccion."

## Diagnóstico previo (investigación de código + documentación de Meta)

Antes de definir el alcance, se investigó por qué las reacciones fallan en las dos direcciones para Facebook Messenger, comparando contra Instagram (que sí funciona hoy):

**Enviar una reacción desde Karia hacia Facebook (no llega al cliente):**
- Cuando un agente reacciona a un mensaje en el CRM, el sistema siempre guarda la reacción en la base de datos primero — por eso "en el sistema se hace" y se ve en Karia, sin importar el canal.
- Recién después, el sistema intenta reenviar esa reacción al canal externo — pero **solo lo hace si el proveedor del canal declara soporte para reacciones**. El proveedor de Instagram sí lo declara y sabe cómo enviarlo a Meta. El proveedor de Facebook Messenger, construido en `005-facebook-messenger-integracion`, **no declara ese soporte y no sabe cómo enviarlo** — quedó fuera de alcance en ese momento. Por eso la reacción nunca sale de Karia hacia Facebook.
- Se confirmó contra la documentación oficial de Meta que Facebook Messenger sí soporta reaccionar/quitar reacción a un mensaje, con el mismo tipo de solicitud que ya usa Instagram — es viable corregirlo.

**Reaccionar desde Facebook (no llega a Karia):**
- Se confirmó contra la documentación oficial de Meta que, a diferencia de los mensajes (que llegan por un mismo aviso compartido entre Instagram vía Página y Messenger), **las reacciones de Facebook Messenger llegan por un aviso aparte, que hay que activar explícitamente al conectar la Página** — y esa activación hoy **no se pide** para Messenger. Es decir, Meta ni siquiera le está avisando a Karia que alguien reaccionó, porque nunca se le pidió ese aviso en particular.
- Incluso si esa activación se agrega, el código que procesa los avisos que llegan de Meta hoy **descarta explícitamente cualquier reacción que no sea de Instagram** — una decisión tomada también en `005-facebook-messenger-integracion`, cuando reaccionar por Messenger todavía no estaba en el alcance del pedido original.
- Conclusión: son dos causas independientes, una por cada dirección, ambas heredadas de que la integración de Facebook Messenger se construyó originalmente sin reacciones en el alcance (el pedido de aquel momento era "recibir y enviar mensajes"). No es una falla de configuración del usuario ni un problema del lado de Meta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un agente reacciona desde Karia y el cliente la ve en Facebook (Priority: P1)

Como agente que atiende una conversación de Facebook Messenger, cuando reacciono a un mensaje del cliente con un emoji (por ejemplo ❤️) desde el CRM, quiero que esa reacción le llegue realmente al cliente en su conversación de Facebook, igual que ya sucede hoy con Instagram.

**Why this priority**: Es la mitad del problema reportado y la que más rompe la confianza del agente — hoy la reacción "se ve enviada" en Karia pero el cliente nunca la recibe, lo cual es peor que no tener la función, porque engaña al agente sobre lo que el cliente realmente ve.

**Independent Test**: Desde una conversación de Facebook Messenger en Karia, reaccionar a un mensaje del cliente y confirmar, revisando la conversación real en Facebook, que la reacción aparece ahí.

**Acceptance Scenarios**:

1. **Given** una conversación de Messenger con un mensaje del cliente, **When** el agente le agrega una reacción desde Karia, **Then** la reacción aparece en la conversación real de Facebook del cliente.
2. **Given** un mensaje que ya tiene una reacción puesta desde Karia, **When** el agente la quita, **Then** la reacción también se quita en la conversación real de Facebook.
3. **Given** un mensaje que ya tiene una reacción puesta desde Karia, **When** el agente la cambia por otro emoji, **Then** la conversación real de Facebook refleja el nuevo emoji, no los dos a la vez.

---

### User Story 2 - El cliente reacciona desde Facebook y el agente la ve en Karia (Priority: P1)

Como agente, cuando un cliente le pone una reacción a uno de mis mensajes desde su Facebook, quiero verla reflejada en la conversación dentro de Karia, igual que ya sucede hoy con Instagram.

**Why this priority**: Es la otra mitad del problema reportado, igual de crítica — sin esto, el agente no tiene forma de saber que el cliente reaccionó, y pierde una señal de la conversación que si tiene disponible en Instagram.

**Independent Test**: Desde una cuenta de Facebook de prueba, reaccionar a un mensaje enviado por la Página conectada y confirmar que la reacción aparece en esa conversación dentro de Karia.

**Acceptance Scenarios**:

1. **Given** una conversación de Messenger con un mensaje ya enviado por la Página, **When** el cliente le pone una reacción desde su Facebook, **Then** esa reacción aparece en la conversación dentro de Karia.
2. **Given** un mensaje con una reacción del cliente ya reflejada en Karia, **When** el cliente la quita desde Facebook, **Then** la reacción también desaparece en Karia.

### Edge Cases

- ¿Qué pasa con las Páginas que ya estaban conectadas antes de esta corrección? Deben quedar recibiendo reacciones también, no solo las que se conecten de ahora en adelante — la activación del aviso de reacciones debe aplicar a cuentas ya conectadas, no únicamente a conexiones nuevas.
- ¿Qué pasa si Meta rechaza el envío de una reacción (por ejemplo, el mensaje ya no está dentro de la ventana de tiempo permitida)? La reacción queda igual visible en Karia (ya se guardó), sin bloquear al agente ni la conversación — mismo criterio de tolerancia a fallos que ya aplica al resto de los envíos de esta integración.
- ¿Qué pasa con conversaciones de Instagram mientras se corrige esto? No deben verse afectadas — el comportamiento de reacciones de Instagram, que ya funciona, debe seguir exactamente igual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST enviar a Facebook la reacción que un agente le pone a un mensaje de una conversación de Messenger desde Karia.
- **FR-002**: El sistema MUST enviar a Facebook la quita o el cambio de una reacción que un agente hace desde Karia sobre un mensaje de Messenger.
- **FR-003**: El sistema MUST recibir y reflejar en la conversación de Karia las reacciones que un cliente le pone a un mensaje desde su cuenta de Facebook.
- **FR-004**: El sistema MUST recibir y reflejar la quita de una reacción que un cliente hace desde su cuenta de Facebook.
- **FR-005**: El sistema MUST activar la recepción de reacciones también para las Páginas de Facebook Messenger que ya estaban conectadas antes de esta corrección, no solo para las que se conecten después.
- **FR-006**: El sistema MUST seguir funcionando con normalidad (sin bloquear la conversación ni al agente) cuando Facebook rechace el envío de una reacción por cualquier motivo.
- **FR-007**: El sistema MUST NOT alterar el comportamiento de reacciones ya existente de Instagram al corregir esto para Facebook Messenger.

### Key Entities

- **Reacción de mensaje**: ya existe en el CRM (se guarda al reaccionar desde Karia, sin cambios de estructura); esta corrección hace que también se envíe/reciba correctamente para conversaciones de Facebook Messenger.
- **Cuenta de canal (Facebook Messenger)**: la Página conectada — esta corrección agrega que quede suscrita también a recibir avisos de reacciones, además de los avisos de mensajes que ya recibe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las reacciones que un agente pone desde Karia en una conversación de Messenger llegan a la conversación real de Facebook del cliente, en menos de 10 segundos.
- **SC-002**: El 100% de las reacciones que un cliente pone desde Facebook a un mensaje de la Página llegan a la conversación en Karia, en menos de 10 segundos.
- **SC-003**: Quitar o cambiar una reacción desde cualquiera de los dos lados (Karia o Facebook) se refleja correctamente del otro lado, sin dejar reacciones duplicadas ni desactualizadas.
- **SC-004**: Las Páginas conectadas antes de esta corrección quedan recibiendo reacciones sin que el usuario tenga que reconectarlas manualmente.
- **SC-005**: El comportamiento de reacciones de Instagram no cambia en absoluto tras esta corrección.

## Assumptions

- Se investigó la documentación oficial de Meta y se confirmó que Facebook Messenger sí soporta reaccionar/quitar reacción con el mismo tipo de solicitud que ya usa Instagram — no es una limitación de la plataforma, es una función pendiente de completar en el código, igual que ya se corrigió antes para otras piezas de esta integración (conexión, mensajería, datos de contacto).
- La activación del aviso de reacciones para cuentas ya conectadas (FR-005) se resuelve del mismo modo en que ya se resolvió la activación del aviso de mensajes al conectar una Página — no requiere que el usuario vuelva a autorizar el login de Meta, solo una actualización de la suscripción ya existente.
- No se requiere ningún cambio de datos ni migración — se reutiliza el modelo de reacciones ya existente.
