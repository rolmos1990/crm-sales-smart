---

description: "Task list for 042 — Análisis inteligente de Contactos"
---

# Tasks: Análisis inteligente de Contactos

**Input**: Design documents from `specs/042-contactos-analisis-ia/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D17), data-model.md, contracts/ia-analisis-lote.md, contracts/criterio.md, contracts/server-actions.md, contracts/eventos.md, quickstart.md

**Tests**: incluidos. La constitución (principio V) exige tests proporcionales al riesgo, y research D17 enumera las pruebas obligatorias. Vitest es solo para unitarias (Prisma y gateway con `vi.mock`); la concurrencia real se prueba con el simulador en `scripts/`; la UI, con Playwright.

**Organization**: las tareas están agrupadas por historia de usuario.

- Antes de tocar UI: aplicar `react-best-practices`, `design-systems` y `nextjs-best-practices`.
- Antes de tocar fechas: leer `docs/fechas-y-zonas-horarias.md`.
- Antes de un `<Select>`: leer `docs/selects.md`.
- Antes de Server Actions: aplicar `nodejs-best-practices`.
- Todo el dominio en español (CLAUDE.md, regla 1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes).
- **[Story]**: US1…US7 corresponden a las Historias 1…7 de spec.md.

---

## Phase 1: Setup

**Purpose**: esquema de datos, migración y configuración de entorno. Una sola migración para toda la feature.

- [X] T001 Agregar a `prisma/schema.prisma`:
  - Los enums nuevos de data-model.md ("Enums nuevos").
  - El valor `ANALISIS_CONTACTOS` en `enum TareaIA`.
  - `UsoIA.tokensCacheados Int @default(0)`.
  - `Contacto.puntajeComercial Int?` con `index([instanciaId, puntajeComercial])` y las relaciones `evaluacion ContactoEvaluacion?` y `colaAnalisis ContactoAnalisisCola?`.
  - Los modelos `ConfiguracionAnalisisContactos`, `ContactoAnalisisCola`, `ContactoEvaluacion`, `CriterioAnalisisContactos`, `CriterioAnalisisContactosVersion`, `EjecucionAnalisisContactos`, `EjecucionAnalisisContactosItem` y `ResumenDiarioAnalisisContactos`, con los campos, defaults, índices y `onDelete` exactamente como en data-model.md.
  - Las relaciones inversas en `Instancia`, `Contacto` y `ProveedorIA`.
  - Comentarios `// 042 —` que expliquen el *por qué* de cada modelo, al estilo de los de la 041.
- [X] T002 Generar la migración con `npx prisma migrate dev --create-only --name contactos_analisis_ia` y editar `prisma/migrations/<ts>_contactos_analisis_ia/migration.sql`:
  - Agregar a mano los índices parciales de `ContactoAnalisisCola`: `CREATE INDEX ... ON "ContactoAnalisisCola" ("instanciaId","prioridad","elegibleDesde") WHERE "estado" = 'PENDIENTE'` y `CREATE INDEX ... ("bloqueadoHasta") WHERE "estado" = 'EN_PROCESO'`.
  - Revisar que solo haya `CREATE TYPE`, `ALTER TYPE ... ADD VALUE`, `ADD COLUMN` nulable o con default, `CREATE TABLE` y `CREATE INDEX`. Nada destructivo (FR-056).
  - Aplicar con `npx prisma migrate dev`.
- [X] T003 [P] Crear `src/crm/contactos/analisis/config-entorno.ts` que lea y valide con Zod las variables de quickstart.md (`ANALISIS_CONTACTOS_CONCURRENCIA`, `ANALISIS_CONTACTOS_CUPOS`, `ANALISIS_CONTACTOS_PRESUPUESTO_GLOBAL_USD`, `ANALISIS_CONTACTOS_HISTORICO_PAUSADO`, `ANALISIS_CONTACTOS_INTERVALO_MS`, `ANALISIS_CONTACTOS_RECONCILIACION_MIN`).
  - Usa los defaults documentados.
  - Exporta un objeto congelado `configEntorno`.
  - Si los cupos no suman 100, falla al arrancar con un mensaje claro.
- [X] T004 [P] Crear `src/crm/contactos/analisis/types.ts` con:
  - Los tipos de dominio derivados de los enums de Prisma: `PrioridadAnalisis`, `RelacionComercial`, `AccionComercial`, `IntencionCompra`, etc.
  - `DatosContactoLote`, que es la salida de `datos-lote.ts`.
  - `ResultadoReglas`.
  - `ResultadoIAContacto`.
  - `EjecutorIA`: la función inyectable `(lote) => Promise<RespuestaLoteIA>` (research D17).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: cola durable, criterio por defecto, reglas, auditoría base y ciclo del worker. Sin esto ninguna historia corre.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

### Criterio por defecto (research D12, contracts/criterio.md)

- [X] T005 [P] Crear `src/crm/contactos/analisis/criterio/schema.ts` con el esquema Zod `CriterioContenidoSchema` de contracts/criterio.md:
  - Límites de largo y de cantidad.
  - Pesos que suman 1 (±0,001).
  - Rechazo de `<criterio_negocio>`/`<datos_lote>` dentro de `instrucciones`.
  - Tipo `CriterioContenido = z.infer<...>`.
- [X] T006 [P] Crear `src/crm/contactos/analisis/criterio/plantillas.ts` con las 4 plantillas (`GENERAL`, `RETAIL`, `SERVICIOS`, `B2B`), sus nombres visibles y contenidos según contracts/criterio.md.
  - Cada plantilla se valida contra `CriterioContenidoSchema` en un test.
- [X] T007 Crear `src/crm/contactos/analisis/criterio/queries.ts` con `obtenerCriterioVigente(instanciaId)`.
  - Devuelve `{ contenido, versionId | null, plantillaAplicada | null }`.
  - Toma la versión publicada; si no hay, `GENERAL` en memoria, sin escribir nada.

### Reglas y puntaje puros (research D7)

- [X] T008 [P] Crear `src/crm/contactos/analisis/reglas.ts` (puro, sin Prisma en runtime) con:
  - `calcularRelacionComercial({compras, ultimaCompraEn}, umbrales, ahora)`, donde `CLIENTE_INACTIVO` tiene precedencia sobre `CLIENTE_RECURRENTE`.
  - `senalesObjetivas(datos)`, por plantilla y sin juicios, con el mismo estilo que `src/ai/perfil-cliente/senales.ts`.
  - `motivosReglas(datos)`.
  - `accionPorReglas(datos)`, que reutiliza `calcularRecomendacion` de `src/crm/contactos/segmentacion/recomendacion.ts` y la mapea a `AccionComercial`.
  - `calcularProximaEvaluacion(datos, umbrales, cortes)`.
- [X] T009 [P] Crear `src/crm/contactos/analisis/puntaje.ts` (puro) con:
  - `calcularPuntajeBase(factores, pesos)`, que da 0–60 a partir de factores normalizados entre 0 y 1.
  - `combinarPuntaje(base, ajusteIA | null)`, que hace `clamp(base + ajuste, 0, 100)` y limita el ajuste a ±40.
- [X] T010 [P] Tests en `src/crm/contactos/analisis/reglas.test.ts`, cubriendo como mínimo:
  - Matriz de relación comercial: 0, 1 y N compras; última compra dentro y fuera del umbral; umbrales de cada plantilla.
  - Próxima evaluación: con actividad, por corte de recuperar, por inactividad y `null`.
  - Precedencia de RESPONDER y NO_CONTACTAR.
- [X] T011 [P] Tests en `src/crm/contactos/analisis/puntaje.test.ts`:
  - Rango 0–60 de la base.
  - El ajuste fuera de ±40 se recorta.
  - Clamp 0–100.
  - Sin IA, el puntaje es igual a la base.
  - Pesos de cada plantilla.

### Cola durable (research D1, D3, D4, D11)

