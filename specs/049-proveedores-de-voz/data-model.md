# Data Model: Proveedores de Voz y transcripción (049)

Dos modelos nuevos, un enum de estado, columnas de transcripción en `MediaArchivo` y un toggle
en `ConfiguracionEmpresa`. Todo acotado por `instanciaId` (Constitución, Principio V).

---

## Enums nuevos

```prisma
enum ProveedorVozEnum {
  ELEVENLABS
  OPENAI
  LOCAL
}

// Estado de la transcripción de un MediaArchivo. NO_APLICA es el default
// porque la mayoría de los archivos (imágenes, documentos) nunca se transcribe.
enum EstadoTranscripcion {
  NO_APLICA
  PENDIENTE
  PROCESANDO
  LISTO
  INAUDIBLE // terminal: el audio no tenía habla. NO se reintenta (R6).
  ERROR     // terminal: agotó MAX_INTENTOS.
}
```

### Transiciones válidas

```
NO_APLICA ──(mensaje AUDIO/NOTA_VOZ creado, toggle on)──> PENDIENTE
PENDIENTE ──(reclamo con lease)──────────────────────────> PROCESANDO
PROCESANDO ──(texto con habla)───────────────────────────> LISTO        [terminal]
PROCESANDO ──(sin habla / confianza baja)────────────────> INAUDIBLE    [terminal]
PROCESANDO ──(fallo, intentos < MAX)─────────────────────> PENDIENTE    (con backoff)
PROCESANDO ──(fallo, intentos = MAX)─────────────────────> ERROR        [terminal]
PROCESANDO ──(lease vencido)─────────────────────────────> PENDIENTE    (recuperación)
cualquiera ──(fuera de alcance: no hay mensaje AUDIO/NOTA_VOZ)──> NO_APLICA
```

Reglas:

- `LISTO`, `INAUDIBLE` y `ERROR` son terminales. Solo una acción manual explícita puede
  devolver `ERROR` a `PENDIENTE`.
- **`INAUDIBLE` nunca se reintenta** (R6, FR-017). Es el error más fácil de cometer al
  refactorizar: tratarlo como fallo lo mete en el backoff y gasta cinco llamadas pagas para
  obtener cinco veces el mismo silencio.
- Un archivo solo puede pasar a `PENDIENTE` si lo referencia un mensaje `AUDIO`/`NOTA_VOZ`
  (FR-011). Ver `contracts/alcance-transcripcion.md`.

---

## `ProveedorVoz` (nuevo)

Espejo de `ProveedorIA` en forma, distinto en unidad de medida: **segundos de audio, no tokens**
(R3).

```prisma
// 049 — Credenciales de proveedores de voz por instancia.
//
// Separado de ProveedorIA a propósito: el consumo se mide en TIEMPO DE AUDIO,
// no en tokens. Meter segundos en las columnas de tokens de UsoIA rompería
// obtenerResumenUsoIA y el control de presupuesto de 042, que suman
// tokensInput + tokensOutput sin discriminar la tarea. Ver research.md R3.
model ProveedorVoz {
  id               String           @id @default(cuid())
  // Mismo par alias/aliasNormalizado de 021: permite varias configuraciones
  // del mismo servicio dentro de una cuenta.
  alias            String
  aliasNormalizado String
  proveedor        ProveedorVozEnum
  apiKeyEncriptada String?          // salida de cifrarToken(). Nunca el valor plano.
  baseUrl          String?          // SÍ llega al adaptador, a diferencia de ProveedorIA.baseUrl (R3)
  modelo           String           @default("scribe_v3")
  activo           Boolean          @default(true)
  prioridad        Int              @default(1)
  costoPorHora     Decimal?         // null = no se calcula costo, nunca se inventa (R7)
  limiteMinutosDia Int?
  timeoutMs        Int              @default(30000)
  reintentosMax    Int              @default(2)
  creadoEn         DateTime         @default(now())
  actualizadoEn    DateTime         @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  usoVoz UsoVoz[]

  @@unique([instanciaId, aliasNormalizado])
  @@index([instanciaId, activo, prioridad])
}
```

