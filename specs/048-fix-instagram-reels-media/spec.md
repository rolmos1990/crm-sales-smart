# Feature Specification: Reels, publicaciones e historias de Instagram que llegan vacías o con la URL de Meta

**Feature Branch**: `fix/048-instagram-reels-media`

**Created**: 2026-11-20

**Status**: Draft

**Tipo**: Hotfix (ver `docs/SPEC-KIT-WORKFLOWS.md`)

**Input**: Análisis previo de la integración de Instagram: "¿Karia permite recibir videos, Reels y otras cosas? Si los recibe, ¿se guardan en nuestro storage o se mantiene la URL original de Instagram y no se replica en el storage de Karia para esa instancia?"

## Diagnóstico previo (investigación de código)

**Qué se investigó**

- Webhook de entrada: `src/app/api/webhooks/instagram/route.ts`. Lo comparten Instagram y Facebook Messenger: el evento `object: "page"` llega a esta misma ruta.
- Normalización: `InstagramProvider.mapearEntrante` (`src/conversaciones/providers/instagram.ts:238-289`) y su gemelo `FacebookMessengerProvider.mapearEntrante` (`src/conversaciones/providers/facebook-messenger.ts:157-188`).
- Descarga a storage: `descargarYAlmacenarMediaIG` (`route.ts:145-193`), `guardarArchivoRaw` (`src/lib/media/services/media-raw.service.ts`) y `subirImagenConversacion`.
- Persistencia: `procesarMensajeEntrante` (`src/conversaciones/actions.ts:515-532`).
- Visualización: `src/conversaciones/components/burbuja-mensaje.tsx:256-310`.

**Qué SÍ funciona (no se toca)**

- **Imagen, video, audio y archivo** enviados directo por DM (adjuntos `image`, `video`, `audio` y `file`):
  - Se descargan de la URL temporal del CDN de Meta.
  - Se re-suben al storage de Karia bajo `${instanciaId}/conversaciones/...`.
  - Quedan registrados en `MediaArchivo` con su `instanciaId` y `canalOrigen`, deduplicados por hash dentro de la instancia.
- Si esa descarga falla, el adjunto se descarta a propósito y nunca se guarda la URL de Meta como respaldo (`route.ts:388-393`).
- Ya funcionan y no cambian: idempotencia por `mid`, reacciones, mensajes eco de la app nativa (020), resolución de perfil del remitente y desambiguación Instagram/Messenger.

**Causa raíz (con evidencia)**

1. `mapearEntrante` solo reconoce los adjuntos `image`, `video`, `audio` y `file`.
   - Cualquier otro tipo cae en `default: tipo = "TEXTO"`. Eso incluye Reel compartido, publicación compartida, mención en historia, sticker, `fallback` y `template`.
   - Aun así, el método asigna `mediaUrl = att.payload.url` antes del `switch` (`instagram.ts:262`), así que la URL del CDN de Meta queda cargada.
2. El webhook solo descarga a storage cuando `tipo !== "TEXTO"` (`route.ts:377`).
   - Para esos tipos no reconocidos se saltea la descarga.
   - Tampoco limpia `mediaUrl`, así que la URL de Meta sigue en el payload que se encola.
3. `procesarMensajeEntrante` persiste `mediaUrl` tal cual (`actions.ts:523`).
   - **Resultado**: el mensaje queda en la base con una URL de un tercero, que además expira.
   - No se crea nada en el storage de Karia.
   - Esto contradice la regla que el propio webhook declara en `route.ts:374-376`: "la URL que queda guardada en el mensaje debe ser propia de la app (S3), nunca la de Meta".
4. El mensaje queda sin texto y con tipo `TEXTO`.
   - Por eso la burbuja muestra "Este contenido no puede visualizarse" (`burbuja-mensaje.tsx:305-308`).
   - La IA y los Workflows reciben un mensaje vacío: no saben que el contacto compartió un Reel o los mencionó en una historia.
