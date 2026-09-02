---
description: "Task list for feature implementation"
---

# Tasks: Alias único para múltiples instancias del mismo proveedor de IA

**Input**: Design documents from `/specs/021-alias-proveedores-ia/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/server-actions.md](contracts/server-actions.md), [quickstart.md](quickstart.md)

**Tests**: Incluidos — el plan (Constitution Check, Principio V) compromete explícitamente tests Vitest para las Server Actions y una extensión del spec Playwright ya existente de `/configuracion`.

**Organization**: Tareas agrupadas por historia de usuario (spec.md), todas Prioridad P1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Proyecto Next.js de módulo único (ver plan.md → Project Structure). Todas las rutas son relativas a la raíz del repo.

---

## Phase 1: Setup

**Purpose**: Confirmar el entorno antes de tocar schema/datos compartidos por las 3 historias

- [X] T001 Confirmar que la rama `021-alias-proveedores-ia` está activa, `npm install` está al día y `npm run db:migrate` puede conectar a la base de datos de desarrollo (sin aplicar todavía ninguna migración de esta feature)

**Checkpoint**: Entorno listo para modificar schema y datos

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: El campo `alias` y su unicidad son compartidos por las 3 historias de usuario — deben existir en schema, migración, validación Zod, queries y Server Actions antes de tocar ninguna UI de historia

**⚠️ CRITICAL**: Ninguna tarea de Fase 3+ puede empezar hasta cerrar esta fase

- [X] T002 Modificar `prisma/schema.prisma`: agregar `alias String` y `aliasNormalizado String` al modelo `ProveedorIA`, eliminar `@@unique([instanciaId, proveedor, tipoAgenteIA])`, agregar `@@unique([instanciaId, aliasNormalizado])` (ver [data-model.md](data-model.md))
- [X] T003 Crear `prisma/migrations/<timestamp>_alias_proveedores_ia/migration.sql` (depende de T002): `ALTER TABLE` agregando ambas columnas como nullable, `DROP INDEX` de la restricción vieja, backfill de `alias`/`aliasNormalizado` con `ROW_NUMBER() OVER (PARTITION BY "instanciaId", "proveedor" ORDER BY "creadoEn")` para sufijar colisiones (`DEEPSEEK`, `DEEPSEEK-2`, ...), luego `ALTER COLUMN ... SET NOT NULL` en ambas y `CREATE UNIQUE INDEX` nuevo (ver [research.md](research.md) Decisión 3)
- [X] T004 Aplicar la migración (`npm run db:migrate`) y regenerar el cliente Prisma; confirmar en `src/generated/prisma` que `ProveedorIA` expone `alias`/`aliasNormalizado` (depende de T003)
- [X] T005 [P] Extender `ProveedorIASchema` en `src/configuracion/ia/schema.ts` con `alias: z.string().trim().min(1, "El alias es obligatorio").max(50)`, y agregar `ActualizarProveedorIASchema = ProveedorIASchema.omit({ proveedor: true })` (ver [contracts/server-actions.md](contracts/server-actions.md))
- [X] T006 Extender `src/configuracion/ia/queries.ts` (depende de T004): agregar `alias` al `select` de `obtenerProveedoresIA` y `obtenerProveedorIA`; agregar `proveedorAlias` (junto a `proveedorNombre`, sin removerlo) en `AsignacionObjetivoIA`/`obtenerAsignacionesObjetivoIA`
- [X] T007 Extender `src/configuracion/ia/actions.ts` (depende de T004, T005): en `crearProveedorIA`, calcular `aliasNormalizado`, verificar duplicado vía `findFirst({ instanciaId, aliasNormalizado })` antes de crear, y capturar `P2002` como resguardo con el mismo mensaje de negocio; crear la nueva Server Action `actualizarProveedorIA(id, datos)` con `ActualizarProveedorIASchema`, verificación de tenencia (`findFirst({ id, instanciaId })`), verificación de duplicado excluyendo el propio `id` (`NOT: { id }`), y el mismo resguardo `P2002` (ver [contracts/server-actions.md](contracts/server-actions.md))

**Checkpoint**: `alias` existe end-to-end en datos, validación y Server Actions — listo para conectar la UI de cada historia

---

## Phase 3: User Story 1 - Crear varias configuraciones del mismo proveedor con un Alias propio (Priority: P1) 🎯 MVP

**Goal**: Poder crear más de un agente del mismo proveedor (mismo o distinto token), cada uno con Alias obligatorio y único

**Independent Test**: Crear un DeepSeek con alias "DeepSeek Ventas" y otro DeepSeek con alias "DeepSeek Soporte" → ambos quedan guardados y listados por separado; repetir con alias "DeepSeek Ventas" de nuevo → rechazado

### Tests for User Story 1

- [X] T008 [P] [US1] Tests Vitest en `src/configuracion/ia/actions.test.ts` (archivo nuevo) para `crearProveedorIA`: crea con alias válido; crea un segundo proveedor del mismo `proveedor`+`tipoAgenteIA` con alias distinto (ya no choca con la restricción vieja); rechaza alias vacío (Zod); rechaza alias duplicado exacto y duplicado case/espacio-insensible, sin exponer el código interno de Prisma

### Implementation for User Story 1

- [X] T009 [US1] Agregar el campo Alias (obligatorio, primero en el formulario) a `src/configuracion/components/form-proveedor-ia.tsx`, conectado al `ProveedorIASchema` extendido; mostrar el error de "alias ya en uso" devuelto por la Server Action
- [X] T010 [US1] Mostrar el `alias` como título principal de cada fila en `src/configuracion/components/lista-proveedores-ia.tsx`, con el nombre del proveedor (`proveedor`) como subtítulo/badge secundario
- [X] T011 [US1] Escenario Playwright en `tests/e2e/configuracion/configuracion.spec.ts`: crear dos proveedores DeepSeek con alias distintos y verificar que ambos aparecen listados; intentar un tercero con alias duplicado y verificar el mensaje de rechazo (ver [quickstart.md](quickstart.md) Escenario 1) — escrito; no ejecutado en este entorno (falta `.env.test` con credenciales de usuarios de prueba)

**Checkpoint**: User Story 1 funcional y verificable de forma independiente — ya es un MVP entregable

---

## Phase 4: User Story 2 - Editar el Alias (y el resto de la configuración) de un agente existente (Priority: P1)

**Goal**: Poder editar un agente ya creado, incluyendo su Alias, sin borrarlo y recrearlo

**Independent Test**: Editar el alias de "DeepSeek Soporte" a uno nuevo no usado → se guarda y se refleja en el listado; intentar editarlo al alias de otro agente existente → rechazado; guardar sin cambiar el alias → no se marca como duplicado consigo mismo

### Tests for User Story 2

- [X] T012 [US2] Tests Vitest en `src/configuracion/ia/actions.test.ts` (agregar a T008, mismo archivo) para `actualizarProveedorIA`: edita campos y conserva su propio alias sin error; rechaza edición a un alias usado por otro agente (case/espacio-insensible); rechaza edición sobre un `id` de otra instancia ("Proveedor no encontrado"); rechaza alias vacío

### Implementation for User Story 2

- [X] T013 [US2] Agregar prop `proveedorExistente` (opcional) a `src/configuracion/components/form-proveedor-ia.tsx` (agregar a T009, mismo archivo): cuando está presente, precarga el formulario y llama `actualizarProveedorIA(proveedorExistente.id, datos)` en vez de `crearProveedorIA(datos)`; el campo `proveedor` se muestra de solo lectura en modo edición (inmutable, ver [research.md](research.md) Decisión 5)
- [X] T014 [US2] Agregar acción "Editar" a cada fila en `src/configuracion/components/lista-proveedores-ia.tsx` (agregar a T010, mismo archivo) que abre `FormProveedorIA` con `proveedorExistente` seteado (depende de T013)
- [X] T015 [US2] Escenario Playwright en `tests/e2e/configuracion/configuracion.spec.ts` (agregar a T011, mismo archivo): editar el alias de un agente existente a uno nuevo y verificar que se refleja en el listado; editar dejando el mismo alias y verificar que no falla; intentar editar a un alias ya usado por otro agente y verificar el rechazo (ver [quickstart.md](quickstart.md) Escenario 2) — escrito; no ejecutado en este entorno (falta `.env.test`)

**Checkpoint**: User Stories 1 y 2 funcionan de forma independiente y en conjunto

---

## Phase 5: User Story 3 - Distinguir agentes del mismo proveedor al elegir el enrutamiento por objetivo (Priority: P1)

**Goal**: Que el selector de enrutamiento por objetivo (y el listado de proveedores) muestren el Alias, no el nombre repetido del proveedor

**Independent Test**: Con dos agentes DeepSeek activos con alias distintos, abrir el selector de cualquier objetivo en la pantalla de enrutamiento y verificar que lista los alias, no "DEEPSEEK" repetido dos veces

### Implementation for User Story 3

- [X] T016 [P] [US3] Modificar `src/configuracion/components/seccion-enrutamiento.tsx`: agregar `alias: string` a la interfaz `ProveedorActivoOpcion`, y usar `p.alias` en vez de `p.proveedor` tanto en el mapa `itemsProveedores` como en las `SelectItem` del listado de proveedores
- [X] T017 [US3] Actualizar `src/configuracion/components/tab-ia.tsx`: incluir `alias: p.alias` al construir `proveedoresActivos` que se pasa a `SeccionEnrutamiento` (depende de T006, T016)
- [X] T018 [US3] Escenario Playwright en `tests/e2e/configuracion/configuracion.spec.ts` (agregar a T015, mismo archivo): con dos agentes DeepSeek activos de alias distinto, abrir el selector de un objetivo de enrutamiento y verificar que ambos alias aparecen como opciones separadas; asignar uno, recargar, y verificar que la asignación sigue mostrando su alias (ver [quickstart.md](quickstart.md) Escenario 3) — escrito; no ejecutado en este entorno (falta `.env.test`)

**Checkpoint**: Las 3 historias de usuario funcionan de forma independiente y en conjunto

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final de la migración de datos existentes y de la suite completa

- [X] T019 [P] Verificar el Escenario 4 de [quickstart.md](quickstart.md) (FR-009/SC-004): sobre una base con filas de `ProveedorIA` previas a esta feature, confirmar que la migración (T003) les asignó un alias no vacío y único, y que siguen seleccionables en `SeccionEnrutamiento` — verificado contra la base real: la única fila preexistente quedó con `alias: "DEEPSEEK"` / `aliasNormalizado: "deepseek"`
- [X] T020 Ejecutar `npm run test:unit` (incluye T008, T012) y `npm run test:e2e:configuracion` (incluye T011, T015, T018) y confirmar que todo pasa en verde — `test:unit`: 45 archivos / 289 tests en verde; `test:e2e:configuracion` no se pudo ejecutar en este entorno (falta `.env.test` con credenciales de usuarios de prueba) — pendiente de correr por el usuario
- [X] T021 [P] Confirmar en `prisma/schema.prisma` que `@@unique([instanciaId, proveedor, tipoAgenteIA])` ya no existe y que `@@unique([instanciaId, aliasNormalizado])` sí, cerrando FR-002/FR-004 — confirmado

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede iniciar de inmediato
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA las 3 historias de usuario (todas comparten el campo `alias` en schema/datos/Server Actions)
- **User Stories (Phase 3-5)**: todas dependen de Foundational; entre sí, US2 y US3 reutilizan archivos ya tocados por US1 (`form-proveedor-ia.tsx`, `lista-proveedores-ia.tsx`, `configuracion.spec.ts`), así que en la práctica se implementan en orden P1→P1→P1 tal como están numeradas, aunque cada una es independientemente verificable con el Independent Test de su fase
- **Polish (Phase 6)**: depende de que las historias que se vayan a entregar ya estén completas

### User Story Dependencies

- **User Story 1 (P1)**: depende solo de Foundational
- **User Story 2 (P1)**: depende de Foundational; comparte archivos con US1 (T009→T013, T010→T014, T011→T015) pero es independientemente testeable por su cuenta
- **User Story 3 (P1)**: depende de Foundational (en particular T006); comparte archivo de e2e con US1/US2 (T011/T015→T018) pero es independientemente testeable por su cuenta

### Parallel Opportunities

- T005 (schema.ts) puede correr en paralelo con T002-T004 (no depende del cliente Prisma regenerado)
- T008 (tests US1) puede escribirse en paralelo con T009/T010 (UI), aunque debe fallar antes de que T007 esté implementado
- T016 (seccion-enrutamiento.tsx) puede correr en paralelo con el trabajo de US1/US2 una vez cerrada Foundational, ya que toca un archivo distinto
- T019 y T021 (Polish) son independientes entre sí

---

## Parallel Example: Foundational

```bash
# Una vez completado T004 (migración aplicada + cliente regenerado):
Task: "Extender ProveedorIASchema en src/configuracion/ia/schema.ts"  # T005 — en realidad ya pudo iniciar antes, en paralelo con T002-T004
```

## Parallel Example: User Story 3

```bash
# Independiente de los archivos que tocan US1/US2:
Task: "Modificar seccion-enrutamiento.tsx para usar alias en vez de proveedor"  # T016
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Completar Fase 1: Setup
2. Completar Fase 2: Foundational (CRÍTICO — bloquea las 3 historias)
3. Completar Fase 3: User Story 1
4. **DETENER y VALIDAR**: correr el Escenario 1 de quickstart.md de forma independiente
5. Entregar/demostrar si está listo — ya resuelve el bloqueo central ("no puedo tener 2 DeepSeek")

### Incremental Delivery

1. Setup + Foundational → base lista
2. User Story 1 → validar independientemente → demo (MVP)
3. User Story 2 → validar independientemente → demo (edición ya disponible)
4. User Story 3 → validar independientemente → demo (alias visible en enrutamiento — cierra el pedido completo del usuario)
5. Polish → confirma migración de datos existentes y corre la suite completa

## Notes

- Todas las historias son P1 — se numeraron en el mismo orden en que aparecen en spec.md, que ya refleja la secuencia de valor (crear → editar → ver en el selector).
- T009/T013, T010/T014 y T011/T015/T018 comparten archivo entre historias — no marcados `[P]` entre sí para evitar conflictos de edición simultánea.
- Commitear después de cada tarea o grupo lógico; detenerse en cada Checkpoint para validar la historia de forma independiente antes de seguir.
