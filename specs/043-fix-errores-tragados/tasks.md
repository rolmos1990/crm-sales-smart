---

description: "Task list — 043 fix errores tragados"
---

# Tasks: Las páginas dejan de esconder los fallos de lectura

**Input**: Design documents from `/specs/043-fix-errores-tragados/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/catches-permitidos.md, quickstart.md

**Tests**: El spec no pide TDD. Se genera **un** test nuevo (T037), el guardia estructural de D5, porque el riesgo de este hotfix es estructural y ningún test funcional puede observarlo. No se generan tests por historia: el comportamiento se valida con `quickstart.md`.

**Organization**: Una tarea por archivo. Casi todas son paralelizables porque no comparten archivo ni dependencia.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1, US2, US3, US4 — mapea a las historias de `spec.md`
- Todas las rutas son relativas a la raíz del repositorio

## Sin fases Setup ni Foundational

No las hay y no se inventan. El fix es sustractivo sobre archivos que ya existen: no hay inicialización de proyecto, dependencias nuevas, migraciones ni infraestructura previa que desbloquear. `docs/SPEC-KIT-WORKFLOWS.md` lo contempla para Hotfix; como este tiene cuatro direcciones independientes, se genera el `tasks.md` completo por historia (igual que `008`), pero sin las fases que no aportan nada.

## Patrón de cambio (aplica a todas las tareas de edición)

Ver `plan.md` § Patrón de cambio. En resumen:

1. Se elimina el `try/catch` (o el `.catch(...)` encadenado) **y** la variable `let` con valor inicial, que pasa a `const` con `await` directo.
2. Si hay guard: desaparece `process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder")` y la condición del `notFound()` queda en `if (!registro)`.
3. Si la página tenía una rama `!variable` para cubrir el fallo (por ejemplo `if (!inicial || inicial.total === 0)`), esa rama se elimina y queda solo la condición del vacío legítimo.

**No se toca**: los 4 bloques conservados más allá del aviso y el registro, los 2 de formateo de fecha, `construirCondicionVenta`, el `notFound()` legítimo, ni los estados vacíos legítimos.

---

## Phase 1: User Story 1 — Formularios que guardarían datos equivocados (Priority: P1) 🎯 MVP

**Goal**: Que ningún formulario de creación o edición se abra con valores por defecto provenientes de una lectura fallida. Es el único grupo que **persiste** datos equivocados.

**Independent Test**: Forzar el fallo de `obtenerConfiguracionEmpresa` y abrir "Nuevo pedido": debe dar pantalla de error, no un formulario con moneda por defecto. Entregable solo: arregla los 10 formularios sin tocar ninguna otra pantalla.

- [X] T001 [P] [US1] Eliminar el `try/catch` de la línea 34 en `src/app/crm/contactos/nuevo/page.tsx`; `empresas`, `tags` y `defaultCountryCode` pasan a derivarse directo del `await`, sin el fallback `"PA"`
- [X] T002 [P] [US1] Eliminar el `try/catch` de la línea 39 y el guard `placeholder` en `src/app/crm/contactos/[id]/editar/page.tsx`; dejar `if (!contacto) notFound()`
- [X] T003 [P] [US1] Eliminar el `try/catch` de la línea 47 en `src/app/crm/oportunidades/nueva/page.tsx`; `pipelines` deja de poder llegar vacío por fallo
- [X] T004 [P] [US1] Eliminar el `try/catch` de la línea 35 y el guard `placeholder` en `src/app/crm/oportunidades/[id]/editar/page.tsx`; dejar `if (!oportunidad) notFound()`
- [X] T005 [P] [US1] Eliminar el `try/catch` de la línea 41 en `src/app/crm/actividades/nueva/page.tsx`; los cinco selectores de vínculo pasan a cargarse sin red
- [X] T006 [P] [US1] Eliminar el `try/catch` de la línea 43 en `src/app/sales/cotizaciones/nueva/page.tsx`. **Conservar el de la línea 77** (prefill desde la oportunidad de origen) y agregarle el aviso de FR-007 con `EmptyState` más el `console.error` de FR-008
- [X] T007 [P] [US1] Eliminar el `try/catch` de la línea 41 en `src/app/sales/cotizaciones/[id]/editar/page.tsx`. Este archivo no tiene guard: el `if (!cotizacion) notFound()` ya está en su forma final y queda igual
- [X] T008 [P] [US1] Eliminar el `try/catch` de la línea 37 en `src/app/sales/pedidos/nuevo/page.tsx`; `monedaDefault`, `defaultCountryCode` y `filtroCatalogoInicial` dejan de degradar
- [X] T009 [P] [US1] Eliminar los dos `.catch(() => [])` de las líneas 17 y 18 en `src/app/productos/nuevo/page.tsx`. **No agregar un `.catch` a `obtenerMonedaPrincipal` (línea 16)**: ya propaga, y esa es la forma correcta
- [X] T010 [P] [US1] Eliminar los tres `.catch(...)` de las líneas 18, 19 y 20 y el guard `placeholder` en `src/app/productos/[id]/editar/page.tsx`; dejar `if (!producto) notFound()`. Es el caso más grave del hotfix: sin esto, un combo cuyos componentes no se leen se renderiza vacío y guardar el formulario persiste esa composición vacía
- [X] T011 [US1] Verificar la historia: `npm run build` en exit 0, y con `npm run dev` comprobar que los 10 formularios abren normalmente con la base sana y dan pantalla de error ante un fallo forzado (quickstart escenario 2, filas de formularios)