- [X] T012 Crear `src/crm/contactos/analisis/cola.ts` con:
  - `marcarPendiente({instanciaId, contactoId, prioridad, motivo, tipo?, inmediato?, forzarIA?}, db = prisma)`.
    - Hace el upsert de `ContactoAnalisisCola` con las reglas de data-model.md: `versionDatos + 1`, prioridad `min`, `elegibleDesde` con ventana y espera máxima, `FALLIDO` no se reabre salvo con el motivo `MANUAL_REINTENTO`.
    - Lee `ventanaAgrupacionSeg` y `esperaMaximaSeg` con `obtenerParametrosCola(instanciaId)`, que usa una **caché en memoria de 60 s por cuenta**. Solo en un fallo de caché consulta la fila; si no existe, la crea **una vez** con `createMany({ data: [defaults], skipDuplicates: true })`. Nunca hace un upsert de la configuración por cada mensaje (P1). Exportar `invalidarParametrosCola(instanciaId)` para que las acciones de configuración la limpien al guardar.
    - La escritura en la cola es **una sola sentencia** `INSERT ... ON CONFLICT ("contactoId") DO UPDATE` con `$executeRaw`, que calcula versión, prioridad y `elegibleDesde` en SQL, sin leer antes.
  - `marcarPendienteSinFallar(...)`, que envuelve con `sinFallar` de `src/crm/contactos/interaccion.ts`.
- [X] T013 En `src/crm/contactos/analisis/cola.ts`, agregar `reclamarLote({instanciaId, prioridad, limite, leaseMs})` con `$queryRaw`, siguiendo el patrón de `reclamarJobs` (`src/crm/pipeline/disparadores/ejecutor.ts:496`):
  - `UPDATE ... SET estado='EN_PROCESO', versionReclamada=versionDatos, bloqueadoHasta=... WHERE id IN (SELECT ... WHERE instanciaId=$1 AND estado='PENDIENTE' AND prioridad=$2 AND elegibleDesde<=now() ORDER BY elegibleDesde LIMIT $3 FOR UPDATE SKIP LOCKED) RETURNING contactoId, versionReclamada, forzarIA, tipo, elegibleDesde`.
- [X] T014 En `src/crm/contactos/analisis/cola.ts`, agregar:
  - `completarContacto(tx, {contactoId, versionReclamada, ejecucionId, datosHasta})`: si `versionDatos = versionReclamada`, la fila pasa a `AL_DIA`, `prioridad=P2`, `intentos=0`, `forzarIA=false`; si no, vuelve a `PENDIENTE` con `elegibleDesde=now`.
  - `devolverConBackoff({contactoIds, error})`: aplica la fórmula de research D11 (30 s × 2^n, tope de 30 min, jitter de 0,8 a 1,2) y pasa a `FALLIDO` con `intentos ≥ 5`.
  - `reintentarFallidos(instanciaId)`.
  - La fórmula del backoff se exporta pura como `calcularBackoffMs(intentos, aleatorio)`.
- [X] T015 [P] Tests en `src/crm/contactos/analisis/cola.test.ts` con `vi.mock` de Prisma:
  - Diez marcados del mismo contacto dejan una sola fila, con la versión subiendo.
  - La prioridad nunca baja.
  - La ventana respeta la espera máxima.
  - `inmediato` ignora la ventana.
  - `completarContacto` con versión distinta deja el contacto `PENDIENTE`.
  - `calcularBackoffMs` respeta los límites y el jitter.
  - Al quinto intento pasa a `FALLIDO`.
- [X] T016 Crear `src/crm/contactos/analisis/motor/recuperacion.ts` con `recuperarTrabajoAbandonado(ahora)`, al estilo de `recuperarJobsInterrumpidos`:
  - Las filas `EN_PROCESO` con `bloqueadoHasta < ahora` vuelven a `PENDIENTE` con `intentos + 1`, o a `FALLIDO` si `intentos ≥ 5`.
  - Las `EjecucionAnalisisContactos` `EN_CURSO` con `leaseHasta < ahora` pasan a `ABANDONADA`, con `errorCodigo='INTERRUMPIDA'`.
  - Recalcula `ConfiguracionAnalisisContactos.lotesEnCurso` contando las atenciones `EN_CURSO`.

### Auditoría base (research D13)

- [X] T017 Crear `src/crm/contactos/analisis/motor/auditoria.ts` con:
  - `abrirEjecucion({...})`: crea la fila `EN_CURSO` con `leaseHasta` y `configAplicada` (sin claves).
  - `cerrarEjecucion(id, {...})`: estado, conteos, tokens, costo, duración y error.
  - `registrarItems(tx, ejecucionId, items[])`: `createMany`.
  - `sanitizarErrorMensaje(err)`: corta a 300 caracteres y enmascara `sk-…`, `Bearer …` y secuencias largas tipo token.
  - Si `cerrarEjecucion` falla, se registra con `console.error` y no lanza (FR-042).
- [X] T018 [P] Tests en `src/crm/contactos/analisis/motor/auditoria.test.ts`:
  - `sanitizarErrorMensaje` con claves de OpenAI, DeepSeek y Anthropic, `Bearer` y textos largos.
  - `configAplicada` nunca incluye `apiKeyEncriptada`.

### Datos del lote y ejecutor sin IA (research D5, D6)

- [X] T019 Crear `src/crm/contactos/analisis/datos-lote.ts` con `cargarDatosLote(instanciaId, contactoIds)`:
  - Hace un número fijo de consultas en `Promise.all`:
    - `pedido.groupBy` con `construirCondicionVenta(await obtenerEtapasFlujoActivo(instanciaId))`: `_count`, `_sum.total`, `_max.fechaVenta`.
    - `cotizacion.groupBy` con `ESTADOS_COTIZACION_ACTIVA` de `src/crm/contactos/segmentacion/condiciones.ts`.
    - `oportunidadContacto.groupBy` de oportunidades abiertas.
    - Actividades pendientes y vencidas.
    - El contacto con los campos de la 041 (`ultimaInteraccionEn`, `esperandoRespuestaDesde`, `noContactarDesde`, `nivelInteres`, `nivelInteresFijado`, `creadoEn`).
    - `ContactoEvaluacion` previa.
  - Filtra todo por `instanciaId`.
  - Devuelve un `Map<contactoId, DatosContactoLote>` con el seguimiento ya calculado por `calcularSeguimientoFila` y `calcularCortes`.
- [X] T020 Crear `src/crm/contactos/analisis/motor/ejecutor.ts` con `procesarLote({instanciaId, prioridad, reclamados, ejecutorIA?})`, que en esta fase **solo aplica reglas**:
  1. `abrirEjecucion` con `modo=REGLAS`.
  2. `cargarDatosLote` y `obtenerCriterioVigente`.
  3. Por contacto: reglas y puntaje base.
  4. Una transacción por lote con:
     - Upsert de `ContactoEvaluacion` solo si `versionEvaluada < versionReclamada` (`updateMany` con `where versionEvaluada lt`, o `create` si no existe). Si se descarta, el ítem queda `DESCARTADO_VERSION`.
     - `Contacto.puntajeComercial` (`updateMany` con `instanciaId`).
     - `completarContacto`.
     - `registrarItems`.
  5. `cerrarEjecucion`.
  6. Después del commit, publicar `ContactoAnalizado` (T024).
  - Deja el punto de extensión `ejecutorIA` sin usar hasta US2.
- [X] T021 [P] Tests en `src/crm/contactos/analisis/motor/ejecutor.reglas.test.ts` con Prisma simulado:
  - Un lote de 3 contactos queda en `AL_DIA` con evaluación de origen `REGLA`.
  - Una versión vieja no pisa una evaluación más nueva (`DESCARTADO_VERSION`).
  - Un contacto de otra instancia en el lote no se escribe.
  - La atención se cierra `COMPLETADA` con los conteos correctos.
  - Un contacto eliminado entre el reclamo y la escritura no lanza error: su ítem queda `DESCARTADO_VERSION` con `motivo: "CONTACTO_ELIMINADO"` y el resto del lote se escribe (C3).

### Ciclo del worker (research D10)

- [X] T022 Crear `src/crm/contactos/analisis/motor/ciclo.ts` con `iniciarCicloAnalisisContactos({ ejecutorIA? })`:
  - Corre en un `setTimeout` recursivo, cada `configEntorno.intervaloMs`.
  - Lleva un semáforo con `configEntorno.concurrencia`.
  - En cada ciclo: `recuperarTrabajoAbandonado()` y luego elegir trabajo con una **selección provisional FIFO** (la cuenta con el pendiente elegible más viejo, por prioridad P0 > P1 > P2). US4 la reemplaza.
  - **La selección FIFO ya respeta la pausa del histórico** (research D10): excluye P2 si `configEntorno.historicoPausado` está activo o si la cuenta tiene `historicoPausado = true`.
  - Para lo elegido: `reclamarLote` y `procesarLote`.
  - Incrementa y decrementa `lotesEnCurso` y actualiza `ultimaAtencionEn`.
  - Todo error se registra con el prefijo `[worker:analisis]` y nunca tumba el ciclo.
