# Data Model: 028-respuestas-guia-catalogo-ia

## AgenteIAConfig (existing): new fields

| Field | Type | Default | Validation (Zod) | Notes |
|---|---|---|---|---|
| `respuestasGuia` | `Json?` | `null` | `z.array(RespuestaGuiaSchema).max(15).nullable().optional()` | `null` or `[]` means no block in the prompt |
| `catalogoEnContexto` | `Boolean` | `true` | `z.boolean().optional()` | when false, no catalog layer and no automatic `buscar_productos` |
| `limiteCatalogoContexto` | `Int` | `30` | `z.number().int().min(1).max(100).optional()` | maximum products in the context |

Migration: additive only (`ALTER TABLE "AgenteIAConfig" ADD COLUMN …`). It has no data backfill and nothing destructive. Existing agents get the column defaults.

### RespuestaGuia (JSON element)

| Property | Type | Rule |
|---|---|---|
| `id` | string | 1–40 characters, unique within the list; generated on the client (`crypto.randomUUID()`) so the list can be edited |
| `intencion` | enum | `PRECIO` \| `DISPONIBILIDAD` \| `ENVIO` \| `PAGO` \| `SALUDO` \| `OTRA` |
| `cuandoAplica` | string | trim, 1–200 characters, required |
| `formato` | string | trim, 1–1000 characters, required; may contain `{nombreCliente}` `{producto}` `{precio}` `{moneda}` or other free text |
| `activa` | boolean | required (the editor creates it as `true`; no Zod default so the form's input and output types stay the same) |

Labels (UI): Precio, Disponibilidad, Envío, Pago, Saludo, Otra. They live in one constant map, `INTENCIONES_RESPUESTA_GUIA`, which also feeds the `<Select items>`.

## Versioning (AgenteIAConfigVersion, existing, unchanged)

- `contenido` already stores the full `AgenteIAConfigInput`, so the three new fields travel inside it with no schema change.
- On publish and on restore, `construirPayloadAgenteIA` applies them to the live row:
  - `respuestasGuia ?? Prisma.JsonNull`
  - `catalogoEnContexto ?? true`
  - `limiteCatalogoContexto ?? 30`
- A pre-028 version is restored with no guide answers and with the catalog on (see research.md, Decision 7).

## Producto (existing, read-only)

The catalog layer reads: `nombre`, `sku`, `precio` (Decimal, formatted to 2 decimals), `moneda`, `unidad`, `categoria`.

Filter: `instanciaId = <instancia del agente> AND activo = true AND precio > 0`. Order: `actualizadoEn desc`. `take: limite + 1`.

## PipelineStage (existing, no changes)

The warning uses the existing `respuestaIAHabilitada` and `agenteIAConfigId` fields, plus whether a `COMERCIAL` `AgenteIAConfig` exists in the instance.