**Validaciones** (Zod en el boundary, Principio II):

| Campo | Regla |
|---|---|
| `alias` | 1–60 caracteres tras `trim()`; `aliasNormalizado = alias.trim().toLowerCase()` |
| `aliasNormalizado` | único por instancia; se chequea antes de Prisma y el índice cubre la carrera (P2002) |
| `proveedor` | debe estar en `PROVEEDORES_VOZ_IMPLEMENTADOS`; **inmutable tras la creación** |
| `apiKeyEncriptada` | vacío al editar = conservar la vigente (FR-003). Nunca se devuelve al cliente (FR-002) |
| `costoPorHora` | ≥ 0 si se informa |
| `limiteMinutosDia`, `timeoutMs`, `reintentosMax` | enteros positivos |

---

## `UsoVoz` (nuevo)

```prisma
// 049 — Auditoría de uso de voz. El análogo de UsoIA, medido en segundos.
model UsoVoz {
  id            String   @id @default(cuid())
  modelo        String
  segundos      Int      @default(0)
  costoEstimado Decimal?
  tiempoMs      Int      @default(0)
  exito         Boolean  @default(true)
  error         String?  // código/motivo funcional, nunca el stack ni la credencial
  entidadTipo   String?  // "MediaArchivo"
  entidadId     String?
  creadoEn      DateTime @default(now())

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  proveedorVozId String?
  proveedorVoz   ProveedorVoz? @relation(fields: [proveedorVozId], references: [id], onDelete: SetNull)

  @@index([instanciaId, creadoEn])
  @@index([proveedorVozId])
}
```

- Se escribe **una fila por intento**, con éxito o sin él — igual que `UsoIA`, para que el gasto
  real sea auditable aunque la llamada falle después de consumir.
- `entidadTipo`/`entidadId` es el mismo puntero laxo sin FK que usa `UsoIA`.
- `error` guarda el motivo funcional. Nunca credenciales ni contenido de la conversación
  (FR-032, Principio V).

---

## `MediaArchivo` — columnas nuevas

```prisma
  // 049 — Transcripción. Vive acá y no en MensajeConversacion porque MediaArchivo
  // ya es una fila por archivo y ya deduplica por hash: el mismo audio reenviado
  // se transcribe y se cobra UNA vez (FR-016, SC-007).
  //
  // OJO: que estas columnas existan acá NO significa que se transcriba cualquier
  // MediaArchivo. El mime no alcanza para decidirlo — en Instagram una nota de voz
  // y un video llegan los dos como video/mp4. Solo se marca desde un mensaje con
  // tipo AUDIO o NOTA_VOZ. Ver contracts/alcance-transcripcion.md.
  transcripcion               String?
  transcripcionEstado         EstadoTranscripcion @default(NO_APLICA)
  transcripcionIdioma         String?             // ISO-639-1 detectado por el proveedor
  transcripcionSegundos       Int?                // duración real informada (R10)
  transcripcionIntentos       Int                 @default(0)
  transcripcionBloqueadoHasta DateTime?           // lease del reclamo
  transcripcionProveedorVozId String?             // sin FK: el proveedor puede borrarse
  transcripcionEn             DateTime?
```

**Índice parcial**, escrito a mano en el SQL de la migración (convención de `ContactoAnalisisCola`,
no se declara en el DSL de Prisma):

```sql
CREATE INDEX "MediaArchivo_transcripcion_pendiente_idx"
  ON "MediaArchivo" ("instanciaId", "transcripcionBloqueadoHasta")
  WHERE "transcripcionEstado" = 'PENDIENTE';
```

Es parcial a propósito: `MediaArchivo` guarda sobre todo imágenes, que quedan en `NO_APLICA` y
no entran al índice.

