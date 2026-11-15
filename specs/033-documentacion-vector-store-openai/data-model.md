# Data Model: Documentación del comercio sobre Vector Store + File Search

**Feature**: `033-documentacion-vector-store-openai` · **Fecha**: 2026-11-15

---

## 1. Entidad nueva — `DocumentoAgenteIA`

Un archivo que el comercio cargó para que su agente lo consulte. Reemplaza a la columna JSON
`AgenteIAConfig.documentosFaq` (ver research.md, Decisión 6).

```prisma
enum EstadoDocumentoAgenteIA {
  INDEXANDO
  LISTO
  ERROR
}

/// 033 — Documentación del comercio indexada en el vector store de OpenAI.
///
/// Tabla y no columna JSON en AgenteIAConfig porque, a diferencia de
/// `documentosFaq`, esto NO es configuración versionable: el contenido dejó de
/// ser parte del prompt, y restaurar una versión vieja no debe resucitar un
/// documento ya borrado en OpenAI.
///
/// Los tres campos de identidad externa (openaiFileId, vectorStoreFileId,
/// vectorStoreId) NUNCA salen al cliente — ver listarDocumentosAgente().
model DocumentoAgenteIA {
  id        String @id @default(cuid())
  /// Nombre tal como lo subió el negocio. Es lo ÚNICO que la UI muestra.
  nombre    String
  extension String
  mime      String
  pesoBytes Int

  /// Copia del original en el storage de Karia — permite reindexar sin pedirle
  /// al negocio que vuelva a subir el archivo (FR-007).
  storageKey String

  /// Identidad en OpenAI. Infraestructura: nunca viaja al frontend (FR-015).
  openaiFileId      String?
  vectorStoreFileId String?
  /// En cuál store quedó: el de su instancia. Se guarda por documento para
  /// poder borrarlo sin tener que volver a resolver la cuenta.
  vectorStoreId     String?

  estado          EstadoDocumentoAgenteIA @default(INDEXANDO)
  /// Motivo legible del fallo de indexación. Null salvo en ERROR.
  errorIndexacion String?
  /// Desactivado sigue cargado e indexado, pero el filtro de búsqueda lo
  /// excluye: el agente no lo encuentra (FR-008).
  activo          Boolean @default(true)

  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  agenteIAConfigId String
  agenteIAConfig   AgenteIAConfig @relation(fields: [agenteIAConfigId], references: [id], onDelete: Cascade)

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  @@index([agenteIAConfigId, estado])
  @@index([instanciaId])
}
```

### Reglas de validación

| Campo | Regla | Requisito |
|---|---|---|
| `extension` | Debe estar en `EXTENSIONES_SOPORTADAS` (24 formatos). `.png`, `.svg`, `.jpg`, `.jpeg` rechazados con mensaje propio | FR-002 |
| `pesoBytes` | `> 0` y `<= 25 MB` | FR-001 |
| `nombre` | Recortado a 200 caracteres | — |
| (cantidad) | Máximo 20 filas por `agenteIAConfigId` | FR-001 |
| (PDF) | Debe tener texto extraíble, verificado antes de indexar | FR-004 |

Toda validación se ejecuta en el servidor, aunque el navegador ya haya filtrado (FR-003, Constitución
Principio II).

### Transiciones de estado

```
            subir archivo
                 │
                 ▼
         ┌───────────────┐   indexación OK    ┌────────┐
         │   INDEXANDO   │───────────────────▶│ LISTO  │
         └───────────────┘                    └────────┘
                 │                                 │
                 │ falla                           │ eliminar
                 ▼                                 ▼
            ┌─────────┐   reintentar          (fila borrada +
            │  ERROR  │──────────────▶ INDEXANDO    borrado real
            └─────────┘                             en OpenAI)
```

- `INDEXANDO` → no consultable todavía.
- `LISTO` → consultable si además `activo = true`.
- `ERROR` → no consultable; `errorIndexacion` explica por qué; reintentable sin resubir (FR-010).

### Invariante de aislamiento

Cada fila tiene exactamente un `instanciaId` y un `agenteIAConfigId`, y esos dos valores son los que viajan
al archivo en OpenAI —en su `filename` y en sus `attributes`— y los que filtran cada búsqueda. La fila de
Prisma y el objeto en OpenAI **comparten la misma identidad**; ver `aislamiento.ts` en el plan.

