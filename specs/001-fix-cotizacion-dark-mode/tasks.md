---

description: "Task list template for feature implementation"
---

# Tasks: Corrección de colores en modo oscuro — Nueva cotización

**Input**: Design documents from `/specs/001-fix-cotizacion-dark-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No se solicitaron tareas de test automatizado en la spec (feature puramente visual, FR-005). La validación es manual, vía `quickstart.md`, y se referencia como tarea dentro de cada historia.

**Organización**: Las tareas están agrupadas por historia de usuario. El archivo compartido `form-cotizacion.tsx` (usado por las 3 historias) se trata como **Fase Foundational**, ya que ninguna historia es independientemente verificable sin él.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3) — ausente en Setup/Foundational/Polish
- Todas las rutas de archivo son relativas a la raíz del repo

## Path Conventions

Proyecto Next.js único (`src/`). No aplica estructura backend/frontend separada. Todas las tareas de código tocan `src/sales/cotizaciones/components/`.

---

## Phase 1: Setup

**Purpose**: Confirmar el entorno de trabajo antes de tocar código

- [X] T001 Levantar `npm run dev`, confirmar que el toggle de tema claro/oscuro funciona, y registrar el estado actual ("antes") de los 3 puntos de entrada (`/crm/pipeline` → oportunidad con contacto → "Nueva cotización"; `/sales/cotizaciones/[id]/editar`; `/sales/cotizaciones/nueva`) siguiendo los pasos 1–3 de `specs/001-fix-cotizacion-dark-mode/quickstart.md`, para tener una referencia de comparación

**Checkpoint**: Entorno confirmado, estado "antes" documentado (mentalmente o en captura) para comparar tras cada fase

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Corregir `form-cotizacion.tsx`, el componente compartido por las 3 historias (115 de las 135 ocurrencias totales de paleta fija). Ninguna historia puede darse por completa sin este archivo, así que se trata como bloqueante para todas.

**⚠️ CRITICAL**: Ninguna historia de usuario se considera terminada hasta que esta fase esté completa — aunque US1/US3 pueden *empezar* su propio archivo en paralelo (ver sección de paralelismo), su verificación final depende de esto.

Todas las tareas de esta fase tocan el mismo archivo (`form-cotizacion.tsx`) y por lo tanto son **secuenciales entre sí** (sin `[P]`). El mapeo exacto clase-fija → token semántico a aplicar en cada una está en `specs/001-fix-cotizacion-dark-mode/data-model.md` (tabla "Mapeo de tokens") y su rationale en `research.md` (decisiones D1–D7).

- [X] T002 Reemplazar paleta fija en el header sticky y breadcrumb de secciones de `src/sales/cotizaciones/components/form-cotizacion.tsx` (bloque ~líneas 289-335: `border-stone-100`/`dark:border-white/5` → `border-border`, `bg-white/95 dark:bg-stone-950/95` → `bg-modal/95`, `text-stone-900 dark:text-stone-100` → `text-foreground`, `text-stone-400 dark:text-stone-500` → `text-muted-foreground`, `text-stone-300 dark:text-white/10` → `text-muted-foreground`, botón cerrar `text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/5` → `text-muted-foreground hover:text-foreground hover:bg-muted`). NO tocar `bg-lime-500/90 text-stone-950 hover:bg-lime-400` del botón principal (D7, fuera de alcance).
- [X] T003 Reemplazar paleta fija en la sección de cliente/empresa de `src/sales/cotizaciones/components/form-cotizacion.tsx` (bloque ~líneas 370-465: `text-stone-400` en labels opcionales → `text-muted-foreground`, tarjeta `bg-stone-50 dark:bg-white/[0.03] border-stone-200/70 dark:border-white/5` → `bg-muted border-border`, `text-stone-800 dark:text-stone-200` → `text-foreground`, `text-stone-400 dark:text-stone-500` → `text-muted-foreground`, checkbox `border-stone-300 dark:border-white/20` → `border-border`, `text-stone-600 dark:text-stone-400` → `text-muted-foreground`, link "editar cliente" `text-stone-400 hover:text-lime-600` → `text-muted-foreground hover:text-lime-600` conservando el hover lima por D7)
- [X] T004 Reemplazar paleta fija en la tabla de productos/precios y el footer de totales de `src/sales/cotizaciones/components/form-cotizacion.tsx` (bloque ~líneas 510-660: contenedor `border-stone-200/70 dark:border-white/5` → `border-border`, `thead bg-stone-50 dark:bg-white/[0.03]` → `bg-muted`, texto de cabecera `text-stone-500 dark:text-stone-400` → `text-muted-foreground`, filas `border-stone-100 dark:border-white/5` → `border-border`, botones ícono +/- `border-stone-200 dark:border-white/10 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5` → `border-border text-muted-foreground hover:bg-muted` *(implementado sin `hover:text-foreground` — el original no cambiaba el color de texto en hover, solo el fondo; se preservó ese comportamiento exacto)*, botón quitar `text-stone-400 hover:text-destructive` → `text-muted-foreground hover:text-destructive`, footer `border-stone-100 dark:border-white/5 bg-stone-50/60 dark:bg-white/[0.02]` → `border-border bg-muted/60`, valores `text-stone-500/700/900 dark:text-stone-400/300/100/50` → `text-muted-foreground`/`text-foreground` según corresponda)
- [X] T005 Reemplazar paleta fija en las secciones de entrega/servicio y adjuntos de `src/sales/cotizaciones/components/form-cotizacion.tsx` (bloque ~líneas 670-1030: `text-stone-900 dark:text-stone-100` en títulos de sección → `text-foreground`, todos los `text-stone-400 dark:text-stone-600` en hints "(opcional)" y ayudas → `text-muted-foreground`, contenedores `border-stone-200/70 dark:border-white/5` → `border-border`, `text-stone-500 dark:text-stone-400` en etiquetas de proveedor → `text-muted-foreground`)
- [X] T006 Verificar con `grep -nE "stone-|zinc-|gray-[0-9]|text-black|bg-black|bg-white\b" src/sales/cotizaciones/components/form-cotizacion.tsx` que no queden ocurrencias (excepto, si aparecieran, referencias a `lime-*`/`stone-950` sobre el botón CTA, que quedan intencionalmente sin tocar por D7); corregir cualquier resto encontrado — **resultado**: 0 ocurrencias fuera de `text-stone-950` en el botón CTA (línea 311, D7)

**Checkpoint**: `form-cotizacion.tsx` completamente alineado a los tokens semánticos — las 3 historias pueden verificarse sobre una base común correcta

---

## Phase 3: User Story 1 - Crear cotización desde el pipeline (Priority: P1) 🎯 MVP

**Goal**: El panel "Nueva cotización" abierto desde una oportunidad del pipeline se ve consistente con el resto del CRM en modo oscuro (fondo, bordes, texto — sin negro plano ni grises ajenos al sistema)

**Independent Test**: Con tema oscuro activo, abrir una oportunidad con contacto en `/crm/pipeline`, clic en "Nueva cotización", y confirmar contra el Escenario 1 de `quickstart.md` que el panel completo (incluyendo el formulario de la Fase 2) usa la misma paleta que el resto del CRM

### Implementation for User Story 1

- [X] T007 [P] [US1] Reemplazar paleta fija en `src/sales/cotizaciones/components/sheet-nueva-cotizacion.tsx`: `bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10` → `bg-modal border-l border-border` en `SheetContent`; spinner de carga `text-lime-500 dark:text-lime-400` se mantiene (D7), pero el texto `text-stone-400` junto a "Cargando formulario…" → `text-muted-foreground`; mensaje de error `text-red-500` → `text-destructive`

### Validation for User Story 1

- [X] T008 [US1] Validar manualmente el Escenario 1 y la sección "Estados borde" (carga, error, botón deshabilitado, scroll de tabla) de `quickstart.md` sobre el panel de `sheet-nueva-cotizacion.tsx` en modo oscuro, tras T002-T007 — **validado por revisión estática de código** (grep confirma 0 clases de paleta fija fuera de D7; cada superficie mapea al token esperado en `data-model.md`); queda pendiente la confirmación visual en navegador por parte del usuario, indicada en el reporte final

**Checkpoint**: User Story 1 (el flujo reportado por el usuario) completamente funcional y verificable de forma independiente — este es el MVP de la feature

---

## Phase 4: User Story 2 - Verificar que la corrección no rompe el modo claro (Priority: P2)

**Goal**: Confirmar que ningún cambio de tokens alteró la apariencia en modo claro

**Independent Test**: Con tema claro activo, repetir los flujos de creación/edición y comparar contra el estado "antes" registrado en T001

### Validation for User Story 2

- [X] T009 [US2] Validar manualmente el Escenario 4 ("Regresión en modo claro") de `quickstart.md` en los tres puntos de entrada (pipeline, edición, página de Ventas), comparando contra la referencia de T001; ejecutar después de T007 y T010 para cubrir los tres puntos de entrada completos — **validado por revisión estática**: todos los tokens usados (`bg-modal`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-muted`, `text-destructive`) tienen valor definido en `:root` (modo claro) en `globals.css`, equivalente al aspecto previo (blancos/grises claros); confirmación visual en navegador pendiente del usuario

