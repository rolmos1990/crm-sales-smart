# Proveedores de Voz y transcripción de notas de voz (049)

Convierte las notas de voz de las conversaciones en texto, para que el agente humano las lea
sin escucharlas y para que el agente de IA entienda lo que dijo el cliente.

Spec completa: `specs/049-proveedores-de-voz/`.

---

## Lo que hay que saber antes de tocar `src/voz/`

### 1. El mime NO sirve para decidir qué se transcribe

Es la regla que define la feature y la que más fácil se rompe.

En Instagram una nota de voz y un video llegan **con el mismo mime, `video/mp4`**. Medido en
producción, cuenta DecostoreKt:

| `mimeOriginal` | `tipo` del mensaje | filas | peso medio |
|---|---|---:|---:|
| `video/mp4` | `AUDIO` | 727 | 0,10 MB |
| `video/mp4` | **`VIDEO`** | **203** | 0,71 MB |
| `audio/ogg; codecs=opus` | `NOTA_VOZ` | 6 | 0,03 MB |

El webhook guarda el adjunto con el `Content-Type` que entrega el CDN de Meta, sin reprocesar
(`src/app/api/webhooks/instagram/route.ts`). El único dato que distingue una cosa de la otra es
`MensajeConversacion.tipo`, que asigna el provider al mapear el adjunto
(`src/conversaciones/providers/instagram.ts`).

**Y ElevenLabs acepta MP4 de video sin devolver error**: lo transcribe y lo factura. Un filtro
por mime no falla — transcribe los 203 videos, que además pesan 7× más por archivo, y nadie se
entera hasta ver la factura.

Por eso hay **tres cortes independientes**, no uno:

| # | Dónde | Qué hace |
|---|---|---|
| 1 | `marcarPendiente` (`src/voz/cola.ts`) | El `EXISTS` del SQL exige un mensaje `AUDIO`/`NOTA_VOZ`. |
| 2 | `transcribirMediaArchivo` (`src/voz/transcribir.ts`) | Revalida contra la base **antes de llamar al proveedor**. Si no corresponde, pasa a `NO_APLICA` y no llama. |
| 3 | `scripts/049-backfill-transcripciones.ts` | Parte de `MensajeConversacion` filtrando por `tipo`, nunca de `MediaArchivo`. |

El corte 2 parece redundante y no lo es: protege de una fila marcada por una versión anterior
del código, por un backfill mal invocado o por una escritura manual.

**`src/voz/transcribir.alcance.test.ts` no se borra.** Es el único test que detecta que se
están transcribiendo videos, porque el proveedor no se queja. Hay una consulta de invariante en
el quickstart que debe dar 0 siempre.

### 2. La transcripción vive en `MediaArchivo`, no en el mensaje

`MediaArchivo` ya es una fila por archivo y ya deduplica por hash
(`@@unique([instanciaId, hash])`), así que un audio reenviado se transcribe y se cobra **una
sola vez**, gratis.

Moverla a `MensajeConversacion` rompería eso **y** la UI: el ternario de
`burbuja-mensaje.tsx` manda a `<p>` cualquier mensaje con `contenido`, y `tieneMediaVisual`
solo cubre IMAGEN y VIDEO — el reproductor de audio desaparecería.

Esa misma fila **es la cola**: índice parcial `WHERE transcripcionEstado = 'PENDIENTE'`, reclamo
con `FOR UPDATE SKIP LOCKED` y lease, backoff `30s × 2^intentos` con tope 30 min y jitter. No
hay tabla de cola aparte.

### 3. `INAUDIBLE` es terminal y **no** se reintenta

Cuando el proveedor no extrae habla (silencio, ruido, música) se guarda el literal
`"Inaudible"` con estado `INAUDIBLE`. Es un resultado válido, no un error.

Tratarlo como fallo lo mete en el backoff y gasta **cinco llamadas pagas para obtener cinco
veces el mismo silencio**. Es el error más fácil de cometer al refactorizar; hay un test
dedicado.

La decisión `LISTO` contra `INAUDIBLE` vive en `src/voz/transcribir.ts` y es **igual para todos
los proveedores**. Un adaptador nunca la toma: si cada uno la resolviera a su manera, cambiar de
proveedor cambiaría el comportamiento del producto.

### 4. El enganche: inline para entrantes, barrido para el resto

- **Entrantes del contacto**: dentro de `procesarMensajeEntrante`, **después** del INSERT y
  **antes** de publicar `MensajeRecibido`, con timeout duro. Es el único punto que garantiza que
  la IA y los Workflows vean el texto: los dos cuelgan de ese evento y ganarían la carrera a
  cualquier transcripción asíncrona.
