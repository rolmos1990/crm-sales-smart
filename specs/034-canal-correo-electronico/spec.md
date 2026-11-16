# Feature Specification: Canal de correo electrónico

**Feature Branch**: `034-canal-correo-electronico`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "Plan corto: canal de correo electrónico en Karia. 1. Registrar el buzón: agregar Correo electrónico como canal, solicitar la dirección y luego los datos IMAP y SMTP (servidor, puerto, tipo de seguridad y contraseña), validar la conexión antes de activar el canal. 2. Configurar la recepción: agrupar correos en conversaciones, crear contactos automáticamente, oportunidad inicial a la que llegan los correos nuevos. 3. Aprobar remitentes desconocidos: si la creación automática está desactivada, los correos de remitentes sin contacto llegan con estado Pendiente de aprobación; mientras estén pendientes no se puede responder ni continuar la atención desde Karia; una vez aprobado el remitente, sus correos posteriores se reciben normalmente. Este bloqueo aplica únicamente a las oportunidades creadas desde el canal de correo."

> **Por qué es Feature y no Hotfix**: Karia nunca recibió ni envió correo como canal de atención. Existe un
> `EmailProvider` registrado en `src/conversaciones/providers/registry.ts`, pero su `enviarMensaje` solo
> escribe en consola y nunca hubo recepción: no hay nada roto que corregir, hay una capacidad que falta. Ver
> el árbol de decisión en `docs/SPEC-KIT-WORKFLOWS.md`.

> **No confundir con el correo transaccional**: `src/lib/email/` (Resend) envía los correos que *Karia* le
> manda al usuario del CRM — bienvenida, notificaciones. Es otro sistema, con otra credencial y otro dueño,
> y esta feature **no lo toca**.

---

## Contexto del cambio

Karia ya es multicanal: WhatsApp Lite, Instagram y Facebook Messenger entran por el mismo embudo —
contacto → conversación → oportunidad en una etapa del pipeline— y se atienden desde el mismo Inbox, con el
mismo agente de IA. El correo electrónico es el canal que falta, y para una parte del negocio (B2B,
cotizaciones, posventa, formularios de contacto del sitio web) es el canal principal.

La diferencia con los canales de mensajería no es el transporte, son tres cosas que el correo trae consigo:

1. **Las credenciales son del comercio, no de una plataforma.** No hay OAuth de Meta ni un QR: el negocio
   entrega la dirección y los datos IMAP/SMTP de su propio buzón. Si esos datos están mal, el canal no
   funciona y el negocio no se entera hasta que pierde un cliente — por eso la conexión se valida **antes**
   de activar el canal.
2. **A un buzón le escribe cualquiera.** Un número de WhatsApp lo conoce quien ya habló con el negocio; una
   dirección de correo publicada en un sitio web recibe proveedores, facturas, boletines y spam. Por eso el
   negocio necesita poder decidir que no todo remitente desconocido se convierta automáticamente en un
   contacto y una oportunidad del CRM.
3. **El correo arrastra su propio historial.** Cada respuesta trae citado todo el hilo anterior, llegan
   auto-respuestas de vacaciones y rebotes del servidor, y un mismo mensaje puede volver a leerse del buzón.
   Nada de eso debe ensuciar la conversación ni hacer que el agente de IA conteste de más.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar el buzón y recibir correos (Priority: P1)

El responsable del negocio entra a **Integraciones**, elige **Correo electrónico** y registra su buzón: la
dirección (`ventas@sunegocio.com`), un nombre para reconocerlo en el Inbox, y los datos de conexión de
entrada (servidor, puerto, tipo de seguridad, usuario y contraseña) y de salida. Antes de guardar, pulsa
**Probar conexión**: Karia verifica contra el servidor real y le dice, en lenguaje claro, si la cuenta quedó
accesible o qué falló (credenciales, servidor inalcanzable, puerto/seguridad incompatibles). Solo con la
prueba en verde puede activar el canal.

Elige además a qué **pipeline y etapa de entrada** llegan los correos nuevos — igual que ya hace con sus
números de WhatsApp. Si no elige ninguna, Karia usa el pipeline por defecto de la cuenta.

A partir de ese momento, cada correo que llega al buzón aparece en el Inbox como un mensaje más: con su
remitente, su asunto, su cuerpo legible, y la oportunidad correspondiente en la etapa configurada. En esta
historia la creación automática de contactos está **activada** (el comportamiento por defecto, el mismo que
tienen hoy los demás canales).

