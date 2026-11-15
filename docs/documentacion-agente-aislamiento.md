# Documentación del agente: cómo funciona y por qué no se cruzan las cuentas

Spec: `specs/033-documentacion-vector-store-openai/`

**Leer esto antes de tocar `src/ai/documentacion/aislamiento.ts` o `busqueda.ts`.** Son dos archivos chicos
que sostienen una garantía grande, y el motivo no es obvio leyendo solo el código.

---

## Qué hace la feature

El negocio sube archivos en **Agente IA → Conocimiento → Documentación del comercio**. Esos archivos se
indexan **enteros** en un vector store de OpenAI, y el agente los consulta bajo demanda con la herramienta
`buscar_en_documentacion`, decidiendo él mismo cuándo le hacen falta.

Reemplaza al mecanismo anterior (spec 032), que resumía cada documento con una llamada a la IA hasta 2.000
caracteres y lo inyectaba entero en el prompt de **cada** respuesta. Eso tenía tres problemas: lo que no
sobrevivía al resumen se perdía, se pagaba en cada mensaje aunque la consulta no tuviera nada que ver, y solo
aceptaba PDF y TXT.

| | Antes (032) | Ahora (033) |
|---|---|---|
| Qué ve el agente | 2.000 caracteres resumidos por documento | El archivo entero, buscable |
| Cuándo | En cada mensaje | Solo cuando decide buscar |
| Formatos | PDF, TXT | 24 formatos de texto |
| Máximo | 3 documentos | 20 por agente |
| Editable a mano | Sí (textarea) | No: solo se ve el nombre |

---

## Cómo está aislado

**Un vector store por instancia** (`Instancia.vectorStoreDocumentacionId`), creado solo la primera vez que la
cuenta sube un documento. El índice de un comercio **no contiene bytes de otro**: el aislamiento entre
cuentas es físico antes que lógico.

Dentro de una misma cuenta, los documentos siguen perteneciendo a un agente: el agente Comercial y el de
Gerencia pueden tener documentación distinta. Esa separación sí es lógica, por atributos y filtro.

Todos los stores viven en la organización de OpenAI **de Karia**, no en la del cliente — ver "Credenciales"
más abajo.

> En el resto de Karia, el aislamiento entre tenants lo da una cláusula `where` de Prisma, trivial de
> auditar. Acá parte de la consulta se ejecuta **del lado de OpenAI**, fuera de nuestro control. Por eso, aun
> con stores separados, las cuatro capas de abajo se mantienen: son defensa en profundidad, y las que separan
> a un agente de otro dentro de la misma cuenta.

### Las cuatro capas

Todas derivan de `src/ai/documentacion/aislamiento.ts` y de ningún otro archivo.

**1. Identidad en el nombre del archivo**

```
instanciaId_agenteId_documentoId_nombre-saneado.pdf
```

El nombre original se sanea para que no pueda inyectar guiones bajos y romper el prefijo. Sirve también para
algo práctico: mirando el dashboard de OpenAI se sabe de quién es cada archivo sin consultar la base.

**2. Identidad en los atributos consultables**

```ts
attributes: { instanciaId, agenteId, documentoId }
```

`indexarArchivo()` **no recibe** `attributes` como parámetro: los deriva de la identidad. Un archivo sin dueño
es imposible de crear.

**3. Filtro obligatorio en cada búsqueda**, además del store de la cuenta

```ts
filters: { type: "and", filters: [
  { type: "eq", key: "instanciaId", value: instanciaId },
  { type: "eq", key: "agenteId",    value: agenteId },
]}
```

`filtroTenant()` no tiene parámetros opcionales ni variante "sin filtro", y lanza si recibe un id vacío —un
id vacío produciría un filtro que no filtra. `buscarEnDocumentacion()` **no acepta `filters` del llamador**:
lo construye ella con el `instanciaId`/`agenteId` que vienen del `ContextoTool` del backend, nunca de los
argumentos del LLM.

**4. Verificación a posteriori de lo que vuelve**

Con `include: ["file_search_call.results"]`, cada fragmento recuperado trae sus `attributes`.
`verificarResultados()` los coteja contra el tenant esperado. Si **uno solo** no coincide:

- se descarta la respuesta **entera** (no solo el fragmento: el modelo que sintetizó ya lo leyó, así que el
  texto puede estar contaminado),
- se registra una alerta `[Documentacion][SEGURIDAD]` sin incluir el contenido ajeno,
- se devuelve `{ encontrado: false, motivo: "VERIFICACION_FALLIDA" }`,
- y la llamada se registra en `UsoIA` como fallida —ocurrió y OpenAI la cobró.

**Fail-closed**: un fragmento sin atributos se trata como ajeno. La omisión no puede ser una vía de acceso.

### Credenciales: por qué la key es de Karia y no del cliente

`OPENAI_DOCUMENTACION_API_KEY` es de la organización de OpenAI de **Karia**, no del `ProveedorIA` de cada
instancia. La alternativa —usar la key que el cliente ya cargó en Configuración → IA— se evaluó y se
descartó: una cuenta cuyo agente corre sobre Anthropic o DeepSeek no tiene key de OpenAI, y se quedaría sin
documentación hasta que cargara una. Con la key de la plataforma, la funcionalidad anda para toda cuenta.