**Checkpoint**: ningún formulario puede persistir datos provenientes de una lectura fallida.

---

## Phase 2: User Story 2 — Registros que existen reportados como inexistentes (Priority: P1)

**Goal**: Que un fallo de lectura nunca produzca un 404 sobre un registro que sí existe.

**Independent Test**: Forzar el fallo de `obtenerContactoPorId` y abrir el detalle de un contacto existente: debe dar pantalla de error, no 404. Entregable solo.

**Nota**: los otros 3 guards `placeholder` ya se eliminaron en T002, T004 y T010.

- [X] T012 [P] [US2] Eliminar el `try/catch` de la línea 47 y el guard `placeholder` en `src/app/crm/contactos/[id]/page.tsx`; dejar `if (!contacto) notFound()` y eliminar también el fallback "Contacto no disponible", que era la rama inalcanzable del guard
- [X] T013 [P] [US2] Eliminar el `try/catch` de la línea 33 y el guard `placeholder` en `src/app/crm/empresas/[id]/page.tsx`; dejar `if (!empresa) notFound()`
- [X] T014 [P] [US2] Eliminar el `try/catch` de la línea 21 y el guard `placeholder` en `src/app/crm/empresas/[id]/editar/page.tsx`; dejar `if (!empresa) notFound()`
- [X] T015 [P] [US2] Eliminar el `try/catch` de la línea 53 y el guard `placeholder` en `src/app/crm/oportunidades/[id]/page.tsx`. **Conservar los de las líneas 76 y 98**: al de la 76 (conversaciones) agregarle el aviso de FR-007 y el `console.error` de FR-008; el de la 98 (formateo de fecha) queda intacto
- [X] T016 [P] [US2] Eliminar el `try/catch` de la línea 45 y el guard `placeholder` en `src/app/sales/cotizaciones/[id]/page.tsx`; dejar `if (!cotizacion) notFound()`
- [X] T017 [P] [US2] Eliminar el `try/catch` de la línea 80 y el guard `placeholder` en `src/app/sales/pedidos/[id]/page.tsx`. **Conservar el de la línea 49** (formateo de fecha), intacto
- [X] T018 [US2] Verificar la historia: un id inexistente sigue dando 404; un registro existente con lectura forzada a fallar da pantalla de error. Confirmar con `grep -rc 'includes("placeholder")' src/app` que el resultado es **0**

**Checkpoint**: el 404 solo aparece cuando el registro realmente no existe.

---

## Phase 3: User Story 3 — Números falsos (Priority: P2)

**Goal**: Que ningún total, KPI o contador se muestre calculado a partir de una lectura fallida, ni sustituido por cero.

**Independent Test**: Forzar el fallo de `obtenerFlujoVenta` y abrir el listado de pedidos: no debe mostrarse ningún total calculado con la regla legacy.

- [X] T019 [P] [US3] Eliminar el `try/catch` de la línea 78 en `src/app/crm/page.tsx`, que devuelve los seis KPIs en cero. **Conservar los de las líneas 105 y 126** (oportunidades recientes y actividades de hoy): a ambos agregarles el aviso de FR-007 con `EmptyState` y el `console.error` de FR-008
- [X] T020 [P] [US3] Eliminar los dos `try/catch` de las líneas 43 y 73 en `src/app/sales/pedidos/page.tsx`. El de la 43 es el que revierte 038 en silencio: sin él, `etapasFlujo = []` vuelve a significar solo "esta instancia no tiene flujo dinámico". **No tocar `src/sales/pedidos/condicion-venta.ts`** — su fallback legacy se conserva tal cual (FR-009)
- [X] T021 [US3] Verificar la historia con el escenario 4 del quickstart: con flujo dinámico, desmarcar la etapa `cuentaComoVenta` debe dar total 0; sin flujo dinámico, el total se sigue calculando por enum `estado`. Confirmar que `npm run test:unit` pasa, incluido el test dedicado de 038

