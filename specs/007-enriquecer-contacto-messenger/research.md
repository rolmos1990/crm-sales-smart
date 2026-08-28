# Phase 0 Research: Enriquecer el contacto de Facebook Messenger

## R1 — Qué datos de contacto entrega realmente la API de Messenger

**Contexto**: se consultó la documentación oficial de Meta (Messenger Platform, "User Profile API", actualizada). Endpoint: `GET https://graph.facebook.com/<PSID>?fields=first_name,last_name,profile_pic&access_token=<PAGE_ACCESS_TOKEN>` — mismo host y mismo patrón que ya usa `obtenerPerfilRemitenteIG` para Instagram vía Página.

**Decision**: pedir `first_name`, `last_name`, `profile_pic`. No pedir `email` ni `phone` (no existen como campos de este endpoint, bajo ningún permiso).

**Rationale**:
- `first_name`/`last_name`/`profile_pic` están documentados como campos disponibles, con el mismo nivel de acceso base (feature `Business Asset User Profile Access`) que ya se planeó no usar hasta ahora — ver R2 sobre el requisito de aprobación.
- `locale`, `timezone`, `gender` también existen pero cada uno requiere un permiso propio (`pages_user_locale`, `pages_user_timezone`, `pages_user_gender`) y no son datos que el CRM use hoy para ningún contacto de ningún canal — pedirlos sería declarar permisos nuevos ante Meta sin un uso real, mismo criterio ya aplicado en las auditorías anteriores de este proyecto (no declarar lo que no se usa).
- `email`/`phone`: confirmado que Messenger no los expone a través de esta API bajo ninguna circunstancia — no es una omisión de permisos, es un límite de la plataforma. Instagram tiene la misma limitación hoy. Se documenta en la spec como límite de plataforma, no como alcance pendiente.

**Alternatives considered**:
- *Pedir también `locale`/`timezone`/`gender`*: descartado — no hay ningún campo de `Contacto` en el CRM para esos datos hoy, y pedirlos ante Meta sin uso real generaría exactamente el tipo de permiso "no usado" que ya se recomendó remover en auditorías previas de este mismo proyecto.
- *Usar los quick replies de email/teléfono que documenta Meta (`Messenger Platform 2.3`)*: es un mecanismo distinto — le pide activamente al contacto que comparta su email/teléfono con un botón dentro de la conversación, no algo que se obtenga pasivamente del perfil. Cambiaría la experiencia de conversación (agregaría un paso de interacción) y no es lo que pidió el usuario ("la información que nos entregue el API", no un flujo de captura activa). Se descarta para esta corrección; queda como posible feature aparte si se pide explícitamente.

## R2 — Requisito de aprobación de Meta para producción

**Contexto**: la documentación de Meta exige, para poder acceder a `name`/`first_name`/`last_name`/`profile_pic` de personas que no tienen un rol en la app (es decir, clientes reales, no administradores/testers), tener **Advanced Access** de la función `Business Asset User Profile Access`, obtenida vía App Review.

**Decision**: implementar la consulta igual, dejándola lista para cuando esa función esté aprobada, con degradación segura (si Meta la rechaza por falta de aprobación, el contacto se crea igual sin nombre/foto — FR-004). No se bloquea esta corrección esperando la aprobación de Meta.

**Rationale**: exactamente el mismo patrón ya usado en este proyecto para Human Agent (`004-fix-instagram-human-agent`) — el código se implementa y funciona de inmediato para pruebas (administradores/testers de la app), y se activa solo para el resto de usuarios cuando Meta aprueba. Bloquear esta corrección hasta obtener la aprobación dejaría el problema reportado sin solución alguna mientras tanto, incluso para las propias pruebas del usuario.

**Alternatives considered**:
- *Esperar a solicitar y obtener la aprobación de Meta antes de tocar código*: descartado — no hay ninguna razón técnica para no implementarlo ya; la app ya está en modo Live y en Standard Access, que sí permite esta consulta para personas con un rol en la app (como ya lo verificó el usuario al probar con su propia cuenta).

## R3 — Dónde vive el cambio y qué se reutiliza

**Contexto**: `webhooks/instagram/route.ts` ya tiene, para Instagram, el patrón completo: verificar si al contacto le falta nombre/foto (`ContactoIdentificadorCanal` + `Contacto`), y si falta, pedirlo a Meta con `obtenerPerfilRemitenteIG`. Ese bloque hoy está condicionado a `canalResuelto === "instagram"` — para Messenger, ni siquiera se evalúa si falta perfil, se asume `perfil = {}` directamente.

**Decision**: generalizar esa verificación para que corra también cuando `canalResuelto === "facebook_messenger"` (consultando `ContactoIdentificadorCanal` con `canal: canalResuelto` en vez de `"instagram"` fijo), y agregar `obtenerPerfilRemitenteFacebook(psid, cuentaCanal)` como función hermana de `obtenerPerfilRemitenteIG` en el mismo archivo, con el mismo manejo de errores (try/catch → `{}`).

**Rationale**: mínimo cambio posible sobre un patrón ya probado en producción (Instagram); no se toca la lógica de creación/actualización de contacto (`procesarMensajeEntrante`, en `conversaciones/actions.ts`), que ya es genérica por canal y ya respeta "no sobrescribir datos existentes" (confirmado leyendo su código: solo completa `nombre` si está vacío, solo completa `avatarUrl` si no existe).

**Alternatives considered**:
- *Fusionar `obtenerPerfilRemitenteIG` y la nueva función en una sola, parametrizada por canal*: los campos que se piden son distintos (`name,username,profile_pic` vs `first_name,last_name,profile_pic`) y Messenger no tiene equivalente a `username`/`handleCanal` (Facebook no expone un nombre de usuario público como Instagram) — fusionar agregaría condicionales internos sin reducir duplicación real. Se prefieren dos funciones cortas y explícitas, mismo criterio de "un provider por canal" ya establecido en `conversaciones/providers/`.

## Resumen de NEEDS CLARIFICATION resueltos

Ninguno quedó abierto — Technical Context no tenía marcadores sin resolver; R1 y R2 resuelven con datos verificables de la documentación de Meta, no con supuestos.
