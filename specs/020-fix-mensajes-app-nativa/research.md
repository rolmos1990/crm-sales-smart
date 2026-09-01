# Research: Registrar en Karia los mensajes enviados desde la app nativa del canal

La causa raíz ya está confirmada en el spec (sección "Diagnóstico previo"). Este documento resuelve las decisiones de diseño necesarias para implementar la corrección sin romper el comportamiento existente (FR-007), sin duplicar DTOs (regla 7 de CLAUDE.md) y sin introducir efectos secundarios indebidos (disparo de IA, creación de oportunidades).

## R1 — Cómo distinguir "eco de Karia" vs "mensaje de la app nativa"

**Decision**: Reutilizar exactamente el mecanismo que ya existe para deduplicar mensajes entrantes del contacto: `prisma.mensajeConversacion.findFirst({ where: { idExterno } })`. Si el `mid` (Meta) o `key.id` (Baileys) del evento de eco ya está en `MensajeConversacion.idExterno`, es un mensaje que Karia envió y ya registró → se ignora. Si no está, es un mensaje nuevo del canal nativo → se registra.

**Rationale**: Es la misma columna que `enviar-mensaje.suscriptor.ts:95-98` ya llena al enviar (`result.idExterno`), y el webhook de Instagram ya la usa para deduplicar entrantes (`instagram/route.ts:352-355`). No hace falta ninguna fuente de verdad nueva.

**Alternatives considered**: Marcar en memoria/caché los IDs recién enviados por Karia para compararlos contra el eco — descartado porque ya existe una fuente de verdad persistente (`idExterno`) y esto introduciría una ventana de carrera adicional sin necesidad.

## R2 — Dónde persistir la distinción de origen

**Decision**: Nuevo valor en el enum `RemitenteMsg` de Prisma: `AGENTE_CANAL_NATIVO` (junto a `CONTACTO`, `AGENTE`, `SISTEMA`, `BOT`).

**Rationale**: `remitente` ya es el campo que el frontend usa para decidir alineación y estilo de la burbuja (`burbuja-mensaje.tsx:187-189`) y ya tiene índice propio (`@@index([remitente])`). Es la extensión más directa y no requiere una columna nueva ni una tabla de auditoría aparte. Nombre en español, consistente con el resto del enum.

**Alternatives considered**: Agregar un campo booleano `enviadoDesdeAppNativa` separado — descartado porque `remitente = "AGENTE"` seguiría siendo ambiguo con mensajes de Karia y obligaría a tocar cada `if (remitente === "AGENTE")` existente en vez de sumar un caso nuevo explícito.

## R3 — Por qué NO reutilizar `procesarMensajeEntrante` tal cual

**Decision**: Crear una función nueva y hermana, `registrarMensajeAppNativa`, en vez de rama-condicionar `procesarMensajeEntrante`.

**Rationale**: `procesarMensajeEntrante` (src/conversaciones/actions.ts:17-352) hace tres cosas que son incorrectas para un mensaje que la propia cuenta ya envió por fuera de Karia:
1. Guarda `remitente: "CONTACTO"` fijo (línea 319) — el mensaje se vería como si el cliente lo hubiera escrito.
2. Publica `EventosSistema.MensajeRecibido` (línea 337), que es exactamente lo que escucha `OrquestarIASuscriptor` (`src/suscriptores/ai/orquestar-ia.suscriptor.ts:9-11`) para decidir si generar una respuesta de IA — reusar este flujo haría que Karia le "conteste" automáticamente a un mensaje que el propio negocio ya envió.
3. Crea/actualiza una `Oportunidad` (pasos 5-6, líneas 156-294) como si fuera una señal de interés entrante — un mensaje saliente del propio negocio no es esa señal.

Lo único de `procesarMensajeEntrante` que sí es correcto reutilizar es la resolución de contacto/conversación (pasos 1-4, líneas 22-146: buscar o crear `Contacto`, buscar/crear/reabrir `Conversacion`) — eso se extrae a un helper compartido `resolverContactoYConversacion()` para no duplicar ~90 líneas ni el manejo de condición de carrera que ya tienen.

**Alternatives considered**: Pasar un flag `origen: "nativo" | "contacto"` a `procesarMensajeEntrante` y ramificar internamente — descartado: la función ya tiene alta complejidad ciclomática (transacción con `SELECT ... FOR UPDATE`, manejo de oportunidad finalizada, etc.) y mezclar dos flujos con efectos secundarios tan distintos (uno dispara IA y pipeline, el otro no debe disparar nada de eso) aumenta el riesgo de que un cambio futuro reintroduzca el bug por accidente.

## R4 — `sender` vs `recipient` en eventos de eco de Meta (Instagram / Messenger)

**Decision**: En `InstagramProvider.mapearEntrante` y `FacebookMessengerProvider.mapearEntrante`, cuando `message.is_echo === true`, usar `event.recipient.id` como `identificadorContacto` (no `event.sender.id`).

**Rationale**: Confirmado contra la forma actual de ambos mapeos (`instagram.ts:272-280`, `facebook-messenger.ts:175-183`) y la semántica de la Messenger Platform: en un evento normal, `sender` es quien escribe (el contacto) y `recipient` es la cuenta del negocio. En un evento de **eco**, Meta invierte el sentido operativo: `sender` pasa a ser la cuenta del negocio (quien "envió" el mensaje que se está haciendo eco) y `recipient` es el contacto que lo recibió. Usar `sender.id` sin este ajuste asociaría el mensaje al ID de la propia cuenta de Instagram/Página como si fuera un contacto — nunca encontraría (ni crearía correctamente) la conversación real.

Esto también implica que, si hace falta prefetch de perfil (nombre/foto) para un contacto nuevo detectado por esta vía, debe pedirse con `event.recipient.id`, no `event.sender.id`.