Karia le paga a OpenAI; `UsoIA` sigue atribuyendo el consumo **por instancia**, que es lo que permite
medirlo, limitarlo y facturarlo.

### Qué pasa si querés cambiar algo acá

Si alguna vez hace falta "buscar en todo", **no se agrega un flag** a `filtroTenant`. Se discute de nuevo el
modelo de aislamiento. Un parámetro opcional que desactiva el filtro es exactamente la clase de cosa que un
día alguien pasa sin querer.

### Los tests que lo protegen

- `src/ai/documentacion/aislamiento.test.ts` — identidad, filtro y verificación (incluido el fail-closed)
- `src/ai/documentacion/busqueda.test.ts` — que el filtro **siempre** viaja, y que una respuesta contaminada
  se descarta entera
- `src/ai/tools/providers/buscar-en-documentacion.tool.test.ts` — que un `instanciaId` inyectado por el modelo
  en los argumentos se ignora

Si alguien afloja cualquiera de las cuatro capas y ninguno de estos tests se pone en rojo, **el test está mal
escrito** y hay que arreglarlo antes de tocar el código.

---

## Contabilización del consumo

Cada búsqueda es una llamada a la **Responses API** de OpenAI con el hosted tool `file_search`, en una
sub-llamada aislada del turno del agente. Se eligió así, y no el endpoint de búsqueda directa, por una razón
concreta: es el único camino que devuelve un bloque `usage` con los tokens **reales** que facturó OpenAI. Un
token estimado en una tabla de auditoría es un token que no sirve para facturar.

Cada búsqueda produce una fila en `UsoIA`:

| Campo | Valor |
|---|---|
| `tarea` | `BUSQUEDA_DOCUMENTAL` |
| `tokensInput` / `tokensOutput` | Del `usage` de la respuesta — nunca estimados |
| `costoEstimado` | tokens × tarifa **+ USD 0,0025** por la llamada de file search |
| `proveedorIAId` | `null` — la credencial es de Karia, no un `ProveedorIA` del tenant |
| `instanciaId` / `agenteIAConfigId` / `agenteIAConfigVersionId` | Atribución y trazabilidad |
| `entidadTipo` / `entidadId` | `conversacion` / el id de la conversación que la disparó |

Para desglosarlo:

```sql
SELECT tarea, modelo, "tokensInput", "tokensOutput", "costoEstimado", exito, "creadoEn"
FROM "UsoIA" WHERE tarea = 'BUSQUEDA_DOCUMENTAL' ORDER BY "creadoEn" DESC;
```

### Cuándo se imputa el costo

El criterio es **evidencia de consumo**, no éxito de la búsqueda:

- **Tokens > 0 → se imputa el costo completo** (tokens + tarifa por llamada), aunque la búsqueda haya
  terminado mal. Una respuesta descartada por la verificación de aislamiento igual gastó tokens y OpenAI
  igual la cobró: no imputarla le regalaría ese costo al cliente y desbalancearía la conciliación contra la
  factura.
- **Tokens = 0 → `costoEstimado` queda `null`.** Un timeout o un error del proveedor no nos dicen si llegó a
  cobrarse algo, y no se inventa un número.

### Lo que a propósito NO se registra en `UsoIA`

**La carga e indexación de un documento no genera fila.** OpenAI la factura por **storage**
(USD 0,10/GB/día, primer GB gratis por organización), no por tokens. Meter una fila con `tokensInput: 0`
para representar un costo de storage contaminaría todos los agregados de `obtenerResumenUsoIA()` con
llamadas que no consumieron tokens. La trazabilidad de la carga ya la da `DocumentoAgenteIA.creadoEn`.

### Costo por cliente: las dos mitades

| Costo | Depende de | Dónde sale |
|---|---|---|
| Búsquedas (tokens + USD 0,0025 por llamada) | Uso | `UsoIA`, ya prorrateado por consulta e imputado a su `instanciaId` |
| Storage del índice (USD 0,10/GB/día) | Volumen cargado, **no** del uso | No está en `UsoIA`. Se calcula sobre `DocumentoAgenteIA.pesoBytes` |

Consumo de búsquedas por cuenta:

```sql
SELECT "instanciaId",
       COUNT(*)                       AS busquedas,
       SUM("tokensInput" + "tokensOutput") AS tokens,
       SUM("costoEstimado")           AS usd
FROM "UsoIA" WHERE tarea = 'BUSQUEDA_DOCUMENTAL'
GROUP BY "instanciaId" ORDER BY usd DESC NULLS LAST;
```

Storage por cuenta:

```sql
SELECT i.nombre AS cuenta,
       COUNT(d.id)                                        AS documentos,
       ROUND(SUM(d."pesoBytes") / 1048576.0, 2)           AS mb,
       ROUND(SUM(d."pesoBytes") / 1073741824.0 * 0.10, 5) AS usd_dia
FROM "Instancia" i
JOIN "DocumentoAgenteIA" d ON d."instanciaId" = i.id
GROUP BY i.id, i.nombre ORDER BY mb DESC;
```

