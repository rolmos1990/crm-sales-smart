---

description: "Tareas del hotfix 048 — Reels, publicaciones e historias de Instagram que llegan vacías o con la URL de Meta"
---

# Tasks: Reels, publicaciones e historias de Instagram que llegan vacías o con la URL de Meta

**Input**: Design documents from `specs/048-fix-instagram-reels-media/`

**Prerequisites**: plan.md, spec.md, research.md (R0–R7), data-model.md, contracts/texto-descriptivo.md, quickstart.md

**Tests**: incluidos. La constitución (principio V) exige tests proporcionales al riesgo, y el plan los enumera: lógica pura de clasificación, decisión de reubicación, parseo de `Range` y providers. Se usa Vitest (`npm run test:unit`).

**Organization**: por historia de usuario. US1 (P1) es el MVP y se puede desplegar sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia pendiente).
- **[Story]**: US1, US2 o US3, según spec.md.

---

## Phase 1: Setup

**Purpose**: confirmar la forma real de los payloads de Meta antes de fijar las familias (research R1).

- [ ] T001 Ejecutar el escenario 0 de `specs/048-fix-instagram-reels-media/quickstart.md`.
  - Enviar desde una cuenta de prueba: un Reel, una publicación, una mención en historia de foto y otra de video, y una respuesta a historia.
  - Copiar del log `IG_WEBHOOK_POST` los valores reales de `message.attachments[].type`, las claves de `payload` (en especial si existe `title`) y la forma de `message.reply_to.story`.
  - Anotarlo en una sección "Payloads reales capturados" al final de `specs/048-fix-instagram-reels-media/research.md`.
  - Si aparece un `type` que no está en la tabla de familias de R1, agregarlo a esa tabla.
  - **Tarea manual, no bloquea T002–T012.** Sí debe estar hecha antes de cerrar US3 (T024).

---

## Phase 2: Foundational (bloquea a todas las historias)

**Purpose**: el clasificador de familias y los textos del contrato, que usan US1 y US3.

- [X] T002 Agregar en `src/conversaciones/types.ts`:
  - El tipo exportado `FamiliaAdjunto = "DIRECTA" | "REEL" | "PUBLICACION" | "MENCION_HISTORIA" | "RESPUESTA_HISTORIA" | "EFIMERO" | "NO_ADMITIDO"`.
  - El campo opcional `familiaAdjunto?: FamiliaAdjunto` en `MensajeEntranteNormalizado`, con un comentario breve: es interno (provider → webhook) y el webhook lo elimina antes de publicar, así que nunca viaja por RabbitMQ ni cambia el contrato `ComandoProcesarEntrantePayload`.
- [X] T003 Crear `src/conversaciones/providers/instagram-adjuntos.ts` con:
  - (a) `clasificarAdjuntoInstagram(tipoMeta: string | undefined, esNoAdmitido?: boolean): FamiliaAdjunto`, con conjuntos por familia según la tabla de research R1:
    - DIRECTA: `image`, `video`, `audio`, `file`.
    - REEL: `ig_reel`, `reel`.
    - PUBLICACION: `share`, `ig_post`, `media`.
    - MENCION_HISTORIA: `story_mention`, `story`, `ig_story`.
    - EFIMERO: `ephemeral`.
    - Cualquier otro valor, `undefined` o `esNoAdmitido === true`: NO_ADMITIDO.
  - (b) `textoDescriptivo(familia, opciones: { titulo?: string; texto?: string; fallo?: boolean; canal?: "instagram" | "facebook_messenger" }): string | undefined`. Devuelve exactamente los textos de `specs/048-fix-instagram-reels-media/contracts/texto-descriptivo.md`:
    - Título recortado a 200 caracteres y envuelto en `«»`.
    - Sufijo `(no se pudo guardar la imagen)` solo con `fallo: true` en PUBLICACION o MENCION_HISTORIA, nunca en RESPUESTA_HISTORIA.
    - `undefined` para DIRECTA.
  - (c) La constante exportada `TEXTO_HISTORICO_NO_DISPONIBLE = "Contenido compartido que ya no está disponible"`.
  - Sin dependencias de red ni de Prisma.
- [X] T004 [P] Crear `src/conversaciones/providers/instagram-adjuntos.test.ts` (Vitest):
  - Cada `type` de cada familia clasifica correctamente.
  - Un `type` desconocido y `esNoAdmitido` dan NO_ADMITIDO.
  - Cada fila de la tabla del contrato produce el texto exacto, incluido el título de más de 200 caracteres recortado.
  - El texto de Messenger para NO_ADMITIDO.
  - RESPUESTA_HISTORIA con y sin `texto`, y con `fallo: true` (sin sufijo).

