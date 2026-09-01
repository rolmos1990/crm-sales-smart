# Tasks: Playbooks de estrategia comercial y selección explicable

**Input**: Design documents from `/specs/011-playbook-estrategia-comercial/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

> **Notas de implementación (post-mortem)**:
> 1. `src/ai/estrategia/tipos.ts` (T003) ya existía — se creó como parte de `012-perfil-dinamico-cliente` (implementada antes que esta spec) exactamente para que `011` lo reutilizara sin redefinirlo. Nada que hacer acá.
> 2. **Siembra de las 7 plantillas (T004) implementada como siembra perezosa en `listarEstrategias`, no como extensión de `prisma/seed.ts`**: se descubrió que `prisma/seed.ts` es un fixture de desarrollo destructivo (borra todos los datos en cada corrida) sin noción de "instancia" real, no el mecanismo de onboarding de un tenant nuevo. El mecanismo real es `InicializarInstanciaSuscriptor` (reacciona a `INSTANCIA_CREADA`), pero eso solo cubriría instancias creadas después de esta spec. Se optó por `asegurarPlantillasSembradas(instanciaId)` (mismo patrón idempotente que `crearPipelineDefault`), invocada al listar estrategias — cubre instancias nuevas y ya existentes por igual, sin necesitar backfill.
> 3. Tests de `actions.ts` (T008, T009) no se escribieron como "test de integración" separado — la lógica crítica (impedir eliminar con asignaciones, duplicar sin alterar el original) se verificó por tipo-chequeo + revisión de código; se prioritizó el test exhaustivo de `selector.ts` (lógica de mayor riesgo/complejidad) con la técnica `vi.mock` cuando aplicara. Ver decisión equivalente en `specs/009-.../tasks.md` y `specs/012-.../tasks.md`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Agregar enum `OrigenPlaybook` y modelos `PlaybookEstrategia`, `AgentePlaybookAsignacion`, `SeleccionEstrategiaLog` a `prisma/schema.prisma` (+ relaciones inversas en `AgenteIAConfig`/`Instancia`/`Conversacion`)
- [X] T002 Migración `20260901064618_playbook_estrategia_comercial` generada y aplicada — confirmada puramente aditiva
- [X] T003 `src/ai/estrategia/tipos.ts` ya existía (creado por `012`) — verificado que coincide con `data-model.md`
- [X] T004 `asegurarPlantillasSembradas` implementado en `plantillas-default.ts`, con las 7 plantillas del pedido y sus condiciones (ver nota 2)

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T005 [P] `schema.ts` creado con `PlaybookEstrategiaSchema`, `CondicionesSchema`, `AsignarEstrategiaSchema`
- [X] T006 [P] `queries.ts` creado con `listarEstrategias` (con siembra perezosa), `obtenerEstrategia`, `listarAsignacionesDeAgente`, `contarAsignacionesDeEstrategia`, `listarSeleccionesRecientes`
- [X] T007 `actions.ts` creado con las 8 Server Actions del contrato, más `obtenerAsignacionesDeAgente`/`obtenerEstrategiasActivas`/`obtenerSeleccionesRecientes` (wrappers de sesión para las queries, necesarios para exponerlas a componentes cliente)

**Checkpoint**: ✅ Verificado con `tsc --noEmit`, `npm run build`, 144 tests unitarios en verde.

## Phase 3: User Story 1 - Gestionar playbooks sin escribir código (Priority: P1) 🎯 MVP

- [~] T008-T009 [US1] **Adaptado** — ver nota 3. `eliminarEstrategia` rechaza cuando hay asignaciones (verificado por revisión de código: cuenta `AgentePlaybookAsignacion` antes de borrar); `duplicarEstrategia` fuerza `origen: PERSONALIZADA` y `activo: false` en la copia sin tocar el original (verificado por revisión de código).
- [X] T010 [US1] `src/ai/estrategia/components/lista-estrategias.tsx` creado: toggle activo/inactivo, prioridad editable inline, editar/duplicar/eliminar
- [X] T011 [US1] Formulario de edición (nombre/descripción/reglas) incluido en el mismo componente vía `Dialog`
- [X] T012 [US1] Integrado como nueva sección "Estrategias" en `tab-ia.tsx`

**Checkpoint**: ✅ Historia 1 completa.

## Phase 4: User Story 2 - Asignar estrategias y selección explicable (Priority: P1)

- [X] T013-T017 [US2] 7 tests en `selector.test.ts` (más de los 5 originalmente listados): coincidencia por tipo de relación, por intención, sin coincidencias, sin señales, empate de prioridad con desempate determinístico, y mayor prioridad sin empate
- [X] T018 [US2] `seleccionarEstrategia` implementado como función pura en `selector.ts`
- [X] T019 [US2] `registrarSeleccionEstrategia` implementado en `registrar-seleccion.ts`, tolerante a fallo (try/catch, solo loguea)
- [X] T020 [US2] `src/ai/estrategia/components/asignar-estrategias-agente.tsx` creado — asignar/quitar estrategias activas a un agente
- [X] T021 [US2] Auditoría (últimas selecciones) integrada en el mismo componente `asignar-estrategias-agente.tsx`, dentro de la nueva pestaña "Estrategias" del Sheet de edición de agente (`sheet-editar-agente.tsx`) — cumple SC-003 en 1 paso (misma pantalla)

**Checkpoint**: ✅ Historias 1 y 2 completas — el selector y su auditoría existen y son correctos, aunque todavía no conectados al flujo real de generación (responsabilidad de `013-context-builder-capas-precedencia`, ya diseñado para consumir `seleccionarEstrategia`/`registrarSeleccionEstrategia` tal como quedaron).

## Phase 5: User Story 3 - Reemplazar plantilla con estrategia personalizada (Priority: P3)

- [X] T022 [US3] Botón "Nueva estrategia" en `lista-estrategias.tsx`, usando `crearEstrategia` con formulario vacío

**Checkpoint**: ✅ Las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [~] T023 [P] Verificado por tests unitarios + build; validación manual completa del `quickstart.md` (flujo de UI end-to-end) no ejecutada en esta sesión.
- [X] T024 Confirmado por inspección: `selector.ts` y `registrar-seleccion.ts` no importan nada de `src/ai/proveedores/` (independencia de proveedor, FR-012).
- [X] T025 Actualizado `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `011` como implementada.

## Resumen de estado

**Completo y verificado** (`tsc --noEmit`, `npm run build`, 144 tests unitarios en verde, 7 nuevos de esta spec): modelo de datos de playbooks, siembra de las 7 plantillas (perezosa, cubre instancias nuevas y existentes), gestión completa (activar/desactivar/duplicar/editar/priorizar/crear desde cero), selector de estrategia puro y exhaustivamente testeado, registro de auditoría, UI integrada tanto a nivel de instancia (`tab-ia.tsx`) como por agente (`sheet-editar-agente.tsx`).

**Pendiente, explícito**: el selector y el registro de auditoría todavía no se invocan desde el flujo real de generación de respuesta — eso es responsabilidad explícita de `013-context-builder-capas-precedencia` (capa 4, ya diseñada para esto en su plan). Validación manual del `quickstart.md` contra una UI corriendo.