**Why this priority**: Es el MVP. Sin recibir correo, nada de lo demás existe. Entregada sola ya le da valor
al negocio: todo lo que entra al buzón queda registrado en el CRM, atribuido a un contacto y a una
oportunidad, visible para todo el equipo — aunque todavía se responda desde el cliente de correo de siempre.

**Independent Test**: Registrar un buzón de prueba, enviarle un correo desde una dirección externa, y
verificar en el Inbox que aparece la conversación con el contenido correcto y una oportunidad en la etapa
configurada.

**Acceptance Scenarios**:

1. **Given** el negocio está en Integraciones sin ningún buzón registrado, **When** completa la dirección y
   los datos de entrada y salida y pulsa Probar conexión con datos correctos, **Then** ve una confirmación de
   que ambas conexiones funcionan y puede guardar y activar el canal.
2. **Given** el negocio completó los datos con una contraseña incorrecta, **When** pulsa Probar conexión,
   **Then** ve un mensaje que identifica el problema como de credenciales, el canal **no** queda activo, y
   los datos que ya cargó siguen en el formulario para corregirlos.
3. **Given** un buzón activo con pipeline y etapa de entrada configurados, **When** una dirección nunca vista
   le escribe, **Then** Karia crea el contacto con esa dirección de correo, abre una conversación de correo y
   crea una oportunidad en la etapa configurada.
4. **Given** un buzón activo **sin** pipeline ni etapa configurados, **When** llega un correo de una
   dirección nueva, **Then** la oportunidad se crea igual, en la etapa inicial del pipeline por defecto de la
   cuenta.
5. **Given** una dirección que ya escribió antes, **When** envía un correo nuevo, **Then** el mensaje se suma
   a la conversación de correo que ya existía con ese contacto y **no** se crea una segunda oportunidad.
6. **Given** un contacto que ya existe en el CRM con esa dirección en su ficha, **When** escribe por primera
   vez al buzón, **Then** el correo se asocia a **ese** contacto existente, sin duplicarlo.
7. **Given** un contacto que ya tiene una conversación de WhatsApp abierta, **When** escribe también por
   correo, **Then** el correo abre su propia conversación de correo, separada de la de WhatsApp, y la
   conversación de WhatsApp no se altera.
8. **Given** un correo ya recibido y visible en el Inbox, **When** el buzón vuelve a leerse (por reinicio del
   sistema o relectura de la casilla), **Then** el mensaje **no** se duplica en la conversación.
9. **Given** un buzón activo, **When** llega una auto-respuesta de ausencia, un rebote del servidor de correo
   o un correo cuyo remitente es el propio buzón, **Then** ese mensaje no genera conversación, contacto ni
   oportunidad, y la IA no responde nada.
10. **Given** un buzón cuya contraseña fue cambiada en el proveedor, **When** Karia intenta leerlo,
    **Then** el negocio ve el buzón marcado con un estado de error y el motivo, y el resto de sus canales
    sigue funcionando sin verse afectado.

---

### User Story 2 - Responder el correo desde el Inbox (Priority: P2)

El agente abre una conversación de correo en el Inbox y responde desde ahí, igual que responde un WhatsApp:
escribe, envía, y el mensaje sale por el buzón del negocio. El cliente lo recibe **dentro del mismo hilo**
de su correo, con el asunto correcto (la respuesta al asunto original, no un correo suelto nuevo). Si el
envío falla, el agente lo ve marcado como fallido en el mismo lugar donde ya ve los fallos de los otros
canales, con el motivo.

**Why this priority**: Convierte el canal de "registro de lo que entra" en atención real de punta a punta, y
es condición para que la IA y los Workflows puedan operar sobre correo. Va después de P1 porque recibir sin
responder ya tiene valor, pero responder sin recibir no tiene sentido.

**Independent Test**: Sobre una conversación de correo recibida en P1, enviar una respuesta desde el Inbox y
confirmar en el cliente de correo del destinatario que llegó, dentro del hilo original.

**Acceptance Scenarios**:

1. **Given** una conversación de correo abierta en el Inbox, **When** el agente escribe y envía una
   respuesta, **Then** el destinatario la recibe desde la dirección del buzón del negocio y su cliente de
   correo la muestra dentro del hilo del correo original.