**Checkpoint**: `npm run test:unit -- src/conversaciones/providers/instagram-adjuntos` en verde.

---

## Phase 3: User Story 1 — Ningún mensaje guarda una URL de Instagram o Facebook (Priority: P1) 🎯 MVP

**Goal**: ninguna URL de Meta llega a `MensajeConversacion.mediaUrl`, ni en mensajes nuevos ni en el histórico. En esta fase todo adjunto no directo se registra como "contenido no admitido". US3 lo refina por familia.

**Independent Test**: escenarios 1 y 5 de `quickstart.md`.

- [X] T005 [P] [US1] Modificar `InstagramProvider.mapearEntrante` en `src/conversaciones/providers/instagram.ts` (líneas ~238-289):
  - Agregar `is_unsupported?: boolean` al tipo de `message`.
  - La rama `message.text` no cambia.
  - En la rama de adjuntos, calcular `familia = clasificarAdjuntoInstagram(att.type, message.is_unsupported)`.
    - Si es `DIRECTA`: mantener el `switch` actual y asignar `mediaUrl = att.payload?.url`, exactamente como hoy.
    - Si es cualquier otra familia: `tipo = "TEXTO"`, `mediaUrl` **sin asignar** y `contenido = textoDescriptivo("NO_ADMITIDO", { canal: "instagram" })`.
  - Devolver `familiaAdjunto: familia`.
  - Un mensaje con `is_unsupported: true` y sin adjuntos también da NO_ADMITIDO.
  - Mover la asignación de `mediaUrl` (hoy en la línea 262, antes del `switch`) para que solo ocurra en DIRECTA.
- [X] T006 [P] [US1] Modificar `FacebookMessengerProvider.mapearEntrante` en `src/conversaciones/providers/facebook-messenger.ts` (líneas ~157-188):
  - `mediaUrl` solo se asigna para `image` y `video`, con `familiaAdjunto: "DIRECTA"`.
  - En el `default`: `tipo = "TEXTO"`, sin `mediaUrl`, `contenido = textoDescriptivo("NO_ADMITIDO", { canal: "facebook_messenger" })` y `familiaAdjunto: "NO_ADMITIDO"`.
  - El texto y la imagen/video de Messenger quedan idénticos a hoy.
- [X] T007 [P] [US1] Agregar casos en el `describe("InstagramProvider.mapearEntrante")` de `src/conversaciones/providers/instagram.test.ts`:
  - `template`, `fallback` o un `type` inventado: `tipo` TEXTO, `mediaUrl` undefined, `contenido` "Envió un contenido que Instagram no permite mostrar".
  - `is_unsupported: true` sin adjuntos: igual que el anterior.
  - **Regresión**: `image`, `video`, `audio` y `file` siguen dando IMAGEN, VIDEO, AUDIO y DOCUMENTO con `mediaUrl` = la URL del payload y sin `contenido`.
- [X] T008 [P] [US1] Agregar casos en `src/conversaciones/providers/facebook-messenger.test.ts`:
  - `share`, `fallback` y `template`: sin `mediaUrl`, `contenido` "Envió un contenido que Messenger no permite mostrar".
  - **Regresión**: `image` y `video` sin cambios (ver el test existente en la línea ~174-185).
- [X] T009 [US1] Crear `src/app/api/webhooks/instagram/reubicacion.ts`, solo lógica pura (no importa Prisma ni fetch):
  - El tipo `ResultadoDescarga = { ok: true; url: string; mimeType: string; mediaArchivoId: string } | { ok: false; motivo: "FALLO" | "NO_ES_IMAGEN" }`.
  - La función `prepararPayloadEntrante(normalizado: MensajeEntranteNormalizado, resultado: ResultadoDescarga | null): Omit<MensajeEntranteNormalizado, "familiaAdjunto">`, que:
    - (a) Quita `familiaAdjunto`.
    - (b) Con `resultado.ok`, asigna `mediaUrl`, `mediaMimeType` y `mediaArchivoId` del resultado.
    - (c) Con `resultado` no ok o `null`, deja `mediaUrl` en `undefined`. Esta es la garantía de FR-001: la salida nunca contiene la URL original de Meta.
    - (d) En esta fase no toca `tipo` ni `contenido` (comportamiento actual para DIRECTA y NO_ADMITIDO).
  - Con un comentario que cite FR-001 y research R5.
