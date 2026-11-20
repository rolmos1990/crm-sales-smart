# Research: 048 — Reels, publicaciones e historias de Instagram

Fuentes externas consultadas el 2026-11-20. Las cuatro cargaron sin error:
- **[A]** https://developers.facebook.com/docs/instagram-platform/webhooks/examples
- **[B]** https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- **[C]** https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook
- **[D]** https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks

---

## R0 — Alcance: Reels solo texto, videos directos reproducibles (decisión del usuario, 2026-11-20)

**Decision**:
- **Reels e historias de video**: se identifican con texto. No se descargan, no se guardan y no tienen preview.
- **Publicaciones e historias de foto**: se guarda la imagen.
- **Videos enviados directamente**: prioridad P2, MUST reproducirse bien en todos los navegadores soportados.

**Rationale**: Karia es para dar atención. El vendedor necesita reconocer lo compartido, no consumirlo. El video directo sí es parte de la conversación.

**Alternatives considered**:
- **Miniatura del Reel extrayendo un cuadro con ffmpeg** (`ffmpeg-static`): el resultado es lo más parecido a un preview. Se rechazó por sumar una dependencia nueva de unos 70 MB a la imagen Docker y un proceso por Reel.
- **Guardar el video completo del Reel**: se rechazó porque cuesta entre 5 y 50 MB de storage por Reel sin aporte a la atención.

---

## R1 — Qué tipos de adjunto manda Meta y con qué forma

**Hallazgo (documentado)**:
- `message.attachments[].type` puede ser:
  - `image` (incluye gif y sticker, según [A]).
  - `video`, `audio`, `file`.
  - `share`: share legado de publicación; [A] lo da por deprecado después de feb-2026.
  - `story_mention`.
  - `ig_reel`, `reel`.
  - `ig_post`, `story`, `ig_story` y `media` (solo en [A]).
  - `ephemeral`: sin URL, según [C].
- En todos los ejemplos `payload` solo documenta `url`. No hay `title`, `reel_video_id` ni `ig_post_media_id` documentados.
- Respuesta a historia: `message.reply_to.story = { url: "CDN-URL", id }` [C][D]. El `text` va en el mismo objeto `message` cuando existe.
- Banderas del mensaje: `is_unsupported`, `is_deleted`, `is_echo`, `is_self`.
- La documentación **no** dice si `payload.url` de un Reel, publicación o mención es un archivo o una página.

**Decision**: clasificar por familias, para tolerar sinónimos y tipos nuevos:

| Familia | Tipos | Tratamiento |
|---|---|---|
| Directa | `image`, `video`, `audio`, `file` | **Sin cambios** respecto de hoy |
| Reel | `ig_reel`, `reel` | Solo texto. **La `url` se ignora** y nunca se asigna a `mediaUrl` |
| Publicación | `share`, `ig_post`, `media` | Se intenta guardar **solo si es imagen** |
| Mención en historia | `story_mention`, `story`, `ig_story` | Se intenta guardar **solo si es imagen** |
| Respuesta a historia | `reply_to.story` | Texto del contacto más indicación. Se intenta guardar la imagen de la historia **solo si es imagen** |
| Efímero | `ephemeral` | Solo texto |
| No admitido | cualquier otro, o `is_unsupported: true` | Solo texto genérico |

- `title` se lee de forma oportunista (`payload.title` si es string).

**Pendiente de verificación**: capturar payloads reales (quickstart, escenario 0) y ajustar las familias si aparece otro string.

---

## R2 — Cómo representar "Reel compartido" sin tipos nuevos

**Decision**:
- **No** se agregan valores al enum `TipoMensaje` ni columnas nuevas.
- Para las familias nuevas, `tipo` = `IMAGEN` si se guardó la imagen, o `TEXTO` en cualquier otro caso. Nunca `VIDEO`, por R0.
- Qué se compartió va en `contenido`, como texto descriptivo (contrato en `contracts/texto-descriptivo.md`).

