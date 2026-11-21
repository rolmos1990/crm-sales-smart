# Feature Specification: Proveedores de Voz y transcripción de notas de voz

**Feature Branch**: `feature/049-proveedores-de-voz`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Proveedores de Voz y transcripción de notas de voz. Karia necesita un registro de 'Proveedores de Voz' por instancia, equivalente al de Proveedores de IA que ya existe, pero cuyo consumo se mide en minutos de audio en vez de tokens. El primero es ElevenLabs Scribe v3 ($0.20/hora). Cada cliente carga su propia credencial, elige cuál usa, y puede activar o desactivar la funcionalidad para su cuenta. Con la funcionalidad activada, todo mensaje de audio que llegue se transcribe automáticamente en segundo plano, tanto los entrantes del contacto como los salientes enviados por el agente desde la app nativa del canal. El texto se guarda en un campo del MediaArchivo. Si el audio no se entiende, el texto guardado es literalmente 'Inaudible'. La transcripción sirve para dos cosas: (1) que el agente de IA pueda leer lo que dijo el cliente en vez de ignorar el audio, y (2) que el agente humano no tenga que escuchar el audio: en el inbox puede hacer click en 'ver transcripción' y leer el texto, parecido a como hace WhatsApp. ALCANCE CRÍTICO: se transcriben únicamente mensajes de tipo AUDIO y NOTA_VOZ. NUNCA videos."

## Contexto del problema

Un audio que entra a Karia hoy es **invisible para todo lo que no sea el oído de una persona**.
El mensaje se guarda con `contenido` en `NULL` y ningún consumidor río abajo lo compensa:

- El contexto del agente de IA descarta los mensajes sin texto, así que **la nota de voz nunca
  llega al prompt**. El agente responde como si el cliente no hubiera dicho nada.
- El "último mensaje del cliente" que alimenta el gate de autonomía queda vacío.
- Los Workflows reciben cadena vacía: un nodo Menú o Capturar dato no puede resolverse si el
  cliente contestó hablando.
- El análisis comercial de contactos excluye esos mensajes de su lectura.
- El agente humano tiene que reproducir cada audio uno por uno, y la búsqueda del inbox no
  encuentra nada de lo que se dijo hablando.

No es un caso marginal. En la cuenta con más volumen hay **730 audios en tres meses**
(2,6 horas), y el 15 % de sus conversaciones contiene al menos uno.

Karia **nunca** tuvo transcripción: esto es una Feature, no un Hotfix.

## Conceptos

- **Proveedor de Voz**: credencial y configuración de un servicio externo de voz, dada de alta
  por el comercio en su propia cuenta. Análogo al Proveedor de IA que ya existe, con una
  diferencia que atraviesa todo el diseño: **su consumo se mide en tiempo de audio, no en
  tokens**.
- **Transcripción**: el texto de lo que se dijo en un audio. Pertenece al **archivo**, no al
  mensaje: el mismo archivo reenviado dos veces tiene una sola transcripción.
- **Inaudible**: resultado terminal cuando el proveedor no logra extraer habla del audio
  (silencio, ruido, música). Es un resultado válido, no un error, y no se reintenta.
- **Media directa**: adjunto que Karia descarga y guarda en su propio almacenamiento. Las notas
  de voz lo son. Un Reel compartido, no.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El comercio activa la transcripción y lee sus notas de voz (Priority: P1)

El dueño del comercio entra a Configuración, da de alta su proveedor de voz con su propia
credencial, y activa la transcripción para su cuenta. Desde ese momento, cada nota de voz que
llega a su inbox muestra, junto al reproductor, un "ver transcripción" que despliega el texto de
lo que el cliente dijo. Su equipo deja de reproducir audios uno por uno para saber de qué se
trata cada conversación.

**Why this priority**: Es la mitad del valor y es entregable sola. Sin esto no hay nada; con
esto solo, el equipo de atención ya ahorra el tiempo de escuchar. No depende de que la IA
exista ni esté habilitada en esa cuenta.

