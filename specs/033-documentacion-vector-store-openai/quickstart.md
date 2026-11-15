# Quickstart: validación end-to-end

**Feature**: `033-documentacion-vector-store-openai` · **Fecha**: 2026-11-15

Cómo comprobar que la feature funciona. Los escenarios 5 (cruce entre cuentas) y 10 (cero regresión) son
obligatorios antes de dar por terminada la implementación.

---

## Prerrequisitos

1. Base de datos migrada:

   ```bash
   npm run db:migrate
   ```

2. Variables de entorno de documentación (`.env.local`). Las dos primeras son obligatorias; sin ellas la
   feature queda apagada a propósito y se valida el escenario 8:

   ```bash
   OPENAI_DOCUMENTACION_API_KEY=sk-...        # key de la cuenta OpenAI de Karia
   OPENAI_DOCUMENTACION_MODELO=gpt-6-luna
   # POR MIL tokens, no por millón. Estos son los de gpt-6-luna
   # ($0,10 / $0,50 por 1M). Ver la tabla en README.md.
   OPENAI_DOCUMENTACION_COSTO_INPUT_POR_MIL=0.0001
   OPENAI_DOCUMENTACION_COSTO_OUTPUT_POR_MIL=0.0005
   ```

   No hay nada que pre-crear: el vector store de cada cuenta se crea solo la primera vez que sube un
   documento, y su id queda en `Instancia.vectorStoreDocumentacionId`.