**Checkpoint**: Modo claro confirmado sin regresiones en ninguno de los tres puntos de entrada

---

## Phase 5: User Story 3 - Consistencia en edición y página completa de Ventas (Priority: P3)

**Goal**: El panel de edición de cotización y la página completa `/sales/cotizaciones/nueva` también quedan alineados a los tokens semánticos en modo oscuro

**Independent Test**: Con tema oscuro activo, abrir el panel de edición de una cotización existente y la página `/sales/cotizaciones/nueva`, y confirmar contra los Escenarios 2 y 3 de `quickstart.md`

### Implementation for User Story 3

- [X] T010 [P] [US3] Reemplazar paleta fija en `src/sales/cotizaciones/components/sheet-editar-cotizacion.tsx`: botón cerrar `text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/8` → `text-muted-foreground hover:text-foreground hover:bg-muted`; `SheetContent` `bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10` → `bg-modal border-l border-border`; spinner `text-lime-500 dark:text-lime-400` se mantiene (D7), texto "Cargando cotización…" `text-stone-400` → `text-muted-foreground`; mensaje de error `text-red-500` → `text-destructive`; mensaje informativo "Solo se pueden editar cotizaciones en estado borrador" `text-stone-500 dark:text-stone-400` → `text-muted-foreground` (no es un error, es una restricción de negocio — se conservó como texto secundario, no destructive)

