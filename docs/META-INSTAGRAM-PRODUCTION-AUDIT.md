# Auditoría de producción — Integración Meta / Instagram

**Alcance**: auditoría de solo lectura. No se modificó código. Toda afirmación
está respaldada por archivo:línea concretos, verificados directamente contra
el código actual del repo (no se asumió nada por estar "configurado en Meta").

**Fecha**: 2026-08-23

---

## A. Estado actual

Karia tiene **dos flujos OAuth de Instagram que coexisten en el código**:

1. **Flujo activo (vinculado desde la UI)**: "Instagram API with Instagram
   Login" (Business Login for Instagram) — `www.instagram.com` para el
   consentimiento, `graph.instagram.com` para token/API. Es el único
   accesible desde `/api/integraciones/instagram/login` → botón "Conectar
   Instagram" en [src/integraciones/instagram/components/panel-instagram.tsx:63-70](../src/integraciones/instagram/components/panel-instagram.tsx).
2. **Flujo legacy (muerto desde la UI, pero vivo en el servidor)**:
   "Instagram API with Facebook Login" (Page-linked) — `www.facebook.com` /
   `graph.facebook.com`. Ningún componente de la UI enlaza a
   `/api/integraciones/instagram/oauth`; sigue siendo alcanzable por URL
   directa, sin autenticación (`requireSesion()` nunca se llama en esa ruta).

El flujo activo:
`Conectar Instagram` → `/api/integraciones/instagram/login` (arma URL +
`state` firmado con HMAC) → consentimiento en instagram.com → `/api/integraciones/instagram/login/callback` (intercambia código, valida `state`, guarda `CuentaCanal`, suscribe webhook `messages`) → mensajes entrantes vía `/api/webhooks/instagram` → cola RabbitMQ → `procesarMensajeEntrante` → Inbox (SSE + polling).

El envío usa la misma tabla `CuentaCanal` sin importar qué flujo la creó —
`InstagramProvider` resuelve el host de Graph API dinámicamente según
`CuentaCanal.proveedorAuth` (`MetaFacebook` → `graph.facebook.com v20.0`,
`Instagram` → `graph.instagram.com v23.0`).

El pipeline de recepción y el de envío **funcionan de punta a punta para
texto, imagen, video y reacciones**, con clasificación de errores y
reintentos ya resueltos (incluida la causa raíz de "mensajes atascados en
ENVIADO" de una sesión anterior). Lo que **no** está resuelto son: la
validación de firma del webhook, el aislamiento multi-tenant en varios
endpoints de lectura/envío, la renovación de tokens, y el cifrado de tokens
en reposo — ver §9 y la Sección D/G.

---

## B. Modalidad de API

**Confirmado: Karia usa "Instagram API with Instagram Login" (Business
Login for Instagram) como modalidad activa** — no "Instagram API with
Facebook Login".

Evidencia:
- Host de autorización: `https://www.instagram.com/oauth/authorize`
  ([src/app/api/integraciones/instagram/login/route.ts:69](../src/app/api/integraciones/instagram/login/route.ts)), no `facebook.com`.
- Intercambio de código: `https://api.instagram.com/oauth/access_token`
  ([login/callback/route.ts:87-101](../src/app/api/integraciones/instagram/login/callback/route.ts)).
- Token de larga duración: `https://graph.instagram.com/access_token?grant_type=ig_exchange_token`
  ([login/callback/route.ts:116-123](../src/app/api/integraciones/instagram/login/callback/route.ts)).
- Perfil: `https://graph.instagram.com/v23.0/me?fields=user_id,username,...`
  — **no hay llamada a `/me/accounts` ni a Páginas de Facebook** en este
  flujo, porque esta modalidad no requiere una Página vinculada.
- El propio código lo documenta explícitamente:
  `src/app/api/integraciones/instagram/login/route.ts:9-11` — *"Instagram
  API with Instagram Login (Business Login for Instagram) — NO es Instagram
  Basic Display"*.

El flujo legacy (`/api/integraciones/instagram/oauth` +
`/api/integraciones/instagram/callback`) sí es "Instagram API with Facebook
Login" (usa `www.facebook.com`, `/me/accounts?fields=...instagram_business_account`,
Page Access Token) — pero **no está enlazado desde ningún componente de UI**
(confirmado por búsqueda en todo el repo). No hay evidencia de que la
modalidad activa (Instagram Login) sea insuficiente para el objetivo
descrito — por lo tanto **no se recomienda migrar de modalidad**, solo
decidir qué hacer con la ruta legacy (ver Sección D y G).