- [X] T010 [US1] Crear `src/app/api/webhooks/instagram/reubicacion.test.ts`:
  - Con un normalizado que trae `mediaUrl: "https://lookaside.fbsbx.com/…"`:
    - Con resultado ok, la salida tiene la URL propia y el `mediaArchivoId`.
    - Con resultado `FALLO` o `null`, `mediaUrl` es undefined.
  - En todos los casos, la salida no tiene la clave `familiaAdjunto`.
  - El normalizado de entrada no se muta.
- [X] T011 [US1] Modificar `src/app/api/webhooks/instagram/route.ts`:
  - (a) `descargarYAlmacenarMediaIG` (líneas ~145-193) devuelve `ResultadoDescarga`: `{ ok: false, motivo: "FALLO" }` donde hoy devuelve `null`. Su lógica de descarga y guardado no cambia (FR-010: sin timeout ni límites nuevos).
  - (b) En el bloque de las líneas ~374-394, reemplazar la condición `normalizado.mediaUrl && normalizado.tipo !== "TEXTO"` por `normalizado.mediaUrl`. Guardar el resultado (o `null` si no hay `mediaUrl`) y mantener el `console.error` del fallo.
  - (c) Construir `const payloadEntrante = prepararPayloadEntrante(normalizado, resultado)` y usarlo en lugar de `...normalizado` en **las dos** publicaciones: `PROCESAR_MENSAJE_APP_NATIVA` (línea ~427) y `PROCESAR_ENTRANTE` (línea ~436).
  - (d) Actualizar el comentario del bloque para decir que la regla aplica a todo tipo de adjunto.
- [X] T012 [P] [US1] Crear la migración de solo datos `prisma/migrations/20261120000200_limpiar_urls_meta_mensajes/migration.sql`:
  - Con el `UPDATE` de research R7 (tablas sin `@@map`: `"MensajeConversacion"`, `"Conversacion"`, `"CuentaCanal"`).
  - Usando el texto `Contenido compartido que ya no está disponible`, idéntico a `TEXTO_HISTORICO_NO_DISPONIBLE`.
  - Con un comentario SQL que explique que es idempotente y que nunca toca filas con `mediaArchivoId`.
  - **No** modificar `prisma/schema.prisma`.
- [X] T028 [US1] *(agregada por el hallazgo C1 de `/speckit-analyze`: constitución V, test de integración del adaptador)* Crear `src/app/api/webhooks/instagram/route.test.ts`, que prueba el `POST` del webhook con Prisma, RabbitMQ, firma y storage simulados y los providers reales:
  - Las dos publicaciones (`PROCESAR_ENTRANTE` y `PROCESAR_MENSAJE_APP_NATIVA`) salen sin host de Meta y sin campos internos.
  - Un video directo conservado publica la URL propia.
  - Un video que falla queda como VIDEO sin media.
  - Un adjunto que falla no corta el resto del lote (FR-008).

**Checkpoint**:
- `npm run test:unit -- src/conversaciones/providers src/app/api/webhooks` en verde.
- Escenarios 1 y 5 del quickstart OK. En este punto el Reel aparece como "Envió un contenido que Instagram no permite mostrar", que es lo esperado en el MVP.
- Desplegable solo.

---

## Phase 4: User Story 2 — Los videos que envía el contacto se reproducen y se ven bien (Priority: P2)

**Goal**: los videos conservados se reproducen en el inbox con vista previa, controles, proporción correcta, soporte de Safari/iOS y aviso con descarga si el formato no se puede reproducir (FR-007 a–f).

**Independent Test**: escenario 2 de `quickstart.md`, con la matriz de navegadores. No depende de US1 ni de US3.

- [X] T013 [P] [US2] Crear `src/app/cdn/[...key]/range.ts` con la función pura `parsearRange(header: string | null, total: number): { inicio: number; fin: number } | "INVALIDO" | null`:
  - Soporta `bytes=a-b`, `bytes=a-` y `bytes=-n` (sufijo). `fin` se acota a `total - 1`.
  - Devuelve `null` (servir completo) si el header falta, no empieza con `bytes=` o tiene varios rangos (contiene `,`).
  - Devuelve `"INVALIDO"` si `inicio >= total`, `inicio > fin` o hay números no válidos.
