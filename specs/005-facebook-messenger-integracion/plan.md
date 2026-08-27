# Implementation Plan: Integración de Facebook Messenger en el CRM

**Branch**: `005-facebook-messenger-integracion` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-facebook-messenger-integracion/spec.md`

## Summary

Agregar Facebook Messenger como un canal de mensajería más de Karia — mismo patrón ya probado por Instagram (proveedor de canal, cuenta conectada por Página, conversaciones e integración a Pipeline genéricas, procesamiento asíncrono por webhook/eventos). Es una integración nueva de punta a punta (no existe código de Messenger hoy), construida extendiendo la arquitectura de canales conectables existente en vez de crear una paralela. El riesgo técnico central, ya identificado en la investigación de la spec, es que **Meta entrega los mensajes de Messenger y los de Instagram conectado vía Página por el mismo tipo de evento de webhook** (`object: "page"`), así que hay que distinguirlos con precisión dentro del webhook ya existente sin alterar su comportamiento actual — ver Phase 0.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 App Router (Node.js 20+)

**Primary Dependencies**: Prisma 7 (PostgreSQL), RabbitMQ (eventos/comandos asíncronos), Zod v4, shadcn/ui + Tailwind v4

**Storage**: PostgreSQL vía Prisma — reutiliza los modelos existentes `CuentaCanal`, `Conversacion`, `MensajeConversacion`, `ContactoIdentificadorCanal` (sin cambios de esquema más allá de un nuevo valor de `canal`)

**Testing**: Vitest (unit/integration de lógica de proveedor y clasificación de webhook); Playwright para el flujo crítico de conectar/ver conversación en el panel de Integraciones

**Target Platform**: Web service (Next.js Route Handlers + consumidores RabbitMQ ya existentes en el worker)

**Project Type**: Web application (monolito Next.js con módulos de dominio bajo `src/`)

**Performance Goals**: Igual que Instagram hoy — mensaje entrante visible en el inbox en tiempo real (SSE, sin polling agresivo); sin metas nuevas distintas a las ya vigentes para los demás canales

**Constraints**: FR-007 (cero cambios de comportamiento en Instagram); el webhook de mensajería de Página de Meta es compartido a nivel de app (un solo Callback URL por objeto `page` en el Meta App Dashboard) — no se puede resolver con una URL de webhook separada, la distinción debe ser interna

**Scale/Scope**: Multi-tenant (una o más Páginas por instancia, igual que Instagram admite varias cuentas)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | ✅ PASA — se extiende el módulo `conversaciones`/`integraciones` ya existente (mismo patrón que Instagram/WhatsApp); no se crea una abstracción paralela. Nuevo proveedor implementa el contrato `ICanalProvider` ya establecido. |
| II. Server-Enforced Business Rules | ✅ PASA — conexión/desconexión y envío pasan por Server Actions/Route Handlers con `requireSesion()` + `verificarAcceso()`, igual que Instagram; validación con Zod en los boundaries nuevos. |
| III. Reliable Data and Events | ✅ PASA — reutiliza el mismo pipeline de eventos/RabbitMQ y los mismos consumidores (`EnviarMensajeSuscriptor`, etc.) ya idempotentes; el webhook nuevo debe ser idempotente igual que el de Instagram (dedup por `idExterno`). |
| IV. Replaceable Integrations | ✅ PASA — Facebook Messenger se implementa como un `ICanalProvider` más, sin que el resto del sistema dependa de tipos/payloads de Meta directamente. Requiere timeouts/reintentos acotados igual que `instagram.ts`. |
| V. Security and Quality (NON-NEGOTIABLE) | ✅ PASA (re-verificado post-diseño) — `data-model.md` confirma: todo scoped por `instanciaId`, token de Página cifrado en reposo reutilizando `cifrarToken`/`descifrarToken` (sin mecanismo nuevo), `state` de OAuth firmado reutilizando `estado-oauth.ts` ya asegurado. |
| Stack aprobado | ✅ PASA — no se introduce ninguna dependencia nueva; todo con Next.js/Prisma/RabbitMQ/Zod ya presentes. |

No hay violaciones que requieran justificación en Complexity Tracking.

**Re-chequeo post Phase 1**: sin cambios respecto a la evaluación inicial — el diseño en `research.md`/`data-model.md` no introdujo ninguna dependencia, tabla o patrón nuevo que requiera reevaluar un principio. Gate PASA.

## Project Structure

### Documentation (this feature)

```text
specs/005-facebook-messenger-integracion/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── conversaciones/
│   └── providers/
│       ├── facebook-messenger.ts        # NUEVO — ICanalProvider (enviarMensaje, mapearEntrante, enviarReaccion)
│       └── registry.ts                  # MODIFICADO — registrar "facebook_messenger"
├── integraciones/
│   └── facebook-messenger/              # NUEVO módulo — mismo patrón que integraciones/instagram/
│       ├── conectar.ts                  # conectar/renovar cuenta (Página + token)
│       ├── queries.ts                   # estado de conexión (FR-008)
│       ├── actions.ts                   # desconectar cuenta (FR-009)
│       └── components/
│           └── panel-facebook-messenger.tsx
├── app/
│   ├── integraciones/
│   │   └── facebook-messenger/
│   │       └── page.tsx                 # NUEVO — página del componente "Facebook Messenger"
│   └── api/
│       ├── integraciones/facebook-messenger/
│       │   ├── oauth/route.ts           # NUEVO — inicia conexión (mismo patrón que oauth/route.ts de Instagram ya asegurado)
│       │   └── callback/route.ts        # NUEVO — completa conexión
│       └── webhooks/instagram/route.ts  # MODIFICADO — distinguir eventos de Messenger vs Instagram-vía-Página (ver research.md)
└── integraciones/catalog.ts             # MODIFICADO — nueva entrada "facebook_messenger" en categoría "mensajeria"

prisma/schema.prisma                     # SIN cambios estructurales — nuevo valor de canal ("facebook_messenger") en columnas String existentes
```

**Structure Decision**: Aplicación web única (Next.js monolito por dominios bajo `src/`, ya establecido). No se introduce un proyecto/paquete nuevo — Facebook Messenger es un módulo más dentro de `conversaciones/` e `integraciones/`, siguiendo exactamente la carpeta que ya usa Instagram (`src/integraciones/instagram/`, `src/app/integraciones/instagram/`) como plantilla estructural.

## Complexity Tracking

*Sin violaciones a justificar — ver Constitution Check arriba.*