---

## C. Permisos actuales encontrados en código

| Permiso | ¿Karia lo solicita? | ¿Se usa realmente? | Código donde se usa | Funcionalidad | ¿Necesario para producción? | Acción |
|---|---|---|---|---|---|---|
| `instagram_business_basic` | Sí (flujo activo) | Sí | [login/route.ts:12](../src/app/api/integraciones/instagram/login/route.ts), consumido en `login/callback/route.ts` (perfil) | Login IG, identificar la cuenta | **Sí** | **MANTENER** |
| `instagram_business_manage_messages` | Sí (flujo activo) | Sí | [login/route.ts:13](../src/app/api/integraciones/instagram/login/route.ts); [instagram.ts](../src/conversaciones/providers/instagram.ts) (enviar), [webhooks/instagram/route.ts](../src/app/api/webhooks/instagram/route.ts) (recibir) | Enviar y recibir DMs | **Sí** | **MANTENER** |
| `instagram_business_manage_comments` | Sí (flujo activo) | **No** — solo se solicita el scope; nunca se suscribe el evento `comments` ni existe código que lo procese | [login/route.ts:14](../src/app/api/integraciones/instagram/login/route.ts); comentario explícito en [conectar.ts:98-109](../src/integraciones/instagram/conectar.ts) confirmando que se pide "para no forzar un re-consentimiento" cuando se implemente | Comentarios (no implementado) | No, hoy | **IMPLEMENTACIÓN INCOMPLETA** — o remover hasta construir la función real (ver §G) |
| `instagram_basic` | Sí (flujo **legacy**, sin UI) | Sí, dentro de ese flujo | [oauth/route.ts:7](../src/app/api/integraciones/instagram/oauth/route.ts) | Login vía Facebook | Solo si se mantiene el flujo legacy | **INVESTIGAR** (ligado a retirar/asegurar la ruta legacy) |
| `instagram_manage_messages` | Sí (legacy) | Sí, dentro de ese flujo | [oauth/route.ts:8](../src/app/api/integraciones/instagram/oauth/route.ts) | Mensajería vía Página | Solo si se mantiene legacy | **INVESTIGAR** |
| `pages_show_list` | Sí (legacy) | Sí — `/me/accounts` | [oauth/route.ts:9](../src/app/api/integraciones/instagram/oauth/route.ts); [callback/route.ts:85-89](../src/app/api/integraciones/instagram/callback/route.ts) | Listar páginas del usuario | Solo si se mantiene legacy | **INVESTIGAR** |
| `pages_manage_metadata` | Sí (legacy) | Sí — requerido por `/subscribed_apps` sobre una Página | [oauth/route.ts:10](../src/app/api/integraciones/instagram/oauth/route.ts); [callback/route.ts:290-293](../src/app/api/integraciones/instagram/callback/route.ts) | Suscribir webhook de Página | Solo si se mantiene legacy | **INVESTIGAR** |
| `pages_messaging` | Sí (legacy) | Sí — token de Página usado para enviar | [oauth/route.ts:11](../src/app/api/integraciones/instagram/oauth/route.ts) | Envío vía Página | Solo si se mantiene legacy | **INVESTIGAR** |
| `business_management` | Sí (legacy) | Sí — `/me/businesses` + `owned_pages`/`client_pages` (fallback cuando el usuario no tiene páginas directas) | [oauth/route.ts:12](../src/app/api/integraciones/instagram/oauth/route.ts); [callback/route.ts:134-165](../src/app/api/integraciones/instagram/callback/route.ts) | Descubrir páginas vía Business Manager | Solo si se mantiene legacy | **INVESTIGAR** — no mantener "porque el Login ya lo pide" |
| `ads_management` | Aparece en Meta (según lo reportado) | **No** — cero llamadas a `/act_{id}/campaigns`, `/adsets`, `/ads` en todo `src/` | — | — | No | **REMOVER** |
| `ads_read` | Aparece en Meta | **No** — cero consultas a insights/campañas/costos | — | — | No | **REMOVER** |
| `catalog_management` | Aparece en Meta | **No** — el "catálogo" del código es el catálogo interno de productos del CRM (`ProductoCatalogo`), sin relación con Meta Commerce Catalog; cero llamadas a `/catalogs`/`/product_catalogs` | — | — | No | **REMOVER** |
| `Instagram Public Content Access` | Aparece en Meta | **No** — cero llamadas a `/ig_hashtag_search` o `?fields=business_discovery` | — | — | No | **REMOVER** |
| `Business Asset User Profile Access` | Aparece en Meta | **No** — sin evidencia de uso distinto a `business_management` (ya cubierto arriba, y solo en el flujo legacy) | — | — | No | **REMOVER** |
| **`HUMAN_AGENT`** (message tag, no es un scope OAuth) | No es un permiso de login — es una capacidad de mensajería que Meta aprueba por separado ("Human Agent" use case) | **Sí**, implementado y con gate correcto | [enviar-mensaje.suscriptor.ts:35-63](../src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts); [instagram-ventana.ts:25-37](../src/conversaciones/providers/instagram-ventana.ts) | Responder fuera de la ventana normal de 24h (hasta 7 días) | Sí, si se quiere soportar respuestas tardías | **MANTENER** — pero falta UI de configuración (ver §G) |