3. Archivos de prueba:
   - `politica-envios.pdf` — PDF con texto, que diga algo verificable (p. ej. *"Enviamos a todo el país en 3
     a 5 días hábiles"*).
   - `manual-cuidados.docx`
   - `escaneado.pdf` — un PDF de fotos de páginas, sin texto seleccionable.
   - `logo.png` y `icono.svg`.

4. Servidor:

   ```bash
   npm run dev
   ```

---

## Suite automatizada

```bash
npx vitest run src/ai/documentacion src/ai/tools src/ai/contexto/capas src/configuracion/ia
```

Debe pasar en verde. Los tests que **no pueden faltar** y qué protege cada uno:

| Test | Protege |
|---|---|
| `aislamiento.test.ts` → el nombre sigue `instanciaId_agenteId_documentoId_…`, es estable y sanea el original | FR-011 |
| `aislamiento.test.ts` → `filtroTenant` arma los dos `eq` | FR-012 |
| `aislamiento.test.ts` → `verificarResultados` rechaza un fragmento de otra instancia **y uno sin `attributes`** | FR-013, FR-014 |
| `busqueda.test.ts` → la llamada **siempre** incluye `filters` con el tenant correcto | FR-012 |
| `busqueda.test.ts` → con un fragmento ajeno en la respuesta, se descarta todo y devuelve `encontrado: false` | FR-013 |
| `busqueda.test.ts` → registra `UsoIA` con los tokens del `usage` del proveedor | FR-023 |
| `busqueda.test.ts` → `costoEstimado` = tokens × tarifa + 0,0025; `null` si faltan tarifas | FR-024 |
| `busqueda.test.ts` → un fallo registra `exito: false`, tokens 0, y **no lanza** | FR-020, FR-026 |
| `buscar-en-documentacion.tool.test.ts` → un `instanciaId` en los args del LLM se ignora | FR-012 |
| `conocimiento.test.ts` → sin documentos devuelve `null`; con documentos emite la política y **nunca** contenido de archivos | FR-006, FR-017 |
| `herramientas-agente.test.ts` → la herramienta aparece solo con `tieneDocumentacion: true` | FR-019 |
| `documentacion/actions.test.ts` → PNG y SVG rechazados en el servidor; documento de otra instancia no se encuentra ni se borra | FR-002, FR-003 |

> Si alguien quita el filtro, afloja la verificación o hace opcional la identidad, al menos uno de estos
> tests debe ponerse en rojo. Si no, el test está mal escrito.

---

## Escenarios manuales

### 1 · Cargar un documento *(US1 — FR-001, FR-005, FR-028)*

Configuración → Agentes → editar el agente → pestaña **Conocimiento** → sección **Documentación del comercio**
→ subir `politica-envios.pdf`.

**Esperado**: el archivo aparece con estado "Indexando" y pasa a "Listo" sin acción adicional. La fila muestra
**solo el nombre**, el estado, el toggle Activo y el botón eliminar. **No hay** textarea, ni contador de
caracteres, ni botón "Entrenar".

Verificar que la copia quedó para reindexar (FR-007):

```sql
SELECT nombre, estado, "storageKey" IS NOT NULL AS tiene_copia
FROM "DocumentoAgenteIA" ORDER BY "creadoEn" DESC LIMIT 5;
```

---

### 2 · Formatos rechazados *(US1 — FR-002, FR-004)*

| Archivo | Esperado |
|---|---|
| `logo.png` | Rechazado: *"Las imágenes no se pueden indexar como documentación. Subí el contenido como PDF, Word o TXT."* |
| `icono.svg` | Mismo rechazo |
| `escaneado.pdf` | Rechazado explicando que un PDF escaneado no tiene texto que indexar |
| `manual-cuidados.docx` | **Aceptado** — llega a "Listo" |

Repetir el PNG **deshabilitando JavaScript** o invocando el server action directamente: debe rechazarse
igual (FR-003).

---

### 3 · Los ids internos no salen al navegador *(US1 — FR-015)*

DevTools → pestaña Network → recargar la página de configuración → buscar en todas las respuestas (incluida
la carga RSC de Next):

```
vs_      → 0 coincidencias
file-    → 0 coincidencias
```

Buscar también `storageKey` y `vectorStoreFileId`: 0 coincidencias.

---

### 4 · El agente consulta cuando corresponde *(US2 — FR-016, FR-017, FR-018)*

Abrir el **Simulador de agente** y recorrer los cinco casos de la política:

| # | Mensaje del cliente | Esperado |
|---|---|---|
| 4a | *"hola"* | Saluda. **No** consulta la documentación |
| 4b | *"¿hacen envíos a todo el país?"* | Consulta la documentación y responde con lo que dice el PDF |
| 4c | *"¿cuánto cuesta el producto X?"* | Usa `consultar_precio_actual`. **No** consulta la documentación |
| 4d | *"¿tienen sucursal en Japón?"* (no está en ningún documento) | Dice que no cuenta con esa información. **No** la inventa |
| 4e | Repetir 4b en la misma conversación | Responde con lo que ya está en la conversación, sin volver a buscar |

El panel de herramientas del simulador muestra qué llamó el agente en cada turno.

---

### 5 · Cruce entre cuentas y entre agentes — **OBLIGATORIO** *(US1 — FR-011 a FR-014, SC-005)*

**5a · Entre comercios.**

1. En la **instancia A**, subir un documento que diga *"Enviamos solo a Lima"*.
2. En la **instancia B**, subir otro que diga *"Enviamos a todo el país"*.
3. Preguntar *"¿a dónde envían?"* en el simulador de cada instancia. Repetir al menos 5 veces en cada una.

**Esperado**: A responde solo "Lima", B responde solo "todo el país". Nunca mencionan la otra opción, ni la
mezclan, ni citan el archivo ajeno.

Verificar además que son índices distintos:

```sql
SELECT id, nombre, "vectorStoreDocumentacionId" FROM "Instancia"
WHERE "vectorStoreDocumentacionId" IS NOT NULL;
```

Dos ids distintos, y en el dashboard de OpenAI cada store contiene solo los archivos de su cuenta.

**5b · Entre agentes de la misma cuenta** — acá el aislamiento sí es lógico y es lo que hay que probar.

1. En la **instancia A**, con dos agentes (Comercial y Gerencia), subirle a cada uno un documento distinto
   con información contradictoria sobre el mismo tema.
2. Preguntar lo mismo en el simulador de cada agente.

**Esperado**: cada agente responde solo con su documento. En el dashboard de OpenAI los dos archivos
conviven en el **mismo** store de la instancia: eso prueba que la separación entre agentes es del filtro.

**5c · Fail-closed** (requiere acceso al dashboard de OpenAI): subir un archivo al store de una cuenta **sin
atributos** y preguntar algo que solo esté ahí. Esperado: el agente responde que no encontró nada, y en los
logs aparece la alerta de verificación fallida. Un archivo sin identidad no puede colarse.

---

### 6 · Contabilización de tokens *(US2 — FR-022 a FR-026)*

Después de los escenarios 4 y 5:

```sql
SELECT tarea, modelo, "tokensInput", "tokensOutput", "costoEstimado",
       exito, "entidadTipo", "entidadId", "proveedorIAId",
       "agenteIAConfigId", "agenteIAConfigVersionId", "creadoEn"
FROM "UsoIA"
WHERE tarea = 'BUSQUEDA_DOCUMENTAL'
ORDER BY "creadoEn" DESC;
```

**Esperado**:
- Una fila por cada búsqueda realizada — y **solo** por esas. Los turnos 4a, 4c y 4e no generan fila.
- `tokensInput` y `tokensOutput` mayores que cero y coincidentes con el `usage` que devuelve OpenAI
  (cotejable en el dashboard de uso).
- `costoEstimado` ≈ tokens × tarifa + 0,0025. Con un modelo barato la tarifa por llamada domina: una búsqueda típica (~2.000 in / 100 out) con `gpt-6-luna` da ≈ 0,00025 en tokens contra 0,0025 de tarifa.
- `proveedorIAId` en `NULL` (credencial de Karia, no del tenant).
- `instanciaId` correcto en cada caso del escenario 5.
- `entidadId` apunta a la conversación que la disparó.

Además, Configuración → IA → consumo debe reflejar estas búsquedas en el total.

Verificar que **la carga no registró tokens** (FR-027): no debe existir ninguna fila de `UsoIA` cuyo
`creadoEn` coincida con el momento de la subida del escenario 1.

---

### 7 · Eliminación real *(US1 — FR-009, SC-007)*

Eliminar `politica-envios.pdf` desde la UI y verificar las cuatro cosas:

1. Desaparece de la lista.
2. Preguntar 4b otra vez → el agente ya no encuentra la política.
3. En el dashboard de OpenAI: el archivo **no está en el vector store**.
4. En el dashboard de OpenAI → Storage → Files: el archivo **tampoco está ahí** (no quedó solo desindexado).

```sql
SELECT COUNT(*) FROM "DocumentoAgenteIA" WHERE nombre = 'politica-envios.pdf';  -- 0
```

---

### 8 · Casos de recuperación *(US3 — FR-010, FR-030, FR-031)*

| # | Cómo provocarlo | Esperado |
|---|---|---|
| 8a | Quitar `OPENAI_DOCUMENTACION_API_KEY` y reiniciar | La sección muestra el mensaje de "no habilitada" en vez del botón de carga. El agente responde normal, sin la herramienta |
| 8b | Poner una key inválida y subir un archivo | La fila queda en "Error" con el motivo, y el botón "Reintentar" la vuelve a indexar cuando la key se corrige — **sin volver a subir el archivo** |
| 8c | Agente con `documentosFaq` poblada de antes | Los documentos viejos se listan con "Requiere resubir", el agente no los usa, y se pueden eliminar |

---

### 9 · Degradación por timeout *(US2 — FR-020)*

Bajar `TIMEOUT_BUSQUEDA_MS` a 1 ms temporalmente y preguntar 4b.

**Esperado**: el agente responde que no cuenta con esa información; la conversación **no se rompe**; queda
una fila de `UsoIA` con `exito = false`.

---

### 10 · Cero regresión — **OBLIGATORIO** *(FR-032, FR-033, SC-008)*

1. Un agente **sin** documentación cargada responde exactamente igual que antes de la feature: sin la
   herramienta en su lista y sin el bloque de política en el prompt.
2. El catálogo (capa 8), las respuestas guía, las reglas de ciclo de vida y las herramientas operativas
   siguen funcionando igual.
3. Publicar una versión nueva del agente y luego restaurar una anterior: **la documentación cargada no
   cambia** en ninguno de los dos casos (FR-033).
4. Crear una cotización y un pedido desde el agente: sin cambios.

```bash
npm run build && npx vitest run
```

Build limpio y suite completa en verde. Según el Principio V de la Constitución, el cambio no está terminado
hasta que esto pase.

---

## Referencias

- Contratos de las funciones: [`contracts/interfaces.md`](./contracts/interfaces.md)
- Modelo de datos y migración: [`data-model.md`](./data-model.md)
- Decisiones y alternativas descartadas: [`research.md`](./research.md)
