# Data Model: Alias y match de ubicaciones para transportistas

Extiende el modelo ya mergeado por specs `022-transportistas-zonas-tarifas`/`023-transportistas-por-pais` (`prisma/schema.prisma`). No se crean entidades paralelas de transportista/zona/tarifa — ver [research.md](research.md#2-modelo-de-datos--extender-vs-reemplazar).

## Entidades modificadas

### `ZonaEntregaUbicacion` (existente — se agregan campos)

| Campo | Tipo | Notas |
|---|---|---|
| `nombreVisible` | `String` | Calculado a partir de los niveles no vacíos (`provinciaEstado > distritoCiudad > corregimiento > sectorOCodigoPostal`), unidos con `" > "`. Se recalcula cada vez que se crea/edita la ubicación. Nullable en la migración inicial → `NOT NULL` en la migración de seguimiento tras el backfill. |
| `nombreNormalizado` | `String` | `normalizarUbicacion(nombreVisible)`. Mismo ciclo nullable → backfill → `NOT NULL`. Indexado (`@@index`) — es la base de la búsqueda EXACTA. |

El motor de matching (FR-005) **nunca** compara contra `nombreVisible`/`nombreNormalizado` directamente para resolver una consulta de envío — sigue comparando nivel por nivel (`provinciaEstado`, `distritoCiudad`, etc.), igual que hoy. Estos dos campos son para mostrar/buscar la fila como una unidad legible en UI e importación (ej. listar destinos, revisar duplicados), no para el algoritmo de cobertura.

**Relaciones**: + `aliases: AliasUbicacion[]` (1-N).

## Entidades nuevas

### `AliasUbicacion`

Representa un nombre alternativo por el que puede reconocerse un destino (`ZonaEntregaUbicacion`) ya configurado, a un nivel geográfico puntual de ese destino.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `zonaEntregaUbicacionId` | `String` | FK → `ZonaEntregaUbicacion`, `onDelete: Cascade` |
| `campo` | `CampoUbicacion` (enum) | A qué nivel del destino se refiere el alias — ver abajo |
| `valor` | `String` | Texto tal como lo ingresó el usuario (para mostrarlo) |
| `valorNormalizado` | `String` | `normalizarUbicacion(valor)` — usado para la búsqueda por ALIAS |
| `instanciaId` | `String` | Denormalizado desde `zonaEntrega.instanciaId` — evita un join de 2 saltos en cada consulta de matching y habilita el índice de unicidad por instancia. FK → `Instancia`, `onDelete: Cascade` |
| `creadoEn` | `DateTime` | `@default(now())` |

**Validaciones / reglas de negocio** (FR-002, FR-003):
- `valor`: `trim().min(1).max(150)` (Zod, en el boundary del server action).
- Unicidad: `@@unique([instanciaId, campo, valorNormalizado])` — el mismo alias normalizado no puede repetirse para dos destinos distintos dentro de la misma instancia, incluso si difieren en mayúsculas/tildes/espacios (la comparación es sobre el valor ya normalizado).
- `campo` debe corresponder a un nivel de `ZonaEntregaUbicacion` que **no** esté vacío (edge case del spec) — se valida en el server action antes de persistir, no a nivel de constraint de BD.

**Índices**: `@@index([zonaEntregaUbicacionId])` (listar alias de un destino), `@@index([instanciaId, valorNormalizado])` (búsqueda de matching por ALIAS).

### `CampoUbicacion` (enum nuevo)

```
PROVINCIA_ESTADO
DISTRITO_CIUDAD
CORREGIMIENTO
SECTOR_O_CODIGO_POSTAL
```

Corresponde 1:1 a los 4 campos de texto libre ya existentes en `ZonaEntregaUbicacion`.

## Entidades reutilizadas sin cambios de schema

- **`HistorialImportacion`** (existente): se reutiliza para registrar cada importación de destinos con `entidad = "DESTINO_TRANSPORTISTA"` (campo `String` libre en el modelo actual, no un enum — cero migración necesaria para agregar este valor). Campos usados: `archivoNombre`, `archivoTipo`, `archivoPeso`, `totalRegistros`, `registrosExitosos`, `registrosConError`, `errores` (Json), `estado`.
- **`Transportista` / `ZonaEntrega` / `TarifaTransportistaZona` / `ServicioTransportista` / `CondicionesTransportista`**: sin cambios de schema. `CondicionesTransportista` se lee (no se escribe) para enriquecer la respuesta de la tool de IA con pago contra entrega/días de entrega/hora límite.

## Diagrama de relaciones (fragmento relevante)

```
Instancia 1───N AliasUbicacion N───1 ZonaEntregaUbicacion N───1 ZonaEntrega
                                                                     │
                                                                     │ N
                                                                     ▼
                                                        TarifaTransportistaZona N───1 Transportista
```

## Migraciones

1. **Migración A** (`agregar_alias_ubicaciones_transportistas`):
   - `ALTER TABLE "ZonaEntregaUbicacion" ADD COLUMN "nombreVisible" TEXT, ADD COLUMN "nombreNormalizado" TEXT` (nullable).
   - `CREATE INDEX` sobre `nombreNormalizado`.
   - `CREATE TYPE "CampoUbicacion" AS ENUM (...)`.
   - `CREATE TABLE "AliasUbicacion" (...)` con FKs, `@@unique` e índices.
2. **Backfill** (fuera de Prisma, script idempotente): `scripts/backfill-normalizar-ubicaciones.ts` — completa `nombreVisible`/`nombreNormalizado` en las filas ya existentes.
3. **Migración B de seguimiento** (tarea separada en `tasks.md`, no bloqueante para desarrollo local): `ALTER COLUMN "nombreVisible" SET NOT NULL, ALTER COLUMN "nombreNormalizado" SET NOT NULL` — se aplica una vez confirmado el backfill en producción, mismo criterio que la migración de seguimiento pendiente de `Transportista.paisId` (spec 023).

## Reglas de validación resumidas (para `tasks.md`)

| Regla | Dónde se aplica |
|---|---|
| Alias no vacío, máx. 150 caracteres | Zod en `alias-schema.ts` |
| Alias único por instancia (normalizado) | `@@unique` en BD + verificación previa en el server action (mensaje claro antes de depender del error `P2002` como resguardo de carrera) |
| `campo` del alias debe corresponder a un nivel no vacío del destino | Server action, antes de `prisma.aliasUbicacion.create` |
| `nombreNormalizado`/`valorNormalizado` siempre derivados, nunca editables directamente por el usuario | No se exponen como campo de formulario — se calculan en el server action |