- [X] T023 Arrancar el ciclo en `src/worker/disparadores.ts` después de `iniciarPollingCorreo()`, con un comentario `// 042 —` que explique por qué tiene un ciclo propio (FR-033).

### Evento de salida (contracts/eventos.md)

- [X] T024 [P] Crear el evento `ContactoAnalizado`:
  - Contrato `src/eventos/contratos/contacto-analizado.event.ts` (versión 1, payload de contracts/eventos.md).
  - `ContactoAnalizado: "CONTACTO_ANALIZADO"` en `src/eventos/catalogo.ts`.
  - Mapeo en `src/eventos/mapa.ts`.
  - Routing key en `src/shared/rabbitmq/exchanges.ts`.
  - Documentación en `docs/eventos.md`.

**Checkpoint**: con contactos marcados a mano, el worker los evalúa por reglas, escribe la evaluación y el puntaje, y registra la atención.

---

## Phase 3: User Story 1 — Perfil comercial siempre al día, sin IA (Priority: P1) 🎯 MVP

**Goal**: todas las cuentas tienen perfil comercial por reglas, actualizado solo cuando algo cambia.

**Independent Test**: en una cuenta sin IA, un segundo pedido que cuenta como venta deja al contacto como "Cliente recurrente" con su motivo. Un contacto sin cambios no se reevalúa (quickstart §2).

### Tests for User Story 1

- [X] T025 [P] [US1] Tests en `src/ai/perfil-cliente/suscriptores/invalidar-perfil.suscriptor.test.ts`, extendiendo el existente:
  - Cada evento suscripto llama a `marcarPendiente(P1)` y a `recalcular` exactamente como hoy: la extracción por evento de `CONVERSACION_CLASIFICADA` se mantiene en US1, y la bifurcación llega en US2.
  - `CONTACTO_CREADO` marca P2.
  - `resolverContactoId` ignora un pedido, cotización u oportunidad de otra instancia.
  - Ningún evento publicado por el motor (`CONTACTO_ANALIZADO`, `CONTACTO_INTERES_ACTUALIZADO`) está suscripto (riesgo R3).
- [X] T026 [P] [US1] Tests en `src/crm/contactos/interaccion.test.ts`, extendiendo el existente:
  - `registrarInteraccion` y `registrarMensajeEntrante` marcan el contacto P1.
  - Un error de `marcarPendiente` no hace fallar el registro de la interacción.

### Implementation for User Story 1

- [X] T027 [US1] En `src/crm/contactos/interaccion.ts`, llamar a `marcarPendienteSinFallar` (P1, motivo `MENSAJE` o `INTERACCION`) dentro de `registrarInteraccion` y `registrarMensajeEntrante`.
  - **`instanciaId` como parámetro opcional** de `registrarInteraccion`, `registrarMensajeEntrante` y `registrarInteraccionSinFallar`, completado en los 6 llamadores:
    - `src/conversaciones/actions.ts:535` y `:645`.
    - `src/conversaciones/envio.ts:122`.
    - `src/crm/actividades/actions.ts:46`.
    - `src/sales/pedidos/actions.ts:158`.
    - `src/ai/tools/providers/crear-pedido.tool.ts:213`.
    - `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts:276`.
  - Si `instanciaId` no llega, no se marca: no se agrega una consulta extra en el camino caliente. El barrido de T029 lo recupera.
  - **Fuera de la transacción del llamador**: `marcarPendienteSinFallar` usa **siempre** el cliente global `prisma`, nunca el `db`/`tx` recibido. Así un error al marcar nunca aborta la transacción de PostgreSQL de quien llama (caso `generar-pedido-desde-cotizacion`, que pasa `tx`). Si esa transacción hace rollback, queda una marca de más: es inofensiva, porque solo provoca una evaluación sin cambios. Dejar ese razonamiento en un comentario `// 042 —`.
  - Respetar el comentario de cabecera: este archivo sigue siendo el único que escribe `ultimaInteraccionEn`.
- [X] T028 [US1] En `src/ai/perfil-cliente/suscriptores/invalidar-perfil.suscriptor.ts`:
  - Agregar `RK.EVENTO_CONTACTO_CREADO` y `RK.EVENTO_CONTACTO_ACTUALIZADO`.
  - En `resolverContactoId`, cambiar los `findUnique` por `findFirst` con `instanciaId: envelope.instanciaId`.
  - Llamar a `marcarPendiente` (P2 para `CONTACTO_CREADO` con motivo `INICIAL`; P1 para el resto con el motivo del tipo de evento).
  - Seguir llamando a `recalcular(contactoId, instanciaId, envelope.tipo)` igual que hoy, extracción por evento incluida. En US1 el agente conversacional no cambia en nada.
  - Agregar los bindings en `src/shared/rabbitmq/conexion.ts`.
- [X] T029 [US1] Crear `src/crm/contactos/analisis/motor/reconciliacion.ts` con `reconciliar(ahora)`, que recorre por cursor en páginas de 1.000 y por cuenta (raw SQL, índices existentes):
  - (a) Contactos sin fila de cola: P2, motivo `INICIAL`.
  - (b) Contactos con `ultimaInteraccionEn > cola.datosHasta` y cola `AL_DIA`: P1, motivo `RECONCILIACION`.
  - (c) `ContactoEvaluacion.proximaEvaluacionEn <= ahora` con cola `AL_DIA`: P2, tipo `REEVALUACION`, motivo `VENCIMIENTO`.
  - Invocarlo desde `ciclo.ts` cada `configEntorno.reconciliacionMin`.
  - Las filas P2 de (a) y (c) se crean aunque el histórico esté pausado, pero no se procesan mientras la pausa siga (T022). Dejar ese comportamiento en un comentario `// 042 —`.
- [X] T030 [US1] Crear `scripts/042-encolar-clasificacion-inicial.ts` (patrón de `scripts/041-sembrar-interes-contactos.ts`):
  - Inserta filas de cola P2 con tipo `INICIAL`, con `INSERT ... SELECT ... ON CONFLICT ("contactoId") DO NOTHING` por cuenta y por páginas.
  - Imprime los conteos.
  - Es idempotente.
  - Agregar `"db:backfill:analisis-contactos"` en `package.json`.
- [X] T031 [P] [US1] Test en `scripts/042-encolar-clasificacion-inicial.test.ts` de la lógica pura de paginación e idempotencia, con el mismo criterio que `scripts/041-sembrar-interes-contactos.test.ts`.
- [X] T032 [US1] Crear `src/crm/contactos/analisis/queries.ts` con `obtenerAnalisisContacto(instanciaId, contactoId)` según contracts/server-actions.md:
  - Devuelve la evaluación, el estado de la cola, `iaDisponible` (IA habilitada, análisis habilitado y proveedor activo con objetivo `ANALISIS_CONTACTOS` o un proveedor general), `interesFijado` y `accionVisible`.
  - Incluir el resultado en `obtenerResumenContacto` (`src/crm/contactos/resumen.ts`) como `analisis` y su tipo en `src/crm/contactos/types.ts`.
- [X] T033 [US1] Crear `src/crm/contactos/analisis/components/seccion-analisis-ia.tsx` (Server Component, salvo las partes interactivas) y reemplazar el "Sin analizar." de `src/crm/contactos/components/panel-contacto.tsx:214`. Muestra:
  - Puntaje (insignia), relación comercial, motivos, señales, acción visible, origen (Reglas o IA) y fecha con `<FechaHora>`.
  - "Análisis con IA no habilitado" cuando `!iaDisponible`.
  - "Análisis pendiente…" cuando la cola está PENDIENTE o EN_PROCESO.
  - "Sin analizar" si no hay evaluación.
  - Solo tokens semánticos.
