# Implementation Plan: Canal de correo electrónico

**Branch**: `034-canal-correo-electronico` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/034-canal-correo-electronico/spec.md`

## Summary

Convertir el correo electrónico en un canal de atención de primera clase, al mismo nivel que WhatsApp,
Instagram y Messenger: el negocio registra su propio buzón con credenciales de entrada y salida, Karia lee
la casilla periódicamente desde el worker y publica cada correo nuevo por el **mismo camino de entrada que
ya usan los demás canales** (`ProcesarEntrante` → `procesarMensajeEntrante`), y responde por SMTP a través
del `EmailProvider` que hoy existe como stub.

Tres cosas son nuevas y no tienen análogo en los canales actuales, y son las que concentran el riesgo:

1. **Un lector de buzón con estado** (marca de posición por casilla, tolerante a reinicios y a lecturas
   interrumpidas) corriendo en el worker, no en la app Next.js.
2. **Higiene de correo**: descartar auto-respuestas, rebotes y bucles; recortar el hilo citado; convertir
   HTML a texto legible **sin renderizarlo nunca**.
3. **Un bloqueo nuevo de conversación** —aprobación de remitente pendiente— que debe cortar en los tres
   lugares desde los que hoy puede salir un mensaje: agente humano, agente de IA y motor de Workflows.

El resto se apoya en lo que ya existe: `CuentaCanal` ya tiene `canal`, `configuracion`, `pipelineId` y
`stageId`; `procesarMensajeEntrante` ya crea contacto, conversación y oportunidad con fallback de pipeline;
`cifrarToken` ya cifra credenciales en reposo; el Inbox ya tiene ícono y etiqueta para `canal === "email"`.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 16.2 (App Router), Prisma 7 + PostgreSQL, RabbitMQ (`amqplib`), Zod v4,
shadcn/ui sobre Base UI, TanStack Query v5.
**Nuevas** (justificadas en [research.md](./research.md) R1): `imapflow` 2.12 (IMAP), `mailparser` 3.14
(MIME), `nodemailer` **7.0** (SMTP — ver nota), `email-reply-parser` 3.0 (recorte del hilo citado).

> **Nota de versión (corregida al instalar)**: nodemailer queda en la línea **7.0**, no en la 10.6 que
> decía el plan original: `next-auth@5.0.0-beta.31` declara `peerOptional nodemailer@^7.0.7` y la 10.6
> rompe esa resolución. La API de SMTP que usa esta feature (`createTransport`, `verify`, `sendMail`) es la
> misma en ambas. La 7.0 no trae tipos propios, así que se suma `@types/nodemailer` como devDependency.
> `mailparser` conserva su propia copia anidada de nodemailer 10.6 sin conflicto.

**Storage**: PostgreSQL vía Prisma. Adjuntos en el storage de media ya existente (`src/lib/media`).
Credenciales del buzón en `CuentaCanal.configuracion` (Json), cifradas con AES-256-GCM.

**Testing**: Vitest (unidad: normalización, filtros de correo, recorte de cita, reglas de aprobación,
regresión de `resolverContactoYConversacion`), Playwright (e2e: registro del buzón y flujo de aprobación).

**Target Platform**: Coolify, dos servicios desplegables — App Next.js y Worker (`tsx
src/worker/disparadores.ts`). **El lector de buzones corre solo en el worker.**

**Project Type**: Aplicación web multi-tenant con worker de background y mensajería por eventos.

**Performance Goals**: correo visible en el Inbox en menos de 2 minutos desde que llegó (SC-003) → ciclo de
lectura cada 60 s. Hasta 50 buzones activos por ciclo sin retrasar el resto de los trabajos del worker.

**Constraints**: cuerpo de correo procesado ≤ 100 KB de texto; adjuntos ≤ 10 MB cada uno y ≤ 5 por correo;
timeout de 15 s por operación IMAP/SMTP; **nunca se renderiza el HTML del correo** (ver research.md R10);
migración aditiva y reversible sobre datos existentes.

**Scale/Scope**: 4 historias de usuario, 42 requisitos funcionales. ~6 columnas nuevas en 3 modelos, 1
migración, ~22 archivos nuevos y 7 archivos existentes modificados.

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado después de Phase 1.*

| Principio | Evaluación | Resultado |
|---|---|---|
| **I. Modular Business Architecture** | El canal vive en un módulo propio `src/integraciones/email/` y se expone al resto del sistema solo por `ICanalProvider` y por el comando `ProcesarEntrante` que ya existe. Los componentes React del panel no tocan Prisma ni `imapflow`. No se crea una abstracción paralela de canales: se extiende la que hay. | PASS |
| **II. Server-Enforced Business Rules** | Cada Server Action valida con Zod antes de tocar Prisma. El bloqueo por aprobación pendiente se aplica en el servidor (`enviarMensajeInterno`, orquestador de IA, motor de Workflows), no ocultando un botón en la UI. La validación de conexión ocurre en el servidor contra el servidor real. | PASS |
| **III. Reliable Data and Events** | Se reutilizan los comandos `ProcesarEntrante` y `EnviarMensaje` sobre RabbitMQ en vez de un flujo propio. Idempotencia en dos capas: marca de posición por UID y deduplicación por `Message-ID` (la que `procesarMensajeEntrante` ya hace sobre `idExterno`). La aprobación de un remitente ocurre en una sola transacción. El avance de la marca de lectura solo se persiste **después** de encolar el correo. | PASS |
| **IV. Replaceable Integrations** | `imapflow`, `mailparser` y `nodemailer` quedan detrás de `src/integraciones/email/imap/cliente.ts` y del `EmailProvider`. Ningún tipo ni código de error de esas librerías sale del módulo: los fallos se traducen a códigos funcionales propios (`CREDENCIALES_RECHAZADAS`, `SERVIDOR_INALCANZABLE`, …), igual que `EnvioMensajeError` hace hoy con Meta. Timeouts explícitos y degradación acotada: un buzón roto no afecta a los demás. | PASS |
| **V. Security and Quality (NO NEGOCIABLE)** | Todo query y mutación va por `instanciaId`. Credenciales cifradas en reposo y nunca devueltas al navegador (el panel recibe un indicador de "configurada", no el valor). El HTML del correo nunca se renderiza, se convierte a texto. Ni credenciales ni cuerpos de correo se escriben en logs. Tests de unidad para las reglas, de integración para la lectura idempotente, y e2e para registro y aprobación. | PASS |
| **Technical Constraints** | 4 dependencias nuevas, cada una con necesidad concreta y sin duplicar capacidad existente (research.md R1). Migración aditiva: todas las columnas nuevas son opcionales o con default, ningún dato existente cambia de significado. Se documenta el riesgo conocido de que `prisma migrate dev` proponga borrar los índices únicos parciales creados a mano. | PASS con nota |
| **Development Workflow** | Spec previo con alcance, criterios y exclusiones; las tres ambigüedades del pedido original quedaron resueltas con el solicitante y registradas en Assumptions, no inventadas. | PASS |

**Resultado del gate**: PASS. Las dos desviaciones que vale la pena justificar están en
[Complexity Tracking](#complexity-tracking).

## Project Structure

### Documentation (this feature)

```text
specs/034-canal-correo-electronico/
├── plan.md              # Este archivo
├── spec.md              # Qué y por qué
├── research.md          # Phase 0 — decisiones técnicas
├── data-model.md        # Phase 1 — modelo de datos y migración
├── quickstart.md        # Phase 1 — validación manual end-to-end
├── contracts/           # Phase 1 — contratos internos
│   ├── configuracion-buzon.md
│   ├── provider-email.md
│   └── server-actions.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — lo genera /speckit-tasks
```

### Source Code (repository root)

```text
src/integraciones/email/                 # NUEVO — todo el canal vive acá
├── actions.ts                           # Server Actions del buzón (registrar, editar, probar, eliminar)
├── queries.ts                           # Lectura de buzones de la instancia, SIN secretos
├── schema.ts                            # Zod: buzón, prueba de conexión, aprobación
├── configuracion.ts                     # Forma tipada de CuentaCanal.configuracion + cifrado/descifrado
├── conectar.ts                          # Validación IMAP + SMTP contra el servidor real
├── errores.ts                           # Códigos funcionales de conexión y envío de correo
├── imap/
│   ├── cliente.ts                       # Envoltorio de ImapFlow: timeouts, cierre seguro
│   ├── polling.ts                       # Ciclo multi-tenant, un buzón a la vez, con lock
│   └── marca-lectura.ts                 # UIDVALIDITY + último UID leído
├── mensaje/
│   ├── normalizar.ts                    # Correo crudo → MensajeEntranteNormalizado
│   ├── filtros.ts                       # Auto-respuestas, rebotes, correo propio, boletines
│   ├── limpiar-cita.ts                  # Recorte del hilo citado y de la firma
│   ├── html-a-texto.ts                  # HTML → texto legible (nunca se renderiza el HTML)
│   ├── adjuntos.ts                      # Descarga acotada y guardado en el storage de media
│   └── hilo.ts                          # Message-ID / In-Reply-To / References y asunto de respuesta
├── aprobacion/
│   ├── actions.ts                       # Aprobar creando contacto / asociando a uno existente
│   └── reglas.ts                        # requiereAprobacion() y lectura del bloqueo
└── components/
    ├── panel-buzones.tsx                # Client — lista y estado de los buzones
    ├── modal-registrar-buzon.tsx        # Client — alta con prueba de conexión
    └── tarjeta-buzon.tsx                # Client — estado, edición, activar/desactivar

