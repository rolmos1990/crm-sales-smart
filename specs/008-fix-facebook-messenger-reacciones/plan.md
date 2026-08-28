# Implementation Plan: Corregir reacciones en Facebook Messenger

**Branch**: `008-fix-facebook-messenger-reacciones` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-fix-facebook-messenger-reacciones/spec.md`

## Summary

Cuatro causas puntuales, dos por dirección, todas heredadas de que reacciones quedó fuera de alcance en `005-facebook-messenger-integracion`:

**Saliente (Karia → Facebook)**: `FacebookMessengerProvider` no implementa `enviarReaccion` ni declara `capacidades.reacciones` — `toggleReaccion` (`conversaciones/actions.ts`) ya guarda la reacción localmente para cualquier canal, pero solo la reenvía al canal externo si el provider lo declara soportado.

**Entrante (Facebook → Karia)**: (a) la Página se suscribe solo al campo `messages` al conectar — `message_reactions` es un campo de webhook aparte para Messenger (confirmado contra documentación oficial, a diferencia de otros eventos que Meta sí agrupa dentro de `messages`); Meta nunca envía el aviso. (b) el webhook que sí procesa reacciones (`procesarReaccionIG`) descarta explícitamente cualquier evento que no sea de Instagram, y además graba `canal: "instagram"` fijo al persistir la reacción.

El enfoque: implementar `enviarReaccion` en el provider de Messenger (mismo Send API que ya usa Instagram), sumar `message_reactions` a la suscripción del webhook (nuevas conexiones + una corrección puntual para las Páginas ya conectadas, FR-005), y generalizar `procesarReaccionIG` para aceptar el canal en vez de asumir Instagram.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router, sin cambios de versión)

**Primary Dependencies**: Ninguna nueva — mismo `fetch` a Graph API ya usado por `InstagramProvider.enviarReaccion` y por `suscribirWebhookFacebookMessenger`

**Storage**: PostgreSQL vía Prisma — sin cambios de esquema; se sigue escribiendo `MensajeReaccion` (ya existente), solo se generaliza qué valor de `canal` se le graba

**Testing**: Se extiende `facebook-messenger.test.ts` con casos para `enviarReaccion` (mismo patrón que los de `enviarMensaje` ya existentes); validación end-to-end principal vía `quickstart.md` (requiere una Página y una cuenta de Facebook de prueba reales)

**Target Platform**: Web — `src/conversaciones/providers/facebook-messenger.ts`, `src/app/api/webhooks/instagram/route.ts`, `src/integraciones/facebook-messenger/conectar.ts`

**Project Type**: Web application — mismo proyecto Next.js único ya existente

**Performance Goals**: N/A — mismo volumen y patrón de llamadas que Instagram ya soporta hoy en producción

**Constraints**: No alterar el comportamiento de reacciones ya existente de Instagram (FR-007); no bloquear la conversación si Meta rechaza el envío de una reacción (FR-006); la corrección para Páginas ya conectadas MUST ser retroactiva sin pedirle al usuario que reconecte manualmente (FR-005, SC-004)

**Scale/Scope**: 3 archivos de código (`facebook-messenger.ts`, `webhooks/instagram/route.ts`, `integraciones/facebook-messenger/conectar.ts`) + 1 script puntual de corrección para Páginas ya conectadas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — el cambio extiende el provider ya existente (`FacebookMessengerProvider`) y el webhook ya compartido, sin abstracción paralela; mismo patrón que Instagram usa hoy para lo mismo. |
| II. Server-Enforced Business Rules | N/A — no hay reglas de negocio nuevas; se reutiliza `toggleReaccion`, que ya decide server-side cuándo reenviar al canal. |
| III. Reliable Data and Events | PASS — el envío de reacción al canal externo ya es tolerante a fallos (`try/catch`, la reacción queda guardada en BD igual); no se agregan transacciones nuevas. El webhook de reacciones entrantes debe seguir siendo idempotente (mismo criterio ya usado: `deleteMany` antes de `create`, sin cambios en esa lógica). |
| IV. Replaceable Integrations | PASS — se llama al mismo Send API de Meta ya integrado (`/PAGE_ID/messages`), sin filtrar tipos/payloads de Meta hacia el resto del sistema. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — reutiliza el token de Página ya cifrado/descifrado; no se agrega ni loguea ningún dato sensible nuevo. Testing proporcional al riesgo (se agregan tests unitarios al provider, igual que ya tiene Instagram). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` no agrega entidades ni cambia el modelo de datos — confirma que no hay nada que re-evaluar. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/008-fix-facebook-messenger-reacciones/
├── plan.md              # This file
├── research.md          # Phase 0 output — confirmación de Meta docs + decisión de la corrección retroactiva (FR-005)
├── data-model.md         # Phase 1 output — sin entidades nuevas, solo generalización de un valor de canal
└── quickstart.md         # Phase 1 output — guía de validación manual end-to-end
```

No se genera `contracts/`: no hay ninguna superficie nueva expuesta por Karia — son llamadas salientes adicionales hacia una API externa ya integrada (Graph API de Meta) y un webhook ya existente que se generaliza.

### Source Code (repository root)

```text
src/
├── conversaciones/
│   └── providers/
│       └── facebook-messenger.ts       # FR-001/002 — implementar enviarReaccion, capacidades.reacciones: true
├── app/
│   └── api/
│       └── webhooks/
│           └── instagram/
│               └── route.ts            # FR-003/004 — generalizar procesarReaccionIG (renombrar/parametrizar canal), quitar el gate a solo Instagram
└── integraciones/
    └── facebook-messenger/
        └── conectar.ts                 # FR-005 (parte 1) — sumar message_reactions a subscribed_fields para conexiones nuevas

scripts/
└── resuscribir-reacciones-messenger.ts  # FR-005 (parte 2) — corrección puntual para Páginas ya conectadas, mismo patrón que scripts/reparar-oportunidades-pipeline.ts ya existente en el repo
```

**Structure Decision**: no se crea ningún módulo nuevo. El cambio vive en los tres archivos ya responsables de mensajería/conexión de Facebook Messenger, más un script de corrección puntual siguiendo el patrón ya establecido en `scripts/` del repositorio.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