- [X] T014 [P] [US2] Crear `src/app/cdn/[...key]/range.test.ts`:
  - Los tres formatos válidos y el acotado de `fin` al final del archivo.
  - Multi-rango y header ausente: `null`.
  - Rango fuera del archivo o invertido: `"INVALIDO"`.
  - `bytes=0-0` (1 byte).
  - Sufijo mayor que el archivo: desde 0.
- [X] T015 [US2] Modificar `GET` en `src/app/cdn/[...key]/route.ts`:
  - Mantener la validación de path traversal y el `Cache-Control`.
  - Agregar siempre `Accept-Ranges: bytes` y `Content-Length`.
  - Con `parsearRange(req.headers.get("range"), buffer.length)`:
    - Un rango: responder `206` con `buffer.subarray(inicio, fin + 1)` y `Content-Range: bytes inicio-fin/total`.
    - `"INVALIDO"`: responder `416` con `Content-Range: bytes */total`.
    - `null`: `200` como hoy.
  - Renombrar el parámetro `_req` a `req`.
- [X] T016 [US2] Crear el componente `BurbujaVideo({ mensaje }: { mensaje: MensajeConMeta })` en `src/conversaciones/components/burbuja-mensaje.tsx`, junto a `BurbujaImagen`, siguiendo su mismo patrón de estados:
  - **URL**: `src = mensaje.mediaUrlOptimizada ?? mensaje.mediaUrl`.
  - **Estados sin video**:
    - Si `mediaEstado === "ERROR"` o no hay `src`: tarjeta con el ícono `Video` y el texto "Video no disponible", con las mismas clases que el estado "Imagen no disponible".
    - Si `mediaEstado` es `PENDIENTE` o `PROCESANDO`: tarjeta "Procesando video…" con `Loader2` animado.
  - **Reproductor**: `<video controls playsInline preload="metadata" src={`${src}#t=0.1`}>`.
    - El fragmento `#t=0.1` es necesario para que Safari/iOS muestre el primer cuadro. Comentar ese porqué.
    - Clases: `block max-w-[280px] max-h-[360px] w-auto h-auto object-contain rounded-xl border border-border bg-muted`, con tokens semánticos y sin hex.
  - **Formato no reproducible**: estado local `noReproducible` activado por `onError` del `<video>`. En ese caso, en lugar del video se muestra una tarjeta con `AlertCircle`, el texto "Este navegador no puede reproducir el video" y un enlace `<a href={src} download target="_blank" rel="noopener noreferrer">` con el texto "Descargar video".
- [X] T017 [US2] En el render de la burbuja de `src/conversaciones/components/burbuja-mensaje.tsx` (la IIFE de las líneas ~258-310), agregar `if (mensaje.tipo === "VIDEO") return <BurbujaVideo mensaje={mensaje} />;` justo después del caso `esImagenTipo`. No cambiar los casos de imagen, audio ni fallback.

**Checkpoint**:
- `npm run test:unit -- src/app/cdn` en verde.
- Escenario 2 del quickstart OK en Chrome, Edge, Firefox y Safari (escritorio), Safari iOS y Chrome Android.

---

## Phase 5: User Story 3 — Reels, publicaciones e historias se identifican en el inbox (Priority: P3)

**Goal**:
- Reels e historias de video: solo texto, sin descarga.
- Publicaciones e historias de foto: imagen guardada más el texto.
- Respuesta a historia: el texto del contacto con la indicación.
- La IA recibe el texto descriptivo.

**Independent Test**: escenario 3 de `quickstart.md`. Requiere US1 (T005, T009 y T011), porque refina sus ramas.

- [X] T018 [US3] Refinar `InstagramProvider.mapearEntrante` en `src/conversaciones/providers/instagram.ts`:
  - **Tipo del evento**: agregar `reply_to?: { story?: { url?: string; id?: string }; mid?: string }` al `message` y `title?: string` al `payload` del adjunto.
  - **Respuesta a historia**, como **primera** rama (antes de `message.text`): si existe `message.reply_to?.story`:
    - `familia = "RESPUESTA_HISTORIA"`.
    - `contenido = textoDescriptivo("RESPUESTA_HISTORIA", { texto: message.text })`.
    - Si hay `story.url`: `tipo = "IMAGEN"` provisional y `mediaUrl = story.url`. Si no hay: `tipo = "TEXTO"`.
  - **Rama de adjuntos**, según la familia:
    - REEL: `tipo` TEXTO, **sin** `mediaUrl`, `contenido = textoDescriptivo("REEL", { titulo: payload.title })`.
    - EFIMERO: `tipo` TEXTO, sin `mediaUrl`, texto del contrato.
    - PUBLICACION y MENCION_HISTORIA: `tipo = "IMAGEN"` provisional, `mediaUrl = payload.url` y `contenido` = texto sin fallo (con título si existe). Si no hay `payload.url`: `tipo` TEXTO y texto sin fallo.
    - NO_ADMITIDO: igual que en T005.
  - Devolver siempre `familiaAdjunto`.
  - `title` solo se usa si es `string`.
