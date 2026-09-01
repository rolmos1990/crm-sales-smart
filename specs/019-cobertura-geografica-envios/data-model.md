# Data Model: Cobertura geográfica y costos de envío por transportista y delivery

Todas las entidades nuevas o modificadas extienden `prisma/schema.prisma`. Ningún modelo existente pierde campos ni cambia el significado de uno ya usado en producción (ver research.md Decisión 3 sobre `cubierta`).

## Entidades nuevas

### `Pais`

Catálogo global de referencia — no pertenece a ninguna instancia.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | String (cuid) | PK |
| `codigo` | String | ISO 3166-1 alpha-2, único (ej. `PE`, `CO`, `MX`) — usado para match/FK |
| `codigoAlpha3` | String? | ISO 3166-1 alpha-3 (ej. `PER`) — presentacional |
| `nombre` | String | Nombre visible (ej. "Perú") |
| `indicativoTelefonico` | String? | Ej. `+51` — presentacional, referencia útil junto al país en el dropdown |
| `banderaEmoji` | String? | Ej. `🇵🇪` — presentacional, mostrado en el Combobox (research.md Decisión 2b) |
| `estados` | `EstadoProvincia[]` | Relación inversa |

Los campos presentacionales (`codigoAlpha3`, `indicativoTelefonico`, `banderaEmoji`) nunca participan en el flujo de resolución de costo/cobertura — el match sigue siendo por `id`/`estadoProvinciaId` (ver "Flujo de resolución de costo" más abajo). Cobertura de seed: ISO completo (~195 países), no solo LatAm (research.md Decisión 2, revisión).

### `EstadoProvincia`

Catálogo global, hijo de `Pais`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | String (cuid) | PK |
| `paisId` | String | FK → `Pais` |
| `codigo` | String? | Código opcional (ISO 3166-2 si existe) |
| `nombre` | String | Nombre visible (ej. "Lima", "Antioquia") |

**Constraint**: `@@unique([paisId, nombre])` — dentro de un país, el nombre de estado/provincia es único (garantiza match determinístico).

### `TransportistaCoberturaGeografica`

Zona de cobertura de un transportista concreto, por país + estado/provincia, con su costo.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | String (cuid) | PK |
| `transportistaId` | String | FK → `Transportista`, `onDelete: Cascade` |
| `paisId` | String | FK → `Pais` |
| `estadoProvinciaId` | String | FK → `EstadoProvincia` |
| `costoEnvio` | Decimal | Costo final para esa zona con ese transportista (no es un adicional — ver research.md Decisión 1) |
| `activo` | Boolean | default `true` |
| `creadoEn` / `actualizadoEn` | DateTime | Auditoría estándar del proyecto |

**Constraints**: `@@unique([transportistaId, estadoProvinciaId])` (un transportista no puede tener dos costos distintos para el mismo estado/provincia — evita ambigüedad interna, FR-016). `@@index([transportistaId])`.

**Validación de negocio (Zod, en el action de guardado)**:
- `costoEnvio >= 0`, requerido (FR-016 — rechazar sin costo).
- `estadoProvinciaId` MUST pertenecer a `paisId` (`estadoProvincia.paisId === paisId`) — rechazar si no.
- Si el negocio está en modo `UN_SOLO_PAIS` (ver `ConfiguracionEmpresa` abajo), `paisId` se fija automáticamente al `paisOperacionId` configurado — el formulario no pide país (FR-011 aplicado también a la configuración de cobertura, no solo a cotización/pedido).

## Entidades modificadas

### `Transportista` (existente)

Agrega relación inversa:

```
coberturaGeografica TransportistaCoberturaGeografica[]
```

Sin cambios a los campos existentes (`nombre`, `tipo`, `activo`).

### `MetodoEntregaConfig` (existente)

Agrega:

| Campo | Tipo | Notas |
|---|---|---|
| `modoCobertura` | `ModoCoberturaDelivery` | default `SOLO_ZONAS_EVALUADAS` (criterio conservador, ver research.md Decisión 3) |

Nuevo enum:

```
enum ModoCoberturaDelivery {
  TODOS_LADOS_CON_EXCEPCIONES
  SOLO_ZONAS_EVALUADAS
}
```

Solo tiene efecto observable para métodos que no son `COURIER_EXTERNO` (i.e., delivery propio — `MENSAJERO_PROPIO` principalmente), pero el campo es genérico en la tabla para no introducir una tabla paralela.

### `ZonaCoberturaMetodo` (existente)

Agrega:

| Campo | Tipo | Notas |
|---|---|---|
| `esExcepcion` | Boolean | default `false` |

**Regla de negocio (no expresable como constraint de Prisma)**: `esExcepcion = true` y `cubierta = true` no pueden coexistir en la misma fila — el action de guardado (`guardarZonaCoberturaMetodo`) lo rechaza con error de validación (FR-007).