5. Una respuesta a una historia trae el texto y, aparte, la historia en `reply_to.story`.
   - Ese segundo bloque no se lee: se guarda el texto, pero se pierde a qué historia responde.
6. **Video directo**: se guarda bien en storage, pero la burbuja no tiene reproductor (no hay ningún `<video>` en `src/conversaciones`).
   - Solo muestra la etiqueta "Video", sin forma de verlo, aunque el archivo exista.
7. Facebook Messenger tiene el mismo patrón en `facebook-messenger.ts:166-172`: los adjuntos `share`, sticker y `fallback` quedan como `TEXTO` con la URL de Meta.
   - Comparte el mismo punto de descarga en `route.ts:377`, así que hoy filtra URLs de Meta de la misma forma.

**Por qué el síntoma se explica por esta causa y no por otra**

- El storage funciona: los videos directos sí se guardan.
- La descarga también funciona: las imágenes sí se replican.
- El hueco está únicamente en la combinación "tipo no reconocido → `TEXTO` + `mediaUrl` sin limpiar". Es la única ruta por la que una URL de Meta llega a `MensajeConversacion.mediaUrl`.

## Decisiones de alcance (2026-11-20)

Karia es una herramienta de atención, no una red social. El vendedor necesita **reconocer** qué le compartieron, no consumirlo.

- **Reels: solo texto.**
  - Se identifican con una etiqueta y su título o descripción, si Meta la envía.
  - No se descargan, no se guardan en el storage y no tienen preview ni enlace.
  - Se descartaron dos alternativas:
    - Extraer una miniatura del video, porque requiere una dependencia nueva de procesamiento de video.
    - Guardar el video completo, porque el costo de storage no aporta a la atención.
- **Videos enviados directamente: prioridad alta.** Son parte de la experiencia de atención. MUST poder reproducirse y verse bien en el inbox.
- **Publicaciones compartidas e historias de foto: se guarda la imagen.**
  - Usa el mismo tratamiento que las fotos actuales, así que no tiene costo adicional relevante.
  - Las historias de video siguen el criterio de los Reels: solo texto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ningún mensaje guarda una URL de Instagram o Facebook (Priority: P1)

Como dueño de una instancia de Karia, quiero que todo contenido que me llegue por Instagram o Messenger viva en el almacenamiento de mi instancia o no se guarde en absoluto, para no depender de enlaces de un tercero que expiran y que no controlo.

**Why this priority**: es la garantía que el sistema ya promete y hoy rompe. Es además el cambio mínimo que cierra el hueco aunque nada más de este spec se implemente.

**Independent Test**: enviar a la cuenta conectada un Reel compartido, una publicación compartida y un sticker. Verificar que ninguno de los mensajes resultantes referencia contenido alojado en servidores de Meta.

**Acceptance Scenarios**:

1. **Given** una cuenta de Instagram conectada, **When** un contacto comparte un Reel por DM, **Then** el mensaje registrado no contiene ninguna referencia a un servidor de Meta.
2. **Given** una Página de Facebook conectada a Messenger, **When** un contacto envía un sticker o un enlace compartido, **Then** el mensaje registrado no contiene ninguna referencia a un servidor de Meta.
3. **Given** mensajes históricos ya guardados con una URL de Meta, **When** se aplica la corrección, **Then** esas referencias se eliminan y los mensajes siguen visibles en la conversación, con la indicación de qué tipo de contenido eran.

---

### User Story 2 - Los videos que envía el contacto se reproducen y se ven bien (Priority: P2)

Como vendedor, quiero reproducir dentro de Karia los videos que me envían los contactos, porque son parte de la conversación de atención. Hoy el archivo se guarda, pero solo veo la palabra "Video".

**Why this priority**: es la parte de este fix con más valor para la atención. Los videos ya se conservan correctamente: lo que falta es poder verlos.

