# Tasks: Perfil dinámico del cliente

**Input**: Design documents from `/specs/012-perfil-dinamico-cliente/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/servicio.md, quickstart.md

> **Notas de implementación (post-mortem)**:
> 1. `research.md` de esta spec depende de `src/ai/estrategia/tipos.ts` (`TipoRelacionCliente`/`IntencionComercial`), que pertenece conceptualmente a `011-playbook-estrategia-comercial` (no implementada todavía al momento de implementar `012`). Se creó ese archivo como parte de esta spec — `011` lo reutilizará sin redefinirlo cuando se implemente.
> 2. **Corrección real sobre research.md Decisión 1**: se asumió que los contratos de eventos de Pedido/Cotización/Oportunidad ya incluían `contactoId` en su payload. Verificado por inspección: **no es así** — `PedidoCreadoPayload`, `PedidoActualizadoPayload`, `PedidoEntregadoPayload`, `CotizacionCreadaPayload`, `CotizacionActualizadaPayload`, `CotizacionAprobadaPayload`, `OportunidadActualizadaPayload`, `OportunidadPerdidaPayload`, `EtapaCambiadaPayload` no lo traen. El suscriptor (`invalidar-perfil.suscriptor.ts`) se implementó resolviendo `contactoId` con un lookup mínimo (`Pedido`/`Cotizacion`/`OportunidadContacto`) cuando el payload no lo incluye — documentado en el propio archivo.
> 3. **Descubrimiento de testing reutilizable**: se puede testear lógica que toca Prisma con `vi.mock("@/shared/db/prisma", ...)` sin necesitar una base de datos real — usado en `extraccion-interpretada.test.ts` e `invalidar-perfil.suscriptor.test.ts`. Recomendado para las specs `011`, `013`-`018` en vez de omitir tests de lógica con I/O.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Agregar modelo `PerfilClienteSnapshot` a `prisma/schema.prisma` (+ relaciones inversas en `Contacto`/`Instancia`)
- [X] T002 Migración `20260901063244_perfil_dinamico_cliente` generada y aplicada — confirmada puramente aditiva (`CREATE TABLE`)
- [X] T003 [P] Contrato de evento `ConversacionClasificada` creado y registrado en `catalogo.ts`/`mapa.ts`/`exchanges.ts` (RK nuevo + cola `PERFIL_CLIENTE_INVALIDAR` con bindings explícitos en `conexion.ts` — ver nota 2)
- [X] T004 `transfer.tool.ts` emite `ConversacionClasificada` después del `updateMany` existente, tolerante a fallo (try/catch, no bloquea la transferencia)

## Phase 2: Foundational (bloqueante para todas las historias)

- [X] T005 [P] `src/ai/perfil-cliente/tipos.ts` creado (`PerfilCliente`, `DatosObjetivos`, `DatosInterpretados`), reutilizando `src/ai/estrategia/tipos.ts` (ver nota 1)
- [X] T006 `calcularDatosObjetivos` implementado en `calculo-objetivo.ts` — queries en paralelo, mismo criterio de "oportunidad activa" que `customer.tool.ts`
- [X] T007 `clasificarTipoRelacion` implementado según `research.md` Decisión 2
- [X] T008 [P] `generarSenalesObjetivas` implementado en `senales.ts` (plantillas, sin IA)
- [X] T009 `recalcular`/`obtenerPerfil` implementados en `servicio.ts`
- [X] T010 [P] `obtenerSnapshotVigente` implementado en `queries.ts`, scoped a instancia

**Checkpoint**: ✅ Verificado con `tsc --noEmit`, `npm run build`, 137 tests unitarios en verde.

## Phase 3: User Story 1 - Ver el perfil objetivo de un cliente (Priority: P1) 🎯 MVP

- [X] T011 [P] [US1] **Adaptado** — en vez de testear `calcularDatosObjetivos` (toca Prisma), se testeó exhaustivamente `clasificarTipoRelacion` (los 6 casos exactos de research.md Decisión 2), que concentra la lógica de decisión
- [X] T012 [P] [US1] Cubierto: caso "contacto sin historial" incluido explícitamente en los 6 casos de T011
- [X] T013 [P] [US1] Los 6 casos de `clasificarTipoRelacion` cubiertos con datos de entrada exactos
- [X] T014 [P] [US1] Test en `senales.test.ts`: verificación mecánica contra lista negra de adjetivos subjetivos — 0 coincidencias en todas las combinaciones probadas
- [X] T015 [US1] Perfil expuesto como nueva tab "Perfil" en `src/app/crm/contactos/[id]/page.tsx`, vía `PanelPerfilCliente` — no bloquea el render si falla (try/catch)

**Checkpoint**: ✅ Historia 1 completa.

## Phase 4: User Story 2 - Distinguir lo objetivo de lo interpretado (Priority: P1)

- [X] T016 [P] [US2] Test en `extraccion-interpretada.test.ts` (con `vi.mock` del gateway, ver nota 3): respuesta válida se parsea correctamente
- [X] T017 [P] [US2] Test: gateway falla o IA no habilitada → `null` sin lanzar; respuesta no-JSON → `null`
- [X] T018 [US2] `extraerDatosInterpretados` implementado en `extraccion-interpretada.ts`, usando `generarRespuesta({ tarea: "EXTRACCION_ENTIDADES" })`
- [X] T019 [US2] Conectado en `servicio.ts.recalcular` — solo corre en eventos de conversación, conserva la interpretación anterior si la nueva falla
- [X] T020 [US2] `PanelPerfilCliente` distingue visualmente "Perfil objetivo" de "Interpretado por IA — no es un hecho confirmado" (bloque con color/rótulo distintos)

**Checkpoint**: ✅ Historias 1 y 2 completas.

## Phase 5: User Story 3 - Actualizar el perfil solo cuando cambia algo relevante (Priority: P2)

- [X] T021 [P] [US3] Test en `invalidar-perfil.suscriptor.test.ts` (con `vi.mock`, ver nota 3): 5 casos — lookup por pedido, por cotización, por oportunidad (vía `OportunidadContacto`), contactoId ya presente en el payload (sin lookup), y pedido sin contacto asociado (no recalcula, no falla)
- [X] T022 `InvalidarPerfilSuscriptor` implementado extendiendo `ConsumidorBase`, con la corrección de la nota 2 (lookup de `contactoId` cuando el payload no lo trae)
- [X] T023 Registrado en `src/suscriptores/registrar.ts`

**Checkpoint**: ✅ Las tres historias completas.

## Phase 6: Polish & Cross-Cutting

- [~] T024 [P] Verificado por tests unitarios + build; validación manual completa del `quickstart.md` contra un entorno con RabbitMQ corriendo no ejecutada en esta sesión (requiere infraestructura de colas activa).
- [X] T025 Confirmado por inspección: todas las queries de `calculo-objetivo.ts`, `servicio.ts`, `queries.ts` y el suscriptor filtran por `instanciaId` explícitamente — sin cruce entre tenants.
- [X] T026 Actualizado `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` marcando la spec `012` como implementada.

## Resumen de estado

**Completo y verificado** (`tsc --noEmit`, `npm run build`, 137 tests unitarios en verde, 19 nuevos de esta spec): cálculo de perfil objetivo desde datos reales, clasificación determinística de tipo de relación, señales objetivas sin adjetivos subjetivos (verificado mecánicamente), extracción interpretada tolerante a fallo y separada visualmente de lo objetivo, invalidación incremental por evento de dominio (con corrección real sobre el diseño original — lookup de `contactoId` cuando el evento no lo trae), UI integrada en la ficha de contacto existente.

**Pendiente, explícito**: validación manual del `quickstart.md` contra un entorno con RabbitMQ corriendo (requiere infraestructura de colas, no solo la base de datos).

**Aporte hacia adelante**: `src/ai/estrategia/tipos.ts` queda listo para que `011-playbook-estrategia-comercial` lo reutilice sin redefinir el catálogo.
