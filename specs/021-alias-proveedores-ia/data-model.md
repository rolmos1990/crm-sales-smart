# Data Model: Alias único para múltiples instancias del mismo proveedor de IA

## `ProveedorIA` (existente — modificado)

Representa una configuración individual de conexión a un proveedor de IA (Key Entity "Agente de IA (configuración de proveedor)" del spec). Ya existe en `prisma/schema.prisma`; esta feature le agrega dos columnas y reemplaza su restricción de unicidad.

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `alias` | `String` | Obligatorio (FR-003). Máx. 50 caracteres (Assumptions). Se guarda tal como lo escribe el usuario (sin normalizar) — es lo que se muestra en listados y selectores (FR-008). | Nuevo |
| `aliasNormalizado` | `String` | Calculado por la Server Action como `alias.trim().toLowerCase()` antes de cada `create`/`update` — nunca editable directamente por el usuario. Base de la unicidad (FR-004). | Nuevo, interno |
| `proveedor` | `ProveedorIAEnum` | Sin cambios. Inmutable tras creación (Decisión 5 de research.md) — no editable vía `actualizarProveedorIA`. | Existente |
| `tipoAgenteIA` | `TipoAgenteIA?` | Sin cambios de significado; deja de participar en la unicidad (FR-002). | Existente |
| *(resto de campos)* | — | Sin cambios: `apiKeyEncriptada`, `baseUrl`, `modelosDisponibles`, `activo`, `prioridad`, `limitePorMinuto`, `limitePorDia`, `costoInputPorMilToken`, `costoOutputPorMilToken`, `timeoutMs`, `reintentosMax`, `casosDeUso`. | Existente |

### Restricciones de unicidad

- **Eliminada**: `@@unique([instanciaId, proveedor, tipoAgenteIA])` (FR-002 — permite N configuraciones del mismo proveedor y mismo tipo de agente).
- **Agregada**: `@@unique([instanciaId, aliasNormalizado])` (FR-004/FR-005 — un alias, insensible a mayúsculas/espacios de borde, es único dentro de la instancia).

### Validación (Zod, boundary del servidor — Principio II)

- `alias`: `z.string().trim().min(1, "El alias es obligatorio").max(50)`.
- La comprobación de duplicado (case-insensitive) se hace en la Server Action antes de escribir (`findFirst` por `instanciaId` + `aliasNormalizado`, excluyendo el propio `id` en edición), y el `@@unique` de BD actúa como resguardo final ante condiciones de carrera (traducido a un error de negocio, nunca expuesto crudo — Principio V).

### Migración de datos (filas existentes — FR-009)

Ver research.md Decisión 3. Resumen: `alias` se backfillea con el nombre del `proveedor`, sufijado (`-2`, `-3`, ...) por orden de `creadoEn` cuando hay colisión dentro de la misma `(instanciaId, proveedor)`, antes de aplicar `NOT NULL` + el nuevo índice único. Ninguna fila existente queda sin alias válido.

## Sin nuevas entidades

Esta feature no introduce ninguna tabla ni modelo nuevo — extiende `ProveedorIA`, ya existente, y no toca `AgenteIAConfig` (personalidad/prompt del agente conversacional, entidad distinta) ni `ConfiguracionIA`/`UsoIA`.

## Relaciones

Sin cambios: `ProveedorIA` sigue relacionado 1-N con `Instancia` (`instanciaId`) y con `UsoIA`. El campo `casosDeUso` (usado por el enrutamiento por objetivo, spec 010) sigue referenciando al proveedor por `id`, no por alias — el alias es puramente de presentación/identificación humana, nunca una clave foránea.

## Estado / transiciones

No aplica — `ProveedorIA` no tiene una máquina de estados; `activo` (booleano existente) no cambia de semántica con esta feature.