Dos salvedades sobre la segunda, para no tomarla como exacta: `pesoBytes` es el archivo original, mientras
que OpenAI factura los fragmentos parseados **más sus embeddings** —que suelen pesar más que el texto, y
menos que un PDF con imágenes—; y el primer GB es gratis **por organización de Karia**, no por cuenta, así
que mientras el total no llegue a 1 GB el costo real es cero.

---

## Cuándo busca el agente

La política vive en la capa 8 del contexto (`src/ai/contexto/capas/conocimiento.ts`) y es lo único que esa
capa emite — el contenido de los documentos ya no viaja en el prompt:

- Conversación y contexto de Karia para saludos, confirmaciones y preguntas ya contestadas.
- La documentación para información estable del comercio (políticas, envío, retiro, materiales, cuidados) que
  no esté ya en la conversación.
- **Precios, inventario, pedidos y tarifas actuales: herramientas de Karia, nunca documentos.**
- No consultar en cada mensaje.
- Si busca y no encuentra, decirlo. No inventarlo.

La mitad de esa decisión está en la descripción de la herramienta, que dice explícitamente para qué **no**
sirve. Sin ese "no", el modelo la usaría para todo: una llamada de file search por mensaje, y un PDF
desactualizado respondiendo lo que debería responder el dato vivo.

**Habilitación condicional**: `buscar_en_documentacion` no está en
`HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES`. `resolverHerramientasAgente()` la agrega solo si el agente
tiene al menos un documento indexado y activo. Un agente sin documentación se comporta **exactamente** como
antes de esta feature.

---

## Formatos: por qué no se pueden subir imágenes

Los vector stores de OpenAI **solo indexan texto**. PNG, SVG y JPG se rechazan con un mensaje que lo explica
y propone la alternativa. No es una limitación de Karia: el servicio no las admite.

Aceptados (24):

```
.pdf .doc .docx .pptx .txt .md .json .html .css .tex
.c .cpp .cs .go .java .js .php .py .rb .sh .ts
```

Un **PDF escaneado** (fotos de páginas, sin texto seleccionable) se rechaza en la carga con `unpdf`, antes de
pagar la indexación. OpenAI lo aceptaría, lo indexaría vacío y lo cobraría; el negocio descubriría recién
semanas después que el agente nunca encontró nada ahí.

---

## Operación

### Límites

| Qué | Valor | Por qué |
|---|---|---|
| Documentos por agente | 20 | El tope de 3 existía por presupuesto de contexto; esa razón desapareció |
| Peso por archivo | 25 MB | OpenAI admite 512 MB; 25 es lo razonable para documentación comercial |
| Fragmentos por búsqueda | 5 | Menos fragmentos = menos tokens por consulta |
| Timeout de búsqueda | 15 s | Al vencer degrada a "no encontré", no rompe la conversación |
| Techo del índice | 10.000 archivos **por cuenta** | Límite duro de OpenAI por vector store |

Sobre el techo: como hay un store por instancia, el límite aplica por cuenta. Con 20 documentos por agente,
una cuenta con cinco agentes usa 100. Es inalcanzable en la práctica.

### Archivos huérfanos

Un archivo sin fila en `DocumentoAgenteIA` no es solo costo: es contenido vivo y consultable que ya nadie
administra —y sigue siéndolo para los agentes de esa misma cuenta. Pasa si un borrado falla a mitad, o si se
elimina un agente (sus filas caen en cascada, pero OpenAI no se entera).

El script recorre los stores de todas las cuentas, leyéndolos de la base (`Instancia.vectorStoreDocumentacionId`),
no de una variable de entorno.

```bash
npx tsx scripts/conciliar-documentos-huerfanos.ts            # solo informa
npx tsx scripts/conciliar-documentos-huerfanos.ts --aplicar  # además borra
```

Los archivos **sin identidad en sus atributos** no se borran automáticamente: no se pueden atribuir a nadie y
requieren decisión humana. Tampoco son consultables —la verificación de aislamiento los descarta—, así que no
hay apuro.

### Borrado

Eliminar un documento hace cuatro cosas, en este orden: desindexa del vector store, **borra el File en
OpenAI** (no alcanza con desindexar), borra la copia del storage de Karia y borra la fila. Si OpenAI falla,
se aborta y la fila queda: un documento que sigue siendo consultable pero ya no figura en ninguna lista es
exactamente el problema que esta feature existe para no tener.

Al eliminar **toda una cuenta**, sus filas caen en cascada pero su vector store queda. Lo levanta la
conciliación de huérfanos.

### Documentos del mecanismo anterior

Los que quedaron en `AgenteIAConfig.documentosFaq` se listan como **"Requiere resubir"**, no son consultables
y se pueden eliminar. No se migran a propósito: un texto resumido no equivale a un archivo indexado entero, y
presentarlos como si lo fueran sería mentir sobre lo que el agente sabe. La columna queda deprecada pero
intacta —borrarla le quitaría a cada cuenta el rastro de lo que tenía.