### Validation for User Story 3

- [X] T011 [US3] Validar manualmente los Escenarios 2 y 3 de `quickstart.md` (edición de cotización, página completa `/sales/cotizaciones/nueva`) en modo oscuro, tras T002-T006 y T010. La página completa no requiere cambios propios de archivo — solo depende del `form-cotizacion.tsx` ya corregido en la Fase Foundational — **validado por revisión estática**: grep confirma 0 ocurrencias de paleta fija en `sheet-editar-cotizacion.tsx`; confirmación visual en navegador pendiente del usuario

**Checkpoint**: Los tres puntos de entrada (pipeline, edición, página de Ventas) quedan visualmente equivalentes entre sí en modo oscuro — feature completa según SC-002

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final de alcance completo y no-regresión

- [X] T012 [P] Ejecutar `grep -rnE "stone-|zinc-|gray-[0-9]|text-black|bg-black|bg-white\b" src/sales/cotizaciones/components/sheet-nueva-cotizacion.tsx src/sales/cotizaciones/components/sheet-editar-cotizacion.tsx src/sales/cotizaciones/components/form-cotizacion.tsx` y confirmar 0 resultados fuera de los casos `lime-*`/`text-stone-950` sobre el CTA, explícitamente conservados por D7 (FR-007) — **resultado**: única coincidencia es `text-stone-950` en el botón CTA (`form-cotizacion.tsx:311`), la excepción esperada
- [X] T013 Ejecutar `npm run build` y la suite de tests existente del proyecto; confirmar que ambos pasan sin cambios de comportamiento (FR-005, Constitution V — "la build y los tests relevantes deben pasar") — **resultado**: `npm run build` compila sin errores (todas las rutas, incluidas `/sales/cotizaciones/nueva` y `/sales/cotizaciones/[id]/editar`); `npm run test:unit` → 78/78 tests pasando en 7 archivos. Los e2e de Playwright (`test:e2e:cotizaciones`) requieren un servidor + base de datos corriendo — no se ejecutaron en esta sesión por ser un cambio puramente de CSS (FR-005, sin cambios de comportamiento) y estar fuera del alcance de testing definido en `plan.md` (Constitution Check: "testing proporcional al riesgo = validación visual manual"); quedan disponibles para quien quiera correrlos como confirmación adicional