**Por qué no en `MensajeConversacion`**: además de romper la deduplicación, el ternario de la
burbuja (`burbuja-mensaje.tsx:331`) ramifica sobre `contenido`, y `tieneMediaVisual` (`:263`)
**solo cubre IMAGEN y VIDEO**. Un audio con `contenido` poblado caería en la rama del medio y se
renderizaría como un `<p>` pelado, sin reproductor.

---

## `ConfiguracionEmpresa` — campo nuevo

```prisma
  // 049-proveedores-de-voz — apagado por defecto: sin el flag no se transcribe
  // nada y no se llama a ningún proveedor (FR-008, FR-009).
  transcripcionVozHabilitada Boolean @default(false)
```

Sigue la convención del modelo: campo al final, comentado con el número de feature, toggle de
motor apagado por defecto (igual que `workflowsHabilitado`).

---

## Migraciones

Tres pasos, en este orden. Los dos primeros son el prerequisito de R1 y van en su propio commit.

### 1. `..._vincular_media_archivo_mensajes` — solo datos

```sql
-- 049 (prereq R1): el webhook ya produce mediaArchivoId pero los suscriptores
-- lo descartaban. Reconstruye el vínculo del histórico. Idempotente.
UPDATE "MensajeConversacion" m
SET "mediaArchivoId" = ma.id
FROM "Conversacion" c, "MediaArchivo" ma
WHERE c.id = m."conversacionId"
  AND ma."urlOptimizada" = m."mediaUrl"
  AND ma."instanciaId" = c."instanciaId"
  AND m."mediaArchivoId" IS NULL
  AND m."mediaUrl" IS NOT NULL;
```

Verificado contra producción: enlaza los 733 mensajes de audio (100 %) y el resto del media de
conversaciones. No borra ni modifica nada más.

### 2. `..._proveedores_voz_y_transcripcion` — esquema

Crea `ProveedorVozEnum`, `EstadoTranscripcion`, `ProveedorVoz`, `UsoVoz`, las columnas de
`MediaArchivo`, el índice parcial y `ConfiguracionEmpresa.transcripcionVozHabilitada`.

Todo aditivo y con default: no requiere backfill ni ventana de escritura. Los `NOT NULL` nuevos
llevan `DEFAULT`, así que la tabla no se reescribe en PostgreSQL ≥ 11.

### 3. `scripts/049-backfill-transcripciones.ts` — **script, no migración**

Marca `PENDIENTE` los audios históricos. Fuera de la migración a propósito (FR-010): activar el
toggle no debe producir un cargo retroactivo sorpresa.

- Parte de `MensajeConversacion` con `tipo IN ('AUDIO','NOTA_VOZ')`, **nunca de `MediaArchivo`**
  (R0).
- Solo instancias con `transcripcionVozHabilitada = true` y proveedor activo.
- Acepta `--instancia` y `--dry-run`, e informa cuántos audios, cuántos minutos y cuánto costaría
  antes de escribir.
- Referencia: 733 audios ≈ 2,6 h ≈ 0,52 USD. Los 203 videos quedan fuera.

---

## Consultas de verificación

```sql
-- Debe dar 0 SIEMPRE. Es el invariante de FR-011/012 (SC-002).
SELECT COUNT(*) FROM "MediaArchivo" ma
WHERE ma."transcripcionEstado" <> 'NO_APLICA'
  AND NOT EXISTS (
    SELECT 1 FROM "MensajeConversacion" m
    WHERE m."mediaArchivoId" = ma.id AND m.tipo IN ('AUDIO','NOTA_VOZ')
  );

-- Minutos y costo del mes por instancia (lo que muestra la UI de P3).
SELECT "instanciaId",
       ROUND(SUM(segundos)/60.0, 1) AS minutos,
       SUM("costoEstimado")         AS costo
FROM "UsoVoz"
WHERE exito AND "creadoEn" >= date_trunc('month', now())
GROUP BY 1;
```