**Independent Test**: Dar de alta un proveedor con credencial válida, activar el toggle, enviar
una nota de voz al canal y verificar que el texto aparece en el inbox sin reproducir el audio.
Luego desactivar el toggle, enviar otra, y verificar que no se transcribe ni se consume saldo.

**Acceptance Scenarios**:

1. **Given** una cuenta sin ningún proveedor de voz dado de alta, **When** el administrador abre
   Configuración, **Then** ve la sección de Proveedores de Voz vacía y el interruptor de
   transcripción apagado y no modificable hasta que exista un proveedor activo.
2. **Given** un proveedor de voz activo y la transcripción encendida, **When** un contacto envía
   una nota de voz, **Then** en el inbox aparece el reproductor y, junto a él, la transcripción
   accesible con un click.
3. **Given** la transcripción encendida, **When** el agente envía una nota de voz desde la app
   nativa del canal, **Then** ese audio también queda transcrito.
4. **Given** la transcripción apagada, **When** llega una nota de voz, **Then** se guarda y se
   reproduce como siempre y **no se hace ninguna llamada al proveedor**.
5. **Given** un audio sin habla reconocible, **When** termina el procesamiento, **Then** la
   transcripción mostrada es **"Inaudible"** y no se vuelve a intentar.
6. **Given** el proveedor externo no responde, **When** llega una nota de voz, **Then** el
   mensaje se guarda y se muestra con normalidad, la transcripción queda pendiente y se
   reintenta sola más tarde, sin que el agente vea un error técnico.
7. **Given** el mismo audio reenviado dos veces en la cuenta, **When** se procesan ambos,
   **Then** se cobra y se transcribe **una sola vez**.
8. **Given** un administrador editando un proveedor existente, **When** guarda sin escribir la
   credencial, **Then** la credencial anterior se conserva y nunca se devuelve al navegador.

---

### User Story 2 - El agente de IA entiende lo que el cliente dijo hablando (Priority: P2)

Un cliente manda una nota de voz preguntando por un producto. El agente de IA lee la
transcripción como si fuera un mensaje de texto y responde a lo que el cliente realmente
preguntó, en vez de ignorar el audio. Lo mismo vale para los Workflows: un cliente puede
contestar un menú hablando.

**Why this priority**: Es la otra mitad del valor, pero depende de que P1 exista y produzca
texto. Separarla permite entregar la lectura humana antes.

**Independent Test**: Con transcripción activa y un agente de IA habilitado, enviar una nota de
voz con una pregunta concreta y verificar que la respuesta del agente se refiere a lo
preguntado. Repetir con un Workflow con nodo Menú contestado por voz.

**Acceptance Scenarios**:

1. **Given** un audio transcrito, **When** el agente de IA arma su contexto, **Then** el
   contenido del audio forma parte de la conversación que lee, identificable como nota de voz.
2. **Given** un audio cuya transcripción aún no terminó o falló, **When** el agente de IA
   responde, **Then** ve una marca de que hubo una nota de voz no transcrita y responde igual
   — **nunca se queda esperando ni se bloquea la conversación**.
3. **Given** un Workflow esperando la elección de un menú, **When** el cliente responde con una
   nota de voz, **Then** el Workflow evalúa el texto transcrito.
4. **Given** una conversación cuyo último mensaje del cliente es una nota de voz transcrita,
   **When** se evalúa el gate de autonomía, **Then** recibe ese texto y no un valor vacío.
5. **Given** una transcripción que termina después de que el mensaje ya se mostró, **When**
   finaliza, **Then** la burbuja del inbox se actualiza sola, sin recargar la página.

---

### User Story 3 - El comercio controla y entiende su gasto de voz (Priority: P3)

El administrador ve cuántos minutos de audio consumió en el mes y cuánto costaron, puede probar
que su credencial funciona antes de depender de ella, y puede poner un tope diario para que un
pico de audios no se le vaya de las manos.

**Why this priority**: Mejora la operación pero nada deja de funcionar sin esto. El gasto real
observado es bajo (2,6 horas en tres meses), así que no es urgente.

