# Research: Canal de correo electrónico

**Feature**: 034-canal-correo-electronico | **Fecha**: 2026-11-15

Decisiones técnicas tomadas antes de implementar. Cada una con qué se eligió, por qué, y qué se descartó.
Las versiones y licencias de las librerías se verificaron contra el registro de npm el 2026-11-15.

---

## R1 — Librerías de IMAP, MIME y SMTP

**Decision**: `imapflow@2.12` (lectura IMAP), `mailparser@3.14` (parseo MIME), `nodemailer@10.6` (envío
SMTP), `email-reply-parser@3.0` (recorte del hilo citado).

| Paquete | Versión | Licencia | Node | Tipos propios |
|---|---|---|---|---|
| `imapflow` | 2.12.1 | MIT | ≥ 20 | Sí (`dist/cjs/imap-flow.d.ts`) |
| `mailparser` | 3.14.4 | MIT | ≥ 20 | Sí |
| `nodemailer` | **7.0.13** (ver nota) | MIT-0 | ≥ 6 | No → `@types/nodemailer` |
| `email-reply-parser` | 3.0.0 | MIT | — | Sí |

**Rationale**:
- Karia **no tiene ninguna** de estas capacidades hoy. El `resend` que ya está en `package.json` envía
  correo transaccional por HTTP con la cuenta de Karia: no habla SMTP contra el servidor del comercio y no
  puede leer una casilla. No hay duplicación de capacidad, que es lo que la constitución prohíbe.
- Las cuatro exigen Node ≥ 20 (el proyecto ya lo requiere), publican ESM y CJS, y **traen sus propios
  tipos**: no hace falta ningún paquete `@types/*`.
- `imapflow`, `mailparser` y `nodemailer` se publicaron por última vez el mismo día de esta investigación —
  están vivas, no congeladas.
- Licencias permisivas sin obligación de atribución problemática (MIT / MIT-0).

**Alternatives considered**:
- **`imap` / `imap-simple`**: sin publicar desde 2022, API basada en callbacks, sin tipos. Descartadas por
  abandono.
- **`emailjs-imap-client`**: pensada para navegador sobre WebSockets; usarla en el servidor obliga a un
  puente innecesario.
- **Implementar IMAP y MIME a mano**: RFC 3501 más RFC 2045-2049 es una superficie enorme (codificaciones
  `quoted-printable`/`base64`, `BODYSTRUCTURE`, UTF-7 modificado para nombres de carpeta, folding de
  cabeceras). Reinventarlo mal cuesta más que la dependencia.
- **`talon` / `node-email-reply-parser`** para el recorte de cita: ambas sin publicar desde 2022.
  `email-reply-parser@3.0` es el port mantenido del parser de GitHub y se publicó hace días.

> **Corregido al instalar (2026-11-16)**: nodemailer queda en **7.0.13**, no en 10.6. `next-auth@5.0.0-beta.31`
> declara `peerOptional nodemailer@^7.0.7` y la 10.6 hace fallar la resolución de npm (ERESOLVE). La API de
> SMTP que usa esta feature —`createTransport`, `verify`, `sendMail`— es idéntica en las dos líneas. La 7.0
> no publica tipos propios, así que se agrega `@types/nodemailer@^8` como devDependency. `mailparser` sigue
> trayendo su propia copia anidada de nodemailer 10.6, sin conflicto (`npm ls nodemailer` lo confirma).

**Riesgo aceptado**: las tres primeras las mantiene el mismo autor (el ecosistema Nodemailer). Es una
concentración real. Se mitiga manteniéndolas detrás de `src/integraciones/email/imap/cliente.ts` y del
`EmailProvider`: ningún tipo ni código de error de esas librerías cruza el límite del módulo, así que
reemplazarlas es un cambio local (principio IV de la constitución).

---

## R2 — Estrategia de lectura del buzón

