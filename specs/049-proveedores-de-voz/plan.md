# Implementation Plan: Proveedores de Voz y transcripción de notas de voz

**Branch**: `feature/049-proveedores-de-voz` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/049-proveedores-de-voz/spec.md`

**Tipo**: Feature (Karia nunca tuvo transcripción). Ciclo completo según `docs/SPEC-KIT-WORKFLOWS.md`.

**Base**: `main` @ `cdfdd05`, que ya incluye `048-fix-instagram-reels-media`.

## Summary

Hoy una nota de voz entra a Karia y queda **invisible**: el mensaje se guarda con `contenido` en
`NULL`, y el contexto del agente de IA descarta los mensajes sin texto
(`src/ai/contexto/constructor.ts:214`), los Workflows reciben cadena vacía
(`src/workflows/motor/disparo.ts:42`) y el agente humano tiene que reproducir cada audio.

La feature agrega dos cosas:

1. **Proveedores de Voz** — registro de credenciales por instancia, espejo de `ProveedorIA` en
   forma pero medido en **segundos de audio**. Modelos propios (`ProveedorVoz`, `UsoVoz`),
   registro de adaptadores en `src/voz/proveedores/`, y pestaña de configuración con alta,
   prioridad, toggle y **probar credenciales**.
2. **Transcripción automática** — con el interruptor encendido, cada audio que llega se
   transcribe en segundo plano. El texto se guarda **en `MediaArchivo`** (que ya deduplica por
   hash: un audio reenviado se transcribe y se cobra una vez). Lo consumen la IA, los Workflows,
   la búsqueda y un "ver transcripción" en el inbox. Sin habla reconocible ⇒ `"Inaudible"`.

Tres decisiones que estructuran todo (detalle en [research.md](./research.md)):

- **El alcance se decide por `MensajeConversacion.tipo`, nunca por el mime.** En Instagram 727
  notas de voz y 203 videos comparten `video/mp4`, y Scribe transcribe video sin error: un filtro
  por mime facturaría videos en silencio. Tres cortes independientes, contrato dedicado y tests
  que no se borran.
- **`MediaArchivo` es la cola.** Sin tabla nueva: ya es una fila por archivo, ya deduplica, y el
  lease con `SKIP LOCKED` se copia de `src/crm/contactos/analisis/cola.ts`.
- **Entrantes: transcripción inline en el worker antes de publicar `MensajeRecibido`**, con
  timeout duro. Es el único punto que garantiza que la IA y los Workflows vean el texto. Vencido
  el timeout se publica igual: nunca se retiene una respuesta esperando a un tercero.

**Prerequisito bloqueante**: el vínculo mensaje ↔ archivo no se persiste. El webhook produce
`mediaArchivoId` (`reubicacion.ts:39`) y los dos suscriptores lo descartan — **los 733 audios en
producción lo tienen NULL**. Sin eso, FR-016 no es implementable. Se arregla primero, en su
propio commit, con backfill verificado al 100 %.

Una dependencia nueva: **ninguna**. Node 20 ya trae `fetch`, `FormData` y `Blob`.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 15 (App Router, Server Actions), Prisma 7, React 19, Zod v4,
Tailwind v4 / shadcn, RabbitMQ (amqplib). **Sin dependencias nuevas** — el multipart hacia
ElevenLabs usa las APIs globales de Node 20.

**Storage**:
- PostgreSQL: 2 tablas nuevas, 8 columnas en `MediaArchivo`, 1 en `ConfiguracionEmpresa`, 2 enums,
  1 índice parcial. Todo aditivo y con default.
- Storage de media existente: el audio se lee con `getStorageProvider().download(key)`.

**External**: ElevenLabs Speech-to-Text (`POST /v1/speech-to-text`, `scribe_v3`), síncrono.
Credencial **por instancia**, cifrada con `cifrarToken` (AES-256-GCM).

**Testing**: Vitest para el adaptador (con `fetch` mockeado), la decisión
`LISTO`/`INAUDIBLE`, el backoff y lease de la cola, **el invariante de alcance**, y el
constructor de contexto de IA. Playwright para el alta de proveedor en `/configuracion`.
Quickstart manual contra una cuenta real.

**Target Platform**: app Next.js (Coolify) + worker Node (`src/worker/disparadores.ts`). La
transcripción corre **solo en el worker**.

**Project Type**: web-service + UI web (monolito Next.js con worker separado)

**Performance Goals**:
- 95 % de las notas de voz entrantes legibles en < 30 s (SC-001).
- Timeout inline de 12 s: vencido, el mensaje sigue y la transcripción queda pendiente.
- Perfil real medido: 12,8 s de promedio, p90 26,1 s, máximo 66,3 s sobre 730 audios.

**Constraints**:
- **Cero videos transcritos** (SC-002), con el mime engañando.
- Cero llamadas al proveedor con el toggle apagado (SC-004).
- La caída del proveedor no impide recibir, guardar, mostrar ni responder (SC-005).
- Aislamiento por `instanciaId` en toda lectura y escritura.
- Sin credenciales ni contenido de conversaciones en logs.
- Tope de 25 MB por archivo.

**Scale/Scope**: ~240 notas de voz y ~50 minutos de audio al mes en la cuenta más activa;
730 audios y 2,6 h de histórico total. Costo de referencia: 0,52 USD por los tres meses.

## Constitution Check

*GATE: debe pasar antes de Fase 0 y revalidarse tras Fase 1.*

| Principio | Cumplimiento | Evidencia |
|---|---|---|
| **I. Modular Business Architecture** | ✅ | Módulo nuevo `src/voz/` por capacidad de negocio, con `proveedores/` (adaptadores), `orquestador.ts`, `transcribir.ts` y `cola.ts`. La UI no toca Prisma ni el SDK: la burbuja lee campos ya aplanados en `MensajeConMeta`. Extiende lo existente (`MediaArchivo`, tab de configuración) en vez de crear abstracciones paralelas. |
| **II. Server-Enforced Business Rules** | ✅ | Toggle, alcance, topes y selección de proveedor se deciden **solo en servidor**. Zod en el boundary de cada Server Action. El cliente nunca decide qué se transcribe. |
| **III. Reliable Data and Events** | ✅ | El `UPDATE` de reclamo con `FOR UPDATE SKIP LOCKED` garantiza que un archivo lo tome un solo proceso (FR-020). La transcripción ocurre **después** de que el mensaje está persistido. `AudioTranscrito` se publica tras escribir. Idempotencia por estado: una fila `LISTO` no se reprocesa. |
| **IV. Replaceable Integrations** | ✅ | `IProveedorVoz` es el contrato; el dominio nunca ve tipos de ElevenLabs. Timeout obligatorio, reintentos acotados (`MAX_INTENTOS = 5`) y degradación segura: sin proveedor la conversación sigue igual. La decisión `LISTO`/`INAUDIBLE` es del dominio, no del adaptador. |
| **V. Security and Quality (NON-NEGOTIABLE)** | ✅ | Toda query lleva `instanciaId`. Credencial cifrada con el helper compartido, nunca devuelta al cliente ni logueada. Tests proporcionales al riesgo, con uno dedicado al invariante de alcance. Migraciones aditivas con default. |

**Technical Constraints**: sin dependencias nuevas; migraciones versionadas, aditivas y seguras
sobre datos existentes; fechas y cortes de día del resumen de consumo vía
`obtenerZonaNegocio(instanciaId)`, nunca la zona del navegador (regla 7 de `CLAUDE.md`).

**Resultado del gate (pre-Fase 0)**: PASA, sin violaciones que justificar.

**Resultado del gate (post-Fase 1)**: PASA. El diseño no introdujo desvíos. Se evaluó una
posible violación del Principio I —colgar estado de cola de `MediaArchivo`, que es una tabla de
infraestructura de media— y se resolvió a favor: la alternativa (tabla de cola propia) duplicaría
la unidad de trabajo y abriría un segundo sitio donde desincronizarse, sin ganar nada a esta
escala. Registrado en research R2.

## Project Structure

### Documentation (this feature)

```text
specs/049-proveedores-de-voz/
├── plan.md                               # Este archivo
├── spec.md
├── research.md                           # Fase 0 — R0..R10
├── data-model.md                         # Fase 1
├── quickstart.md                         # Fase 1
├── checklists/requirements.md
├── contracts/                            # Fase 1
│   ├── alcance-transcripcion.md          # ⚠ el contrato de mayor riesgo
│   ├── proveedor-voz.md
│   └── eventos-y-server-actions.md
└── tasks.md                              # Fase 2 — lo genera /speckit-tasks
```

### Source Code (repository root)

```text
# NUEVOS
src/voz/
├── proveedores/
│   ├── types.ts                 IProveedorVoz, TranscribirParams, TranscribirResult
│   ├── registro.ts              registrarProveedorVoz / crearProveedorVoz  (con baseUrl)
│   ├── inicializar.ts           side-effect: registra los adaptadores
│   ├── disponibles.ts           PROVEEDORES_VOZ_IMPLEMENTADOS (sin deps de servidor)
│   ├── elevenlabs.ts            adaptador Scribe v3
│   ├── elevenlabs.test.ts
│   └── inicializar.test.ts
├── orquestador.ts               seleccionarProveedorVoz(instanciaId)
├── transcribir.ts               punto único de entrada + decisión LISTO/INAUDIBLE
├── transcribir.test.ts
├── transcribir.alcance.test.ts  ⚠ el invariante de alcance
├── cola.ts                      marcarPendiente / reclamarLote / devolverConBackoff
├── cola.test.ts
├── auditoria.ts                 registrarUsoVoz + cálculo de costo por hora
└── barrido.ts                   ciclo del worker