2. **Given** una conversación de correo, **When** se envía la primera respuesta, **Then** el asunto es el del
   correo original del cliente (marcado como respuesta), no uno genérico.
3. **Given** un buzón cuyo servidor de salida rechaza el envío, **When** el agente responde, **Then** el
   mensaje queda marcado como fallido con un motivo entendible y el agente puede reintentarlo.
4. **Given** una conversación de correo en la etapa inicial del pipeline, **When** el agente responde por
   primera vez, **Then** la oportunidad se mueve a la etapa de respuesta configurada para esa cuenta, igual
   que ya ocurre en los canales existentes.
5. **Given** el cliente responde a su vez, **When** su respuesta llega citando todo el hilo anterior,
   **Then** en el Inbox se ve solo lo que el cliente escribió de nuevo, sin el historial citado repetido.
6. **Given** un contacto sin dirección de correo cargada pero con conversación de correo, **When** el agente
   responde, **Then** el envío usa la dirección por la que el cliente escribió.

---

### User Story 3 - Aprobar remitentes desconocidos (Priority: P3)

El negocio desactiva **Crear contactos automáticamente** porque a su buzón le escribe de todo. Desde
entonces, cuando una dirección desconocida escribe, el correo llega a Karia pero queda **Pendiente de
aprobación**: se ve el remitente, el asunto y el contenido, pero la conversación está bloqueada — nadie
puede responder desde Karia, la IA no contesta y ningún Workflow la toma.

El agente revisa el pendiente y decide: lo **aprueba** creando un contacto nuevo con los datos del remitente,
o lo aprueba **asociándolo a un contacto que ya existe** en el CRM. En cualquiera de los dos casos la
conversación se desbloquea y se puede atender normalmente. Desde ahí en adelante, esa dirección ya está
aprobada: sus correos siguientes entran directo, sin volver a pedir aprobación.

**Why this priority**: Es lo que hace usable un buzón público, pero es inútil sin P1 y P2 funcionando. Un
negocio con un buzón privado de ventas puede no activarlo nunca.

**Independent Test**: Con la creación automática desactivada, escribirle al buzón desde una dirección nueva,
verificar que la conversación aparece bloqueada, aprobarla, y confirmar que se desbloquea y que un segundo
correo de la misma dirección ya no pide aprobación.

**Acceptance Scenarios**:

1. **Given** un buzón con creación automática desactivada, **When** escribe una dirección sin contacto en el
   CRM, **Then** el correo aparece en Karia identificado como pendiente de aprobación, y es visible para el
   equipo.
2. **Given** una conversación de correo pendiente de aprobación, **When** un agente intenta responderla,
   **Then** el envío se impide y se le explica que debe aprobar el remitente primero.
3. **Given** una conversación de correo pendiente de aprobación en una etapa con respuesta automática
   habilitada, **When** llega el correo, **Then** la IA **no** genera ni envía ninguna respuesta.
4. **Given** una conversación de correo pendiente de aprobación, **When** existe un Workflow que se dispara
   con mensajes entrantes, **Then** el Workflow no toma esa conversación.
5. **Given** un pendiente de aprobación, **When** el agente lo aprueba creando un contacto nuevo, **Then** el
   contacto queda creado con la dirección de correo del remitente, la conversación se desbloquea y queda
   atendible, y el historial de correos ya recibidos se conserva.
6. **Given** un pendiente de aprobación cuyo remitente corresponde a alguien ya cargado en el CRM, **When**
   el agente lo aprueba asociándolo a ese contacto existente, **Then** la conversación queda bajo ese
   contacto, sin crear un duplicado.
7. **Given** una dirección ya aprobada, **When** vuelve a escribir días después, **Then** su correo entra
   directo a la conversación, sin estado pendiente y con la IA habilitada si la etapa lo permite.
8. **Given** la creación automática **activada**, **When** escribe una dirección desconocida, **Then** no
   aparece ningún estado pendiente: el flujo es el de la Historia 1.
9. **Given** una conversación de WhatsApp o Instagram de un contacto desconocido, **When** llega su mensaje,
   **Then** se comporta exactamente como hoy — el bloqueo por aprobación **nunca** aplica fuera del correo.

---

### User Story 4 - Ajustar la recepción del buzón (Priority: P4)