**Decision**: sondeo (*polling*) desde el **worker**, cada 60 segundos, un ciclo propio independiente del
ciclo de 10 s de `ejecutarJobsPendientes`. Por cada buzón activo: tomar un **lock de aplicación de
PostgreSQL** (`pg_try_advisory_lock` sobre un hash del id del buzón), conectar, seleccionar `INBOX`, pedir
los mensajes con `UID > última marca`, procesarlos en orden y recién entonces persistir la marca nueva.

**Rationale**:
- SC-003 exige menos de 2 minutos; 60 s deja margen de sobra sin presionar los servidores de correo.
- El polling tolera reinicios y cortes de red sin estado en memoria: la marca vive en la base.
- El lock evita el único escenario de duplicación real: dos réplicas del worker leyendo la misma casilla.
  El proyecto ya usa SQL crudo para serializar (`SELECT 1 … FOR UPDATE` en `procesarMensajeEntrante`), así
  que no introduce una técnica ajena.
- Ciclo propio y no dentro del `while` de `disparadores.ts` porque un servidor IMAP lento no debe retrasar
  los disparadores de pipeline ni los timers de Workflows. Se arranca igual que `reconectarSesionesWA`.
- **Solo en el worker**: si la app Next.js también leyera, cada réplica de la app duplicaría la lectura.

**Alternatives considered**:
- **IMAP IDLE** (notificación push del servidor): entrega en segundos, pero exige una conexión viva por
  buzón, reconexión con backoff, y renovar el IDLE cada ~29 minutos. Es el mismo problema operativo que ya
  da WhatsApp Lite con sus sockets. Para un canal cuya expectativa de respuesta se mide en minutos, no paga
  su costo. Queda anotado como evolución posible si algún cliente lo pide.
- **Webhook del proveedor** (Gmail push, Microsoft Graph): obliga a autorización delegada por proveedor, que
  el spec excluye explícitamente.
- **`UNSEEN` en vez de marca por UID**: marcar como leído es un efecto visible en la casilla del comercio, y
  si alguien lee el correo desde su cliente, Karia se lo pierde. Descartado.

---

## R3 — Marca de posición e idempotencia

**Decision**: por buzón se guarda `uidValidity` y `ultimoUid`. Al **activar** el buzón se ancla la marca en
el UID más alto que exista en ese momento (FR-023: no se importa el historial). En cada ciclo se piden solo
los UID mayores a la marca. Si `uidValidity` cambió, se vuelve a anclar al UID más alto actual y se registra
el evento, sin reimportar la casilla.

La deduplicación final la hace la capa que ya existe: `procesarMensajeEntrante` descarta un mensaje cuyo
`idExterno` ya está en la conversación. Para correo, `idExterno` es el `Message-ID` normalizado; si el correo
no trae `Message-ID` (poco frecuente pero legal), se usa `sha256(cuentaCanalId:uidValidity:uid)`.

**Rationale**: dos capas independientes cubren los dos fallos distintos: la marca evita releer, y el
`Message-ID` evita duplicar si la marca se perdió o el mismo correo llega por dos caminos. La segunda capa
ya está escrita y probada para los demás canales — no se agrega código nuevo de deduplicación.

**Alternatives considered**: guardar solo el `Message-ID` de todo lo visto (crece sin límite y no evita
releer la casilla entera); usar la fecha interna del correo (sujeta a relojes mal puestos y a correos con
fecha en el pasado).

---

## R4 — Recorte del hilo citado y de la firma

**Decision**: `email-reply-parser` sobre el texto plano, quedándose con el fragmento visible más reciente.
Si la librería no encuentra corte (correos de clientes exóticos), se aplica un respaldo propio por
marcadores: líneas que empiezan con `>`, `-----Mensaje original-----`, `El … escribió:`, `On … wrote:`, y
la firma tras una línea `-- `. Si después del recorte el texto queda vacío, se conserva el original: es
preferible mostrar de más que perder el mensaje.

**Rationale**: FR-022 es visible para el usuario y además afecta el costo y la calidad de la IA — un hilo
citado reinyectado en cada mensaje infla el contexto y hace que el agente conteste cosas ya contestadas. La
regla de "ante la duda, no recortar" evita el fallo caro (perder contenido) a cambio del barato (mostrar
historial de más).