**Independent Test**: Transcribir varios audios y verificar que el resumen de minutos y costo
del mes refleja lo consumido; configurar un tope y verificar que al alcanzarlo se deja de
transcribir sin romper la recepción de mensajes.

**Acceptance Scenarios**:

1. **Given** un proveedor recién cargado, **When** el administrador usa "probar credenciales",
   **Then** obtiene una confirmación o un motivo entendible del fallo, sin tener que esperar a
   que llegue un audio real.
2. **Given** audios ya transcritos en el mes, **When** el administrador abre Configuración,
   **Then** ve minutos consumidos y costo estimado del período.
3. **Given** un tope diario configurado y alcanzado, **When** llega otra nota de voz, **Then**
   el mensaje se recibe y se guarda con normalidad y la transcripción queda pendiente.

---

### Edge Cases

- **Una nota de voz y un video llegan con el mismo tipo de archivo.** En uno de los canales las
  notas de voz viajan en un contenedor de video. El sistema debe transcribir la nota de voz y
  **jamás** el video, aunque el proveedor acepte video sin devolver error. Es el riesgo central
  de la feature: un error acá no falla, solo factura de más en silencio.
- **El archivo ya no está en el almacenamiento.** La transcripción se marca como fallida y el
  mensaje se sigue mostrando.
- **Un audio muy largo.** Debe existir un límite por encima del cual no se intenta, para que un
  envío atípico no genere un cargo desproporcionado.
- **El proveedor devuelve texto en otro idioma del esperado.** Se guarda tal cual, junto con el
  idioma detectado. La feature transcribe; no traduce.
- **La credencial expira o se queda sin saldo.** Los audios quedan pendientes y se reintentan
  con espera creciente; tras varios intentos se marcan como fallidos y dejan de reintentarse.
  La recepción de mensajes nunca se ve afectada.
- **Dos procesos toman el mismo audio a la vez.** Solo uno puede procesarlo; no se puede
  facturar dos veces el mismo archivo.
- **La transcripción activada en una cuenta no debe producir ningún efecto en otra.** Ni
  consumo, ni visibilidad del texto, ni uso de la credencial.
- **Audios que ya estaban en el sistema antes de activar la funcionalidad.** No se transcriben
  solos: requieren una acción explícita, para que nadie reciba un cargo inesperado al encender
  el interruptor.

## Requirements *(mandatory)*

### Functional Requirements

**Proveedores de Voz**

- **FR-001**: El sistema MUST permitir a cada cuenta registrar uno o más Proveedores de Voz con
  un nombre identificatorio propio, único dentro de la cuenta.
- **FR-002**: El sistema MUST almacenar la credencial del proveedor cifrada, y MUST NOT
  devolverla nunca al navegador, ni al listarla ni al editarla.
- **FR-003**: Al editar un proveedor sin indicar credencial nueva, el sistema MUST conservar la
  credencial vigente.
- **FR-004**: El sistema MUST permitir activar y desactivar un proveedor, y ordenar por
  prioridad cuál se usa cuando hay más de uno activo.
- **FR-005**: El sistema MUST permitir verificar bajo demanda que la credencial de un proveedor
  funciona, informando el motivo cuando no.
- **FR-006**: Toda lectura y escritura de Proveedores de Voz MUST estar acotada a la cuenta
  autenticada, y MUST exigir permiso de modificación de configuración para alterarla.
- **FR-007**: El sistema MUST permitir registrar el costo por hora del proveedor. Cuando no esté
  informado, el sistema MUST dejar el costo sin calcular en vez de estimarlo.

**Activación**

- **FR-008**: El sistema MUST ofrecer por cuenta un interruptor de transcripción automática,
  **apagado por defecto**.
- **FR-009**: Con el interruptor apagado, o sin ningún proveedor activo, el sistema MUST NOT
  realizar ninguna llamada a un proveedor de voz.