---

## D. Permisos realmente necesarios

### OBLIGATORIOS
*(conectar Instagram + recibir mensajes + responder mensajes — modalidad activa: Instagram API with Instagram Login)*

- `instagram_business_basic`
- `instagram_business_manage_messages`

Con estos dos, y solo estos dos, el flujo completo de la Sección A funciona
de punta a punta (confirmado por código: login, callback, suscripción de
webhook `messages`, envío, recepción).

### OPCIONALES
*(solo si se quiere una funcionalidad adicional concreta que hoy no existe)*

- `instagram_business_manage_comments` — únicamente si se construye la
  función de comentarios/menciones (hoy no existe ningún código que la use,
  ver §5 más abajo). Si no se va a construir en el corto plazo, quitarlo del
  Login evita declarar una capacidad no usada ante Meta.
- Aprobación de **Human Agent** ante Meta — solo si se quiere que Karia
  pueda responder después de 24h (dentro de la ventana de 7 días). La
  lógica ya existe y está bien resuelta (ver §3/§9), pero sin esta
  aprobación de Meta, `humanAgentEnabled` nunca podría activarse
  legítimamente en producción.

### REMOVER
*(Karia no las usa en absoluto, sin importar lo que hoy esté configurado en el Meta App Dashboard)*

- `ads_management`
- `ads_read`
- `catalog_management`
- `Instagram Public Content Access`
- `Business Asset User Profile Access`
- `instagram_basic`, `instagram_manage_messages`, `pages_show_list`,
  `pages_manage_metadata`, `pages_messaging`, `business_management` — **si
  se decide retirar el flujo legacy de Facebook Login** (recomendado, ver
  §G #9): ninguno de estos permisos es necesario para la modalidad activa
  (Instagram Login), y la ruta que los usa hoy ni siquiera está enlazada
  desde la UI.

---

## E. Estado de funcionalidades

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Conectar Instagram (Instagram Login) | **IMPLEMENTADO** | [login/route.ts](../src/app/api/integraciones/instagram/login/route.ts) → [login/callback/route.ts](../src/app/api/integraciones/instagram/login/callback/route.ts) |
| Validación de `state` / CSRF (flujo activo) | **IMPLEMENTADO** | HMAC + TTL 10min + cookie nonce + re-chequeo de sesión — [estado-oauth.ts](../src/integraciones/instagram/estado-oauth.ts), [login/callback/route.ts:59-76](../src/app/api/integraciones/instagram/login/callback/route.ts) |
| Intercambio a token de larga duración | **IMPLEMENTADO** | [login/callback/route.ts:116-123](../src/app/api/integraciones/instagram/login/callback/route.ts) |
| Almacenamiento de token | **IMPLEMENTADO, sin cifrado** | `CuentaCanal.configuracion` (Json) — [conectar.ts:43-51](../src/integraciones/instagram/conectar.ts). Ver riesgo en §9 |
| Renovación automática de token | **FALTANTE** | Sin cron/job; `tokenExpiraEn`/`tokenRenovadoEn` se escriben una vez y nunca se leen |
| Suscripción de Webhook (`messages`) | **IMPLEMENTADO** | [conectar.ts:111-122](../src/integraciones/instagram/conectar.ts) |
| Verificación de Webhook (GET) | **IMPLEMENTADO** | [webhooks/instagram/route.ts:136-164](../src/app/api/webhooks/instagram/route.ts) (comparación no constant-time, riesgo bajo) |
| Validación de firma del Webhook (POST, `X-Hub-Signature-256`) | **FALTANTE** — crítico | Sin ninguna verificación HMAC; `validarWebhook()` es un stub que retorna `true` — [instagram.ts:269-272](../src/conversaciones/providers/instagram.ts) |
| Recepción de mensajes de texto | **IMPLEMENTADO** | [webhooks/instagram/route.ts:222-291](../src/app/api/webhooks/instagram/route.ts) → `procesarMensajeEntrante` |
| Recepción de adjuntos (imagen/video) | **IMPLEMENTADO** | descarga y re-almacenamiento propio antes de persistir |
| Recepción de reacciones | **IMPLEMENTADO** | [webhooks/instagram/route.ts:298-357](../src/app/api/webhooks/instagram/route.ts) |
| Recibos de lectura (`messaging_seen`) | **FALTANTE** — se detecta y se descarta | `route.ts:224` |
| `messaging_postbacks` / `message_deliveries` / `messaging_optins` / `standby` | **NO NECESARIO** hoy | Sin botones de plantilla ni handover protocol en el producto |
| Comentarios / menciones | **NO NECESARIO** hoy (fuera del objetivo declarado) | Confirmado ausente en todo `src/` |
| Crear/actualizar Contacto desde el webhook | **IMPLEMENTADO** | `procesarMensajeEntrante` — [actions.ts:22-105](../src/conversaciones/actions.ts) |
| Crear/reabrir Conversación | **IMPLEMENTADO** | [actions.ts:108-146](../src/conversaciones/actions.ts) |
| Persistencia de mensaje + dedup | **PARCIAL** — funciona pero sin constraint único en DB (`idExterno`), solo `findFirst` a nivel app | [actions.ts:148-154,297-303](../src/conversaciones/actions.ts) |
| Actualización del Inbox en tiempo real | **IMPLEMENTADO** | SSE + polling de respaldo — `inbox-layout.tsx` |
| Envío de texto | **IMPLEMENTADO** | [instagram.ts:126-217](../src/conversaciones/providers/instagram.ts) |
| Envío de imagen/video | **IMPLEMENTADO** | mismo archivo, `attachment.type` |
| Envío de audio/documento | **FALTANTE** | `tipoAdjunto` no mapea `AUDIO`/`DOCUMENTO`; cae silenciosamente a solo-texto |
| Respuestas citadas / quick replies | **NO NECESARIO** hoy | Sin evidencia de requerimiento del producto |
| Reacciones salientes | **IMPLEMENTADO**, sin clasificación de reintentos tipada | [instagram.ts:285-324](../src/conversaciones/providers/instagram.ts) lanza `Error` genérico, no `EnvioMensajeError` |
| Lógica de ventana 24h/7d + HUMAN_AGENT | **IMPLEMENTADO** | [instagram-ventana.ts](../src/conversaciones/providers/instagram-ventana.ts) + [enviar-mensaje.suscriptor.ts:35-63](../src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts) |
| UI para habilitar Human Agent por cuenta | **FALTANTE** | Solo editable manualmente en la base — sin acción/formulario en `src/integraciones/instagram` |
| Clasificación de errores de Meta + reintentos | **IMPLEMENTADO** | [instagram.ts:39-109](../src/conversaciones/providers/instagram.ts) + [consumidor.ts](../src/shared/rabbitmq/consumidor.ts) |
| Desconexión de cuenta (local) | **IMPLEMENTADO** | [instagram/actions.ts](../src/integraciones/instagram/actions.ts) — soft (`activa:false`) y hard delete |
| Revocación en Meta al desconectar | **FALTANTE** | Sin llamada a `/permissions` DELETE ni a `/subscribed_apps` DELETE |
| Aislamiento multi-tenant — conexión (OAuth) | **IMPLEMENTADO** (flujo activo) | Ver §B/§9 |
| Aislamiento multi-tenant — envío/lectura de mensajes | **FALTANTE** — crítico | `enviarMensaje()`, `/api/conversaciones/[id]/mensajes`, `/api/conversaciones/[id]/contexto`, `/api/sse/conversaciones` — ver §9 |
| Flujo legacy Facebook Login | Vivo, no enlazado desde UI, sin autenticación y con `state` sin firmar | Ver §9 |

---

## F. Pruebas que puedo ejecutar inmediatamente
*(funcionalidades que YA existen — solo falta grabar evidencia para Meta App Review)*

### F.1 — Conectar una cuenta de Instagram (demuestra `instagram_business_basic`)
1. **Precondición**: tener una cuenta de Instagram profesional (Business o Creator), sesión iniciada en Karia.
2. **Pasos**: Ir a Integraciones → Instagram → clic en "Conectar Instagram" → completar el consentimiento en instagram.com → volver a Karia.
3. **Resultado esperado**: la cuenta aparece listada en el panel con su `username` y foto de perfil, estado "Activa".
4. **Endpoint/API**: `GET www.instagram.com/oauth/authorize` → `POST api.instagram.com/oauth/access_token` → `GET graph.instagram.com/v23.0/me`.
5. **Permiso que demuestra**: `instagram_business_basic`.
6. **Qué mostrar en la grabación**: la pantalla de consentimiento de Meta pidiendo exactamente los permisos declarados, y la cuenta apareciendo conectada en Karia inmediatamente después.

### F.2 — Recibir un mensaje de Instagram en el Inbox
1. **Precondición**: cuenta conectada (F.1). Un tercero le escribe un DM a esa cuenta de Instagram desde otra cuenta de prueba.
2. **Pasos**: enviar un mensaje de texto vía la app de Instagram; abrir el Inbox de Karia.
3. **Resultado esperado**: el mensaje aparece en una conversación nueva (o existente) en el Inbox de Karia, en tiempo real (sin recargar).
4. **Endpoint/API**: Webhook `POST /api/webhooks/instagram` (evento `messages`).
5. **Permiso que demuestra**: `instagram_business_manage_messages` (recepción).
6. **Qué mostrar**: la app de Instagram enviando el mensaje y, en paralelo (split-screen o clip consecutivo), el mensaje apareciendo en el Inbox de Karia sin recargar la página.

### F.3 — Responder desde Karia
1. **Precondición**: una conversación abierta con un mensaje entrante reciente (< 24h).
2. **Pasos**: escribir una respuesta en el Inbox de Karia y enviarla.
3. **Resultado esperado**: el mensaje llega a la app de Instagram del contacto.
4. **Endpoint/API**: `POST graph.instagram.com/v23.0/{ig-id}/messages`.
5. **Permiso que demuestra**: `instagram_business_manage_messages` (envío).
6. **Qué mostrar**: escribir y enviar en Karia, luego el mensaje apareciendo en el chat de Instagram del contacto.

### F.4 — Enviar/recibir una imagen
1. **Precondición**: conversación abierta.
2. **Pasos**: adjuntar y enviar una imagen desde Karia; luego el contacto responde con una imagen desde Instagram.
3. **Resultado esperado**: ambas imágenes se ven correctamente renderizadas en sus respectivos lados.
4. **Endpoint/API**: `POST .../messages` con `attachment.type:"image"` (saliente); webhook `messages` con `attachments[]` (entrante).
5. **Permiso que demuestra**: `instagram_business_manage_messages`.
6. **Qué mostrar**: el envío y la recepción de la imagen en ambos sentidos.

### F.5 — Reacción a un mensaje
1. **Precondición**: conversación abierta con al menos un mensaje.
2. **Pasos**: reaccionar con un emoji a un mensaje desde Instagram; verificar que se refleje en Karia. Reaccionar desde Karia (si la UI lo expone) y verificar en Instagram.
3. **Resultado esperado**: la reacción se sincroniza en tiempo real en ambos sentidos.
4. **Endpoint/API**: webhook `message_reactions` (entrante); `POST .../messages` con `sender_action:"react"` (saliente).
5. **Permiso que demuestra**: `instagram_business_manage_messages`.
6. **Qué mostrar**: la reacción apareciendo casi instantáneamente en el otro lado.

### F.6 — Desconectar una cuenta
1. **Precondición**: cuenta conectada.
2. **Pasos**: en el panel de Integraciones, eliminar la cuenta conectada.
3. **Resultado esperado**: la cuenta desaparece del panel; mensajes nuevos a esa cuenta ya no llegan a Karia.
4. **Endpoint/API**: acción interna (`eliminarCuentaInstagram`) — **nota**: hoy no revoca el permiso del lado de Meta (ver §G #6), así que para la grabación de App Review conviene aclarar verbalmente que la desconexión es del lado de Karia.
5. **Permiso que demuestra**: manejo del ciclo de vida de la integración (requisito de buenas prácticas de Meta, no un permiso puntual).
6. **Qué mostrar**: el flujo de desconexión completo desde la UI.

---

## G. Funcionalidades faltantes
*(solo las necesarias para el objetivo real de Karia — conectar, recibir, responder — nada de Ads/Catálogo/contenido público)*

1. **Validación de firma del webhook (`X-Hub-Signature-256`)** — sin esto,
   cualquiera que descubra la URL del webhook y un `identificador`/`pageId`
   válido puede inyectar mensajes falsos. Ya existe código HMAC +
   `timingSafeEqual` reutilizable en el propio repo
   ([eliminacion-datos/route.ts](../src/app/api/webhooks/meta/eliminacion-datos/route.ts)) que nunca se aplicó al webhook de mensajes.
2. **Aislamiento multi-tenant en 4 puntos concretos** (el hallazgo de
   seguridad más importante de esta auditoría, ver detalle en §9):
   `enviarMensaje()`, `/api/conversaciones/[id]/mensajes`,
   `/api/conversaciones/[id]/contexto`, `/api/sse/conversaciones`. Sin
   `instanciaId` en el filtro, un usuario autenticado de un tenant puede
   leer/enviar mensajes de otro tenant si conoce/adivina un `conversacionId`.
3. **Renovación automática de token de larga duración** — el token de
   Instagram Login expira en ~60 días y hoy no hay ningún mecanismo (cron,
   job, chequeo on-demand) que lo renueve; las cuentas dejarán de funcionar
   silenciosamente.
4. **Cifrado de tokens en reposo** — `CuentaCanal.configuracion.accessToken`
   se guarda en texto plano.
5. **Revocación del lado de Meta al desconectar/eliminar** — hoy solo se
   borra/desactiva la fila local; el permiso sigue vigente en la cuenta de
   Meta del usuario.
6. **UI para habilitar Human Agent por cuenta** — la lógica de negocio ya
   existe y está bien resuelta; falta el formulario/acción para que un
   admin la active sin tocar la base de datos.
7. **Retirar o asegurar el flujo legacy de Facebook Login** (`/api/integraciones/instagram/oauth` + `/callback`) y la ruta de webhook genérica duplicada
   (`/api/webhooks/[canal]`) — ambas están vivas, sin autenticación, y no
   son necesarias para la modalidad activa.
8. **Constraint único a nivel de base de datos sobre `idExterno`** en
   `MensajeConversacion` — el dedup actual es solo a nivel de aplicación y
   puede fallar bajo reintentos casi simultáneos de Meta.

*(Explícitamente NO se recomienda: envío de audio/documento, respuestas
citadas/quick replies, comentarios/menciones, recibos de lectura — ninguna
es parte del objetivo declarado de Karia hoy; quedan como candidatas
opcionales a futuro, no como bloqueantes de producción.)*

---

## H. Checklist para producción

- [x] Login de cliente externo (multi-tenant, Instagram Login) — [login/route.ts](../src/app/api/integraciones/instagram/login/route.ts)
- [x] OAuth callback con validación de `state`/CSRF — [login/callback/route.ts](../src/app/api/integraciones/instagram/login/callback/route.ts)
- [x] Almacenamiento de token — [conectar.ts](../src/integraciones/instagram/conectar.ts) *(sin cifrar — ver §G.4)*
- [x] Identificación de la cuenta de Instagram — `graph.instagram.com/me`
- [x] Suscripción de Webhook (`messages`) — [conectar.ts:111-122](../src/integraciones/instagram/conectar.ts)
- [x] Recepción de mensaje — [webhooks/instagram/route.ts](../src/app/api/webhooks/instagram/route.ts)
- [x] Creación de conversación — [actions.ts:108-146](../src/conversaciones/actions.ts)
- [x] Respuesta desde Karia — [instagram.ts](../src/conversaciones/providers/instagram.ts)
- [x] Manejo de expiración/revocación de errores de Meta (clasificación + reintentos) — [instagram.ts:39-109](../src/conversaciones/providers/instagram.ts)
- [x] Desconexión de cuenta (local) — [instagram/actions.ts](../src/integraciones/instagram/actions.ts)
- [ ] **Aislamiento multi-tenant completo** — falta en envío/lectura de mensajes (§9, crítico)
- [x] Permisos mínimos identificados — Sección D
- [ ] **Permisos innecesarios removidos** — pendiente de acción en Meta Business Manager (Sección D — REMOVER)
- [x] Pruebas para Meta identificadas — Sección F
- [ ] Validación de firma del webhook (`X-Hub-Signature-256`)
- [ ] Renovación automática de token de larga duración
- [ ] Cifrado de tokens en reposo
- [ ] Revocación en Meta al desconectar
- [ ] UI de configuración de Human Agent

---

## §9 — Seguridad (detalle)

### Almacenamiento de tokens
`CuentaCanal.configuracion` es una columna `Json` sin cifrar
([schema.prisma:1691-1732](../prisma/schema.prisma)). El `accessToken` viaja
y se guarda en texto plano — confirmado en escritura
([conectar.ts:43-51](../src/integraciones/instagram/conectar.ts),
[callback/route.ts:256-263](../src/app/api/integraciones/instagram/callback/route.ts))
y en lectura al enviar
([instagram.ts:126-132](../src/conversaciones/providers/instagram.ts)). No
existe ninguna utilidad de cifrado/descifrado aplicada a tokens de Meta en
todo el repo (la única utilidad de "ocultar" que existe,
`codigo-sensible.ts`, es para licencias de producto y ni siquiera cifra,
solo enmascara hacia el cliente).

### Exposición en logs / frontend
No se encontró ningún `console.*` con el valor crudo del token (solo
etiquetas de error). La página de Integraciones sí hace un `select` amplio
que incluye `configuracion` del lado del servidor, pero el objeto que
finalmente llega al componente cliente (`PanelInstagram`) está filtrado a
`username`/`profilePicUrl` — no se detectó fuga hacia el bundle del
navegador.

### Validación del Webhook
- GET (verificación): compara `hub.verify_token` con `===` simple (no
  constant-time) — riesgo bajo, es un valor de configuración, no un secreto
  por request.
- **POST (mensajes reales): sin ninguna validación de firma
  `X-Hub-Signature-256`.** Cualquiera que conozca la URL del webhook y un
  `identificador`/`pageId` de una cuenta conectada puede inyectar eventos
  falsos. Esto es una brecha real y debería resolverse antes de producción
  (Sección G.1).

### Aislamiento tenant ↔ cuenta de Instagram
El flujo de conexión (OAuth activo) está bien resuelto: `state` firmado con
HMAC, ligado a la sesión que inició el flujo, con TTL y verificación de
sesión en el callback ([estado-oauth.ts](../src/integraciones/instagram/estado-oauth.ts)).

**Pero la capa de autorización sobre conversaciones/mensajes ya
conectados tiene 4 brechas concretas, confirmadas en código:**

1. `enviarMensaje()` ([actions.ts:426-508](../src/conversaciones/actions.ts))
   no llama `requireSesion()` ni filtra por `instanciaId` — busca la
   conversación solo por `id`. Cualquier usuario autenticado de cualquier
   tenant que conozca/adivine un `conversacionId` de otro tenant puede
   enviar mensajes a través de su canal.
2. `/api/conversaciones/[id]/mensajes` — mismo problema: filtra
   `mensajeConversacion` solo por `conversacionId`, nunca por `instanciaId`.
3. `/api/conversaciones/[id]/contexto` — mismo problema, y expone además
   PII del contacto (nombre, email, teléfonos) y de la empresa (razón
   social, RUC, sitio web) de cualquier tenant.
4. `/api/sse/conversaciones` — acepta un `instanciaId` por query param sin
   validar que corresponda a la sesión actual; permite suscribirse a
   eventos en tiempo real de cualquier tenant.

Esto contrasta con el resto del código, que sí aplica el patrón
correctamente en varios lugares (`desconectarCuentaInstagram`,
`obtenerCuentasCanal`, `obtenerConversacionesContacto`, todos con
`instanciaId` explícito en el `where`) — es una inconsistencia puntual, no
una ausencia sistemática del patrón, y por eso es corregible siguiendo el
mismo criterio ya usado en esos otros archivos.

### Expiración/renovación y desconexión
Sin renovación automática (§G.3). La desconexión/eliminación solo borra la
fila local; no revoca el permiso del lado de Meta (§G.5). El webhook de
"Eliminación de datos" de Meta (`/api/webhooks/meta/eliminacion-datos`) solo
registra un evento para revisión manual — no elimina automáticamente la
`CuentaCanal` correspondiente (decisión explícita documentada en el propio
código, por no existir un mapeo 1:1 seguro).

---

## Resumen ejecutivo (respuesta directa a la pregunta del pedido)

> Para que un cliente externo conecte su Instagram a Karia y pueda
> recibir/responder conversaciones, Karia necesita exactamente
> **`instagram_business_basic` + `instagram_business_manage_messages`**
> (modalidad Instagram API with Instagram Login). Todo el flujo de
> conexión, recepción, envío, imágenes y reacciones **ya existe y
> funciona** — la Sección F da los pasos exactos para grabar evidencia de
> cada uno para Meta App Review. `instagram_business_manage_comments` y la
> aprobación de Human Agent son **opcionales**, atados a funcionalidad que
> hoy no existe (comentarios) o que existe pero sin UI de activación (Human
> Agent). `ads_management`, `ads_read`, `catalog_management`, `Instagram
> Public Content Access` y `Business Asset User Profile Access` **deben
> removerse** — cero uso en código. Lo que **realmente falta** antes de
> producción no son permisos ni funcionalidades de negocio nuevas, sino
> cuatro brechas de aislamiento multi-tenant en el envío/lectura de
> mensajes, la validación de firma del webhook, la renovación de tokens, y
> el cifrado de tokens en reposo — todo detallado con archivo:línea en las
> Secciones E, G y §9.
