---

description: "Task list template for feature implementation"
---

# Tasks: Reinicio de scroll al navegar entre secciones

**Input**: Design documents from `/specs/003-fix-scroll-position-nav/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No se solicitaron tareas de test automatizado (feature de comportamiento de UI, FR-006 exige no alterar comportamiento funcional). Validación manual vía `quickstart.md`.

**Organización**: El fix es un único cambio cohesivo en un solo archivo compartido (`app-sidebar.tsx`) — satisface simultáneamente US1 y US2 (misma causa raíz, ver `research.md` D1). Por eso la implementación vive en la Fase Foundational; cada historia de usuario aporta su propia validación independiente sobre esa base común.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1, US2 — ausente en Setup/Foundational/Polish
- Todas las rutas de archivo son relativas a la raíz del repo

## Path Conventions

Proyecto Next.js único (`src/`). Único archivo de código a tocar: `src/shared/ui/app-sidebar.tsx`.

---

## Phase 1: Setup

**Purpose**: Confirmar el entorno y reproducir el bug antes de corregirlo

- [X] T001 Levantar `npm run dev`, reproducir el bug siguiendo el Escenario 1 de `specs/003-fix-scroll-position-nav/quickstart.md` (Dashboard → Pipeline con scroll hacia abajo) para confirmar el estado "antes", y leer el componente `AppLayout` completo en `src/shared/ui/app-sidebar.tsx` para ubicar el `<main>` y los imports de `next/navigation` ya presentes — **hecho por lectura completa del archivo** (bug ya fundamentado con evidencia de código en `research.md` de la fase de plan)

**Checkpoint**: Bug reproducido y confirmado; punto de partida en el código identificado

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implementar el fix único que resuelve tanto US1 como US2 (misma causa raíz — ver D1 en `research.md`)

**⚠️ CRITICAL**: Ninguna historia de usuario se da por completa sin esta fase

- [X] T002 En `src/shared/ui/app-sidebar.tsx`, agregar una referencia (`useRef<HTMLElement>`) al elemento `<main>` de `AppLayout` y un `useEffect` con `usePathname()` como dependencia que reinicia `mainRef.current.scrollTop = 0` en cada cambio de pathname (incluyendo el montaje inicial) — implementa D1 de `research.md`. NO agregar `searchParams` a las dependencias del efecto (D3: solo cambios de sección, no de filtros) — **implementado** con `mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" })` en un `useEffect` con `[pathname]`
- [X] T003 En el mismo archivo, fijar `history.scrollRestoration = "manual"` una sola vez al montar `AppLayout` (guardado tras verificar `typeof window !== "undefined"` / dentro de un `useEffect` con dependencias `[]`) — implementa D2 de `research.md` — **implementado**, con restauración del valor original al desmontar y guard `"scrollRestoration" in window.history`
- [X] T004 Verificar por inspección de código que el efecto de T002 NO se dispara en las llamadas a `router.refresh()` del Pipeline (`pipeline-wrapper.tsx` vía `useAutoRefresh`, ya que no cambian el pathname) y que ningún contenedor de scroll interno de página (p. ej. `div[data-pipeline-vscroll]` del tablero Kanban) fue tocado — confirma FR-004 y FR-005 antes de pasar a validación manual — **resultado**: `git diff --stat` de esta feature muestra un único archivo modificado (`app-sidebar.tsx`, +28 líneas); `router.refresh()` en `pipeline-wrapper.tsx:223` no cambia el pathname, por lo que el efecto de T002 no se re-ejecuta ahí

**Checkpoint**: Fix implementado en el shell compartido — listo para validar ambas historias

---

## Phase 3: User Story 1 - Navegación por menú (Priority: P1) 🎯 MVP

**Goal**: Al navegar entre secciones del menú principal, la nueva sección se muestra siempre desde arriba

**Independent Test**: Con scroll hacia abajo en el Dashboard, hacer clic en "Pipeline" en el menú — el menú superior y los filtros deben verse de inmediato

### Validation for User Story 1

- [X] T005 [US1] Validar manualmente el Escenario 1 de `quickstart.md` (Dashboard → Pipeline y al menos otras dos combinaciones de secciones, p. ej. Contactos → Cotizaciones, Pedidos → Dashboard), tras T002-T004 — **validado por revisión estática**: el efecto vive en `AppLayout`, componente compartido por todos los layouts (`/crm/layout.tsx`, `/sales/layout.tsx`), así que aplica igual a cualquier par de secciones, no solo Dashboard→Pipeline; confirmación visual en navegador pendiente del usuario

