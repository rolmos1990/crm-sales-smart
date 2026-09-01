# Implementation Plan: Registrar en Karia los mensajes enviados desde la app nativa del canal

**Branch**: `020-fix-mensajes-app-nativa` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-fix-mensajes-app-nativa/spec.md`

## Summary

Instagram, Facebook Messenger y WhatsApp (Baileys) descartan hoy todo evento de "mensaje propio" (`is_echo` / `fromMe`) sin distinguir si ese eco corresponde a un mensaje que Karia ya envió (y ya registró, vía `idExterno`) o a un mensaje que un operador envió desde la app nativa del canal (nunca registrado en ningún lado). La corrección: en los tres canales, antes de descartar un evento de eco, verificar `idExterno` contra `MensajeConversacion` — si ya existe, ignorar (sin cambios); si no existe, registrarlo como mensaje saliente con un origen nuevo y distinguible (`RemitenteMsg.AGENTE_CANAL_NATIVO`), reutilizando la resolución de contacto/conversación ya existente pero sin disparar la orquestación de IA ni la creación automática de oportunidades (ese comportamiento es exclusivo de mensajes que sí vienen del contacto).

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router, Node.js 20+)

**Primary Dependencies**: Prisma 7 (PostgreSQL), RabbitMQ (`amqplib`, wrapper propio en `src/shared/rabbitmq`), `@whiskeysockets/baileys` (WhatsApp), Meta Graph API (Instagram / Facebook Messenger, vía `fetch`), Zod v4

**Storage**: PostgreSQL vía Prisma — cambio de esquema acotado a un nuevo valor del enum `RemitenteMsg` en `MensajeConversacion.remitente`

**Testing**: Vitest (unit — ya usado para providers de canal, ver `facebook-messenger.test.ts`); validación manual end-to-end vía `quickstart.md` (no hay entorno de staging de Meta/Baileys accesible en CI para un test de integración real de webhook)

**Target Platform**: Servidor Next.js (App Router, Node runtime) + worker de suscriptores RabbitMQ (mismo proceso lógico que ya consume `PROCESAR_ENTRANTE`)

**Project Type**: Web application (monolito Next.js con dominio modular, no hay separación frontend/backend de repos)

**Performance Goals**: Sin objetivo nuevo — el ajuste reutiliza la misma cola/consumidor con reintentos acotados que ya usa `PROCESAR_ENTRANTE`; debe seguir respondiendo al webhook de Meta dentro de su ventana de timeout (encolar, no procesar síncronamente en el handler HTTP)

**Constraints**: No debe alterar de ninguna forma observable el flujo existente de envío desde Karia ni el de recepción de mensajes del contacto (FR-007); no debe duplicar mensajes bajo condiciones de carrera (edge case de spec); no debe disparar respuesta automática de IA para un mensaje que la propia cuenta ya envió por fuera de Karia

**Scale/Scope**: 3 canales (Instagram, Facebook Messenger, WhatsApp Lite/Baileys), 4 puntos de código que hoy descartan el evento de eco (`instagram/route.ts`, `whatsapp-lite/reconectar.ts`, `whatsapp-lite/sesion/route.ts` — ver Diagnóstico previo en spec.md), 1 valor nuevo de enum, 1 comando/cola nueva reutilizando infraestructura existente, cambios de UI acotados a la burbuja de mensaje

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Modular Business Architecture** — PASS. El ajuste extiende el módulo `conversaciones` existente (nueva función en `actions.ts`, nuevo suscriptor en `src/suscriptores/mensajes/`) en vez de crear un módulo paralelo. Los componentes React (`burbuja-mensaje.tsx`) no acceden a Prisma directamente — siguen consumiendo `MensajeConMeta` ya resuelto por el server.
- **II. Server-Enforced Business Rules** — PASS. Toda la lógica de deduplicación y el nuevo estado de mensaje se resuelven en el servidor (webhook handler + suscriptor), no en el cliente.
- **III. Reliable Data and Events** — PASS, con diseño explícito para cumplirlo: el nuevo flujo se procesa vía un comando RabbitMQ (mismo patrón que `PROCESAR_ENTRANTE`), tolera duplicados (dedup por `idExterno`, dos veces — antes de resolver conversación y antes de insertar, igual que el flujo entrante existente, para cubrir la condición de carrera del edge case) y no bloquea el ack del webhook HTTP de Meta.
- **IV. Replaceable Integrations** — PASS. No se toca la forma de los adaptadores (`ICanalProvider`); el cambio en `mapearEntrante` de Instagram/Messenger es un ajuste interno de esa implementación (swap `sender`↔`recipient` para eventos de eco), no del contrato.
- **V. Security and Quality** — PASS con obligación explícita: cada consulta/mutación sigue scoped por `instanciaId` (igual que el flujo entrante existente); no se loguean tokens ni payloads con datos sensibles nuevos (el log ya existente del webhook no cambia su alcance); se requieren tests unitarios para la lógica de dedup/swap sender-recipient y para el nuevo valor de enum en el mapeo de la UI.

No hay violaciones que requieran `Complexity Tracking`.

## Project Structure

### Documentation (this feature)

```text
specs/020-fix-mensajes-app-nativa/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                                  # + valor de enum RemitenteMsg.AGENTE_CANAL_NATIVO (nueva migración)

