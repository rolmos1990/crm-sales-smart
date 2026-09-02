# Research: Alias único para múltiples instancias del mismo proveedor de IA

## Contexto de código confirmado (pre-Fase 0)

- `ProveedorIA` (`prisma/schema.prisma:2045-2072`) hoy tiene `@@unique([instanciaId, proveedor, tipoAgenteIA])` — es la restricción que bloquea FR-001/FR-002.
- Ningún código de aplicación depende de esa clave compuesta para lookups: `grep` sobre `src/` solo la encuentra en el cliente Prisma generado (`src/generated/prisma/models/ProveedorIA.ts`), nunca en un `findUnique`/`findFirst` propio. El único `findUnique` real es por `id` (`src/ai/queries.ts:18`).
- `seleccionarProveedor` / `resolverProveedorPorObjetivo` (`src/ai/orquestador/orquestador.ts`) ya operan sobre **arreglos** de proveedores activos (filter/sort), no asumen unicidad por `(proveedor, tipoAgenteIA)` — quitar esa restricción no requiere tocar el orquestador.
- No existe hoy ninguna Server Action de edición para `ProveedorIA` (`src/configuracion/ia/actions.ts` solo tiene `crearProveedorIA`, `toggleProveedorIA`, `eliminarProveedorIA`, `guardarAsignacionesObjetivoIA`) — FR-006/FR-007 son capacidad nueva, no una extensión de algo existente.
- El selector de enrutamiento (`src/configuracion/components/seccion-enrutamiento.tsx:117`) muestra `{p.proveedor}` — confirma FR-008.
- No hay precedente en el schema de un campo con unicidad insensible a mayúsculas/espacios (`grep` de "normalizad"/"toLowerCase" no encuentra ningún patrón de columna normalizada para `@@unique`); se decide el patrón en la Decisión 1.

## Decisión 1: Unicidad de Alias insensible a mayúsculas/espacios

**Decision**: Agregar dos columnas a `ProveedorIA`: `alias` (String, tal como lo escribe el usuario, para mostrar) y `aliasNormalizado` (String, `alias.trim().toLowerCase()`, calculado por la Server Action antes de cada `create`/`update`). La unicidad se declara en el schema como `@@unique([instanciaId, aliasNormalizado])`.

**Rationale**: Postgres no soporta un `@@unique` case-insensitive de forma declarativa en Prisma sin extensiones (`citext`) o índices de expresión (no soportados por el `schema.prisma` de este proyecto, que no usa `previewFeatures` para índices de expresión). Guardar una columna normalizada, calculada en el único punto de escritura (la Server Action), es el patrón estándar para este caso, no introduce una dependencia nueva (Principio "New dependencies require a concrete need") y mantiene la regla server-side (Principio II: Server-Enforced Business Rules) — el cliente nunca decide la normalización.

**Alternatives considered**:
- Extensión `citext` de Postgres: requeriría una migración de extensión a nivel de base de datos y no está en el stack aprobado ni ya en uso en el proyecto — se descarta por no tener necesidad concreta que la justifique frente a la alternativa más simple.
- Índice de expresión (`CREATE UNIQUE INDEX ... (lower(trim(alias)))`) vía SQL crudo en la migración, sin columna extra: evita la columna redundante, pero Prisma no puede representarlo en `schema.prisma` (quedaría como `@@index` no gestionado, con drift entre schema y BD) — se descarta para no romper `prisma migrate diff`/`db push` en el futuro.
- Validar unicidad solo en la Server Action (sin constraint de BD): no cumple con Principio II ni con la garantía de integridad ante escrituras concurrentes (dos requests simultáneas podrían crear el mismo alias) — se descarta.

## Decisión 2: Reemplazo de la restricción única existente

**Decision**: Eliminar `@@unique([instanciaId, proveedor, tipoAgenteIA])` de `ProveedorIA` en la misma migración que agrega `aliasNormalizado`, y no reemplazarla por ninguna otra combinación sobre `proveedor`/`tipoAgenteIA`.

**Rationale**: Es exactamente FR-002. Confirmado (arriba) que ningún código depende de esa clave para lookups, y que el orquestador ya soporta N proveedores por combinación. `tipoAgenteIA` sigue existiendo como campo de filtro normal, solo deja de ser parte de una clave de unicidad.

**Alternatives considered**: Mantener la restricción vieja además de la nueva — se descarta porque contradice explícitamente FR-002 y el Edge Case correspondiente en el spec.

## Decisión 3: Migración de datos para filas existentes (FR-009)

**Decision**: Migración en tres pasos dentro de un único archivo de migración versionado (Prisma migration SQL, siguiendo el estilo ya usado en `prisma/migrations/20260701200000_add_tipo_agente_ia`):
1. `ALTER TABLE "ProveedorIA" ADD COLUMN "alias" TEXT` y `"aliasNormalizado" TEXT` (nullable, sin default) + `DROP INDEX` de la restricción vieja.
2. Backfill vía SQL: `alias = proveedor` con sufijo numérico para colisiones dentro de la misma instancia, calculado con `ROW_NUMBER() OVER (PARTITION BY "instanciaId", "proveedor" ORDER BY "creadoEn")` (sufijo solo cuando el número de fila es > 1, ej. `DEEPSEEK`, `DEEPSEEK-2`, `DEEPSEEK-3`); `aliasNormalizado = lower(trim(alias))`.
3. `ALTER COLUMN "alias" SET NOT NULL`, `ALTER COLUMN "aliasNormalizado" SET NOT NULL`, y `CREATE UNIQUE INDEX ... ON "ProveedorIA"("instanciaId", "aliasNormalizado")`.