**Independent Test**: enviar un video directo por DM, uno horizontal y uno vertical, y verificar que se ve y se reproduce bien en la burbuja del inbox en escritorio y en móvil.

**Acceptance Scenarios**:

1. **Given** un mensaje de video recibido y conservado, **When** el vendedor abre la conversación, **Then** ve un cuadro del video como vista previa antes de reproducirlo.
2. **Given** ese video, **When** el vendedor lo reproduce, **Then** puede pausarlo, adelantarlo, ver su duración y abrirlo a pantalla completa sin salir de Karia.
3. **Given** un video vertical (formato celular) o uno horizontal, **When** se muestra en la burbuja, **Then** conserva su proporción: no se deforma, no se recorta y no desborda la conversación.
4. **Given** cualquiera de los navegadores soportados (Chrome, Edge, Firefox y Safari, en escritorio, iOS y Android), **When** el vendedor reproduce el video, **Then** se reproduce y se puede adelantar.
5. **Given** un video cuyo formato el navegador no puede reproducir, **When** el vendedor intenta verlo, **Then** ve un aviso claro y la opción de descargarlo desde el almacenamiento de Karia, nunca un reproductor roto.
6. **Given** un mensaje de video cuyo archivo no pudo conservarse, **When** el vendedor abre la conversación, **Then** ve la etiqueta "Video no disponible" sin reproductor.

---

### User Story 3 - Reels, publicaciones e historias se identifican en el inbox (Priority: P3)

Como vendedor que atiende Instagram desde Karia, quiero saber qué me compartió el contacto (un Reel, una publicación, una historia en la que me mencionó o a la que respondió), en lugar de un aviso de "no puede visualizarse", para responder con contexto sin abrir Instagram.

**Why this priority**: hoy estos mensajes no aportan nada ni al vendedor ni al agente IA. No hace falta reproducirlos: alcanza con identificarlos.

**Independent Test**: enviar cada tipo de contenido desde una cuenta de prueba y verificar en el inbox que cada uno se identifica.

**Acceptance Scenarios**:

1. **Given** un contacto que comparte un Reel, **When** el vendedor abre la conversación, **Then** ve "Compartió un Reel", con su título o descripción si Meta la envía. No hay reproductor, imagen ni enlace a Instagram.
2. **Given** un contacto que comparte una publicación, **When** el vendedor abre la conversación, **Then** ve que es una publicación compartida y, si Meta entregó la imagen, la imagen guardada en Karia.
3. **Given** un contacto que menciona a la cuenta en una historia de foto, **When** el vendedor abre la conversación, **Then** ve "Te mencionó en su historia" con la imagen guardada, que sigue visible después de que la historia expire en Instagram.
4. **Given** una mención en una historia de video, **When** el vendedor abre la conversación, **Then** ve "Te mencionó en su historia" sin imagen ni video.
5. **Given** un contacto que responde a una historia de la cuenta, **When** el vendedor abre la conversación, **Then** ve el texto de la respuesta junto con la indicación de que responde a una historia.
6. **Given** cualquiera de los casos anteriores, **When** se dispara el agente IA o un Workflow, **Then** reciben un texto que describe qué se compartió, en lugar de un mensaje vacío.
7. **Given** una publicación o historia de foto cuya imagen no pudo conservarse, **When** el vendedor abre la conversación, **Then** ve igualmente qué tipo de contenido era y que la imagen no pudo guardarse.

---

### Edge Cases