**Alternatives considered**: Ninguna — es un hecho de la API de Meta, no una decisión de diseño; documentado acá porque no es obvio y de otro modo un futuro cambio en `mapearEntrante` podría romperlo de nuevo.

## R5 — Riesgo de `pushName` en eventos `fromMe` de WhatsApp (Baileys)

**Decision**: El flujo de registro de mensaje "app nativa" para WhatsApp NO debe usar `msg.pushName` para actualizar el nombre del contacto.

**Rationale**: `encolarMensajeEntrante` (`encolar-mensaje.ts:59`) toma `msg.pushName` y, más abajo en `procesarMensajeEntrante`, lo usa para autocompletar `contacto.nombre` si está vacío (`actions.ts:89`). En un mensaje con `fromMe: true`, Baileys reporta el `pushName` asociado al remitente real del mensaje — que es la propia cuenta de WhatsApp del negocio, no el contacto. Pasarlo igual pisaría el nombre del contacto con el nombre de perfil de la cuenta del negocio la primera vez que alguien responda desde la app nativa a un contacto nuevo sin nombre.

`avatarUrl` sí se puede seguir resolviendo igual (`sesion.socket.profilePictureUrl(jid, ...)` ya apunta al JID del contacto — remoto —, no cambia con `fromMe`).

**Alternatives considered**: Filtrar el pushName solo cuando coincide con el nombre de perfil de la cuenta conectada — descartado por indirecto y frágil (requeriría guardar el pushName propio en algún lado); es más simple y seguro no propagarlo nunca en este flujo.

## R6 — Transporte: comando + cola nueva, no llamada directa

**Decision**: Igual que `PROCESAR_ENTRANTE`, el registro de mensaje de app nativa se encola como comando RabbitMQ nuevo (`PROCESAR_MENSAJE_APP_NATIVA`) consumido por un suscriptor nuevo, no una llamada síncrona directa desde el webhook/socket handler.

**Rationale**: El webhook de Meta debe responder rápido (Meta reintenta/desactiva webhooks lentos); la resolución de contacto/conversación puede requerir crear registros y tolerar reintentos ante fallos transitorios de DB — exactamente el mismo motivo por el que los mensajes entrantes normales ya usan este patrón. Las reacciones (`procesarReaccionIG`, `procesarReaccionEntranteWA`) sí se procesan síncronamente porque son una escritura mínima de una tabla ya resuelta (no crean contacto/conversación) — no son un precedente aplicable acá.

**Alternatives considered**: Llamar `registrarMensajeAppNativa` directamente desde el handler (como las reacciones) — descartado por la razón anterior; para WhatsApp además el mismo handler ya usa el patrón de cola vía `encolarMensajeEntrante`, así que ir directo rompería la simetría entre los tres canales (FR-005).

## R7 — Evento para refrescar la UI

**Decision**: Reutilizar `EventosSistema.MensajeEnviado` (payload sin cambios: `{ mensajeId, conversacionId, instanciaId }`) al terminar de registrar el mensaje de app nativa.

**Rationale**: Confirmado que `inbox-layout.tsx:358` y `panel-conversacion.tsx:135` ya escuchan `MENSAJE_ENVIADO` por SSE y solo lo usan como señal de "volvé a pedir los mensajes" (mismo comentario ya presente en `enviar-mensaje.suscriptor.ts:113-116`). `SSERelaySuscriptor` ya reenvía este routing key a SSE sin cambios. No hace falta ningún evento ni contrato nuevo — cumple la regla de "no inventar" y de "nunca DTOs duplicados".

**Alternatives considered**: Evento nuevo `MensajeAppNativaRegistrado` — descartado: el frontend no necesita ninguna información adicional en el evento (solo re-consulta el mensaje ya persistido, que ya trae `remitente` correcto), así que un evento nuevo sería una duplicación sin beneficio.

## R8 — Alcance frente a un contacto completamente nuevo (edge case de spec)

**Decision**: Reutilizar la resolución de contacto/conversación (crear `Contacto` + `Conversacion` si no existen, igual que hoy para un entrante genuino) pero **sin** ejecutar la creación/actualización de `Oportunidad` (pasos 5-6 de `procesarMensajeEntrante`).

**Rationale**: El edge case de spec exige explícitamente no fallar silenciosamente y comportarse "de forma consistente con cómo ya maneja hoy un mensaje entrante nuevo sin conversación previa" — eso se satisface resolviendo/creando la conversación igual que hoy. La creación automática de oportunidad es una señal de negocio distinta (interés entrante del cliente) que ni los FR ni las Key Entities del spec mencionan para este caso, y crear una oportunidad automáticamente solo porque un operador escribió primero desde la app nativa sería un comportamiento nuevo no pedido — mayor riesgo de alterar el pipeline de ventas de formas no solicitadas (contradice el espíritu "no alterar comportamiento existente" de todo Hotfix).

Esta es una decisión de alcance registrada como asunción, no una ambigüedad bloqueante — queda documentada acá y en `data-model.md` para que sea visible antes de `/speckit-tasks`. Si el negocio sí quiere que este caso cree oportunidad, es un cambio de una línea en `registrarMensajeAppNativa` (llamar al mismo helper de oportunidad) que se puede pedir como ajuste explícito.

**Alternatives considered**: Preguntar al usuario vía `/speckit-clarify` — no se consideró bloqueante porque el spec ya tiene una sección de "Assumptions" que fija el criterio de alcance mínimo ("Fuera de alcance: ... cualquier cosa no mencionada explícitamente en Key Entities/FR"), y agregar automatización de pipeline no solicitada iría en contra de esa asunción existente.
