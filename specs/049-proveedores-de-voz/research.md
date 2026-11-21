# Research: Proveedores de Voz y transcripción de notas de voz (049)

Fecha: 2026-11-20. Base: `main` @ `cdfdd05` (incluye `048-fix-instagram-reels-media`).

Todas las decisiones están verificadas contra el código y, donde se indica, contra la base de
datos de producción.

---

## R0 — Alcance: solo AUDIO y NOTA_VOZ, y por qué el mime no sirve

**Decisión**: el único criterio para transcribir es `MensajeConversacion.tipo IN ('AUDIO','NOTA_VOZ')`.
Nunca el mime del archivo, nunca el `MediaArchivo` por sí solo.

**Rationale**: medido contra la base, en la cuenta de mayor volumen:

| `mimeOriginal` | tipo del mensaje | filas | peso total | peso medio |
|---|---|---:|---:|---:|
| `video/mp4` | `AUDIO` | 727 | 70,9 MB | 0,10 MB |
| `video/mp4` | `VIDEO` | 203 | 144,1 MB | 0,71 MB |
| `audio/ogg; codecs=opus` | `NOTA_VOZ` | 6 | 0,2 MB | 0,03 MB |

Las notas de voz de Instagram llegan en un contenedor MP4 (`src/app/api/webhooks/instagram/route.ts:182`
guarda el adjunto "tal cual, sin reprocesar", con el `Content-Type` que devuelve el CDN de Meta).
El resultado es que **727 notas de voz y 203 videos comparten exactamente el mismo mime**.

Scribe acepta `MP4` como formato de entrada y devuelve 200 con una transcripción. Es decir: un
filtro por mime **no fallaría** — transcribiría los 203 videos, los cobraría y nadie se
enteraría. Son además 7× más pesados por archivo, así que el sobrecosto no sería marginal.

Quien distingue es el provider al mapear el adjunto: `src/conversaciones/providers/instagram.ts:290`
(`case "audio": tipo = "AUDIO"`). Ese dato vive en el mensaje, no en el archivo.

**Alternativas rechazadas**:
- *Filtrar por `mimeOriginal LIKE 'audio/%'`*: deja fuera las 727 notas de voz de Instagram, que
  son el 99 % del volumen. Falla por omisión.
- *Filtrar por `mimeOriginal` audio **o** video*: incluye los 203 videos. Falla por exceso, en
  silencio.
- *Inspeccionar el contenedor para ver si trae pista de video*: funcionaría, pero exige leer y
  parsear cada archivo antes de decidir, y agrega una dependencia de parseo de MP4 para resolver
  algo que el mensaje ya sabe.

**Consecuencia de diseño**: tres cortes independientes (FR-011/012/013), no uno solo. Ver
`contracts/alcance-transcripcion.md`.

---

## R1 — Dependencia bloqueante: el vínculo mensaje ↔ archivo no se persiste

**Decisión**: arreglarlo **antes** de la feature, en su propio commit, con backfill del histórico.

**Rationale**: `ComandoProcesarEntrantePayload` declara `mediaArchivoId`
(`src/eventos/contratos/procesar-entrante.comando.ts:17`) y el webhook lo produce correctamente
(`src/app/api/webhooks/instagram/reubicacion.ts:39`). Pero los dos suscriptores que reconstruyen
el payload **copian campo por campo y lo omiten**:

```
$ grep -c mediaArchivoId src/suscriptores/mensajes/procesar-entrante.suscriptor.ts
0
$ grep -c mediaArchivoId src/suscriptores/mensajes/procesar-mensaje-app-nativa.suscriptor.ts
0
```

Verificado en la base: **los 733 mensajes de audio tienen `mediaArchivoId` NULL**. Como FR-016
exige que la transcripción viva en el archivo, sin este vínculo la feature no es implementable.

Ironía útil: el propio `procesar-entrante.suscriptor.ts` tiene un comentario que advierte
"este suscriptor copia campo por campo" — puesto en 035 por la misma clase de omisión.

**El backfill es completo y sin pérdida.** Verificado: el 100 % de los 733 audios es enlazable
por `mediaUrl = MediaArchivo.urlOptimizada` dentro de la misma instancia.

**Alternativas rechazadas**:
- *Colgar la transcripción de `MensajeConversacion`*: evita el arreglo, pero rompe la
  deduplicación (FR-016 y SC-007: un audio reenviado se transcribiría y cobraría dos veces) y
  deja el bug intacto para el resto del producto.