**Alternatives considered**: solo heurística propia (más frágil ante los formatos de Outlook y Gmail);
`talon` (sin mantenimiento desde 2022); recortar del lado del HTML (más frágil todavía, ver R10).

---

## R5 — Detección de auto-respuestas, rebotes y bucles

**Decision**: se descarta un correo, **antes** de crear contacto, conversación u oportunidad, si cumple
cualquiera de estas condiciones:

| Señal | Qué detecta |
|---|---|
| `Auto-Submitted` distinto de `no` (RFC 3834) | Auto-respuestas bien portadas |
| `X-Autoreply`, `X-Autorespond`, `X-Auto-Response-Suppress` presentes | Auto-respuestas de Exchange y similares |
| `Precedence` en `auto_reply`, `bulk` o `junk` | Respuestas automáticas y envíos masivos |
| `List-Id` o `List-Unsubscribe` presentes | Boletines y listas de correo |
| `Return-Path` vacío (`<>`) | Rebote: el estándar para notificaciones de entrega |
| Remitente `MAILER-DAEMON@…` o `postmaster@…` | Rebote |
| `Content-Type: multipart/report` con `report-type=delivery-status` | Rebote estructurado |
| Remitente igual a la dirección del propio buzón | Bucle del sistema consigo mismo |

Cada descarte se registra en el log con el motivo y el `Message-ID`, **sin el cuerpo del correo**, y avanza
la marca de lectura igual (el correo se considera procesado).

**Rationale**: FR-020 y SC-006. Sin esto, un aviso de vacaciones crea un contacto, una oportunidad y —peor—
dispara al agente de IA, que responde, que vuelve a disparar el aviso de vacaciones. Las señales elegidas
son las estándar; ninguna requiere adivinar por el contenido del texto.

**Alternatives considered**: filtrar por asunto (`"Out of office"`, `"Automatic reply"`) — frágil y
dependiente del idioma; se deja como respaldo solo si aparece un caso real que las cabeceras no cubran.

---

## R6 — Hilo de la respuesta (threading)

**Decision**: al responder se envían las cabeceras `In-Reply-To` con el `Message-ID` del **último correo
entrante** de la conversación, y `References` con la cadena del hilo (el `Message-ID` del primer correo más
los últimos, acotada). El asunto es el del correo original con prefijo `Re: `, sin duplicarlo si ya lo
tiene. No hace falta ninguna columna nueva para esto: los `Message-ID` ya quedan guardados en
`MensajeConversacion.idExterno` de cada mensaje de la conversación.

**Rationale**: FR-028 y SC-007. Es lo que hace que la respuesta aparezca dentro del hilo en Gmail, Outlook
y Apple Mail, en vez de como un correo suelto. Derivarlo de los mensajes ya guardados mantiene la migración
mínima.

**Alternatives considered**: guardar la cadena de `References` completa en una columna de la conversación —
redundante con los mensajes ya guardados, y se desincroniza. Confiar solo en el asunto `Re:` — muchos
clientes agrupan por cabeceras, no por asunto.

Para la agrupación **por hilo** (opcional, P4) sí hace falta una clave: ver `hiloExterno` en
[data-model.md](./data-model.md).

---

## R7 — Dónde vive el estado de "pendiente de aprobación"

**Decision**: tres piezas, una sola fuente de verdad.

1. `ContactoIdentificadorCanal.aprobadoEn` — **la verdad**: esta dirección de correo fue aprobada, y cuándo.
   Es lo que hace que FR-037 se cumpla aunque la conversación se cierre y se reabra.
2. `Conversacion.bloqueadaPorAprobacion` — bandera derivada, para los tres cortes de bloqueo.
3. `Oportunidad.aprobacionPendiente` — bandera derivada, para el distintivo en el tablero de pipeline.