src/app/integraciones/email/
├── page.tsx                             # NUEVO — Server Component
└── loading.tsx                          # NUEVO — skeleton

src/conversaciones/providers/email.ts    # REESCRITO — envío SMTP real + capacidades correctas
src/conversaciones/actions.ts            # MODIFICADO — conversación propia por canal, match por email
src/conversaciones/envio.ts              # MODIFICADO — corte por aprobación pendiente
src/suscriptores/ai/orquestar-ia.suscriptor.ts  # MODIFICADO — corte por aprobación pendiente
src/workflows/motor/disparo.ts           # MODIFICADO — corte por aprobación pendiente
src/integraciones/catalog.ts             # MODIFICADO — entrada "Correo electrónico"
src/worker/disparadores.ts               # MODIFICADO — arranque del ciclo de lectura de buzones
prisma/schema.prisma                     # MODIFICADO + migración aditiva

tests/
├── unit (vitest, junto al código como ya hace el proyecto)
│   ├── src/integraciones/email/mensaje/filtros.test.ts
│   ├── src/integraciones/email/mensaje/limpiar-cita.test.ts
│   ├── src/integraciones/email/mensaje/normalizar.test.ts
│   ├── src/integraciones/email/aprobacion/reglas.test.ts
│   └── src/conversaciones/actions.conversacion-por-canal.test.ts   # regresión de los otros canales
└── e2e/
    └── tests/e2e/integraciones/correo.spec.ts
