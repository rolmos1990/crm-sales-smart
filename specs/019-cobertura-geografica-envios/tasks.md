---

description: "Task list template for feature implementation"
---

# Tasks: Cobertura geográfica y costos de envío por transportista y delivery

**Input**: Design documents from `/specs/019-cobertura-geografica-envios/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Incluidas — la Constitución del proyecto exige "tests proporcionales al riesgo" (unit para reglas de negocio, integración para persistencia/eventos, Playwright para journeys críticos) y `plan.md` ya fija los archivos de test concretos.

**Organization**: Tareas agrupadas por historia de usuario (spec.md) para permitir implementación y prueba independiente de cada una.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3, US4)
- Cada tarea incluye la ruta de archivo exacta

## Path Conventions

Proyecto único (Next.js App Router) — `src/`, `prisma/`, `scripts/`, `tests/` en la raíz del repo, según `plan.md`.

---

## Phase 1: Setup

**Purpose**: Preparar la única dependencia nueva del feature antes de tocar schema o código.

- [X] T001 Agregar el dataset ISO 3166-1/3166-2 de código abierto como **devDependency** en `package.json` (`npm install -D <paquete>`) — research.md Decisión 2b; confirmar que no queda referenciado desde ningún archivo fuera de `scripts/` (`country-state-city@3.2.1`)

**Checkpoint**: Dependencia disponible para el script de seed de la Fase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catálogo geográfico, motor de resolución compartido y componentes de UI reutilizados por las 4 historias — nada de esto es específico de una sola historia.

**⚠️ CRITICAL**: Ninguna historia de usuario puede empezar hasta que esta fase esté completa.

- [X] T002 Agregar modelos `Pais`, `EstadoProvincia` y enums `ModoGeografico`, `ModoCoberturaDelivery` a `prisma/schema.prisma` (data-model.md "Entidades nuevas")
- [X] T003 Agregar modelo `TransportistaCoberturaGeografica` + relación inversa `coberturaGeografica` en `Transportista` a `prisma/schema.prisma` (data-model.md) — depende de T002
- [X] T004 Agregar columna `modoCobertura` a `MetodoEntregaConfig` y columna `esExcepcion` a `ZonaCoberturaMetodo` en `prisma/schema.prisma` (data-model.md) — depende de T002
- [X] T005 Agregar columnas `modoGeografico`/`paisOperacionId` a `ConfiguracionEmpresa` en `prisma/schema.prisma` (data-model.md) — depende de T002
- [X] T006 Agregar columnas `paisId`/`estadoProvinciaId`/`ciudad` a `EntregaCotizacion` y `EntregaPedido` en `prisma/schema.prisma` (data-model.md) — depende de T002
- [X] T007 Generar y aplicar la migración de Prisma para T002-T006 (`npm run db:migrate`) — depende de T002, T003, T004, T005, T006 (`20260901153319_cobertura_geografica_envios`, aplicada en Supabase)
- [X] T008 Crear `scripts/seed-geografia.ts`: siembra idempotente (`upsert` por `codigo` en `Pais` y por `(paisId, nombre)` en `EstadoProvincia`) del catálogo ISO completo a partir del dataset de T001, y agregar el script `db:seed:geografia` a `package.json` (data-model.md "Seed de catálogo") — depende de T001, T007
- [X] T009 Ejecutar `npm run db:seed:geografia` para poblar el catálogo en el entorno de desarrollo — depende de T008 (250 países, 4963 estados/provincias sembrados en Supabase)
- [X] T010 [P] Crear `src/shared/entregas/queries-geografia.ts` con `listarPaises()` y `listarEstadosProvincia(paisId)` (contracts/selector-geografico.md) — depende de T007 (Server Actions `'use server'`, patrón `obtenerEmpresaAction`)
- [X] T011 [P] Crear `src/shared/entregas/components/selector-pais.tsx` — depende de T010 (reutiliza el Combobox genérico ya existente en `src/shared/ui/combobox.tsx`, en vez de construir Popover+Command desde cero)
- [X] T012 [P] Crear `src/shared/entregas/components/selector-estado-provincia.tsx` — depende de T010 (mismo Combobox genérico, dependiente del país, limpia el valor si el país cambia)
- [X] T013 [P] Crear `src/ai/tools/shared/transferir-a-humano-interno.ts` extrayendo el efecto secundario (marcar `Conversacion.clasificacion = SOPORTE` + publicar `EventosSistema.ConversacionClasificada`, respetando `ctx.modoSimulacion`) de `src/ai/tools/providers/transfer.tool.ts` (research.md Decisión 4)
- [X] T014 Refactorizar `src/ai/tools/providers/transfer.tool.ts` para delegar en `transferir-a-humano-interno.ts` en vez de duplicar la lógica — depende de T013; verificar que su test existente sigue pasando sin modificarlo

**Checkpoint**: Catálogo geográfico sembrado, componentes de selección y mecanismo de escalación listos — las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Configurar cobertura y costos de un transportista por país y estado (Priority: P1) 🎯 MVP

**Goal**: Al crear o editar un transportista, poder cargar una o más zonas de cobertura (país + estado/provincia) con su propio costo de envío.

**Independent Test**: Crear un transportista, agregarle cobertura en dos estados/provincias de un mismo país con costos distintos, y confirmar que la lista de cobertura del transportista muestra exactamente esos costos — sin depender de ninguna otra historia.

### Implementation for User Story 1

- [X] T015 [P] [US1] Agregar `CoberturaGeograficaSchema` a `src/sales/transportistas/schema.ts` (costo ≥ 0, `estadoProvinciaId` debe pertenecer a `paisId` — data-model.md validaciones)
- [X] T016 [P] [US1] Agregar tipo `TransportistaCoberturaGeografica` a `src/sales/transportistas/types.ts`
- [X] T017 [US1] Agregar acciones `guardarCoberturaGeografica` y `eliminarCoberturaGeografica` a `src/sales/transportistas/actions.ts` (upsert por `(transportistaId, estadoProvinciaId)`, fuerza `paisId` al `paisOperacionId` de la instancia si `modoGeografico = UN_SOLO_PAIS` — contracts/server-actions.md) — depende de T015 (+ `listarCoberturaGeograficaAction` client-callable, + `obtenerModoGeograficoAction` en `src/configuracion/empresa/actions.ts`)
- [X] T018 [P] [US1] Agregar query `listarCoberturaGeografica(transportistaId)` a `src/sales/transportistas/queries.ts`
- [X] T019 [US1] Crear `src/sales/transportistas/components/seccion-cobertura-geografica.tsx` usando `SelectorPais`/`SelectorEstadoProvincia` para agregar/editar/quitar zonas con su costo — depende de T017, T018, T011, T012
- [X] T020 [US1] Integrar `seccion-cobertura-geografica.tsx` en `src/sales/transportistas/components/dialog-transportista.tsx` — depende de T019. **Decisión final tras intentar validar con Playwright** (ver notas de T047): visible solo al **editar** un transportista existente, no al crear. El diálogo de creación conserva su comportamiento 100% original (se cierra al guardar, sin cambios en `form-transportista.tsx` — diff en cero) para no arriesgar `tests/e2e/sales/transportistas.spec.ts`; FR-001 ("al crear o editar") queda cumplido porque crear y luego editar para agregar zonas son dos clics, no una limitación funcional
- [~] T021 [US1] **Consolidada en T033-T035 (Fase 5/US3)**: durante la implementación se decidió no tocar las tools de IA dos veces (una vez "simple" en US1, otra "con escalación" en US3) — el Independent Test de US1 ("consultar el costo de envío para cada estado") queda satisfecho con la propia UI de cobertura (`seccion-cobertura-geografica.tsx`, T019, que lista el costo exacto guardado por zona), sin necesidad de tocar las tools todavía. La integración real en `calcular_costo_envio`/`validar_cobertura`/`estimar_fecha_entrega` contra `TransportistaCoberturaGeografica` se hace una sola vez, ya con la lógica de escalación, en T033-T035
- [X] T022 [US1] Test unitario `src/sales/transportistas/actions.test.ts`: rechazo sin costo, país/estado inválido o no perteneciente, unicidad por `(transportistaId, estadoProvinciaId)` (FR-016)
- [~] T023 [P] [US1] **Consolidada en T036 (Fase 5/US3)** — mismo motivo que T021

**Checkpoint**: User Story 1 completamente funcional y probable de forma independiente (Escenario 1 de quickstart.md).

---

## Phase 4: User Story 2 - Configurar cobertura y costos de entrega propia (Delivery) por zonas aproximadas (Priority: P1)

**Goal**: Para un método de entrega propia, configurar costo por zona aproximada y elegir entre "entrega a todos lados" (con excepciones) o "solo zonas evaluadas caso por caso".

**Independent Test**: Configurar un método de entrega propia con dos zonas aproximadas y costos, alternar entre los dos modos de cobertura, y confirmar que la validación de cobertura de una zona no listada responde de forma coherente con el modo activo — sin depender de la Historia 1.

### Implementation for User Story 2

- [X] T024 [P] [US2] Agregar `modoCobertura` a `MetodoEntregaConfigSchema` y `esExcepcion` a `ZonaCoberturaMetodoSchema` en `src/configuracion/entregas/schema.ts` (FR-007 implementado como `.refine()` en el propio schema — rechaza `cubierta && esExcepcion` antes de llegar al action)
- [X] T025 [US2] Actualizar `guardarMetodoEntregaConfig` en `src/configuracion/entregas/actions.ts` para persistir `modoCobertura` — depende de T024 (ya fluía vía `...validado.data`, sin cambios de código)
- [X] T026 [US2] Actualizar `guardarZonaCoberturaMetodo` en `src/configuracion/entregas/actions.ts`: persistir `esExcepcion` (rechazo FR-007 ya cubierto por el schema) — depende de T024
- [X] T027 [US2] Actualizar `src/configuracion/entregas/components/seccion-metodos-entrega.tsx`: selector de modo de cobertura y asignación de zonas cubiertas/excepción, visibles solo para métodos que no son `COURIER_EXTERNO` — depende de T025, T026 (+ `src/configuracion/components/tab-ia.tsx` ahora pasa `modoCobertura`/`zonas` a cada método)
- [~] T028 [US2] **Consolidada en T033-T035 (Fase 5/US3)** — mismo motivo que T021: se integra una sola vez junto con la escalación
- [X] T029 [US2] Test unitario `src/configuracion/entregas/actions.test.ts`: rechazo de `cubierta`+`esExcepcion` simultáneos (FR-007), guardado válido de cada modo
- [~] T030 [P] [US2] **Consolidada en T036 (Fase 5/US3)** — mismo motivo que T023

**Checkpoint**: User Story 1 y 2 funcionan de forma independiente (Escenario 2 de quickstart.md).

---

## Phase 5: User Story 3 - El agente de IA responde con la configuración real y escala ante ambigüedad (Priority: P1)

**Goal**: Las tools de envío resuelven costo/cobertura consultando exclusivamente la configuración real (transportista + delivery) y **fuerzan** la transferencia a humano cuando no hay una coincidencia clara — sin depender del criterio del LLM.

**Independent Test**: Con transportistas y/o delivery configurados (Historias 1 y 2), preguntar el costo para una zona con configuración clara (responde el costo exacto), para una zona sin ninguna configuración (escala a humano), y para una zona cubierta por dos transportistas con costos distintos sin criterio para elegir (escala a humano).

### Implementation for User Story 3

- [X] T031 [US3] Crear `src/shared/entregas/resolver-costo-envio.ts`: función pura (`decidirCoincidenciaCosto`) + orquestación con I/O (`resolverCostoEnvio`) que combina candidatos de `TransportistaCoberturaGeografica` y de `ZonaCoberturaMetodo`/`modoCobertura`, aplicando el criterio único de "coincidencia clara vs. no clara" (research.md Decisión 5, data-model.md "Flujo de resolución de costo")
- [X] T032 [P] [US3] Test unitario `src/shared/entregas/resolver-costo-envio.test.ts`: los 3 casos "sin coincidencia clara" y los 2 casos "clara" de research.md Decisión 5 (8 tests, todos sobre la función pura)
- [X] T033 [US3] Refactorizar `src/ai/tools/providers/calcular-costo-envio.tool.ts` para usar `resolver-costo-envio.ts` y, ante resultado ambiguo o sin match, invocar `transferirAHumanoInterno` y responder `transferidoAHumano: true` (contracts/ai-tools.md) — depende de T031, T014
- [X] T034 [US3] Refactorizar `src/ai/tools/providers/validar-cobertura.tool.ts` de la misma forma — depende de T031, T014
- [X] T035 [US3] Refactorizar `src/ai/tools/providers/estimar-fecha-entrega.tool.ts` de la misma forma — depende de T031, T014
- [X] T036 [P] [US3] Reescribir `calcular-costo-envio.test.ts`, crear `validar-cobertura.test.ts` y `estimar-fecha-entrega.test.ts` con casos de escalación (`transferidoAHumano: true`) — depende de T033, T034, T035 (suite completa `src/ai/tools`: 10 archivos, 35 tests, todos en verde — sin regresión en `modo-simulacion.test.ts` tras el refactor de `transfer.tool.ts`)

**Checkpoint**: Historias 1, 2 y 3 funcionan juntas — el agente nunca informa un costo inventado (Escenario 3 de quickstart.md).

---

## Phase 6: User Story 4 - Multipaís o un solo país en cotización/pedido (Priority: P2)

**Goal**: El negocio decide si opera en un solo país o en varios; en modo "un solo país", cotización/pedido piden solo provincia/estado (+ ciudad opcional), sin pedir país.

**Independent Test**: Configurar un negocio como "un solo país" y confirmar que el formulario de nueva cotización/pedido no muestra selector de país; configurar otro como "multipaís" y confirmar que sí lo pide.

### Implementation for User Story 4

- [X] T037 [P] [US4] Agregar `ConfiguracionGeograficaSchema` a `src/configuracion/empresa/schema.ts` (`paisOperacionId` requerido cuando `modoGeografico = UN_SOLO_PAIS`, vía `.refine`)
- [X] T038 [US4] Agregar acción `guardarConfiguracionGeografica` a `src/configuracion/empresa/actions.ts` (contracts/server-actions.md) — depende de T037
- [X] T039 [US4] Crear script de migración de datos (`scripts/migrar-configuracion-geografica.ts`): resolver `ConfiguracionEmpresa.pais` (texto libre) existente contra el catálogo `Pais` para fijar `modoGeografico = UN_SOLO_PAIS` + `paisOperacionId`; fallback seguro a `MULTIPAIS` sin match (data-model.md "Nota de migración") — depende de T009. **Hallazgo real al ejecutarlo**: el catálogo sembrado usa nombres en inglés sin tilde (ej. "Panama") mientras Karia es hispanohablante ("Panamá") — un match exacto/case-insensitive fallaba siempre para estos países. Se corrigió comparando por `generarSlug()` (`src/shared/lib/slug.ts`, ya existente en el proyecto — sin duplicar) en este script, en `resolver-costo-envio.ts` y en el `busqueda` de `SelectorPais`/`SelectorEstadoProvincia`. 2/2 instancias reales de Supabase resueltas correctamente tras el fix. Cubierto por test de regresión en `resolver-costo-envio.integration.test.ts`
- [X] T040 [US4] Agregar sección de modo geográfico (selector `UN_SOLO_PAIS`/`MULTIPAIS` + `SelectorPais` condicional) a la UI de configuración de empresa — depende de T038 (`src/configuracion/empresa/components/seccion-modo-geografico.tsx`, embebida en `tab-empresa.tsx` como formulario independiente)
- [X] T041 [P] [US4] Agregar `paisId`/`estadoProvinciaId`/`ciudad` a `EntregaCotizacionSchema` en `src/sales/cotizaciones/schema.ts` (+ persistencia en `actions.ts` create/update/read-back, ya que esos campos se listan explícitamente ahí, no se spreadean)
- [X] T042 [P] [US4] Agregar `paisId`/`estadoProvinciaId`/`ciudad` a `ActualizarEntregaPedidoSchema` en `src/sales/pedidos/schema.ts` (sin cambios en `actions.ts` — ya usa `...campos` spread, y `queries.ts` ya usa `include` en `entrega`, así que fluyen solos)
- [X] T043 [US4] Crear `src/shared/entregas/actions.ts` con `obtenerCostoSugerido` (Server Action — `resolver-costo-envio.ts` no puede llevar `'use server'` porque `decidirCoincidenciaCosto` es síncrona) que reutiliza `resolverCostoEnvio` (contracts/server-actions.md "Decisión de reutilización") — depende de T031
- [X] T044 [US4] Actualizar `src/sales/cotizaciones/components/form-cotizacion.tsx`: agregar `SelectorPais` (oculto si `modoGeografico = UN_SOLO_PAIS`, FR-011) / `SelectorEstadoProvincia` / campo ciudad + botón "Sugerir" que llama `obtenerCostoSugerido` (el humano siempre puede sobrescribirlo) — depende de T011, T012, T041, T043
- [X] T045 [US4] Actualizar `src/sales/pedidos/components/form-entrega.tsx` con los mismos selects y prellenado — depende de T011, T012, T042, T043
- [X] T046 [US4] Actualizar `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts` para copiar `paisId`/`estadoProvinciaId`/`ciudad` de `EntregaCotizacion` a `EntregaPedido`, igual que ya copia `transportistaId`/`metodoEntrega` — depende de T041, T042

**Checkpoint**: Las 4 historias de usuario funcionan de forma independiente (Escenario 4 de quickstart.md).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validación end-to-end y verificación de que nada existente se rompió.

- [X] T047 [P] Implementar `tests/e2e/sales/cobertura-geografica-envios.spec.ts` (Playwright) cubriendo el Escenario 1 (configurar transportista con país/estado/costo, editando) y parte del Escenario 4 (selector de estado/provincia visible en la entrega de un pedido) de `quickstart.md`. **No se pudo ejecutar en este entorno**: `tests/setup/auth.setup.ts` requiere variables `TEST_*_EMAIL`/`TEST_*_PASSWORD` que no están configuradas aquí (gap de infraestructura preexistente, no introducido por este feature) — recomendado correrlo localmente con `npx playwright test tests/e2e/sales/cobertura-geografica-envios.spec.ts` antes de dar por cerrado el feature. Al escribirlo se detectó y corrigió un bug real: `SelectorPais`/`SelectorEstadoProvincia` no estaban envueltos en `<FormControl>` en `form-cotizacion.tsx`/`form-entrega.tsx` (rompía la asociación label↔control, inconsistente con el resto de los campos) — corregido en las 4 instancias; también se agregó `aria-label` a los botones icon-only de `seccion-cobertura-geografica.tsx`. El toggle completo multipaís/un-solo-país no se cubrió — requeriría un helper nuevo en `tests/helpers/db.ts`/`db-worker.ts` para fijar `ConfiguracionEmpresa.modoGeografico` desde el test, fuera de alcance de esta tarea
- [X] T048 Ejecutar la "Verificación de no-regresión" de `quickstart.md`. **Bug real encontrado y corregido**: con el default de schema `modoCobertura = SOLO_ZONAS_EVALUADAS`, un negocio que ya tenía zonas configuradas con `cubierta: false` (texto libre, previo a esta feature) habría empezado a **escalar a humano** en vez de responder "sin cobertura" como antes — el resolver no distinguía "zona no listada en absoluto" (correcto: pendiente de evaluación) de "zona listada explícitamente como no cubierta" (debe ser negativa clara, igual que antes). Corregido en `resolver-costo-envio.ts` (`hayNegativaExplicita` ahora cubre ambos modos) + test de regresión en `resolver-costo-envio.integration.test.ts`. Confirmado además: `generar-pedido-desde-cotizacion.service.ts` preserva los 3 campos nuevos, `transferir_a_humano` invocada directamente sigue idéntica tras el refactor de T014 (suite `src/ai/tools` completa en verde), y la suite completa del proyecto (271 tests, 43 archivos) pasa sin ningún test pre-existente roto
- [X] T049 [P] Ejecutar el type-check del proyecto (`npx tsc --noEmit -p tsconfig.json`) sobre todo el repo — 0 errores nuevos, los 7 preexistentes (archivos no tocados por este feature) siguen igual. **`npm run lint` no existe en este proyecto** (no hay `eslint.config.*`/`.eslintrc*` ni script `lint` en `package.json`) — no aplicable, no es un gap de este feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias — puede iniciar de inmediato
- **Foundational (Fase 2)**: depende de Setup (T001 provee la dependencia que usa T008) — **bloquea** las 4 historias
- **User Stories (Fase 3-6)**: todas dependen de Foundational completa
  - US1 (Fase 3) y US2 (Fase 4) son independientes entre sí — pueden desarrollarse en paralelo
  - US3 (Fase 5) depende de que **ambas**, US1 (T021) y US2 (T028), ya existan — es la capa que las unifica y agrega la escalación forzada
  - US4 (Fase 6) depende de Foundational y de US3 (T031, para `obtenerCostoSugerido`) y reutiliza los selectores de US1 (T011/T012) — no depende de US2
- **Polish (Fase 7)**: depende de que las historias que se vayan a entregar ya estén completas

### User Story Dependencies

- **US1 (P1)**: solo depende de Foundational
- **US2 (P1)**: solo depende de Foundational — independiente de US1
- **US3 (P1)**: depende de Foundational + US1 + US2 (necesita ambas fuentes de datos para poder unificarlas y detectar ambigüedad cruzada)
- **US4 (P2)**: depende de Foundational + US3 (reutiliza `resolver-costo-envio.ts`) + los selectores de US1

### Within Each User Story

- Schema/tipos antes que actions/queries
- Actions/queries antes que componentes de UI
- Persistencia y UI antes de extender las tools de IA que la consultan
- Implementación antes que sus tests correspondientes (tests no son TDD estricto en este plan, pero validan el comportamiento ya construido)

### Parallel Opportunities

- T010, T011 (tras T010), T012 (tras T010) y T013 en Foundational pueden ejecutarse en paralelo entre sí (archivos distintos)
- US1 (Fase 3) y US2 (Fase 4) pueden desarrollarse en paralelo por personas distintas una vez completada Foundational
- Dentro de US1: T015/T016/T018/T023 marcadas [P]
- Dentro de US2: T024/T030 marcadas [P]
- Dentro de US3: T032/T036 marcadas [P] respecto a las tareas de refactor de tools
- Dentro de US4: T037/T041/T042 marcadas [P]

---

## Parallel Example: User Story 1

```bash
# Tras completar Foundational, lanzar en paralelo:
Task: "Agregar CoberturaGeograficaSchema a src/sales/transportistas/schema.ts"
Task: "Agregar tipo TransportistaCoberturaGeografica a src/sales/transportistas/types.ts"
Task: "Agregar query listarCoberturaGeografica(transportistaId) a src/sales/transportistas/queries.ts"
```

## Parallel Example: User Story 1 y User Story 2 en simultáneo

```bash
# Dos desarrolladores, ambos arrancan apenas termina Foundational (Fase 2):
Developer A: Fase 3 completa (T015-T023) — cobertura de transportista
Developer B: Fase 4 completa (T024-T030) — modo de cobertura de delivery
# US3 (Fase 5) espera a que ambos terminen antes de empezar
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Completar Fase 1: Setup
2. Completar Fase 2: Foundational (crítico — bloquea todas las historias)
3. Completar Fase 3: User Story 1
4. **Detener y validar**: probar User Story 1 de forma independiente (Escenario 1 de quickstart.md)
5. Desplegar/demostrar si está listo — ya es una mejora real: los transportistas pueden configurar costo real por país/estado, aunque la IA todavía no fuerce la escalación