- [X] T034 [US1] Columna Puntaje (FR-052a):
  - En `src/crm/contactos/vista.ts`: agregar `"PUNTAJE"` al orden de `FiltrosVistaContactos` (y a su esquema Zod en `src/crm/contactos/schema.ts`), `ordenSimple` → `[{ puntajeComercial: { sort, nulls: "last" } }, ...ORDEN_RECIENTE]` y `puntajeComercial` en `SELECT_FILA`.
  - Crear `src/crm/contactos/analisis/components/celda-puntaje.tsx`.
  - Agregar la columna ordenable a la tabla de Contactos y el puntaje a la tarjeta móvil, en los componentes de lista de `src/crm/contactos/components/`.
  - El orden por defecto sigue siendo `PRIORIDAD`.
- [X] T035 [P] [US1] Test en `src/crm/contactos/vista.test.ts`, extendiendo el existente: el orden `PUNTAJE` genera `nulls: "last"` en ambas direcciones, y los filtros y el orden por defecto no cambian.

**Checkpoint**: MVP. Todas las cuentas tienen perfil por reglas en el panel y la columna Puntaje, sin IA.

---

## Phase 4: User Story 2 — Análisis con IA del contacto con el criterio de mi empresa (Priority: P1)

**Goal**: los contactos con conversación nueva se interpretan con IA en lotes, con sugerencias de interés y de "No contactar", "Analizar con IA" y compatibilidad total con 012.

**Independent Test**: quickstart §3. Mensaje con precio y fecha → "Analizar con IA" → intención Alta, señal descrita con palabras propias, "Interés sugerido: Alto" sin cambiar el interés; al aceptar, el interés cambia con origen manual.

### Gateway y proveedores (research D9)

- [X] T036 [P] [US2] En `src/ai/proveedores/types.ts`: agregar `formatoRespuesta?: "json"` a `ChatParams` y `tokensCacheados?: number` a `ChatResult`.
- [X] T037 [P] [US2] En `src/ai/proveedores/openai.ts` y `src/ai/proveedores/deepseek.ts` (y `openai-compat.ts` si comparte la llamada):
  - Con `formatoRespuesta === "json"`, mandar `response_format: { type: "json_object" }`.
  - Leer `usage.prompt_tokens_details?.cached_tokens` (OpenAI) y `usage.prompt_cache_hit_tokens` (DeepSeek) en `tokensCacheados`.
  - Si el SDK lanza un error con `usage`, adjuntarlo al error (`err.usage`).
- [X] T038 [P] [US2] En `src/ai/proveedores/anthropic.ts`:
  - Con `formatoRespuesta === "json"`, agregar el turno de asistente con prefijo `{` y reponerlo en el contenido devuelto.
  - Leer `usage.cache_read_input_tokens` en `tokensCacheados`.
- [X] T039 [US2] En `src/ai/gateway/types.ts`, `schema.ts` y `gateway.ts`:
  - Agregar `ANALISIS_CONTACTOS` al enum de `SolicitudIASchema`.
  - Agregar `formatoRespuesta?` a `SolicitudIA`, propagado a `proveedor.chat`.
  - `RespuestaIA` pasa a incluir `proveedorIAId`, `costoEstimado` y `tokensCacheados`.
  - En la rama de error, si `err.usage` existe, registrar esos tokens y su costo en lugar de 0 (FR-040).
  - Ningún llamador existente cambia de comportamiento.
- [X] T040 [US2] En `src/ai/auditoria/logger.ts`: persistir `tokensCacheados`. Agregar `ANALISIS_CONTACTOS` a los objetivos visibles de enrutamiento del formulario de proveedores (`src/configuracion/components/form-proveedor-ia.tsx`, lista de `casosDeUso`), con la etiqueta "Análisis de contactos".
- [X] T041 [P] [US2] Tests en `src/ai/proveedores/openai.test.ts` (extender) y en `src/ai/gateway/gateway.test.ts` (crear si no existe):
  - `response_format` se envía solo con `formatoRespuesta`.
  - `tokensCacheados` se mapea.
  - El error con `usage` se registra con tokens.
  - Sin `formatoRespuesta`, el pedido es idéntico al de hoy.
  - Respaldo de proveedor (FR-025, U3): con dos proveedores activos, el asignado al objetivo `ANALISIS_CONTACTOS` con el circuit breaker abierto, `seleccionarProveedor(instanciaId, undefined, "ANALISIS_CONTACTOS")` devuelve el siguiente activo, y la atención registra el que realmente se usó.

### Contrato con la IA (research D8, contracts/ia-analisis-lote.md)

- [X] T042 [P] [US2] Crear `src/ai/analisis-contactos/salida.ts` con:
  - Esquema Zod de la salida (enums de `AccionComercial` sin RESPONDER ni NO_CONTACTAR, `intencionComercial` de `INTENCIONES_COMERCIALES` de `src/ai/estrategia/tipos.ts`, listas de hasta 5 × 120).
  - `validarSalidaLote(texto, refs, textosFuente)`, que devuelve `{ validos: Map<ref, ResultadoIAContacto>, invalidos: ref[], omitidos: ref[], loteInvalido: boolean }` aplicando la tabla de validación del contrato (ref ajena se descarta; ref duplicada descarta todas sus entradas).
  - `contieneDatosPrivados(texto, textosFuente)`: teléfono, email, URL, 7 o más dígitos seguidos, dirección (palabra de vía de research D8 —`calle`, `av.`, `avenida`, `jr.`, `jirón`, `pasaje`, `psje.`, `carrera`, `cra.`, `mz.`, `manzana`, `lote`— seguida de un número en los siguientes 15 caracteres), o subcadena de 25 o más caracteres de los textos fuente, después de normalizar espacios, mayúsculas y acentos.
  - Salud y pago **no** se detectan aquí: van solo en la instrucción fija de `prompt.ts` (FR-017a).
- [X] T043 [P] [US2] Tests en `src/ai/analisis-contactos/salida.test.ts`:
  - JSON inválido → `loteInvalido`.
  - Ref ajena, ref duplicada, ref faltante → `omitidos`.
  - `ajustePuntaje` de 41 o decimal → inválido.
  - RESPONDER como acción → inválido.
  - Privacidad: teléfono con espacios o guiones, email, URL, DNI de 8 dígitos, "Av. Arequipa 1520", "Jr. Lampa 45", "Mz. B lote 12", cita copiada de 30 caracteres con distintas mayúsculas → inválido. Una paráfrasis, "Pregunta por formas de pago" y "Vive en la avenida principal" (sin número) → válidos.
- [X] T044 [P] [US2] Crear `src/ai/analisis-contactos/contexto.ts` con `construirContextoContacto(datos, conversaciones, evaluacionAnterior, ref)`:
  - Usa `FichaConversacionIA.interpretado` (tema, intención, resumen) de las conversaciones actualizadas después de `iaHasta`.
  - Si una conversación no tiene lectura, usa sus últimos 12 mensajes posteriores a `iaHasta`, recortados a 300 caracteres.
  - Tope de unos 1.500 tokens por contacto (4 caracteres ≈ 1 token): recorta primero mensajes y después resúmenes viejos.
  - Devuelve también `textosFuente` para el filtro de privacidad.
  - Agregar en `datos-lote.ts` la carga en bloque de fichas y mensajes, **solo** para los contactos que van a la IA.
- [X] T045 [P] [US2] Crear `src/ai/analisis-contactos/prompt.ts` con `PROMPT_SISTEMA_VERSION` y `construirMensajesLote({idioma, criterio, contactos})`:
  - Las 3 capas de contracts/ia-analisis-lote.md.
  - Los datos serializados como JSON dentro de `<datos_lote>` y el criterio dentro de `<criterio_negocio>`.
- [X] T046 [P] [US2] Tests en `src/ai/analisis-contactos/prompt.test.ts` y `contexto.test.ts`:
  - Ningún cuid de contacto aparece en los mensajes.
  - El criterio queda delimitado.
  - Un texto hostil ("ignora tus instrucciones…") queda dentro de `<datos_lote>`.
  - El tope de tokens recorta en el orden correcto.
  - Sin resumen se usan mensajes recortados.
- [X] T047 [US2] Crear `src/ai/analisis-contactos/evaluar-lote.ts` con `evaluarLoteConIA({instanciaId, contactos, criterio, idioma})`, que es el `EjecutorIA` por defecto:
  - Arma el prompt, llama a `generarRespuesta({ tarea: "ANALISIS_CONTACTOS", formatoRespuesta: "json", temperatura: 0.2, entidadTipo: "EjecucionAnalisisContactos" })` y valida con `validarSalidaLote`.
  - Devuelve resultados, tokens, costo, `usoIAId`, proveedor y modelo.