**Checkpoint**: los números en pantalla son reales o no están.

---

## Phase 4: User Story 4 — Listas vacías creíbles (Priority: P3)

**Goal**: Que una lista vacía signifique siempre "no hay datos" y nunca "no se pudieron leer".

**Independent Test**: Forzar el fallo de la carga de contactos: la pantalla no debe ofrecer "Crear primer contacto". Entregable listado por listado.

- [X] T022 [P] [US4] Eliminar el `try/catch` de la línea 31 en `src/app/crm/contactos/page.tsx` y la rama `!inicial` de la condición del `EmptyState`, que pasa a ser solo `inicial.indicadores.total === 0`
- [X] T023 [P] [US4] Eliminar el `try/catch` de la línea 20 en `src/app/crm/empresas/page.tsx`
- [X] T024 [P] [US4] Eliminar el `try/catch` de la línea 20 en `src/app/crm/actividades/page.tsx`; el `if (actividades.length === 0)` que renderiza el `EmptyState` se conserva, porque ahora solo puede significar vacío legítimo
- [X] T025 [P] [US4] Eliminar el `try/catch` de la línea 15 en `src/app/crm/etiquetas/page.tsx`
- [X] T026 [P] [US4] Eliminar el `try/catch` de la línea 25 en `src/app/crm/inbox/page.tsx`; las tres cargas del `Promise.all` (conversaciones, cuentas, pendientes de IA) pasan a propagar
- [X] T027 [P] [US4] Eliminar el `try/catch` de la línea 70 en `src/app/crm/oportunidades/page.tsx`
- [X] T028 [P] [US4] Eliminar el `try/catch` de la línea 86 en `src/app/crm/pipeline/page.tsx`
- [X] T029 [P] [US4] Eliminar el `try/catch` de la línea 26 en `src/app/sales/cotizaciones/page.tsx`
- [X] T030 [P] [US4] Eliminar el `try/catch` de la línea 27 en `src/app/productos/page.tsx`
- [X] T031 [P] [US4] Eliminar el `try/catch` de la línea 23 en `src/app/datos/page.tsx`; sin esto, una importación puede entrar sin los campos personalizados del destino
- [X] T032 [P] [US4] Eliminar el `try/catch` de la línea 17 en `src/app/integraciones/page.tsx`; deja de presentarse el catálogo completo como "no instalado"
- [X] T033 [P] [US4] Eliminar el `try/catch` de la línea 89 en `src/app/integraciones/instagram/page.tsx`
- [X] T034 [P] [US4] Eliminar el `try/catch` de la línea 45 en `src/app/integraciones/facebook-messenger/page.tsx`
- [X] T035 [P] [US4] Eliminar el `try/catch` de la línea 45 en `src/app/integraciones/whatsapp-lite/page.tsx`
- [X] T036 [US4] Verificar la historia: con la base sana, todos los estados vacíos legítimos siguen apareciendo (quickstart escenario 1); con un fallo forzado, ninguna lista ofrece su llamada a la acción de "crear el primero"

**Checkpoint**: una lista vacía ya no puede confundirse con un fallo.

---

## Phase 5: Guardia y validación final

- [X] T037 Crear el test-guardia en `src/app/paginas-sin-catch.test.ts`, modelado sobre `src/worker/grafo-importaciones.test.ts`: recorre todos los `page.tsx` bajo `src/app` y falla si aparece un bloque que atrape un fallo de lectura fuera de la lista blanca de 6 de `contracts/catches-permitidos.md`. **Debe detectar las dos formas sintácticas** (`try { … } catch` y `.catch(...)` encadenado) e identificar cada entrada permitida por archivo y por una marca estable del código, nunca por número de línea. El encabezado del test debe explicar por qué existe, incluido que el inventario original se armó buscando una sola forma y se le escaparon 5 bloques
- [X] T038 Confirmar el recuento de control de SC-005 sobre el diff: **36 bloques eliminados, 4 conservados, 2 intactos = 42**, y `grep -rc 'includes("placeholder")' src/app` en **0**
- [ ] T039 ⚠️ PENDIENTE (requiere base de datos y navegador) — Ejecutar `quickstart.md` completo: los 5 escenarios y la lista de verificación final, prestando atención a que el escenario 2 (fallo parcial) se haga con el procedimiento correcto y no con la base caída, que no valida nada
- [~] T040 Cierre: `npm run build` ✅ exit 0 · `npm run test:unit` ✅ 2111/2111 · `npm run test:e2e` ⚠️ PENDIENTE (requiere servidor levantado y DB de prueba sembrada)

---

## Dependencies & Execution Order

### Phase Dependencies

