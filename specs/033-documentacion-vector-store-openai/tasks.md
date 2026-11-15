---

description: "Task list for 033-documentacion-vector-store-openai"
---

# Tasks: Documentación del comercio consultable bajo demanda

**Input**: Design documents from `/specs/033-documentacion-vector-store-openai/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/interfaces.md](./contracts/interfaces.md),
[quickstart.md](./quickstart.md)

**Tests**: Incluidos. No son opcionales acá: el Principio V de la Constitución los exige proporcionales al
riesgo. Entre comercios el aislamiento es físico (un índice por cuenta), pero dentro de una cuenta conviven
los documentos de todos sus agentes, y eso solo se contiene con tests que se pongan en rojo si alguien afloja
el filtro, la identidad o la verificación.

**Organization**: Agrupadas por historia de usuario, para implementar y validar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: A qué historia pertenece (US1, US2, US3)
- Cada tarea nombra su archivo exacto

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Variables de entorno y andamiaje del módulo nuevo.

- [ ] T001 Documentar las cuatro variables de entorno de documentación (`OPENAI_DOCUMENTACION_API_KEY`, `OPENAI_DOCUMENTACION_MODELO`, `OPENAI_DOCUMENTACION_COSTO_INPUT_POR_MIL`, `OPENAI_DOCUMENTACION_COSTO_OUTPUT_POR_MIL`) en `README.md`, según research.md D10. **No** van en `env.test.example`: su propia cabecera dice que los secrets no se guardan ahí, es solo para credenciales de Playwright. No hay variable con ids de vector store — cada cuenta crea el suyo
- [ ] T002 [P] Crear `src/ai/documentacion/tipos.ts` con `EXTENSIONES_SOPORTADAS` (las 24 de OpenAI), `EXTENSIONES_IMAGEN_RECHAZADAS`, `MIME_POR_EXTENSION`, `MAX_DOCUMENTOS_AGENTE = 20`, `MAX_PESO_DOCUMENTO = 25MB`, `MAX_RESULTADOS_BUSQUEDA = 5`, `TIMEOUT_BUSQUEDA_MS = 15000`, `COSTO_POR_LLAMADA_FILE_SEARCH = 0.0025`, el tipo `EstadoDocumento` y el mapa `MENSAJE_RECHAZO` (incluido el mensaje de imágenes de FR-002)
- [ ] T003 [P] Mover `src/configuracion/ia/conocimiento/extraccion.ts` y su test a `src/ai/documentacion/extraccion.ts`, recortándolo a lo único que sigue haciendo falta: verificar que un PDF tiene texto extraíble antes de indexar (research.md D8). Los demás formatos no se inspeccionan

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelo de datos y cliente de OpenAI. Nada de US1/US2/US3 puede avanzar sin esto.

**⚠️ CRITICAL**: Bloquea las tres historias.

- [ ] T004 Agregar a `prisma/schema.prisma` el enum `EstadoDocumentoAgenteIA`, el modelo `DocumentoAgenteIA` con sus dos índices, el valor `BUSQUEDA_DOCUMENTAL` en `enum TareaIA`, las relaciones inversas en `AgenteIAConfig` e `Instancia`, y el comentario `@deprecated` sobre `AgenteIAConfig.documentosFaq` — exactamente como está especificado en data-model.md §1 a §4
- [ ] T005 Generar y revisar la migración con `npm run db:migrate` (nombre `documentacion_vector_store`). Verificar que el SQL es 100 % aditivo: sin `DROP`, sin `ALTER COLUMN` destructivo, y que `ALTER TYPE "TareaIA" ADD VALUE` queda en una sentencia que PostgreSQL acepta en el deploy (data-model.md, "Migración")
- [ ] T006 Crear `src/ai/documentacion/cliente-openai.ts`: lee las variables de entorno y construye el cliente de OpenAI una sola vez (singleton, como `getStorageProvider()`), exponiendo `obtenerConfiguracionDocumentacion()` y `documentacionHabilitada()`. Sin `OPENAI_DOCUMENTACION_API_KEY` devuelve `null` — estado "no configurado" explícito, nunca lanza (FR-030). El id del vector store NO vive acá: es por cuenta y lo resuelve `vector-store.ts`
- [ ] T007 Ampliar `RegistrarUsoParams.proveedorIAId` de `string` a `string | undefined` en `src/ai/auditoria/logger.ts` (la columna `UsoIA.proveedorIAId` ya es nullable). Verificar que ningún llamador existente se rompe

**Checkpoint**: Base de datos migrada y cliente de OpenAI resoluble. Las historias pueden arrancar.

---

## Phase 3: User Story 1 - Cargar y eliminar documentación del comercio (Priority: P1) 🎯 MVP

**Goal**: El responsable sube documentos a su agente, los ve listados **solo por su nombre**, y al eliminarlos
quedan borrados de verdad en OpenAI. Cada archivo lleva la identidad de su comercio y nunca se cruza con otro.

**Independent Test**: Subir tres archivos de formatos distintos, verificar que la lista muestra solo nombres
y estados, eliminar uno y confirmar que desapareció del vector store, del almacén de archivos de OpenAI, del
storage de Karia y de la base. Escenarios 1, 2, 3, 5 y 7 de quickstart.md. No requiere que el agente responda.

### Tests for User Story 1 ⚠️

> Escribir primero y verificar que fallan antes de implementar.

- [ ] T008 [P] [US1] `src/ai/documentacion/aislamiento.test.ts`: `nombreArchivoOpenAI()` produce `instanciaId_agenteId_documentoId_…`, es estable entre llamadas y sanea el nombre original (espacios, acentos, separadores); `atributosArchivo()` devuelve las tres claves de identidad (FR-011)
- [ ] T009 [P] [US1] En `src/ai/documentacion/aislamiento.test.ts`: `filtroTenant()` arma el `and` con los dos `eq` esperados y **no admite** construirse sin instancia o sin agente (FR-012)
- [ ] T010 [P] [US1] En `src/ai/documentacion/aislamiento.test.ts`: `verificarResultados()` rechaza un fragmento con `attributes.instanciaId` de otro tenant, rechaza uno con `agenteId` ajeno, y **rechaza uno sin `attributes`** — fail-closed de FR-014. Un lote donde un solo fragmento es ajeno se rechaza entero (FR-013)
- [ ] T011 [P] [US1] `src/configuracion/ia/documentacion/actions.test.ts`: `subirDocumento` rechaza PNG, SVG y JPG en el servidor aunque el cliente los hubiera dejado pasar (FR-002, FR-003); rechaza un archivo que supera 25 MB; rechaza el documento 21 con el mensaje de límite alcanzado
- [ ] T012 [P] [US1] En `actions.test.ts`: `eliminarDocumento` y `alternarActivo` no encuentran ni modifican un documento de otra instancia, aun recibiendo su id exacto (Constitución, Principio V)

### Implementation for User Story 1

- [ ] T013 [US1] Crear `src/ai/documentacion/aislamiento.ts` con `nombreArchivoOpenAI()`, `atributosArchivo()`, `filtroTenant()`, `verificarResultados()` y los tipos `IdentidadDocumento`, `FragmentoDocumental`, `FiltroDocumentacion`, siguiendo literalmente contracts/interfaces.md §1. Ninguna función acepta parámetros opcionales que permitan omitir la identidad, y `FragmentoDocumental` es un tipo propio (no el del SDK) para que la verificación sea testeable sin mockear OpenAI
- [ ] T014 [US1] Crear `src/ai/documentacion/vector-store.ts` según contracts/interfaces.md §3. `asegurarVectorStoreInstancia()` crea el store de la cuenta la primera vez, con un UPDATE condicional (`where: { vectorStoreDocumentacionId: null }`) que lo hace idempotente y a prueba de carreras: el que pierde borra el suyo y se queda con el del ganador. `indexarArchivo` resuelve el store por su cuenta y usa `files.create` con el `filename` de `aislamiento.ts` más `vectorStores.files.createAndPoll` con sus `attributes` — **no recibe ni `attributes` ni `vectorStoreId` como parámetro**. `eliminarArchivo` borra en orden vector store file → File de OpenAI, tolerando 404 en cada paso y reportando cualquier otro error (FR-009)
- [ ] T014b [US1] `src/ai/documentacion/vector-store.test.ts`: el store se crea una sola vez por cuenta, con el tenant en `name` y `metadata`; el UPDATE es condicional; y en una carrera el perdedor borra su store y devuelve el del ganador (data-model.md §4)
- [ ] T015 [P] [US1] Crear `src/ai/documentacion/queries.ts` con `listarDocumentosAgente()` y `contarDocumentosListos()`. `listarDocumentosAgente` usa un `select` explícito que **excluye** `storageKey`, `openaiFileId`, `vectorStoreFileId`, `vectorStoreId` y `mime`, devolviendo el DTO `DocumentoAgenteVista` de contracts/interfaces.md §4 (FR-015). Ambas acotan por `instanciaId`
- [ ] T016 [US1] Crear `src/configuracion/ia/documentacion/actions.ts` con `subirDocumento`, `eliminarDocumento` y `alternarActivo`, reusando el patrón `autorizar()` de `src/configuracion/ia/conocimiento/actions.ts:40` (`requireSesion()` + `verificarAcceso(sesion, "ia", "modificar")`, `instanciaId` de la sesión y nunca de un parámetro). `subirDocumento`: valida extensión y peso → verifica texto extraíble si es PDF → guarda en el storage de Karia → `indexarArchivo()` → fila en `LISTO`, o en `ERROR` con motivo si la indexación falla. `eliminarDocumento`: `eliminarArchivo()` → borra del storage → borra la fila. Todas devuelven `DocumentoAgenteVista`, nunca la fila de Prisma, y llaman `revalidatePath("/configuracion")`
- [ ] T017 [P] [US1] Crear `src/configuracion/components/editor-documentos-agente.tsx`: lista donde cada fila muestra icono por extensión, **nombre del archivo**, badge de estado (Indexando / Listo / Error), toggle Activo y botón eliminar. Sin `<Textarea>`, sin contador de caracteres, sin botón "Entrenar", sin previsualización (FR-028). El `accept` del input sale de `EXTENSIONES_SOPORTADAS`, y las imágenes se rechazan en el cliente con el mensaje de `MENSAJE_RECHAZO` antes de llegar al servidor
- [ ] T018 [US1] Sacar `documentosFaq` del ciclo del formulario del agente: quitarlo de `AgenteIAConfigSchema` y borrar `DocumentoFaqSchema` en `src/configuracion/ia/agente-schema.ts:169`; quitarlo de `construirPayloadAgenteIA` en `src/configuracion/ia/payload-agente.ts:48`; quitarlo del `select` de `src/configuracion/ia/agente-actions.ts:127`. Así los ids de OpenAI no pueden viajar al navegador ni perderse al guardar el perfil (FR-015, FR-029, FR-033)
- [ ] T019 [US1] En `src/configuracion/components/sheet-editar-agente.tsx`: renombrar la sección a "Documentación del comercio", reemplazar `<EditorDocumentosFaq>` por `<EditorDocumentosAgente>` y quitar el `watch`/`setValue` de `documentosFaq` (líneas ~507, ~524, ~572, ~1536-1546). La sección pasa a ser 100 % Server Actions con efecto inmediato
- [ ] T020 [US1] Correr `npx vitest run src/ai/documentacion src/configuracion/ia` y verificar los escenarios 1, 2, 3, 5 y 7 de quickstart.md — con **especial atención al escenario 5** (dos instancias con documentación contradictoria en el mismo vector store, cero cruces en 5 intentos cada una)

**Checkpoint**: El negocio carga y elimina documentación con aislamiento verificado. El agente todavía no la
consulta — y no debe intentarlo.

---

## Phase 4: User Story 2 - El agente consulta la documentación cuando hace falta (Priority: P2)

**Goal**: El agente decide cuándo consultar la documentación según la política, responde con lo que encuentra,
dice que no sabe cuando no encuentra, y cada búsqueda queda registrada con sus tokens reales y su costo.

**Independent Test**: Con documentación cargada (US1), recorrer en el simulador los cinco casos de la política
y verificar en `UsoIA` que hay una fila por búsqueda realizada y solo por esas. Escenarios 4, 6, 9 y 10 de
quickstart.md.

### Tests for User Story 2 ⚠️

- [ ] T021 [P] [US2] `src/ai/documentacion/busqueda.test.ts`: con el cliente de OpenAI mockeado, la llamada a `responses.create` **siempre** incluye `filters` con el tenant correcto y `include: ["file_search_call.results"]`. Este test debe ponerse en rojo si alguien quita el filtro (FR-012)
- [ ] T022 [P] [US2] En `busqueda.test.ts`: si el mock devuelve un fragmento de otra instancia, la función descarta la respuesta entera, devuelve `{ encontrado: false, motivo: "VERIFICACION_FALLIDA" }` y el texto ajeno no aparece en ninguna parte del valor devuelto (FR-013)
- [ ] T023 [P] [US2] En `busqueda.test.ts`: se registra una fila de `UsoIA` con `tarea: "BUSQUEDA_DOCUMENTAL"` y `tokensInput`/`tokensOutput` **tomados del `usage` de la respuesta**, con `proveedorIAId` en `null` y `entidadTipo: "conversacion"` (FR-023, FR-025)
- [ ] T024 [P] [US2] En `busqueda.test.ts`: `costoEstimado` = tokens × tarifa + `COSTO_POR_LLAMADA_FILE_SEARCH`; y queda `null` cuando faltan las variables de tarifa, nunca un número inventado (FR-024)
- [ ] T025 [P] [US2] En `busqueda.test.ts`: un error del proveedor y un timeout registran `exito: false` con tokens en 0, devuelven `{ encontrado: false }` y **no lanzan** (FR-020, FR-026)
- [ ] T026 [P] [US2] `src/ai/tools/providers/buscar-en-documentacion.tool.test.ts`: un `instanciaId` o `agenteId` inyectado en los argumentos del LLM se ignora; se usan los del `ContextoTool`
- [ ] T027 [P] [US2] Actualizar `src/ai/contexto/capas/conocimiento.test.ts`: sin documentación devuelve `null`; con documentación emite la política de FR-017 y los nombres de archivo, y **nunca** el contenido de un documento (FR-006)
- [ ] T028 [P] [US2] Actualizar `src/ai/tools/herramientas-agente.test.ts`: `buscar_en_documentacion` aparece solo con `tieneDocumentacion: true`; con `false` o ausente la lista es idéntica a la de antes de esta feature (FR-019, FR-032)

### Implementation for User Story 2

- [ ] T029 [US2] Crear `src/ai/documentacion/busqueda.ts` con `buscarEnDocumentacion()` según contracts/interfaces.md §2: resuelve el cliente y las tarifas, llama `responses.create` con el hosted tool `file_search` (`vector_store_ids` con el único store de la cuenta vía `vectorStoreDeInstancia()`, `filters` de `filtroTenant()`, `max_num_results`, `include: ["file_search_call.results"]`), corre `verificarResultados()`, calcula el costo con `calcularCosto()` + la tarifa por llamada, y registra en `UsoIA` vía `registrarUsoIA()` tanto en éxito como en fallo. **No acepta `filters` como parámetro**, nunca lanza, y ningún tipo del SDK de OpenAI cruza su firma (Constitución, Principio IV)
- [ ] T030 [US2] Aplicar el timeout de `TIMEOUT_BUSQUEDA_MS` en `busqueda.ts`: al vencer devuelve `{ encontrado: false, motivo: "TIEMPO_AGOTADO" }` y registra la fila de `UsoIA` como fallida, sin interrumpir la respuesta al cliente (FR-020)
- [ ] T031 [US2] Crear `src/ai/tools/providers/buscar-en-documentacion.tool.ts` implementando `IProveedorTool` con el `definition` de contracts/interfaces.md §5. Valida los args con Zod, toma `instanciaId` y `agenteId` del `ContextoTool`, y devuelve `{ encontrado, respuesta, fuentes }` o el `{ encontrado: false, mensaje }` explícito que permite al agente decir que no sabe (FR-018)
- [ ] T032 [US2] Registrar la herramienta importándola en `src/ai/tools/inicializar.ts`, junto al resto de los providers
- [ ] T033 [US2] Agregar el campo `tieneDocumentacion: boolean` a `resolverHerramientasAgente()` en `src/ai/tools/herramientas-agente.ts`, siguiendo el patrón que ya existe para `catalogoEnContexto → buscar_productos`. `false`/ausente produce exactamente la lista de antes (FR-019, FR-032)
- [ ] T034 [US2] Reescribir `src/ai/contexto/capas/conocimiento.ts`: `producirCapaConocimiento({ tieneDocumentacion, nombres })` emite la política de consulta de FR-017 (los cinco puntos, literales) y los nombres de los archivos disponibles. Devuelve `null` sin documentación. Deja de importar `DocumentoFaq` y de emitir contenido de archivos
- [ ] T035 [US2] Actualizar `src/ai/contexto/capas/placeholders.ts` para la nueva firma de la capa 8 dentro de `producirCapaInfoOperativa`, manteniendo el catálogo primero y **sin agregar capa nueva ni cambiar el orden de precedencia** fijado por la spec 013
- [ ] T036 [US2] Actualizar `src/ai/contexto/constructor.ts` (líneas ~154, ~171, ~286) y `src/ai/contexto/context-builder.ts` (~131): dejar de seleccionar `documentosFaq` y pasar a pedir `contarDocumentosListos()` para alimentar la capa
- [ ] T037 [US2] Pasar `tieneDocumentacion` desde `src/ai/respuesta/responder-con-agente.ts:149` usando `contarDocumentosListos()`, de modo que la herramienta se ofrezca solo a agentes con documentación indexada
- [ ] T038 [US2] Hacer lo mismo en `src/ai/simulador/servicio.ts:149`, para que el simulador siga prediciendo exactamente lo que hace el agente en una conversación real
- [ ] T039 [US2] Correr `npx vitest run src/ai` y validar los escenarios 4, 6, 9 y 10 de quickstart.md, verificando en la base que las filas de `BUSQUEDA_DOCUMENTAL` aparecen solo para los turnos que efectivamente buscaron

**Checkpoint**: El agente consulta con criterio y todo su consumo queda contabilizado. US1 sigue funcionando.

---

## Phase 5: User Story 3 - Recuperarse de los casos que salen mal (Priority: P3)

**Goal**: Indexaciones fallidas, documentos heredados y entornos sin configurar se comunican con claridad y
tienen salida. Nada queda huérfano pagando storage en un índice compartido.

**Independent Test**: Provocar cada condición por separado (key inválida, `documentosFaq` poblada, variables
ausentes) y verificar que la interfaz lo explica y ofrece una acción. Escenario 8 de quickstart.md.

### Tests for User Story 3 ⚠️

- [ ] T040 [P] [US3] En `src/configuracion/ia/documentacion/actions.test.ts`: `reintentarIndexacion` re-lee del storage de Karia y no exige volver a subir el archivo; un documento que no está en `ERROR` no se reintenta
- [ ] T041 [P] [US3] En `src/ai/documentacion/queries.test.ts`: sin configuración de documentación, `contarDocumentosListos()` devuelve 0 y, en consecuencia, ni la herramienta ni la capa de política se producen (FR-030)

### Implementation for User Story 3

- [ ] T042 [US3] Agregar `reintentarIndexacion(agenteIAConfigId, documentoId)` a `src/configuracion/ia/documentacion/actions.ts`: descarga la copia del storage de Karia, vuelve a llamar `indexarArchivo()` y actualiza la fila. Solo opera sobre documentos en `ERROR` (FR-010)
- [ ] T043 [US3] Agregar `eliminarDocumentoLegacy(agenteIAConfigId, documentoId)` a las actions: borra el archivo del storage y quita el elemento de la columna `AgenteIAConfig.documentosFaq`, sin tocar OpenAI (esos documentos nunca se indexaron) (FR-031)
- [ ] T044 [US3] En `src/configuracion/components/editor-documentos-agente.tsx`: mostrar el botón "Reintentar" en las filas en `ERROR` con su `errorIndexacion`; listar los documentos de `documentosFaq` con badge ámbar "Requiere resubir" y botón eliminar; y reemplazar el botón de carga por el mensaje de feature no habilitada cuando falta la configuración (FR-010, FR-030, FR-031)
- [ ] T045 [P] [US3] Crear `scripts/conciliar-documentos-huerfanos.ts`: lista los archivos de los vector stores configurados, los coteja contra las filas de `DocumentoAgenteIA` por el `documentoId` de sus atributos, y borra los que ya no corresponden a ningún documento vigente. Modo `--dry-run` por defecto; borra solo con `--aplicar`. Loguea qué borró y qué dejó, sin truncar silenciosamente
- [ ] T046 [US3] Validar el escenario 8 de quickstart.md completo (8a configuración ausente, 8b key inválida + reintento, 8c documentos legacy)

**Checkpoint**: Los tres caminos de recuperación funcionan. Las tres historias están completas.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T047 Eliminar el código del mecanismo anterior, ya sin usuarios: `src/configuracion/ia/conocimiento/destilado.ts` y su test, `conocimiento/tipos.ts`, `conocimiento/actions.ts` y su test, y `src/configuracion/components/editor-documentos-faq.tsx`. Verificar con `grep -rn "documentosFaq\|destilarDocumento\|EditorDocumentosFaq" src --exclude-dir=generated` que solo quedan las referencias intencionales al listado legacy
- [ ] T048 [P] Actualizar `CLAUDE.md` y `docs/` con la sección de documentación del agente: qué formatos se aceptan, por qué las imágenes no, cómo se contabiliza el consumo, y las cinco variables de entorno. Dejar escrito el costo de storage ($0,10/GB/día tras el primer GB) que, a propósito, **no** se registra en `UsoIA` (FR-027)
- [ ] T049 [P] Documentar en `docs/` la garantía de aislamiento: las cuatro capas, por qué existen con un índice compartido, y qué tests las protegen — para que quien toque `aislamiento.ts` o `busqueda.ts` en el futuro sepa qué está sosteniendo
- [ ] T050 Correr `npm run build` y `npx vitest run` completos. Según el Principio V de la Constitución, el cambio no está terminado hasta que ambos pasen
- [ ] T051 Ejecutar quickstart.md de punta a punta, con los escenarios **5 (cruce entre cuentas)** y **10 (cero regresión)** como obligatorios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — **bloquea las tres historias**
- **US1 (Phase 3)**: depende de Foundational
- **US2 (Phase 4)**: depende de Foundational. Es testeable solo con documentos ya cargados, así que en la práctica se valida después de US1
- **US3 (Phase 5)**: depende de Foundational y de US1 (extiende sus actions y su componente)
- **Polish (Phase 6)**: depende de las tres historias

### User Story Dependencies

- **US1 (P1)**: independiente. Es el MVP
- **US2 (P2)**: su código no depende de US1 salvo por `contarDocumentosListos()` (T015). Su *validación* sí necesita documentos cargados
- **US3 (P3)**: extiende archivos de US1 (actions y componente), así que va después

### Within Each User Story

- Tests primero, en rojo, antes de implementar
- `aislamiento.ts` (T013) antes que `vector-store.ts` (T014) y que `busqueda.ts` (T029) — ambos dependen de él
- `queries.ts` (T015) antes que T037 y T038
- Actions (T016) antes que el componente que las llama (T017)

### Parallel Opportunities

- T002 y T003 en paralelo (archivos distintos)
- Todos los tests de US1 (T008-T012) en paralelo
- Todos los tests de US2 (T021-T028) en paralelo
- T015 y T017 en paralelo con T014 (archivos distintos)
- T048 y T049 en paralelo
- Con equipo: una persona en US1 y otra en US2 apenas termine Foundational, sincronizando en `contarDocumentosListos()`

---

## Parallel Example: User Story 1

```bash
# Los cinco tests de US1 juntos:
Task: "aislamiento.test.ts — nombre y atributos de identidad (T008)"
Task: "aislamiento.test.ts — filtroTenant arma los dos eq (T009)"
Task: "aislamiento.test.ts — verificarResultados fail-closed (T010)"
Task: "actions.test.ts — rechazo de PNG/SVG/JPG y de los límites (T011)"
Task: "actions.test.ts — documento de otra instancia inaccesible (T012)"