El negocio vuelve a la configuración del buzón ya registrado y ajusta cómo recibe: decide si los correos de
un mismo remitente se agrupan en una sola conversación o si cada hilo de correo abre la suya, cambia el
pipeline y la etapa de entrada, cambia la contraseña cuando la rota en su proveedor, desactiva
temporalmente el buzón, o lo elimina. Además, los adjuntos que llegan en un correo quedan accesibles desde
la conversación.

**Why this priority**: Son ajustes sobre algo que ya funciona. Cada uno de ellos, solo, no justifica una
entrega.

**Independent Test**: Sobre un buzón ya operativo, cambiar la opción de agrupación y verificar que el
siguiente correo se agrupa según lo elegido; enviar un correo con adjunto y verificar que se puede abrir
desde la conversación.

**Acceptance Scenarios**:

1. **Given** un buzón con agrupación activada, **When** el mismo remitente abre dos hilos de correo
   distintos, **Then** ambos aparecen en la misma conversación.
2. **Given** un buzón con agrupación desactivada, **When** el mismo remitente abre un hilo nuevo, **Then** se
   abre una conversación distinta para ese hilo.
3. **Given** un buzón activo, **When** el negocio actualiza la contraseña y prueba la conexión, **Then** la
   validación se ejecuta con los datos nuevos y el buzón vuelve a leerse sin perder las conversaciones ya
   registradas.
4. **Given** un buzón activo, **When** el negocio lo desactiva, **Then** deja de leerse y de poder responderse,
   y las conversaciones existentes quedan visibles en modo lectura.
5. **Given** un correo con un archivo adjunto, **When** llega al Inbox, **Then** el agente puede abrir o
   descargar el adjunto desde la conversación.
6. **Given** un correo escrito en HTML con formato, **When** llega al Inbox, **Then** su contenido se lee sin
   etiquetas ni código visible.

---

### Edge Cases

- **El remitente escribe mientras su aprobación está pendiente**: los correos siguientes se suman a la misma
  conversación pendiente, sin generar un pendiente nuevo por cada correo.
- **Dos correos del mismo remitente llegan al mismo tiempo**: se crea una sola conversación y una sola
  oportunidad, no una por correo.
- **La dirección del remitente viene con mayúsculas o con nombre visible** (`"Juan Pérez" <JUAN@X.COM>`): se
  reconoce como el mismo remitente que `juan@x.com`.
- **El correo no tiene asunto, o no tiene cuerpo de texto (solo adjunto)**: entra igual, sin romper la vista
  del Inbox.
- **Un correo con copia a varias direcciones**: la conversación se atribuye al remitente, no a los
  destinatarios en copia.
- **El buzón acumula correos viejos antes de conectarse**: al registrar un buzón, Karia no debe inundar el
  CRM con el historial completo de la casilla.
- **El servidor de correo deja de responder a mitad de una lectura**: no se pierden mensajes ni se duplican
  cuando la lectura se reanuda.
- **El mismo buzón se intenta registrar dos veces en la misma cuenta**: se impide, para no leer dos veces los
  mismos correos.
- **Dos cuentas distintas de Karia registran buzones diferentes**: ninguna puede ver ni leer el buzón ni las
  conversaciones de la otra.
- **Un correo muy largo o con un adjunto enorme**: se recibe de forma acotada, sin degradar la lectura del
  resto de los correos del buzón.
- **Un contacto aprobado se elimina del CRM**: su dirección deja de estar aprobada y un correo posterior
  vuelve a tratarse como remitente desconocido.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Registro y configuración del buzón

- **FR-001**: El sistema MUST ofrecer "Correo electrónico" como canal registrable en Integraciones, junto a
  los canales de mensajería ya existentes.
- **FR-002**: El registro de un buzón MUST solicitar: dirección de correo, nombre identificatorio, y los
  datos de conexión de entrada y de salida (servidor, puerto, tipo de seguridad, usuario y contraseña de
  cada uno).
- **FR-003**: El sistema MUST permitir validar la conexión de entrada y la de salida contra el servidor real
  antes de guardar, e informar por separado el resultado de cada una.
- **FR-004**: El sistema MUST NOT activar un buzón cuya validación de conexión no haya sido exitosa.
- **FR-005**: Cuando la validación falla, el sistema MUST informar la causa en lenguaje entendible
  (credenciales rechazadas, servidor inalcanzable, puerto o seguridad incompatibles, tiempo de espera
  agotado) sin exponer detalles internos del error.
