---

description: "Tasks for 028-respuestas-guia-catalogo-ia"
---

# Tasks: Respuestas guía por intención y catálogo con precios para el agente de IA

**Input**: Design documents from `/specs/028-respuestas-guia-catalogo-ia/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/prompt-y-configuracion.md, quickstart.md

**Tests**: included. Constitution V requires tests proportional to risk, and the quickstart defines the unit cases. They extend the existing Vitest suites.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Add `respuestasGuia Json?`, `catalogoEnContexto Boolean @default(true)` and `limiteCatalogoContexto Int @default(30)` to the `AgenteIAConfig` model in prisma/schema.prisma. Create the additive migration prisma/migrations/<timestamp>_respuestas_guia_catalogo_ia/migration.sql (three `ALTER TABLE "AgenteIAConfig" ADD COLUMN`). Regenerate the client (`npx prisma generate`).

## Phase 2: Foundational (blocks US1 and US2)

- [X] T002 In src/configuracion/ia/agente-schema.ts:
  - add `IntencionRespuestaGuiaSchema` (enum PRECIO|DISPONIBILIDAD|ENVIO|PAGO|SALUDO|OTRA) and `RespuestaGuiaSchema` (`id` 1-40, `intencion`, `cuandoAplica` trim 1-200, `formato` trim 1-1000, `activa` boolean default true);
  - add `respuestasGuia` (array max 15, unique `id` via `refine`), `catalogoEnContexto` and `limiteCatalogoContexto` (int 1-100) to `AgenteIAConfigSchema`;
  - export `RespuestaGuiaInput` via `z.infer`;
  - add the label constant `INTENCIONES_RESPUESTA_GUIA`.
- [X] T003 In src/configuracion/ia/agente-actions.ts:
  - map the three fields in `construirPayloadAgenteIA` (`respuestasGuia ?? Prisma.JsonNull`, `catalogoEnContexto ?? true`, `limiteCatalogoContexto ?? 30`);
  - add them to the `select` of `cargarConfigAgenteIA`.
- [X] T004 In src/ai/contexto/constructor.ts, add `respuestasGuia`, `catalogoEnContexto` and `limiteCatalogoContexto` to the agent's `select` and pass them through to `construirContextoCompuesto`.
- [X] T005 [P] In src/configuracion/ia/agente-actions.test.ts (new file: actions.test.ts only covers AI providers):
  - add cases: a draft saves `respuestasGuia`, publishing applies it to the live row, restoring a pre-028 version leaves `respuestasGuia` null and the catalog on;
  - verify the schema rejects 16 items and a `formato` over 1000 characters.

**Checkpoint**: the fields are saved, versioned and read by the context builder.

---

## Phase 3: User Story 1 — The customer asks the price and gets real prices (P1) 🎯 MVP

**Goal**: with the catalog on, the agent knows the active products and their prices and never invents one.

**Independent test**: in the simulator, "precio por favor" returns real catalog prices; a non-existent product gets no price (quickstart §3).

- [X] T006 [P] [US1] Create src/ai/contexto/capas/catalogo.ts with `producirCapaCatalogo({ instanciaId, activo, limite })`, following contracts/prompt-y-configuracion.md §2:
  - query `producto.findMany({ where: { instanciaId, activo: true, precio: { gt: 0 } }, orderBy: [{ actualizadoEn: "desc" }], take: limite + 1 })`;
  - one line per product with the price at 2 decimals, and the "Hay más productos…" line when `limite + 1` rows come back;
  - `try/catch` that returns `null` and logs without personal data;
  - `null` when `activo` is false or there are no products.
- [X] T007 [US1] In src/ai/contexto/capas/placeholders.ts, make `producirCapaInfoOperativa(insumos)` delegate to `producirCapaCatalogo`. In src/ai/contexto/context-builder.ts:
  - pass `instanciaId`, `catalogoEnContexto` and `limiteCatalogoContexto` from `datos.configAgente`;
  - add the three fields to `ConfigAgenteParaPrompt`/`DatosParaComponer` as needed;
  - keep the precedence order of layers 7-8-9.
- [X] T008 [P] [US1] Create src/ai/tools/herramientas-agente.ts with `resolverHerramientasAgente({ herramientas, catalogoEnContexto })`:
  - deduplicated union of the agent's list, `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES` (src/ai/tools/constantes.ts) and `buscar_productos` when the catalog is on;
  - first confirm the exact registered name in src/ai/tools/providers/product.tool.ts.
- [X] T009 [US1] Use `resolverHerramientasAgente` in:
  - `obtenerHerramientasPermitidas` in src/suscriptores/ai/generar-respuesta-ia.suscriptor.ts (the select now includes `catalogoEnContexto`);
  - the tool resolution in src/ai/simulador/servicio.ts (~L109-117).

  Remove the duplicated merge.
- [X] T010 [US1] In src/ai/prompt/builder.ts, replace the "No prometas precio…" line of the fixed "Comportamiento natural" block with the two lines from research.md Decision 6.
- [X] T011 [P] [US1] Update src/ai/prompt/builder.test.ts: fix the assertion at L61 to the new text, and add a case where the no-invention prohibition is still present.
- [X] T012 [P] [US1] Extend src/ai/contexto/context-builder.test.ts with the layer 8 cases:
  - catalog with N < limit (all products, no "hay más" line);
  - N > limit (limit plus the line);
  - products with price 0 excluded;
  - `catalogoEnContexto = false` returns no block;
  - query error: the prompt is still built, without the catalog;
  - the query filters by `instanciaId`.
- [X] T013 [US1] Add the Switch "Incluir catálogo con precios en las respuestas" and an "Límite de productos" input (1-100) to src/configuracion/components/sheet-editar-agente.tsx, "Capacidades" section (~L584):
  - bind them to `formIA`;
  - include the new defaults in the form `defaultValues` and in the config load (~L217-285).

**Checkpoint**: US1 can be validated alone in the simulator.

---

## Phase 4: User Story 2 — The business defines how each type of query is answered (P1)

**Goal**: editable, versioned guide answers per intent that the agent follows.

**Independent test**: a PRECIO guide answer, published, is respected in the simulator; an inactive one or an unpublished draft is not applied (quickstart §2-3).

- [X] T014 [US2] In src/ai/prompt/builder.ts:
  - add `respuestasGuia?: unknown` to `ConfigAgenteParaPrompt`;
  - add a `construirBloqueRespuestasGuia(config)` function that parses the list defensively, keeps only the active items and emits the block from contracts §1;
  - insert it right after `construirBloqueReglasDeNegocio` in `construirSystemPrompt`.
- [X] T015 [P] [US2] Extend src/ai/prompt/builder.test.ts:
  - block present with active items, in the saved order;
  - inactive items excluded;
  - no items or `null`: prompt identical to the baseline;
  - the block comes after "Reglas del negocio" and before the strategy layer;
  - invalid JSON is ignored without throwing.
- [X] T016 [P] [US2] Create src/configuracion/components/editor-respuestas-guia.tsx (client), a list editor with `valores`/`onChange` props:
  - add, edit and remove items, with an active Switch per item;
  - intent `<Select>` with `items` derived from `INTENCIONES_RESPUESTA_GUIA` (docs/selects.md);
  - "Cuándo aplica" Input (max 200);
  - "Formato" Textarea (max 1000) with chips that insert `{nombreCliente}` `{producto}` `{precio}` `{moneda}` at the cursor;
  - character counters, a maximum of 15 items, and `id` generated with `crypto.randomUUID()`;
  - semantic tokens only.
- [X] T017 [US2] Integrate `EditorRespuestasGuia` into src/configuracion/components/sheet-editar-agente.tsx as a "Respuestas guía" section next to "Reglas" (~L863):
  - bound to `formIA` `respuestasGuia`;
  - include the field in `defaultValues` and the config load;
  - also show a read-only summary in the "Conocimiento" tab (~L1142).

**Checkpoint**: US1 and US2 work together and separately.

---

## Phase 5: User Story 3 — Knowing the AI is active without an agent configured (P2)

**Goal**: a visible, non-blocking warning when a stage has AI enabled and no agent is available.

**Independent test**: quickstart §4.

- [X] T018 [US3] In src/crm/pipeline/components/panel-config-disparadores.tsx (~L258, `iaHabilitada`):
  - determine whether an agent is available: the stage has `agenteIAConfigId`, or the instance has a COMERCIAL agent. Reuse the agent list the panel already loads for its selector if there is one; if not, extend the server data the panel receives;
  - render the amber warning with the text from contracts §5 when `iaHabilitada && !hayAgente`;
  - it must not disable saving.

---

## Phase 6: Polish & Cross-Cutting

- [X] T019 Run `npx vitest run src/ai/prompt/builder.test.ts src/ai/contexto/context-builder.test.ts src/configuracion/ia/actions.test.ts`, `npx tsc --noEmit -p .` (no new errors in the files touched) and `npx next build`.
- [X] T020 [P] Document in docs/ (the existing AI agent document, e.g. docs/AGENTE-IA-EVOLUCION-ANALISIS.md §7-8) that layer 8 now carries the catalog, and describe the guide-answers block.

## Dependencies & Execution Order

- **T001 → T002 → T003/T004** (T005 in parallel once T003 is done) → US1 and US2 in parallel.
- **US1**: T006 and T008 in parallel. Then T007 (needs T006) and T009 (needs T008). T010, then T011/T012. T013 last.
- **US2**: T014, then T015 [P]. T016 [P] is independent. T017 needs T016.
- **US3**: independent of US1/US2; only needs Phase 1 for types if it reads agents.
- **Polish**: at the end.

## Parallel Example: User Story 1

```text
T006 capas/catalogo.ts  ||  T008 tools/herramientas-agente.ts  ||  T011 builder.test.ts (after T010)
```

## Implementation Strategy

1. **MVP**: Phases 1-3 (US1). Already solves the real case: prices in the reply without inventing.
2. Then US2 (formats per intent), then US3 (warning).
3. Validate each checkpoint with the simulator before moving on.

## Implementation notes (2026-09-23)

- **Migration not applied.** T001 created `prisma/migrations/20260923180000_respuestas_guia_catalogo_ia/migration.sql` and regenerated the client, but did **not** apply the migration: `.env` points to the shared Supabase database. Run `npm run db:migrate` before deploying. Until then, the queries that select the new columns fail.
- **T002: no Zod default on `activa`.** `RespuestaGuiaSchema.activa` has no `.default(true)`: it made the schema's input and output types differ and broke `zodResolver` in the sheet. The editor always creates the value.
- **T006: separate unit tests for the layer.** Added `src/ai/contexto/capas/catalogo.test.ts`. `context-builder.test.ts` now mocks `@/shared/db/prisma` with an empty catalog by default, so the existing composition tests stay the same.
- **T018: the warning already existed.** The panel already showed a faint gray "Sin agentes IA configurados" line that nobody noticed. It was replaced by the amber warning from the contract, which waits for the agent list to load so it doesn't flash.
- **Pre-existing, not related to this feature:**
  - 4 failing tests in `src/ai/tools/providers/crear-cotizacion.test.ts` and `modo-simulacion.test.ts`. They fail the same way with the changes stashed.
  - The TS error in `panel-config-disparadores.tsx` on the agent `onValueChange`.
