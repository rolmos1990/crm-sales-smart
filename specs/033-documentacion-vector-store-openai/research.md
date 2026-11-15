# Research: Documentación del comercio sobre Vector Store + File Search

**Feature**: `033-documentacion-vector-store-openai` · **Fecha**: 2026-11-15

Decisiones técnicas con su justificación y las alternativas descartadas. Las cuatro primeras las confirmó el
responsable del producto antes de escribir el spec; las demás salen de la investigación del código y de la
API de OpenAI.

---

## Decisión 1 — Cómo se ejecuta la búsqueda y cómo se obtienen los tokens

**Decisión**: Sub-llamada aislada a la **Responses API** de OpenAI con el hosted tool `file_search`
(`client.responses.create({ tools: [{ type: "file_search", vector_store_ids, filters, max_num_results }] })`).

**Rationale**:
- Es el único camino que devuelve un bloque `usage` con `input_tokens`/`output_tokens` **reales del
  proveedor**. FR-023 exige tokens reportados, nunca estimados, y este es el único que lo cumple sin inventar.
- Devuelve una respuesta ya sintetizada con citas, que es mucho más barata de consumir para el agente
  principal que volcarle los fragmentos crudos en el historial.
- Funciona **independientemente del proveedor del agente principal**: un agente sobre Anthropic puede
  consultar la documentación igual. La arquitectura multi-proveedor de `src/ai/proveedores/` queda intacta.
- Aislar la llamada en su propia función la convierte en el adaptador que pide el Principio IV de la
  Constitución: los tipos del SDK de OpenAI mueren dentro de `busqueda.ts`.

**Alternativas consideradas**:

| Alternativa | Por qué se descartó |
|---|---|
| `client.vectorStores.search()` directo (sin modelo) | Más barato, pero **no devuelve `usage`**. Los tokens de la fila `UsoIA` habría que derivarlos contando el texto devuelto: medido, sí, pero distinto de lo que OpenAI factura. Viola el espíritu de FR-023 |
| `file_search` dentro de la llamada principal del agente | Obliga a migrar el proveedor OpenAI de Chat Completions a Responses API, **solo funciona si el agente corre sobre OpenAI**, y mezcla los tokens de la búsqueda con los de la conversación — imposible desglosar el costo de la documentación |
| RAG propio (pgvector + embeddings) | Karia ya paga por un servicio que resuelve chunking, embeddings, re-ranking y parsing de PDF/Word. Reimplementarlo es semanas de trabajo y una dependencia nueva, contra el "Technical Constraints" de la Constitución |

**Costo**: tokens del modelo + **$2,50 por 1.000 llamadas** de file search (solo Responses API).

---

## Decisión 2 — Formatos aceptados, y qué hacer con las imágenes

**Decisión**: Aceptar los 24 formatos que indexa OpenAI. **Rechazar PNG, SVG y JPG** con un mensaje que
explica el motivo y la alternativa.