- **FR-006**: El registro MUST permitir configurar el pipeline y la etapa de entrada de las oportunidades
  creadas desde ese buzón; si no se configuran, el sistema MUST usar el pipeline por defecto de la cuenta y
  su etapa inicial.
- **FR-007**: El registro MUST permitir configurar si los correos de un remitente se agrupan en una sola
  conversación o si cada hilo abre la suya, con la agrupación activada por defecto.
- **FR-008**: El registro MUST permitir activar o desactivar la creación automática de contactos para
  remitentes desconocidos, activada por defecto.
- **FR-009**: Los usuarios MUST poder editar, desactivar y eliminar un buzón ya registrado, y volver a
  validar su conexión tras cambiar las credenciales.
- **FR-010**: El sistema MUST impedir registrar dos veces la misma dirección de correo dentro de una misma
  cuenta.
- **FR-011**: El sistema MUST almacenar las contraseñas del buzón cifradas y MUST NOT devolverlas nunca al
  navegador ni escribirlas en registros de actividad.
- **FR-012**: Un buzón que falle de forma persistente al leerse MUST quedar marcado con estado de error y su
  motivo, visible para el negocio, sin afectar el funcionamiento de los demás canales ni de los demás buzones.

#### Recepción

- **FR-013**: El sistema MUST leer periódicamente cada buzón activo y registrar los correos nuevos como
  mensajes entrantes del canal correo.
- **FR-014**: El sistema MUST mostrar los correos entrantes en el Inbox con el mismo tratamiento que los
  demás canales: remitente, contenido legible, fecha, y la conversación asociada a un contacto y a una
  oportunidad.
- **FR-015**: El sistema MUST reconocer al remitente por su dirección de correo normalizada, ignorando
  mayúsculas y el nombre visible que la acompañe.
- **FR-016**: Al recibir un correo de una dirección desconocida, el sistema MUST asociarlo a un contacto
  existente que ya tenga esa dirección registrada antes de crear uno nuevo.
- **FR-017**: Los correos de un contacto MUST agruparse en una conversación propia del canal correo, separada
  de las conversaciones que ese contacto tenga en otros canales.
- **FR-018**: El sistema MUST NOT alterar el agrupamiento de conversaciones de WhatsApp, Instagram ni
  Facebook Messenger: ese comportamiento queda exactamente como está hoy.
- **FR-019**: El sistema MUST registrar un mismo correo una sola vez, aunque el buzón se vuelva a leer o la
  lectura se interrumpa y se reanude.
- **FR-020**: El sistema MUST descartar, sin crear contacto, conversación ni oportunidad y sin generar
  respuesta de IA: las auto-respuestas automáticas, los avisos de rebote del servidor de correo, y los
  correos cuyo remitente sea el propio buzón.
- **FR-021**: El sistema MUST mostrar el contenido de los correos en HTML como texto legible, sin etiquetas
  ni código visible.
- **FR-022**: El sistema MUST mostrar, de cada correo de respuesta, solo el texto nuevo escrito por el
  remitente, omitiendo el historial del hilo que el correo trae citado.
- **FR-023**: Al registrar un buzón por primera vez, el sistema MUST NOT importar el historial previo de la
  casilla: solo se procesan los correos que lleguen a partir de la activación.
- **FR-024**: Los adjuntos de un correo entrante MUST quedar accesibles desde la conversación.
- **FR-025**: El sistema MUST acotar el tamaño del contenido y de los adjuntos que procesa de un correo, y
  dejar constancia en la conversación cuando un correo se recibió recortado.

#### Envío

- **FR-026**: Los usuarios MUST poder responder una conversación de correo desde el Inbox, con la misma
  interacción que usan en los demás canales.
- **FR-027**: Las respuestas MUST salir desde la dirección del buzón por el que entró la conversación.
- **FR-028**: Las respuestas MUST llegar al cliente como parte del mismo hilo de correo que originó la
  conversación, con el asunto original marcado como respuesta.
- **FR-029**: Un envío fallido MUST quedar marcado como fallido en la conversación con un motivo entendible,
  y MUST poder reintentarse.
- **FR-030**: La primera respuesta a una conversación de correo en la etapa inicial MUST mover la oportunidad
  a la etapa de respuesta configurada para esa cuenta, igual que en los canales existentes.
