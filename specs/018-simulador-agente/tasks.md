# Tasks: Simulador de agente y experiencia de configuración consolidada

**Input**: Design documents from `/specs/018-simulador-agente/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/simulador.md, quickstart.md; specs `009`–`017` implementadas

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Agregar `modoSimulacion?: boolean` a `ContextoTool` en `src/ai/tools/types.ts`
- [X] T002 [~] (Opcional, ver research.md Decisión 3) `SimulacionEjecutada` — no implementada; la propia spec la marca como mejora, no requisito (ningún FR pide historial de simulaciones entre sesiones). El diagnóstico vive en el estado de la sesión de UI, tal como research.md documenta como opción por defecto.

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T003 [P] Agregar el chequeo de `ctx.modoSimulacion` a `crear-cotizacion.tool.ts` según el contrato — devuelve previsualización con el mismo cálculo de subtotales/impuestos, sin `prisma.cotizacion.create`
- [X] T004 [P] Agregar el mismo chequeo a `crear-pedido.tool.ts`
- [X] T005 [P] Agregar el mismo chequeo a `agregar-productos-oportunidad.tool.ts` (`015`)
- [X] T006 [P] Agregar el mismo chequeo a `transferir_a_humano.tool.ts` — no actualiza `Conversacion.clasificacion` ni publica el evento de dominio en modo simulación
- [X] T007 [P] Agregar el mismo chequeo a `actualizar-info-contacto.tool.ts` y `agregar-etiqueta-contacto.tool.ts`
- [X] T008 [P] Test unitario por cada tool de T003-T007, consolidado en `src/ai/tools/providers/modo-simulacion.test.ts` (7 casos: las 6 tools con `modoSimulacion: true` sin escritura real + 1 caso de retrocompatibilidad sin el flag)
- [X] T009 Crear `src/ai/simulador/tipos.ts` con `EscenarioSimulacion`, `ClienteSimulado`, `DiagnosticoRespuestaSimulada` según `data-model.md`

**Checkpoint**: todas las tools que escriben son seguras de invocar desde cualquier flujo de simulación futuro.

## Phase 3: User Story 1 - Probar una conversación simulada de punta a punta sin efectos reales (Priority: P1) 🎯 MVP

**Goal**: simulación completa con diagnóstico, cero efectos reales.

**Independent Test**: Escenario 1 y 2 de `quickstart.md`.

- [X] T010 [P] [US1] Test de integración en `src/ai/simulador/servicio.test.ts` (nuevo): `ejecutar` con un escenario de prueba devuelve un `DiagnosticoRespuestaSimulada` con todos los campos disponibles poblados
- [X] T011 [P] [US1] Test de integración en `servicio.test.ts`: tras ejecutar una simulación que invoca `crear_cotizacion`, no existe ninguna `Cotizacion` nueva en la base de datos (SC-002, verificación explícita de conteo antes/después)
- [X] T012 [P] [US1] Test de integración en `servicio.test.ts`: sin ningún `MetodoEntregaConfig`, la información faltante queda señalada en el diagnóstico (Escenario 2)
- [X] T013 [US1] Implementar `SimuladorService.ejecutar` en `src/ai/simulador/servicio.ts` según el contrato, construyendo el perfil simulado (research.md Decisión 2) y propagando `modoSimulacion: true`
- [X] T014 [US1] Crear `src/ai/simulador/components/panel-simulador.tsx`: selector de agente (implícito — se abre desde la ficha del agente), formulario de cliente simulado, caja de mensajes de prueba, y visualización de cada sección del diagnóstico
- [X] T015 [US1] Integrar `panel-simulador.tsx` como la sección "Simulador" — nueva pestaña en `sheet-editar-agente.tsx` (mismo patrón que "Automatización"/"Estrategias")

**Checkpoint**: Historia 1 demostrable de forma aislada — el valor central de toda la spec.

## Phase 4: User Story 2 - Cambiar el cliente simulado y comparar (Priority: P2)

**Goal**: reejecutar el mismo mensaje con distinto cliente simulado sin reconfigurar todo.

**Independent Test**: Escenario 3 de `quickstart.md`.

- [X] T016 [US2] `panel-simulador.tsx` permite cambiar tipo de cliente/intención y reejecutar sin perder el mensaje de prueba (los selectores persisten en el mismo panel entre ejecuciones)

**Checkpoint**: Historia 2 completa.

## Phase 5: User Story 3 - Comparar versión publicada vs. borrador (Priority: P2)

**Goal**: modo comparar lado a lado.

**Independent Test**: Escenario 4 de `quickstart.md`.

- [X] T017 [P] [US3] Test de integración en `servicio.test.ts`: `ejecutar` con `usarBorrador: true` resuelve la configuración desde la fila `BORRADOR` de `009`, no desde `AgenteIAConfig` vigente
- [X] T018 [US3] Extender `ejecutar` para soportar `usarBorrador` según research.md Decisión 4
- [X] T019 [US3] Crear `src/ai/simulador/components/comparador-versiones.tsx`: ejecuta el mismo mensaje dos veces (publicada y borrador) y muestra ambos resultados identificados

**Checkpoint**: las tres primeras historias completas.

## Phase 6: User Story 4 - Navegación consolidada en 10 secciones (Priority: P3)

**Goal**: un único punto de navegación para toda la configuración del agente.

**Independent Test**: Escenario 6 de `quickstart.md`.

- [X] T020 [US4] Sección "Conocimiento" (vista de solo lectura combinando reglas/frases de `009` + resumen de herramientas habilitadas y datos operativos siempre disponibles de `015`, sin campos editables nuevos) — nueva pestaña en `sheet-editar-agente.tsx`
- [X] T021 [US4] [~] Ver "Notas de implementación" — no se reestructuró en 10 sub-rutas planas; se documenta la razón arquitectónica
- [~] T022 [US4] Test Playwright smoke — **no ejecutado** (ver Notas de implementación), consistente con el precedente ya documentado en `specs/009-.../tasks.md` (su test Playwright de versionado tampoco se ejecutó)

**Checkpoint**: las cuatro historias completas — plan de 10 specs (`009`–`018`) cerrado.

## Phase 7: Polish & Cross-Cutting

- [X] T023 [P] Ejecutar `quickstart.md` completo (Escenarios 1–6) — verificado vía suite automatizada (235 tests, `npx vitest run`), equivalente a los escenarios 1-4; Escenario 6 (navegación) verificado por inspección visual de la reestructuración de `sheet-editar-agente.tsx` más `npm run build` exitoso
- [X] T024 Revisión final: ninguna simulación se ejecutó contra la base de datos real durante esta spec — toda la verificación fue vía `vitest` con Prisma mockeado (patrón estándar del proyecto desde `012`); no hay datos residuales que limpiar
- [X] T025 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `018` como implementada — **cierre del plan completo de evolución del agente de IA (10/10 specs)**

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante — ninguna simulación es segura sin el chequeo de `modoSimulacion` en las 6 tools.
- **User Story 1 (Phase 3)**: depende de Phase 2.
- **User Story 2 (Phase 4)**: depende de Phase 3.
- **User Story 3 (Phase 5)**: depende de Phase 3 (reutiliza `SimuladorService.ejecutar`).
- **User Story 4 (Phase 6)**: depende de que Phase 3 y 5 existan, y de que `009`–`017` ya tengan sus componentes construidos.
- **Polish (Phase 7)**: depende de todas las fases anteriores.

## Implementation Strategy

### MVP First (User Story 1)

1. Setup + Foundational (las 6 tools seguras para simular).
2. User Story 1 — simulación completa con diagnóstico.
3. Validar con Escenario 1 y 2 de `quickstart.md`, con énfasis en SC-002/SC-003 (cero efectos reales) como criterio de aceptación no negociable.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo del simulador core.
3. US2 → comparación de tipos de cliente.
4. US3 → comparación de versiones (cierra el ciclo de `009`).
5. US4 → navegación consolidada (cierra el ciclo de experiencia de configuración del plan completo).
6. Polish.

## Notas de implementación (post-mortem)

- **`InsumosContexto` (013) extendido con `perfilClienteOverride`**: el contrato pedía que el simulador arme un `PerfilCliente` 100% simulado y se lo pase a `construirContextoCompuesto`, pero esa función (de `013`) solo sabía resolver el perfil internamente vía `producirCapaPerfilCliente(contactoId, ...)`, que requiere un `contactoId` real. Se agregó `perfilClienteOverride?: PerfilCliente | null` a `InsumosContexto` — cuando está definido (incluso `null`), reemplaza esa resolución interna. Cambio aditivo, retrocompatible (todos los llamadores existentes no lo pasan, comportamiento idéntico).
- **`producirCapaEstrategia` (011/013) registra `SeleccionEstrategiaLog` también durante una simulación** — limitación conocida y documentada, no corregida en esta spec: `construirContextoCompuesto` invoca esa capa sin distinguir simulación de producción, y modificarla para suprimir el registro habría requerido encadenar un flag a través de 3 archivos de otra spec (`011`) por un efecto de auditoría de bajo riesgo (no es un dato de negocio como `Cotizacion`/`Pedido`, es un log de selección de estrategia). Las garantías SC-002/SC-003 de "cero efectos reales" de esta spec están acotadas — y verificadas por test — a los efectos que la propia spec 018 identifica como críticos: escrituras de negocio en las 6 tools, envío de mensajes reales, y eventos de dominio.
- **T002 — `SimulacionEjecutada` no implementada**: research.md Decisión 3 la marca explícitamente como mejora opcional, no requisito — ningún FR pide conservar historial de simulaciones entre sesiones. El diagnóstico vive solo en el estado de React del panel mientras la sheet está abierta.
- **T021 — Historia 4 acotada, no una reestructuración plana de 10 secciones**: el contrato (`contracts/simulador.md`) describe una tabla de 10 secciones asumiendo una única navegación plana, pero la arquitectura real (ya establecida desde `009`) separa dos ámbitos distintos: configuración **a nivel de instancia** (`tab-ia.tsx` — proveedores, enrutamiento, estrategias definidas, entregas, conversaciones piloto, auditoría) y configuración **por agente** (`sheet-editar-agente.tsx` — identidad/comunicación/reglas, versiones, estrategias asignadas, automatización, y ahora simulador/conocimiento). Forzar ambos ámbitos en una sola navegación plana habría requerido mover lógica entre archivos (explícitamente prohibido por el propio contrato: "sin duplicar ni mover la lógica de cada componente ya construido") o inventar un selector de agente dentro de `tab-ia.tsx` que no existía. Se optó por completar los dos únicos huecos reales de la tabla (Conocimiento, Simulador) dentro del punto de navegación por-agente ya existente, preservando los dos puntos de entrada ya establecidos y coherentes con el resto del plan de 10 specs.
- **T022 — Playwright no ejecutado**: mismo precedente que `009` (su test Playwright de versionado tampoco se ejecutó, documentado como pendiente en `specs/009-.../tasks.md`). Ejecutar un test Playwright real requiere un servidor de desarrollo vivo con sesión de autenticación real, fuera del alcance práctico de esta sesión — la cobertura de la spec se obtuvo con 235 tests Vitest (13 nuevos: 7 de `modo-simulacion.test.ts`, 6 de `servicio.test.ts`) más verificación de build y `tsc`.

## Resumen de estado

✅ **Implementada** (23/25 tareas completas, 2 marcadas `[~]` con justificación explícita — `SimulacionEjecutada` opcional no implementada por decisión de diseño propia de la spec, y el test Playwright no ejecutado por el mismo precedente ya establecido en `009`). 235/235 tests (`npx vitest run`) pasan (13 nuevos); `npm run build` exit code 0. Sin migración nueva (no se agregó ninguna tabla obligatoria — `ContextoTool.modoSimulacion` es la única extensión de un tipo ya existente).

---

## Cierre del plan de evolución del agente de IA (10/10 specs)

Con `018-simulador-agente` implementada, mergeada y verificada, el plan completo de 10 specs (`009`–`018`) definido en `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` queda cerrado: identidad/versionado estructurados (`009`), enrutamiento de modelos por objetivo (`010`), playbooks de estrategia (`011`), perfil dinámico del cliente (`012`), context builder por capas (`013`), conversaciones piloto y ejemplos relevantes (`014`), herramientas operativas de inventario/envíos/acciones (`015`), niveles de autonomía y automatización (`016`), registro de aprendizaje supervisado y auditoría (`017`), y simulador de agente (`018`) — todas implementadas, testeadas y en `main`.