**Rationale**:
- `contenido` ya es la fuente para la IA. `src/ai/contexto/constructor.ts:214` descarta los mensajes sin `contenido`, y por eso hoy la IA no ve estos mensajes.
- También alimenta la búsqueda, la vista previa de la lista y los Workflows, sin tocar ningún consumidor.

**Alternatives considered**:
- Valores nuevos `REEL`, `PUBLICACION` y `HISTORIA` en el enum: impacto transversal y migración de enum, injustificados para un hotfix.
- Columna JSON de metadatos: modelo nuevo para un dato que solo se muestra.

---

## R3 — Burbuja: mostrar imagen y texto a la vez

**Hallazgo**:
- `burbuja-mensaje.tsx:256` renderiza `contenido` **o** la media, nunca las dos.
- WhatsApp no guarda caption para media (`encolar-mensaje.ts:34-37`).
- El envío manual (`envio.ts`) sí admite `contenido` + `mediaUrl`. Hoy, en un saliente con imagen y texto, la imagen no se ve.

**Decision**: cuando el mensaje es `IMAGEN` o `VIDEO` y tiene media (`mediaArchivoId` o `mediaUrl`), renderizar la media y debajo el `contenido`. El resto queda igual.

**Rationale**: es el cambio mínimo para que se vean juntas la imagen de una publicación y su etiqueta. El efecto sobre los salientes con imagen y texto corrige algo que hoy está mal y queda anotado como cambio consciente en el plan.

**Alternatives considered**: limitarlo a `remitente === "CONTACTO"`. Se descartó porque deja a los ecos de la app nativa (020) con el mismo problema.

---

## R4 — Reproducción de video que "se vea bien" (US2, FR-007)

**Hallazgo**:
- No existe ningún `<video>` en `src/conversaciones`.
- `src/app/cdn/[...key]/route.ts` (proxy usado cuando el bucket no tiene dominio propio) siempre responde `200` con el archivo completo y **no admite `Range`**. Sin respuestas `206`:
  - Safari/iOS no reproduce `<video>`.
  - Ningún navegador permite adelantar sin bajar todo.
- Los videos de Instagram y WhatsApp llegan como MP4. Los de otros orígenes pueden ser `video/quicktime` (`.mov`), que Chrome y Firefox no siempre reproducen.

**Decision**: componente `BurbujaVideo` en `burbuja-mensaje.tsx`.

| Requisito | Cómo |
|---|---|
| (a) Vista previa con un cuadro | `preload="metadata"` + fragmento `#t=0.1` en el `src`. Sin el fragmento, Safari/iOS no pinta el primer cuadro si no hay `poster` |
| (b) Controles y pantalla completa | `controls` nativos, que ya incluyen pausa, barra de tiempo y pantalla completa |
| (c) Proporción | Contenedor con ancho máximo (~280 px) y alto máximo (~360 px) más `object-contain`: un vertical no desborda y un horizontal no se deforma. Fondo neutro con token semántico |
| (d) Navegadores e iOS | `playsInline`, para que iOS no fuerce pantalla completa al reproducir, más el soporte de `Range` del proxy |
| (e) Adelantar sin bajar todo | Soporte de `Range` en `/cdn`: respuesta `206`, `Accept-Ranges: bytes` y `Content-Range`. Si el bucket tiene dominio propio, S3 ya lo soporta |
| (f) Formato no reproducible | `onError` en el `<video>`: se reemplaza por el aviso "Este navegador no puede reproducir el video" y un botón de descarga (URL propia de Karia) |
| Sin archivo | "Video no disponible", sin reproductor |

- `src` = `mediaUrlOptimizada ?? mediaUrl`, ambas propias de Karia.
- Se descartó `poster` generado en el servidor porque requeriría ffmpeg (R0).