### Presupuestos y límites (research D9)

- [X] T048 [US2] Crear `src/crm/contactos/analisis/motor/presupuesto.ts` con `evaluarDisponibilidadIA(instanciaId, prioridad, ahora)`, que devuelve `{ disponible, motivo? }` y revisa:
  - Presupuesto propio de la cuenta (costo o tokens) en `rangoHoy(await obtenerZonaNegocio(instanciaId))`.
  - `ConfiguracionIA.limiteTokensDiarios`: al 80 %, P2 deja de estar disponible; al 100 %, nada.
  - `ProveedorIA.limitePorMinuto` y `limitePorDia` del proveedor que atendería la tarea.
  - Presupuesto global (`configEntorno`).
  - Usa una caché en memoria de 60 s por cuenta y `registrarConsumoLocal(instanciaId, tokens, costo)` para sumar sin consultar.
  - Toda suma sobre `UsoIA` usa filtros `{ gte, lt }` (CLAUDE.md, regla 7).
- [X] T049 [P] [US2] Tests en `src/crm/contactos/analisis/motor/presupuesto.test.ts`:
  - Sin presupuesto propio → disponible.
  - Al 80 % del límite de la cuenta: P2 no, P1 sí.
  - Al 100 % → no.
  - Límite por minuto del proveedor.
  - Presupuesto global.
  - El corte del día en la zona del negocio (UTC-5 cerca de medianoche).

### Integración en el ejecutor (research D5, D8, D14)

- [X] T050 [US2] Extender `procesarLote` en `src/crm/contactos/analisis/motor/ejecutor.ts`:
  1. Después de las reglas, separar los contactos que van a la IA según el embudo de research D5: IA disponible (T048), mensajes posteriores a `iaHasta` o `forzarIA`, y antigüedad de `mesesAntiguedadInicial` cuando no hay evaluación de IA previa.
  2. Cerrar los demás por reglas en la misma atención de reglas.
  3. Para el grupo de IA, abrir una atención `modo=IA` y llamar al `ejecutorIA`.
  4. Si `loteInvalido` y hay más de 1 contacto, dividir en mitades de forma recursiva; cada mitad es una nueva atención con el mismo `loteId` y `loteRaizId`.
  5. Los válidos se escriben con `origen=IA`, `ajusteIA`, `iaHasta` y `evaluadoIAEn`.
  6. Los inválidos u omitidos van a `devolverConBackoff`, con ítems `INVALIDO`/`OMITIDO`.
  7. Estado `COMPLETADA`, `PARCIAL` o `FALLIDA` según los conteos.
  8. Si el proveedor falla, se registran los tokens informados y se aplica el backoff a todo el grupo.
  9. Al abrir la atención de IA, registrar `PROMPT_SISTEMA_VERSION` y la versión del criterio en `configAplicada`.
- [X] T051 [US2] En la misma transacción de escritura de `procesarLote`, aplicar las sugerencias (research D14):
  - Mapear intención a `interesSugerido` (ALTA→ALTO, MEDIA→MEDIO, BAJA→BAJO, DESCONOCIDA→sin sugerencia).
  - Con `modoInteres = SOLO_SUGERIR`: guardar la sugerencia como `PENDIENTE` (la anterior pendiente queda reemplazada). No sugerir si el interés está fijado o ya es igual.
  - `sugerirNoContactar` → `noContactarSugerido` + motivo + `PENDIENTE`, salvo que exista un descarte posterior al último mensaje que vio la IA.
  - **Después del commit**, con `modoInteres = APLICAR_AUTOMATICO`: llamar a `actualizarInteres({ origen: "IA", accion: { tipo: "FIJAR", nivel } })`; `FIJADO` se ignora.
  - Publicar `ContactoAnalizado` con `interesAplicado`.
- [X] T052 [US2] Línea base de consumo para SC-005 (C1), **antes** de desplegar T053: crear `scripts/042-linea-base-consumo.ts`, que con datos de producción o de una copia calcula, para los últimos 30 días y por cuenta:
  - Tokens y costo de `UsoIA` con `tarea = EXTRACCION_ENTIDADES`, `entidadTipo = "contacto"`.
  - Contactos distintos interpretados.
  - Tokens por contacto.
  - Guarda el resultado en `specs/042-contactos-analisis-ia/linea-base-consumo.json`, sin ids ni nombres de cuentas, solo agregados.
- [X] T053 [US2] Compatibilidad con 012 (FR-022, riesgo R1, research D3):
  - En `src/ai/perfil-cliente/servicio.ts`, agregar `fusionarDatosInterpretados(contactoId, instanciaId, parcial)`, que actualiza `PerfilClienteSnapshot.datosInterpretados` con los campos no nulos y conserva el resto. Si el snapshot no existe, lo crea con `recalcular` (sin `disparadoPor`) primero.
  - En `src/crm/contactos/analisis/motor/ejecutor.ts`, después del commit, llamar a `fusionarDatosInterpretados` por cada evaluación de IA (`intencionComercialActual = intencionComercial`, productos, presupuesto, ocasión, fecha requerida, `extraidoEn`, `confianza = 0.8`).
  - En `src/ai/perfil-cliente/suscriptores/invalidar-perfil.suscriptor.ts`, para `CONVERSACION_CLASIFICADA`, bifurcar con `evaluarDisponibilidadIA(instanciaId, "P0")` (T048) y `ConfiguracionAnalisisContactos.habilitado`:
    - **Activo y disponible**: `recalcular(contactoId, instanciaId)` **sin** `disparadoPor` (sin extracción) y `marcarPendiente(P0, inmediato, motivo MENSAJE)`.
    - **Desactivado o no disponible**: `recalcular(contactoId, instanciaId, envelope.tipo)` como hoy, con la extracción por evento, más `marcarPendiente(P1)`.
  - `extraccion-interpretada.ts` y la rama de extracción de `recalcular` **no se borran**: son el camino de respaldo.
- [X] T054 [US2] P0 por señal explícita: en `src/ai/ficha-conversacion/servicio.ts` (`registrarLectura`), cuando `lectura.intencion` es `LISTO_PARA_COMPRAR` o `LISTO_PARA_COTIZAR`, buscar el `contactoId` de la conversación y llamar a `marcarPendienteSinFallar(P0, inmediato, motivo MENSAJE)`.
- [X] T055 [P] [US2] Tests en `src/crm/contactos/analisis/motor/ejecutor.ia.test.ts` con un `ejecutorIA` simulado:
  - 17 de 20 válidos → `PARCIAL`, y los 3 vuelven a pendiente sin evaluación exitosa.
  - Lote inválido de 4 → divisiones 2+2 → 1+1, con atenciones registradas.
  - Error del proveedor con usage → tokens registrados.
  - Un contacto sin mensajes nuevos no va a la IA.
  - Fuera de la antigüedad en la clasificación inicial → solo reglas.
  - Sin disponibilidad → solo reglas.
  - `SOLO_SUGERIR` no llama a `actualizarInteres`; `APLICAR_AUTOMATICO` sí; interés fijado → sin sugerencia.
  - "No contactar" nunca llama a `actualizarPreferenciaContacto`.
  - `datosInterpretados` de 012 conserva los campos no devueltos.
  - En `src/ai/perfil-cliente/suscriptores/invalidar-perfil.suscriptor.test.ts`:
    - `CONVERSACION_CLASIFICADA` con análisis activo y disponible → sin extracción y P0 inmediato.
    - Con análisis desactivado → extracción por evento como hoy y P1.
    - Sin disponibilidad (presupuesto o límite) → extracción por evento como hoy.
    - Con `ConfiguracionIA.habilitado = false` → sin extracción, igual que hoy.
- [X] T056 [P] [US2] Tests de regresión de 012: verificar que `src/ai/autonomia/gate.test.ts`, `src/ai/contexto/context-builder.test.ts` y `src/ai/perfil-cliente/*.test.ts` pasan sin cambios. Ajustar solo los tests de `servicio` que esperaban la llamada a la extracción.

### Acciones e interfaz