**Rationale**: Cumple la Restricción técnica de la constitución ("Prisma migrations MUST be versioned, reviewable, and safe for existing data") sin downtime lógico — cada paso es reversible/verificable antes del siguiente, y el `NOT NULL` solo se aplica después de garantizar que todas las filas ya tienen un valor válido y único. Satisface FR-009 y SC-004 sin intervención manual.

**Alternatives considered**: Backfill en código de aplicación (script Node ejecutado post-deploy) — se descarta porque introduce una ventana donde la migración de schema y el backfill de datos no son atómicos ni versionados juntos, violando "migrations MUST be ... safe for existing data" de forma más frágil que hacerlo todo en SQL de la propia migración.

## Decisión 4: Server Action de edición

**Decision**: Nueva Server Action `actualizarProveedorIA(id, datos)` en `src/configuracion/ia/actions.ts`, con la misma forma que `crearProveedorIA` (valida con un nuevo `ActualizarProveedorIASchema` derivado de `ProveedorIASchema` + `alias`, verifica `verificarAcceso(sesion, "ia", "modificar")`, hace `findFirst({ where: { id, instanciaId } })` para confirmar tenencia — mismo patrón que `toggleProveedorIA`/`eliminarProveedorIA` — y solo entonces actualiza). La verificación de alias duplicado se hace primero con una consulta explícita (`findFirst` por `instanciaId` + `aliasNormalizado`, excluyendo el propio `id`) para devolver un error de negocio claro (FR-005), y además se captura el código `P2002` de Prisma como resguardo ante condiciones de carrera (dos guardados simultáneos), traduciéndolo al mismo mensaje de "Alias ya en uso" en vez de dejar escapar el error interno de Prisma (Principio V: "server errors MUST NOT expose internal details").

**Rationale**: Reutiliza el schema y el patrón de autorización/tenencia ya establecido (Principio I: extender el módulo existente, no crear una abstracción paralela) y cumple el reglas del proyecto (validar con Zod antes de tocar Prisma, nunca concatenar strings).

**Alternatives considered**: Reutilizar `crearProveedorIA` con un flag `id` opcional (upsert implícito) — se descarta por mezclar dos intents distintos (crear vs. editar) en una sola función, dificultando el manejo de errores específico de cada caso y contradiciendo el patrón ya usado en el resto del módulo (acciones con un solo propósito).

## Decisión 5: Alcance de la edición

**Decision**: `actualizarProveedorIA` acepta los mismos campos que `crearProveedorIA` (alias, tipoAgenteIA, apiKey, baseUrl, modelosDisponibles, prioridad, límites, timeout, reintentos) pero **no** acepta cambiar `proveedor` (el enum del proveedor subyacente es inmutable tras la creación, según el supuesto documentado en el spec).

**Rationale**: Coincide con la Suposición explícita del spec ("El tipo de proveedor... no cambia como parte de esta funcionalidad"). Cambiar de proveedor implicaría re-validar `modelosDisponibles`/`baseUrl` contra un proveedor distinto y cambia el significado de costos ya registrados en `UsoIA` — fuera de alcance.

**Alternatives considered**: Permitir cambiar `proveedor` en edición — descartado por exceder el alcance acordado en el spec (Assumptions) y no tener un caso de uso reportado por el usuario.

## Decisión 6: UI — mostrar Alias y habilitar edición

**Decision**: 
- `form-proveedor-ia.tsx` gana un campo `Alias` (obligatorio, primero en el formulario) y un prop opcional `proveedorExistente` que, cuando está presente, precarga el formulario y hace que `onSubmit` llame a `actualizarProveedorIA(proveedorExistente.id, datos)` en vez de `crearProveedorIA(datos)` — mismo componente para ambos flujos (evita duplicar markup, cumple la guía de `design-systems` del proyecto de no copiar markup idéntico entre variantes).
- `lista-proveedores-ia.tsx` muestra el `alias` como título principal de cada fila (con el nombre del proveedor como subtítulo/badge secundario) y agrega una acción "Editar" que abre `FormProveedorIA` con `proveedorExistente` seteado.
- `seccion-enrutamiento.tsx` cambia `{p.proveedor}` por `{p.alias}` en las `SelectItem` (línea 117) y en el mapa `itemsProveedores` (línea 56).
- `queries.ts`: `obtenerProveedoresIA`, `obtenerProveedorIA` agregan `alias` al `select`; `obtenerAsignacionesObjetivoIA` agrega `proveedorAlias` junto a `proveedorNombre` (se mantiene `proveedorNombre` por compatibilidad con cualquier otro consumidor, se añade el alias sin removerlo).

**Rationale**: Cumple FR-008 tocando únicamente los tres puntos ya identificados por `grep` como los lugares donde un proveedor se lista o se selecciona — no se descubrieron otros consumidores de `p.proveedor` como label.

**Alternatives considered**: Un diálogo de edición separado (`dialog-editar-proveedor.tsx`) en vez de reutilizar `FormProveedorIA` — se descarta por duplicar campos y validación ya existentes en el formulario de creación, contra la guía de `design-systems` del proyecto.

## Resueltos: NEEDS CLARIFICATION

Ninguno — el spec no dejó marcadores `[NEEDS CLARIFICATION]` pendientes (ver checklist de calidad). Los únicos puntos de diseño abiertos (formato de columna normalizada, estrategia de backfill, forma de la Server Action de edición) se resolvieron arriba con las Decisiones 1–6, todas dentro de los supuestos ya documentados en el spec.
