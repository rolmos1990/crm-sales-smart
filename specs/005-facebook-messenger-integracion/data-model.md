# Data Model: Integración de Facebook Messenger en el CRM

**Feature**: `005-facebook-messenger-integracion` | **Date**: 2026-08-27

No se agregan tablas ni columnas nuevas. Todo el modelo de datos que esta feature necesita ya existe (`CuentaCanal`, `Conversacion`, `MensajeConversacion`, `ContactoIdentificadorCanal`) porque `canal` es una columna de texto libre, no un enum cerrado — el mismo patrón ya usado para sumar Instagram sin migrar el esquema aplica acá. Este documento describe cómo se usan esas entidades existentes con el nuevo valor de canal `"facebook_messenger"`.

## Entidades existentes involucradas (sin cambios de esquema)

- **CuentaCanal** (`prisma/schema.prisma`): una fila por Página de Facebook conectada para Messenger, con `canal: "facebook_messenger"`.
  - `identificador`: ID de la Página de Facebook.
  - `configuracion` (Json): `{ accessToken: <cifrado con cifrarToken>, pageId, pageName, ... }` — mismo shape conceptual que ya usa Instagram, sin los campos específicos de Instagram (`instagramBusinessAccountId`, `username`).
  - `proveedorAuth` (enum `ProveedorAuthCanal`): el campo es, por su propio comentario en el schema, específico de la lógica de renovación de Instagram (`"solo relevante para canal instagram"`). Facebook Messenger no lo necesita — queda en su valor por defecto (`MetaFacebook`) y se ignora para este canal, igual que ya ocurre hoy para `whatsapp_lite`/`email`. **No se agrega un valor de enum nuevo.**
  - `pipelineId`/`stageId`: reutilizados sin cambios — es el mismo mecanismo genérico que ya asocia conversaciones nuevas a una Oportunidad (FR-004).
  - Restricción existente a replicar: el índice único parcial `(instanciaId, identificador) WHERE canal = 'instagram'` (migración `20260817120000_add_instagram_auth_provider`) tiene un equivalente necesario para `facebook_messenger`, para impedir conectar la misma Página dos veces en la misma instancia. Se documenta como tarea de migración en `tasks.md`, no como cambio de este documento.

- **Conversacion**: sin cambios — se crea/reabre igual que para cualquier otro canal, vía `cuentaCanalId` apuntando a una `CuentaCanal` con `canal: "facebook_messenger"`.

- **MensajeConversacion**: sin cambios — mismos campos (`idExterno` para dedup, `codigoError`/`motivoError` para fallos de envío, reutilizando la clasificación de errores de Graph API ya usada por Instagram donde el código de error coincide).

- **ContactoIdentificadorCanal**: sin cambios de esquema. Uso nuevo (no un campo nuevo): antes de tratar un evento `object: "page"` del webhook como Messenger, se consulta esta tabla con `canal: "instagram"` para el `sender.id` del evento — si ya existe, el evento se procesa como Instagram (ver `research.md` R1). Es una consulta de lectura adicional, no una relación nueva.

## Reglas de validación (derivadas de los FR)

- Toda consulta/mutación sobre `CuentaCanal` de `canal: "facebook_messenger"` MUST ir scoped por `instanciaId` — mismo criterio ya exigido para Instagram (Constitución, Principio V).
- `configuracion.accessToken` MUST guardarse cifrado (`cifrarToken`, AES-256-GCM) — nunca en texto plano, reutilizando `src/shared/lib/cifrado-tokens.ts` (FR implícito por el Principio V de la Constitución; ver `research.md` R3).
- La resolución de `object: "page"` en el webhook MUST intentar primero la coincidencia por `ContactoIdentificadorCanal(canal: "instagram")` antes de considerar `facebook_messenger`, para no alterar el comportamiento actual de Instagram (FR-006, FR-007).
- Un mensaje entrante de Messenger sin `idExterno` (`mid`) ya conocido MUST deduplicarse igual que Instagram (`findFirst` por `idExterno` antes de encolar) — mismo criterio, mismo `MensajeConversacion.idExterno`.

## Estado de la conexión (FR-008)

No es una entidad nueva — es una interpretación de campos ya existentes en `CuentaCanal`, igual que el patrón ya usado para el estado de Human Agent de Instagram (`004-fix-instagram-human-agent`, `obtenerRechazosHumanAgent`):

- `activa: true` + `tokenExpiraEn` en el futuro → conexión activa.
- `activa: true` + `tokenExpiraEn` vencido o `configuracion.accessToken` ausente → conexión con problema, se muestra al responsable de la integración.
- `activa: false` → desconectada (por acción del usuario o por una solicitud de eliminación de datos de Meta, mismo patrón que `eliminacion-datos/route.ts` ya aplica a Instagram).