- [X] T019 [P] [US3] Agregar casos en `src/conversaciones/providers/instagram.test.ts`:
  - `ig_reel` con y sin `title`, y `reel`: TEXTO, `mediaUrl` **undefined**, texto exacto.
  - `share`, `ig_post` y `media`: IMAGEN provisional, `mediaUrl` del payload, "Compartió una publicación".
  - `story_mention`: IMAGEN provisional, "Te mencionó en su historia".
  - `reply_to.story` con texto ("hola"): "Respondió a tu historia: hola", con `mediaUrl` = la URL de la historia.
  - `reply_to.story` sin texto.
  - `ephemeral`: sin `mediaUrl`.
  - Eco (`is_echo`) de un Reel: sigue usando `recipient.id`.
- [X] T020 [US3] Extender `prepararPayloadEntrante` en `src/app/api/webhooks/instagram/reubicacion.ts` para PUBLICACION, MENCION_HISTORIA y RESPUESTA_HISTORIA:
  - `resultado.ok`: `tipo = "IMAGEN"`. El `contenido` queda igual.
  - `motivo: "NO_ES_IMAGEN"`: `tipo = "TEXTO"`. El `contenido` queda igual, sin sufijo (research R0: la historia de video se omite a propósito).
  - `motivo: "FALLO"` o `null`: `tipo = "TEXTO"`. `contenido = textoDescriptivo(familia, { titulo, fallo: true })` para PUBLICACION y MENCION_HISTORIA; en RESPUESTA_HISTORIA el `contenido` no cambia.
  - Para conservar el título en el caso FALLO, guardar `titulo` en un campo interno opcional `tituloAdjunto` de `MensajeEntranteNormalizado` (en `src/conversaciones/types.ts`, mismo comentario que `familiaAdjunto`) y quitarlo también en la salida.
  - DIRECTA y NO_ADMITIDO: sin cambios respecto de T009.
- [X] T021 [US3] Agregar casos en `src/app/api/webhooks/instagram/reubicacion.test.ts`:
  - Cada combinación de las tres familias con `ok`, `NO_ES_IMAGEN`, `FALLO` y `null`, con el `tipo` y `contenido` esperados según el contrato.
  - La salida no tiene `tituloAdjunto` ni `familiaAdjunto`.
  - **Regresión**: DIRECTA VIDEO con `FALLO` conserva `tipo` VIDEO y no recibe `contenido`.
- [X] T022 [US3] En `src/app/api/webhooks/instagram/route.ts`:
  - (a) Ampliar `IGMessagingEvent` (líneas ~16-32) con `is_unsupported?`, `reply_to?` y `title?` en el `payload` del adjunto, alineado con T018.
  - (b) Crear `descargarImagenCompartida(url: string, instanciaId: string): Promise<ResultadoDescarga>`:
    - `fetch(url, { signal: AbortSignal.timeout(15_000) })`.
    - Si `!res.ok`: `{ ok: false, motivo: "FALLO" }`.
    - Leer `content-type` **antes** del cuerpo. Si no empieza con `image/`: `await res.body?.cancel()` y `{ ok: false, motivo: "NO_ES_IMAGEN" }`.
    - Si es imagen: `subirImagenConversacion({ buffer, mimeTypeProveedor, instanciaId, canal: "instagram", contactoId: null })`, con el mismo manejo de `rechazada` que `descargarYAlmacenarMediaIG`. Devolver `{ ok: true, url: urlOptimizada, mimeType: "image/webp", mediaArchivoId }`.
    - Cualquier excepción: `{ ok: false, motivo: "FALLO" }` con `console.error` (sin loguear la URL completa de Meta).
  - (c) En el bloque de reubicación de T011, elegir la función según `normalizado.familiaAdjunto`:
    - PUBLICACION, MENCION_HISTORIA o RESPUESTA_HISTORIA: `descargarImagenCompartida`.
    - Cualquier otra: `descargarYAlmacenarMediaIG` sin cambios.