- **FR-010**: Activar el interruptor MUST NOT transcribir retroactivamente los audios ya
  existentes; eso MUST requerir una acción explícita y separada.

**Alcance de la transcripción (crítico)**

- **FR-011**: El sistema MUST transcribir únicamente mensajes cuyo tipo sea **AUDIO** o
  **NOTA_VOZ**.
- **FR-012**: El sistema MUST NOT enviar a transcribir video, imagen ni documento, **aunque el
  tipo de archivo del adjunto sea indistinguible del de una nota de voz y aunque el proveedor
  los acepte sin error**. El tipo del mensaje MUST ser el único criterio.
- **FR-013**: El sistema MUST verificar el alcance de FR-011 **nuevamente, inmediatamente antes
  de llamar al proveedor**, y no solo en el momento de encolar.
- **FR-014**: El sistema MUST transcribir tanto los audios entrantes del contacto como los
  salientes enviados por un agente desde la aplicación nativa del canal.

**Procesamiento y resultado**

- **FR-015**: La transcripción MUST ejecutarse sin que el usuario la pida y sin bloquear la
  recepción, el guardado ni la visualización del mensaje.
- **FR-016**: El sistema MUST almacenar el texto resultante asociado al **archivo** de audio, de
  modo que un mismo archivo recibido más de una vez se transcriba y se cobre una sola vez.
- **FR-017**: Cuando el proveedor no logre extraer habla, el sistema MUST almacenar el texto
  **"Inaudible"** y MUST NOT reintentar.
- **FR-018**: El sistema MUST almacenar, junto al texto, el idioma detectado y la duración real
  del audio informada por el proveedor.
- **FR-019**: Ante un fallo recuperable, el sistema MUST reintentar con espera creciente hasta un
  máximo acotado de intentos, y luego MUST marcar el audio como fallido sin volver a intentar.
- **FR-020**: El sistema MUST garantizar que un mismo audio no sea procesado simultáneamente por
  dos procesos.
- **FR-021**: El sistema MUST registrar cada transcripción realizada con los segundos de audio
  consumidos, el proveedor usado y el costo estimado, para auditoría y control de gasto.
- **FR-022**: El sistema MUST NOT intentar transcribir archivos por encima de un tamaño máximo
  definido.

**Consumo del texto**

- **FR-023**: El inbox MUST permitir ver la transcripción de una nota de voz sin reproducirla,
  conservando el reproductor de audio existente.
- **FR-024**: El inbox MUST distinguir visualmente los estados de la transcripción: en proceso,
  disponible e inaudible. Un fallo técnico MUST NOT mostrarse como tal al agente.
- **FR-025**: Una transcripción que finalice después de mostrado el mensaje MUST reflejarse en
  la conversación abierta sin que el usuario recargue.
- **FR-026**: El contexto del agente de IA MUST incluir el texto transcrito, identificado como
  proveniente de una nota de voz.
- **FR-027**: Cuando una nota de voz no tenga transcripción disponible, el contexto del agente
  de IA MUST indicar que hubo una nota de voz no transcrita, en lugar de omitir el mensaje.
- **FR-028**: El agente de IA MUST responder aunque la transcripción no esté lista o haya
  fallado. El sistema MUST NOT retener una respuesta esperando a un servicio externo.
- **FR-029**: Los Workflows MUST usar el texto transcrito como entrada del contacto cuando el
  mensaje sea una nota de voz.
- **FR-030**: La vista previa y la búsqueda de conversaciones MUST considerar el texto
  transcrito.

**Aislamiento y privacidad**

- **FR-031**: La credencial, el consumo y el texto transcrito de una cuenta MUST ser inaccesibles
  desde cualquier otra cuenta.
- **FR-032**: El sistema MUST NOT registrar credenciales ni el contenido de las conversaciones en
  los registros de diagnóstico.

### Key Entities

- **Proveedor de Voz**: un servicio de voz configurado por una cuenta. Atributos: nombre
  identificatorio único en la cuenta, servicio, credencial cifrada, modelo, si está activo, su
  prioridad frente a otros, costo por hora y topes de uso. Pertenece a una cuenta.