```

**Structure Decision**: se sigue la organización por capacidad de negocio que ya usa el proyecto. El canal
nuevo replica la forma de `src/integraciones/instagram/` y `src/integraciones/whatsapp-lite/`
(`actions.ts`/`queries.ts`/`conectar.ts`/`components/`), y suma dos subcarpetas que los otros canales no
necesitan porque reciben por webhook y no leen una casilla: `imap/` (lectura con estado) y `mensaje/`
(higiene del correo). El envío queda donde ya vive el envío de todos los canales:
`src/conversaciones/providers/email.ts`. No se crea ningún módulo paralelo de conversaciones.

## Fases de entrega

Cada historia del spec es una entrega independiente. El orden es el del spec, pero **la migración y el
módulo base (P0 técnico) son prerequisito de todas**:

| Fase | Contenido | Deja funcionando |
|---|---|---|
| Base | Migración aditiva, `configuracion.ts`, `errores.ts`, entrada en el catálogo | Nada visible todavía |
| P1 | Alta y validación del buzón, lectura IMAP, normalización, filtros, conversación propia por canal | Recibir correo en el Inbox con contacto y oportunidad |
| P2 | `EmailProvider` con SMTP real, threading de respuesta, errores de envío | Responder desde el Inbox |
| P3 | Aprobación de remitentes y los tres cortes de bloqueo | Buzón público usable con control |
| P4 | Agrupación configurable por hilo, adjuntos, edición del buzón | Ajuste fino |

Los tres cortes de bloqueo (P3) se implementan juntos: entregar uno solo deja un agujero por el que la IA o
un Workflow responden un correo no aprobado, que es exactamente lo que FR-033 prohíbe.

## Complexity Tracking

| Violación | Por qué hace falta | Alternativa más simple, y por qué se descartó |
|---|---|---|
| **4 dependencias nuevas** (`imapflow`, `mailparser`, `nodemailer`, `email-reply-parser`) | Karia no tiene ninguna capacidad de IMAP, parseo MIME ni SMTP. `resend` (`src/lib/email/`) envía correo transaccional por HTTP con la cuenta de Karia: no habla SMTP con el buzón del comercio ni puede leer una casilla, así que no hay duplicación de capacidad. | Implementar IMAP/MIME a mano: RFC 3501 y RFC 2045-2049 son protocolos grandes y llenos de casos borde (codificaciones, `BODYSTRUCTURE`, `UTF-7` modificado en nombres de carpeta). Es la definición de reinventar mal. Las cuatro son MIT/MIT-0, exigen Node ≥ 20 y traen sus propios tipos. |
| **Dos banderas desnormalizadas** (`Conversacion.bloqueadaPorAprobacion`, `Oportunidad.aprobacionPendiente`) sobre una sola fuente de verdad (`ContactoIdentificadorCanal.aprobadoEn`) | Los tres puntos de corte (envío, IA, Workflows) ya leen la conversación: una bandera ahí los cubre con cero queries extra. El tablero de pipeline (FR-040) carga oportunidades con un `select` fijo por etapa; derivar el estado por relación agregaría una consulta por columna del Kanban. | Derivar siempre desde `ContactoIdentificadorCanal`: correcto pero caro en el camino caliente del Kanban y del orquestador de IA. Se mitiga el riesgo de deriva escribiendo las tres en **una sola transacción**, dentro de una única función (`aprobarRemitenteCorreo`), con test que lo verifica. |

## Riesgos y cómo se controlan

| Riesgo | Control |
|---|---|
| Tocar `resolverContactoYConversacion` rompe WhatsApp/Instagram/Messenger (SC-011) | El cambio queda detrás de un predicado explícito por canal; test de unidad que fija el comportamiento actual de los otros canales **antes** de tocar la función |
| Dos réplicas del worker leyendo el mismo buzón → correos duplicados | Lock de aplicación en PostgreSQL por buzón antes de leer (research.md R2) |
| `prisma migrate dev` propone borrar los índices únicos parciales hechos a mano | Revisar el diff antes de aceptar, tal como advierte el comentario del modelo `CuentaCanal`; la migración nueva agrega el índice de email con el mismo patrón, en SQL |
| Un correo gigante o un adjunto enorme bloquea el ciclo | Límites duros de cuerpo y adjunto, y timeout por operación; el correo entra recortado y marcado antes que no entrar |
| La IA responde un correo pendiente de aprobación | El corte se agrega en el orquestador **y** en el motor de Workflows **y** en el envío; test por cada uno |
| Credenciales del comercio filtradas en un log o en la respuesta de una action | `queries.ts` nunca selecciona el bloque cifrado; el panel recibe `tieneCredenciales: boolean`; revisión explícita en el checklist de la PR |
