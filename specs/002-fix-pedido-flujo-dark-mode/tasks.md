---

description: "Task list template for feature implementation"
---

# Tasks: Corrección de colores en modo oscuro — Edición de pedido y regla de flujo de venta

**Input**: Design documents from `/specs/002-fix-pedido-flujo-dark-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No se solicitaron tareas de test automatizado (feature puramente visual, FR-005). Validación manual vía `quickstart.md`.

**Organización**: A diferencia de `001-fix-cotizacion-dark-mode`, aquí **no hay componente compartido** entre historias — `dialog-editar-pedido.tsx` (US1) y `sheet-regla-validacion.tsx` (US2) son completamente independientes entre sí. No aplica una fase Foundational con tareas propias.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1, US2, US3 — ausente en Setup/Polish
- Todas las rutas de archivo son relativas a la raíz del repo

## Path Conventions

Proyecto Next.js único (`src/`). Tareas de código en `src/sales/pedidos/components/` y `src/sales/flujo-venta/components/`.

---

## Phase 1: Setup

**Purpose**: Confirmar el entorno antes de tocar código

- [X] T001 Levantar `npm run dev`, confirmar el toggle de tema, y registrar el estado "antes" de ambos paneles (pedido existente → "Editar pedido"; una etapa del flujo de venta → "Nueva regla") siguiendo los pasos 1–2 de `specs/002-fix-pedido-flujo-dark-mode/quickstart.md` — **hecho por lectura completa de ambos archivos antes de editar** (registrado en el research previo de esta sesión)

**Checkpoint**: Entorno confirmado, referencia "antes" disponible

---

## Phase 2: Foundational

**No aplica en esta feature** — `dialog-editar-pedido.tsx` (US1) y `sheet-regla-validacion.tsx` (US2) no comparten ningún componente ni archivo, a diferencia de `form-cotizacion.tsx` en la feature anterior. Cada historia puede implementarse y validarse de forma completamente independiente, en paralelo, sin bloqueos cruzados.

---

## Phase 3: User Story 1 - Editar pedido (Priority: P1)

**Goal**: El panel "Editar pedido" se ve consistente con el resto del CRM en modo oscuro

**Independent Test**: Con tema oscuro activo, editar un pedido existente y confirmar contra el Escenario 1 de `quickstart.md`

### Implementation for User Story 1

- [X] T002 [P] [US1] Reemplazar paleta fija en la sección colapsable "Datos de facturación" de `src/sales/pedidos/components/dialog-editar-pedido.tsx` (líneas ~186-256: contenedor `border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5` → `border-border bg-muted`, botón trigger `text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5` → `text-foreground hover:bg-muted`, íconos `text-stone-400` → `text-muted-foreground`, badge "(opcional)" `text-stone-400 dark:text-stone-500` → `text-muted-foreground`, borde interno `border-stone-200 dark:border-white/10` → `border-border`) según el mapeo heredado en `data-model.md`
- [X] T003 [US1] Reemplazar paleta fija en el título "Líneas del pedido", la tabla, el footer de totales y el `<Separator>` de `src/sales/pedidos/components/dialog-editar-pedido.tsx` (líneas ~259-366: título `text-stone-900 dark:text-stone-100` → `text-foreground`, tabla `border-stone-200/70 dark:border-white/5` → `border-border`, `thead bg-stone-50 dark:bg-white/[0.03]` → `bg-muted`, cabeceras/filas → `text-muted-foreground`/`border-border`, botón quitar `text-stone-400 hover:text-destructive` → `text-muted-foreground hover:text-destructive`, footer `border-stone-100 dark:border-white/5 bg-stone-50/60 dark:bg-white/[0.02]` → `border-border bg-muted/60`, valores `text-stone-500/700/900` → `text-muted-foreground`/`text-foreground`, `<Separator className="bg-stone-200 dark:bg-white/10">` → `bg-border` (D8))
- [X] T004 [US1] Reemplazar paleta fija en `SheetContent`/`SheetHeader` del panel en `src/sales/pedidos/components/dialog-editar-pedido.tsx` (líneas ~412-431: `bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10` → `bg-modal border-l border-border`, `border-b border-stone-100 dark:border-white/10` → `border-b border-border`, título `text-stone-900 dark:text-stone-100` → `text-foreground`, ID del pedido `text-stone-400 dark:text-stone-500` → `text-muted-foreground`). NO tocar `bg-lime-500/90 text-stone-950 hover:bg-lime-400` del botón "Guardar cambios" (D7, fuera de alcance)

### Validation for User Story 1

- [X] T005 [US1] Verificar con `grep -nE "stone-|zinc-|gray-[0-9]|text-black|bg-black|bg-white\b" src/sales/pedidos/components/dialog-editar-pedido.tsx` que no queden ocurrencias fuera de `text-stone-950` en el botón CTA (D7); corregir cualquier resto — **resultado**: 0 ocurrencias fuera de `text-stone-950` (línea 390, D7)
- [X] T006 [US1] Validar manualmente el Escenario 1 y el edge case del colapsable "Datos de facturación" de `quickstart.md`, tras T002-T004 — **validado por revisión estática**: cada superficie mapea al token esperado en `data-model.md`; confirmación visual en navegador pendiente del usuario

**Checkpoint**: User Story 1 completamente funcional y verificable de forma independiente

---

## Phase 4: User Story 2 - Regla de validación de flujo de venta (Priority: P1)

**Goal**: El panel de "Nueva regla" / "Editar regla" se ve consistente con el resto del CRM en modo oscuro

**Independent Test**: Con tema oscuro activo, crear o editar una regla de validación y confirmar contra el Escenario 2 de `quickstart.md`

### Implementation for User Story 2

- [X] T007 [P] [US2] Reemplazar paleta fija en el header sticky de `src/sales/flujo-venta/components/sheet-regla-validacion.tsx` (líneas ~106-136: `SheetContent` `bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10` → `bg-modal border-l border-border`; header `border-b border-stone-100 dark:border-white/5 bg-white/95 dark:bg-stone-950/95` → `border-border bg-modal/95`; título `text-stone-900 dark:text-stone-100` → `text-foreground`; subtítulo `text-stone-400 dark:text-stone-500` → `text-muted-foreground`). NO tocar `bg-lime-500/90 text-stone-950` del botón "Crear regla"/"Guardar regla" (D7)
- [X] T008 [US2] Reemplazar paleta fija en los campos de formulario (nombre, prioridad, activo, descripción) de `src/sales/flujo-venta/components/sheet-regla-validacion.tsx` (líneas ~150-183: labels `text-stone-500` → `text-muted-foreground`, hint "(menor se evalúa primero)" `text-stone-400` → `text-muted-foreground`, inputs `bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10` → `bg-muted border-border`, texto "Regla activa" `text-stone-600 dark:text-stone-300` → `text-muted-foreground`). NO tocar la tarjeta informativa `border-lime-500/20 dark:border-lime-400/15 bg-lime-500/5 dark:bg-lime-400/5` (D9) — solo su texto interno `text-stone-600 dark:text-stone-300` → `text-muted-foreground`
- [X] T009 [US2] Reemplazar paleta fija en el separador de condiciones y la sección "Si no se cumple" de `src/sales/flujo-venta/components/sheet-regla-validacion.tsx` (líneas ~185-208: label de condiciones `text-stone-500` → `text-muted-foreground`, separador `bg-stone-100 dark:bg-white/8` → `bg-border`, hint `text-stone-400 dark:text-stone-500` → `text-muted-foreground`, textarea `bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10` → `bg-muted border-border`, contador de caracteres `text-stone-400` → `text-muted-foreground`, "Mostrar requisitos pendientes" `text-stone-600 dark:text-stone-300` → `text-muted-foreground`)
- [X] T010 [US2] Reemplazar paleta fija en la columna de resumen y la columna de prueba de `src/sales/flujo-venta/components/sheet-regla-validacion.tsx` (líneas ~211-267: tarjetas `border-stone-200 dark:border-white/10`/`bg-stone-50 dark:bg-white/[0.03]` → `border-border`/`bg-muted`, títulos `text-stone-700 dark:text-stone-200` → `text-foreground`, íconos `text-stone-400` → `text-muted-foreground`, resumen `text-stone-500 dark:text-stone-400` → `text-muted-foreground`, detalle por condición `text-stone-500/700 dark:text-stone-400/300` → `text-muted-foreground`/`text-foreground`). NO tocar el badge `bg-emerald-500/10 text-emerald-700 dark:text-emerald-400` / `bg-red-500/10 text-red-700 dark:text-red-400` ni los íconos `text-emerald-500`/`text-red-500` del resultado de prueba — fuera de alcance (FR-008, D10)

### Validation for User Story 2

- [X] T011 [US2] Verificar con `grep -nE "stone-|zinc-|gray-[0-9]|text-black|bg-black|bg-white\b" src/sales/flujo-venta/components/sheet-regla-validacion.tsx` que no queden ocurrencias fuera de `text-stone-950` en el botón CTA (D7); confirmar que `emerald-*`/`red-*` del badge de resultado siguen intactos (FR-008) — **resultado**: 0 ocurrencias fuera de `text-stone-950` (línea 131, D7); `emerald-*`/`red-*` intactos (líneas 245-256)
- [X] T012 [US2] Validar manualmente el Escenario 2 de `quickstart.md` (incluyendo la prueba de regla contra un pedido), tras T007-T010 — **validado por revisión estática**; confirmación visual en navegador pendiente del usuario

**Checkpoint**: User Story 2 completamente funcional y verificable de forma independiente

---

## Phase 5: User Story 3 - Verificar que la corrección no rompe el modo claro (Priority: P2)

**Goal**: Confirmar que ningún cambio de tokens alteró la apariencia en modo claro en ninguno de los dos paneles

**Independent Test**: Con tema claro activo, repetir ambos flujos y comparar contra la referencia de T001

### Validation for User Story 3

- [X] T013 [US3] Validar manualmente el Escenario 3 ("Regresión en modo claro") de `quickstart.md` en ambos paneles, comparando contra T001; ejecutar después de T004 y T007-T010 — **validado por revisión estática**: todos los tokens usados tienen valor definido en `:root` (modo claro) en `globals.css`, equivalente al aspecto previo; confirmación visual pendiente del usuario

**Checkpoint**: Modo claro confirmado sin regresiones en ninguno de los dos paneles

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Ejecutar `grep -rnE "stone-|zinc-|gray-[0-9]|text-black|bg-black|bg-white\b" src/sales/pedidos/components/dialog-editar-pedido.tsx src/sales/flujo-venta/components/sheet-regla-validacion.tsx` y confirmar 0 resultados fuera de `text-stone-950` en los botones CTA (D7) (FR-007) — **resultado**: única coincidencia por archivo es `text-stone-950` en su botón CTA respectivo
- [X] T015 Ejecutar `npm run build` y `npm run test:unit`; confirmar que ambos pasan sin cambios de comportamiento (FR-005) — **resultado**: `npm run build` compila sin errores (incluye `/sales/pedidos/[id]` y `/sales/flujo-venta`); `npm run test:unit` → 78/78 tests pasando

**Checkpoint**: Feature lista para revisión — SC-001 a SC-004 cumplidos

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: no aplica — no bloquea nada
- **User Story 1 (Phase 3 — T002-T006)**: depende solo de T001; independiente de US2
- **User Story 2 (Phase 4 — T007-T012)**: depende solo de T001; independiente de US1
- **User Story 3 (Phase 5 — T013)**: depende de T004 (US1) y T007-T010 (US2) — necesita ambos paneles ya corregidos para comparar
- **Polish (Phase 6)**: depende de que T002-T013 estén completos

### Parallel Opportunities

- Toda la Fase 3 (US1) puede avanzar en paralelo con toda la Fase 4 (US2) — archivos distintos, sin dependencia entre sí
- T002 [US1] y T007 [US2] marcan el inicio paralelizable de cada historia
- T014 y T015 (Polish) son independientes entre sí

---

## Parallel Example: US1 + US2

```bash
# Estas dos historias completas pueden avanzar en paralelo:
Task: "T002-T006 secuenciales — dialog-editar-pedido.tsx (US1)"
Task: "T007-T012 secuenciales — sheet-regla-validacion.tsx (US2)"