- [X] T057 [US2] En `src/crm/contactos/clasificacion.ts` (`actualizarInteres`, rama manual con cambio), dentro de la misma transacción: `tx.contactoEvaluacion.updateMany({ where: { contactoId, instanciaId, interesSugeridoEstado: "PENDIENTE" }, data: { interesSugeridoEstado: "REEMPLAZADA" } })`.
  - Agregar el caso a `src/crm/contactos/clasificacion.test.ts`.
  - No cambiar ninguna regla de transición existente.
- [X] T058 [US2] Crear `src/crm/contactos/analisis/schema.ts` y `src/crm/contactos/analisis/actions.ts` con `analizarContactoAction`, `resolverSugerenciaInteresAction` y `resolverSugerenciaNoContactarAction`, según contracts/server-actions.md:
  - `requirePermisoAction("contactos", "modificar")`, Zod e `instanciaId` de la sesión.
  - Resolver la sugerencia con un `updateMany` condicionado a `PENDIENTE` (`SIN_SUGERENCIA` si no la encuentra) y, si se acepta, llamar a `actualizarInteres` o `actualizarPreferenciaContacto` con `origen: "MANUAL"`, registrando `sugerenciaResueltaPorId` y `sugerenciaResueltaEn`.
  - `revalidatePath("/crm/contactos")`.
- [X] T059 [P] [US2] Tests en `src/crm/contactos/analisis/actions.test.ts`:
  - Sin permiso → rechazo.
  - Un id de otra instancia → no encontrado.
  - Aceptar escribe con origen MANUAL.
  - Doble resolución → `SIN_SUGERENCIA`.
  - "Analizar" sin IA disponible → `{ ok: false }`.
- [X] T060 [US2] Interruptores mínimos (FR-030a, U1). Crear:
  - `src/crm/contactos/analisis/configuracion/schema.ts` con `InterruptoresAnalisisSchema` (`{ habilitado: boolean, historicoPausado: boolean }`).
  - `src/crm/contactos/analisis/configuracion/queries.ts` con `obtenerConfiguracionAnalisis(instanciaId)`, que devuelve los defaults si no existe la fila.
  - `src/crm/contactos/analisis/configuracion/actions.ts` con `guardarInterruptoresAnalisisAction`: `requirePermisoAction("ia", "modificar")`, Zod, upsert de `ConfiguracionAnalisisContactos` de la cuenta de la sesión, `revalidatePath` de Configuración.
  - Al desactivar `habilitado`, los contactos pendientes siguen resolviéndose por reglas (embudo D5) y 012 vuelve a la extracción por evento (T053).
- [X] T061 [P] [US2] Tests en `src/crm/contactos/analisis/configuracion/actions.test.ts`:
  - Sin permiso `ia` → rechazo.
  - Solo afecta a la cuenta de la sesión.
  - Defaults cuando no existe la fila.
- [X] T062 [US2] Crear `src/configuracion/components/analisis-contactos/interruptores-analisis.tsx` (Client, React Hook Form + Zod con `InterruptoresAnalisisSchema`) y agregarlo a `src/configuracion/components/tab-ia.tsx` en la sección nueva "Análisis de contactos":
  - "Analizar contactos con IA" (activo por defecto) y "Pausar la clasificación inicial", cada uno con una línea que explique su efecto y que el consumo corre por el proveedor de la cuenta.
  - Visible solo con permiso `ia` de escritura.
  - US3 y US6 agregan el resto de la sección.
- [X] T063 [US2] Crear `src/crm/contactos/analisis/components/boton-analizar.tsx` (Client):
  - Llama a `analizarContactoAction`, muestra "Analizando…" y consulta el estado con TanStack Query (`refetchInterval` de 3 s mientras está PENDIENTE o EN_PROCESO; query key nueva en `src/shared/query-keys.ts`).
  - Se oculta si `!iaDisponible` o si el usuario no tiene permiso.
- [X] T064 [US2] Crear `src/crm/contactos/analisis/components/sugerencia-pendiente.tsx` (Client) con "Interés sugerido: X" y "Sugerencia de la IA: No contactar" + motivo, con los botones Aceptar y Descartar. Integrar en `seccion-analisis-ia.tsx`:
  - Intención, urgencia, objeciones, recuperación.
  - Aviso "Interés fijado manualmente".
  - El botón de T063.
- [X] T065 [US2] Playwright en `tests/e2e/crm/contactos-analisis.spec.ts`, escenarios de la Historia 2 con proveedor simulado o mock de red:
  - Panel con análisis de IA, sugerencia, aceptar y descartar.
  - Interés fijado.
  - "Analizar con IA" oculto sin IA.
  - Un administrador desactiva "Analizar contactos con IA" en Configuración → IA y el botón del panel desaparece.
  - Agregar el archivo al script `test:e2e:contactos` de `package.json`.

**Checkpoint**: el analizador completo para una cuenta, con reglas e IA, sugerencias y compatibilidad con el agente.

---

## Phase 5: User Story 3 — Definir cómo analiza mi empresa a sus contactos (Priority: P2)

**Goal**: criterio con versiones por cuenta, a partir de plantillas por rubro.

**Independent Test**: plantilla "Servicios / citas" → agregar una señal → publicar → la evaluación muestra esa versión (Historia 3).

- [X] T066 [US3] Extender `src/crm/contactos/analisis/criterio/queries.ts` con:
  - `obtenerCriterioParaEdicion(instanciaId)`: publicada, borrador y lista de plantillas.
  - `obtenerCriterioVigente`, ahora leyendo la versión publicada de la base.
- [X] T067 [US3] Crear `src/crm/contactos/analisis/criterio/actions.ts` con `crearBorradorDesdePlantillaAction`, `guardarBorradorCriterioAction` y `publicarCriterioAction`, según contracts/server-actions.md:
  - `requirePermisoAction("ia", "modificar")` y validación con `CriterioContenidoSchema`.
  - Un solo BORRADOR por criterio.
  - Publicar en transacción: numerar, archivar la anterior y mover el puntero.
  - `reevaluar` marca P2, tipo `REEVALUACION`, motivo `CRITERIO` a todos los contactos de la cuenta por cursor.
- [X] T068 [P] [US3] Tests en `src/crm/contactos/analisis/criterio/actions.test.ts`:
  - Publicar numera y archiva.
  - Instrucciones de más de 2.000 caracteres → rechazo.
  - Etiquetas delimitadoras en las instrucciones → rechazo.
  - Sin permiso `ia` → rechazo.
  - `reevaluar` encola P2 sin tocar P0/P1.
- [X] T069 [US3] Crear `src/configuracion/components/analisis-contactos/editor-criterio.tsx` (Client, React Hook Form + Zod con `CriterioContenidoSchema`, `<Form>`/`<FormField>`) y agregarlo a `src/configuracion/components/tab-ia.tsx` en la sección nueva "Análisis de contactos". Incluye:
  - Selector de plantilla (`<Select>` con la prop `items`, ver `docs/selects.md`).
  - Instrucciones con contador.
  - Listas de señales y objeciones.
  - Umbrales, y pesos con la suma visible.
  - Botones "Guardar borrador" y "Publicar", con la casilla "Reevaluar contactos con el nuevo criterio".
- [X] T070 [US3] Playwright en `tests/e2e/configuracion/analisis-contactos.spec.ts` con los escenarios 1, 2, 5 y 6 de la Historia 3. Agregarlo a `test:e2e:configuracion`.

**Checkpoint**: cada cuenta habla el idioma de su negocio.

---

## Phase 6: User Story 4 — Atención justa entre empresas y prioridad a lo urgente (Priority: P2)

**Goal**: reemplazar la selección FIFO provisional por stride scheduling con cupos y préstamo.

**Independent Test**: simulador con 3 cuentas de 10.000, 10.000 y 20 contactos: los turnos alternan, la cuenta chica termina en su primer turno y un P0 se adelanta (quickstart §4).

- [X] T071 [P] [US4] Crear `src/crm/contactos/analisis/motor/planificador.ts` (puro) con:
  - `repartirEspacios(libres, cupos, demandaPorClase)`: cupos con préstamo, y P0 siempre primero si tiene demanda.
  - `siguienteTurno(actual, ahora, peso, intervaloBaseMs)` = `max(actual, ahora) + intervaloBase / peso`.
  - `elegirTurnos(estadoCuentas, capacidad, ahora)`, para simular y probar sin base de datos.