**Rationale**: Los vector stores de OpenAI solo indexan texto. Verificado en la documentación oficial
([file types](https://developers.openai.com/api/docs/guides/tools-file-search)): no hay ningún formato de
imagen en la lista. Aceptar un PNG y guardarlo sin indexar le dejaría al negocio un archivo que nunca va a
servir para nada, con la falsa impresión de que el agente lo "leyó".

Formatos aceptados:

```
.pdf .doc .docx .pptx .txt .md .json .html .css .tex
.c .cpp .cs .go .java .js .php .py .rb .sh .ts
```

**Alternativas consideradas**:

| Alternativa | Por qué se descartó |
|---|---|
| Transcribir imágenes con un modelo de visión → indexar el `.txt` resultante | Capacidad distinta y con costo propio en tokens. Vale la pena como feature futura, no como parte de ésta. Además SVG tampoco serviría |
| Aceptar la imagen sin indexar, marcada "No indexado" | Deja un archivo inútil en la lista, pagando storage. Peor experiencia que un rechazo honesto |

**Nota de verdad incómoda**: el pedido original mencionaba explícitamente PNG y SVG. No se puede cumplir
porque el servicio no lo admite — no es una limitación de Karia. El rechazo explica exactamente eso.

---

## Decisión 3 — Qué pasa con los documentos del mecanismo anterior

**Decisión**: **Sin migración automática.** Los documentos de `AgenteIAConfig.documentosFaq` se listan como
"Requiere resubir", no se indexan y pueden eliminarse.

**Rationale**: Decisión de producto tomada explícitamente. Reduce el alcance (no hace falta script de
backfill ni manejo de fallos masivos de reindexación) y mantiene honesto el estado: un documento que decía
"Entrenado" con un texto resumido no es equivalente a uno indexado íntegro, y presentarlos iguales mentiría.

**Alternativas consideradas**: script de backfill que relee los `storageKey` y los indexa. Descartado por el
responsable de producto: pocas cuentas afectadas y vale más la claridad.

---

## Decisión 4 — Un vector store por instancia, con credencial de Karia

**Decisión**: **Un vector store de OpenAI por instancia** (`Instancia.vectorStoreDocumentacionId`), creado de
forma perezosa la primera vez que la cuenta sube un documento, dentro de la organización de OpenAI **de
Karia** (credencial por entorno, no el `ProveedorIA` del tenant).

**Rationale**:

- **El aislamiento entre cuentas pasa a ser físico.** El índice de un comercio no contiene bytes de otro: no
  hay ningún índice ajeno al que una búsqueda pueda llegar, ni siquiera si el filtro fallara. Las cuatro
  capas de la Decisión 5 se mantienen, pero como defensa en profundidad y —dentro de la cuenta— como lo que
  separa a un agente de otro.
- **El techo de 10.000 archivos por store deja de ser un problema de plataforma.** Pasa a ser por cuenta: con
  20 documentos por agente, una cuenta con cinco agentes usa 100. Inalcanzable.
- **La credencial es de Karia y no del cliente** para que la funcionalidad ande en TODA cuenta. Un comercio
  cuyo agente corre sobre Anthropic o DeepSeek no tiene key de OpenAI; con la key del tenant se quedaría sin
  documentación hasta que cargara una. Karia le paga a OpenAI; `UsoIA` sigue atribuyendo el consumo por
  instancia, que es lo que permite medirlo, limitarlo y facturarlo.
- **El costo no cambia** respecto de un store único: el GB gratis de storage es por organización de OpenAI,
  no por store. Partir en N stores dentro de la misma organización no agrega nada.

**Creación perezosa e idempotente.** No se pueden pre-crear a mano N stores, uno por tenant. El riesgo es la
carrera: dos subidas simultáneas de la misma cuenta creando dos stores, con la mitad de los documentos en un
índice que después nadie consulta. Se resuelve con un UPDATE condicional
(`where: { vectorStoreDocumentacionId: null }`): gana uno solo, y el que pierde borra el store que acababa de
crear y se queda con el del ganador. Sin locks ni transacciones largas. Cubierto por
`vector-store.test.ts`.

Esto revierte parcialmente la Decisión 10 de la primera versión de este documento, que rechazaba la creación
implícita de objetos facturables. El contexto cambió: con un store único se podía crear a mano; con uno por
tenant, no.

**Impacto concreto en el código**: `RegistrarUsoParams.proveedorIAId`
(`src/ai/auditoria/logger.ts:7`) hoy es `string` obligatorio, aunque la columna `UsoIA.proveedorIAId` ya es
nullable. Pasa a opcional — apuntar a un `ProveedorIA` del tenant que no fue el que se usó sería mentir en la
auditoría.

**Alternativas consideradas**:

| Alternativa | Por qué se descartó |
|---|---|
| Un único store para toda la plataforma | Era el diseño inicial. El aislamiento quedaba enteramente a cargo del filtro, y el techo de 10.000 archivos aplicaba a toda la plataforma (~500 agentes). Un store por cuenta elimina ambos a cambio de una creación perezosa de 40 líneas |
| Un store por **agente** | Aislamiento aún más fino, pero obliga a resubir el mismo manual para el agente Comercial y el de Gerencia. Los atributos ya separan agentes dentro de la cuenta, sin multiplicar objetos |
| Key del propio tenant (`ProveedorIA` OPENAI) | El cliente pagaría lo suyo y tendría su propio GB gratis, con aislamiento entre organizaciones distintas. Descartado porque deja sin documentación a toda cuenta que no use OpenAI como proveedor, que hoy son la mayoría |

## Decisión 5 — Cómo se hace imposible el cruce entre cuentas

**Decisión**: Cuatro capas, todas derivadas de un único archivo `src/ai/documentacion/aislamiento.ts`, y
ninguna con parámetro de override.

```ts
// 1. Identidad en el nombre del archivo en OpenAI
filename:   `${instanciaId}_${agenteId}_${documentoId}_${nombreOriginalSaneado}`

// 2. Identidad consultable en los atributos del vector store file
attributes: { instanciaId, agenteId, documentoId }

// 3. Filtro obligatorio en cada búsqueda
filtroTenant(instanciaId, agenteId) = { type: "and", filters: [
  { type: "eq", key: "instanciaId", value: instanciaId },
  { type: "eq", key: "agenteId",    value: agenteId },
]}

// 4. Verificación a posteriori de cada fragmento devuelto
verificarResultados(resultados, instanciaId, agenteId)
```

**Rationale**: El Principio V de la Constitución ("toda query y mutación scoped al tenant autenticado") se
cumple hoy por una cláusula `where` de Prisma que es trivial de auditar. Acá el `where` vive del lado de
OpenAI, fuera de nuestro control, así que hace falta reconstruir esa garantía con medios propios.

Con un store por instancia (Decisión 4), estas capas ya no son la única línea entre dos comercios —esa es
física—, pero siguen siendo necesarias: son defensa en profundidad entre cuentas y, dentro de una misma
cuenta, lo único que separa la documentación del agente Comercial de la del de Gerencia.

- **Estructural, no por disciplina**: `buscarEnDocumentacion()` no acepta `filters` como parámetro — lo
  construye ella con el `instanciaId`/`agenteId` que vienen del `ContextoTool` del backend, nunca de los
  argumentos del LLM (regla ya vigente en `src/ai/tools/executor.ts`). `indexarArchivo()` tampoco acepta
  `attributes`. No hay forma de llamarlas mal.
- **Verificación a posteriori**: con `include: ["file_search_call.results"]`, cada fragmento devuelto trae
  `attributes` y `filename` (confirmado en `ResponseFileSearchToolCall.Result`, SDK openai 6.45). Si **uno
  solo** no coincide con el tenant esperado, se descarta la respuesta **entera**, se registra una alerta y se
  devuelve "no encontrado". El texto ajeno nunca llega al cliente, aunque el filtro de OpenAI fallara.
- **Fail-closed**: un fragmento sin `attributes` se trata como ajeno. Un archivo mal indexado no puede colarse
  por omisión (FR-014).
- **Tests que fallan si alguien afloja cualquiera de las tres** (ver quickstart.md).

**Alternativas consideradas**: confiar solo en `filters` de OpenAI. Descartado: es una garantía de un tercero,
sin forma de auditarla desde acá. La verificación propia cuesta ~20 líneas.

---

## Decisión 6 — Tabla propia y no columna JSON

**Decisión**: Modelo Prisma `DocumentoAgenteIA` en vez de seguir en `AgenteIAConfig.documentosFaq` (Json).

**Rationale**:
- La razón original de la columna JSON era viajar dentro del snapshot de `AgenteIAConfigVersion` junto al
  resto del perfil. Eso deja de aplicar: **el contenido ya no es parte del prompt**, así que no es
  configuración versionable. Más aún, versionarla sería dañino — restaurar una versión vieja no debe
  resucitar un documento borrado en OpenAI (FR-033).
- Necesita estados de indexación, motivo de error e identificadores externos que **nunca** pueden salir al
  cliente. Un `select` explícito de Prisma es la forma natural de garantizar FR-015; con una columna JSON
  dentro del formulario del agente, los ids viajarían al navegador y un guardado del formulario los borraría.
- Habilita índices (`[agenteIAConfigId, estado]`) para `contarDocumentosListos()`, que se llama en cada
  respuesta del agente.

**Alternativas consideradas**: mantener el JSON y filtrar los campos sensibles al serializar. Descartado:
el formulario del agente hace round-trip de ese valor (`formIA.watch("documentosFaq")` →
`construirPayloadAgenteIA`), así que lo que no viaja al cliente se pierde al guardar.

---

## Decisión 7 — Herramienta de agente, no capa de contexto

**Decisión**: La consulta es una **herramienta** (`buscar_en_documentacion` en el registro de
`src/ai/tools/`), y la capa 8 del contexto pasa de inyectar contenido a emitir **la política de cuándo
consultarla**.

**Rationale**: FR-016 pide que el agente decida cuándo buscar. El tool calling es exactamente ese mecanismo y
ya está construido y probado en el repo (`responder-con-agente.ts`, `MAX_ITERACIONES_TOOL = 10`). La política
en el prompt es lo que hace que la decisión sea buena en vez de arbitraria.

Se mantiene dentro de `producirCapaInfoOperativa` (`capas/placeholders.ts`), junto al catálogo: **no se agrega
capa nueva ni cambia el orden de precedencia** que fijó la spec 013.

**Habilitación condicional**: `HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES` (`src/ai/tools/constantes.ts`) es
una constante estática y esta herramienta no puede estar siempre — un agente sin documentos leería una
herramienta que siempre devuelve vacío (FR-019). Entonces `resolverHerramientasAgente()` recibe
`tieneDocumentacion: boolean`. Es el mismo patrón que ya existe para `catalogoEnContexto → buscar_productos`,
no una abstracción nueva.

---

## Decisión 8 — Validación previa de PDF antes de pagar la indexación

**Decisión**: Conservar `extraccion.ts` (hoy en `src/configuracion/ia/conocimiento/`), moverlo a
`src/ai/documentacion/` y usarlo **solo para PDF** como verificación previa de texto extraíble.

**Rationale**: Un PDF escaneado es el caso de rechazo más común y OpenAI lo aceptaría, lo indexaría vacío y
lo cobraría. Detectarlo antes con `unpdf` —que ya es dependencia del proyecto— ahorra costo y produce un
mensaje mucho mejor: *"Si es un PDF escaneado, el agente no puede leerlo: subí una versión con texto
seleccionable"*. Para los demás formatos no aplica y no se intenta.

**Alternativas consideradas**: dejar que OpenAI lo acepte y descubrirlo cuando el agente no encuentre nada.
Descartado: falla silenciosa, y el negocio culparía al agente.

---

## Decisión 9 — Qué NO se registra en UsoIA

**Decisión**: La carga e indexación de un documento **no** genera fila en `UsoIA`.

**Rationale**: OpenAI factura la indexación por **storage** ($0,10/GB/día, primer GB gratis), no por tokens.
`UsoIA` es una tabla de tokens: meter ahí una fila con `tokensInput: 0` para representar un costo de storage
contamina todos los agregados (`obtenerResumenUsoIA`) con llamadas que no consumieron tokens. El costo de
storage se documenta y se deja fuera de la tabla (FR-027).

**Alternativas consideradas**: registrar la indexación con tokens en 0 "por trazabilidad". Descartado: la
trazabilidad de la carga ya la da `DocumentoAgenteIA.creadoEn`, que es su lugar natural.

---

## Decisión 10 — Configuración por entorno, con apagado elegante

**Decisión**: Cuatro variables de entorno; sin la primera la feature se apaga sola.

| Variable | Para qué |
|---|---|
| `OPENAI_DOCUMENTACION_API_KEY` | Key de la cuenta OpenAI de Karia. **No** es la del `ProveedorIA` del tenant |
| `OPENAI_DOCUMENTACION_MODELO` | Modelo que sintetiza la respuesta de búsqueda |
| `OPENAI_DOCUMENTACION_COSTO_INPUT_POR_MIL` | Tarifa de entrada para `costoEstimado` |
| `OPENAI_DOCUMENTACION_COSTO_OUTPUT_POR_MIL` | Tarifa de salida para `costoEstimado` |

**No hay variable con ids de vector store**: cada cuenta tiene el suyo y vive en la base
(`Instancia.vectorStoreDocumentacionId`), creado solo al subir el primer documento.

**Rationale**: La credencial es infraestructura de la plataforma, no configuración de un tenant: no tiene
sentido que viva en una tabla por instancia. Sin ella, `contarDocumentosListos()` devuelve 0, la herramienta
no se ofrece y la UI muestra el motivo en vez del botón de carga (FR-030). Sin las tarifas, `calcularCosto()`
ya devuelve `undefined` y `costoEstimado` queda `null` — comportamiento existente, nunca un número inventado
(FR-024).

## Decisión 11 — Límites elegidos

| Constante | Valor | Rationale |
|---|---|---|
| `MAX_DOCUMENTOS_AGENTE` | 20 | El tope de 3 existía por presupuesto de contexto; esa razón desapareció. Con un store por cuenta, el techo de 10.000 de OpenAI es por cuenta: inalcanzable |
| `MAX_PESO_DOCUMENTO` | 25 MB | OpenAI admite 512 MB; 25 es lo razonable para documentación comercial |
| `MAX_RESULTADOS_BUSQUEDA` | 5 | Menos fragmentos = menos tokens por búsqueda, y 5 alcanza para una política o un FAQ |
| `TIMEOUT_BUSQUEDA_MS` | 15.000 | El tool loop permite 10 iteraciones; una búsqueda colgada no puede comerse el turno. Al vencer degrada a "no encontré" (FR-020) |
| `COSTO_POR_LLAMADA_FILE_SEARCH` | 0,0025 USD | $2,50 / 1.000 llamadas |

---

## Verificación de la API (SDK `openai@6.45.0`, ya instalado)

Todo lo que el diseño asume fue verificado contra los tipos del SDK instalado, no contra memoria:

| Capacidad | Verificado en |
|---|---|
| `FileSearchTool` con `vector_store_ids`, `filters`, `max_num_results`, `ranking_options` | `resources/responses/responses.d.ts:507` |
| `ResponseUsage` con `input_tokens` / `output_tokens` | `resources/responses/responses.d.ts:5300` |
| `ResponseFileSearchToolCall.Result` con `attributes`, `filename`, `score`, `text` | `resources/responses/responses.d.ts:2236` |
| `include: ["file_search_call.results"]` | `ResponseIncludable`, `responses.d.ts:2865` |
| `vectorStores.create` con `name` y `metadata` | `resources/vector-stores/vector-stores.d.ts:238` |
| `vectorStores.files.create` con `attributes` | `resources/vector-stores/files.d.ts:153` |
| `vectorStores.files.createAndPoll` | `resources/vector-stores/files.d.ts:36` |
| `vectorStores.files.del` / `files.del` | `resources/vector-stores/files.d.ts`, `resources/files` |

**No se agregan dependencias nuevas**: `openai` y `unpdf` ya están en `package.json`.
