# Research: 028-respuestas-guia-catalogo-ia

## Decision 1 — Where to store the guide answers

- **Decision**: a JSON column `respuestasGuia` on `AgenteIAConfig`, validated with Zod.
- **Rationale**:
  - It follows the pattern already used by `frasesPreferidas`, `reglasPersonalizadas` and `condicionesTransferenciaHumano`, which are JSON lists on the same model.
  - Versioning already works for free: `guardarBorradorAgenteIA` stores `validado.data` whole in `AgenteIAConfigVersion.contenido`, and publish/restore apply it with `construirPayloadAgenteIA` inside a transaction (`src/configuracion/ia/agente-actions.ts:124-319`).
  - A separate table would need its own versioning mechanism.
- **Alternatives considered**:
  - A `RespuestaGuia` table with an FK to the agent. Rejected: it duplicates versioning and forces syncing rows on publish/restore.
  - Company-level templates shared between agents. Out of scope (spec, Assumptions).

## Decision 2 — Deterministic vs LLM-filled placeholders

- **Decision**: `{nombreCliente}`, `{producto}`, `{precio}` and `{moneda}` are not replaced in code. They are passed to the model as part of the format, with the explicit instruction to fill them only with real data.
- **Rationale**:
  - Which product and price apply depends on the conversation. The model resolves that with the catalog and tools.
  - Replacing placeholders beforehand would need an intent classifier plus a product resolver, which is a new capability not required by the spec.
  - The anti-invention rule plus the catalog in the context bound the risk.
- **Alternatives considered**: post-generation substitution. Rejected because it would require structured model output; in practice the reply is free text.

## Decision 3 — Where the guide answers go in the prompt

- **Decision**: a "Formatos de respuesta del negocio" block right after `construirBloqueReglasDeNegocio` and before the extra layers (strategy, profile, reserved).
- **Rationale**:
  - FR-019 requires it.
  - They are business rules, so they carry the same weight as "Reglas del negocio", and they sit below the fixed rules, so they can never override the anti-invention rule.
  - The existing precedence (`builder.ts:97-105`) stays intact.

## Decision 4 — Catalog in the context: layer 8

- **Decision**: implement layer 8 (`producirCapaInfoOperativa`, reserved since 013 in `src/ai/contexto/capas/placeholders.ts`) by delegating to a new `capas/catalogo.ts`.
- **Query**: `producto.findMany({ where: { instanciaId, activo: true, precio: { gt: 0 } }, orderBy: [{ actualizadoEn: "desc" }], take: limite + 1 })`. Asking for `limite + 1` rows tells us whether "there are more products" without a separate count.
- **Rationale**:
  - The precedence order is already fixed: layer 8 comes after strategy and profile and before the examples.
  - It needs no changes to `construirSystemPrompt`, because the text travels in `contenidoReservado`.
  - It is fault-tolerant like the other layers: `try/catch` that returns `null` (FR-011).
- **Format**: `- {nombre}{ (sku) si hay} — {precio con 2 decimales} {moneda} / {unidad}{ · {categoria} si hay}`, one line per product.
- **"Principales" products**: sorted by `actualizadoEn desc`, since no "featured" field exists (spec, Assumptions).
- **Alternatives considered**:
  - Put the catalog in `sistemaPrompt`. Rejected: it mixes business data with free instructions and gets lost in versioning.
  - Rely on `buscar_productos` alone. Rejected: a vague "precio por favor" gives the model no search term, which is the real case.

## Decision 5 — Automatically enabling `buscar_productos`

- **Decision**: a new helper `resolverHerramientasAgente({ herramientas, catalogoEnContexto })` in `src/ai/tools/herramientas-agente.ts`. It returns the agent's list ∪ `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES`, plus `buscar_productos` when the catalog is on. Both the consumer (`obtenerHerramientasPermitidas`) and the simulator (`servicio.ts:109-117`) use it.
- **Rationale**:
  - Today that merge is duplicated in both places.
  - Adding the new condition in only one of them would make the simulator diverge from the real behavior, and the simulator is the tool used to validate the feature (quickstart).
- **Name of the product tool**: confirm the registered name (`buscar_productos`) in `src/ai/tools/providers/product.tool.ts` when implementing.

## Decision 6 — Wording of the price rule

- **Decision**: replace `"- No prometas precio, disponibilidad ni fecha de entrega sin haber consultado la información real primero."` with two lines:
  - `"- No des precios, disponibilidad ni fechas de entrega que no aparezcan en el catálogo de este contexto o en el resultado de una herramienta. Nunca inventes un precio."`
  - `"- Si el cliente pide precio sin nombrar un producto: si el catálogo es corto, responde con los precios; si es largo, ofrece como máximo tres opciones con su precio y pregunta cuál le interesa."`
- **Rationale**: FR-013/FR-014. The spec accepts this as the only change to the prompt of existing agents (FR-017, SC-006).
- **Tests to update**: `builder.test.ts:61` (assertion on the old text).

## Decision 7 — Migration default for existing agents

- **Decision**: `catalogoEnContexto Boolean @default(true)` and `limiteCatalogoContexto Int @default(30)`.
- **Rationale**:
  - The spec (Assumptions) chooses catalog on by default to solve the real case.
  - It is additive, with a column default, so it needs no data script.
- **Restoring old versions**: their `contenido` lacks these fields. `construirPayloadAgenteIA` applies `?? true` / `?? 30` / `?? JsonNull`, so restoring a pre-028 version gives catalog on and no guide answers. That is consistent with what the version defined.

## Decision 8 — Warning when AI is on without an agent

- **Decision**:
  - Compute `hayAgenteDisponible` on the server: the stage has `agenteIAConfigId`, or the instance has an `AgenteIAConfig` with `tipo = "COMERCIAL"`. The same resolution order as `orquestar-ia.suscriptor.ts` and `generar-respuesta-ia.suscriptor.ts:38-45`.
  - Pass it to the stage panel.
  - Render an amber `Alert`/banner when `iaHabilitada && !hayAgenteDisponible`.
- **Rationale**:
  - FR-015/FR-016: visual only, with no change to saving or orchestration.
  - The panel already has the agent list for its selector (`obtenerAgentesIAComerciales`). Confirm when implementing whether that list is already loaded, and reuse it instead of a new query.