Las tres se escriben en **una sola transacción**, dentro de una única función `aprobarRemitenteCorreo`.

**Rationale**: los tres puntos que deben cortar el envío ya cargan la conversación, y el Kanban ya carga la
oportunidad con un `select` fijo: con las banderas, el bloqueo no cuesta una sola consulta adicional en
ninguno de los dos caminos calientes. Derivar todo desde `ContactoIdentificadorCanal` sería más puro pero
agrega una consulta por columna del Kanban y otra por mensaje entrante.

**Alternatives considered**: un modelo nuevo `RemitentePendiente` con el correo crudo y sin crear contacto —
es la lectura literal de "no crear contactos automáticamente", pero obliga a una bandeja aparte fuera del
Inbox, duplica la vista de conversación y contradice el propio plan, que pide que el correo **llegue** a
Karia y se vea. Se descartó por eso, no por costo.

---

## R8 — Qué significa "no crear contactos automáticamente" contra un modelo que exige contacto

**Decision**: el contacto se crea igual (la conversación lo exige), pero nace **inactivo**
(`Contacto.activo = false`) y su identificador de canal nace **sin aprobar**. La conversación queda
bloqueada. Al aprobar, o bien ese contacto se activa con los datos que cargue el agente, o bien se
**reasigna** la conversación y el identificador a un contacto existente y el provisional se elimina.

**Rationale**: `Conversacion.contactoId` es obligatorio y cambiarlo tocaría todos los canales — exactamente
lo que SC-011 prohíbe. Lo que el negocio pidió es un comportamiento observable: que un remitente
desconocido **no se vuelva atendible** sin que alguien lo apruebe, y que no ensucie el CRM. Un contacto
inactivo y sin aprobar cumple ambas cosas sin tocar el modelo de nadie más.

**A verificar en implementación**: que los listados de contactos y los selectores del CRM filtren por
`activo` (si alguno no lo hace, se agrega el filtro como parte de esta feature, no después).

---

## R9 — Una conversación por contacto y por canal, sin romper los demás canales

**Decision**: `resolverContactoYConversacion` recibe el canal (ya lo recibe) y aplica un predicado
explícito: `requiereConversacionPropiaPorCanal(canal)`, que hoy devuelve `true` **solo** para `"email"`.
Cuando es `true`, la búsqueda de conversación abierta agrega el filtro por canal de la cuenta (y, con
agrupación por hilo activada, por `hiloExterno`). Cuando es `false`, la consulta queda **byte a byte** como
está hoy.

**Rationale**: SC-011 exige cero regresiones. Un predicado nombrado y un test que fija el comportamiento
actual de WhatsApp, Instagram y Messenger **antes** de tocar la función es la forma barata de demostrarlo.
La búsqueda actual, además, ignora a propósito la cuenta de canal para tolerar re-escaneos de QR de
WhatsApp: ese comportamiento no se puede perder.

**Alternatives considered**: filtrar siempre por canal (cambia WhatsApp e Instagram, prohibido); una
función nueva solo para correo que duplique la resolución de contacto (duplica el manejo de la condición de
carrera que el comentario del código pide explícitamente no duplicar).

---

## R10 — HTML del correo

**Decision**: **el HTML del correo nunca se renderiza.** Se usa la parte de texto plano cuando el correo es
`multipart/alternative` (la mayoría), y cuando el correo es solo HTML se usa el texto que `mailparser` ya
deriva de él.

> **Corregido durante la implementación (2026-11-16)**: el plan preveía escribir una función propia de
> HTML→texto. No hace falta: `mailparser` trae `html-to-text` entre sus dependencias y rellena `text`
> también para correos HTML-only, conservando los saltos de línea y la URL de cada enlace. Verificado con un
> correo HTML real: `<p>Hola, quiero saber el <b>precio</b>.</p><p>Ver <a href="https://x.com/p">catálogo</a></p>`
> produce `"Hola, quiero saber el precio.\n\nVer catálogo [https://x.com/p]"`. Se elimina el archivo
> `mensaje/html-a-texto.ts` del plan: un parser escrito a mano menos.