- *Resolver por `mediaUrl` en cada lectura*: funciona pero es un join por URL en el camino
  caliente, y perpetúa un FK roto que ya existe en el esquema.

---

## R2 — `MediaArchivo` es la cola; no se crea tabla nueva

**Decisión**: el estado de transcripción vive en columnas de `MediaArchivo`, con índice parcial
`WHERE "transcripcionEstado" = 'PENDIENTE'` y reclamo con `FOR UPDATE SKIP LOCKED`.

**Rationale**:
- Ya es **una fila por archivo** y ya deduplica por `@@unique([instanciaId, hash])`
  (`media-raw.service.ts:116`). Eso entrega FR-016 y SC-007 gratis: el mismo audio reenviado
  tiene una sola fila, luego una sola transcripción y un solo cargo.
- Ya existe el precedente de un campo de estado de procesamiento en esa tabla (`estadoProcesado`,
  enum `EstadoMedia`).
- La mecánica de lease/backoff se copia de `src/crm/contactos/analisis/cola.ts`, que es el patrón
  establecido del repo (`SKIP LOCKED`, lease con vencimiento, backoff `30s × 2^intentos` con tope
  30 min y jitter, `MAX_INTENTOS`). Los índices parciales se declaran en el SQL de la migración,
  no en el DSL de Prisma — misma convención que `ContactoAnalisisCola`.

**Alternativas rechazadas**:
- *Tabla `TranscripcionCola` dedicada*: es el patrón de 042, pero ahí hacía falta porque la
  unidad de trabajo (el contacto) no tenía dónde guardar estado de cola y necesitaba prioridades,
  stride scheduling por cuenta y versión monótona. Acá la unidad de trabajo **es** una fila que
  ya existe, el trabajo se hace una sola vez por fila y no hay prioridades. Una tabla aparte
  sería un join permanente y un segundo sitio donde desincronizarse.
- *Cola en RabbitMQ sin estado en base*: no sobrevive a reinicios con reintentos de espera
  creciente, y no permite responder "¿en qué estado está esta transcripción?" al pintar la
  burbuja.

**Costo del atajo**: `MediaArchivo` guarda también imágenes y documentos, que nunca se
transcriben. Por eso el default es `NO_APLICA` y el índice es parcial: las filas que no son
audio no entran al índice ni pesan en la consulta de la cola.

---

## R3 — `ProveedorVoz` separado de `ProveedorIA`

**Decisión**: modelo, registro de adaptadores y auditoría de uso propios.

**Rationale**: la unidad de facturación es incompatible.
`calcularCosto(tokensInput, tokensOutput, costoInputPorMil, costoOutputPorMil)`
(`src/ai/auditoria/logger.ts`) es por token, y `UsoIA` modela `tokensInput`/`tokensOutput`/
`tokensCacheados`. STT se cobra por **tiempo de audio**. Meter segundos en columnas de tokens
contaminaría `obtenerResumenUsoIA` (`src/configuracion/ia/queries.ts:97`) y el control de
presupuesto de 042 (`motor/presupuesto.ts`), que suman `tokensInput + tokensOutput` sin
discriminar tarea.

Es además lo que pidió el usuario explícitamente: "otra configuración para esto".

**Qué sí se reutiliza del patrón de IA**: `cifrarToken`/`descifrarToken`
(`src/shared/lib/cifrado-tokens.ts`, AES-256-GCM, prefijo `enc:v1:`), el par
`alias`/`aliasNormalizado` con `@@unique([instanciaId, aliasNormalizado])` de la feature 021, el
registro de adaptadores (`src/ai/proveedores/registro.ts`), el archivo `disponibles.ts` sin
dependencias de servidor para que lo importen a la vez la Server Action y el formulario cliente,
y el preámbulo `requireSesion()` → `verificarAcceso()` → Zod → `revalidatePath()`.

**Dos defectos conocidos del patrón de IA que NO se replican**:

1. `ProveedorIA.baseUrl` se persiste y se edita en la UI pero **nunca llega al adaptador**: la
   firma de la fábrica es `(apiKey, modelo?)` y cada proveedor hardcodea su `baseURL`
   (`src/ai/proveedores/deepseek.ts:47`). La fábrica de voz es `(apiKey, modelo?, baseUrl?)`.
2. `IProveedorIA.estaDisponible()` existe, lo implementan los cuatro adaptadores y **nadie lo
   llama**. Acá se cablea desde el día uno a la acción "probar credenciales" (FR-005), con el
   modelo de `probarConexionBuzon` (`src/integraciones/email/actions.ts:82`).

