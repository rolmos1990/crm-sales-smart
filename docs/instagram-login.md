# Instagram Login (Business Login for Instagram)

Este documento describe el flujo de conexión de Instagram vía **Instagram
API with Instagram Login**, agregado como alternativa al flujo heredado de
Facebook Login. Resume qué cambió, cómo configurarlo en Meta Developers y
cómo probarlo.

## Por qué

El flujo anterior (`/api/integraciones/instagram/oauth`) usa Facebook Login
y exige que la cuenta de Instagram tenga una Página de Facebook vinculada.
Instagram Login permite conectar una cuenta profesional de Instagram
directamente, sin Página de Facebook.

**Instagram Basic Display NO se usa** — no permite gestionar mensajes ni
comentarios, que es el propósito de esta integración.

## Los dos flujos conviven

| | Heredado (Facebook Login) | Nuevo (Instagram Login) |
|---|---|---|
| Endpoint de inicio | `/api/integraciones/instagram/oauth` | `/api/integraciones/instagram/login` |
| Callback | `/api/integraciones/instagram/callback` | `/api/integraciones/instagram/login/callback` |
| Diálogo de autorización | `facebook.com/.../dialog/oauth` | `instagram.com/oauth/authorize` |
| Requiere Página de FB | Sí | No |
| App de Meta | `META_APP_ID` / `META_APP_SECRET` | `META_INSTAGRAM_APP_ID` / `META_INSTAGRAM_APP_SECRET` |
| Host de envío de mensajes | `graph.facebook.com` | `graph.instagram.com` |
| `CuentaCanal.proveedorAuth` | `MetaFacebook` (default) | `Instagram` |

El botón **"Conectar Instagram"** en `/integraciones/instagram` ahora solo
inicia el flujo nuevo. El flujo heredado no se eliminó — las rutas siguen
existiendo y las cuentas ya conectadas con él siguen funcionando exactamente
igual (mismo host, mismo token, sin cambios) — solo dejó de ser el punto de
entrada por defecto en la UI. El botón separado de Facebook/Messenger (si se
agrega en el futuro) no se ve afectado por este cambio.

## Variables de entorno

```
META_INSTAGRAM_APP_ID=...
META_INSTAGRAM_APP_SECRET=...
META_INSTAGRAM_REDIRECT_URI=...        # opcional, ver abajo
META_INSTAGRAM_VERIFY_TOKEN=...        # opcional, ver abajo
```

- `META_INSTAGRAM_APP_ID` / `META_INSTAGRAM_APP_SECRET`: credenciales de la
  app de tipo **Instagram** en Meta for Developers. No son intercambiables
  con `META_APP_ID`/`META_APP_SECRET` (esas pertenecen a la app de Facebook
  Login) — Meta las trata como apps distintas aunque las administre la misma
  cuenta.
- `META_INSTAGRAM_REDIRECT_URI`: opcional. Si no se define, se usa
  `${APP_URL}/api/integraciones/instagram/login/callback`. Debe coincidir
  **exactamente** con el redirect URI configurado en el dashboard de la app.
- `META_INSTAGRAM_VERIFY_TOKEN`: opcional. El webhook de Instagram
  (`/api/webhooks/instagram`) sigue aceptando `WEBHOOK_VERIFY_TOKEN` como
  antes; solo hace falta esta variable si se registra un `hub.verify_token`
  distinto para la app de Instagram en Meta. **Recomendado: usar el mismo
  valor de `WEBHOOK_VERIFY_TOKEN` en ambas apps** y no definir esta variable.
- `META_APP_SECRET` (ya existente) se sigue usando para el webhook de
  eliminación de datos del flujo heredado; ese endpoint ahora también acepta
  firmas hechas con `META_INSTAGRAM_APP_SECRET`.

## Configuración en Meta Developers

1. Crear (o usar) una app en https://developers.facebook.com/apps con el
   producto **Instagram → API setup with Instagram login** (Business Login
   for Instagram).
2. En la sección de configuración de Instagram Login de la app:
   - Registrar el **redirect URI**:
     `https://tu-dominio.com/api/integraciones/instagram/login/callback`
     (y el equivalente de desarrollo si se prueba con túnel, ver abajo).
   - Copiar el **Instagram App ID** e **Instagram App Secret** →
     `META_INSTAGRAM_APP_ID` / `META_INSTAGRAM_APP_SECRET`.
3. Configurar el **Webhook** de la app de Instagram apuntando a
   `https://tu-dominio.com/api/webhooks/instagram`, con el mismo
   `hub.verify_token` que ya usa `WEBHOOK_VERIFY_TOKEN` (o uno nuevo +
   `META_INSTAGRAM_VERIFY_TOKEN`). Suscribir el objeto `instagram` al campo
   `messages` desde el propio dashboard es opcional — el callback ya lo hace
   automáticamente por cuenta conectada (`subscribed_apps`), pero el webhook
   a nivel de app debe estar dado de alta para que Meta entregue algo.
4. Configurar el **Data Deletion Request URL** de esta app apuntando también
   a `https://tu-dominio.com/api/webhooks/meta/eliminacion-datos` (ya
   actualizado para aceptar firmas de ambas apps).
5. Agregar como **usuario de prueba (Instagram tester)** la cuenta
   profesional de Instagram con la que se va a probar el flujo, mientras la
   app esté en modo desarrollo.

## Permisos y App Review

Se solicitan:

- `instagram_business_basic`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`

`instagram_business_manage_comments` se pide para no forzar un
re-consentimiento el día que se implemente el manejo de comentarios, pero
**hoy el CRM no procesa comentarios** (no había esa funcionalidad en el
código antes de este cambio, y quedó fuera de alcance — ver "Alcance y
limitaciones" abajo). No se solicita `instagram_business_content_publish`
porque el proyecto no publica contenido a Instagram.

En modo desarrollo, la app puede usar estos permisos sin restricciones con
usuarios marcados como testers/administradores. Para producción con
cualquier cuenta, **Meta exige App Review** de
`instagram_business_manage_messages` y `instagram_business_manage_comments`
(acceso avanzado) — sin la aprobación, el flujo solo funcionará con las
cuentas de prueba agregadas manualmente en el dashboard.

## Alcance y limitaciones de este cambio

- **Comentarios**: el código para recibir/responder comentarios de
  publicaciones no existía antes de este cambio y no se agregó ahora (fuera
  de alcance, decisión explícita). Solo se solicita el permiso para evitar
  un re-consentimiento futuro.
- **Cifrado de tokens**: los access tokens se guardan igual que antes, en
  texto plano dentro de `CuentaCanal.configuracion` (JSON). El proyecto no
  tenía ningún mecanismo de cifrado de credenciales antes de este cambio; no
  se agregó uno nuevo (decisión explícita). Es un riesgo pre-existente, no
  introducido por este cambio, pero ahora afecta también a los tokens de
  Instagram Login.
- **Renovación de tokens**: se agregó `scripts/renovar-tokens-instagram.ts`
  para refrescar tokens de Instagram Login (60 días, refrescable después de
  24h). No hay un scheduler genérico en el proyecto para tareas de
  mantenimiento — hay que programarlo por fuera (cron, Task Scheduler, job
  de Docker) apuntando a `npx tsx scripts/renovar-tokens-instagram.ts`. Las
  cuentas del flujo heredado (`MetaFacebook`) no se renuevan automáticamente,
  igual que antes de este cambio.
- **Pruebas automatizadas**: el proyecto no tiene test runner unitario, solo
  Playwright e2e. La suite nueva
  (`tests/e2e/integraciones/instagram-login.spec.ts`) cubre todo lo que se
  puede probar sin credenciales reales de Meta (generación/validación de
  `state`, cancelación, parámetros faltantes, CSRF, duplicados, webhook e
  idempotencia). Lo que requiere un login real en instagram.com (conexión
  exitosa con cuenta Business/Creator real, rechazo de cuenta personal real,
  error real de intercambio de token, respuesta real a un mensaje) no se
  puede automatizar sin un usuario de prueba de Instagram y credenciales de
  un app de Meta — queda como prueba manual (ver abajo).

## Cómo probar localmente

1. Configurar `META_INSTAGRAM_APP_ID`/`META_INSTAGRAM_APP_SECRET` en
   `.env.local`, y exponer el servidor local con un túnel HTTPS (ngrok,
   Cloudflare Tunnel, etc.) — Meta exige HTTPS para el redirect URI y para
   el webhook, no acepta `http://localhost`.
2. Registrar la URL del túnel como redirect URI en el dashboard de la app de
   Instagram (paso 2 de "Configuración en Meta Developers") y como
   `APP_URL` en `.env.local`.
3. Agregar la cuenta de Instagram de prueba como Instagram tester de la app.
4. `npm run dev`, entrar a `/integraciones/instagram` autenticado, click en
   "Conectar Instagram".
5. Verificar en el dashboard de Meta (`Webhooks` de la app) que la
   suscripción a `messages` para la cuenta quedó activa, o correr
   `npx tsx scripts/diagnostico-instagram.ts`.
6. Enviar un DM real a la cuenta conectada desde otra cuenta de Instagram y
   verificar que aparece en `/crm/inbox`.
7. Responder desde el inbox y verificar que llega a Instagram.
8. Correr la suite: `npm run test:e2e -- tests/e2e/integraciones/instagram-login.spec.ts`.

## Cómo probar en producción

1. Confirmar que `META_INSTAGRAM_APP_ID`/`SECRET`/`APP_URL` están seteados
   en el ambiente de producción y que el redirect URI registrado en Meta
   coincide exactamente con `${APP_URL}/api/integraciones/instagram/login/callback`.
2. Si la app de Instagram todavía no pasó App Review, solo funcionará con
   cuentas agregadas como tester/admin/developer en el dashboard — agregar
   ahí las cuentas reales que se vayan a conectar mientras se tramita la
   revisión.
3. Repetir los pasos 4–7 de la sección local contra el dominio real.
4. Programar `scripts/renovar-tokens-instagram.ts` (cron/Task
   Scheduler/job) — sin esto, los tokens de Instagram Login expiran a los 60
   días y las cuentas dejan de poder enviar/recibir hasta reconectarlas
   manualmente.

## Riesgos conocidos

- Sin App Review de Meta, el flujo nuevo solo sirve para cuentas de prueba
  — cualquier intento de conexión con una cuenta real (no agregada como
  tester) será rechazado por Meta antes de llegar a nuestro callback.
- El índice único que evita duplicar una cuenta de Instagram dentro de una
  organización es un **índice parcial** (`WHERE canal = 'instagram'`), que
  Prisma no representa en `schema.prisma`. Si en el futuro alguien corre
  `prisma migrate dev` después de tocar el modelo `CuentaCanal`, Prisma
  puede proponer eliminarlo por no estar declarado — hay que rechazar esa
  parte del diff y volver a aplicarlo a mano si hace falta.
- La idempotencia del webhook depende de que el mensaje ya haya sido escrito
  en `MensajeConversacion` por el consumidor asíncrono antes de que llegue
  un reintento de Meta. Es el mismo mecanismo que ya existía para el flujo
  heredado (no se modificó); en teoría, dos reintentos casi simultáneos
  antes de que el consumidor procese el primero podrían encolarse ambos.