Las cuatro historias son **independientes entre sí**: ninguna comparte archivo con otra y ninguna necesita que otra esté hecha. Pueden ejecutarse en cualquier orden, en paralelo, y cada una es desplegable sola.

El orden P1 → P3 propuesto es por daño, no por dependencia técnica:

1. **US1** primero: es la única que persiste datos equivocados
2. **US2**: la mentira afirmativa, la que dispara tickets
3. **US3**: números sobre los que se decide
4. **US4**: la más visible, pero de daño reversible

La Phase 5 sí depende de las cuatro: la lista blanca de T037 solo es estable cuando ya se sabe qué quedó, y T038 cuenta el diff completo.

### Archivos tocados por más de una historia

Ninguno. Cada archivo pertenece a una sola historia, incluso cuando contiene bloques de categorías distintas:

- `src/app/productos/[id]/editar/page.tsx` → **US1** completo (sus 3 `.catch`, aunque el de la línea 18 produzca el 404 falso)
- `src/app/sales/pedidos/page.tsx` → **US3** completo (sus 2 `try/catch`, aunque el de la línea 73 sea una lista vacía)

Se agruparon así a propósito: dos historias editando el mismo archivo romperían la independencia y la paralelización.

### Parallel Opportunities

- **T001–T010** (US1): las 10 en paralelo, archivos distintos
- **T012–T017** (US2): las 6 en paralelo
- **T019–T020** (US3): las 2 en paralelo
- **T022–T035** (US4): las 14 en paralelo
- Las cuatro historias completas, en paralelo entre sí

De 40 tareas, **32 son paralelizables**. Las 8 restantes son las verificaciones de cierre de cada historia (T011, T018, T021, T036) y la Phase 5 (T037–T040).

---

## Parallel Example: User Story 4

```bash
# Las 14 ediciones de listados no comparten archivo — todas a la vez:
Task: "Eliminar el try/catch de src/app/crm/contactos/page.tsx"
Task: "Eliminar el try/catch de src/app/crm/empresas/page.tsx"
Task: "Eliminar el try/catch de src/app/crm/inbox/page.tsx"
Task: "Eliminar el try/catch de src/app/productos/page.tsx"
# … y las otras 10
```

---

## Implementation Strategy

### MVP (solo US1)

1. T001–T010
2. T011 para validar
3. **PARAR Y VALIDAR**: ningún formulario puede guardar datos provenientes de una lectura fallida
4. Desplegable: corrige el único daño que persiste

### Entrega incremental

Cada historia se despliega sola y suma sin romper la anterior. El hotfix completo queda cerrado con la Phase 5, que es la que lo vuelve permanente: sin T037, nada impide que el patrón vuelva en seis meses.

---

## Notes

- **El riesgo de este hotfix es borrar de más**, no de menos. Siete archivos tienen más de un bloque y en cinco de ellos hay que conservar alguno. Las tareas los marcan en negrita; `contracts/catches-permitidos.md` es la lista cerrada.
- Las líneas citadas son del estado de `main` al 2026-11-19 y **se mueven al editar**. Dentro de un archivo, identificar el bloque por qué carga, no por su número de línea.
- Hasta que exista la Feature posterior, "pantalla de error" es la que trae Next.js por defecto. Es fea y está bien que lo sea: este hotfix solo deja de mentir.
- Commit por historia, no por archivo: el diff de una historia se lee como una unidad.

---

## Estado de cierre

| | |
|---|---|
| Tareas de edición (T001–T036) | ✅ completas |
| Test-guardia (T037) | ✅ creado y verificado: falla ante ambas formas, pasa limpio |
| Recuento (T038) | ✅ 42 → 4 bloques; 9 → 0 guards |
| `npm run build` | ✅ exit 0, 73 dinámicas / 10 estáticas (idéntico a antes) |
| `npm run test:unit` | ✅ 198 archivos, 2111 tests |
| `npx tsc --noEmit` sobre `src/app` | ✅ sin errores |
| `npm run test:e2e` | ⚠️ **no ejecutado** — necesita servidor en `localhost:3000` y DB de prueba sembrada |
| `quickstart.md` (T039) | ⚠️ **no ejecutado** — los escenarios 1 a 4 son manuales y requieren base de datos |

**Lo que no se validó**: el comportamiento real ante un fallo. Todo lo verificado acá es estructural (el código ya no puede tragar el error) y de no-regresión en compilación y tests unitarios. Que la pantalla resultante sea la correcta, y que ningún estado vacío legítimo haya desaparecido, se confirma con `quickstart.md` contra una base real.

El recuento final es **38 eliminados / 2 conservados / 2 intactos**, no 36/4/2: ver `plan.md` § Desviaciones.
