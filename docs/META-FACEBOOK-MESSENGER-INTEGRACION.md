# Facebook Messenger — Notas de integración

Documento de referencia de la integración implementada en
`005-facebook-messenger-integracion`. Ver también
`docs/META-INSTAGRAM-PRODUCTION-AUDIT.md` (integración hermana, misma app de
Meta, mismo webhook).

## Permisos de Meta usados

Mismos que el flujo heredado de Instagram vía Página — no requiere una app
de Meta nueva ni permisos adicionales:

- `pages_show_list` — listar las Páginas del usuario que autoriza
- `pages_manage_metadata` — suscribir la Página al webhook `messages`
- `pages_messaging` — el permiso de mensajería en sí
- `business_management` — fallback para Páginas gestionadas vía Business Manager

`pages_messaging` está en proceso de aprobación ante Meta como parte de la
submission de Human Agent de Instagram (`004-fix-instagram-human-agent`). En
modo desarrollo/Standard Access, la integración funciona igual con usuarios
que tengan rol de tester en la app.

## Flujo de conexión

1. `GET /api/integraciones/facebook-messenger/oauth` — exige sesión, firma un
   `state` (HMAC, reutiliza `estado-oauth.ts` con `META_APP_SECRET`), redirige
   al diálogo de Facebook Login.
2. `GET /api/integraciones/facebook-messenger/callback` — verifica `state` +
   nonce + que la sesión coincide con quien inició el flujo, intercambia
   `code` por un token de usuario de larga duración, lista las Páginas del
   usuario (`/me/accounts`, con fallback a Business Manager), y por cada
   Página: persiste una `CuentaCanal` (`canal: "facebook_messenger"`) y
   suscribe el webhook `messages`.

Mismo patrón exacto que `integraciones/instagram/{oauth,callback}` (ya
asegurado en `004-fix-instagram-human-agent`) — ver ese código para el
detalle de la verificación de `state`/sesión.

## El punto técnico central: desambiguar Messenger de Instagram-vía-Página

Meta permite un solo Callback URL por app para el objeto `page` — Messenger
y los mensajes de una cuenta de Instagram vinculada a una Página llegan al
**mismo webhook**, mismo campo `messages`, sin ningún campo que diga cuál es
cuál.

`src/app/api/webhooks/instagram/route.ts` resuelve esto en la rama
`object === "page"`: busca ambos candidatos de `CuentaCanal` para esa Página
(uno de `canal: "instagram"`, otro de `canal: "facebook_messenger"`). Si solo
uno existe, se usa directo (cero cambio de comportamiento para Instagram —
es la mayoría de los casos). Si ambos existen para la misma Página, se
desambigua por evento: si el remitente ya es un contacto conocido de
Instagram (`ContactoIdentificadorCanal`), se procesa como Instagram; si no,
como Messenger.

La decisión en sí es una función pura, testeada sin Prisma:
`src/conversaciones/providers/resolver-canal-webhook-page.ts` (+
`.test.ts`). Ver `specs/005-facebook-messenger-integracion/research.md` R1
para el detalle completo, incluida la limitación aceptada (un contacto de
Instagram genuinamente nuevo en el caso de Página con ambos canales
conectados podría clasificarse como Messenger en su primer mensaje).

## Almacenamiento y seguridad

- `accessToken` de cada Página cifrado en reposo con `cifrarToken`
  (AES-256-GCM) — mismo mecanismo que Instagram, sin uno nuevo.
- Toda query/mutación scoped por `instanciaId`.
- El Page Access Token obtenido vía `/me/accounts` con un token de usuario de
  larga duración no trae `expires_in` — no vence mientras el token de
  usuario que lo generó siga vigente. `tokenExpiraEn` queda sin valor para
  estas cuentas; el estado de conexión (`queries.ts`) lo trata como "activa"
  mientras haya token y la cuenta esté `activa`.

## Limitaciones conocidas (no bloquean el uso, documentadas a propósito)

- **Sin revocación del lado de Meta al desconectar** — igual que Instagram
  hoy (`docs/META-INSTAGRAM-PRODUCTION-AUDIT.md` §G.5), desconectar solo
  desactiva la fila local.
- **Sin prefetch de nombre/foto del contacto** — a diferencia de Instagram,
  no se llama a ningún endpoint de perfil para el remitente de Messenger (no
  verificado que el mismo endpoint de Instagram aplique igual a un PSID). El
  contacto se crea igual, sin nombre/foto inicial.
- **Sin reacciones** — Messenger no está suscrito al campo
  `message_reactions`; fuera de alcance del pedido original.
- **Sin UI de configuración de Pipeline/etapa** — Instagram tampoco la tiene
  hoy; paridad exacta, no un gap nuevo de esta integración.
- **Índice único parcial nuevo** — migración
  `20260827000000_add_facebook_messenger_canal`, mismo patrón que la de
  Instagram.