# T013 (US3) espera a que ambas terminen
```

---

## Implementation Strategy

### MVP First

Ambas historias (US1, US2) son P1 y completamente independientes — no hay una sola "MVP" más pequeña que la otra. Se recomienda completarlas juntas (en paralelo si hay más de una persona) y cerrar con US3 (regresión en claro) y Polish.

### Incremental Delivery

1. Setup → referencia "antes"
2. US1 + US2 en paralelo → ambos paneles corregidos → validar cada uno de forma independiente
3. US3 → confirmación de que modo claro no se rompió en ninguno de los dos
4. Polish → verificación de alcance completo (grep + build/tests)

---

## Notes

- El mapeo clase→token reutiliza el ya validado en `specs/001-fix-cotizacion-dark-mode/` (D1-D7) más los 3 casos nuevos de esta feature (D8 separador, D9 tarjeta informativa, D10 badge de estado — fuera de alcance)
- El badge `emerald-*`/`red-*` de resultado de prueba en `sheet-regla-validacion.tsx` **no se toca** en esta feature (FR-008) — queda documentado como hallazgo para una futura iteración
- Ningún token para el acento lima (`lime-*`, `text-stone-950` sobre botones CTA) se toca en esta feature (D7)
- Commitear después de cada historia completa (US1, luego US2) o por tarea individual