- [X] T072 [P] [US4] Tests en `src/crm/contactos/analisis/motor/planificador.test.ts`:
  - 1.000 cuentas: todas reciben un turno antes de que alguna reciba el segundo (SC-007).
  - 10.000 contra 20: la cuenta chica termina en su primer turno (SC-008).
  - Peso 2 contra 1 en 300 lotes: proporción 2:1 ±10 %.
  - Préstamo de capacidad sin P0/P1.
  - Recuperación al aparecer P0.
  - Pausa del histórico: sin turnos P2 y P1 intacto.
  - Una cuenta en su `maxLotesSimultaneos` se saltea.
  - Una cuenta que vuelve después de estar inactiva no acumula crédito.
- [X] T073 [US4] En `src/crm/contactos/analisis/cola.ts`, agregar `tomarTurnoCuenta({prioridad, excluirPausadas, ahora})` con `$queryRaw`:
  - Toma de `ConfiguracionAnalisisContactos`, con `habilitado` o con trabajo de reglas, `lotesEnCurso < maxLotesSimultaneos` y `EXISTS` de pendientes elegibles de esa prioridad (índice parcial). Con P2, además, `NOT historicoPausado` y sin la pausa global.
  - `ORDER BY "siguienteTurnoEn" LIMIT 1 FOR UPDATE SKIP LOCKED`.
  - Actualiza `siguienteTurnoEn` con `siguienteTurno(...)` y `lotesEnCurso + 1` en la misma sentencia (CTE) y devuelve `instanciaId`.
- [X] T074 [US4] En `src/crm/contactos/analisis/motor/ciclo.ts`, reemplazar la selección FIFO por `repartirEspacios` + `tomarTurnoCuenta` + `reclamarLote(tamanoLote de la cuenta)`:
  - Si el reclamo vuelve vacío (otra réplica tomó los contactos), liberar el `lotesEnCurso` y probar la siguiente clase.
  - Registrar `esperaColaMs` en la atención.
- [X] T075 [US4] Crear `scripts/042-simular-carga-analisis.ts` (quickstart §4):
  - Crea cuentas y contactos sintéticos con un prefijo identificable, levanta N procesos hijos que corren `iniciarCicloAnalisisContactos({ ejecutorIA: simulado })` con latencia y tasa de error configurables, y opcionalmente mata uno con `--matar-worker-en`.
  - Al final informa: orden de turnos por cuenta, dobles tomas (debe ser 0), contactos perdidos (0), proporción por peso y p95 de espera P0/P1.
  - Limpia los datos sintéticos al terminar (o con `--limpiar`).

**Checkpoint**: escala multiempresa verificada con el simulador.

---

## Phase 7: User Story 5 — Trazabilidad de cada atención y control de costos (Priority: P2)

**Goal**: auditoría completa (detalle, agregados y retención) y control operativo de fallidos.

**Independent Test**: un error forzado en el primer intento y éxito en el segundo dejan 2 atenciones del mismo lote, con el contacto contado una sola vez (Historia 5).

- [X] T076 [US5] Completar `src/crm/contactos/analisis/motor/auditoria.ts`: `estado` final según los conteos (COMPLETADA, PARCIAL o FALLIDA), `errorCodigo` normalizado según data-model.md (timeout, 429, 5xx, respuesta inválida, sin presupuesto) y `costoEstimado`, `tokensCacheados` y `usoIAId` desde la respuesta del gateway.
- [X] T077 [US5] Crear `src/crm/contactos/analisis/motor/retencion.ts` con `consolidarYPurgar(ahora)`, que se ejecuta una vez al día desde `ciclo.ts` (control por `ResumenDiarioAnalisisContactos` del día anterior ya existente):
  - Hace el upsert de `ResumenDiarioAnalisisContactos` por cuenta y día de negocio, sumando atenciones y detalle.
  - Borra `EjecucionAnalisisContactosItem` con `procesadoEn < ahora − 90 días` en tandas de 5.000.
- [X] T078 [P] [US5] Tests en `src/crm/contactos/analisis/motor/retencion.test.ts`:
  - El agregado suma bien atenciones con reintentos (sin contar dos veces a un contacto exitoso).
  - La purga respeta los 90 días.
  - Consolidar dos veces es idempotente.
- [X] T079 [P] [US5] Tests en `src/crm/contactos/analisis/motor/recuperacion.test.ts`:
  - Lease vencido → PENDIENTE con intentos + 1.
  - Quinto intento → FALLIDO.
  - Atención `EN_CURSO` vencida → ABANDONADA.
  - `lotesEnCurso` recalculado.
- [X] T080 [US5] Documentar en `docs/analisis-contactos.md` (sección "Consultas operativas") las consultas SQL de quickstart §5 que responden las preguntas de la Historia 5, escenario 8.

**Checkpoint**: cada atención es auditable y los costos se pueden consultar.

---

## Phase 8: User Story 6 — Ver el avance del análisis de mi cuenta (Priority: P3)

**Goal**: avance por cuenta, configuración y reintento de fallidos en Configuración → IA.

**Independent Test**: con la clasificación inicial al 40 % y fallidos, los números coinciden con el detalle y el total cuenta solo los contactos con conversación de los últimos 12 meses.

- [X] T081 [US6] En `src/crm/contactos/analisis/queries.ts`, agregar `obtenerAvanceAnalisis(instanciaId)` con el shape `AvanceAnalisis` de contracts/server-actions.md.
  - `elegiblesIA` cuenta los contactos con conversación e interacción dentro de `mesesAntiguedadInicial`.
  - Consultas en `Promise.all`, sin N+1.
  - El "hoy" usa `rangoHoy(zonaNegocio)`.
- [X] T082 [US6] Extender `src/crm/contactos/analisis/configuracion/schema.ts`, `queries.ts` y `actions.ts` (creados en T060) con `guardarConfiguracionAnalisisAction` (todos los campos de contracts/server-actions.md salvo `peso`; registra quién y cuándo cambió `modoInteres`) y `reintentarFallidosAction`, ambos con `requirePermisoAction("ia", "modificar")`. `guardarInterruptoresAnalisisAction` se mantiene.
- [X] T083 [P] [US6] Tests en `src/crm/contactos/analisis/configuracion/actions.test.ts` (extender T061):
  - Validaciones de rangos.
  - `peso` ignorado.
  - Cambiar `modoInteres` no toca los contactos.
  - `reintentarFallidos` solo afecta a la cuenta de la sesión.
- [X] T084 [US6] Crear `src/configuracion/components/analisis-contactos/panel-avance.tsx` y `form-configuracion-analisis.tsx` dentro de la sección "Análisis de contactos" de `tab-ia.tsx` (junto a los interruptores de T062, que no se duplican en el formulario):
  - Avance con la clasificación inicial (barra + "resueltos por reglas") separada de la actualización (pendientes P0/P1/P2, espera media y última atención).
  - Consumo de hoy y porcentaje del límite de la cuenta.
  - Fallidos con "Reintentar".
  - El formulario de configuración incluye el modo de interés, con una explicación de cada opción.
  - Con skeleton de carga.
- [X] T085 [US6] Playwright en `tests/e2e/configuracion/analisis-contactos.spec.ts` (extender T070) con los escenarios 2, 3 y 4 de la Historia 6, incluido que un usuario Agente Ventas no ve la sección.

**Checkpoint**: el administrador sabe si su análisis está al día y cuánto consume.

---

## Phase 9: User Story 7 — Analizar varios contactos a la vez (Priority: P3)

**Goal**: casillas en la tabla, "Analizar seleccionados" y análisis por segmento para administradores.

**Independent Test**: marcar 30 contactos → "30 contactos en análisis" → quedan P1 con `forzarIA`.

- [X] T086 [US7] En `src/crm/contactos/analisis/actions.ts`, agregar:
  - `analizarSeleccionadosAction`: 1–100 ids, solo los de la cuenta, P1, `forzarIA`.
  - `analizarSegmentoAction`: `ia`/`modificar`, reutiliza `construirWhereVista` de `vista.ts` y marca P2 por cursor con motivo `SEGMENTO`.
- [X] T087 [P] [US7] Tests en `src/crm/contactos/analisis/actions.test.ts` (extender):
  - 101 ids → rechazo.
  - Ids ajenos ignorados.
  - Segmento sin permiso `ia` → rechazo.
  - Segmento encola solo los contactos del filtro.