- **Transcripción**: el texto de un archivo de audio, junto con su estado (no aplica, pendiente,
  en proceso, disponible, inaudible, fallida), el idioma detectado, la duración real, los
  intentos realizados y el proveedor que la produjo. **Pertenece al archivo de audio**, no al
  mensaje; varios mensajes pueden compartir el mismo archivo.
- **Consumo de Voz**: el registro de cada transcripción realizada —segundos de audio, proveedor,
  costo estimado, resultado—, usado para auditar y controlar el gasto de la cuenta.
- **Activación de transcripción**: ajuste por cuenta que habilita o deshabilita la
  funcionalidad completa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con la funcionalidad activada, **el 95 % de las notas de voz entrantes queda
  legible como texto en menos de 30 segundos** desde que llega el mensaje.
- **SC-002**: **Cero videos transcritos.** Sobre el histórico real de la cuenta de mayor volumen
  —730 notas de voz y 203 videos que comparten tipo de archivo— el conteo de videos enviados a
  transcribir debe ser exactamente 0.
- **SC-003**: Un agente puede saber de qué trata una nota de voz **sin reproducirla**, en un solo
  click.
- **SC-004**: Con la funcionalidad apagada, **cero llamadas al proveedor y cero costo**.
- **SC-005**: La indisponibilidad total del proveedor de voz **no impide recibir, guardar ni
  mostrar ningún mensaje**, ni impide que el agente de IA responda.
- **SC-006**: El agente de IA responde al contenido de una nota de voz en **al menos el 90 %** de
  los casos en que la transcripción está disponible, medido sobre un conjunto de prueba.
- **SC-007**: Un mismo audio recibido más de una vez en la cuenta **se factura una sola vez**.
- **SC-008**: El administrador puede estimar su gasto mensual de voz desde la pantalla de
  configuración, sin consultar al proveedor externo.
- **SC-009**: Transcribir el histórico completo de la cuenta de mayor volumen (2,6 horas de
  audio) **cuesta menos de 1 dólar**, verificable contra el registro de consumo.

## Assumptions

- El comercio aporta y paga su propia credencial del servicio de voz, igual que hoy ocurre con
  los proveedores de IA. Karia no provee una credencial compartida.
- La feature **transcribe, no traduce**: el texto se guarda en el idioma en que se habló. La
  traducción queda fuera de alcance (decisión explícita del solicitante).
- "Inaudible" es un texto fijo en español, consistente con el resto de la interfaz del producto.
- La transcripción se considera dato de la conversación y hereda su retención; no se define una
  política de retención distinta.
- Los canales que hoy entregan notas de voz como media directa son los que quedan cubiertos. Un
  canal que hoy clasifica el audio como contenido no admitido queda fuera del alcance inicial.
- El volumen esperado se estima a partir del histórico observado: unas 240 notas de voz y 50
  minutos de audio al mes en la cuenta más activa.
- Existe un almacenamiento propio desde el cual se puede recuperar el archivo de audio para
  enviarlo al proveedor.

## Fuera de alcance

- Síntesis de voz (texto a audio) y respuestas habladas del agente.
- Traducción de idioma.
- Identificación de interlocutores dentro de un mismo audio.
- Transcripción de video, imagen o documento.
- Transcripción bajo demanda de audios históricos como parte del flujo normal: requiere una
  acción explícita y separada.
- Búsqueda de texto completo sobre todo el histórico de mensajes.

## Dependencias

- Requiere que el archivo de audio quede vinculado al mensaje que lo contiene. **Hoy ese vínculo
  no se persiste**: el dato se produce al recibir el mensaje pero se pierde antes de guardarlo.
  Repararlo y reconstruir el vínculo de los mensajes existentes es **condición previa** a esta
  feature.
- Requiere un proceso de trabajo en segundo plano ya existente para ejecutar y reintentar las
  transcripciones.
- Requiere el mecanismo de actualización en vivo del inbox para reflejar transcripciones
  tardías.
