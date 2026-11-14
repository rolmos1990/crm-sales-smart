---

description: "Task list — 031-memoria-y-ficha-conversacion"
---

# Tasks: Memoria conversacional configurable y ficha de conversación

**Input**: Design documents from `/specs/031-memoria-y-ficha-conversacion/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluidos. No son opcionales acá — SC-001 exige un test de regresión
automatizado, `research.md` D16 enumera los archivos, y el principio V de la
constitución no considera completo un cambio sin tests proporcionales al riesgo.

**Organization**: agrupadas por historia de usuario. Cada historia se implementa,
se prueba y se suelta sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: US1 / US2 / US3, según `spec.md`
- Toda tarea lleva la ruta exacta del archivo

---

## Phase 1: Setup — la red de seguridad

**Purpose**: congelar el comportamiento actual **antes** de tocar nada. Si estos
tests no están en verde al final de cada fase, el corte no avanza.

- [X] T001 Congelar el `systemPrompt` actual como fixture de regresión byte a byte en `src/ai/prompt/builder.test.ts` — un agente sin ficha ni memoria debe producir exactamente el mismo string después de la feature (SC-001, FR-030)
- [X] T002 [P] Agregar el caso de regresión de `contenidoReservado` en `src/ai/contexto/context-builder.test.ts` — con las capas 6 y 7 en `null`, el string compuesto es idéntico al actual (SC-001)
- [X] T003 [P] Registrar en `src/ai/contexto/constructor.test.ts` el conteo de mensajes vigente hoy (13 con `limiteTokensCtx = 4000`) como caso "sin configuración" (FR-002)

**Checkpoint**: la red está puesta. Cualquier regresión futura falla acá primero.

---

## Phase 2: Foundational — plomería compartida

**Purpose**: los campos de configuración y su propagación hasta la canalización
de respuesta. Sin esto ninguna historia puede empezar.

**⚠️ CRITICAL**: ninguna historia arranca hasta que esta fase cierre.

> **Nota de alcance**: las **dos** claves (`memoria` y `ficha`) se agregan al
> esquema en esta fase, aunque `ficha` recién se use en US2. Es un solo archivo
> y una sola edición; partirlo en dos fases implicaría tocar
> `ConfigAtencionIASchema` dos veces con riesgo de conflicto. `ficha` queda
> invisible hasta que US2 agregue su control al formulario.

- [X] T004 Agregar `memoria` y `ficha` a `ConfigAtencionIASchema` en `src/workflows/definicion/schema.ts`, ambos `.optional()` **sin** `.default({})` — ver el bloque de código en `contracts/config-nodo-atencion-ia.md` y el porqué en `research.md` D4
- [X] T005 Agregar `memoria?: { activa: boolean; cantidad: number }` y `ficha?: boolean` a `ParamsRespuestaIA` en `src/ai/respuesta/responder-con-agente.ts`, y reflejarlo en el contrato de adaptadores de `src/workflows/motor/tipos.ts` (solo tipos, sin cambio de comportamiento)
- [X] T006 Propagar `c.memoria` y `c.ficha` desde `responderIA()` en `src/workflows/motor/nodos.ts` hacia `ctx.deps.responderConAgente` — ningún otro llamador los envía, que es como se cumple FR-034
- [X] T007 Agregar a `src/workflows/definicion/catalogo-nodos.test.ts` el caso de que `configInicial()` de `ATENCION_IA` sigue **sin** las claves `memoria` ni `ficha`, y que reparsear la configuración de un nodo ya publicado las deja en `undefined` (FR-002)

**Checkpoint**: la plomería existe y no cambió ningún comportamiento todavía. T001–T003 siguen verdes.

---

## Phase 3: User Story 1 — El negocio decide cuánta conversación recuerda el agente (Priority: P1) 🎯 MVP

**Goal**: la perilla de memoria funciona de punta a punta, desde el panel del
nodo hasta la cantidad real de mensajes que recibe el modelo.

**Independent Test**: configurar "Cuántos recordar = 3" sobre una conversación
de 12 mensajes y verificar que el agente recibe exactamente los últimos 3;
apagar el interruptor y verificar que recibe solo el último mensaje del cliente.

### Tests for User Story 1

- [X] T008 [P] [US1] Crear `src/ai/contexto/router.test.ts` cubriendo `resolverDecisionContexto`: el override explícito gana sobre el presupuesto, **sin** el piso de 3 actual (pedir 1 devuelve 1), y con `tokensReservadosExtra = 0` el resultado es idéntico al de hoy
- [X] T009 [P] [US1] Extender `src/ai/contexto/constructor.test.ts` con los tres estados de `memoria` (ausente / `activa: true, cantidad: N` / `activa: false`), el caso de mensajes sin texto que no deben consumir cupo, y `maxMensajes` ganando como tope duro sobre `memoria.cantidad` — tabla completa en `quickstart.md` paso 1a
- [X] T010 [P] [US1] Agregar a `src/workflows/definicion/validador.test.ts` el caso de `memoria.cantidad` fuera de 1–30 bloqueando la publicación del Workflow (FR-008)

### Implementation for User Story 1

- [X] T011 [US1] Agregar los parámetros `override?: number` y `tokensReservadosExtra?: number` a `resolverDecisionContexto` en `src/ai/contexto/router.ts`; cuando viene `override`, `mensajesAIncluir` es ese número exacto y no se aplica el piso de 3 (research D1)
- [X] T012 [US1] En `src/ai/contexto/constructor.ts`: agregar `memoria` a `OpcionesContexto`, honrar `maxMensajes` como tope duro, hacer dinámico el `take: 30` del query, **filtrar los mensajes sin texto antes de cortar** (hoy filtra después) y resolver `activa: false` como el último mensaje con remitente `CONTACTO` (research D1, D2)
- [X] T013 [US1] Pasar `params.memoria` a `construirContexto` desde `responderConAgente` en `src/ai/respuesta/responder-con-agente.ts`
- [X] T014 [P] [US1] Agregar a `FormAtencionIA` en `src/workflows/components/editor/formularios-nodo.tsx` el `<Switch>` "Leer mensajes anteriores" y el campo "Cuántos recordar" (1–30, 10 al encender), respetando las transiciones de la clave `memoria` de `contracts/config-nodo-atencion-ia.md` — apagar el switch escribe `{ activa: false }`, no borra la clave
- [X] T015 [P] [US1] Agregar el segmento `· recuerda N` / `· sin memoria` al caso `ATENCION_IA` de `src/workflows/components/editor/resumen-nodo.ts`, sin texto extra cuando `memoria` está ausente (FR-006)
- [X] T016 [US1] ⚠️ Hacer que el `maxMensajes: 15` de `src/conversaciones/actions-ia.ts:45` se cumpla — "sugerir respuesta" pasa de 13 a 15 mensajes. **Única excepción a FR-034**, decidida en `research.md` D3; mencionarla en el PR. Si el negocio la veta, la tarea se invierte: quitar el parámetro de ese punto de llamada
- [ ] T017 [US1] Validar la historia con `quickstart.md` paso 1 (unitario, editor y end-to-end) y confirmar que T001–T003 siguen verdes — **paso 1a hecho y en verde**; 1b (editor) y 1c (end-to-end) requieren una instancia corriendo con proveedor IA configurado

**Checkpoint**: US1 entregable sola. Ya resuelve el síntoma reportado, sin migración ni costo de IA.

---

## Phase 4: User Story 2 — El agente recuerda qué ya mostró y qué dejó preguntado (Priority: P2)

**Goal**: la ficha registra hechos verificables tras cada turno y el agente los
recibe en el turno siguiente con reglas de consistencia explícitas.

**Independent Test**: hacer que el agente informe un precio; en el turno
siguiente preguntar de nuevo por el mismo producto y verificar que no da un
monto distinto sin anunciar el cambio.

### Entidad y módulo

- [X] T018 [US2] Agregar `model FichaConversacionIA` a `prisma/schema.prisma` con las relaciones inversas en `Conversacion` e `Instancia`, según el bloque de `data-model.md` §2
- [X] T019 [US2] Generar la migración aditiva `prisma/migrations/<timestamp>_ficha_conversacion_ia/` con `npm run db:migrate` — tabla nueva, sin backfill (la ausencia de fila es un estado válido)
- [X] T020 [P] [US2] Crear `src/ai/ficha-conversacion/tipos.ts` con `HechosConversacion`, `LecturaConversacion` y `FichaConversacion`, según `data-model.md` §3 y §4

### Tests for User Story 2

- [X] T021 [P] [US2] Crear `src/ai/ficha-conversacion/hechos.test.ts` cubriendo la regla de doble condición del precio con sus casos de formato (`16`, `16.00`, `16,00`), el caso de `buscar_productos` con 5 precios y uno solo mencionado, el caso "alrededor de 15" que **no** registra, la extracción de la última interrogación y la prioridad de producto en foco (research D6, D7, D8)
- [X] T022 [P] [US2] Crear `src/ai/contexto/capas/estado-conversacion.test.ts`: sin ficha devuelve `null`, ficha con `actualizadoEn < conversacion.atencionDesde` devuelve `null` (research D14), y el texto emitido respeta el encabezado y las frases obligatorias de `contracts/capas-contexto.md`
- [X] T023 [P] [US2] Extender `src/ai/respuesta/responder-con-agente.test.ts`: con la escritura de la ficha fallando el mensaje igual se envía (FR-014); con `accion !== "ENVIADO"` no se escribe nada; **y una llamada sin el parámetro `ficha` no consulta ni escribe nada** (FR-034 — ver "Riesgo de desviación" en `plan.md`)

### Implementation for User Story 2

- [X] T024 [US2] En `ejecutarConTools` de `src/ai/respuesta/responder-con-agente.ts`, capturar argumentos y resultados de `consultar_precio_actual`, `consultar_disponibilidad`, `buscar_productos`, `crear_cotizacion` y `crear_pedido` — hoy solo se guardan los nombres; seguir el patrón que ya existe para `transferir_a_humano`
- [X] T025 [US2] Crear `src/ai/ficha-conversacion/hechos.ts` con la derivación determinista de `HechosConversacion`: matcher de precio tolerante a formato, última oración interrogativa, prioridad de producto en foco y acumulación de documentos (research D6, D7, D8)
- [X] T026 [US2] Crear `src/ai/ficha-conversacion/servicio.ts` y `src/ai/ficha-conversacion/queries.ts` con `registrarHechos()` / `obtenerFicha()` — `upsert` por `conversacionId` (idempotente) y toda query acotada por `instanciaId` (FR-033)
- [X] T027 [US2] Escribir la ficha en `src/ai/respuesta/responder-con-agente.ts` **después** de `enviarMensajeInterno`, junto a `ensamblarYPersistirRegistro`, dentro de `try/catch`, y solo cuando `accion === "ENVIADO"` (research D9, FR-014)
- [X] T028 [US2] Crear `src/ai/contexto/capas/estado-conversacion.ts` — capa 6, tolerante a fallo, con el texto exacto de `contracts/capas-contexto.md`, la comprobación de vigencia de D14 y el truncado de D15
- [X] T029 [US2] En `src/ai/contexto/context-builder.ts`: agregar `fichaOverride?: FichaConversacion | null` a `InsumosContexto` (espejo de `perfilClienteOverride`) y componer `contenidoReservado` en el orden 6→7→8→9 (research D12, D13)
- [X] T030 [US2] Reordenar `src/ai/contexto/constructor.ts` para resolver la ficha **antes** de decidir la cantidad de mensajes, y pasar su tamaño estimado como `tokensReservadosExtra` a `resolverDecisionContexto` (research D11, FR-007) — sin ficha el resultado debe quedar idéntico
- [X] T031 [P] [US2] Agregar a `FormAtencionIA` en `src/workflows/components/editor/formularios-nodo.tsx` el `<Switch>` "Recordar en qué va la conversación", apagado por omisión
- [X] T032 [P] [US2] Agregar el segmento `· con ficha` al caso `ATENCION_IA` de `src/workflows/components/editor/resumen-nodo.ts`
- [X] T033 [US2] Armar una ficha simulada en `src/ai/simulador/servicio.ts` y pasarla como `fichaOverride`, sin leer ni escribir la tabla real (FR-032)
- [ ] T034 [US2] Validar la historia con `quickstart.md` paso 2, incluido el escenario de precio de SC-004 y el de pregunta abierta de SC-005 — **pasos 2a y 2b hechos y en verde**; 2c (end-to-end) requiere la migración aplicada y una instancia corriendo

**Checkpoint**: US1 y US2 funcionan de forma independiente. Costo de IA sin cambios.

---

## Phase 5: User Story 3 — El agente entiende el tema y la fase de la conversación (Priority: P3)

**Goal**: una lectura interpretada de la conversación, derivada después del
envío, entregada al agente marcada como no confirmada.

**Independent Test**: sostener una conversación de 6 turnos en el simulador y
verificar que desde el segundo el contexto incluye tema, intención y datos
faltantes coherentes, sin que cambie el tiempo de respuesta percibido.

### Tests for User Story 3

- [X] T035 [P] [US3] Crear `src/ai/ficha-conversacion/extraccion.test.ts`: JSON válido puebla `LecturaConversacion`; fallo del proveedor, timeout de 10 s o texto no parseable devuelven `null` y el llamador conserva la lectura anterior (FR-023); una `intencion` fuera de `IntencionComercial` se descarta a `null`
- [X] T036 [P] [US3] Agregar a `src/ai/contexto/capas/estado-conversacion.test.ts` los casos de la capa 7: sin lectura devuelve `null`, y con lectura emite el encabezado "interpretada, no confirmada" y respeta los truncados de 500/200 caracteres (FR-024, research D15)

### Implementation for User Story 3

- [X] T037 [US3] Crear `src/ai/ficha-conversacion/extraccion.ts` calcado de `src/ai/perfil-cliente/extraccion-interpretada.ts`, con `tarea: "EXTRACCION_ENTIDADES"`, timeout de 10 s y el prompt JSON de `contracts/capas-contexto.md`; nunca lanza
- [X] T038 [US3] Agregar `registrarLectura()` a `src/ai/ficha-conversacion/servicio.ts` conservando la lectura anterior cuando la derivación devuelve `null` (FR-023, misma regla que la spec 012)
- [X] T039 [US3] Reemplazar el cuerpo de `producirCapaDatosConocidosFaltantes()` en `src/ai/contexto/capas/placeholders.ts` — deja de devolver `null` siempre y pasa a emitir la capa 7 según `contracts/capas-contexto.md`
- [X] T040 [US3] Pasar los insumos de la capa 7 desde `src/ai/contexto/context-builder.ts`, manteniendo el orden 6→7→8→9 ya establecido en T029
- [X] T041 [US3] Disparar la derivación en `src/ai/respuesta/responder-con-agente.ts` después de escribir los hechos, con `await`, timeout acotado y `try/catch` — nunca antes del envío (research D10, FR-022)
- [X] T042 [US3] Completar la ficha simulada de `src/ai/simulador/servicio.ts` con una `LecturaConversacion` simulada (FR-032)
- [ ] T043 [US3] Validar la historia con `quickstart.md` paso 3, incluida la medición de latencia con la ficha apagada y encendida (SC-003) — **paso 3a hecho y en verde**; 3b (latencia) y 3c (simulador) requieren una instancia corriendo

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T044 [P] Agregar a `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` una nota de cierre indicando que las capas 6 y 7 dejaron de ser placeholders, con el mismo formato que la §12 de la spec 028
- [X] T045 [P] Revisar que los puntos de extensión tocados lleven el comentario `031-memoria-y-ficha-conversacion` con su decisión de `research.md`, siguiendo la convención de las specs 009–018 en `src/ai/contexto/` y `src/workflows/definicion/schema.ts`
- [X] T046 Correr `npm run test:unit` y `npm run build` completos — el principio V de la constitución no considera completo un cambio que no compila o cuyos tests no pasan
- [ ] T047 Recorrer `quickstart.md` entero y marcar la tabla final de criterios SC-001 a SC-009

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato y debe cerrar antes de cualquier cambio de código
- **Foundational (Phase 2)**: depende de Phase 1 — **bloquea las tres historias**
- **US1 (Phase 3)**: depende de Phase 2. Sin dependencias de otras historias
- **US2 (Phase 4)**: depende de Phase 2. No depende de US1
- **US3 (Phase 5)**: depende de Phase 2 **y de T018–T020 de US2** (usa la columna `interpretado` de la tabla creada ahí)
- **Polish (Phase 6)**: depende de las historias que se vayan a soltar

### Dentro de cada historia

- Los tests van antes de la implementación que cubren
- Entidad y tipos antes de los servicios; servicios antes de las capas; capas antes del formulario
- El test de regresión de T001–T003 se corre al cerrar **cada** fase, no solo al final

### Dependencias puntuales a vigilar

| Tarea | Depende de | Por qué |
|---|---|---|
| T006 | T004, T005 | No puede propagar campos que el tipo y el esquema todavía no tienen |
| T013 | T011, T012 | `construirContexto` tiene que aceptar `memoria` primero |
| T025 | T024 | Sin los resultados de herramientas capturados no hay de dónde derivar |
| T027 | T025, T026 | Necesita la derivación y el servicio de escritura |
| T030 | T011, T028 | Necesita el parámetro de reserva y la capa que da el tamaño |
| T039, T041 | T037, T038 | La capa 7 y el disparo necesitan la extracción y su persistencia |

### Parallel Opportunities

- T002 y T003 en paralelo dentro de Setup
- US1: T008, T009, T010 en paralelo (tres archivos de test distintos); después T014 y T015 en paralelo con T011–T013 (UI vs. canalización, sin solape)
- US2: T021, T022, T023 en paralelo; T031 y T032 en paralelo con T024–T030
- US3: T035 y T036 en paralelo
- Polish: T044 y T045 en paralelo
- **US1 y US2 pueden ir en paralelo** con dos personas apenas cierra Phase 2 — el único archivo compartido es `formularios-nodo.tsx` (T014 / T031) y `resumen-nodo.ts` (T015 / T032), que tocan bloques distintos del mismo caso

---

## Parallel Example: User Story 1

```bash
# Los tres archivos de test de US1, en paralelo:
Task: "Crear src/ai/contexto/router.test.ts con los casos de override"
Task: "Extender src/ai/contexto/constructor.test.ts con los tres estados de memoria"
Task: "Agregar a src/workflows/definicion/validador.test.ts el caso de rango 1-30"