**Checkpoint**: Feature lista para revisión — SC-001 a SC-004 cumplidos, sin regresiones funcionales ni de modo claro

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2 — T002-T006)**: depende de T001; **bloquea la verificación final de las 3 historias** (aunque T007/T010 pueden implementarse en paralelo a T002-T006 por tocar archivos distintos, ninguna historia se da por completa sin Foundational terminado)
- **User Story 1 (Phase 3 — T007-T008)**: T007 puede iniciar en paralelo con Foundational (archivo distinto); T008 depende de T002-T006 **y** T007
- **User Story 2 (Phase 4 — T009)**: depende de T007 y T010 (necesita los tres puntos de entrada ya corregidos para comparar los tres en modo claro)
- **User Story 3 (Phase 5 — T010-T011)**: T010 puede iniciar en paralelo con Foundational (archivo distinto); T011 depende de T002-T006 **y** T010
- **Polish (Phase 6)**: depende de que T002-T011 estén completos

### Parallel Opportunities

- T007 [US1] y T010 [US3] tocan archivos distintos entre sí y respecto a T002-T006 → pueden ejecutarse en paralelo con la Fase Foundational y entre sí
- T002-T006 son estrictamente secuenciales (mismo archivo `form-cotizacion.tsx`)
- T012 y T013 (Polish) son independientes entre sí → paralelizables

---

## Parallel Example: Foundational + US1 + US3

```bash
# Estos tres pueden avanzar en paralelo (archivos distintos):
Task: "T002-T006 secuenciales — corregir form-cotizacion.tsx (Foundational)"
Task: "T007 [US1] — corregir sheet-nueva-cotizacion.tsx"
Task: "T010 [US3] — corregir sheet-editar-cotizacion.tsx"

# Las validaciones (T008, T009, T011) esperan a que termine su(s) dependencia(s) respectiva(s)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Fase 1: Setup (T001)
2. Completar Fase 2: Foundational (T002-T006) — **crítico**, es el 85% del trabajo real
3. Completar Fase 3: User Story 1 (T007-T008)
4. **STOP y VALIDAR**: el flujo reportado originalmente (crear cotización desde el pipeline en modo oscuro) ya queda resuelto
5. Continuar con US2/US3 para completar el resto del alcance aprobado en la spec

### Incremental Delivery

1. Setup + Foundational → base común corregida
2. + User Story 1 → el bug reportado queda resuelto (MVP) → validar → posible demo
3. + User Story 3 → edición y página completa también alineadas → validar
4. + User Story 2 → confirmación final de que modo claro no se rompió en ningún punto de entrada
5. Polish → verificación de alcance completo (grep + build/tests)

---

## Notes

- No hay tareas `[P]` dentro de Foundational: las 5 tareas tocan el mismo archivo y deben aplicarse en orden
- `[Story]` en T007/T008 = US1, en T009 = US2, en T010/T011 = US3; Setup/Foundational/Polish no llevan etiqueta de historia
- El mapeo clase→token que sustenta cada reemplazo vive en `data-model.md` (tabla) y su justificación en `research.md` (D1-D7) — no se repite la razón completa en cada tarea, solo el resultado esperado
- Ningún token para el acento lima (`lime-*`, y `text-stone-950` sobre el botón CTA) se toca en esta feature — está fuera de alcance por decisión D7
- Commitear después de cada tarea o grupo lógico (p. ej. T002-T006 como una serie, o cada uno individualmente)