- **Mensaje con texto y adjunto a la vez**: hoy solo se guarda el texto. Se mantiene igual, salvo en la respuesta a historia, donde se agrega la referencia a la historia.
- **Varios adjuntos en un mismo mensaje**: hoy solo se procesa el primero. Fuera de alcance (ver Assumptions); no debe empeorar.
- **Publicación o historia de una cuenta privada**: Meta puede no entregar la imagen. Se registra la indicación de tipo sin imagen.
- **Publicación o historia cuya URL entrega un video y no una imagen**: no se guarda (mismo criterio que los Reels) y queda solo el texto.
- **Video directo mayor al límite de almacenamiento** (50 MB) o en un formato fuera de la lista admitida: comportamiento actual, es decir, el video no se guarda. Se muestra "Video no disponible" y no queda ninguna URL de Meta.
- **Video grabado en un formato que el navegador del vendedor no reproduce** (por ejemplo, `.mov` de iPhone en Chrome o Firefox): aviso más descarga (US2, escenario 5).
- **Video muy largo o pesado dentro del límite**: se puede adelantar sin descargarlo completo antes.
- **Misma imagen compartida por dos contactos de la misma instancia**: se reutiliza el archivo ya guardado (deduplicación existente por instancia). Nunca se comparte entre instancias.
- **Mensaje eco desde la app nativa** (el negocio comparte un Reel desde Instagram): aplica la misma regla de no guardar URLs de Meta y la misma indicación de tipo.
- **Tipo de adjunto nuevo** que Meta agregue en el futuro: se registra como contenido no reconocido, con una indicación genérica y sin URL de Meta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST NOT persistir, en ningún mensaje recibido por Instagram o Facebook Messenger, una referencia a contenido alojado por Meta, cualquiera sea el tipo de adjunto. Incluye mensajes del contacto y mensajes eco de la app nativa.
- **FR-002**: El sistema MUST reconocer como tipos propios, y no como "texto vacío", estos contenidos de Instagram:
  - Reel compartido.
  - Publicación compartida.
  - Mención en historia.
  - Respuesta a historia.
- **FR-003**: Los Reels compartidos y las historias de video MUST NOT descargarse ni guardarse en el almacenamiento. Se registran solo con su texto descriptivo (FR-004).
- **FR-003b**: Para publicaciones compartidas e historias de foto (mención o respuesta), cuando Meta entregue la imagen, el sistema MUST guardarla en el almacenamiento de la instancia receptora, aislada de las demás instancias, y mostrarla desde ahí.
- **FR-004**: Para cada contenido de FR-002, el mensaje MUST incluir un texto descriptivo legible que indique qué se compartió, más el título o la descripción cuando Meta lo envíe. Ese texto es el que reciben la búsqueda, el agente IA y los Workflows.
- **FR-005**: Cuando la imagen de una publicación o historia no pueda conservarse (no descargable, expirada o formato no admitido), el sistema MUST registrar igualmente el mensaje con su indicación de tipo y una aclaración de que la imagen no pudo guardarse.
- **FR-006**: Los tipos de adjunto no reconocidos (sticker, plantilla, `fallback`, tipos futuros) MUST registrarse con una indicación genérica de contenido no admitido, sin URL de Meta.
- **FR-007**: El inbox MUST permitir reproducir dentro de Karia los mensajes de video cuyo archivo se conservó. Aplica a cualquier canal que ya guarde videos. En concreto:
  - (a) Vista previa con un cuadro del video antes de reproducir.
  - (b) Reproducir, pausar, adelantar, ver la duración y pantalla completa.
  - (c) Proporción original conservada, tanto vertical como horizontal, sin deformar ni desbordar la burbuja.
  - (d) Funcionamiento en Chrome, Edge, Firefox y Safari, en escritorio, iOS y Android.
  - (e) Adelantar sin descargar el video completo.
  - (f) Si el navegador no puede reproducir el formato, aviso claro y descarga desde el almacenamiento de Karia.
- **FR-008**: La recepción de cualquier adjunto MUST NOT provocar el registro duplicado del mensaje ni la pérdida de otros mensajes del mismo lote del webhook.
- **FR-009**: Los mensajes ya guardados antes de esta corrección con una URL de Meta MUST quedar sin esa referencia y con una indicación de tipo genérica, sin borrar el mensaje.
- **FR-010**: El sistema MUST NOT alterar el comportamiento existente de:
  - La recepción y el guardado de imagen, video, audio y archivo directos, incluida su deduplicación por instancia, sin límites de tiempo ni tamaño nuevos.
  - Los mensajes de texto.
  - Las reacciones.
  - Los mensajes eco de la app nativa (más allá de FR-001 y FR-002).
  - La resolución de perfil del remitente.
  - La desambiguación Instagram/Messenger.
  - El envío de mensajes salientes.
  - La recepción de imágenes y videos por Messenger.