**Semántica según `modoCobertura` del método asociado**:
- `TODOS_LADOS_CON_EXCEPCIONES`: filas con `esExcepcion = true` son exclusiones explícitas (negativa clara); cualquier zona no listada se asume cubierta.
- `SOLO_ZONAS_EVALUADAS`: filas con `cubierta = true` son zonas confirmadas cubiertas. Una fila **existente** con `cubierta = false` es una negativa clara ("no se entrega ahí", igual de determinística que una excepción del otro modo — preserva el comportamiento de negocios que ya tenían zonas así configuradas antes de esta feature). Una zona que **no aparece en ninguna fila** para ese método sí requiere evaluación humana — es "sin resolver", no "no cubierta" (ver research.md Decisión 5).

### `ConfiguracionEmpresa` (existente)

Agrega:

| Campo | Tipo | Notas |
|---|---|---|
| `modoGeografico` | `ModoGeografico` | default `MULTIPAIS` (no cambia el comportamiento actual — hoy no se pide país en ningún formulario, así que `MULTIPAIS` como default technically introduce el selector; ver Nota de migración abajo) |
| `paisOperacionId` | String? | FK → `Pais`, requerido solo si `modoGeografico = UN_SOLO_PAIS` |

Nuevo enum:

```
enum ModoGeografico {
  UN_SOLO_PAIS
  MULTIPAIS
}
```

**Nota de migración / default real**: para que la adopción de esta feature no le agregue fricción a ningún negocio existente el día del deploy, el negocio ya tiene `ConfiguracionEmpresa.pais` (texto libre) cargado en la mayoría de los casos — el script de migración/seed de esta feature MUST inicializar `modoGeografico = UN_SOLO_PAIS` y resolver `paisOperacionId` contra el catálogo nuevo usando ese `pais` de texto libre existente cuando haya un match razonable; si no hay match, cae a `MULTIPAIS` (el negocio deberá configurar explícitamente su modo). Esto es trabajo de la migración de datos (tasks), no un default de schema — el default de schema (`MULTIPAIS`) es solo para instancias nuevas sin `ConfiguracionEmpresa.pais` cargado.

### `EntregaCotizacion` (existente)

Agrega, junto a `transportistaId`:

| Campo | Tipo | Notas |
|---|---|---|
| `paisId` | String? | FK → `Pais` — solo se pide si `modoGeografico = MULTIPAIS` |
| `estadoProvinciaId` | String? | FK → `EstadoProvincia` |
| `ciudad` | String? | Texto libre, refinamiento opcional (FR-014) |

### `EntregaPedido` (existente)

Mismos tres campos que `EntregaCotizacion` (`paisId`, `estadoProvinciaId`, `ciudad`), por la misma razón: es donde ya vive `transportistaId` y donde se completa la entrega. `generar-pedido-desde-cotizacion.service.ts` MUST copiar estos tres campos desde `EntregaCotizacion` al crear el `EntregaPedido`, igual que ya copia `transportistaId`/`metodoEntrega`.

## Flujo de resolución de costo (usado por UI humana y por las tools de IA)

Dado `(paisId?, estadoProvinciaId, ciudad?, metodoEntrega?, transportistaId?)`:

1. Si `paisId` no viene y el negocio está en `UN_SOLO_PAIS` → usar `ConfiguracionEmpresa.paisOperacionId`.
2. Resolver `estadoProvinciaId` contra el catálogo dentro de ese país (por id si ya se tiene, o por nombre normalizado si viene de texto de conversación). Sin resolución → **sin coincidencia clara** (research.md Decisión 5, caso 1).
3. Buscar candidatos:
   - `TransportistaCoberturaGeografica` activas para ese `estadoProvinciaId` (filtradas por `transportistaId` si vino).
   - Métodos de delivery (`MetodoEntregaConfig` con `modoCobertura`) — si `TODOS_LADOS_CON_EXCEPCIONES`: cubierto salvo que la zona esté en excepciones; si `SOLO_ZONAS_EVALUADAS`: cubierto solo si la zona está explícitamente en `ZonaCoberturaMetodo.cubierta = true`.
4. Si el conjunto de candidatos con costo aplicable tiene **más de un valor distinto** y no hay suficiente información para elegir uno → **sin coincidencia clara** (caso 3).
5. Si cae en zona `SOLO_ZONAS_EVALUADAS` no listada → **sin coincidencia clara** (caso 2).
6. Caso contrario → costo/cobertura determinado, se devuelve sin ambigüedad.

Este flujo es una función pura (sin I/O más allá de las lecturas Prisma), testeable de forma aislada — mismo patrón que `decidirAutonomia` en `gate.ts`.

## Seed de catálogo

Script dedicado `scripts/seed-geografia.ts` (**no** dentro de `prisma/seed.ts`, que borra y recrea datos de ejemplo — el catálogo geográfico debe poder sembrarse/actualizarse en producción sin tocar datos de tenants). Alcance: catálogo ISO completo desde el día uno (~195 países + sus estados/provincias — research.md Decisión 2, revisión), generado a partir de un dataset ISO 3166-1/3166-2 de código abierto (research.md Decisión 2b) mediante `upsert` por `codigo` (país) y `(paisId, nombre)` (estado/provincia) — re-ejecutar el script es seguro (idempotente), nunca duplica ni borra coberturas ya configuradas por un negocio porque esas viven en tablas distintas con FK, no en `Pais`/`EstadoProvincia`.