- [X] T023 [US3] En `src/conversaciones/components/burbuja-mensaje.tsx`, mostrar media y texto juntos (research R3):
  - Antes de la rama `mensaje.contenido ? <p>… : (IIFE)` (línea ~256), si `(mensaje.tipo === "IMAGEN" || mensaje.tipo === "VIDEO") && (mensaje.mediaArchivoId || mensaje.mediaUrl) && mensaje.contenido`, renderizar `<BurbujaImagen/>` o `<BurbujaVideo/>` y debajo `<p className="mt-1.5 whitespace-pre-wrap break-words">{mensaje.contenido}</p>`.
  - El resto de los casos queda idéntico.
- [ ] T024 [US3] Verificar con los payloads reales anotados en T001:
  - Ajustar las familias de `src/conversaciones/providers/instagram-adjuntos.ts` y sus tests si apareció un `type` nuevo.
  - Si el Reel no trae `title`, confirmar en `specs/048-fix-instagram-reels-media/research.md` que se acepta el límite (Assumptions del spec).

**Checkpoint**:
- `npm run test:unit -- src/conversaciones/providers src/app/api/webhooks` en verde.
- Escenario 3 del quickstart OK, incluida la respuesta de la IA a un Reel.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 Correr `npm run test:unit` completo, `npx tsc --noEmit` y `npm run build`. Corregir cualquier error de tipos derivado de `familiaAdjunto`/`tituloAdjunto` (por ejemplo, otros providers que construyan `MensajeEntranteNormalizado`).
- [ ] T026 Ejecutar el escenario 4 (cero regresión) de `specs/048-fix-instagram-reels-media/quickstart.md`:
  - Instagram: texto, imagen directa, nota de voz, reacción y reenvío del mismo webhook.
  - Messenger: imagen.
  - WhatsApp: imagen y video, este último ahora con reproductor.
- [X] T027 [P] Agregar en `docs/eventos.md` una nota de que `familiaAdjunto` y `tituloAdjunto` de `MensajeEntranteNormalizado` son internos del webhook y no forman parte del contrato del comando `PROCESAR_ENTRANTE`. Hacerlo solo si ese documento describe el payload de ese comando; si no, omitir la tarea y anotarlo en el PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: manual, en paralelo con todo. Debe estar hecha antes de T024.
- **Foundational (T002–T004)**: bloquea US1 y US3. US2 **no** depende de esta fase.
- **US1 (T005–T012)**: depende de Foundational. Es el MVP.
- **US2 (T013–T017)**: independiente. Puede arrancar en paralelo con Foundational.
- **US3 (T018–T024)**: depende de US1 (refina T005, T009 y T011). T023 depende de T016 (usa `BurbujaVideo`).
- **Polish (T025–T027)**: al final.

### Within Each Story

- US1: T005/T006 y sus tests (T007/T008) → T009 → T010 → T011. T012 es independiente.
- US2: T013 → T014 y T015. T016 → T017.
- US3: T018 → T019. T020 → T021. T022 depende de T018 y T020. T023 depende de T016.

### Parallel Opportunities

- T004 en paralelo con el inicio de US1.
- US1: T005, T006, T007, T008 y T012 en paralelo (archivos distintos).
- US2 completa en paralelo con Foundational y US1: archivos `src/app/cdn/*` y `burbuja-mensaje.tsx`.
- US3: T019 en paralelo con T020/T021.

### Parallel Example: User Story 1

```text
T005 instagram.ts            T006 facebook-messenger.ts
T007 instagram.test.ts       T008 facebook-messenger.test.ts
T012 migration.sql
→ luego T009 reubicacion.ts → T010 → T011 route.ts
```

### Parallel Example: User Story 2

```text
T013 range.ts  →  T014 range.test.ts  |  T015 cdn/route.ts
T016 BurbujaVideo  →  T017 integración en la burbuja
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. T002–T004 (Foundational).
2. T005–T012 (US1).
3. Validar con los escenarios 1 y 5. Desplegar: desde ese momento no entra ninguna URL de Meta y el histórico queda limpio.

### Incremental Delivery

1. **US1**: cierra la fuga de URLs de Meta.
2. **US2**: videos reproducibles. Es independiente, así que puede salir antes o junto con US1.
3. **US3**: Reels, publicaciones e historias identificables; la IA entiende lo compartido.
4. Polish y verificación de cero regresión.

### Notas

- App y worker: este fix toca solo la app Next.js (webhook, `/cdn`, UI) y una migración. El worker no cambia porque el contrato del comando es el mismo.
- No hacer commit de cambios en `prisma/schema.prisma`. La migración es solo de datos.
