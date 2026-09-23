# Quickstart: validating 028-respuestas-guia-catalogo-ia

## Prerequisites

- Database migrated: `npm run db:migrate`.
- App and worker running: `npm run dev:full`, or `npm run dev` plus `npm run worker`.
- An instance with AI enabled (Configuración → IA) and at least 3 active products with a price above 0.

## 1. Automated tests

```bash
npx vitest run src/ai/prompt/builder.test.ts src/ai/contexto/context-builder.test.ts src/configuracion/ia/actions.test.ts
```

Expected:
- All pass.
- New cases covered:
  - the guide-answers block appears only with active items;
  - an agent without the new fields produces the same prompt except for the price rule;
  - the catalog layer respects the limit, the "hay más productos" line, the price > 0 filter, and returns `null` on error;
  - versioning keeps `respuestasGuia` through draft → publish → restore.

## 2. Configure the agent (UI)

1. Go to `/configuracion` → Usuarios/Agentes → edit the user → "Activar como Agente Comercial IA" (if it doesn't exist yet).
2. In the Configuración IA tab, check that "Incluir catálogo con precios en las respuestas" is on and the limit is 30.
3. In "Respuestas guía", add:
   - Intent **Precio**,
   - when it applies: "el cliente pregunta el precio sin nombrar producto",
   - format: "¡Hola {nombreCliente}! 😊 Te comparto nuestros precios: … ¿Cuál te gustaría?"
4. Save the draft and publish.

## 3. Simulator (Simulador tab of the agent)

| Message | Expected |
|---|---|
| "Buenas tardes, precio por favor" | A reply with the format's structure, prices from real catalog products with their currency, and a closing question. It does not open with "¿qué producto necesitas?". |
| "¿cuánto cuesta el <producto que no existe>?" | It does not give a price for that product; it says it doesn't have it or offers real alternatives. |
| Same, after deactivating the guide answer | Free-style reply, still using real prices. |
| Same, with the catalog off | Same behavior as before the feature (it may ask which product). |

## 4. Warning in the pipeline

1. In an instance **without agents**, open Pipeline → configure → a stage → enable the AI reply. → The warning "La IA responderá con un perfil mínimo…" appears. Saving works.
2. Create the Comercial agent and reopen the panel. → The warning does not appear.

## 5. End to end

Assign the agent to the "Prospecto" stage and write "precio por favor" from a test account.

Check:
- the reply in the Inbox;
- the `[GenerarRespuestaIA] Respuesta enviada` line in the worker logs;
- the new `UsoIA` record.

## 6. Build

```bash
npx tsc --noEmit -p .    # no new errors in the files touched
npx next build
```