# Después, UI y canalización en paralelo:
Task: "FormAtencionIA: switch + cantidad en formularios-nodo.tsx"
Task: "Chip de memoria en resumen-nodo.ts"
```

---

## Implementation Strategy

### MVP primero (solo US1)

1. Phase 1 — red de seguridad
2. Phase 2 — plomería (bloquea todo)
3. Phase 3 — US1
4. **PARAR Y VALIDAR**: `quickstart.md` paso 1 completo, T001–T003 en verde
5. Soltar — US1 ya resuelve el síntoma reportado, sin migración ni costo de IA

### Entrega incremental

1. Setup + Foundational → base lista
2. US1 → validar → soltar (**MVP**)
3. US2 → validar → soltar (acá entra la migración)
4. US3 → validar → soltar (acá entra el costo de IA por turno)
5. Cada corte agrega valor sin romper el anterior

### Con dos personas

Apenas cierra Phase 2: una toma US1 (`workflows/` + `contexto/`), otra toma la
entidad y el módulo de US2 (`prisma/` + `ficha-conversacion/`). Coordinar
`formularios-nodo.tsx` y `resumen-nodo.ts`, que son los dos únicos archivos
donde se cruzan.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes
- La etiqueta `[Story]` mapea cada tarea a su historia para trazabilidad
- Verificar que los tests fallen antes de implementar lo que cubren
- Commit por tarea o por grupo lógico
- **T016 es la única tarea que cambia comportamiento fuera del Workflow.** Si el
  negocio veta la decisión D3, se invierte: en vez de honrar el parámetro, se
  quita del punto de llamada. Nada más del plan se mueve
- El riesgo de desviación a vigilar está en `plan.md`: `responderConAgente` lo
  comparten el nodo de Workflow y el suscriptor de mensajes entrantes. T023
  existe precisamente para eso

---

## Estado al cierre de `/speckit-implement` (2026-11-14)

**43 de 47 tareas completas.** Todo el código está escrito y verificado con lo
que se puede verificar sin una instancia corriendo:

- `npm run test:unit` — 119 archivos, 1202 tests, todos en verde (eran 116 /
  1140 antes de esta feature: +3 archivos, +62 tests)
- `npm run build` — limpio
- `npx tsc --noEmit` — sin errores nuevos (los 6 que quedan son preexistentes,
  en `panel-config-disparadores.tsx`, `resend.provider.ts`, `mock-prisma.ts` y
  `select-moneda.tsx`, ninguno tocado por esta feature)

### Lo que falta, y por qué

**La migración está escrita pero NO aplicada.**
`prisma/migrations/20261114000000_ficha_conversacion_ia/` existe y el esquema
valida, pero `DATABASE_URL` apunta a una base Supabase real y aplicar una
migración ahí es decisión del dueño del proyecto, no del agente. Correr
`npm run db:migrate` cuando corresponda.

Hasta que se aplique, **US1 funciona completo** (no toca la base) y US2/US3
fallarían al escribir la ficha — lo cual, por diseño, degrada sin romper
nada: el `try/catch` de FR-014 deja el mensaje enviado igual.

| Tarea | Qué falta | Por qué |
|---|---|---|
| T017 | `quickstart.md` 1b y 1c | Requieren el editor abierto y una conversación real con proveedor IA |
| T034 | `quickstart.md` 2c | Requiere la migración aplicada y una instancia corriendo |
| T043 | `quickstart.md` 3b y 3c | Medición de latencia real y simulador contra una instancia |
| T047 | Recorrido completo del quickstart | Depende de las tres anteriores |

Los pasos automatizables de cada una (1a, 2a, 2b, 3a) sí se ejecutaron y están
en verde.

### Decisión que sigue abierta

**T016 / research D3** quedó implementada en el sentido "honrar el parámetro":
`src/conversaciones/actions-ia.ts` hace que "sugerir respuesta" pase de 13 a 15
mensajes. Es el único cambio de comportamiento fuera del nodo Atención IA y
está comentado en el código. Si el negocio lo veta, revertirlo es quitar
`maxMensajes: 15` de esa llamada — una línea, sin tocar nada más.
