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

**Adicional para el enriquecimiento de contacto** (`007-enriquecer-contacto-messenger`):
pedirle a Meta el nombre/foto de un contacto que **no** tiene un rol en la app
(un cliente real, no un tester) requiere que la app tenga aprobada la función
**`Business Asset User Profile Access`** con Advanced Access — todavía no
solicitada. Sin esa aprobación, la consulta de perfil solo funciona para
remitentes que administran/prueban la app; para cualquier otro remitente,
Meta la rechaza y el contacto se crea igual, sin nombre/foto (degradación
segura, ver más abajo).

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
- **Prefetch de nombre/foto del contacto — implementado** (`007-enriquecer-contacto-messenger`):
  `obtenerPerfilRemitenteFacebook` en `webhooks/instagram/route.ts` pide
  `first_name,last_name,profile_pic` a Graph API, mismo patrón que ya usa
  Instagram. Email y teléfono no se piden — Meta no los entrega para
  Messenger bajo ninguna circunstancia (tampoco lo hace para Instagram). En
  producción, solo funciona de entrada para remitentes con un rol en la app
  hasta que se apruebe `Business Asset User Profile Access` (ver arriba);
  para cualquier otro remitente, degrada de forma segura: el contacto se
  crea igual, sin nombre/foto.
- **Reacciones — implementado** (`008-fix-facebook-messenger-reacciones`):
  `FacebookMessengerProvider.enviarReaccion` envía reacciones a Facebook
  (mismo Send API que Instagram); la Página se suscribe también al campo
  `message_reactions` para recibirlas (campo aparte de `messages` en
  Messenger, a diferencia de otros eventos que Meta sí agrupa). **Páginas
  conectadas antes de este cambio necesitan correr una vez**
  `npm run script:resuscribir-reacciones-messenger` para empezar a recibir
  reacciones — no queda automático retroactivamente sin ese paso manual
  (una sola vez, no por cada Página).
- **Sin UI de configuración de Pipeline/etapa** — Instagram tampoco la tiene
  hoy; paridad exacta, no un gap nuevo de esta integración.
- **Índice único parcial nuevo** — migración
  `20260827000000_add_facebook_messenger_canal`, mismo patrón que la de
  Instagram.