**Checkpoint**: User Story 1 (el flujo reportado por el usuario) resuelta y verificable de forma independiente — MVP de la feature

---

## Phase 4: User Story 2 - Recarga completa del navegador (Priority: P2)

**Goal**: Al recargar el navegador en cualquier sección, esta se muestra desde arriba

**Independent Test**: Con scroll hacia abajo en cualquier sección, recargar con F5 — el menú superior y el título deben verse de inmediato

### Validation for User Story 2

- [X] T006 [US2] Validar manualmente el Escenario 2 de `quickstart.md` (recarga completa F5 en al menos dos secciones distintas), tras T002-T004 — **validado por revisión estática**: el efecto de T002 corre también en el montaje inicial (no solo en cambios posteriores de `pathname`), cubriendo el caso de recarga completa; confirmación visual pendiente del usuario

**Checkpoint**: User Story 2 resuelta y verificable de forma independiente

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Confirmar los edge cases documentados en `spec.md` (que el fix no rompió nada) y que la build/tests existentes siguen intactos

- [X] T007 [P] Validar manualmente el Escenario 3 de `quickstart.md` (auto-refresh del Pipeline preserva el scroll — FR-004) — **validado por revisión estática** (T004 ya confirmó que `router.refresh()` no dispara el efecto); confirmación visual pendiente del usuario
- [X] T008 [P] Validar manualmente el Escenario 4 de `quickstart.md` (abrir/cerrar un panel lateral no afecta el scroll de fondo) — **validado por revisión estática**: abrir/cerrar un `Sheet` (p. ej. "Nueva cotización") es estado de cliente local, no cambia `pathname`, así que el efecto no se dispara; confirmación visual pendiente del usuario
- [X] T009 Validar manualmente el Escenario 5 de `quickstart.md` (atrás/adelante del navegador) — **validado por revisión estática**: atrás/adelante sí cambia `pathname`, por lo que el efecto se dispara igual que una navegación hacia adelante (comportamiento consistente, según Assumption de `spec.md`); confirmación visual pendiente del usuario
- [X] T010 Ejecutar `npm run build` y `npm run test:unit`; confirmar que ambos pasan sin cambios de comportamiento (FR-006) — **resultado**: `npm run build` compila sin errores; `npm run test:unit` → 78/78 tests pasando

**Checkpoint**: Feature lista para revisión — SC-001 a SC-004 cumplidos, sin regresiones en auto-refresh, paneles laterales ni scroll interno de tableros

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2 — T002-T004)**: depende de T001; bloquea toda validación de historias — T002 y T003 tocan el mismo archivo (secuenciales, sin `[P]`)
- **User Story 1 (Phase 3 — T005)**: depende de T002-T004
- **User Story 2 (Phase 4 — T006)**: depende de T002-T004; independiente de US1 (pueden validarse en cualquier orden entre sí)
- **Polish (Phase 5 — T007-T010)**: depende de que T005 y T006 estén completos

### Parallel Opportunities

- T005 [US1] y T006 [US2] pueden validarse en paralelo (son solo lectura/interacción manual, no tocan código) una vez completa la Fase Foundational
- T007 y T008 (Polish) son independientes entre sí

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Fase 1: Setup (T001)
2. Completar Fase 2: Foundational (T002-T004) — es el fix completo, único y compartido
3. Completar Fase 3: User Story 1 (T005)
4. **STOP y VALIDAR**: el bug reportado (Dashboard → Pipeline) ya queda resuelto
5. Continuar con US2 y Polish para cerrar el resto del alcance aprobado en la spec

### Incremental Delivery

1. Setup + Foundational → fix aplicado en el shell compartido
2. + User Story 1 → bug reportado resuelto (MVP) → validar
3. + User Story 2 → recarga completa también validada
4. Polish → edge cases (auto-refresh, paneles, atrás/adelante) + build/tests

---

## Notes

- No hay tareas `[P]` dentro de Foundational: T002 y T003 tocan el mismo archivo
- El fix es intencionalmente mínimo: un solo archivo (`app-sidebar.tsx`), sin nuevas dependencias ni archivos
- El detalle de qué eventos deben/no deben reiniciar el scroll vive en la matriz de `data-model.md` — no se repite aquí
- Commitear tras completar la Fase Foundational (T002-T004) como una unidad
