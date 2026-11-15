# Contratos internos

**Feature**: `033-documentacion-vector-store-openai`

Los contratos que separan la lógica de negocio del SDK de OpenAI (Constitución, Principio IV: "Business logic
MUST NOT depend on provider SDK types, payloads, or error codes"). Ningún tipo de `openai` cruza estas
fronteras.

---

## 1. `src/ai/documentacion/aislamiento.ts` — la frontera de seguridad

**El archivo más importante de la feature.** Única fuente de la identidad de tenant. Ninguna otra parte del
código puede construir un nombre de archivo, unos atributos ni un filtro.

```ts
export interface IdentidadDocumento {
  instanciaId: string;
  agenteId: string;
  documentoId: string;
}

/** `instanciaId_agenteId_documentoId_nombreSaneado` — FR-011. */
export function nombreArchivoOpenAI(id: IdentidadDocumento, nombreOriginal: string): string;

/** Atributos consultables del vector store file — FR-011. */
export function atributosArchivo(id: IdentidadDocumento): Record<string, string>;

/** Filtro obligatorio de toda búsqueda — FR-012. No recibe nada opcional. */
export function filtroTenant(instanciaId: string, agenteId: string): FiltroDocumentacion;

/**
 * Verifica que TODO fragmento devuelto pertenece al tenant que consultó.
 * Fail-closed: un fragmento sin atributos se considera ajeno — FR-013, FR-014.
 */
export function verificarResultados(
  fragmentos: FragmentoDocumental[],
  instanciaId: string,
  agenteId: string,
): { ok: true } | { ok: false; motivo: string };

/** Forma mínima que necesita la verificación. No es el tipo del SDK. */
export interface FragmentoDocumental {
  attributes?: Record<string, string | number | boolean> | null;
  filename?: string;
}

export type FiltroDocumentacion = {
  type: "and";
  filters: Array<{ type: "eq"; key: string; value: string }>;
};
```

**Invariantes que el contrato hace cumplir**:

- `filtroTenant` no tiene parámetros opcionales ni variante "sin filtro". No existe la forma de no filtrar.
- `verificarResultados` devuelve un resultado que el llamador **debe** inspeccionar (no un `boolean` suelto
  que se pueda ignorar por accidente).
- `FragmentoDocumental` es un tipo propio: el verificador es testeable sin mockear el SDK.

---

## 2. `src/ai/documentacion/busqueda.ts` — el adaptador del proveedor

Única función del repositorio autorizada a invocar `file_search`.

```ts
export interface SolicitudBusquedaDocumental {
  instanciaId: string;        // del ContextoTool del backend, NUNCA de los args del LLM
  agenteId: string;           // ídem
  consulta: string;
  conversacionId?: string;    // trazabilidad en UsoIA
}

export type ResultadoBusquedaDocumental =
  | { encontrado: true;  respuesta: string; fuentes: string[] }
  | { encontrado: false; motivo: MotivoSinResultado };

export type MotivoSinResultado =
  | "SIN_COINCIDENCIAS"   // buscó y no hay nada — FR-018
  | "NO_CONFIGURADO"      // faltan variables de entorno — FR-030
  | "TIEMPO_AGOTADO"      // FR-020
  | "ERROR_PROVEEDOR"     // FR-020
  | "VERIFICACION_FALLIDA"; // un fragmento no era del tenant — FR-013

export async function buscarEnDocumentacion(
  solicitud: SolicitudBusquedaDocumental,
): Promise<ResultadoBusquedaDocumental>;
```

**Garantías del contrato**:

- **No acepta `filters`, `vector_store_ids` ni `attributes`**: los construye internamente desde
  `instanciaId`/`agenteId`. Un llamador no puede ampliar el alcance de la búsqueda ni por error ni a propósito.
- **Nunca lanza.** Todo fallo se convierte en `{ encontrado: false, motivo }` — una búsqueda rota no puede
  tumbar la respuesta al cliente (FR-020).
- **Siempre registra en `UsoIA`** antes de devolver, tanto en éxito como en fallo (FR-022, FR-026).
- Ningún tipo de `openai` aparece en la firma.

---

## 3. `src/ai/documentacion/vector-store.ts` — ciclo de vida del store y los archivos

```ts
/** El store de la cuenta, o null si todavía no subió nada. */
export async function vectorStoreDeInstancia(instanciaId: string): Promise<string | null>;

/** El store de la cuenta, creándolo si es la primera vez. Idempotente y a
 *  prueba de carreras: dos llamadas simultáneas devuelven el MISMO id. */
export async function asegurarVectorStoreInstancia(
  instanciaId: string,
): Promise<{ ok: true; vectorStoreId: string } | { ok: false; motivo: string }>;

export interface SolicitudIndexacion {
  identidad: IdentidadDocumento;
  nombreOriginal: string;
  contenido: Buffer;
  mime: string;
}

export type ResultadoIndexacion =
  | { ok: true;  openaiFileId: string; vectorStoreFileId: string; vectorStoreId: string }
  | { ok: false; motivo: string };

export async function indexarArchivo(s: SolicitudIndexacion): Promise<ResultadoIndexacion>;

/** Borrado real: desindexa Y borra el File en OpenAI — FR-009. */
export async function eliminarArchivo(ref: {
  vectorStoreId: string | null;
  vectorStoreFileId: string | null;
  openaiFileId: string | null;
}): Promise<{ ok: true } | { ok: false; motivo: string }>;
```

**Garantías**:

- `indexarArchivo` no acepta `attributes` **ni `vectorStoreId`**: deriva los primeros de `identidad` con
  `atributosArchivo()` y resuelve el segundo con `asegurarVectorStoreInstancia()`. Un archivo sin identidad,
  o en el store de otra cuenta, es imposible de crear.
- `eliminarArchivo` tolera 404 en cada paso (ya borrado = éxito) pero reporta cualquier otro error, para no
  dejar chunks vivos en un índice compartido.

---

## 4. `src/ai/documentacion/queries.ts` — lecturas

```ts
/** DTO del frontend. Sin ids de OpenAI ni storageKey — FR-015. */
export interface DocumentoAgenteVista {
  id: string;
  nombre: string;
  extension: string;
  pesoBytes: number;
  estado: "INDEXANDO" | "LISTO" | "ERROR";
  errorIndexacion: string | null;
  activo: boolean;
  creadoEn: string;
}

export async function listarDocumentosAgente(
  agenteIAConfigId: string,
  instanciaId: string,
): Promise<DocumentoAgenteVista[]>;

/** Decide si el agente recibe la herramienta y la capa de política — FR-019. */
export async function contarDocumentosListos(
  agenteIAConfigId: string,
): Promise<{ cantidad: number; nombres: string[] }>;
```

---

## 5. `buscar_en_documentacion` — contrato con el modelo

Implementa `IProveedorTool` (`src/ai/tools/types.ts`).

```jsonc
{
  "name": "buscar_en_documentacion",
  "description": "Busca en la documentación que cargó el negocio: políticas, métodos generales de envío y retiro, materiales, cuidados y preguntas frecuentes. NO sirve para precios, stock, pedidos ni tarifas actuales — para eso usá las herramientas de datos. Si no encontrás, decilo en vez de inventar.",
  "input_schema": {
    "type": "object",
    "properties": {
      "consulta": {
        "type": "string",
        "description": "Qué buscar, en lenguaje natural. Ej: 'política de devoluciones', 'cómo se cuida el cuero'."
      }
    },
    "required": ["consulta"]
  }
}
```

**Respuesta al modelo** (`ResultadoTool.data`):

```jsonc
// encontrado
{ "encontrado": true, "respuesta": "…", "fuentes": ["politica-envios.pdf"] }

// no encontrado — FR-018: explícito, para que el agente lo diga
{ "encontrado": false, "mensaje": "No hay nada en la documentación del negocio sobre eso." }
```

**El `instanciaId` y el `agenteId` salen siempre del `ContextoTool`**, nunca de los argumentos. Si el modelo
los inyecta en el JSON, se ignoran — regla ya vigente en `src/ai/tools/executor.ts`.

---

## 6. Server Actions — `src/configuracion/ia/documentacion/actions.ts`

Todas devuelven el tipo `Resultado<T>` que ya usa `conocimiento/actions.ts`, y todas empiezan por
`requireSesion()` + `verificarAcceso(sesion, "ia", "modificar")`, con el `instanciaId` tomado **de la sesión**
y nunca de un parámetro (Constitución, Principio V).

```ts
type Resultado<T = void> = { exito: true; datos?: T } | { exito: false; error: string };

subirDocumento(agenteIAConfigId: string, formData: FormData): Promise<Resultado<DocumentoAgenteVista>>;
eliminarDocumento(agenteIAConfigId: string, documentoId: string): Promise<Resultado>;
alternarActivo(agenteIAConfigId: string, documentoId: string, activo: boolean): Promise<Resultado>;
reintentarIndexacion(agenteIAConfigId: string, documentoId: string): Promise<Resultado<DocumentoAgenteVista>>;
eliminarDocumentoLegacy(agenteIAConfigId: string, documentoId: string): Promise<Resultado>;
```

Devuelven `DocumentoAgenteVista`, nunca la fila de Prisma: el DTO es la frontera que garantiza FR-015.

---

## 7. Cambios de firma en contratos existentes

```ts
// src/ai/tools/herramientas-agente.ts — FR-019
resolverHerramientasAgente({
  herramientas,
  catalogoEnContexto,
  tieneDocumentacion,   // NUEVO. false/undefined = comportamiento idéntico al actual
}): string[]

// src/ai/contexto/capas/conocimiento.ts — FR-006, FR-017
// antes: producirCapaConocimiento(documentosFaq: unknown): string | null
producirCapaConocimiento(insumos: {
  tieneDocumentacion: boolean;
  nombres: string[];
}): string | null

// src/ai/auditoria/logger.ts — research.md D4
// antes: proveedorIAId: string
proveedorIAId?: string
```

Los tres son compatibles hacia atrás en comportamiento: sin documentación, el sistema produce exactamente lo
mismo que antes de esta feature (FR-032).
