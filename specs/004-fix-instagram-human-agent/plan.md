# Implementation Plan: Diagnóstico claro de envíos de Instagram fuera de la ventana de 24h (Human Agent)

**Branch**: `004-fix-instagram-human-agent` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-fix-instagram-human-agent/spec.md`

## Summary

La investigación de causa raíz (hecha en `/speckit-specify`, confirmada con el usuario en `/speckit-clarify`) descartó un bug en la lógica de ventana 24h/7días y en el envío del tag `HUMAN_AGENT` — esa parte ya funciona correctamente. El problema real es de **visibilidad**: cuando Meta rechaza un envío (lo más probable, porque Human Agent no está realmente aprobado para la cuenta en el Meta App Dashboard), el motivo ya se guarda correctamente (`codigoError`/`motivoError`) pero solo se muestra al agente como un tooltip de hover sobre un ícono de 12px, fácil de no ver. El enfoque técnico es: (1) hacer visible ese motivo directamente en la burbuja del mensaje fallido, reutilizando el patrón visual que el mismo componente ya usa para errores de adjuntos, y (2) agregar una consulta de solo lectura + una sección en el panel de Integraciones → Instagram para que un admin pueda ver si Human Agent está siendo rechazado sin depender de que un agente reporte un mensaje fallido. Ningún dato nuevo, ninguna columna nueva, ningún cambio a la lógica de envío.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router, sin cambios de versión)

**Primary Dependencies**: Prisma (consulta de solo lectura nueva), componentes UI ya existentes (`lucide-react` para íconos, tokens semánticos de Tailwind ya usados en `burbuja-mensaje.tsx`) — sin dependencias nuevas

**Storage**: PostgreSQL vía Prisma — sin cambios de esquema; se lee `MensajeConversacion.codigoError`/`.motivoError`/`.fechaError` y `Conversacion.cuentaCanalId`, todos ya existentes e indexados donde corresponde

**Testing**: Validación manual según `quickstart.md` (requiere provocar/simular distintos `codigoError`); las suites automatizadas existentes deben seguir pasando sin cambios, ya que no se altera la lógica de envío (FR-005)

**Target Platform**: Web (Inbox de conversaciones en `/crm/inbox`, panel de Integraciones en `/integraciones/instagram`)

**Project Type**: Web application — mismo proyecto Next.js único ya existente

**Performance Goals**: N/A — cambio de presentación + una consulta de agregación acotada a 30 días sobre un índice ya existente (`Conversacion.cuentaCanalId`), sin impacto medible

**Constraints**: No alterar el cálculo de la ventana de 24h/7días ni el uso del tag `HUMAN_AGENT` (FR-001, FR-005); no inventar textos de error nuevos — reutilizar `motivoError` ya persistido (D2 en `research.md`); no agregar un estado "reintentando" nuevo al modelo (descartado explícitamente en `research.md`, ver D2)

**Scale/Scope**: 2 frentes acotados — (a) presentación del error en `src/conversaciones/components/burbuja-mensaje.tsx` (FR-002/FR-003), (b) consulta nueva de solo lectura + sección en `src/integraciones/instagram/components/panel-instagram.tsx` y su query/page correspondiente (FR-004)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — el cambio de FR-002/003 vive en un componente de presentación ya existente del módulo `conversaciones`; el de FR-004 extiende el módulo `integraciones/instagram` ya existente (nueva query + sección de UI), sin introducir una capa ni módulo paralelo. |
| II. Server-Enforced Business Rules | N/A / PASS — no hay reglas de negocio nuevas; la consulta de D3 es de solo lectura y no participa de ninguna decisión de envío. |
| III. Reliable Data and Events | N/A / PASS — no se agregan transacciones, eventos ni side effects nuevos; se leen datos ya persistidos por el flujo de envío existente. |
| IV. Replaceable Integrations | PASS — no se toca el provider de Instagram ni el contrato con Meta; la consulta de D3 no llama a la Graph API (se descartó explícitamente en `research.md`, ya que Meta no expone un endpoint estable para esto). |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — riesgo bajo (presentación + query de solo lectura); la consulta de D3 MUST respetar el aislamiento por `instanciaId` ya usado en el resto de `panel-instagram.tsx`/`obtenerCuentasCanalAction` (no introducir una nueva brecha multi-tenant en un módulo que la Auditoría de Meta/Instagram ya identificó como sensible en otros puntos — ver `docs/META-INSTAGRAM-PRODUCTION-AUDIT.md` §9). Testing proporcional = validación manual vía `quickstart.md`. |

**Restricciones técnicas relevantes**: la Sección G.6 de `docs/META-INSTAGRAM-PRODUCTION-AUDIT.md` ya identificaba como faltante justamente esto ("UI para habilitar Human Agent por cuenta... falta el formulario/acción para que un admin la active"); esta feature cubre la mitad diagnóstica de ese hallazgo (ver si está funcionando), no agrega un formulario de activación (Meta no expone un flag activable desde la API — la aprobación es un proceso externo, ver Assumptions de `spec.md`).

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: el mapeo de `data-model.md` no agrega tablas, columnas ni abstracciones nuevas — solo reinterpreta datos ya existentes. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-instagram-human-agent/
├── plan.md              # This file
├── research.md          # Phase 0 output — D1-D3 (visibilidad del error, agrupación por codigoError, consulta de estado)
├── data-model.md         # Phase 1 output — mapeo codigoError→presentación + consulta derivada
└── quickstart.md         # Phase 1 output — guía de validación manual
```

No se genera `tasks.md` en este paso (Fase 2, comando `/speckit-tasks`). No se genera `contracts/`: la única superficie nueva es una consulta interna de solo lectura consumida por un Server Component ya existente, no una API pública ni un webhook.

### Source Code (repository root)

```text
src/
├── conversaciones/
│   └── components/
│       └── burbuja-mensaje.tsx        # FR-002/FR-003 — bloque de error visible en vez de hover
├── integraciones/
│   └── instagram/
│       ├── queries.ts                 # (o archivo equivalente ya existente) — nueva consulta de solo lectura para FR-004
│       └── components/
│           └── panel-instagram.tsx    # FR-004 — sección de estado de Human Agent por cuenta
└── app/
    └── integraciones/
        └── instagram/
            └── page.tsx               # pasa el resultado de la nueva consulta a PanelInstagram
```

**Structure Decision**: no se crean módulos nuevos. El cambio vive en dos módulos de negocio ya existentes (`conversaciones`, `integraciones/instagram`), siguiendo la estructura por capacidad ya establecida en el proyecto.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