- [X] T088 [US7] Crear `src/crm/contactos/analisis/components/barra-seleccion.tsx` y agregar casillas de selección a la tabla de Contactos (`src/crm/contactos/components/`):
  - Seleccionar la página y limpiar.
  - Contador.
  - "Analizar seleccionados", con el aviso del resultado.
  - Para administradores, "Analizar todo el segmento" con confirmación.
  - Las acciones de fila existentes no cambian (escenario 9 de la 041).
- [X] T089 [US7] Playwright en `tests/e2e/crm/contactos-analisis.spec.ts` (extender T065) con los escenarios 1–3 de la Historia 7.

**Checkpoint**: todas las historias funcionan de forma independiente.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T090 [P] Escribir `docs/analisis-contactos.md`:
  - Arquitectura (diagrama de flujo de plan.md), configuración y variables de entorno, estados de la cola y de las atenciones.
  - El planificador justo y cómo ajustar el peso.
  - El esquema de auditoría, cómo consultar el histórico, cómo cambiar de proveedor o modelo (objetivo "Análisis de contactos" en Configuración → IA), cómo escalar workers y cómo recuperar fallidos.
  - La deuda de los límites de IA que no aplica el agente conversacional (riesgo R7).
  - El circuit breaker por proceso (riesgo R8).
- [X] T091 [P] Agregar a `CLAUDE.md` la regla 13, "Análisis de contactos (042)", con:
  - La cola en PostgreSQL y no en RabbitMQ.
  - La relación comercial no es un filtro y "Cliente" sigue saliendo de `condiciones.ts`.
  - El interés solo por `clasificacion.ts` y "No contactar" nunca por la IA.
  - La salida de la IA sin citas ni datos personales.
  - La versión monótona.
  - El puntero a `docs/analisis-contactos.md`.
- [X] T092 Verificar el riesgo R3 con grep: el motor no publica `CONTACTO_ACTUALIZADO` y ningún suscriptor escucha `CONTACTO_ANALIZADO` ni `CONTACTO_INTERES_ACTUALIZADO` para marcar pendientes.
- [ ] T093 Correr `npm run test:unit`, `npm run test:e2e:contactos`, `npm run test:e2e:configuracion`, `npm run test:e2e:pedidos` y `npm run build`. Corregir hasta que todo pase, incluidas las pruebas existentes de 038, 041 y 012, sin modificarlas salvo el ajuste documentado en T056 (SC-015).
- [ ] T094 Ejecutar quickstart.md completo (§1–§7) contra una base de desarrollo, incluido el simulador con 1.000 cuentas y 2 workers, y registrar los resultados (SC-007, SC-008, SC-012, 0 dobles tomas) en `specs/042-contactos-analisis-ia/quickstart.md` como "Resultados de validación".
- [ ] T095 Verificar SC-017 (C2): con `npm run script:seed-volumen-prueba` (una cuenta con 20.000 o más contactos), correr `EXPLAIN (ANALYZE, BUFFERS)` de la consulta que genera `vista.ts` con `orden = "PUNTAJE"` en ambas direcciones, primera y décima página. Confirmar que usa el índice `[instanciaId, puntajeComercial]` y que tarda menos de 1 s. Registrar el plan en "Resultados de validación" de quickstart.md y limpiar con `npm run script:limpiar-volumen-prueba`.
- [ ] T096 Medir SC-004 y SC-005 (C1) después de 7 días de operación con IA: con `ResumenDiarioAnalisisContactos`, el porcentaje de evaluaciones resueltas por reglas (meta ≥ 60 %) y los tokens por contacto evaluado con IA, comparados con `linea-base-consumo.json` (meta: −50 %). Registrar ambos números en "Resultados de validación" de quickstart.md. Si no se cumplen, abrir un Hotfix con el ajuste (tamaño de lote, tope de contexto o embudo).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: arranca de inmediato. T002 depende de T001.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las historias. Dentro de la fase:
  - T005/T006 → T007.
  - T008/T009 → T020.
  - T012 → T013 → T014.
  - T016 y T017 antes de T020.
  - T019 → T020 → T022 → T023.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de Foundational. Usa la sección del panel de US1 (T033) y la columna (T034), pero sus tareas de gateway, contrato y presupuesto (T036–T049) pueden avanzar en paralelo con US1.
- **US3 (Phase 5)**: depende de Foundational (T005–T007). Es independiente de US1 y US2.
- **US4 (Phase 6)**: depende de Foundational (reemplaza la selección FIFO de T022). Es independiente de US1–US3.
- **US5 (Phase 7)**: depende de Foundational (T017). T076 aprovecha los datos de costo de US2 si ya está, pero funciona con atenciones solo de reglas.
- **US6 (Phase 8)**: depende de Foundational. Aprovecha US3 (misma sección de Configuración) y US5 (agregados).
- **US7 (Phase 9)**: depende de US1 (tabla con columna) y de T058 (acciones de US2).
- **Polish (Phase 10)**: al final.

### Restricciones críticas de orden

- **Riesgo R1**: T053 (bifurcación de 012) va en la **misma entrega** que T047, T050 y T051. La extracción por evento nunca se desactiva para una cuenta antes de que el motor escriba `datosInterpretados` para esa cuenta.
- **FR-030a (U1)**: T060–T062 (interruptores) salen en la **misma entrega** que activa la IA (US2). Nunca se activa el análisis con IA sin que el administrador pueda apagarlo.
- **Histórico (I1)**: producción se despliega con `ANALISIS_CONTACTOS_HISTORICO_PAUSADO=true` hasta completar US4. T022 y T029 lo respetan desde la fase Base.

### Within Each User Story

- Tests primero (deben fallar), luego implementación.
- Contratos y esquemas Zod → servicios → acciones → componentes → E2E.

### Parallel Opportunities

- Setup: T003 y T004 en paralelo después de T001.
- Foundational: T005, T006, T008, T009, T010, T011, T015, T018 y T024 en paralelo.
- US2: T036, T037 y T038 (proveedores), T042/T043 (salida), T044, T045 y T046 (contexto y prompt), T049 en paralelo.
- US4: T071 y T072 en paralelo con todo US3.
- Con dos personas, después de Foundational: una toma US1 → US2 y otra toma US4 → US5 → US3.

---

## Parallel Example: User Story 2

```bash
# Proveedores, en paralelo (archivos distintos):
Task: "T037 JSON mode y tokens cacheados en src/ai/proveedores/openai.ts y deepseek.ts"
Task: "T038 JSON mode y tokens cacheados en src/ai/proveedores/anthropic.ts"

# Contrato con la IA, en paralelo:
Task: "T042 Validación de salida y privacidad en src/ai/analisis-contactos/salida.ts"
Task: "T044 Contexto compacto en src/ai/analisis-contactos/contexto.ts"
Task: "T045 Prompt en 3 capas en src/ai/analisis-contactos/prompt.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2 → el worker evalúa por reglas lo que se marca.
2. Phase 3 (US1) → todas las cuentas ven el perfil por reglas y el puntaje. **Validar con quickstart §1–§2 y desplegar**: costo de IA cero, sin cambios en el agente.

### Incremental Delivery

1. MVP (US1).
2. US2 → análisis con IA, en modo "Solo sugerir" para todas las cuentas, con los interruptores para apagarlo y la bifurcación de 012 (R1). El histórico sigue pausado de forma global: solo se analizan los contactos con actividad nueva y los pedidos de "Analizar con IA".
3. US4 + US5 → planificador justo y auditoría completa. **Recién entonces** correr `db:backfill:analisis-contactos` y poner `ANALISIS_CONTACTOS_HISTORICO_PAUSADO=false` en producción. Antes, revisar una muestra de 50 evaluaciones de IA buscando datos de salud o de pago (SC-018).
4. US3 → criterio por empresa.
5. US6 → avance y configuración.
6. US7 → selección múltiple.

### Notes

- Cada tarea, o grupo lógico, se commitea por separado.
- Ninguna tarea modifica `src/crm/contactos/segmentacion/condiciones.ts` (FR-003).
- Toda consulta lleva `instanciaId`; toda fecha de filtro usa `{ gte, lt }`; ningún log incluye claves, prompts ni texto de conversaciones.