src/
├── eventos/
│   └── contratos/
│       └── procesar-mensaje-app-nativa.comando.ts # nuevo — re-exporta el payload de procesar-entrante.comando.ts (mismo shape, sin DTO duplicado)
├── eventos/catalogo.ts                            # + ComandosSistema.ProcesarMensajeAppNativa
├── shared/
│   ├── eventos/registro.ts                        # + TIPOS_COMANDO.PROCESAR_MENSAJE_APP_NATIVA (compat)
│   └── rabbitmq/exchanges.ts                       # + QUEUES.MENSAJE_APP_NATIVA, RK.COMANDO_MENSAJE_APP_NATIVA, entrada en TIPO_EVENTO_A_RK
├── suscriptores/
│   ├── mensajes/
│   │   └── procesar-mensaje-app-nativa.suscriptor.ts  # nuevo — mismo patrón que procesar-entrante.suscriptor.ts
│   └── registrar.ts                                # + registro del nuevo suscriptor
├── conversaciones/
│   ├── actions.ts                                  # refactor: extraer resolverContactoYConversacion() de procesarMensajeEntrante(); + registrarMensajeAppNativa()
│   ├── types.ts                                    # sin cambios de forma (RemitenteMsg ya se re-exporta desde Prisma; el nuevo valor llega solo)
│   └── components/
│       └── burbuja-mensaje.tsx                     # + AGENTE_CANAL_NATIVO en esPropioONota; + indicador visual de origen "app nativa"
├── conversaciones/providers/
│   ├── instagram.ts                                # mapearEntrante: usar recipient.id (no sender.id) cuando message.is_echo
│   └── facebook-messenger.ts                       # mismo ajuste (mapearEntrante comparte forma con Instagram)
├── app/api/webhooks/instagram/route.ts             # reemplazar `if (is_echo || read) continue` por: read→continue; is_echo→verificar idExterno y encolar PROCESAR_MENSAJE_APP_NATIVA si es nuevo
└── integraciones/whatsapp-lite/
    ├── encolar-mensaje.ts                          # extraer helper de contenido/media compartido; + encolarMensajeAppNativaWA()
    ├── reconectar.ts                                # reemplazar `if (msg.key.fromMe) continue` por la misma verificación
    └── app/api/integraciones/whatsapp-lite/sesion/route.ts  # mismo ajuste que reconectar.ts (FR-006: los dos puntos, no solo uno)
```

**Structure Decision**: Se extiende el módulo `conversaciones` (dominio ya existente) y la infraestructura de comandos RabbitMQ ya existente (`src/shared/rabbitmq`, `src/suscriptores`) — no se crea ningún módulo, servicio ni tabla nueva. Es la misma arquitectura Comando→Cola→Suscriptor→Server Action que ya usa `PROCESAR_ENTRANTE`, replicada para el caso "mensaje saliente detectado por eco, no por Karia", que es deliberadamente un flujo hermano y no una rama condicional dentro de `procesarMensajeEntrante` (evita que un mensaje ajeno al contacto dispare IA/creación de oportunidad — ver research.md R3).

## Complexity Tracking

*Sin violaciones — tabla omitida.*