- **FR-031**: El sistema MUST ofrecer en el canal correo solo las acciones que el correo soporta, y MUST NOT
  ofrecer en él las que no (reacciones, confirmación de lectura del destinatario).

#### Aprobación de remitentes desconocidos

- **FR-032**: Con la creación automática de contactos desactivada, un correo de un remitente sin contacto
  conocido MUST quedar registrado en estado "Pendiente de aprobación", visible para el equipo con su
  remitente, asunto y contenido.
- **FR-033**: Mientras una conversación de correo esté pendiente de aprobación, el sistema MUST impedir
  enviar cualquier mensaje saliente en ella, venga de un agente humano, del agente de IA o de un Workflow.
- **FR-034**: Al impedir una respuesta por aprobación pendiente, el sistema MUST explicar al agente que debe
  aprobar el remitente primero.
- **FR-035**: Los usuarios MUST poder aprobar un remitente pendiente de dos formas: creando un contacto nuevo
  con los datos del remitente, o asociándolo a un contacto existente del CRM.
- **FR-036**: Al aprobarse, la conversación MUST quedar desbloqueada y atendible, conservando todos los
  correos recibidos mientras estuvo pendiente.
- **FR-037**: Una vez aprobada una dirección, sus correos posteriores MUST entrar sin estado pendiente y sin
  volver a pedir aprobación.
- **FR-038**: Los correos que lleguen de un remitente mientras su aprobación sigue pendiente MUST sumarse a
  la misma conversación pendiente, sin generar un pendiente nuevo por cada correo.
- **FR-039**: El bloqueo por aprobación pendiente MUST aplicar únicamente a conversaciones y oportunidades
  originadas en el canal correo, y MUST NOT alterar en nada el comportamiento de WhatsApp, Instagram ni
  Facebook Messenger.
- **FR-040**: Las oportunidades pendientes de aprobación MUST distinguirse visualmente de las demás allí
  donde el negocio las ve (Inbox y pipeline), para que no se confundan con oportunidades atendibles.

#### Aislamiento y seguridad

- **FR-041**: Toda lectura y escritura relacionada con buzones, conversaciones y aprobaciones MUST estar
  acotada a la cuenta autenticada; ninguna cuenta puede ver, leer ni operar el buzón de otra.
- **FR-042**: El sistema MUST NOT exponer al navegador las credenciales del buzón ni los identificadores
  internos del servidor de correo.

### Key Entities

- **Buzón de correo (cuenta de canal)**: la casilla registrada por el negocio. Tiene dirección, nombre,
  datos de conexión de entrada y salida (con la contraseña cifrada), estado activo/inactivo/con error,
  pipeline y etapa de entrada, opción de agrupación y opción de creación automática de contactos. Pertenece
  a una única cuenta de Karia.
- **Dirección del remitente (identificador de canal del contacto)**: la dirección normalizada por la que un
  contacto escribe. Es única dentro de la cuenta y guarda si ese remitente fue aprobado y cuándo.
- **Conversación de correo**: el agrupador de los correos intercambiados con un contacto por un buzón.
  Guarda el asunto y la referencia al hilo de correo para que las respuestas lleguen dentro de él, y si está
  bloqueada por aprobación pendiente.
- **Correo (mensaje de conversación)**: cada correo entrante o saliente, con su contenido legible, su
  identificador de origen para no duplicarlo, sus adjuntos y su estado de envío.
- **Oportunidad**: la del CRM, sin cambios en su naturaleza. Suma la marca de pendiente de aprobación cuando
  nació de un remitente de correo no aprobado.
- **Marca de posición de lectura del buzón**: lo que Karia ya leyó de la casilla, para no releer lo mismo ni
  saltearse correos cuando la lectura se interrumpe.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un negocio registra su buzón, valida la conexión y lo deja activo en menos de 5 minutos, sin
  asistencia técnica.
- **SC-002**: Un intento de registro con datos incorrectos termina siempre con un mensaje que identifica cuál
  de los tres problemas más comunes ocurrió (credenciales, servidor/puerto, seguridad), en el 100% de los
  casos probados.
- **SC-003**: Un correo recibido en el buzón es visible en el Inbox en menos de 2 minutos desde que llegó.
- **SC-004**: El 100% de los correos entrantes de remitentes conocidos quedan asociados al contacto correcto
  y a una sola oportunidad, sin duplicados, en una prueba de 50 correos de 10 remitentes distintos.
