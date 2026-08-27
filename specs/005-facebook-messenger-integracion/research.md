# Phase 0 Research: Integración de Facebook Messenger

## R1 — Distinguir un mensaje de Messenger de un mensaje de Instagram-vía-Página en el mismo webhook

**Contexto del problema**: Meta permite un solo Callback URL por app para el objeto `page` en el Meta App Dashboard — no es posible registrar una URL de webhook separada para Messenger. Se confirmó contra la documentación oficial de Meta (Webhooks for Instagram Messaging / Meta Webhooks for Messenger Platform) que, cuando una cuenta de Instagram está vinculada a una Página de Facebook, **los mensajes de Instagram y los de Messenger llegan por el mismo campo de suscripción (`messages`) del mismo objeto (`object: "page"`), con la misma forma de payload** (`entry.id` = ID de la Página, `messaging[].sender.id`/`recipient.id`). No hay ningún campo explícito en el payload que diga "esto es Instagram" vs "esto es Messenger".

Esto ya es parcialmente conocido por el código actual: `src/app/api/webhooks/instagram/route.ts` ya distingue `object: "instagram"` (Instagram API with Instagram Login — el flujo activo de Karia, `entry.id` = ID de cuenta de Instagram) de `object: "page"` (flujo heredado de Facebook Login, `entry.id` = ID de Página), pero hoy interpreta **todo** evento `object: "page"` como un mensaje de Instagram, buscando la `CuentaCanal` por `canal: "instagram"` + `configuracion.pageId`.

**Decision**: Cuando llegue un evento `object: "page"`, antes de asumir que es Instagram-vía-Página, el webhook debe:
1. Resolver si el `sender.id` del evento ya es un identificador de contacto conocido con `canal: "instagram"` para esa instancia (tabla `ContactoIdentificadorCanal`, que ya existe y ya se consulta con este propósito en otros puntos del código). Si coincide, es Instagram — se procesa exactamente igual que hoy (cero cambios de comportamiento, cumple FR-007).
2. Si no coincide, buscar una `CuentaCanal` de `canal: "facebook_messenger"` conectada a esa Página (`entry.id`). Si existe, se procesa como un mensaje de Messenger nuevo.
3. Si ninguna de las dos aplica, se descarta el evento como hoy (cuenta no encontrada).

**Rationale**: No agrega ningún campo nuevo a interpretar del payload de Meta (que no lo provee) ni depende de heurísticas sobre el formato del ID (arriesgado, no documentado por Meta como estable). Reutiliza una tabla y un patrón de consulta que ya existen para el propósito exacto de "a qué contacto/canal pertenece este identificador externo". Preserva el comportamiento actual de Instagram byte a byte para cualquier remitente ya conocido, que es el caso dominante en producción — solo el primer mensaje de un contacto realmente nuevo en una Página que tuviera **ambos** canales conectados podría, en el peor caso, clasificarse como Messenger; se documenta como limitación aceptada (ver Edge Cases de la spec) dado que el flujo heredado de Instagram-vía-Página está además marcado para retiro en `004-fix-instagram-human-agent`.

**Alternatives considered**:
- *Registrar una app de Meta separada solo para Messenger, con su propio Callback URL*: técnicamente evita la ambigüedad, pero contradice la premisa del pedido ("ya debo tener en los .env las conexiones necesarias") y duplica innecesariamente configuración/credenciales para un problema que tiene una solución sin infraestructura nueva.
- *Prohibir conectar la misma Página simultáneamente a Instagram (legacy) y a Facebook Messenger*: eliminaría la ambigüedad por completo, pero es una restricción de producto no pedida por el usuario y bloquearía un caso de uso legítimo (negocio con Instagram y Messenger en la misma Página). Se descarta como regla dura; el manejo por `ContactoIdentificadorCanal` ya cubre el caso común sin necesidad de prohibir nada.
- *Inspeccionar el formato numérico del `sender.id` para adivinar IGSID vs PSID*: Meta no documenta ese formato como una API estable — es un detalle de implementación interno de Meta que puede cambiar sin aviso. Descartado por fragilidad.

