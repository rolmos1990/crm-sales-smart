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

### 6. Adaptadores disponibles (050 agrega Groq)

| Servicio | Modelos sugeridos | Host por defecto |
|---|---|---|
| `ELEVENLABS` | `scribe_v3`, `scribe_v2` | `https://api.elevenlabs.io` |
| `OPENAI` | `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `whisper-1` | `https://api.openai.com` |
| `GROQ` | `whisper-large-v3-turbo`, `whisper-large-v3` | `https://api.groq.com/openai` |

`LOCAL` figura en el enum de Prisma y **no** está implementado: `PROVEEDORES_VOZ_IMPLEMENTADOS`
es la lista real y `inicializar.test.ts` la mantiene pegada al registro. Elegir uno sin adaptador
se guardaría sin una queja y después fallaría en el log del servidor, con el comercio creyendo
que la transcripción está activa.

**OpenAI y Groq comparten el transporte** (`openai-compatible.ts`): Groq expone la API de
transcripción de OpenAI tal cual, así que el multipart, el doble corte por `AbortSignal` y el
conteo de palabras son uno solo. Lo que **no** se comparte, y no conviene colapsar, es la
traducción de errores: OpenAI manda la falta de saldo por **400** y Groq usa **429** solo para
cuota. Unificarlas haría que un fallo permanente de uno se reintentara cinco veces en el otro.
ElevenLabs tiene su propio archivo entero — otra forma de petición y de respuesta.

Tres cosas de Groq que no se deducen leyendo el código:

- **Factura un mínimo de 10 segundos por petición.** Como la mayoría de las notas de voz son más
  cortas, el gasto real supera al estimado. `UsoVoz.segundos` sigue guardando la duración **real**
  que devuelve el proveedor, no la facturable: inflarla a 10 falsearía cuánto audio se transcribió,
  que es lo que el campo significa. El ajuste va en `costoPorHora`.
- **`distil-whisper-large-v3-en` no está entre los sugeridos**: solo entiende inglés, y como Karia
  nunca fuerza el idioma, traduciría el español sin que nada lo señale.
- **El host incluye el segmento `/openai`.** Sin él, cada audio recibe un 404. Hay un test que fija
  la URL completa.

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

## Consumo por proveedor (050)

La pestaña de Voz muestra el total de la cuenta en dos tarjetas **y** el consumo del mes en cada
fila de proveedor. Todo eso sale de `src/configuracion/voz/`, y cuatro cosas de ahí no son
obvias:

**El dato ya estaba; 050 no agregó esquema.** `UsoVoz.proveedorVozId` existe desde 049 y
`transcribir.ts` lo escribe en los dos llamados —el del fallo y el del éxito—. El desglose es un
cambio de lectura: ni migración, ni backfill, ni índice nuevo. `@@index([instanciaId, creadoEn])`
cubre el `where` y el agrupado corre sobre ese subconjunto ya filtrado (verificado con
`EXPLAIN ANALYZE`: `Index Scan using "UsoVoz_instanciaId_creadoEn_idx"`).

**El total del mes se DERIVA del `groupBy`, no de una consulta aparte.** `SUM(x)` sobre todas las
filas es la suma de los `SUM(x)` por grupo, así que "las filas suman la tarjeta" es aritmética y
no convención. Volver a partirlo en dos consultas deja esa igualdad a merced de que nadie toque
un `where`, y el síntoma sería una pantalla de costos que no cuadra —que se lee como rota aunque
el total sea correcto—.

**El redondeo se reparte, no se aplica por fila** (`reparto.ts`). Tres proveedores con 12,34 min
redondeados por separado dan 36,9 contra un total de 37,0; con 2–4 proveedores eso pasa buena
parte de las veces. El reparto recibe el total **ya calculado por la tarjeta** como objetivo: con
minutos salidos de segundos enteros los límites de redondeo se tocan cada 3 segundos, y derivar
el objetivo de la suma de los valores deja esos casos a merced del punto flotante.

**`_sum` ignora los NULL, y eso miente.** Un proveedor al que le cargaron la tarifa a mitad de mes
devuelve un monto que parece completo y cubre solo unos días. Se detecta comparando
`_count.costoEstimado` con `_count._all` en el mismo `groupBy` — de ahí
`costoCobertura: COMPLETO | PARCIAL | NO_ESTIMABLE`. Sin tarifa el costo es `null`, **nunca `0`**:
un cero se lee como "este servicio sale gratis".

**Proveedor eliminado**: `onDelete: SetNull` deja el histórico con `proveedorVozId` en NULL a
propósito —borrar un proveedor no puede borrar el gasto ya facturado—, y ese grupo se muestra
agrupado al final de la lista. Es el **único** origen válido de ese NULL: si algún día se agrega
un camino de escritura que deje el id vacío, esa fila empieza a mentir y no hay error que lo
delate. No se guarda un snapshot del alias porque no arreglaría las filas que ya lo perdieron,
que son justamente las del comercio que ya eliminó un proveedor.

Detalle: `specs/050-consumo-voz-por-proveedor/`.

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
