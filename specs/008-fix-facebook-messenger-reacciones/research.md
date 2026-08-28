# Phase 0 Research: Corregir reacciones en Facebook Messenger

## R1 — Enviar una reacción de Karia hacia Facebook

**Contexto**: se consultó la documentación oficial de Meta ("Sender Actions", Messenger Platform). Reaccionar/quitar reacción usa el mismo endpoint `POST /<PAGE_ID>/messages` que ya usa Karia para enviar mensajes y para las reacciones de Instagram, con `sender_action: "react"` (o `"unreact"`) y `payload: { message_id, reaction }` — `reaction` acepta un emoji UTF-8 directo, exactamente el mismo shape que ya usa `InstagramProvider.enviarReaccion` (`payload.emoji`, ya un carácter de emoji, no una palabra clave).

**Decision**: implementar `FacebookMessengerProvider.enviarReaccion`, calcado de `InstagramProvider.enviarReaccion` — mismo body, mismo manejo de "quitar" (`emoji === ""` → `sender_action: "unreact"` sin campo `reaction`), reemplazando `IG_API`/`instagramBusinessAccountId` por `FB_API`/`cfg.pageId` (ya definidos en el archivo desde `005-facebook-messenger-integracion`). Se activa declarando `capacidades.reacciones: true`.

**Rationale**: es el mismo Send API, mismo formato de payload — no hay ninguna diferencia real entre Instagram y Messenger en el envío, solo en cuál `capacidades`/verificación lo habilitaba. La causa del fallo nunca fue técnica del lado de Meta, fue que este método simplemente no estaba escrito.

**Alternatives considered**: ninguna — es la única forma documentada de reaccionar vía el Send API, y ya está probada en producción para Instagram sobre el mismo endpoint.

## R2 — Recibir una reacción de Facebook hacia Karia

**Contexto**: se confirmó contra la documentación oficial que, a diferencia de `message_echoes` (que Meta explícitamente agrupa dentro del campo `messages` para conversaciones de Instagram Messaging, según la propia documentación: "For Instagram Messaging conversations, the message echo notifications are included with the message webhook field subscription"), **`message_reactions` no tiene esa misma nota de inclusión** — su propia página de referencia dice explícitamente: "You can subscribe to this callback by selecting the `message_reactions` field when setting up your webhook", tratándolo como una suscripción aparte. Esto coincide con el código actual: `suscribirWebhookFacebookMessenger` solo pide `subscribed_fields=messages`.

**Decision**: sumar `message_reactions` a `subscribed_fields` en `suscribirWebhookFacebookMessenger` (`integraciones/facebook-messenger/conectar.ts`), y generalizar el bloque del webhook que hoy descarta cualquier `event.reaction` que no sea de Instagram (`webhooks/instagram/route.ts`).

**Rationale**: es la única forma de que Meta le avise a Karia que alguien reaccionó — sin la suscripción, el evento nunca llega, sin importar qué tan bien esté el código que lo procesaría.

**Alternatives considered**: ninguna — no hay una forma alternativa de recibir este evento sin suscribirse al campo correspondiente; es un requisito documentado de Meta, no una decisión de diseño.

## R3 — Procesar la reacción entrante para ambos canales

**Contexto**: `procesarReaccionIG` (en `webhooks/instagram/route.ts`) ya resuelve el mensaje original, borra la reacción anterior del mismo contacto y crea la nueva — toda esa lógica ya es genérica (busca por `idExterno` del mensaje, no filtra por canal en ningún punto de esas consultas). El único lugar donde asume Instagram es al persistir: graba `canal: "instagram"` fijo en el registro de `MensajeReaccion`.

**Decision**: generalizar la función para recibir el canal resuelto (`"instagram" | "facebook_messenger"`) como parámetro y usarlo al persistir, en vez de asumirlo. Se mantiene como una sola función (no se duplica), ya que el resto de la lógica es idéntica para ambos canales — a diferencia del envío (R1), donde cada canal necesita su propia llamada HTTP porque son providers distintos.

**Rationale**: mínimo cambio posible sobre una función ya probada; evita duplicar la lógica de "una reacción activa por contacto por mensaje" que ya está bien resuelta.

**Alternatives considered**: crear una función hermana `procesarReaccionFacebook` — descartado, a diferencia de R1 (envío, que sí requiere un HTTP request distinto por canal), acá toda la lógica de negocio es idéntica; duplicarla no aportaría nada y arriesgaría que una futura corrección se aplique a una función y se olvide en la otra.

## R4 — Corrección retroactiva para Páginas ya conectadas (FR-005)

**Contexto**: sumar `message_reactions` a `suscribirWebhookFacebookMessenger` solo afecta a conexiones **nuevas** — las Páginas ya conectadas antes de este cambio quedaron suscritas únicamente a `messages` en el momento en que se conectaron, y nada en su ciclo de vida normal vuelve a llamar a ese endpoint de suscripción (a diferencia del token, que sí se renueva por cron, la suscripción de webhook no tiene ningún proceso periódico).

**Decision**: agregar un script puntual (`scripts/resuscribir-reacciones-messenger.ts`) que recorra las `CuentaCanal` de `canal: "facebook_messenger"` activas y vuelva a llamar a `suscribirWebhookFacebookMessenger` para cada una — mismo patrón ya establecido en el repositorio para correcciones de datos puntuales (`scripts/reparar-oportunidades-pipeline.ts`, expuesto como `npm run script:reparar-pipeline`). Se corre una sola vez, manualmente, después de desplegar esta corrección.

**Rationale**: cumple FR-005/SC-004 (nadie del lado del negocio tiene que reconectar nada) sin inventar infraestructura nueva — reutiliza exactamente el patrón de script de corrección puntual que ya existe en este proyecto para casos análogos (datos que quedaron desactualizados por un cambio de código, no por una acción del usuario).

**Alternatives considered**:
- *Pedirle al usuario que desconecte y reconecte cada Página*: técnicamente resolvería lo mismo, pero contradice explícitamente SC-004 ("sin que el usuario tenga que reconectarlas manualmente") y es una mala experiencia por un problema que no fue causado por el usuario.
- *Re-suscribir automáticamente en cada envío/recepción de mensaje (lazy)*: agregaría una llamada a Graph API de más en el camino caliente de cada mensaje, para un problema que se resuelve una sola vez — descartado por costo/beneficio.

## Resumen de NEEDS CLARIFICATION resueltos

Ninguno quedó abierto — Technical Context no tenía marcadores sin resolver; las cuatro decisiones parten de documentación oficial de Meta y del código ya existente en el repositorio.
