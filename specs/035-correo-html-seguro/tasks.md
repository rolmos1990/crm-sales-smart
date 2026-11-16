---

description: "Lista de tareas de la feature 035 — Vista segura de correos HTML en el Inbox"
---

# Tasks: Vista segura de correos HTML en el Inbox

**Input**: Documentos de diseño en `specs/035-correo-html-seguro/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (limpieza-html.md,
rutas-http.md, proxy-imagenes.md), quickstart.md

**Tests**: **Obligatorias.** El pedido original enumera pruebas de seguridad que deben pasar y verificarse
en un navegador real. La constitución (principio V) también pide pruebas proporcionales al riesgo. En cada
historia, las pruebas se escriben primero y deben fallar antes de implementar.

**Organization**: tareas agrupadas por historia de usuario (US1–US4 de spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo con otras (archivo distinto y sin dependencias pendientes).
- **[Story]**: historia a la que pertenece (US1, US2, US3, US4).

## Reglas que aplican a TODAS las tareas

Las tareas no las repiten una por una. Leerlas antes de empezar.

- **Iframe.** `sandbox="allow-popups allow-popups-to-escape-sandbox"` exactamente (research R5.1). Jamás
  `allow-scripts`, `allow-same-origin`, `allow-forms`, `allow-top-navigation*`, `allow-modals` ni
  `allow-downloads`. Jamás `srcdoc` ni `dangerouslySetInnerHTML` con contenido de un correo.
- **Worker.** Todo módulo bajo `src/integraciones/email/mensaje/` es apto para el worker: no puede importar
  `server-only`, `next/*` ni nada que no resuelva en Node pelado (`src/worker/grafo-importaciones.test.ts`).
- **Logs.** Nunca registran HTML, cuerpo, URLs completas de imágenes ni credenciales. Solo ids, motivos y
  códigos.
- **Errores.** Toda discrepancia de autorización o recurso responde **404** con cuerpo genérico. Nunca 401
  ni 403.
- **Convenciones del proyecto.**
  - Dominio en español, sin `any`, sin barrel files.
  - Fechas con `<FechaHora>` o `formatearFecha`.
  - Tokens semánticos de Tailwind, `cn()` y `data-slot`.
  - Validación con Zod en los bordes.

---

## Phase 1: Setup

**Purpose**: dependencia nueva, configuración y verificación del entorno.

- [X] T001 Instalar `sanitize-html` (dependency) y `@types/sanitize-html` (devDependency) con `npm install sanitize-html && npm install -D @types/sanitize-html`. Confirmar que `package.json` y `package-lock.json` quedan actualizados.
- [X] T002 [P] Agregar `CORREO_VISTA_SECRETO=` a `.env.example`. Incluir un comentario: "≥ 32 bytes aleatorios; firma las URLs de la vista aislada de correos (feature 035). Sin él, la vista HTML queda deshabilitada y los correos se ven en texto". Agregar también el comando de generación de quickstart.md.
- [X] T003 [P] Verificar que `src/worker/grafo-importaciones.test.ts` sigue en verde y que `node -e "require('sanitize-html')"` resuelve desde la raíz del repo. Así se confirma que la dependencia es apta para el worker.

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: modelo de datos, política de limpieza, tipos compartidos y token. Ninguna historia puede
empezar sin esto.

- [X] T004 Agregar a `prisma/schema.prisma` el enum `EstadoHtmlCorreo` (`SIN_HTML`, `DISPONIBLE`, `NO_DISPONIBLE`) y el modelo `MensajeCorreo`, con los campos, tipos, defaults, `@unique` en `mensajeId`, `@@index([instanciaId])` y relaciones `onDelete: Cascade` de `data-model.md`. Agregar las relaciones inversas `correo MensajeCorreo?` en `MensajeConversacion` y `mensajesCorreo MensajeCorreo[]` en `Instancia`.
- [X] T005 Crear la migración aditiva `prisma/migrations/20261117000000_correo_html_seguro/migration.sql`: `CREATE TYPE`, `CREATE TABLE`, índices y FKs según `data-model.md`, sin tocar tablas existentes. Agregar arriba un comentario con la reversión (`DROP TABLE "MensajeCorreo"; DROP TYPE "EstadoHtmlCorreo";`). Ejecutar `npx prisma generate`. Depende de T004.
- [X] T006 [P] Crear `src/integraciones/email/vista/schema.ts` con los esquemas Zod y los tipos derivados (`z.infer`):
  - `direccionCorreoSchema` (`{ nombre: string|null, direccion: string }`);
  - `adjuntoCorreoSchema` (`mediaArchivoId, nombre, mimeType, bytes, cid: string|null, enLinea: boolean`);
  - `datosCorreoEntranteSchema` (forma `DatosCorreoEntrante` de `contracts/limpieza-html.md`);
  - `imagenesExternasSchema` (`z.array(z.string().url()).max(50)`).

  Sin imports de Next ni Prisma, porque el worker lo usa.
- [X] T007 [P] Crear `src/integraciones/email/mensaje/html/politica.ts` con:
  - `VERSION_POLITICA = 1`;
  - los límites de research R3: `MAX_BYTES_HTML_ENTRADA = 1_048_576`, `MAX_BYTES_HTML_LIMPIO = 524_288`, `PROFUNDIDAD_ANIDAMIENTO = 64`, `PROFUNDIDAD_MAXIMA_RECHAZO = 2000`, `MAX_MS_LIMPIEZA = 2000`, `MAX_IMAGENES_EXTERNAS = 50`;
  - la función `opcionesBase(): sanitizeHtml.IOptions` con exactamente la lista blanca de research R2: etiquetas, atributos por etiqueta, `allowedSchemes ['http','https','mailto']`, `allowedSchemesByTag.img ['http','https','cid']`, `allowedStyles` con una regex de valor por propiedad que rechace `url(`, `expression(`, `@import`, `\` y `javascript:`, más `allowProtocolRelative: false`, `allowVulnerableTags: false`, `disallowedTagsMode: 'discard'` y `nestingLimit`;
  - un comentario con el *por qué* de excluir `<style>` y `position`.
- [X] T008 [P] Crear `src/integraciones/email/vista/token.ts` según `contracts/rutas-http.md` § Token:
  - `firmarToken(payload, ahora?)` y `verificarToken(token, tipoEsperado, ahora?)`;
  - HMAC-SHA256 con `CORREO_VISTA_SECRETO` y base64url;
  - comparación con `timingSafeEqual`;
  - rechazo por `v !== 1`, tipo distinto, `exp` pasada o `exp - ahora > 900`;
  - devuelve `null` si falta el secreto o tiene menos de 32 bytes (falla cerrado);
  - `VIDA_TOKEN_SEGUNDOS = 900`.
- [X] T009 [P] Crear `src/integraciones/email/vista/token.test.ts` con estos casos: token válido; firma alterada (un carácter); payload alterado con la firma original; vencido; `exp` a más de 15 min; tipo `vista` usado como `cid`; otro `instanciaId` dentro del payload re-firmado con otro secreto; secreto ausente; secreto corto.
- [X] T010 Crear `src/integraciones/email/vista/queries.ts`, solo para el servidor:
  - `obtenerCorreoDeMensaje(mensajeId, instanciaId)`, que filtra por `instanciaId` **y** por `mensaje.conversacion.instanciaId`, devuelve `null` si no coincide y valida los JSON con los esquemas de T006;
  - `obtenerMensajeCorreoParaSesion(mensajeId, instanciaId)`, que también devuelve `mediaArchivoId` y `remitente` del mensaje.

  Depende de T005 y T006.

**Checkpoint**: migración aplicada, cliente generado, política y token probados. Las historias pueden
empezar.

---

## Phase 3: User Story 1 — Leer un correo HTML con su formato, de forma segura (P1) 🎯 MVP

**Goal**: los correos HTML recibidos después de la feature se ven con su formato en un iframe aislado, con
selector Vista previa / Texto plano, scroll sin barra visible y caída a texto ante cualquier falla.

**Independent Test**: quickstart.md §2 (correo normal), §3 (correo malicioso en navegador real) y §5 (otro
comercio da 404).

### Tests for User Story 1 ⚠️ (escribir primero, deben fallar)

- [X] T011 [P] [US1] Crear `src/integraciones/email/mensaje/html/limpiar-html.test.ts` con el **catálogo completo de 14 casos** de `contracts/limpieza-html.md`. Cada caso afirma la **ausencia** en la salida (por ejemplo, ningún `/\son\w+=/i`, ningún `<script`, ningún `javascript:` en ninguna codificación). Agregar estos casos a la misma suite:
  - `prepararHtmlParaVista` con `imagenes: false` deja los `img[data-karia-externa]` sin `src`;
  - con `imagenes: true` apunta a la URL que devuelve `urlImagenExterna(N)`;
  - un `cid` fuera del mapa queda sin `src`;
  - un HTML guardado con `<script>` inyectado a mano sale limpio igual (defensa en profundidad).
- [X] T012 [P] [US1] Crear `src/integraciones/email/vista/documento.test.ts`. Debe afirmar:
  - que `cabecerasVista(origen)` devuelve **exactamente** la CSP de research R7, con `sandbox allow-popups allow-popups-to-escape-sandbox` y `img-src data: {origen}/api/correo-aislado/`, más `nosniff`, `no-referrer`, `private, no-store`, `SAMEORIGIN`, `CORP same-origin` y `Permissions-Policy`;
  - que la CSP **no** contiene `allow-scripts`, `allow-same-origin`, `allow-forms` ni `allow-top-navigation`;
  - que `construirDocumentoVista(html)` incluye el estilo que oculta la barra de scroll y que el HTML del correo queda solo dentro de `<body>`.
- [X] T013 [P] [US1] Reemplazar en `src/integraciones/email/mensaje/normalizar.test.ts` el test "un correo HTML se guarda como texto legible, nunca como HTML" (≈ línea 51) por tests de la nueva regla:
  - `payload.contenido` sigue siendo texto plano idéntico al de hoy (FR-008);
  - `payload.correo.htmlLimpio` existe, no contiene `<script>` y no es igual al HTML original;
  - un correo solo texto da `estadoHtml: "SIN_HTML"`;
  - un HTML de más de 1 MB da `NO_DISPONIBLE` con texto intacto;
  - un error forzado de la limpieza (mock que lanza) da `NO_DISPONIBLE`/`ERROR_LIMPIEZA` y el correo igual se acepta.
- [X] T014 [P] [US1] Crear `src/app/api/correo/mensajes/[mensajeId]/route.test.ts`, con prisma y sesión mockeados al estilo de otros tests de rutas del repo. Casos:
  - mensaje de otro comercio da 404;
  - mensaje inexistente da 404;
  - mensaje sin `MensajeCorreo` da 200 con `cabeceras: null` y `html.estado: "SIN_HTML"`;
  - `DISPONIBLE` devuelve `urlVista` con un token verificable;
  - sin `CORREO_VISTA_SECRETO`, `urlVista: null`;
  - la respuesta nunca incluye `htmlLimpio`, `imagenesExternas`, `keyOptimizado` ni `configuracion`.
- [X] T015 [P] [US1] Crear `src/app/api/correo-aislado/vista/route.test.ts`. Casos:
  - token válido da 200 con las cabeceras de T012;
  - token alterado, vencido o de tipo `cid` da 404;
  - token válido cuyo `instanciaId` no coincide con el del mensaje en la base de datos da 404;
  - `estadoHtml != DISPONIBLE` da 404.

### Implementation for User Story 1

- [X] T016 [P] [US1] Crear `src/integraciones/email/mensaje/html/profundidad.ts` con `superaProfundidad(html, limite): boolean`. Usa el `Tokenizer`/`Parser` de `htmlparser2` (dependencia transitiva de `sanitize-html`; si no resuelve como import directo, agregar `htmlparser2` a dependencies). Lleva un contador de etiquetas abiertas y no construye el árbol. Es apto para el worker.
- [X] T017 [US1] Crear `src/integraciones/email/mensaje/html/limpiar-html.ts` con `limpiarHtmlEntrante(html)` y `prepararHtmlParaVista(htmlLimpio, opciones)` según `contracts/limpieza-html.md`:
  - **orden de `limpiarHtmlEntrante`**: tamaño de entrada, luego `superaProfundidad`, luego `sanitizeHtml(html, opcionesBase())` con `transformTags.img` que: para `http(s)`, quita `src`, asigna `data-karia-externa=N` y registra la URL (hasta 50; las demás quedan sin `src` y sin índice); para `cid:`, normaliza el cid (sin `<>`, en minúsculas) y lo registra en `cidsUsados`. Después, `transformTags.a`, que fuerza `target="_blank"` y `rel="noopener noreferrer nofollow"`. Al final, tiempo medido, tamaño de salida y chequeo de vacío (sin texto visible y sin `img`);
  - todo envuelto en `try/catch` que devuelve `ERROR_LIMPIEZA`;
  - **`prepararHtmlParaVista`** vuelve a ejecutar `sanitizeHtml` con `opcionesBase()` más `allowedAttributes` que admita `data-karia-externa`, y transforma `img` según el contrato.

  Depende de T007 y T016. Hace pasar T011.
- [X] T018 [US1] Ampliar el contrato `src/eventos/contratos/procesar-entrante.comando.ts` con `correo?: DatosCorreoEntrante`, importando el tipo de `src/integraciones/email/vista/schema.ts`. Agregar un comentario de que solo lo manda el canal email y que el consumidor lo ignora si falta. En `src/conversaciones/types.ts`, agregar `correo?: DatosCorreoEntrante` a `MensajeEntranteNormalizado`. Depende de T006.
- [X] T019 [US1] Modificar `src/integraciones/email/mensaje/normalizar.ts`:
  - en `normalizarCorreo`, llamar a `limpiarHtmlEntrante(correo.html)` cuando `typeof correo.html === "string"`, antes de `guardarAdjuntos`;
  - armar `payload.correo` (`estadoHtml`, `motivoHtml`, `htmlLimpio`, `versionPolitica`, `imagenesExternas`; `adjuntos: []` y cabeceras vacías por ahora, que completan US2 y US3);
  - si el estado es `NO_DISPONIBLE`, `console.warn('[correo] HTML no disponible', { cuentaCanalId, motivo })`, sin contenido;
  - reemplazar el comentario de `cuerpoLegible` (que decía que `correo.html` no se lee nunca) por la nueva regla: el texto sigue siendo la fuente de IA, búsqueda y lista, y el HTML solo se guarda limpio.

  Depende de T017 y T018. Hace pasar T013.
- [X] T020 [US1] Modificar `procesarMensajeEntrante` en `src/conversaciones/actions.ts`: en el `prisma.mensajeConversacion.create` del paso 7 (≈ línea 505), agregar `correo: { create: {...} }` **solo** si `canal === "email"` y `payload.correo` existe y pasa `datosCorreoEntranteSchema.safeParse`. Mapear con `instanciaId` y `fechaEnvio: new Date(...) | null`. Si el `safeParse` falla, loguear un warning y crear el mensaje sin `MensajeCorreo`: el correo nunca se pierde. No tocar las barreras de deduplicación existentes ni la otra función de creación (≈ línea 604). Depende de T005 y T018.
- [X] T021 [P] [US1] Crear `src/integraciones/email/vista/documento.ts` con:
  - `construirDocumentoVista(htmlPreparado)`: `<!doctype html>`, `meta charset` y `viewport`, y un `<style>` base de Karia con `html{scrollbar-width:none}`, `::-webkit-scrollbar{display:none}`, `body{margin:0;padding:16px;background:#fff;color:#1f2328;font:14px/1.5 system-ui,sans-serif;overflow-wrap:anywhere}`, `img{max-width:100%;height:auto}`, `table{max-width:100%}` y un estilo neutro para `img:not([src])` (caja gris clara que respeta `width`/`height`). El hex está permitido acá porque es el documento aislado, no la UI de Karia;
  - `cabecerasVista(origen)`, que devuelve el objeto de cabeceras exacto de research R7;
  - `origenPublico()`, que lee `NEXT_PUBLIC_APP_URL` (o la variable de URL pública que ya use el proyecto) sin barra final.

  Hace pasar T012.
- [X] T022 [US1] Crear la ruta con sesión `src/app/api/correo/mensajes/[mensajeId]/route.ts` (`GET`) según `contracts/rutas-http.md` §1:
  - `requireSesion()` y `obtenerMensajeCorreoParaSesion`; 404 si no existe;
  - firmar `urlVista` y `urlVistaConImagenes` (esta solo si `tieneImagenesExternas`) como `${origenPublico()}/api/correo-aislado/vista?t=...`;
  - devolver `cabeceras` (o `null` si no hay `MensajeCorreo`), `html` y `adjuntos` (vacío hasta US4);
  - cabecera `Cache-Control: private, no-store`; `export const dynamic = "force-dynamic"`.

  Depende de T008, T010 y T021. Hace pasar T014.
- [X] T023 [US1] Crear la ruta con token `src/app/api/correo-aislado/vista/route.ts` (`GET`) según `contracts/rutas-http.md` §3:
  - `verificarToken(t, "vista")` y `obtenerCorreoDeMensaje(m, i)`; exigir `DISPONIBLE`;
  - `prepararHtmlParaVista` con `urlCid` y `urlImagenExterna` firmadas con la misma `exp`. Hasta US3, `urlCid` puede devolver `null` y `urlImagenExterna` solo se usa si `img`;
  - `construirDocumentoVista` y `new Response(doc, { headers: cabecerasVista(...) })`;
  - cualquier fallo da `new Response("No encontrado", { status: 404 })`.

  Depende de T017, T021 y T010. Hace pasar T015.
- [X] T024 [US1] Modificar `src/middleware.ts`: agregar `"/api/correo-aislado"` a `RUTAS_PUBLICAS`, con un comentario equivalente al de `/api/webhooks` (se autoriza por token firmado, no por sesión).
- [X] T025 [P] [US1] Crear el hook `src/integraciones/email/components/use-correo-mensaje.ts` (`"use client"`): `useQuery({ queryKey: ["correo-mensaje", mensajeId], queryFn: fetch('/api/correo/mensajes/'+id), enabled, staleTime: 10*60*1000 })`. Tipar la respuesta con un tipo exportado `RespuestaCorreoMensaje` que refleje `contracts/rutas-http.md` §1.
- [X] T026 [US1] Crear `src/integraciones/email/components/cuerpo-correo.tsx` (`"use client"`, `data-slot="cuerpo-correo"`):
  - props: `mensajeId`, `textoPlano`, `className`;
  - usa `useCorreoMensaje`;
  - si `html.estado === "DISPONIBLE"` y hay `urlVista`, muestra un selector segmentado accesible por teclado ("Vista previa (HTML)" | "Texto plano") y por defecto la vista previa;
  - **vista previa**: hoja `bg-white` con borde `border-border` y redondeado, con `<iframe src={urlVista} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" loading="lazy" title="Contenido del correo" className="block w-full h-[min(70vh,640px)] border-0">`;
  - estados de carga (skeleton) y error (`onError` o fallo de la query: cae a texto con aviso);
  - **texto plano**: `<div className="whitespace-pre-wrap select-text ...">{textoPlano}</div>`;
  - si el estado es `NO_DISPONIBLE` o falta `urlVista`, solo texto con el aviso discreto "La vista con formato no está disponible para este correo";
  - si es `SIN_HTML` o no hay registro, solo texto, sin selector ni aviso.

  Depende de T025.
- [X] T027 [US1] Modificar `src/integraciones/email/components/hilo-correo.tsx`: dentro de `TarjetaCorreo` expandida, reemplazar el cuerpo `whitespace-pre-wrap` actual por `<CuerpoCorreo mensajeId={mensaje.id} textoPlano={mensaje.contenido ?? ""} />` **solo** para mensajes de remitente `CONTACTO` o `AGENTE`/`IA` no notas. Las notas internas y los eventos siguen igual. El texto nunca se pasa al compositor como HTML (FR-027: no tocar `composer-correo.tsx`). Depende de T026.
- [X] T028 [US1] Crear el e2e `tests/e2e/conversaciones/correo-html-seguro.spec.ts`:
  - **datos**: helper de seed por Prisma que crea en el comercio de prueba una conversación de correo con un mensaje cuyo `MensajeCorreo.htmlLimpio` es la salida de `limpiarHtmlEntrante` aplicada al HTML malicioso de quickstart §3, y un segundo comercio para la prueba cruzada;
  - **sobre el iframe**: tiene `sandbox` exactamente igual a `allow-popups allow-popups-to-escape-sandbox`;
  - **sobre la página**: `page.on('dialog')` nunca se dispara; la URL principal no cambia; ninguna `request` sale a `tracker.test` ni a `evil.test`; ninguna petición a `/api/conversaciones` sale desde el frame;
  - **cabeceras**: la respuesta de `/api/correo-aislado/vista` trae la CSP y `nosniff`;
  - **origen opaco**: `frame.evaluate(() => document.cookie)` falla o es vacío;
  - **otro comercio**: `GET /api/correo/mensajes/{id}` desde la sesión del segundo comercio da 404.

  Depende de T020–T027.

**Checkpoint**: MVP seguro. Un correo HTML se ve aislado, el malicioso no hace nada y otro comercio
recibe 404.

---

## Phase 4: User Story 2 — Cabeceras reales de cada correo (P2)

**Goal**: cada tarjeta expandida muestra De, Para, CC, fecha y asunto del propio correo, con "y N más";
las respuestas enviadas muestran De = buzón.

**Independent Test**: quickstart §6. Un correo con varios Para/CC y asunto distinto muestra exactamente
esos datos; uno viejo se ve como hoy.

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Crear `src/integraciones/email/mensaje/cabeceras.test.ts`. Casos:
  - `from` con y sin nombre;
  - `to`/`cc` con 3 direcciones;
  - 60 destinatarios: guarda 50 con `paraTotal: 60`;
  - grupos de direcciones (`group`) aplanados;
  - `date` inválida da `null`;
  - direcciones en minúsculas y recortadas.
- [X] T030 [P] [US2] Agregar a `src/integraciones/email/mensaje/normalizar.test.ts` un caso que verifique que `payload.correo.de/para/cc/asunto/fechaEnvio` salen del correo de prueba.

### Implementation for User Story 2

- [X] T031 [P] [US2] Crear `src/integraciones/email/mensaje/cabeceras.ts` (apto para el worker): `extraerCabeceras(correo: ParsedMail)` devuelve `{ de, para, paraTotal, cc, ccTotal, asunto, fechaEnvio }`. Usa `AddressObject.value` (aplanando `group`), tope de 50 por lista y `fechaEnvio` en ISO UTC o `null`. Hace pasar T029.
- [X] T032 [US2] Modificar `src/integraciones/email/mensaje/normalizar.ts` para completar `payload.correo` con `extraerCabeceras(correo)`. `payload.correo` se envía siempre para correos aceptados, aunque sea `SIN_HTML`, para que las cabeceras se guarden. Depende de T031 y T019. Hace pasar T030.
- [X] T033 [US2] Modificar `src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts`: después del `prisma.mensajeConversacion.update` exitoso (≈ línea 111) y solo si `cuentaCanal.canal === "email"`, hacer `prisma.mensajeCorreo.upsert({ where: { mensajeId }, create: {...}, update: {} })` con:
  - `instanciaId`;
  - `estadoHtml: "SIN_HTML"`, `versionPolitica: VERSION_POLITICA`;
  - `de: { nombre: cuentaCanal.nombre ?? null, direccion: cuentaCanal.identificador }`;
  - `para: [{ nombre: null, direccion: destinatario }]`, `paraTotal: 1`;
  - `asunto: contextoHilo.asunto`, `fechaEnvio: new Date()`.

  Envolverlo en `try/catch` que solo hace `console.warn` con `mensajeId`: **nunca** debe hacer fallar ni reintentar el envío (FR-030). No tocar la llamada a `provider.enviarMensaje` ni `providers/email.ts`.
- [X] T034 [P] [US2] Crear `src/integraciones/email/components/cabeceras-correo.tsx` (`data-slot="cabeceras-correo"`):
  - recibe `cabeceras` (de la respuesta de la ruta) más el respaldo actual de `hilo-correo.tsx` (contacto, dirección y buzón) para cuando `cabeceras === null`;
  - muestra filas "De", "Para", "CC" (si hay) y "Asunto" (si difiere del de la conversación o siempre; elegir siempre por claridad), más la fecha con `<FechaHora modo="fechaHora">` sobre `fechaEnvio`, con respaldo a `creadoEn` del mensaje;
  - listas largas: muestra las primeras 3 y un botón "y N más" (N = total − mostradas) que expande la lista guardada; si `total > guardadas`, agrega "(+X no mostradas)".
- [X] T035 [US2] Integrar `CabecerasCorreo` en `TarjetaCorreo` expandida de `src/integraciones/email/components/hilo-correo.tsx`, en lugar de la línea "Para:" deducida actual, reutilizando la query de `useCorreoMensaje` (misma `queryKey`, sin fetch duplicado). La cabecera colapsada no cambia. Depende de T034 y T027.

**Checkpoint**: US1 y US2 funcionan cada una por su lado.

---

## Phase 5: User Story 3 — Imágenes externas bloqueadas con carga controlada, e imágenes cid (P3)

**Goal**: las imágenes remotas no se piden al abrir; aparece el aviso y "Cargar imágenes" las trae por un
proxy con protección SSRF; las imágenes cid se ven solas.

**Independent Test**: quickstart §4.

### Tests for User Story 3 ⚠️

- [X] T036 [P] [US3] Crear `src/integraciones/email/vista/direcciones-bloqueadas.test.ts`, con todos los rangos de research R10 (IPv4, IPv6 e IPv4 mapeado como `::ffff:127.0.0.1` y `::ffff:a9fe:a9fe`). Casos negativos: `8.8.8.8`, `1.1.1.1` y `2606:4700::1` no están bloqueadas.
- [X] T037 [P] [US3] Crear `src/integraciones/email/vista/proxy-imagen.test.ts` con el **catálogo completo de 16 casos** de `contracts/proxy-imagenes.md`:
  - usar un `http.createServer` local en un puerto efímero;
  - para poder alcanzarlo, inyectar `deps.lookup` y una opción de prueba que permita el puerto y la IP de loopback **solo** en el test, por ejemplo `deps.permitirDestinoDePrueba`, que no se exporta en producción;
  - casos 2–4 con la lista real, sin esa opción;
  - DNS rebinding: un `lookup` que alterna IP pública e IP privada, y se afirma que la conexión usa la primera validada.
- [X] T038 [P] [US3] Agregar a `src/integraciones/email/mensaje/adjuntos.test.ts`:
  - una imagen con `contentId` usado en el HTML queda `enLinea: true` y no es la principal;
  - una imagen con `contentId` **no** usado se trata como adjunto normal;
  - el tope de 20 en línea es independiente del de 5;
  - con `cidsUsados` vacío (HTML no disponible) el comportamiento es idéntico al actual.
- [X] T039 [P] [US3] Crear `src/app/api/correo-aislado/cid/route.test.ts` y `src/app/api/correo-aislado/imagen/route.test.ts`. Casos:
  - token de otro tipo da 404;
  - cid fuera del mapa da 404;
  - `MediaArchivo` de otro `instanciaId` da 404;
  - índice N fuera de rango da 404;
  - rechazo del proxy da 404 sin detalle;
  - éxito da `image/webp` con `nosniff`, `no-store` y `CORP`.

### Implementation for User Story 3

- [X] T040 [P] [US3] Crear `src/integraciones/email/vista/direcciones-bloqueadas.ts` con `esDireccionBloqueada(ip)` usando `net.BlockList` y los rangos de research R10. Para IPv4 mapeado en IPv6, extraer y validar el IPv4. Una IP no parseable cuenta como bloqueada. Hace pasar T036.
- [X] T041 [US3] Crear `src/integraciones/email/vista/proxy-imagen.ts` con `descargarImagenSegura(url, deps?)` según `contracts/proxy-imagenes.md`:
  - `new URL`; esquema, puerto y credenciales;
  - `http(s).request` con `lookup` propio: `dns.lookup(host, { all: true })`, rechazo si cualquier IP está bloqueada y conexión a la primera validada. Los hosts escritos como IP pasan por `esDireccionBloqueada` directo;
  - `AbortSignal.timeout(5000)` para todo el ciclo;
  - redirecciones manuales hasta 3, revalidando todo;
  - corte de flujo a 5 MB;
  - `Content-Type` y bytes mágicos (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `GIF8`, WebP `RIFF....WEBP`);
  - `sharp(buf, { limitInputPixels: 40_000_000, animated: false }).webp().toBuffer()`;
  - cabeceras salientes solo `User-Agent` y `Accept`;
  - devuelve `{ ok:false, motivo }` sin lanzar.

  Depende de T040. Hace pasar T037.
- [X] T042 [US3] Modificar `src/integraciones/email/mensaje/adjuntos.ts`:
  - `guardarAdjuntos(adjuntos, ctx)` recibe `ctx.cidsUsados?: string[]`;
  - separa las imágenes cuyo `contentId` normalizado está en `cidsUsados` (en línea, tope `MAX_IMAGENES_EN_LINEA = 20`) del resto (tope `MAX_ADJUNTOS = 5` como hoy);
  - `AdjuntoGuardado` suma `cid: string | null`, `enLinea: boolean` y `bytes: number`;
  - los en línea no cuentan para el tope de 5 y se devuelven en `guardados` con `enLinea: true`;
  - sin `cidsUsados`, el comportamiento es byte a byte igual al actual.

  Hace pasar T038.
- [X] T043 [US3] Modificar `src/integraciones/email/mensaje/normalizar.ts`:
  - pasar `cidsUsados` a `guardarAdjuntos` solo si `estadoHtml === "DISPONIBLE"`;
  - elegir la media "principal" y la lista "Otros adjuntos" **solo entre los no en línea**;
  - llenar `payload.correo.adjuntos` con **todos** los guardados (`mediaArchivoId`, `nombre`, `mimeType`, `bytes`, `cid`, `enLinea`).

  Depende de T042 y T032.
- [X] T044 [US3] Crear la ruta con token `src/app/api/correo-aislado/cid/route.ts` según `contracts/rutas-http.md` §4: `verificarToken(t, "cid")`, `obtenerCorreoDeMensaje`, la entrada del cid en `adjuntos`, `prisma.mediaArchivo.findFirst({ where: { id, instanciaId } })` y `getStorageProvider().download(keyOptimizado)`, con respuesta `image/webp` y las cabeceras del contrato. En `src/app/api/correo-aislado/vista/route.ts`, conectar `urlCid(cid)` para firmar `/api/correo-aislado/cid?t=...` solo si el cid está en el mapa. Hace pasar la parte cid de T039.
- [X] T045 [US3] Crear la ruta con token `src/app/api/correo-aislado/imagen/route.ts` según `contracts/rutas-http.md` §5: `verificarToken(t, "imagen")`, `obtenerCorreoDeMensaje`, el índice N, `descargarImagenSegura(imagenesExternas[N])`, 404 genérico ante cualquier rechazo y `console.warn('[correo] imagen externa rechazada', { mensajeId, motivo })` sin URL. `export const runtime = "nodejs"`. En la ruta `vista`, conectar `urlImagenExterna(N)`, que firma `/api/correo-aislado/imagen?t=...` cuando el token de la vista trae `img: true`. Depende de T041. Hace pasar la parte imagen de T039.
- [X] T046 [US3] Modificar `src/integraciones/email/components/cuerpo-correo.tsx`:
  - si `html.tieneImagenesExternas` y no se cargaron, mostrar sobre la hoja un aviso discreto (`text-muted-foreground`, ícono `ImageOff` de lucide): "Este correo contiene imágenes externas que se han bloqueado por seguridad", con el botón "Cargar imágenes";
  - el botón pone en estado **local** `cargarImagenes = true`, que cambia el `src` del iframe a `urlVistaConImagenes`;
  - no se persiste en ningún lado (FR-019) y se reinicia al cambiar de conversación.

**Checkpoint**: las imágenes externas solo se cargan a pedido y por el proxy, y las cid se ven.

---

## Phase 6: User Story 4 — Lectura ampliada y adjuntos (P4)

**Goal**: el agente puede ampliar el correo a una vista grande con el mismo aislamiento, y ver y descargar
los adjuntos como tarjetas.

**Independent Test**: quickstart §2. Ampliar un correo largo y descargar un adjunto; un `.html` adjunto se
descarga y no se abre.

### Tests for User Story 4 ⚠️

- [X] T047 [P] [US4] Crear `src/app/api/correo/mensajes/[mensajeId]/adjuntos/[mediaArchivoId]/route.test.ts`. Casos:
  - otro comercio da 404;
  - `mediaArchivoId` que no está en `MensajeCorreo.adjuntos` ni es el `mediaArchivoId` del mensaje da 404;
  - éxito trae `Content-Disposition: attachment; filename*=UTF-8''...`, `Content-Type: application/octet-stream`, `nosniff` y `CSP: sandbox; default-src 'none'`, incluso para un adjunto `text/html` o `image/svg+xml`.

### Implementation for User Story 4

- [X] T048 [US4] Crear `src/app/api/correo/mensajes/[mensajeId]/adjuntos/[mediaArchivoId]/route.ts` según `contracts/rutas-http.md` §2:
  - `requireSesion()`;
  - verificar pertenencia (en `MensajeCorreo.adjuntos` o `mensaje.mediaArchivoId`) y `MediaArchivo` del mismo `instanciaId`;
  - descargar con `getStorageProvider().download(keyOriginal ?? keyOptimizado)`;
  - responder con las cabeceras forzadas;
  - nombre de archivo saneado (sin `/\\"` ni saltos de línea) y codificado con RFC 5987.

  Hace pasar T047.
- [X] T049 [US4] En `src/app/api/correo/mensajes/[mensajeId]/route.ts`, llenar `adjuntos` con las entradas **no** `enLinea` de `MensajeCorreo.adjuntos`, cada una con `urlDescarga = /api/correo/mensajes/{id}/adjuntos/{mediaArchivoId}`. Agregar el caso a T014.
- [X] T050 [P] [US4] Crear `src/integraciones/email/components/adjuntos-correo.tsx` (`data-slot="adjuntos-correo"`): tarjetas con ícono por tipo (reutilizar `etiquetaTipoArchivo` de `hilo-correo.tsx`, moviéndola a un módulo propio si hace falta, sin barrel), nombre truncado, tipo y tamaño legible (KB/MB) y un botón de descarga como `<a href={urlDescarga} download>`. En `hilo-correo.tsx`, mostrarlas en lugar de `AdjuntoCorreo` cuando la respuesta trae adjuntos. Si no trae (correo viejo), mantener `AdjuntoCorreo` actual.
- [X] T051 [P] [US4] Crear `src/integraciones/email/components/lectura-ampliada-correo.tsx`: botón "Ampliar" (ícono `Maximize2`) que abre el `Dialog` de `src/components/ui/dialog.tsx` casi a pantalla completa (`max-w-[min(1100px,95vw)] h-[90vh]`). Adentro, el **mismo** iframe con los mismos atributos `sandbox` y `referrerPolicy`, con alto completo, y el mismo estado de `cargarImagenes` que la tarjeta (se pasa como prop). Incluir título accesible con el asunto. Integrarlo en la barra de `cuerpo-correo.tsx`, junto al selector.

**Checkpoint**: las cuatro historias funcionan cada una por su lado.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T052 [P] Actualizar `CLAUDE.md` §9. Reemplazar la regla "El HTML de un correo entrante nunca se renderiza…" por: "**El HTML entrante solo se muestra limpio, en un iframe sandbox sin scripts ni mismo origen y con CSP restrictiva; nunca dentro de la página de Karia.**" Agregar:
  - `sanitize-html` al recibir, en el worker, y otra vez al servir;
  - solo se guarda el HTML limpio, en `MensajeCorreo`;
  - el texto sigue siendo la fuente de IA, búsqueda y lista;
  - flags exactos del sandbox y prohibición de `allow-scripts` y `allow-same-origin`;
  - token `CORREO_VISTA_SECRETO`;
  - proxy SSRF;
  - referencia a `specs/035-correo-html-seguro/`.
- [X] T053 [P] Agregar al final de R10 en `specs/034-canal-correo-electronico/research.md` una nota "**Reemplazado por 035 (2026-11-16)**" que resuma la nueva regla y enlace a `specs/035-correo-html-seguro/research.md` R1–R10. Actualizar también el comentario de `src/conversaciones/providers/email.ts` (≈ línea 116) que cita R10, aclarando que el **envío** sigue siendo solo texto.
- [X] T054 [P] Buscar en `docs/` (`grep -ril "html" docs | grep -i -E "correo|email"`) la documentación del canal de correo y actualizarla con la regla nueva. Si no existe ninguna, no crear un archivo nuevo: con CLAUDE.md y el spec alcanza.
- [ ] T055 Ejecutar `npx vitest run src/integraciones/email src/app/api/correo src/app/api/correo-aislado src/worker src/conversaciones` y `npm run test:e2e:conversaciones` y el nuevo e2e. Todo en verde, incluido `grafo-importaciones.test.ts`, que debe seguir verde con `limpiar-html.ts` alcanzable desde el worker.
- [X] T056 Ejecutar `npx tsc --noEmit` filtrando por los archivos de esta feature: cero errores nuevos. Ejecutar `npm run build`, que debe compilar.
- [ ] T057 **Verificación en navegador real** según quickstart.md §2–§7 (correo normal, malicioso, imágenes externas, otro comercio, cabeceras y no regresión). Anotar el resultado de cada punto (navegador y versión) en una sección "Verificación" al final de `specs/035-correo-html-seguro/quickstart.md`.
- [X] T058 Revisión final de seguridad sobre el diff (`/security-review`):
  - confirmar que `grep -rn "dangerouslySetInnerHTML\|srcdoc\|allow-scripts\|allow-same-origin" src/integraciones/email src/app/api/correo*` devuelve cero resultados;
  - ningún `console.*` nuevo imprime HTML, URLs externas ni contenido;
  - todas las rutas nuevas filtran por `instanciaId`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (F1)**: sin dependencias.
- **Foundational (F2)**: depende de F1 y **bloquea** todas las historias.
- **US1 (F3)**: depende de F2. Es el MVP.
- **US2 (F4)**: depende de F2. En código toca `normalizar.ts` y `hilo-correo.tsx` después de US1 (T032 tras T019, T035 tras T027). Se puede probar sola: las cabeceras se ven aunque no haya HTML.
- **US3 (F5)**: depende de US1 (ruta `vista`, `cuerpo-correo.tsx`). T043 va después de T032.
- **US4 (F6)**: depende de US1 (ruta con sesión, `cuerpo-correo.tsx`). Para la lista completa de adjuntos usa los datos de T043; sin US3, muestra la lista vacía y conserva `AdjuntoCorreo`.
- **Polish (F7)**: al final.

### Within Each User Story

Primero las pruebas, que deben fallar. Después las utilidades puras y los módulos del worker, luego las
rutas y al final la UI. El e2e cierra la historia.

### Parallel Opportunities

- F1: T002 y T003 en paralelo.
- F2: T006, T007, T008 y T009 en paralelo. T004, T005 y T010 van en serie.
- US1: las pruebas T011–T015 en paralelo. T016 y T021 en paralelo con T017 y T018. T025 en paralelo con las rutas.
- US2: T029, T030, T031 y T034 en paralelo.
- US3: las pruebas T036–T039 en paralelo. T040 en paralelo con T042.
- US4: T047, T050 y T051 en paralelo.
- F7: T052, T053 y T054 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Pruebas primero, todas en paralelo:
Task: "T011 catálogo de limpieza en src/integraciones/email/mensaje/html/limpiar-html.test.ts"
Task: "T012 cabeceras y documento en src/integraciones/email/vista/documento.test.ts"
Task: "T013 nueva regla en src/integraciones/email/mensaje/normalizar.test.ts"
Task: "T014 ruta con sesión en src/app/api/correo/mensajes/[mensajeId]/route.test.ts"
Task: "T015 ruta con token en src/app/api/correo-aislado/vista/route.test.ts"

# Después, utilidades independientes en paralelo:
Task: "T016 pre-chequeo de profundidad en src/integraciones/email/mensaje/html/profundidad.ts"
Task: "T021 documento y cabeceras en src/integraciones/email/vista/documento.ts"
Task: "T025 hook useCorreoMensaje en src/integraciones/email/components/use-correo-mensaje.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T036 rangos bloqueados en src/integraciones/email/vista/direcciones-bloqueadas.test.ts"
Task: "T037 catálogo SSRF en src/integraciones/email/vista/proxy-imagen.test.ts"
Task: "T038 clasificación cid en src/integraciones/email/mensaje/adjuntos.test.ts"
Task: "T039 rutas cid e imagen en src/app/api/correo-aislado/{cid,imagen}/route.test.ts"
```

---

## Implementation Strategy

### MVP First (solo User Story 1)

1. F1 Setup, luego F2 Foundational.
2. F3 US1, cerrada con T028 (e2e malicioso).
3. **Validar**: quickstart §2, §3 y §5 en un navegador real.
4. A partir de acá ya se puede desplegar. Las imágenes externas quedan bloqueadas sin opción de cargarlas, y las cid se ven como espacio neutro.

### Incremental Delivery

1. MVP (US1): correo HTML seguro.
2. US2: cabeceras reales.
3. US3: imágenes cid y carga controlada de externas.
4. US4: lectura ampliada y adjuntos.
5. F7: documentación, regresión, navegador real y revisión de seguridad.

Cada incremento se valida con su sección de quickstart antes de seguir.

---

## Notes

- Si una tarea requiere relajar el sandbox, la CSP o la política de limpieza para que un correo "se vea
  mejor", **no se hace**: se anota como mejora futura en research.md (FR-012).
- Commit por tarea o por grupo lógico, en la rama `feature/035-correo-html-seguro`.

---

## Notas de implementación (2026-11-16)

- **T002**: el repo no tiene `.env.example`; `CORREO_VISTA_SECRETO` se documentó en el bloque de variables de
  `README.md`, donde están las demás.
- **T016**: `htmlparser2@^12` se agregó como dependencia directa (misma versión que usa `sanitize-html`), en
  vez de depender de una transitiva.
- **T019/T020**: además de lo previsto, `procesar-entrante.suscriptor.ts` copia el payload campo por campo;
  se le agregó `correo` (sin eso los datos se perdían en silencio). Se creó
  `mensaje/persistir-correo.ts` (validación Zod + mapeo a la fila).
- **T022**: la respuesta se arma en `vista/respuesta.ts` (puro, probado por la ruta). Sin sesión responde 404
  (`obtenerSesionActual`), no redirige.
- **T048**: `nombreDescarga`/`contentDispositionAdjunto` viven en `vista/descarga.ts`: Next no admite
  exports extra en un `route.ts`.
- **T051**: la lectura ampliada quedó dentro de `cuerpo-correo.tsx` (Dialog con el mismo iframe y el mismo
  estado de imágenes), no en un archivo aparte.
- **T054**: no hay documentación del canal en `docs/` además de CLAUDE.md y los specs; no se creó ninguna.
- **T028**: el e2e está escrito pero **no se ejecutó**: requiere aplicar la migración a una base y levantar
  la app con `CORREO_VISTA_SECRETO`. Queda para T055/T057.
- Observación previa a 035 (no corregida, fuera de alcance): `procesar-entrante.suscriptor.ts` no pasa
  `mediaArchivoId`, así que el adjunto principal de un correo no queda vinculado por FK en
  `MensajeConversacion.mediaArchivoId`. Las descargas de 035 usan `MensajeCorreo.adjuntos`, que sí lo tiene.
- Observación previa a 035: un correo HTML-only de ~1 MB tarda ~5 s en `limpiarCita` (recorte de cita sobre
  el texto), independiente de la limpieza de HTML, que corta antes por tamaño.