**Rationale**: es una decisión de seguridad antes que de formato. Renderizar HTML venido de cualquier
remitente dentro del Inbox es una superficie de XSS y de rastreo (píxeles de seguimiento) que esta feature
no necesita abrir: FR-021 pide que el correo *se lea bien*, no que se vea con su maquetación. Como no se
renderiza, tampoco hace falta un sanitizador y se evita una dependencia más.

**Alternatives considered**: renderizar el HTML en un `iframe` aislado (resuelve el XSS pero no el rastreo,
y agrega complejidad de UI que ninguna historia pide); escribir el conversor a mano (descartado al
comprobar que `mailparser` ya lo hace, ver arriba).

---

## R11 — Límites de tamaño

**Decision**: cuerpo procesado hasta 100 KB de texto; adjuntos hasta 10 MB cada uno y hasta 5 por correo;
timeout de 15 s por operación IMAP/SMTP. Lo que exceda se recorta y **se deja constancia en la
conversación** (FR-025).

**Rationale**: un solo correo con un adjunto de 200 MB no puede dejar un buzón sin leer. El límite de 10 MB
es el mismo que ya aplica el servicio de media de conversaciones, así que no inventa un número nuevo.
Recibir recortado y avisado es mejor que no recibir.

---

## R12 — Validación de la conexión y traducción de errores

**Decision**: `probarConexionBuzon` prueba las dos conexiones por separado —IMAP: conectar, autenticar y
abrir `INBOX`; SMTP: `verify()`— con timeout de 15 s, y devuelve un resultado por cada una con un código
funcional propio:

`CREDENCIALES_RECHAZADAS` · `SERVIDOR_INALCANZABLE` · `SEGURIDAD_INCOMPATIBLE` · `TIEMPO_AGOTADO` ·
`BUZON_INACCESIBLE` · `ERROR_DESCONOCIDO`

El mensaje técnico original **no** se devuelve al navegador; queda en el log del servidor.

**Rationale**: FR-005 y SC-002. El negocio tiene que poder arreglar el problema solo, y los tres errores
que de verdad ocurren son contraseña, servidor/puerto y tipo de seguridad. Mapearlos nosotros, en vez de
reenviar el texto del servidor, también cumple el principio IV (no filtrar errores del proveedor) y el V
(no exponer detalles internos).

---

## R13 — Credenciales

**Decision**: las contraseñas de entrada y de salida se cifran con `cifrarToken` (AES-256-GCM,
`TOKENS_CIFRADO_KEY`) antes de guardarse en `CuentaCanal.configuracion`, exactamente como Instagram hace
con su token. `queries.ts` **nunca** selecciona esos campos: el panel recibe `tieneCredenciales: boolean` y
un campo de contraseña vacío para reemplazarla.

**Rationale**: FR-011, FR-042 y el principio V. Reutilizar la función que ya existe evita un segundo
esquema de cifrado en el proyecto. Nota operativa: `TOKENS_CIFRADO_KEY` **debe estar definida también en el
worker**, que es quien descifra para leer y enviar.

---

## R14 — Dónde corre cada cosa (despliegue)

**Decision**: la lectura de buzones corre **solo en el worker**. El envío sigue el camino que ya existe: la
Server Action encola el comando `EnviarMensaje` y el worker lo consume. La app Next.js solo sirve la UI y
las Server Actions de configuración; la prueba de conexión la ejecuta la app (es una acción sincrónica del
usuario), no el worker.

**Rationale**: si la app leyera buzones, cada réplica duplicaría la lectura. El worker ya es el lugar donde
viven los procesos con estado (sockets de WhatsApp, disparadores, timers de Workflows).

**Consecuencia operativa a documentar en el despliegue**: el worker necesita salida de red hacia los
puertos IMAP/SMTP de los proveedores de correo de los clientes (993/143 y 465/587). Si el entorno de Coolify
los bloquea, el canal no funciona aunque el código sea correcto.