src/configuracion/voz/           schema.ts · actions.ts · queries.ts · actions.test.ts
src/configuracion/components/    tab-voz.tsx · lista-proveedores-voz.tsx · form-proveedor-voz.tsx
src/eventos/contratos/           audio-transcrito.evento.ts
scripts/                         049-backfill-transcripciones.ts

# MODIFICADOS (cambios acotados)
prisma/schema.prisma                                    2 enums, 2 modelos, 9 columnas
prisma/migrations/...                                   3 migraciones (ver data-model.md)
src/suscriptores/mensajes/procesar-entrante.suscriptor.ts        + mediaArchivoId   ← prereq
src/suscriptores/mensajes/procesar-mensaje-app-nativa.suscriptor.ts + mediaArchivoId ← prereq
src/eventos/contratos/procesar-mensaje-app-nativa.comando.ts     + mediaArchivoId   ← prereq
src/conversaciones/actions.ts                           enganche inline + marcado
src/worker/disparadores.ts                              arranca el barrido
src/eventos/catalogo.ts · mapa.ts                       AudioTranscrito
src/shared/rabbitmq/exchanges.ts                        RK nuevo
src/suscriptores/sse/sse-relay.suscriptor.ts            + routing key
src/conversaciones/types.ts · queries.ts                campos de transcripción (3 caminos)
src/conversaciones/components/burbuja-mensaje.tsx       BurbujaAudio
src/app/configuracion/page.tsx                          pestaña "voz"
src/ai/contexto/constructor.ts                          audio al prompt            (P2)
src/ai/respuesta/responder-con-agente.ts                último mensaje del cliente (P2)
src/workflows/motor/disparo.ts · contexto.ts            texto del audio            (P2)
src/ai/analisis-contactos/contexto.ts                   COALESCE                   (P3)
docs/eventos.md                                         documentar AudioTranscrito
```

**Structure Decision**: módulo de dominio nuevo `src/voz/`, paralelo a `src/ai/` y con la misma
anatomía (contrato + registro + adaptadores + orquestador + punto único de entrada + auditoría).
La configuración vive junto al resto en `src/configuracion/`, y el consumo del texto se hace
extendiendo los lectores que ya existen, sin duplicarlos.

## Fases de implementación (orden sugerido para `/speckit-tasks`)

**Fase A — Prerequisito** *(commit propio, sin la feature)*
Suscriptores + contrato de app-nativa + migración de backfill del FK. Verificable solo: los 733
audios dejan de tener `mediaArchivoId` NULL.

**Fase B — P1: transcripción end-to-end**
Migración de esquema · `src/voz/` completo con ElevenLabs · enganche inline + barrido ·
pestaña de configuración con alta, prueba de credenciales y toggle · `BurbujaAudio`.
Entregable solo: el comercio activa, le mandan una nota de voz y la lee sin reproducirla.

**Fase C — P2: la IA y los Workflows usan el texto**
`constructor.ts` · `responder-con-agente.ts` · `disparo.ts` y `contexto.ts` de Workflows ·
evento `AudioTranscrito` + relay SSE · preview y búsqueda del inbox.

**Fase D — P3: control de gasto y cobertura**
Resumen de minutos/costo · `limiteMinutosDia` · `COALESCE` en el análisis 042 · rellenar
`mediaDuracion` con `transcripcionSegundos` · adaptador OpenAI para validar que la abstracción
no quedó pegada a ElevenLabs · evaluar audio en Facebook Messenger.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Se cuela un video a transcribir.** No falla: factura en silencio. | Tres cortes independientes, contrato dedicado, dos tests que una "simplificación al mime" rompe, y una consulta de invariante en el quickstart. |
| La transcripción inline agrega latencia al camino de atención | Timeout de 12 s; vencido se publica igual y la IA responde con marcador. El worker ya hace I/O ahí; no bloquea el webhook de Meta ni Baileys. |
| `INAUDIBLE` tratado como error en una refactorización | Gastaría 5 llamadas pagas para obtener 5 veces el mismo silencio. Estado terminal explícito en el modelo, con test. |
| El backfill dispara un cargo inesperado | Fuera de la migración, script aparte con `--dry-run` que informa audios, minutos y costo antes de escribir. |
| Dato sensible saliendo a un tercero | Toggle apagado por defecto; credencial de la cuenta, no de Karia: el dato sale bajo el contrato propio del comercio. |
| Los salientes son el 78 % del volumen y no alimentan a la IA | Se transcriben igual (decisión del usuario). Si hiciera falta recortar, el barrido admite filtrar por `remitente` sin cambios de modelo. |

## Complexity Tracking

> Sin violaciones de la Constitución que justificar. No aplica.