También se omite a propósito un `proveedorVozDefault`: el equivalente en IA
(`ConfiguracionIA.proveedorDefault`) quedó muerto porque la selección real va por `prioridad`.

---

## R4 — Transcripción síncrona contra ElevenLabs, no por webhook

**Decisión**: `POST https://api.elevenlabs.io/v1/speech-to-text` en modo síncrono, con
`model_id: "scribe_v3"`, header `xi-api-key`, cuerpo `multipart/form-data` con el campo `file`.
Sin `webhook: true`.

**Rationale**: el perfil real de los audios lo permite y lo recomienda. Medido sobre los 730
audios existentes (leyendo el átomo `mvhd` de cada archivo):

- promedio **12,8 s**, mediana **10,1 s**, p90 **26,1 s**, máximo **66,3 s**.

Con audios de un minuto como techo, la respuesta síncrona llega en pocos segundos. El modo
webhook exigiría exponer un endpoint público nuevo, autenticar su firma, correlacionar por
`webhook_metadata` y manejar entregas duplicadas y fuera de orden — todo el costo de
`Principio III` para un beneficio nulo a esta escala.

**Alternativas rechazadas**:
- *`webhook: true` (202 + callback)*: reconsiderar solo si aparecen audios de muchos minutos.
  El diseño no se cierra: el estado `PROCESANDO` en la fila ya es el lugar donde un callback
  encajaría.
- *`source_url` en vez de subir el archivo*: obliga a que el `/cdn/...` sea alcanzable
  públicamente desde ElevenLabs. Hoy ese proxy sirve el objeto desde el bucket sin
  autenticación, así que exponerlo a un tercero amplía la superficie sin necesidad. Se envía el
  buffer leído con `getStorageProvider().download(key)`.

**Detalle de implementación**: Node 20 trae `fetch`, `FormData` y `Blob` globales, así que el
multipart no necesita dependencia nueva (Constitución, Technical Constraints).

---

## R5 — Enganche: inline en el worker para entrantes, barrido para el resto

**Decisión**:
- Entrantes del contacto: dentro de `procesarMensajeEntrante` (`src/conversaciones/actions.ts`),
  **después del INSERT del mensaje y antes de publicar `MensajeRecibido`**, con timeout duro.
- Salientes `AGENTE_CANAL_NATIVO` (`registrarMensajeAppNativa`): solo se marca `PENDIENTE`.
- Todo lo que falle o venza el timeout: lo termina el barrido periódico del worker.

**Rationale**: el consumidor crítico del texto es el agente de IA, y hoy el audio desaparece de
su contexto en `src/ai/contexto/constructor.ts:214`. La cadena es:

```
procesarMensajeEntrante → publicar(MensajeRecibido)
   → cola crm.ai.orquestar → OrquestarIASuscriptor
   → publicar(GENERAR_RESPUESTA_IA) → cola crm.ai.comando.respuesta
   → GenerarRespuestaIASuscriptor → construirContexto()
```

`procesarMensajeEntrante` ya corre en el worker, así que transcribir ahí **no bloquea** ni el
webhook de Meta ni el socket de Baileys — ambos ya publicaron su comando y respondieron. Es el
único punto que garantiza que la IA **y** los Workflows vean el texto, porque los dos cuelgan de
`MensajeRecibido`.

El timeout es la salvaguarda de FR-028 y SC-005: vencido, se publica igual y el mensaje llega a
la IA con el marcador de "nota de voz no transcrita". **Nunca se retiene una respuesta esperando
a un tercero.**

Para los salientes nadie espera el texto: no se publica `MensajeRecibido` (se publica
`MensajeEnviado`) y no disparan IA. Transcribirlos inline solo agregaría latencia sin lector.

**Alternativas rechazadas**:
- *Comando asíncrono `TRANSCRIBIR_AUDIO` para todo*: la transcripción competiría con
  `OrquestarIASuscriptor`, que escucha el mismo `evento.mensaje.recibido` en otra cola. La IA
  ganaría la carrera casi siempre y respondería sin el texto — se entregaría la feature sin su
  mitad más valiosa.
- *Suscriptor que transcribe y re-publica `MensajeRecibido`*: duplica el evento y obliga a hacer
  idempotente todo lo que cuelga de él.
