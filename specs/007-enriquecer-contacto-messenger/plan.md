# Implementation Plan: Enriquecer el contacto al recibir mensajes de Facebook Messenger

**Branch**: `007-enriquecer-contacto-messenger` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-enriquecer-contacto-messenger/spec.md`

## Summary

Facebook Messenger no completa nombre/foto del contacto porque el webhook nunca llama a ningún endpoint de perfil para ese canal (`perfil = {}` fijo) — una decisión explícita tomada en `005-facebook-messenger-integracion` por incertidumbre sobre si Meta ofrecía el dato. Ya se confirmó contra la documentación oficial que sí lo ofrece (`first_name`, `last_name`, `profile_pic`, mismo tipo de consulta `GET /{id}?fields=...` que ya usa Instagram), pero **no** email ni teléfono (no existen para este canal). El enfoque: agregar una función de perfil específica para Messenger, análoga a la que ya usa Instagram, y generalizar el único punto del webhook que hoy asume `canal: "instagram"` al decidir si hace falta pedir el perfil. Toda la lógica de creación/actualización de contacto (no sobrescribir datos ya completados, tolerar que Meta no responda) ya es genérica por canal — no se toca.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router, sin cambios de versión)

**Primary Dependencies**: Ninguna nueva — mismo `fetch` a Graph API ya usado por `obtenerPerfilRemitenteIG`

**Storage**: PostgreSQL vía Prisma — sin cambios de esquema; se sigue escribiendo `Contacto.nombre`/`.avatarUrl` y `ContactoIdentificadorCanal.handle` ya existentes, vía la misma función genérica `procesarMensajeEntrante` (confirmado que ya no sobrescribe datos existentes — FR-003 no requiere código nuevo)

**Testing**: Extender `resolver-canal-webhook-page.test.ts`/tests de `webhooks/instagram/route.ts` no aplica (la función de perfil no está extraída como pura hoy); se agrega un test unitario nuevo para la función de mapeo de perfil de Facebook, mismo criterio que ya no existe para `obtenerPerfilRemitenteIG` (sin test hoy, por eso tampoco es bloqueante acá) — validación principal vía `quickstart.md`

**Target Platform**: Web — `src/app/api/webhooks/instagram/route.ts` (webhook compartido de Instagram/Messenger, ver `005-facebook-messenger-integracion`)

**Project Type**: Web application — mismo proyecto Next.js único ya existente

**Performance Goals**: N/A — una llamada HTTP adicional a Graph API solo quando falta perfil (mismo patrón/costo que Instagram ya paga hoy), no en cada mensaje

**Constraints**: No pedir ni prometer email/teléfono (FR-005 — la plataforma de Meta no los entrega); no sobrescribir nombre/foto ya completados (FR-003, ya genérico); no romper la recepción del mensaje si Meta rechaza la consulta por falta de aprobación de `Business Asset User Profile Access` (FR-004); no alterar el comportamiento de Instagram (FR-006)

**Scale/Scope**: 1 archivo principal (`webhooks/instagram/route.ts`) — nueva función `obtenerPerfilRemitenteFacebook` + generalizar la verificación de "falta perfil" para incluir `canal: "facebook_messenger"`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — el cambio vive en el webhook ya existente del módulo `conversaciones`, replicando el patrón ya usado para Instagram en el mismo archivo, sin abstracción paralela. |
| II. Server-Enforced Business Rules | N/A — no hay reglas de negocio nuevas; se reutiliza `procesarMensajeEntrante`, que ya decide server-side si sobrescribe o no un dato. |
| III. Reliable Data and Events | PASS — la consulta de perfil es de solo lectura hacia Meta y tolerante a fallos (si Meta rechaza, se sigue publicando el evento igual, mismo criterio que Instagram); no se agregan transacciones nuevas. |
| IV. Replaceable Integrations | PASS — se llama a Graph API con timeout implícito de `fetch` y `try/catch` que degrada a `{}`, mismo patrón que `obtenerPerfilRemitenteIG`; no se filtra ningún tipo/payload de Meta hacia el resto del sistema (se sigue devolviendo `MensajeEntranteNormalizado`/perfil ya tipado). |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — la consulta usa el token de Página ya cifrado/descifrado con el mecanismo existente (`descifrarToken`); no se agrega ni loguea ningún dato sensible nuevo. Testing proporcional al riesgo (bajo — solo lectura, con degradación segura). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` no agrega entidades ni cambia el modelo de datos — confirma que no hay nada que re-evaluar. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/007-enriquecer-contacto-messenger/
├── plan.md              # This file
├── research.md          # Phase 0 output — campos disponibles en Meta, decisión de diseño
├── data-model.md         # Phase 1 output — mapeo de campos de Meta → Contacto, sin entidades nuevas
└── quickstart.md         # Phase 1 output — guía de validación manual
```

No se genera `contracts/`: no hay ninguna superficie nueva expuesta por Karia — es una llamada saliente adicional hacia una API externa ya integrada (Graph API de Meta), documentada en `research.md`.

### Source Code (repository root)

```text
src/
└── app/
    └── api/
        └── webhooks/
            └── instagram/
                └── route.ts   # FR-001/002/003/004 — nueva obtenerPerfilRemitenteFacebook() + generalizar el chequeo de "falta perfil" a facebook_messenger
```

**Structure Decision**: no se crea ningún módulo ni archivo nuevo. El cambio vive enteramente en el webhook ya compartido entre Instagram y Facebook Messenger (`005-facebook-messenger-integracion`), extendiendo un patrón ya presente ahí mismo para Instagram.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