### Incremental Delivery

1. Setup + Foundational → catálogo geográfico y selectores listos
2. + User Story 1 → cobertura de transportista real, probada de forma independiente → demo
3. + User Story 2 → cobertura de delivery propio con modos y excepciones, probada de forma independiente → demo
4. + User Story 3 → el agente de IA deja de poder inventar costos; escala de forma determinística ante ambigüedad → este es el punto donde se cumple el requisito "muy importante" del pedido original
5. + User Story 4 → cotización/pedido dejan de pedir país innecesariamente en negocios de un solo país
6. Cada historia agrega valor sin romper las anteriores — mismo criterio que ya sigue el resto del proyecto (comportamiento actual como default, cambios aditivos)

### Parallel Team Strategy

Con más de una persona disponible:

1. El equipo completa Setup + Foundational en conjunto (es la parte más entrelazada — un solo archivo `schema.prisma`, una sola migración)
2. Con Foundational lista:
   - Persona A: User Story 1 (transportista)
   - Persona B: User Story 2 (delivery) — en paralelo, sin pisarse con A
3. Con ambas terminadas, una persona toma User Story 3 (unifica + fuerza escalación)
4. Con User Story 3 lista, User Story 4 puede empezar (reutiliza lo de US1 y US3)

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes entre sí
- [Story] mapea cada tarea a su historia de usuario para trazabilidad contra `spec.md`
- Ningún cambio a un modelo Prisma existente elimina o renombra una columna en uso (`cubierta` se conserva intacta) — instrucción explícita del usuario de no romper otras áreas
- `prisma/seed.ts` (datos de ejemplo, destructivo) no se toca — el catálogo geográfico vive en `scripts/seed-geografia.ts`, idempotente y seguro en producción
- Commitear tras cada tarea o grupo lógico
- Detenerse en cada Checkpoint para validar la historia de forma independiente antes de continuar