- **SC-005**: Cero correos duplicados en la conversación tras reiniciar el sistema y volver a leer el buzón.
- **SC-006**: Cero contactos, conversaciones, oportunidades o respuestas de IA generados a partir de
  auto-respuestas, rebotes o correos del propio buzón, en una prueba que incluya los tres casos.
- **SC-007**: Una respuesta enviada desde el Inbox llega al destinatario dentro del hilo original en el 100%
  de las pruebas, verificado en al menos dos clientes de correo distintos.
- **SC-008**: Con la creación automática desactivada, el 100% de los remitentes desconocidos quedan
  bloqueados: ninguna respuesta humana, de IA ni de Workflow sale de una conversación pendiente.
- **SC-009**: Aprobar un remitente y dejar la conversación atendible toma menos de 30 segundos y menos de 3
  interacciones.
- **SC-010**: Tras aprobar un remitente, sus correos siguientes entran sin pedir aprobación en el 100% de los
  casos.
- **SC-011**: Cero regresiones en WhatsApp, Instagram y Facebook Messenger: su agrupamiento de
  conversaciones, creación de oportunidades y respuesta de IA se comportan exactamente igual que antes de
  esta feature, verificado con la suite de pruebas existente.
- **SC-012**: Ninguna cuenta puede acceder al buzón, las credenciales ni las conversaciones de correo de otra
  cuenta, verificado con pruebas de aislamiento.

---

## Assumptions

- **"Oportunidad inicial" se implementa como pipeline + etapa de entrada del buzón.** En Karia una
  Oportunidad es un negocio concreto de un contacto, no una bandeja de entrada. Lo que el plan original
  describe —"a qué oportunidad deben llegar los correos nuevos", con fallback "usar la primera registrada"—
  corresponde exactamente a la configuración de pipeline y etapa que las cuentas de canal ya tienen, con su
  fallback al pipeline por defecto. Decisión confirmada con el solicitante antes de escribir este spec.
- **Una conversación por contacto y por canal.** El correo de un contacto va a su propia conversación,
  separada de su WhatsApp. Esto cambia el agrupamiento **solo** para correo; los canales existentes quedan
  intactos. Decisión confirmada con el solicitante.
- **"No crear contactos automáticamente" describe un comportamiento de negocio, no la ausencia de registro.**
  El correo pendiente sí queda registrado y visible en Karia (es lo que el plan pide: "llegan a la
  oportunidad inicial con estado Pendiente de aprobación"); lo que no ocurre es que el remitente pase a ser
  un contacto del CRM atendible sin que alguien lo apruebe. La diferencia observable es el bloqueo, no la
  invisibilidad.
- **La aprobación se recuerda por dirección de correo**, no por conversación ni por oportunidad: es lo que
  hace que "sus correos posteriores se reciben normalmente" se cumpla aunque la conversación se cierre y se
  reabra.
- **No hay lista de remitentes bloqueados en esta versión.** Descartar un pendiente equivale a cerrar la
  conversación; si esa dirección vuelve a escribir, vuelve a quedar pendiente de aprobación. Una lista de
  bloqueo permanente es una capacidad distinta, fuera de alcance.
- **Autenticación por usuario y contraseña**, como pide el plan. El acceso con cuentas de Google o Microsoft
  mediante autorización delegada (sin contraseña) queda fuera de alcance de esta feature.
- **Un buzón por casilla y por cuenta**; varios buzones por cuenta sí, pero no la misma dirección dos veces.
- **Carpeta leída**: se lee la bandeja de entrada del buzón. Carpetas adicionales, reglas de servidor y
  sincronización bidireccional de estados de lectura quedan fuera de alcance.
- **El correo saliente de atención es independiente del correo transaccional de Karia** (`src/lib/email/`,
  Resend): no comparten credencial, configuración ni código de envío.
- **Los correos entrantes alimentan al agente de IA igual que los demás canales**, respetando la
  configuración de respuesta automática por etapa que ya existe; esta feature no cambia las reglas de IA, solo
  agrega un canal más y una causa más de bloqueo (aprobación pendiente).
- **Latencia aceptable**: el correo no es un canal de tiempo real; una demora de hasta dos minutos entre la
  llegada al buzón y su aparición en el Inbox se considera correcta.
