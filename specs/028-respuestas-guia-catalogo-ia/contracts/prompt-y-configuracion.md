# Contracts: 028-respuestas-guia-catalogo-ia

## 1. Block in the system prompt: guide answers

It is emitted only when there is at least one active guide answer. It goes right after "Reglas del negocio".

```text
Formatos de respuesta del negocio:
- [Precio] Cuando el cliente pregunta el precio sin nombrar producto: responde siguiendo este formato, adaptándolo con naturalidad: «¡Hola {nombreCliente}! Nuestros precios: … ¿Cuál te interesa?»
- [Envío] Cuando …: responde siguiendo este formato, adaptándolo con naturalidad: «…»
Completa {nombreCliente}, {producto}, {precio} y {moneda} solo con datos reales (catálogo de este contexto o resultado de una herramienta). Si no tienes el dato, no lo inventes ni dejes el marcador literal.
```

- Line order is the order of the list saved by the business.
- Inactive guide answers are not emitted.
- With none active, the block does not exist and the prompt is identical to one without this feature.

## 2. Layer 8: catalog

`producirCapaCatalogo({ instanciaId, limite }): Promise<string | null>`

```text
Catálogo vigente de la empresa (precios reales, úsalos tal cual):
- Cojín bordado (COJ-01) — 45.00 PEN / unidad · Decoración
- Cuadro 60x40 — 120.00 PEN / unidad
Hay más productos que no aparecen en esta lista: usa buscar_productos para encontrarlos.
```

- It returns `null` in three cases:
  - `catalogoEnContexto = false`,
  - no product meets the filter,
  - the query throws (the error is logged without personal data).
- The last line appears only if the query returned `limite + 1` rows.

## 3. Tool resolution

`resolverHerramientasAgente({ herramientas: unknown, catalogoEnContexto: boolean }): string[]`

It returns, deduplicated:
- the agent's list (`herramientas`),
- `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES`,
- `buscar_productos` when `catalogoEnContexto` is true.

Used by `generar-respuesta-ia.suscriptor.ts` (`obtenerHerramientasPermitidas`) and by `src/ai/simulador/servicio.ts`.

## 4. Server Actions (existing, extended input)

- `guardarAgenteIA`, `guardarBorradorAgenteIA`: `AgenteIAConfigSchema` accepts `respuestasGuia`, `catalogoEnContexto` and `limiteCatalogoContexto`.
  - The server rejects more than 15 guide answers, fields outside their limits, and duplicate `id` values, returning `{ exito: false, error: "Datos inválidos" }`, the existing message.
- `cargarConfigAgenteIA`: its `select` also returns the three fields.

## 5. Stage panel warning

- Condition: `iaHabilitada && !stage.agenteIAConfigId && !hayAgenteComercialEnInstancia`.
- Text: **"La IA responderá con un perfil mínimo, sin catálogo ni reglas del negocio. Crea un agente comercial o asígnalo a esta etapa."**
- It never disables the save button.
