# Tasks: Perfil dinámico del cliente

**Input**: Design documents from `/specs/012-perfil-dinamico-cliente/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/servicio.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 Agregar modelo `PerfilClienteSnapshot` a `prisma/schema.prisma` según `data-model.md`
- [ ] T002 Generar y aplicar la migración Prisma (`npm run db:migrate`)
- [ ] T003 [P] Crear el contrato de evento `ConversacionClasificada` en `src/eventos/contratos/conversacion-clasificada.event.ts` y registrarlo en `src/eventos/catalogo.ts`/`src/eventos/mapa.ts` (research.md Decisión 5)
- [ ] T004 Emitir `ConversacionClasificada` en `src/ai/tools/providers/transfer.tool.ts` inmediatamente después del `updateMany` existente, sin modificar su lógica actual

## Phase 2: Foundational (bloqueante para todas las historias)

- [ ] T005 [P] Crear `src/ai/perfil-cliente/tipos.ts` con `PerfilCliente`, `DatosObjetivos`, `DatosInterpretados` según `data-model.md` (reutilizando `TipoRelacionCliente`/`IntencionComercial` de `src/ai/estrategia/tipos.ts`)
- [ ] T006 Implementar `calcularDatosObjetivos` en `src/ai/perfil-cliente/calculo-objetivo.ts` según el contrato — queries agregadas en paralelo, mismo criterio de "oportunidad activa" que `src/ai/tools/providers/customer.tool.ts`
- [ ] T007 Implementar `clasificarTipoRelacion` en `src/ai/perfil-cliente/calculo-objetivo.ts` según `research.md` Decisión 2
- [ ] T008 [P] Implementar la generación de `senalesObjetivas` en `src/ai/perfil-cliente/senales.ts` según `research.md` Decisión 3 (plantillas, sin IA)
- [ ] T009 Implementar `PerfilClienteService.recalcular`/`obtenerPerfil` en `src/ai/perfil-cliente/servicio.ts` orquestando T006–T008 (sin la extracción interpretada todavía — se agrega en Historia 2)
- [ ] T010 [P] Crear `src/ai/perfil-cliente/queries.ts` con la lectura del snapshot vigente scoped a `instanciaId`

**Checkpoint**: el perfil objetivo se puede calcular y consultar de punta a punta, sin datos interpretados ni invalidación automática todavía.

## Phase 3: User Story 1 - Ver el perfil objetivo de un cliente basado en datos reales (Priority: P1) 🎯 MVP

**Goal**: perfil objetivo correcto y sin etiquetas subjetivas para cualquier contacto.

**Independent Test**: Escenario 1 y 2 de `quickstart.md`.

- [ ] T011 [P] [US1] Test unitario en `src/ai/perfil-cliente/calculo-objetivo.test.ts` (nuevo): dado un contacto con pedidos/oportunidades/cotizaciones/incidencia de prueba, `calcularDatosObjetivos` devuelve los valores esperados
- [ ] T012 [P] [US1] Test unitario en `src/ai/perfil-cliente/calculo-objetivo.test.ts`: contacto sin historial devuelve `DatosObjetivos` en cero/vacío sin lanzar excepción (Edge Case)
- [ ] T013 [P] [US1] Test unitario en `src/ai/perfil-cliente/calculo-objetivo.test.ts`: `clasificarTipoRelacion` cubre los 6 casos de `research.md` Decisión 2 con datos de entrada exactos
- [ ] T014 [P] [US1] Test unitario en `src/ai/perfil-cliente/senales.test.ts` (nuevo): las señales generadas no contienen ninguna palabra de una lista negra de adjetivos subjetivos de prueba (verificación mecánica de FR-003/SC-003)
- [ ] T015 [US1] Exponer el perfil en la ficha de contacto existente (componente de detalle de contacto en `src/crm/contactos/` o equivalente) como una sección de solo lectura — sin bloquear el render si el perfil aún no existe (se calcula bajo demanda)

**Checkpoint**: Historia 1 demostrable de forma aislada.

## Phase 4: User Story 2 - Distinguir lo objetivo de lo interpretado por IA (Priority: P1)

**Goal**: `datosInterpretados` separado, tolerante a fallo, nunca inventado.

**Independent Test**: Escenario 3 de `quickstart.md`.

- [ ] T016 [P] [US2] Test unitario en `src/ai/perfil-cliente/extraccion-interpretada.test.ts` (nuevo): con una respuesta simulada válida del gateway, `extraerDatosInterpretados` devuelve el shape esperado
- [ ] T017 [P] [US2] Test unitario en `src/ai/perfil-cliente/extraccion-interpretada.test.ts`: con el gateway simulando un fallo (IA no habilitada o error de proveedor), devuelve `null` sin lanzar excepción (FR-007)
- [ ] T018 [US2] Implementar `extraerDatosInterpretados` en `src/ai/perfil-cliente/extraccion-interpretada.ts` según el contrato, usando `generarRespuesta({ tarea: "EXTRACCION_ENTIDADES" })`
- [ ] T019 [US2] Conectar la extracción interpretada dentro de `PerfilClienteService.recalcular` (T009), solo cuando `disparadoPor` sea un evento de conversación, con fusión que conserva el interpretado anterior ante un fallo nuevo (research.md Decisión 4)
- [ ] T020 [US2] Actualizar la sección de perfil en la ficha de contacto (T015) para mostrar `datosInterpretados` visualmente distinguido (por ejemplo, con un rótulo "interpretado por IA") de `datosObjetivos`

**Checkpoint**: Historias 1 y 2 completas — perfil objetivo + interpretado, correctamente separados y tolerantes a fallo.

## Phase 5: User Story 3 - Actualizar el perfil solo cuando cambia algo relevante (Priority: P2)

**Goal**: invalidación incremental por evento, sin recálculo por mensaje.

**Independent Test**: Escenario 4 de `quickstart.md`.

- [ ] T021 [P] [US3] Test de integración en `src/ai/perfil-cliente/suscriptores/invalidar-perfil.suscriptor.test.ts` (nuevo): cada evento de la lista cerrada (research.md Decisión 1) dispara `recalcular` con el `contactoId` correcto extraído del payload
- [ ] T022 [US3] Implementar `invalidar-perfil.suscriptor.ts` según el contrato, extendiendo `ConsumidorBase` con las routing keys de los eventos listados
- [ ] T023 [US3] Registrar el nuevo consumidor en el arranque de suscriptores existente (mismo lugar donde se registran los demás `ConsumidorBase` del proyecto)

**Checkpoint**: las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [ ] T024 [P] Ejecutar `quickstart.md` completo (Escenarios 1–5)
- [ ] T025 Confirmar que ninguna query de `calculo-objetivo.ts` cruza `instanciaId` (Escenario 5 — aislamiento multi-tenant)
- [ ] T026 Actualizar `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `012` como implementada

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)**: bloqueante.
- **User Story 1 (Phase 3)**: depende solo de Phase 2.
- **User Story 2 (Phase 4)**: depende de Phase 2; es independiente de US1 en términos de lógica (solo comparten `servicio.ts`), aunque se valida mejor con la UI de US1 ya visible.
- **User Story 3 (Phase 5)**: depende de Phase 2 (necesita `servicio.ts.recalcular`) y de T004 (evento `ConversacionClasificada`) de Setup.
- **Polish (Phase 6)**: depende de Phase 3, 4 y 5.

## Implementation Strategy

### MVP First (User Story 1)

1. Setup + Foundational.
2. User Story 1 — perfil objetivo visible y correcto.
3. Validar con Escenario 1 y 2 de `quickstart.md`.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo del perfil objetivo.
3. US2 → demo de la separación objetivo/interpretado (cumple el requisito no negociable del pedido).
4. US3 → eficiencia de actualización incremental.
5. Polish.