### DTO que sí puede ver el frontend

`listarDocumentosAgente()` usa un `select` explícito. Lo que se expone y nada más (FR-015):

```ts
interface DocumentoAgenteVista {
  id: string;
  nombre: string;
  extension: string;
  pesoBytes: number;
  estado: "INDEXANDO" | "LISTO" | "ERROR";
  errorIndexacion: string | null;
  activo: boolean;
  creadoEn: string;   // ISO UTC
}
```

**Excluidos por diseño**: `storageKey`, `openaiFileId`, `vectorStoreFileId`, `vectorStoreId`, `mime`.

---

## 2. Entidad existente que se extiende — `UsoIA`

Sin cambios estructurales en el modelo. Se agrega un valor al enum de tareas:

```prisma
enum TareaIA {
  CHAT
  RESUMEN
  CLASIFICACION
  SENTIMIENTO
  EXTRACCION_ENTIDADES
  REPORTE
  EMBEDDINGS
  IDENTIFICACION_PRODUCTO
  /// 033 — una búsqueda en la documentación del comercio. Distinta de
  /// EMBEDDINGS: acá los tokens son los de la síntesis de la respuesta, y el
  /// costo incluye además la tarifa por llamada de file search.
  BUSQUEDA_DOCUMENTAL
}
```

### Cómo se llena una fila de búsqueda documental

| Campo | Valor | Requisito |
|---|---|---|
| `tarea` | `BUSQUEDA_DOCUMENTAL` | FR-022 |
| `modelo` | El modelo de `OPENAI_DOCUMENTACION_MODELO` | — |
| `tokensInput` / `tokensOutput` | `response.usage.input_tokens` / `.output_tokens` — **reales del proveedor** | FR-023 |
| `costoEstimado` | `calcularCosto(...) + 0.0025`, o `null` si faltan tarifas | FR-024 |
| `instanciaId` | Del `ContextoTool` del backend | FR-025 |
| `agenteIAConfigId` | Del `ContextoTool` | FR-025 |
| `agenteIAConfigVersionId` | `obtenerVersionPublicadaVigenteId()` | FR-025 |
| `proveedorIAId` | **`null`** — la credencial es de Karia, no un `ProveedorIA` del tenant | research.md D4 |
| `entidadTipo` / `entidadId` | `"conversacion"` / `conversacionId` | FR-025 |
| `exito` / `error` | `false` + motivo cuando la búsqueda falla, con tokens en 0 | FR-026 |
| `tiempoMs` | Duración de la llamada | — |

**Cambio de tipo acompañante**: `RegistrarUsoParams.proveedorIAId` (`src/ai/auditoria/logger.ts:7`) pasa de
`string` a `string | undefined`. La columna `UsoIA.proveedorIAId` ya era nullable — el tipo era más estricto
que el schema. Es un ensanchamiento: ningún llamador existente se rompe.

**No se registra nada al indexar** (FR-027): OpenAI factura la indexación por storage, no por tokens.

---

## 3. Entidad existente que se modifica — `AgenteIAConfig`

```prisma
  /// @deprecated 033 — Reemplazado por el modelo DocumentoAgenteIA. Ya no se
  /// lee ni se escribe: el contenido de los documentos dejó de ser parte del
  /// prompt. La columna sobrevive solo para que la UI pueda listar lo cargado
  /// con el mecanismo anterior como "Requiere resubir" (FR-031) y permitir
  /// eliminarlo. No borrar la columna en esta migración.
  documentosFaq Json?

  /// 033 — relación inversa
  documentos DocumentoAgenteIA[]
```

**No se agrega `vectorStoreId` al agente**: el store es de la instancia, no del agente (research.md D4).
Dentro de la cuenta, lo que separa a un agente de otro son los atributos del archivo y el filtro.

**Lo que sale del ciclo de configuración del agente** — necesario para cumplir FR-015 y FR-029:

| Lugar | Cambio |
|---|---|
| `AgenteIAConfigSchema` (`agente-schema.ts:169`) | se quita `documentosFaq` y `DocumentoFaqSchema` |
| `construirPayloadAgenteIA` (`payload-agente.ts:48`) | se quita `documentosFaq` |
| `select` de `agente-actions.ts:127` | se quita `documentosFaq` |
| Formulario (`sheet-editar-agente.tsx`) | la sección deja de usar `watch`/`setValue` |

Con esto, `documentosFaq` deja de viajar en el snapshot de `AgenteIAConfigVersion`. Publicar o restaurar una
versión ya no toca la documentación (FR-033) — que es lo correcto: una versión del perfil no puede resucitar
un archivo borrado en OpenAI.

---

## 4. Entidad existente que se modifica — `Instancia`

```prisma
  /// 033
  documentosAgenteIA DocumentoAgenteIA[]

  /// Vector store de OpenAI donde se indexa la documentación de ESTA cuenta.
  /// Uno por instancia: así el índice de un comercio no contiene bytes de otro
  /// y el techo de 10.000 archivos por store pasa a ser por cuenta.
  ///
  /// Se crea solo, la primera vez que la cuenta sube un documento — no hay
  /// forma de pre-crear a mano un store por cada tenant. Null = esta cuenta
  /// todavía no subió documentación. Vive en la organización de OpenAI de
  /// Karia (OPENAI_DOCUMENTACION_API_KEY), no en la del cliente.
  vectorStoreDocumentacionId String?
```

### Creación perezosa, a prueba de carreras

Dos subidas simultáneas de la misma cuenta podrían crear dos stores y dejar la mitad de los documentos en un
índice que después nadie consulta. El alta usa un UPDATE condicional:

```
1. leer Instancia.vectorStoreDocumentacionId → si existe, listo
2. crear el store en OpenAI
3. updateMany({ where: { id, vectorStoreDocumentacionId: null }, data: { ... } })
4. count === 0 → perdimos: borrar NUESTRO store y quedarnos con el del ganador
```

Sin locks ni transacciones largas. Cubierto por `src/ai/documentacion/vector-store.test.ts`.

---

## Migración

**Archivo**: `prisma/migrations/<timestamp>_documentacion_vector_store/migration.sql`

Operaciones, todas aditivas:

1. `CREATE TYPE "EstadoDocumentoAgenteIA" AS ENUM ('INDEXANDO', 'LISTO', 'ERROR');`
2. `ALTER TYPE "TareaIA" ADD VALUE 'BUSQUEDA_DOCUMENTAL';`
3. `CREATE TABLE "DocumentoAgenteIA" (...)` con sus FK (`ON DELETE CASCADE`) y sus dos índices.
4. `ALTER TABLE "Instancia" ADD COLUMN "vectorStoreDocumentacionId" TEXT;` — nullable y sin default, así
   ninguna fila existente cambia de comportamiento.

**Seguridad para datos existentes** (Constitución, Technical Constraints):

- **Cero operaciones destructivas.** No se borra la columna `documentosFaq` ni ninguna fila.
- **Reversible**: el rollback es `DROP TABLE` + `DROP TYPE` + `DROP COLUMN`. El valor agregado al enum `TareaIA` no se puede
  quitar en PostgreSQL, pero es inocuo — ninguna fila lo usa si se revierte.
- **Nota operativa**: `ALTER TYPE ... ADD VALUE` no puede ejecutarse dentro de una transacción en PostgreSQL
  < 12. El proyecto usa PostgreSQL moderno, donde sí se puede; si el deploy fallara por esto, el paso 2 va en
  su propia migración antes que los demás.
- **Despliegue**: la aplicación anterior sigue funcionando con la tabla nueva presente (nunca la consulta), y
  la nueva funciona con `documentosFaq` todavía poblada (la lista como "Requiere resubir"). No hace falta
  coordinar migración y despliegue.

---

## Resumen de impacto

| Entidad | Cambio | Destructivo |
|---|---|---|
| `DocumentoAgenteIA` | Modelo nuevo | No |
| `EstadoDocumentoAgenteIA` | Enum nuevo | No |
| `TareaIA` | +1 valor | No |
| `AgenteIAConfig` | +relación inversa; `documentosFaq` deprecado pero intacto | No |
| `Instancia` | +relación inversa y +`vectorStoreDocumentacionId` (nullable) | No |
| `UsoIA` | Sin cambios de schema | No |
