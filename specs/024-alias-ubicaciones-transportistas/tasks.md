---

description: "Task list template for feature implementation"
---

# Tasks: Alias y match de ubicaciones para transportistas

**Input**: Design documents from `/specs/024-alias-ubicaciones-transportistas/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Incluidos — Principio V de la constitución exige tests proporcionales al riesgo (unitarios para reglas de negocio, Playwright para journeys críticos), y este feature toca lógica de negocio sensible (qué campos se le exponen a la IA, FR-009) y una migración de datos (backfill).

**Organización**: Las tareas se agrupan por historia de usuario (spec.md) para poder implementar y probar cada una de forma independiente. La Fase 1 incluye, por pedido explícito del usuario, la limpieza de código muerto confirmada en `research.md` §10 — se hace antes de tocar los mismos archivos con código nuevo.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: A qué historia de usuario pertenece (US1-US5)
- Cada tarea incluye la ruta de archivo exacta

---

## Phase 1: Setup — Limpieza de código muerto

**Purpose**: Eliminar el código confirmado como muerto en `research.md` §10.1 antes de agregar `AliasUbicacion` a los mismos archivos, para no mezclar "código nuevo" con "código eliminado" en el mismo diff lógico.

- [X] T001 Eliminar `obtenerZonaEntrega` (sin ningún caller, ni siquiera en test) de `src/sales/transportistas/zonas/queries.ts`
- [X] T002 Eliminar `editarZonaEntrega` (sin caller en UI; estrategia insegura `deleteMany`+`create` que rompería alias en cascada) de `src/sales/transportistas/zonas/actions.ts`, y su bloque de test correspondiente en `src/sales/transportistas/zonas/actions.test.ts` — también se eliminó `EditarZonaEntregaSchema`/`EditarZonaEntregaInput` en `schema.ts` por quedar sin uso
- [X] T003 Eliminar `listarZonasEntregaAction` (solo usada por su propio test; la UI real llama `listarZonasEntrega` directo) de `src/sales/transportistas/zonas/actions.ts`, y su bloque de test correspondiente en `src/sales/transportistas/zonas/actions.test.ts`
- [X] T004 Correr `npm run test:unit -- zonas` y `npm run build` para confirmar que la limpieza no rompió ningún caller real — 38/38 tests pasan (`npx vitest run src/sales/transportistas`); `npm run build` completo se deja para T053 (Polish), junto con el resto de cambios

**Checkpoint**: Módulo de zonas limpio de código muerto, listo para recibir `AliasUbicacion` sin arrastrar deuda.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura de datos y motor de matching que TODAS las historias de usuario necesitan — normalización, `AliasUbicacion`, niveles de confianza. Ninguna historia puede completarse sin esto.

**⚠️ CRITICAL**: No iniciar el trabajo de ninguna historia de usuario hasta terminar esta fase.

- [X] T005 [P] Extraer la lógica de `generarSlug()` a una primitiva genérica `normalizarTexto()` en `src/shared/lib/normalizar-texto.ts`; convertir `generarSlug()` en `src/shared/lib/slug.ts` en un wrapper de una línea sobre ella (sin cambiar su comportamiento en sus ~10 call sites actuales)
- [X] T006 [P] Crear `normalizarUbicacion()` en `src/shared/entregas/normalizar-ubicacion.ts` (entrypoint de dominio sobre `normalizarTexto()`)
- [X] T007 [P] Crear `distanciaLevenshtein()`, `similitud()` y la constante `UMBRAL_SIMILITUD_APROXIMADA` en `src/shared/lib/similitud-texto.ts`
- [X] T008 [P] Tests unitarios de `normalizarTexto`/`normalizarUbicacion` (minúsculas, tildes, espacios repetidos, puntuación) en `src/shared/lib/normalizar-texto.test.ts` — 8/8 pasan, incluye regresión de `generarSlug`
- [X] T009 [P] Tests unitarios de `similitud`/`distanciaLevenshtein` (casos idénticos, error de tipeo leve, textos muy distintos) en `src/shared/lib/similitud-texto.test.ts` — 7/7 pasan
- [X] T010 Agregar a `prisma/schema.prisma`: columnas `nombreVisible String?` / `nombreNormalizado String?` en `ZonaEntregaUbicacion` (+ `@@index([nombreNormalizado])`), enum `CampoUbicacion` (`PROVINCIA_ESTADO`, `DISTRITO_CIUDAD`, `CORREGIMIENTO`, `SECTOR_O_CODIGO_POSTAL`), y el modelo `AliasUbicacion` (`zonaEntregaUbicacionId`, `campo`, `valor`, `valorNormalizado`, `instanciaId`, `@@unique([instanciaId, campo, valorNormalizado])`, índices) — ver [data-model.md](data-model.md). `npx prisma validate`/`format`/`generate` OK.
- [X] T011 Generar y aplicar la migración Prisma con las columnas nullable de T010 — escrita a mano (sin shadow DB disponible al momento de diseñarla) siguiendo el estilo exacto de Prisma; **aplicada contra la base real con `npx prisma migrate deploy`** en cuanto hubo conectividad — `prisma migrate status` confirma "Database schema is up to date!".
- [X] T012 [P] Crear `construirNombreVisible()`/`calcularNombreNormalizado()` en `src/sales/transportistas/zonas/normalizar.ts`
- [X] T013 Usar `construirNombreVisible()`/`calcularNombreNormalizado()` (T012) en `crearZonaEntrega` de `src/sales/transportistas/zonas/actions.ts` al crear cada `ZonaEntregaUbicacion`, para que los destinos nuevos ya nazcan con `nombreVisible`/`nombreNormalizado` completos
- [X] T014 Crear `scripts/backfill-normalizar-ubicaciones.ts` — exporta `calcularCamposNormalizados()` (función pura) y `ejecutarBackfill(prisma: PrismaLike)`, mismo esqueleto que `scripts/backfill-pais-transportista.ts`. Agregado también `npm run db:backfill:normalizar-ubicaciones` en `package.json` (mismo patrón que el de país)
- [X] T015 [P] Test de `scripts/backfill-normalizar-ubicaciones.test.ts` (casos: todos los niveles presentes, solo provincia, con tildes/espacios repetidos; `ejecutarBackfill` con mock de `PrismaLike`) — 6/6 pasan
- [X] T016 Ejecutar `npx tsx scripts/backfill-normalizar-ubicaciones.ts` contra la base real para completar `nombreVisible`/`nombreNormalizado` de las `ZonaEntregaUbicacion` ya existentes (FR-015) — ejecutado: 3/3 ubicaciones existentes actualizadas, 0 filas con `nombreNormalizado`/`nombreVisible` en null verificado después.
- [X] T017 Extender el motor de matching en `src/shared/entregas/resolver-costo-envio.ts` — se agregó `obtenerOpcionesEnvioConConfianza()` como función independiente (no un flag sobre `obtenerCandidatosEnvioPorZona`, que queda intacta línea por línea — más seguro que el diseño original de research.md, cero riesgo de regresión por construcción) con el algoritmo EXACTA/ALIAS/PROBABLE/AMBIGUA/SIN_COINCIDENCIA de [research.md §4](research.md#4-algoritmo-de-matching-con-niveles-de-confianza); el `include` de tarifas trae `transportista.condiciones` (pago contra entrega, días de entrega, hora límite)
- [X] T018 Test de regresión: los 13 tests existentes de `obtenerCandidatosEnvioPorZona()` siguen en verde sin ningún cambio (protege FR-010), más un test explícito nuevo confirmando que un alias registrado NO produce coincidencia en esta función, en `src/shared/entregas/resolver-costo-envio.test.ts`
- [X] T019 [P] Tests unitarios de `obtenerOpcionesEnvioConConfianza()` — EXACTA, ALIAS, PROBABLE, AMBIGUA, SIN_COINCIDENCIA y orden por precio — en `src/shared/entregas/resolver-costo-envio.test.ts` — 21/21 pasan (13 existentes + 8 nuevos)

**Checkpoint**: Motor de matching con alias y niveles de confianza listo y testeado; base de datos migrada y backfillada. Las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 - Un cliente pregunta por un destino usando una forma coloquial o abreviada (Priority: P1) 🎯 MVP

**Goal**: La IA reconoce variantes coloquiales/abreviadas/con errores leves de un destino ya configurado y responde con el precio/tiempo correctos sin escalar a un humano.

**Independent Test**: Insertar un `AliasUbicacion` directamente (test/fixture) para un destino ya configurado, invocar la tool `consultar_opciones_envio` con ese alias, y confirmar que la respuesta trae las opciones correctas con `confianza: "ALIAS"`.

### Tests for User Story 1

- [X] T020 [P] [US1] Test de `consultar_opciones_envio` — coincidencia EXACTA y ALIAS devuelven las opciones correctas ordenadas por precio, en `src/ai/tools/providers/consultar-opciones-envio.test.ts`
- [X] T021 [P] [US1] Test de `consultar_opciones_envio` — la respuesta nunca incluye `id` interno, teléfono, correo, notas internas, `costoInterno` ni margen (FR-009), en el mismo archivo de T020

### Implementation for User Story 1

- [X] T022 [US1] Crear `src/ai/tools/providers/consultar-opciones-envio.tool.ts` (`IProveedorTool`, `ArgsSchema` Zod, `execute()` que llama `obtenerOpcionesEnvioConConfianza` y construye la respuesta campo por campo — nunca `spread`) según [contracts/ai-tools.md](contracts/ai-tools.md)
- [X] T023 [US1] Crear `src/ai/tools/constantes.ts` exportando `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES` (incluye `"consultar_opciones_envio"` junto a las ya existentes)
- [X] T024 [US1] Registrar la tool nueva en `src/ai/tools/inicializar.ts` (`import "@/ai/tools/providers/consultar-opciones-envio.tool";`)
- [X] T025 [US1] Corregir `obtenerHerramientasPermitidas()` en `src/suscriptores/ai/generar-respuesta-ia.suscriptor.ts` para unir `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES` (T023) con lo persistido en `AgenteIAConfig.herramientas` (FR-011). **Extra, mismo bug confirmado en un segundo lugar**: se aplicó el mismo fix en `src/ai/simulador/servicio.ts` (018-simulador-agente) — sin esto, el simulador "Probar cómo lo encontraría la IA" mostraría un resultado distinto al de una conversación real con el mismo agente.
- [X] T026 [US1] Reemplazar la lista local `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES` de `src/configuracion/components/sheet-editar-agente.tsx` por un import de la constante compartida (T023)
- [X] T027 [US1] Test de integración: con `AgenteIAConfig.herramientas = null` (ninguna tool CRM togglable habilitada), confirmar que el suscriptor usa el camino de tool-calling (antes tomaba siempre texto plano) — regresión de T025/FR-011, en `src/suscriptores/ai/generar-respuesta-ia.suscriptor.test.ts`. Se actualizaron además los mocks de `generarConHerramientas` en ese archivo y en `src/ai/simulador/servicio.test.ts` (antes sin `mockResolvedValue`, ahora sí se ejercitan por el cambio de comportamiento) — **380/380 tests del proyecto (`npx vitest run`) en verde**, sin regresiones.

**Checkpoint**: La User Story 1 es funcional y demostrable de punta a punta — la IA responde correctamente a variantes coloquiales de un destino ya configurado.

---

## Phase 4: User Story 2 - Un administrador agrega alias a un destino ya configurado (Priority: P1)

**Goal**: Un responsable de transportistas puede agregar/eliminar alias sobre un destino ya existente desde la UI, sin crear destinos duplicados.

**Independent Test**: Desde la pestaña "Zonas y tarifas" de un transportista, agregar un alias a una ubicación existente y confirmar que queda visible en su lista de alias; confirmar que un alias duplicado (normalizado) es rechazado.

### Tests for User Story 2

- [X] T028 [P] [US2] Tests de `agregarAliasUbicacion`/`eliminarAliasUbicacion`/`listarAliasUbicacion`/`listarUbicacionesConAlias` — alta exitosa (con campo inferido y explícito), rechazo por duplicado normalizado (FR-003) + resguardo P2002, rechazo cuando `campo` corresponde a un nivel vacío del destino, eliminación exitosa (FR-004) — 13/13 en `src/sales/transportistas/zonas/alias-actions.test.ts`

### Implementation for User Story 2

- [X] T029 [P] [US2] Crear `src/sales/transportistas/zonas/alias-schema.ts` (`CrearAliasUbicacionSchema`: `zonaEntregaUbicacionId`, `campo?`, `valor` con `trim().min(1).max(150)`)
- [X] T030 [US2] Crear `src/sales/transportistas/zonas/alias-actions.ts`: `listarAliasUbicacion`, `agregarAliasUbicacion` (infiere `campo` si no viene, calcula `valorNormalizado` en el servidor, valida duplicado con mensaje explícito antes de depender de `P2002`), `eliminarAliasUbicacion` — todas con `requirePermisoAction("transportistas", ...)` y `revalidatePath("/sales/transportistas")`. **Extra necesario para T031**: `listarUbicacionesConAlias(zonaEntregaId)` — el diálogo opera a nivel de zona (research.md §8), así que necesita descubrir sus `ZonaEntregaUbicacion` antes de listar alias por cada una.
- [X] T031 [US2] Crear `src/sales/transportistas/components/dialog-alias-ubicacion.tsx` — lista las `ZonaEntregaUbicacion` de una `ZonaEntrega` (vía `listarUbicacionesConAlias`, TanStack Query) con sus alias (`Badge` + botón eliminar), input + botón "Agregar alias" por ubicación. Nueva entrada `queryKeys.transportistas.ubicacionesConAlias` en `src/shared/query-keys.ts`.
- [X] T032 [US2] Agregar el botón/ícono "Alias" junto al nombre de cada zona en `src/sales/transportistas/components/seccion-zonas-tarifas.tsx` (tanto en cada fila de tarifa como en la sección "zonas sin tarifa"), que abre `dialog-alias-ubicacion.tsx` (T031). `npx tsc --noEmit` sin errores nuevos (idéntico al baseline pre-existente); 393/393 tests del proyecto en verde.

**Checkpoint**: Historias 1 y 2 funcionan juntas — un administrador puede cargar alias desde la UI y la IA los reconoce inmediatamente.

---

## Phase 5: User Story 3 - La IA presenta varias opciones de envío con su nivel de confianza (Priority: P2)

**Goal**: Cuando hay varias opciones de envío para un destino, la IA las presenta todas ordenadas por precio, sin exponer costo interno ni margen.

**Independent Test**: Configurar dos transportistas con tarifa vigente para el mismo destino, invocar `consultar_opciones_envio` y confirmar que la respuesta trae ambas opciones ordenadas por precio, sin ningún dato financiero interno.

### Tests for User Story 3

- [X] T033 [P] [US3] Test: destino con 2+ transportistas activos devuelve todas las opciones ordenadas de menor a mayor precio — ya cubierto por T020/T021 al implementar US1 ("US3: varias opciones quedan ordenadas de menor a mayor precio" en `consultar-opciones-envio.test.ts`, más el test de orden a nivel de motor en `resolver-costo-envio.test.ts`, T019)
- [X] T034 [P] [US3] Test: destino con una única opción disponible responde sin necesidad de escalar a humano — ya cubierto ("US3: nunca escala a un humano, a diferencia de calcular_costo_envio" en el mismo archivo)

### Implementation for User Story 3

- [X] T035 [US3] `consultar-opciones-envio.tool.ts` nunca importa ni llama `transferirAHumanoInterno` (a diferencia de `calcular_costo_envio`/`validar_cobertura`) — ya documentado en el comentario de cabecera del archivo (T022). No se necesitó código adicional: la implementación de US1 (T020-T027) ya satisface las 3 tareas de esta historia por construcción.

**Checkpoint**: La comparación de opciones múltiples está probada explícitamente y verificada como libre de datos financieros internos.

---

## Phase 6: User Story 4 - Un administrador importa un lote de destinos y tarifas desde un archivo (Priority: P2)

**Goal**: Cargar un CSV/Excel de destinos y tarifas, revisando antes de confirmar destinos nuevos, coincidencias exactas, posibles duplicados y alias ambiguos.

**Independent Test**: Subir un archivo con una mezcla de destinos nuevos, uno que coincide exacto con uno existente, uno con coincidencia aproximada (posible duplicado) y uno con alias ambiguo; confirmar que la revisión previa clasifica cada fila correctamente y que la fila ambigua bloquea la confirmación hasta resolverse.

### Tests for User Story 4

- [X] T036 [P] [US4] Test de clasificación de filas (`NUEVO`/`COINCIDENCIA_EXACTA`/`POSIBLE_DUPLICADO`/`ALIAS_AMBIGUO`/`INCOMPLETA`) contra un catálogo de destinos ya configurado — 11/11 en `src/sales/transportistas/importacion-destinos/actions.test.ts`
- [X] T037 [P] [US4] Test: `confirmarImportacionDestinosAction` rechaza confirmar si queda alguna fila `ALIAS_AMBIGUO`/`INCOMPLETA` marcada para incluir (FR-013, re-clasificada server-side, nunca confía en el estado que manda el cliente), en el mismo archivo
- [X] T038 [P] [US4] Test: confirmar una importación crea/actualiza solo las filas aprobadas y registra un `HistorialImportacion{entidad: "DESTINO_TRANSPORTISTA"}` (FR-014), en el mismo archivo

### Implementation for User Story 4

- [X] T039 [P] [US4] Crear `src/sales/transportistas/importacion-destinos/types.ts` (`FilaRevisionDestino`, `EstadoFilaImportDestino`, `DecisionFilaDestino`, `PasoImportacionDestinos`, columnas fijas `COLUMNAS_DESTINO`)
- [X] T040 [P] [US4] Crear `src/sales/transportistas/importacion-destinos/schema.ts` (`FilaDestinoImportSchema`, `RevisarImportacionDestinosSchema`, `ConfirmarImportacionDestinosSchema`)
- [X] T041 [US4] Crear `src/sales/transportistas/importacion-destinos/actions.ts`: `revisarImportacionDestinosAction` (clasifica cada fila sin persistir) y `confirmarImportacionDestinosAction` (transacción por lotes de `CHUNK = 100`, crea/actualiza `ZonaEntrega`/`ZonaEntregaUbicacion`/`AliasUbicacion`/`TarifaTransportistaZona`, cierra con `HistorialImportacion`, `revalidatePath`). **Extra necesario para clasificar**: nueva función exportada `buscarUbicacionesCoincidentes()` en `src/shared/entregas/resolver-costo-envio.ts` — a diferencia de `obtenerOpcionesEnvioConConfianza` (que exige tarifa vigente), esta busca destinos por geografía/alias sin requerir tarifa, indispensable para detectar `NUEVO` correctamente. Con sus propios tests (T019 ampliado, 4 casos) en `resolver-costo-envio.test.ts`.
- [X] T042 [P] [US4] Crear `src/sales/transportistas/importacion-destinos/components/paso-archivo.tsx` (reutiliza `parsearArchivo()` de `src/crm/datos/utils/`)
- [X] T043 [P] [US4] Crear `src/sales/transportistas/importacion-destinos/components/paso-mapeo-columnas.tsx` (columnas fijas del dominio, no configurables)
- [X] T044 [US4] Crear `src/sales/transportistas/importacion-destinos/components/paso-revision.tsx` (tabla agrupada por estado, toggle "crear nuevo/usar existente" para `POSIBLE_DUPLICADO` — sin `RadioGroup`, no existe ese primitivo en el proyecto; se usan 2 `Button` toggleables — filas `ALIAS_AMBIGUO`/`INCOMPLETA` bloqueadas, resumen de conteo)
- [X] T045 [P] [US4] Crear `src/sales/transportistas/importacion-destinos/components/paso-confirmacion.tsx`
- [X] T046 [US4] Crear `src/sales/transportistas/importacion-destinos/components/wizard-importacion-destinos.tsx` (orquesta los 4 pasos)
- [X] T047 [US4] Agregar el botón "Importar destinos" en el header de `src/sales/transportistas/components/seccion-zonas-tarifas.tsx`, que abre el wizard (T046). `npx tsc --noEmit` idéntico al baseline; 408/408 tests del proyecto en verde.

**Checkpoint**: Se puede poblar el catálogo de destinos/alias por lote, sin crear duplicados y con revisión humana de los casos dudosos.

---

## Phase 7: User Story 5 - La IA comunica cuando una ubicación es ambigua o no tiene cobertura (Priority: P3)

**Goal**: Ante una ubicación no reconocible o ambigua, la IA lo comunica en vez de inventar un precio.

**Independent Test**: Consultar por un destino inexistente → `SIN_COINCIDENCIA`; consultar por un texto que coincide de forma aproximada con dos destinos distintos sin alias que los distinga → `AMBIGUA`, con mensaje pidiendo precisión.

### Tests for User Story 5

- [X] T048 [P] [US5] Test end-to-end de la tool: texto sin ninguna coincidencia devuelve `confianza: "SIN_COINCIDENCIA"`, `opciones: []` y el mensaje de cobertura por verificar (FR-007) — ya cubierto por T020/T021 al implementar US1 ("US5: SIN_COINCIDENCIA..." en `consultar-opciones-envio.test.ts`)
- [X] T049 [P] [US5] Test end-to-end de la tool: coincidencia solo `PROBABLE`/`AMBIGUA` (sin EXACTA/ALIAS) devuelve las opciones candidatas con mensaje pidiendo precisar — ya cubierto ("US5: AMBIGUA..." y "PROBABLE devuelve la opción con mensaje de aclaración", mismo archivo). Complementado por el test de `AMBIGUA` a nivel de motor en `resolver-costo-envio.test.ts` (T019).

### Implementation for User Story 5

- [X] T050 [US5] `mensajePorConfianza()` (en `consultar-opciones-envio.tool.ts`, T022) ya cubre los 3 casos que necesitan aclaración (`PROBABLE`/`AMBIGUA`/`SIN_COINCIDENCIA`) con redacción en lenguaje natural verificada por los tests de T048/T049 — no se necesitó ajuste adicional. Historia 5 quedó satisfecha por construcción al implementar US1 (mismo patrón que Historia 3).

**Checkpoint**: Todas las historias de usuario (US1-US5) son funcionales de forma independiente.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de deuda documental, extensión de e2e, y validación final de punta a punta.

- [X] T051 [P] Actualizar `tests/sales/transportistas.md` con los casos de país/zonas/tarifas (022/023, faltantes hoy) y los nuevos de alias/importación (024) — ver [research.md §10.2](research.md#102-a-actualizar-no-eliminar). Nota: condiciones (US4/P2 de spec 022) sigue sin CRUD, así que no se agregó checklist para eso — sigue fuera de alcance.
- [X] T052 Extender `tests/e2e/sales/transportistas.spec.ts` con TR-13 (agregar/eliminar alias desde la UI) y TR-15 (importar un CSV → revisar → confirmar), siguiendo los Escenarios 1 y 5 de [quickstart.md](quickstart.md). No se agregó un e2e para TR-14 (la IA reconociendo alias en una conversación real) — verificarlo en UI end-to-end requiere un entorno de conversación simulada que excede el alcance de Playwright sobre esta pantalla; queda cubierto por los tests de integración de la tool (T020/T021/T048/T049).
- [X] T053 `npm run build` completo — **compiló exitosamente** (`✓ Compiled successfully`, 55/55 páginas generadas, `/sales/transportistas/[id]` incluye los componentes nuevos). `npx tsc --noEmit` da exactamente los mismos 16 errores pre-existentes de antes de este feature (verificado con diff en cada fase, cero errores nuevos). `npx vitest run` completo: **408/408 tests en verde**, 56 archivos.
- [ ] T054 Ejecutar manualmente los 7 escenarios de [quickstart.md](quickstart.md) contra un entorno con datos reales — **bloqueado, sin conectividad de BD en este entorno** (mismo bloqueo que T011/T016/T022 de spec 023). Los 7 escenarios están cubiertos por tests automatizados equivalentes (unitarios + el e2e de T052) pero falta la corrida manual de extremo a extremo contra datos reales.
- [ ] T055 Migración de seguimiento (no bloqueante, ejecutar una vez aplicada la migración de T011 y confirmado el backfill de T016 en producción): `ALTER COLUMN "nombreVisible" SET NOT NULL, ALTER COLUMN "nombreNormalizado" SET NOT NULL` en `ZonaEntregaUbicacion` — mismo patrón pendiente que `Transportista.paisId` (spec 023, T022)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Limpieza (Phase 1)**: sin dependencias — puede arrancar de inmediato. Bloquea la Fase 2 solo en los archivos que comparte (`zonas/actions.ts`, `zonas/queries.ts`) — conviene terminarla antes de T013 (que edita `zonas/actions.ts`).
- **Foundational (Phase 2)**: depende de Phase 1 completa en los archivos compartidos. BLOQUEA todas las historias de usuario.
- **User Stories (Phase 3-7)**: todas dependen de Foundational (Phase 2) completa.
  - US1 y US2 (P1) no dependen entre sí — pueden ir en paralelo (dos desarrolladores) o secuencialmente en el orden del spec.
  - US3 (P2) depende de la tool creada en US1 (T022) — no puede empezar antes.
  - US4 (P2) depende de Foundational (motor de matching, T017) pero no de US1/US2/US3 — es independiente de la IA.
  - US5 (P3) depende de la tool creada en US1 (T022) — no puede empezar antes.
- **Polish (Phase 8)**: depende de que las historias que se vayan a entregar estén completas.

### Parallel Opportunities

- T005, T006, T007, T008, T009 (normalización/similitud) en paralelo — archivos distintos, sin dependencias entre sí.
- T012, T015, T019 en paralelo con lo anterior una vez existan sus prerequisitos directos.
- US1 y US2 en paralelo (dos desarrolladores) una vez cerrada Foundational.
- US4 en paralelo con US1/US2/US3 (no comparte archivos con la tool de IA) una vez cerrada Foundational.
- Dentro de cada historia, las tareas marcadas [P] (tests, o componentes en archivos distintos) pueden ejecutarse en paralelo.

---

## Implementation Strategy

### MVP First (User Story 1 + 2 — ambas P1)

1. Fase 1: Limpieza.
2. Fase 2: Foundational (CRÍTICA — bloquea todo lo demás).
3. Fase 3: User Story 1 → **STOP y VALIDAR**: probar con un alias insertado directo en BD que la IA responde bien.
4. Fase 4: User Story 2 → **STOP y VALIDAR**: cargar un alias desde la UI y repetir la prueba de la IA end-to-end real.
5. Con US1+US2 completas ya hay un MVP demostrable: alias administrables + IA que los reconoce.

### Incremental Delivery

1. Limpieza + Foundational → base lista.
2. US1 → demo con datos sembrados directo en BD (IA responde a alias).
3. US2 → demo real end-to-end (admin carga alias → IA los usa).
4. US3 → demo de comparación de opciones sin datos internos.
5. US4 → demo de importación masiva.
6. US5 → demo de manejo de ambigüedad.
7. Polish → cierre de documentación, e2e y validación final.