## R2 — Cómo obtener y renovar el token de la Página para Messenger

**Decision**: Reutilizar el flujo OAuth de Facebook Login ya existente y ya asegurado (`src/app/api/integraciones/instagram/oauth/route.ts` + `callback/route.ts`, corregidos en `004-fix-instagram-human-agent` para exigir sesión y `state` firmado) como plantilla, apuntando a un nuevo par de rutas bajo `integraciones/facebook-messenger/`. El scope de permisos a solicitar es el mismo ya usado por el flujo heredado de Instagram (`pages_show_list`, `pages_manage_metadata`, `pages_messaging`, `business_management`) — no se necesita ningún permiso adicional, confirmando la expectativa del pedido sobre los `.env` ya configurados.

**Rationale**: Evita reinventar la verificación de `state` firmado (HMAC) y el manejo de sesión/CSRF que ya se corrigió una vez; `pages_messaging` es exactamente el permiso de Messenger, ya en curso de aprobación ante Meta.

**Alternatives considered**: Construir un flujo OAuth nuevo desde cero — descartado, duplicaría código de seguridad ya auditado sin ninguna ventaja.

## R3 — Cifrado del token de Página

**Decision**: Reutilizar `cifrarToken`/`descifrarToken` (`src/shared/lib/cifrado-tokens.ts`, AES-256-GCM) para el `accessToken` de la Página conectada a Facebook Messenger, igual que ya se aplica al token de Instagram.

**Rationale**: Es la misma clase de secreto (token de acceso de Graph API) con el mismo requisito de cifrado en reposo; no hay ninguna razón de dominio para un mecanismo distinto, y la Constitución (Principio V) exige que los secretos no queden expuestos.

**Alternatives considered**: Ninguna — usar un mecanismo de cifrado distinto solo fragmentaría la superficie de auditoría sin beneficio.

## R4 — Envío de mensajes salientes (Send API)

**Decision**: El endpoint de envío de Messenger (`POST /<PAGE_ID>/messages` sobre `graph.facebook.com`) es prácticamente idéntico en forma al que ya usa `InstagramProvider.enviarMensaje` (mismo `recipient.id` + `message` + `messaging_type`/`tag`). El nuevo `FacebookMessengerProvider` implementa el mismo contrato `ICanalProvider`, reutilizando la misma lógica de clasificación de errores de Graph API donde aplique (código 190 = token inválido, 10 = ventana/permiso, 613 = rate limit) en vez de reimplementarla.

**Rationale**: Minimiza duplicación (Principio I) y mantiene consistente el manejo de errores que el agente ya entiende por Instagram.

**Alternatives considered**: Copiar `instagram.ts` completo sin abstraer nada en común — aceptable como primera versión dado que cada proveedor de canal ya es independiente por diseño (Principio IV: "Replaceable Integrations"), pero se documenta como candidato a extraer un helper compartido de clasificación de errores de Graph API si un tercer canal de Meta se agrega en el futuro (fuera de alcance de esta feature).

## R5 — Ventana de 24h / Human Agent para Messenger

**Decision**: Reutilizar `obtenerEstadoVentanaMensajeria` (`src/conversaciones/providers/instagram-ventana.ts`) para Facebook Messenger — la política de ventana estándar de 24h + extensión de 7 días con tag `HUMAN_AGENT` es la misma regla del Messenger Platform que ya rige a Instagram (confirmado en la documentación de Meta: mismo tag, misma ventana, mismo permiso `pages_messaging` de por medio).

**Rationale**: Evita reproducir el problema diagnosticado y corregido en `004-fix-instagram-human-agent` (falla silenciosa fuera de ventana) para un canal nuevo desde el día uno.

**Alternatives considered**: No aplicar ninguna ventana y dejar que Meta rechace — descartado, replicaría a propósito un problema ya conocido y resuelto para el canal hermano.

## Resumen de NEEDS CLARIFICATION resueltos

Ninguno quedó abierto — Technical Context no tenía marcadores `NEEDS CLARIFICATION` sin resolver; todas las decisiones anteriores parten de documentación oficial de Meta y del código ya existente en el repositorio.