- **Salientes `AGENTE_CANAL_NATIVO`**: solo se encola. Nadie espera ese texto.
- Vencido el timeout o ante un fallo: **se publica igual**. La fila queda en la cola y la
  termina el barrido. **Nunca se retiene una respuesta de la IA esperando a un tercero.**

### 5. `ProveedorVoz` es un modelo aparte de `ProveedorIA`, a propósito

El consumo se mide en **segundos de audio**, no en tokens. `calcularCosto` y `UsoIA` son por
token, y meter segundos ahí contaminaría `obtenerResumenUsoIA` y el control de presupuesto de
042, que suman `tokensInput + tokensOutput` sin discriminar tarea.

Dos defectos del patrón de IA que **no** se replicaron:

- `ProveedorIA.baseUrl` se persiste y se edita en la UI pero **nunca llega al adaptador**. Acá la
  fábrica es `(apiKey, modelo?, baseUrl?)` y sí llega.
- `IProveedorIA.estaDisponible()` existe y nadie lo llama. Acá está cableado a
  "Probar credenciales" desde el día uno.

---

## Texto efectivo de un mensaje

`src/ai/contexto/texto-mensaje.ts` es la **única** definición de qué texto lee la IA de un
mensaje, compartida por el contexto del agente, el gate de autonomía y los Workflows. Si cada
uno lo resolviera por su cuenta, una nota de voz podría estar en el prompt y no en la condición
de un Workflow, y nadie lo notaría hasta ver una respuesta absurda.

- Con transcripción: entra como `[nota de voz] <texto>`. El prefijo importa — el agente tiene
  que saber que el cliente **habló**.
- Sin transcripción: entra como `[nota de voz no transcrita]`, **no se descarta**. Si
  desapareciera, el agente respondería en el vacío: el comportamiento exacto que esta feature
  corrige.

En el análisis comercial de contactos (042) se usa solo `LISTO`, no `INAUDIBLE`: "Inaudible" le
dice algo al agente humano, pero al análisis solo le mete ruido en el prompt.

---

## Operación

| Variable | Default | Para qué |
|---|---|---|
| `VOZ_TIMEOUT_MS` | 12000 | Techo de la transcripción en línea. Vencido, el mensaje sigue. |
| `VOZ_LEASE_MS` | 180000 | Lease del reclamo. **Debe ser mayor que el timeout** o dos procesos tomarían el mismo audio. |
| `VOZ_BARRIDO_INTERVALO_MS` | 60000 | Cada cuánto barre el worker. |
| `VOZ_LOTE` | 5 | Audios por vuelta. |
| `VOZ_MAX_BYTES` | 26214400 | Tope por archivo (~50 min de audio al bitrate observado). |

Lo que es **de cada cuenta** —credencial, proveedor, tope diario de minutos, el interruptor—
vive en `ProveedorVoz` y en `ConfiguracionEmpresa.transcripcionVozHabilitada`, no en el entorno.

El toggle está **apagado por defecto** y no se puede encender sin un proveedor activo con
credencial: si se pudiera, diría que la transcripción está activa y ningún audio se
transcribiría.

**Activar el toggle no transcribe lo viejo.** Eso es `scripts/049-backfill-transcripciones.ts`,
que por defecto simula y exige `--aplicar` para escribir. Referencia medida: 733 audios ≈ 2,6 h
≈ 0,52 USD.

---

## Canales

| Canal | Notas de voz | Estado |
|---|---|---|
| WhatsApp Lite | `NOTA_VOZ` / `AUDIO`, con `mediaDuracion` del propio canal | cubierto |
| Instagram | `AUDIO`, mime `video/mp4`, **sin** `mediaDuracion` | cubierto (la duración la rellena el proveedor) |
| Facebook Messenger | el audio cae en `NO_ADMITIDO` y queda como `TEXTO` descriptivo | **fuera de alcance** — ver abajo |
| Correo | un adjunto de audio entra como `DOCUMENTO` | fuera de alcance |

**Messenger**: 048 dejó `src/conversaciones/providers/facebook-messenger.ts` con solo `image` y
`video` como media directa; todo lo demás —audio incluido— cae en `familiaAdjunto =
"NO_ADMITIDO"` y deliberadamente **sin `mediaUrl`**, para que ninguna URL de Meta llegue a la
base (FR-001/FR-011 de 048). Habilitar voz ahí no es añadir un `case`: exige sumar `"audio"` a
la media directa **y** a la reubicación del webhook, respetando esa regla.