**Alternatives considered**:
- Reproductor de terceros (video.js, plyr): dependencia nueva sin necesidad, porque los controles nativos cubren (b).
- Redirigir a una URL firmada del bucket: expondría el host del bucket, que el proxy existe para ocultar.
- Streaming parcial desde S3 con `GetObject` + `Range`: es mejor en memoria, pero cambia el contrato `StorageProvider.download`. Como v1 se recorta el buffer ya descargado y el streaming queda como mejora futura.

---

## R5 — Garantía "nunca una URL de Meta" (FR-001)

**Decision**: invariante en un único punto, el webhook, antes de publicar en la cola. Aplica a `PROCESAR_ENTRANTE` y a `PROCESAR_MENSAJE_APP_NATIVA`, y a ambos canales.
- Si el normalizado trae `mediaUrl`, se intenta conservar sin filtrar por `tipo` (desaparece `tipo !== "TEXTO"` de `route.ts:377`).
- Si no se conserva, `mediaUrl = undefined`. Además:
  - En las familias nuevas, `tipo` pasa a `TEXTO` y `contenido` lleva el texto de "no se pudo guardar".
  - En la familia directa se mantiene el comportamiento actual: tipo original, sin media.
- La decisión es una función pura (`reubicacion.ts`), testeada sin red.

**Defensa en profundidad**: `mapearEntrante` de Instagram y de Messenger **no** asigna `mediaUrl` a Reels, efímeros ni no admitidos. Para esas familias no existe una URL que pueda filtrarse.

**Alternatives considered**: validar contra una lista de dominios de Meta en `procesarMensajeEntrante`. Se descartó por frágil y tardío: la URL ya habría viajado por RabbitMQ.

---

## R6 — Descarga dentro del webhook (FR-008, FR-010)

**Hallazgo**:
- [A]–[D] no documentan el timeout ni los reintentos de entrega.
- La idempotencia por `mid` ya existe en dos barreras (`route.ts:366-369` y `actions.ts:491-496`).

**Decision**:
- **Familia directa (imagen, video, audio y archivo): descarga sin cambios.** No se agregan timeout ni límites nuevos, para no alterar lo que ya funciona (FR-010).
- **Publicaciones e historias**:
  - Antes de leer el cuerpo, se inspecciona el `Content-Type` de la respuesta.
  - Si no es `image/*` (por ejemplo, una historia de video o una página HTML), se aborta la descarga sin bajar el cuerpo y se cae en "solo texto" (R0).
  - Tope de 15 s con `AbortSignal.timeout`.
- **Reels**: no hay descarga.
- Un fallo no corta el resto del lote: el `try/catch` es por evento.

**Rationale**: con Reels fuera del storage, desaparece el caso de "archivo pesado nuevo". Lo único nuevo que se descarga son imágenes.

---

## R7 — Limpieza del histórico (FR-009)

**Decision**: migración Prisma de solo datos (sin cambio de esquema), idempotente:

```sql
UPDATE "MensajeConversacion" m
SET "mediaUrl" = NULL,
    "contenido" = COALESCE(m."contenido", 'Contenido compartido que ya no está disponible')
FROM "Conversacion" c JOIN "CuentaCanal" cc ON cc.id = c."cuentaCanalId"
WHERE m."conversacionId" = c.id
  AND cc.canal IN ('instagram', 'facebook_messenger')
  AND m."mediaArchivoId" IS NULL
  AND m."mediaUrl" ~* '^https?://([a-z0-9-]+\.)*(fbcdn\.net|cdninstagram\.com|fbsbx\.com|facebook\.com|instagram\.com)(:[0-9]+)?(/|\?|$)';
```

Al implementarla, el patrón final también acepta un puerto opcional y un host seguido directamente de `?` o del fin de la URL. El resto de la condición no cambió.

- Las condiciones `mediaArchivoId IS NULL` y el patrón de host aseguran que nunca se toca una URL propia.
- `tipo` no cambia: estos mensajes ya son `TEXTO`.

**Alternatives considered**: script one-off fuera de migraciones. Se descartó porque la constitución pide cambios de datos versionados.