# Después de T013 (aislamiento.ts), en paralelo:
Task: "vector-store.ts — indexar y eliminar (T014)"
Task: "queries.ts — DTO sin ids de OpenAI (T015)"
Task: "editor-documentos-agente.tsx — lista solo-nombre (T017)"
```

---

## Implementation Strategy

### MVP First (solo User Story 1)

1. Phase 1: Setup
2. Phase 2: Foundational (CRÍTICO — bloquea todo)
3. Phase 3: User Story 1
4. **PARAR Y VALIDAR**: escenarios 1, 2, 3, 5 y 7 de quickstart.md. El escenario 5 no es negociable
5. Desplegable: el negocio ya tiene su documentación centralizada y aislada

### Incremental Delivery

1. Setup + Foundational → base lista
2. + US1 → cargar, listar y borrar de verdad → **MVP desplegable**
3. + US2 → el agente consulta y el consumo se contabiliza → desplegable
4. + US3 → recuperación de los casos de borde → desplegable
5. Polish → se elimina el camino viejo y se documenta

### Nota sobre el orden de la limpieza

T047 (borrar el código del mecanismo anterior) va en Polish y **no** en US1, a propósito: mientras las tres
historias no estén completas, `documentosFaq` sigue siendo la única forma de que un negocio vea qué tenía
cargado antes. Borrarlo temprano dejaría cuentas sin rastro de su documentación anterior.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes
- Cada historia es completable y validable por separado
- Verificar que los tests fallan antes de implementar
- Commit por tarea o por grupo lógico
- Los tests T008-T012 y T021-T025 son la red de seguridad del aislamiento: si alguien relaja el filtro, la
  verificación o la identidad y ninguno se pone en rojo, el test está mal escrito y hay que arreglarlo
