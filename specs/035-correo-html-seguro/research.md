# Research: Vista segura de correos HTML en el Inbox

**Feature**: 035-correo-html-seguro | **Fecha**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

Cada decisión se tomó leyendo el código actual: `normalizar.ts`, `adjuntos.ts`, `polling.ts`,
`procesarMensajeEntrante` en `conversaciones/actions.ts`, `enviar-mensaje.suscriptor.ts`,
`providers/email.ts`, `lib/media/types.ts`, `middleware.ts` y `worker/grafo-importaciones.test.ts`.

---

## R1 — Biblioteca de limpieza: `sanitize-html`

**Decision**: usar `sanitize-html` (2.x), que parsea con `htmlparser2`, sin DOM. Se usa con una política
de lista blanca propia de Karia, definida en un único módulo (`politica.ts`).

**Rationale**:
- **Corre en el worker.** Usa Node puro, sin `jsdom` ni `server-only`, así que pasa
  `grafo-importaciones.test.ts`. Ese test existe porque un import incompatible ya tumbó el worker en
  producción.
- **Es una lista blanca real.** Permite declarar `allowedTags`, `allowedAttributes`, `allowedSchemes`,
  `allowedSchemesByTag`, `allowedStyles` (validación por propiedad CSS) y `transformTags`.
- **Limita el anidamiento.** `nestingLimit` corta el árbol a una profundidad máxima sin perder el texto.
- **Usa un parser real, no regex** (FR-002). Las sorpresas de HTML malformado las resuelve `htmlparser2`,
  que es tolerante.
- Tiene mantenimiento activo, millones de descargas semanales y un historial de CVEs corregidos rápido.

**Alternatives considered**:
- **DOMPurify + jsdom**: es el estándar en el navegador, pero en el servidor exige `jsdom`. Es pesado y
  arrastra muchas dependencias al worker. Se descarta.
- **DOMPurify en el cliente**: implicaría guardar el HTML original y meterlo en el DOM de Karia, lo que
  viola FR-001 y FR-013. Se descarta.
- **Limpieza propia con regex**: prohibida por FR-002 y por el pedido original.
- **`xss` (js-xss)**: válida, pero su API de estilos es más pobre y no tiene `nestingLimit`. Pierde frente a
  `sanitize-html`.

**Dependencias nuevas**: `sanitize-html` y `@types/sanitize-html` (dev). No hay infraestructura nueva.

---

## R2 — Política de limpieza (lista blanca)

**Decision**: la política se versiona con una constante `VERSION_POLITICA = 1`, que se guarda junto a cada
correo. Lo permitido:

| Grupo | Detalle |
|---|---|
| Estructura y texto | `p br hr div span blockquote pre code h1–h6 b strong i em u s small sub sup center font` |
| Listas | `ul ol li dl dt dd` |
| Tablas | `table thead tbody tfoot tr th td caption colgroup col` |
| Enlaces | `a[href]` solo con `http`, `https` o `mailto`. Siempre `target="_blank" rel="noopener noreferrer nofollow"` |
| Imágenes | `img`. `src` solo `cid:` (se reescribe a ruta firmada) o `http/https` (se bloquea, ver R6). Atributos `alt width height` |
| Atributos de presentación | `align valign width height bgcolor color border cellpadding cellspacing colspan rowspan dir lang title face size` |
| Estilos en línea | Solo propiedades de la lista, cada una con su regex de valor: color, fondo de color, tipografía, alineación, márgenes, rellenos, bordes, ancho y alto, `display` (sin `fixed`), `vertical-align`, `white-space`, `line-height`, `border-collapse`, `list-style-type`. Cualquier valor con `url(`, `expression(`, `@import`, `\` o `javascript:` se rechaza |

Todo lo demás se **descarta**, por ejemplo: `script style link meta base title head iframe frame frameset
object embed applet form input button select textarea option svg math video audio source track canvas
template noscript` y cualquier atributo `on*`, `id`, `class`, `name` o `srcset`.

`allowProtocolRelative: false`. `allowVulnerableTags: false`. `disallowedTagsMode: "discard"`.
`nestingLimit: 64`.

**Por qué no se aceptan bloques `<style>`**: `sanitize-html` limpia atributos de estilo, pero no el contenido
de un `<style>`. Ese contenido podría traer selectores que imitan la interfaz, `@import`, `url()` o
`position: fixed`. La CSP ya bloquea la carga de recursos, pero no la suplantación visual dentro del
recuadro. El correo comercial pensado para Gmail usa estilos en línea, así que esta versión los descarta.
Ampliar a bloques `<style>` limpiados con `postcss` (que `sanitize-html` ya trae) queda anotado como mejora
posterior. **No es una relajación**: exigiría una política propia y sus propias pruebas.

**Por qué `position` no está en la lista**: con `fixed`, `absolute` o `sticky` un correo podría superponer
contenido dentro del recuadro (spec, edge case "Estilos que intentan salir del recuadro"). Sin `position`
no hay superposición. Con el sandbox, además, nada puede salir del recuadro.

**Rationale**: es el formato que un correo comercial usa de verdad (tablas, colores, tipografía en línea,
imágenes) y nada que pueda ejecutar código, cargar recursos o salir del recuadro.

---

## R3 — Límites de limpieza (FR-007)

**Decision**:

| Límite | Valor | Si se supera |
|---|---|---|
| HTML de entrada | 1 MB (bytes UTF-8) | `NO_DISPONIBLE`, motivo `DEMASIADO_GRANDE`. No se intenta limpiar |
| Profundidad | `nestingLimit: 64` | Las etiquetas más profundas se descartan y se conserva su texto. No es fallo |
| Profundidad real (pre-chequeo) | > 2 000 niveles abiertos | `NO_DISPONIBLE`, motivo `DEMASIADO_ANIDADO` |
| Tiempo de limpieza | 2 s medidos | Si se excede, el resultado se descarta: `NO_DISPONIBLE`, motivo `TIEMPO_EXCEDIDO` |
| HTML limpio guardado | 512 KB | `NO_DISPONIBLE`, motivo `DEMASIADO_GRANDE` |
| Imágenes remotas por correo | 50 | Las que pasan del tope quedan bloqueadas y no se pueden cargar |

El pre-chequeo de profundidad recorre el HTML con el tokenizer de `htmlparser2`, la misma dependencia de
`sanitize-html`. Lleva un contador, no construye un árbol y es lineal.

**Sobre el tiempo**: `sanitize-html` es síncrono, así que no se puede interrumpir a mitad de trabajo. El
límite real lo pone el tope de 1 MB de entrada: el parseo es lineal, y 1 MB se procesa en decenas de
milisegundos. La medición de 2 s es una red de seguridad que descarta resultados anómalos, no un
interruptor. Así se cumple SC-004 (≤ 5 s por correo) sin hilos de trabajo.

**Alternatives considered**: limpiar en un `worker_thread` con tiempo de corte duro. Se descarta por ahora:
agrega complejidad operativa y el tope de entrada ya acota el peor caso. Queda en riesgos (plan.md).

---

## R4 — Dónde y cuándo se limpia, y cómo llega a la base de datos

**Decision**:
1. En el **worker**, `normalizarCorreo` limpia `correo.html` con el módulo `limpiar-html.ts` antes de
   guardar adjuntos. Así sabe qué `cid:` usa el cuerpo.
2. El resultado viaja en el comando `ProcesarEntrante` dentro de un campo nuevo y **opcional**,
   `correo?: DatosCorreoEntrante`. Los demás canales no lo mandan.
3. `procesarMensajeEntrante` crea el `MensajeCorreo` **anidado en el mismo `create`** del
   `MensajeConversacion`, en una sola sentencia atómica.

**Rationale**:
- El `MensajeConversacion` no existe hasta que el suscriptor resuelve contacto y conversación. Guardar
  antes obligaría a una tabla temporal o a un id provisional.
- **Deduplicación gratis (FR-011)**: `procesarMensajeEntrante` ya corta antes del `create` si existe un
  mensaje con el mismo `idExterno`. Al ir anidado, un reproceso nunca crea un segundo `MensajeCorreo`.
  Además, `mensajeId` es `@unique`.
- **Solo viaja HTML limpio**: el original nunca sale del proceso del worker, ni a RabbitMQ ni a la base de
  datos (FR-001).
- **Tamaño del mensaje en RabbitMQ**: el tope de 512 KB del HTML limpio deja el mensaje muy por debajo del
  máximo de RabbitMQ.

**Alternatives considered**:
- Guardar el HTML original y limpiar al servir: viola FR-001.
- Guardar desde el worker y vincular después por `idExterno`: dos escrituras, una ventana de carrera y una
  tabla huérfana si el suscriptor descarta el correo.

---

## R5 — Aislamiento en el navegador: iframe sin scripts ni mismo origen

**Decision**: el cuerpo se muestra en un `<iframe>` cuyo `src` es una ruta de Karia que devuelve un
documento HTML completo. Atributos del iframe:

```text
sandbox="allow-popups allow-popups-to-escape-sandbox"   ← decidido en R5.1
referrerpolicy="no-referrer"
loading="lazy"
title="Contenido del correo"
```

No se usan **nunca** `allow-scripts`, `allow-same-origin`, `allow-forms`, `allow-top-navigation*`,
`allow-modals` ni `allow-downloads`. El documento servido repite la restricción por su cuenta: la CSP
incluye la directiva `sandbox` (R7). Así la protección se mantiene aunque alguien abra la URL fuera del
iframe.

No se usa `srcdoc`, porque metería el HTML en el DOM de la página de Karia como atributo y violaría FR-013.

### R5.1 — Enlaces: conflicto entre FR-005 y "sin popups" — **decidido: opción A (2026-11-16)**

Con `sandbox=""` puro, un clic en un enlace `target="_blank"` **no hace nada**: el navegador bloquea la
ventana nueva. Sin `target`, el enlace navegaría **dentro** del recuadro y mostraría un sitio externo en el
Inbox de Karia, que es justo el riesgo de suplantación visual. No existe una tercera vía sin scripts.

**Decision (confirmada por el negocio)**: `sandbox="allow-popups allow-popups-to-escape-sandbox"`, y
**ningún otro flag**.
- Se puede abrir una pestaña nueva **solo por un clic del agente en un enlace**. Sin scripts no hay
  ventanas abiertas por código.
- `rel="noopener noreferrer"` deja al destino sin acceso a Karia y sin saber de dónde viene el clic.
- `escape-sandbox` hace que el sitio de destino funcione normal en su pestaña, que no tiene relación con
  Karia.
- Se mantienen bloqueados scripts, mismo origen, formularios, navegación de la ventana principal, diálogos
  y descargas.

FR-012 se actualizó en consecuencia: "sin ventanas emergentes **abiertas por el contenido**". Solo se
permite una pestaña nueva por un clic del agente en un enlace.

**Alternatives considered:**
- **`sandbox=""` puro** con los enlaces listados fuera del recuadro: más incómodo para el agente y sin
  ganancia real de seguridad, porque un enlace tampoco ejecuta nada.
- **Renderizar el HTML limpio como árbol React** en la página (sin iframe): mejor lectura, con alto
  natural y sin scroll interno, pero una falla de la limpieza llegaría al origen de Karia. Se descarta.
- **Insertar el HTML limpio en la página**, como hacen Gmail y Outlook Web: mismo motivo, y además viola
  FR-013. Se descarta.
- **Captura del correo como imagen**: exige un navegador en el servidor y no permite leer ni copiar como
  texto. Se descarta.

**Mejora futura**: cuando exista un dominio separado para la vista, se puede permitir solo un script de
Karia (con nonce) que informe el alto del documento por `postMessage`, para lograr alto automático. Queda
fuera de esta feature.

---

## R6 — Imágenes remotas bloqueadas por defecto

**Decision**: al limpiar, cada `<img src="http(s)://…">`:
- pierde su `src`;
- recibe `data-karia-externa="N"`, donde N es la posición en la lista `imagenesExternas` del correo;
- recibe un estilo neutro de reserva que respeta `width` y `height`.

Al servir el documento **sin** permiso de imágenes, el `img` queda sin `src`: el navegador no hace ninguna
petición y la CSP la bloquearía igual. **Con** permiso, el `src` pasa a ser la ruta firmada del proxy para
la imagen N. La URL externa nunca llega al navegador.

`srcset`, `background` y los `url()` en estilos no se aceptan (R2), así que no hay otras vías de carga. Un
píxel de rastreo es una imagen remota más: queda bloqueado.

**Rationale**: FR-006, FR-017 y FR-018 ("solo direcciones que figuren en ese correo"). El índice ata cada
petición del proxy a una URL que el correo traía; el navegador no puede pedir una dirección arbitraria.

---

## R7 — Documento servido, CSP y cabeceras

**Decision**: la ruta de vista entrega un documento HTML que arma Karia:

```text
<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>/* base de Karia: hoja clara, sin barra de scroll, img max-width:100% */</style>
</head><body>{HTML limpio, vuelto a limpiar al servir}</body></html>
```

Cabeceras:

| Cabecera | Valor |
|---|---|
| `Content-Type` | `text/html; charset=utf-8` |
| `Content-Security-Policy` | `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: {ORIGEN}/api/correo-aislado/; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-popups allow-popups-to-escape-sandbox` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Cache-Control` | `private, no-store` |
| `X-Frame-Options` | `SAMEORIGIN` (para navegadores viejos sin `frame-ancestors`) |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()` |

`{ORIGEN}` es el origen público de la app (`NEXT_PUBLIC_APP_URL` o equivalente ya configurado). Se escribe
explícito y con ruta, y no como `'self'`, porque en un documento con sandbox de origen opaco `'self'` es
ambiguo entre navegadores.

**El estilo base oculta la barra de scroll** (FR-022) y deja el desplazamiento funcional:
`html{scrollbar-width:none}` y `::-webkit-scrollbar{display:none}`. Es CSS de Karia, no del correo.

**Se vuelve a limpiar al servir.** Antes de entregarlo, el HTML guardado se pasa otra vez por la misma
política, con un `transformTags` que resuelve `cid:` e imágenes externas a rutas firmadas (R8). Es barato
(≤ 512 KB) y protege en profundidad: un HTML guardado con una política vieja o alterado en la base de datos
sale igual de limpio. Y la reescritura de URLs la hace el parser, no una sustitución de texto.

---

## R8 — Autenticación de la vista y de sus imágenes: token firmado de vida corta

**Hallazgo que fuerza la decisión**: un documento con sandbox sin `allow-same-origin` tiene origen opaco.
Las peticiones de imágenes que salen de él cuentan como **cross-site** para las cookies `SameSite=Lax` de la
sesión, así que esas imágenes llegan **sin sesión**. Una ruta de imágenes que dependa de la cookie
devolvería 404 siempre.

**Decision**: dos niveles.
1. **Con sesión** (cookie, desde la página de Karia):
   `GET /api/correo/mensajes/[mensajeId]`. Valida la sesión y que el mensaje sea de
   `sesion.instanciaId`. Devuelve cabeceras, estado del HTML, adjuntos y dos URLs firmadas
   (`urlVista`, `urlVistaConImagenes`).
2. **Con token** (sin cookie): `/api/correo-aislado/vista`, `/api/correo-aislado/cid` y
   `/api/correo-aislado/imagen`. Cada una exige un token HMAC-SHA256 en la query.
   - El token incluye `{ v, tipo, mensajeId, instanciaId, recurso, imagenes, exp }`.
   - Vida: 15 minutos para la vista. Las URLs de imágenes que la vista emite tienen la misma expiración
     que el token de la vista.
   - El token de `vista` no sirve para `cid` ni para `imagen`, y al revés tampoco.
   - Comparación en tiempo constante (`timingSafeEqual`).
   - Aunque el token sea válido, la ruta **vuelve a consultar** que el mensaje exista con ese
     `instanciaId`. Si no, 404 (FR-015).

**Secreto**: variable de entorno nueva, `CORREO_VISTA_SECRETO` (≥ 32 bytes aleatorios). Sin ella, el
sistema **falla cerrado**: las rutas devuelven 404 y la tarjeta muestra el texto con "vista con formato no
disponible". No se reutiliza `AUTH_SECRET`, para que rotar uno no invalide el otro.

**Middleware**: se agrega `/api/correo-aislado` a `RUTAS_PUBLICAS`. Su autorización es el token, igual que
`/api/webhooks` se autoriza con su firma.

**Rationale**: el mismo diseño sirve el día que la vista se mueva a un dominio registrable distinto (spec,
supuesto "Mismo dominio por ahora"). Solo cambia `{ORIGEN}`, y no hay cookies que compartir.

**Alternatives considered**:
- Cookie `SameSite=None` para la vista: debilita la sesión de toda la app. Se descarta.
- Imágenes cid como `data:` dentro del documento: infla el documento y la memoria. Solo sería viable para
  correos chicos. Se descarta para mantener un solo camino.

---

## R9 — Imágenes incrustadas (cid) y adjuntos

**Decision**:
- **Clasificación.** En `guardarAdjuntos`, un adjunto es **en línea** si su `contentId` aparece como `cid:`
  en el HTML limpio y es una imagen. Los adjuntos en línea:
  - tienen su propio tope: 20 por correo, de 10 MB cada uno. Los boletines traen más de 5 logos;
  - **no** se usan como adjunto "principal" del mensaje, para que el logo de una firma no aparezca como
    imagen del mensaje;
  - **no** se agregan a la lista "Otros adjuntos" del texto.
- **Si el HTML no quedó disponible**, todos los adjuntos se tratan como hoy. Así no se pierde nada visible.
- **Mapa cid → MediaArchivo.** Se guarda en `MensajeCorreo.adjuntos` con su `cid`.
- **Servir una imagen cid.** `/api/correo-aislado/cid?t=…` toma el `keyOptimizado` (webp) del
  `MediaArchivo` con `download()` del proveedor de storage, que ya existe. Verifica que el `MediaArchivo`
  pertenezca al mismo `instanciaId` **y** que figure en el mapa de ese correo.
- **Descargas.** `GET /api/correo/mensajes/[id]/adjuntos/[mediaArchivoId]` usa la sesión, porque se pide
  desde la página de Karia. Responde con `Content-Disposition: attachment`, `nosniff` y `CSP: sandbox`, así
  que un HTML o SVG adjunto nunca se abre dentro de Karia (FR-025).

**Comportamiento actual que se conserva**: el adjunto "principal" sigue viajando en los campos de media del
mensaje. El Inbox, la IA y la vista de lista no cambian (FR-008).

---

## R10 — Proxy de imágenes externas con protección SSRF

**Decision**: `GET /api/correo-aislado/imagen?t=…` resuelve el índice N a la URL guardada en
`MensajeCorreo.imagenesExternas[N]` y la descarga con `node:http`/`node:https`:

1. **Esquema y puerto.** Solo `http:` y `https:`, en los puertos 80 y 443. Sin credenciales en la URL.
2. **DNS validado y fijado.** La opción `lookup` de la petición usa `dns.lookup({ all: true })` y rechaza
   si **cualquiera** de las direcciones resueltas está bloqueada. La conexión va a la dirección validada,
   no a una segunda resolución, lo que impide el DNS rebinding. Los hosts escritos como IP pasan por la
   misma validación.
3. **Lista de bloqueo con `net.BlockList`** (Node nativo, sin dependencia):
   - IPv4: `0/8 10/8 100.64/10 127/8 169.254/16 172.16/12 192.0.0/24 192.0.2/24 192.88.99/24
     192.168/16 198.18/15 198.51.100/24 203.0.113/24 224/4 240/4`.
   - IPv6: `::/128 ::1/128 ::ffff:0:0/96` (se revalida el IPv4 mapeado), `64:ff9b::/96 100::/64
     2001:db8::/32 fc00::/7 fe80::/10 ff00::/8`.
   - Esto cubre loopback, redes privadas, enlace local y la IP de metadatos de nube (`169.254.169.254`,
     `fd00:ec2::254`).
4. **Redirecciones manuales**, máximo 3. Cada `Location` vuelve al paso 1.
5. **Límites.** Tiempo total de 5 s (conexión más cuerpo). Cuerpo de 5 MB como máximo, y se corta el flujo
   al pasarse. `Content-Length` declarado por encima del tope se rechaza sin leer.
6. **Tipo.** El `Content-Type` debe ser `image/png`, `image/jpeg`, `image/gif` o `image/webp`. Además se
   verifican los bytes mágicos. SVG queda rechazado siempre.
7. **Re-codificación con `sharp`** (ya instalado) a webp, con `limitInputPixels`. Elimina metadatos y
   neutraliza archivos políglotas. Lo que se entrega al navegador es una imagen generada por Karia.
8. **Cabeceras de salida.** No se reenvía nada del agente: ni cookies, ni `Authorization`, ni `Referer`,
   ni la IP. `User-Agent` fijo, `Accept: image/*`.
9. **Respuesta.** `Content-Type: image/webp`, `nosniff`, `Cache-Control: private, no-store`,
   `Cross-Origin-Resource-Policy: same-origin`. Cualquier fallo devuelve **404 sin detalle**, y el motivo
   va solo al log técnico, sin la URL completa.

**Rationale**: FR-018 punto por punto. Todo con módulos nativos y `sharp`, sin dependencias nuevas.

**Alternatives considered**:
- `fetch` global (undici): fijar el DNS exige `undici.Agent` con `connect.lookup`, y `undici` no es
  dependencia directa del proyecto.
- Un servicio de proxy aparte (camo, imgproxy): infraestructura nueva sin justificación por ahora.

---

## R11 — Cabeceras por mensaje (US2)

**Decision**:
- **Entrantes.** De `mailparser` se toman `from.value[0]`, `to.value[]`, `cc.value[]`, `date` y `subject`.
  Se guardan como `{ nombre, direccion }`, con un tope de 50 direcciones por lista y el total real aparte,
  para el "y N más".
- **Salientes.** En `enviar-mensaje.suscriptor.ts`, tras un envío de correo exitoso, se hace un `upsert`
  de `MensajeCorreo` con De = buzón, Para = destinatario y el asunto con que salió. Va en un
  `try/catch` que solo loguea: **un fallo al guardar cabeceras nunca marca el envío como fallido**
  (FR-030).
- **Correos previos sin `MensajeCorreo`.** La UI conserva la deducción actual (FR-024, FR-029).

---

## R12 — Interfaz: alto fijo, scroll invisible y lectura ampliada

**Decision**:
- **Alto.** El recuadro tiene alto acotado (`min(70vh, 640px)`) y desplazamiento interno. Sin
  `allow-same-origin` el padre no puede medir el alto del documento; el auto-alto exigiría `postMessage`
  desde un script dentro del iframe, y eso no se permite.
- **Barra de scroll.** Se oculta con el estilo base del documento servido (R7). El hilo y el compositor ya
  la ocultan con `.inbox-scroll`.
- **Hoja.** Fondo blanco, borde `border-border` y esquinas redondeadas. Los correos se diseñan para fondo
  claro.
- **Selector.** "Vista previa (HTML) | Texto plano" por mensaje, en estado local. "Vista previa" es el
  valor por defecto.
- **Ampliar.** `Dialog` de shadcn casi a pantalla completa, con el mismo iframe, los mismos atributos y
  una URL firmada propia.
- **Imágenes.** El aviso de imágenes bloqueadas cambia el `src` del iframe a `urlVistaConImagenes`.
  Aplica solo a ese mensaje y no se guarda (FR-019).
- **Datos.** Se piden con TanStack Query al expandir la tarjeta:
  `useQuery(["correo-mensaje", mensajeId])`, con `staleTime` de 10 min, menor que la vida del token.
  **No se toca la consulta compartida de mensajes** que usan los demás canales (FR-028).