- *Apoyarse en la ventana de espera ya existente* (`esperarAntesDeResponder` /
  `segundosEsperaRespuesta` de `ConfiguracionIA`): es opcional y está apagada por defecto, así
  que no se puede depender de ella.

---

## R6 — "Inaudible" es un estado terminal

**Decisión**: se marca `INAUDIBLE` y se guarda el literal `"Inaudible"` cuando se cumple
cualquiera de:

1. `text` vacío tras `trim()`.
2. Todos los elementos de `words` tienen `type` distinto de `word` (solo `audio_event` o
   `spacing`): el audio tenía ruido, música o silencio, no habla.
3. `language_probability < 0.5`.

No se reintenta.

**Rationale**: lo pidió el usuario literalmente. Reintentar silencio cuesta dinero y devuelve
silencio; tratarlo como error lo metería en el backoff y lo llevaría hasta `ERROR` tras cinco
intentos pagos. Distinguirlo de un fallo también importa en la UI (FR-024): "Inaudible" es
información para el agente, un fallo de infraestructura no.

El umbral de 0,5 es una suposición razonable, no un valor medido — queda registrado como tal en
el spec y es un parámetro, no una constante enterrada.

---

## R7 — Costo: por hora, calculado solo si hay tarifa

**Decisión**: `costoEstimado = (segundos / 3600) × ProveedorVoz.costoPorHora`. Si
`costoPorHora` es `null`, el costo queda `null`.

**Rationale**: mismo criterio que el resto del producto — `calcularCosto` devuelve `undefined`
sin tarifas, y el comentario de `src/ai/documentacion/cliente-openai.ts:39-42` lo justifica: "un
costo inventado contamina todos los agregados". La tarifa vigente de referencia es 0,20 USD/hora,
pero se captura como dato de configuración, no como constante: el precio de un tercero cambia.

Verificación de magnitud (SC-009): 730 audios = 2,59 h = **0,52 USD**. El histórico completo de
la cuenta más activa cuesta menos que un café.

---

## R8 — Tope de tamaño y de duración

**Decisión**: no se intenta transcribir un archivo por encima de 25 MB.

**Rationale**: `guardarArchivoRaw` ya rechaza por encima de 50 MB (`media-raw.service.ts:7`), así
que ese es el techo de lo que puede existir. Al bitrate observado de estos audios (~65 kbps,
unos 8 kB/s), 25 MB son más de 50 minutos — tres órdenes de magnitud por encima del máximo real
de 66 s. El tope existe para que un envío atípico no genere un cargo desproporcionado, no para
recortar casos legítimos.

`limiteMinutosDia` por proveedor (FR y P3) es el control fino; el tope por archivo es el grueso.

---

## R9 — Idioma: se detecta y se guarda, no se traduce

**Decisión**: no se envía `language_code`; se deja que Scribe autodetecte y se guarda el
`language_code` devuelto junto al texto.

**Rationale**: decisión explícita del usuario ("solo transcripción"). Forzar el idioma del
comercio degradaría la transcripción de un cliente que escribe en otro idioma, que es
justamente el caso donde el agente humano más necesita leer el texto.

---

## R10 — Duración real: efecto colateral que vale la pena

**Decisión**: guardar `transcripcionSegundos` con la duración que informa el proveedor, y en P3
usarla para rellenar `MensajeConversacion.mediaDuracion` cuando esté en NULL.

**Rationale**: `mediaDuracion` solo lo escribe el camino de WhatsApp Lite, desde el campo
`seconds` de Baileys (`src/integraciones/whatsapp-lite/descargar-media-wa.ts:63`). Meta no lo
envía en el webhook de mensajería, así que **los 727 audios de Instagram tienen `mediaDuracion`
NULL** y la burbuja no muestra la duración. La transcripción obliga a procesar el archivo de
todos modos; el dato viene de regreso sin costo adicional.

---

## Riesgos abiertos

| Riesgo | Señal temprana | Respuesta |
|---|---|---|
| Scribe tarda más de lo esperado en audios largos | p95 del tiempo de transcripción sube | Bajar el timeout inline; el barrido ya cubre el resto |
| ElevenLabs cambia `scribe_v3` o su contrato | Fallos de validación de la respuesta | El modelo es configuración, no constante; el adaptador valida y degrada |
| Un canal nuevo entrega audio con otro `tipo` | Audios sin transcribir | El corte está en un solo punto por canal; se audita con una consulta |
| El umbral de 0,5 de confianza marca Inaudible de más | Tasa de `INAUDIBLE` anómala | Es parámetro; se ajusta sin migración |
