# Implementation Plan: Guide answers per intent and catalog with prices for the AI agent

**Branch**: `028-respuestas-guia-catalogo-ia` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-respuestas-guia-catalogo-ia/spec.md`

## Summary

Three new fields on the AI agent's profile, versioned like the rest of the profile:
- `respuestasGuia` (guide answers per intent),
- `catalogoEnContexto`,
- `limiteCatalogoContexto`.

What they do:
- The guide answers get their own block in the system prompt, right after "Reglas del negocio".
- The catalog fills the reserved layer 8 ("Información operativa verificada") of the context builder. It lists the instance's active products with a price above 0, up to the limit.
- When the catalog is on, `buscar_productos` is enabled automatically. The resolution lives in one shared helper, used by both the consumer and the simulator.

Two further changes:
- The fixed price rule is reworded: the catalog in the context counts as real information, and inventing a price is still forbidden.
- The pipeline stage panel shows a non-blocking warning when AI is enabled but no agent is available.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 15 (App Router, Server Actions), Prisma 7, Zod v4, React Hook Form, shadcn/ui (Base UI Select)

**Storage**: PostgreSQL. One additive migration on `AgenteIAConfig`.

**Testing**: Vitest, with existing suites to extend:
- `src/ai/prompt/builder.test.ts`
- `src/ai/contexto/context-builder.test.ts`
- `src/configuracion/ia/actions.test.ts`

**Target Platform**: web app (Next.js) plus the RabbitMQ worker (`npm run worker`), which is where replies are generated.

**Project Type**: web application (single Next.js project + worker)

**Performance Goals**: the catalog layer adds exactly one indexed query per reply (`instanciaId` is indexed). No extra LLM calls.

**Constraints**:
- The prompt must be byte-identical for agents without guide answers and with the catalog off, except for the price rule.
- A catalog failure must never block the reply.
- Tenant isolation via `instanciaId`.

**Scale/Scope**:
- Catalog: up to 100 products per reply, default 30.
- Guide answers: up to 15 per agent.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Modular architecture | ✅ Changes live in the existing modules: `src/ai/*` (prompt, context, tools), `src/configuracion/ia/*` (agent config) and `src/crm/pipeline/components` (warning). No parallel abstraction; layer 8 was already reserved for this. |
| II. Server-enforced rules | ✅ Limits (15 items, 1000/200 characters, catalog 1–100) are validated with Zod in `AgenteIAConfigSchema` on every server action that saves or publishes. |
| III. Reliable data and events | ✅ No new events. Publishing and restoring keep their existing transaction. The catalog layer is read-only and fault-tolerant. |
| IV. Replaceable integrations / AI does not bypass rules | ✅ The AI gets data, not permissions. The "don't invent" rule stays in the fixed block. Prices come only from `Producto`. |
| V. Security and quality | ✅ Catalog query filtered by `instanciaId`. Unit tests for the builder, the catalog layer and versioning. Build plus relevant suites must pass. |
| Migrations | ✅ Additive: one nullable column and two columns with defaults. No data backfill and nothing destructive. |

**Result**: no violations. Nothing needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/028-respuestas-guia-catalogo-ia/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── prompt-y-configuracion.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                                   # AgenteIAConfig: +3 fields
└── migrations/<timestamp>_respuestas_guia_catalogo_ia/migration.sql

src/configuracion/ia/
├── agente-schema.ts                                # RespuestaGuiaSchema + 3 fields in AgenteIAConfigSchema
└── agente-actions.ts                               # construirPayloadAgenteIA + cargarConfigAgenteIA select

src/ai/prompt/
├── builder.ts                                      # guide-answers block + adjusted price rule
└── builder.test.ts

src/ai/contexto/
├── capas/catalogo.ts                               # NEW: producirCapaCatalogo (layer 8)
├── capas/placeholders.ts                           # producirCapaInfoOperativa delegates to catalogo.ts
├── context-builder.ts                              # passes instanciaId + catalog config to layer 8
├── context-builder.test.ts
└── constructor.ts                                  # select of the 3 new fields

src/ai/tools/
└── herramientas-agente.ts                          # NEW: resolverHerramientasAgente() (shared)

src/suscriptores/ai/generar-respuesta-ia.suscriptor.ts   # uses resolverHerramientasAgente
src/ai/simulador/servicio.ts                             # uses resolverHerramientasAgente

src/configuracion/components/
├── sheet-editar-agente.tsx                         # "Respuestas guía" section + catalog toggle/limit
└── editor-respuestas-guia.tsx                      # NEW: list editor (client)

src/crm/pipeline/components/panel-config-disparadores.tsx   # warning "IA sin agente"
```

**Structure Decision**: extend the existing modules. The two new component and helper files keep the UI and tool resolution out of already-large files: `sheet-editar-agente.tsx` is over 1,200 lines, and tool resolution is currently duplicated between the consumer and the simulator.

## Complexity Tracking

No violations to justify.
