# Data Model: Playbooks de estrategia comercial y selección explicable

## `OrigenPlaybook` (enum nuevo)

`PLANTILLA` | `PERSONALIZADA`

## `PlaybookEstrategia` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | FK a `Instancia`, `onDelete: Cascade`. |
| `nombre` | `String` | |
| `descripcion` | `String?` | |
| `origen` | `OrigenPlaybook` | `PLANTILLA` para las 7 sembradas; `PERSONALIZADA` para creadas por el negocio o duplicadas (FR-010, FR-003 — un duplicado de una plantilla nace `PERSONALIZADA`, no `PLANTILLA`, para no confundirse con la original en futuros reseeds). |
| `activo` | `Boolean @default(false)` | FR-001: plantillas sembradas inactivas por defecto. |
| `contenido` | `Json` | `{ reglas: string[] }` (research.md Decisión 2). |
| `condiciones` | `Json` | `{ tiposRelacion: TipoRelacionCliente[]; intenciones: IntencionComercial[] }` (research.md Decisión 3), como default de la estrategia — puede sobrescribirse por asignación (ver abajo). |
| `prioridad` | `Int @default(0)` | Default de la estrategia; la asignación puede tener su propia prioridad efectiva. |
| `creadoEn` / `actualizadoEn` | `DateTime` | Estándar del proyecto. |

Índices: `@@index([instanciaId, activo])`.

## `AgentePlaybookAsignacion` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `agenteIAConfigId` | `String` | FK a `AgenteIAConfig`, `onDelete: Cascade`. |
| `playbookEstrategiaId` | `String` | FK a `PlaybookEstrategia`, `onDelete: Restrict` (FR-011: no se puede eliminar un playbook mientras tenga asignaciones; quitar la asignación es una acción explícita previa). |
| `prioridadEfectiva` | `Int?` | Si es `null`, se usa `PlaybookEstrategia.prioridad`; permite ajustar la prioridad solo para este agente sin tocar la estrategia global. |
| `condicionesOverride` | `Json?` | Si no es `null`, sobrescribe `PlaybookEstrategia.condiciones` solo para esta asignación (permite que el mismo playbook se use con distintas condiciones en distintos agentes). |
| `creadoEn` | `DateTime @default(now())` | |

Índices: `@@unique([agenteIAConfigId, playbookEstrategiaId])`, `@@index([agenteIAConfigId])`.

## `SeleccionEstrategiaLog` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | Índice de aislamiento. |
| `agenteIAConfigId` | `String` | FK a `AgenteIAConfig`, `onDelete: Cascade`. |
| `conversacionId` | `String?` | FK a `Conversacion`, `onDelete: SetNull` — nullable porque el selector también corre desde el simulador (`018`) sin conversación real. |
| `playbookEstrategiaIdSeleccionado` | `String?` | `null` si no se seleccionó ninguna (FR-008). |
| `motivo` | `String` | Texto explicativo generado por el selector (ej. "Coincide tipo de relación=CLIENTE_REGULAR e intención=EXPLORANDO; 1 candidata"; o "Sin coincidencias entre 2 estrategias asignadas"; o "Empate de prioridad entre 2 candidatas, se tomó la de asignación más reciente"). |
| `tipoRelacionUsado` | `String?` | Señal recibida por el selector en este cálculo (puede ser `null` si no se proveyó, Edge Case de la spec). |
| `intencionUsada` | `String?` | Ídem. |
| `creadoEn` | `DateTime @default(now())` | |

Índices: `@@index([instanciaId, creadoEn])`, `@@index([agenteIAConfigId])`.

## Relación con entidades existentes

```text
Instancia 1───N PlaybookEstrategia
                      │
                      │ N───N (vía AgentePlaybookAsignacion)
                      ▼
AgenteIAConfig 1───N AgentePlaybookAsignacion
       │
       │ 1───N (registro de cada cálculo de selección)
       ▼
SeleccionEstrategiaLog ──(opcional)──> Conversacion
```

## Tipos compartidos (`src/ai/estrategia/tipos.ts`, no Prisma)

```ts
export type TipoRelacionCliente =
  | "NUEVO_CONTACTO" | "PROSPECTO_RECURRENTE" | "CLIENTE_NUEVO"
  | "CLIENTE_REGULAR" | "CLIENTE_INACTIVO" | "CLIENTE_CON_INCIDENCIA";

export type IntencionComercial =
  | "EXPLORANDO" | "COMPARANDO" | "SOLICITANDO_RECOMENDACION"
  | "CONSULTANDO_PRECIO" | "CONSULTANDO_DISPONIBILIDAD" | "LISTO_PARA_COTIZAR"
  | "LISTO_PARA_COMPRAR" | "ESPERANDO_INFORMACION" | "REQUIERE_SEGUIMIENTO"
  | "REQUIERE_ATENCION_HUMANA";
```

Estos tipos no son enums de Prisma en esta spec (se validan con Zod al guardar `condiciones`/`condicionesOverride` como JSON) — evita una migración de enum cada vez que `012` necesite ajustar el catálogo; si `012` confirma que el catálogo es estable, podrá promoverse a enum de Prisma en su propia spec sin romper esta.
