# Data Model: Herramientas operativas de inventario, envíos y acciones comerciales controladas

## `MetodoEntregaConfig` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `metodoEntrega` | `MetodoEntrega` | Enum ya existente. |
| `activo` | `Boolean @default(true)` | |
| `costoBase` | `Decimal @default(0)` | |
| `diasEstimadosMin` | `Int?` | |
| `diasEstimadosMax` | `Int?` | |

Índices: `@@unique([instanciaId, metodoEntrega])`, `@@index([instanciaId])`.

## `ZonaCobertura` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `nombre` | `String` | Texto libre (research.md Decisión 1) — ej. "Lima Metropolitana", "Provincia - Arequipa". |

Índices: `@@unique([instanciaId, nombre])`.

## `ZonaCoberturaMetodo` (tabla puente, nueva)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `zonaCoberturaId` | `String` | FK a `ZonaCobertura`, `onDelete: Cascade`. |
| `metodoEntregaConfigId` | `String` | FK a `MetodoEntregaConfig`, `onDelete: Cascade`. |
| `cubierta` | `Boolean @default(true)` | `false` = zona explícitamente sin cobertura para ese método. |
| `costoAdicional` | `Decimal @default(0)` | Se suma a `MetodoEntregaConfig.costoBase`. |
| `diasAdicionales` | `Int @default(0)` | Se suma al rango estimado del método. |

Índices: `@@unique([zonaCoberturaId, metodoEntregaConfigId])`.

## `UbicacionRetiro` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `nombre` | `String` | |
| `direccion` | `String` | |
| `activo` | `Boolean @default(true)` | |

Índices: `@@index([instanciaId, activo])`.

## `Cotizacion` (columnas nuevas, aditivas)

| Campo | Tipo | Notas |
|---|---|---|
| `generadoPorIA` | `Boolean @default(false)` | research.md Decisión 3 — default preserva comportamiento actual. |
| `confirmadoPorHumano` | `Boolean @default(true)` | `true` por default = indistinguible de un documento humano hasta que se active el modo borrador. |
| `confirmadoPorUsuarioId` | `String?` | FK a `Usuario`, `onDelete: SetNull`. |

## `Pedido` (mismas 3 columnas nuevas, mismo criterio)

## `AgenteIAConfig` (columna nueva)

| Campo | Tipo | Notas |
|---|---|---|
| `accionesComercialesModoBorrador` | `Boolean @default(false)` | FR-009 — default = comportamiento actual (creación directa). |

## Relación

```text
Instancia 1───N MetodoEntregaConfig ───N───N ZonaCobertura (vía ZonaCoberturaMetodo)
Instancia 1───N UbicacionRetiro

AgenteIAConfig.accionesComercialesModoBorrador ──> controla generadoPorIA/confirmadoPorHumano
                                                     al crear Cotizacion/Pedido desde una tool
```

Ninguna tabla ni columna existente pierde su forma o su default previo — todas las columnas nuevas son opcionales o tienen un default que reproduce el comportamiento actual.