- **FR-011**: En Facebook Messenger, el alcance se limita a FR-001 y FR-006 (no guardar URLs de Meta e indicar el tipo de contenido no admitido). El reconocimiento de Reels e historias es exclusivo de Instagram.

### Key Entities

- **Mensaje de conversación**: gana el uso de un texto descriptivo para contenidos compartidos y deja de admitir referencias a contenido de terceros. No se esperan entidades nuevas.
- **Archivo de media**: el registro existente por instancia que respalda el contenido conservado. Pasa a cubrir también las imágenes de publicaciones e historias de foto. Nunca guarda Reels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde el despliegue, 0 mensajes recibidos por Instagram o Messenger contienen una referencia a un servidor de Meta. Lo mismo para el histórico, una vez aplicada la limpieza.
- **SC-002**: 100% de los Reels, publicaciones compartidas, menciones en historia y respuestas a historia recibidos se muestran con una indicación identificable del tipo de contenido. Ninguno aparece como "Este contenido no puede visualizarse".
- **SC-003**: 100% de los videos directos conservados se reproducen, se pueden adelantar y conservan su proporción en los 4 navegadores soportados, en escritorio y móvil. Ningún video conservado muestra solo la palabra "Video".
- **SC-004**: Las imágenes de publicaciones e historias de foto conservadas siguen visibles al menos 30 días después de recibidas, más allá de las 24 h de vida de una historia.
- **SC-005**: Recibir Reels no ocupa almacenamiento: 0 archivos guardados por Reels compartidos.
- **SC-006**: El agente IA responde a un Reel o mención en historia haciendo referencia a lo compartido, en lugar de tratar el mensaje como vacío, en las pruebas manuales de quickstart.
- **SC-007**: Cero regresiones: las pruebas existentes de Instagram, Messenger y conversaciones siguen pasando, y el escenario de "imagen y video directos" del quickstart se comporta igual que antes.

## Assumptions

- Los nombres y formas de los payloads (`ig_reel`/`reel`, `share`/`ig_post`, `story_mention`, `reply_to.story`) se toman de la documentación de Meta para la Instagram Messaging API. Se confirmarán contra un payload real capturado del log `IG_WEBHOOK_POST` durante el plan (research.md).
- Meta no garantiza que la imagen de una publicación o de una historia sea descargable (cuentas privadas, contenido restringido). En ese caso se cumple FR-005 y no se busca otra vía de obtenerla.
- Meta no documenta si envía el título de un Reel. Si no lo envía, el texto queda en "Compartió un Reel", sin poder identificar cuál. Se acepta como límite de la opción "solo texto".
- El tamaño máximo y los formatos admitidos para guardar son los vigentes en el almacenamiento de media (50 MB, lista blanca actual). Ampliarlos, o convertir videos a otro formato, queda fuera de alcance.
- La limpieza del histórico (FR-009) no intenta recuperar el contenido: esas URLs de Meta ya expiraron en su mayoría.
- **Fuera de alcance**:
  - Procesar más de un adjunto por mensaje.
  - Mostrar texto y adjunto juntos en mensajes que traen ambos (salvo respuesta a historia).
  - Reconocer Reels o historias en Messenger.
  - Mover la descarga de media del webhook al worker. Se evaluará en el plan solo si hace falta para cumplir FR-008.
  - Miniaturas, reproducción o guardado de Reels e historias de video.
  - Convertir videos a otro formato.
- El reproductor de video (FR-007) beneficia también a WhatsApp, que ya guarda videos. Se acepta como efecto colateral deseado.
