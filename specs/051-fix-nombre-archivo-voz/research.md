# Research: El nombre del archivo deja de impedir la transcripción

**Feature**: `051-fix-nombre-archivo-voz` | **Date**: 2026-11-21

Cinco decisiones. La primera se resolvió llamando a la API real; el resto, leyendo el código y
los datos de producción.

---

## Decisión 1 — La extensión sale de `keyOriginal`, no de un mapa nuevo

**Decisión**: la extensión que se le agrega al nombre se toma de la **clave de storage** del
archivo (`keyOriginal`, o `keyOptimizado` si la primera falta — el mismo encadenamiento que
`transcribir.ts:90` ya usa para descargarlo). No se define un mapa de mime a extensión en el
módulo de voz.

**Rationale**: esa extensión ya es la que el sistema le asignó al archivo al guardarlo, con
`extDesde(mime)` (`src/lib/media/services/media-raw.service.ts:49`, `:134`). Tomarla de ahí da
tres cosas gratis:

1. **No hay una segunda lista que se arregle por separado.** El spec lo pide explícitamente, y es
   el modo clásico de que un formato nuevo funcione al guardarse y falle al transcribirse.
2. **El mime con parámetros se resuelve solo.** `audio/ogg; codecs=opus` —el que manda WhatsApp—
   ya está mapeado a `ogg` en ese archivo. Parsear parámetros acá sería reimplementarlo peor.
3. **Resuelve el caso abierto en el checklist del spec.** Si el mime no se pudo clasificar al
   guardarlo, la clave termina en `.bin`; el proveedor lo rechaza y el fallo **es correcto** — el
   formato de verdad no se reconoce. No hay que decidir nada especial.

Los datos de producción confirman que la fuente es fiable. Sobre los 744 `MediaArchivo` ligados a
un mensaje `AUDIO`/`NOTA_VOZ`:

| mime | extensión en `keyOriginal` | extensión en `nombreOriginal` | archivos |
|---|---|---|---|
| `video/mp4` | `mp4` | **ninguna** | 738 |
| `audio/ogg; codecs=opus` | `ogg` | **ninguna** | 6 |

El 100 % tiene la extensión correcta en la clave y **ninguno** la tiene en el nombre.

**Esto también corrige el alcance que suponía el spec**: el problema no es de Instagram. Los 6
audios de WhatsApp están igual de rotos; simplemente nadie los transcribió con Groq todavía.

**Alternatives considered**:
- *Exportar `extDesde` de `media-raw.service.ts` y reutilizarla*: obliga al módulo de voz a
  importar un servicio de media que arrastra configuración de storage, y su respaldo devuelve
  `"bin"` —que como extensión de audio es tan inútil como no poner ninguna, pero menos honesto—.
- *Un mapa propio en `src/voz/`*: la segunda lista que la decisión evita.
- *Detectar el formato leyendo los bytes de cabecera*: resuelve el problema pero agrega un
  detector de formatos al proyecto para obtener un dato que ya está escrito en la clave.
- *Arreglar `nombreArchivo` en el webhook de Instagram*: no arregla los 744 archivos ya
  guardados —que son los que hay que recuperar— ni los de WhatsApp, y deja el agujero abierto
  para el próximo canal.

---

## Decisión 2 — El arreglo va en `transcribir.ts`, no en cada adaptador

**Decisión**: el nombre se compone **una vez**, en `transcribir.ts:123`, antes de llamar a
`seleccion.proveedor.transcribir(...)`. Los adaptadores no cambian.

**Rationale**: el problema no es de Groq. Es que el módulo de voz entrega a sus proveedores un
nombre de archivo mal formado —sin extensión— y espera que cada uno se las arregle. Defenderse de
eso dentro de cada adaptador obliga a recordarlo cada vez que se agregue uno, y el que se olvide
falla exactamente como hoy: en silencio, con un error que culpa al audio.

Un solo punto permite además un test que fija el invariante **para todos los proveedores,
presentes y futuros**: lo que llega a `transcribir()` siempre lleva extensión. Es el mismo
criterio con el que 049 protegió el alcance por `tipo` en vez de por mime.

**Sobre FR-005** ("el comportamiento de los proveedores que identifican el formato por contenido
queda idéntico"): con esta ubicación, ElevenLabs recibirá `audio-123.mp4` donde antes recibía
`audio-123`. El **comportamiento** no cambia —ElevenLabs no mira el nombre, y la extensión que
recibe es la correcta para el archivo que recibe—, pero la petición no es byte a byte la misma.
Es una lectura deliberada del requisito: cubrir a todo proveedor futuro vale más que mantener un
campo informativo intacto en el que falla hoy. **El quickstart incluye una verificación explícita
de no-regresión en ElevenLabs.**

**Alternatives considered**:
- *En `openai-compatible.ts`*: deja la petición de ElevenLabs intacta, pero solo protege a quien
  use ese transporte. Un adaptador nuevo con su propio multipart vuelve a fallar.
- *En cada adaptador*: lo mismo, peor y por triplicado.

---

## Decisión 3 — `FORMATO_NO_SOPORTADO` sigue siendo permanente

**Decisión**: no se toca `groq.ts:76` ni su equivalente en OpenAI. El 400 sigue clasificándose
como fallo definitivo, sin reintentos.

**Rationale**: la clasificación es correcta. Un formato que el proveedor no admite no se arregla
esperando, y reintentarlo cinco veces cuesta cinco llamadas pagas para obtener cinco veces el
mismo rechazo — el mismo razonamiento por el que `INAUDIBLE` es terminal (regla 14 de
`CLAUDE.md`).

Lo que estaba mal no era la clasificación sino que el error **se disparara con un formato
válido**. Arreglado eso, el código vuelve a significar lo que dice.

Relajarlo a reintentable sería tratar el síntoma: los audios genuinamente inválidos pasarían a
costar cinco llamadas cada uno, y el audio de Ramón se habría reintentado cinco veces para
fallar igual.

**Alternatives considered**:
- *Hacerlo reintentable*: descrito arriba.
- *Un código nuevo para "nombre sin extensión"*: inventa una categoría para una condición que el
  arreglo vuelve imposible de alcanzar.

---

## Decisión 4 — La recuperación distingue la causa por el código de `UsoVoz`

**Decisión**: el script recupera únicamente los `MediaArchivo` en `ERROR` que tengan una fila de
`UsoVoz` con el código funcional de formato no soportado. No barre todos los errores.

**Rationale**: FR-010 lo exige, y el dato para cumplirlo ya existe: `registrarUsoVoz` escribe una
fila por intento con el código, y `UsoVoz.entidadId` apunta al `MediaArchivo`
(`src/voz/auditoria.ts:52-54`). No hace falta nada nuevo.

En producción eso separa limpiamente **1** audio recuperable de los **2** que fallaron contra
ElevenLabs con otro código y que el spec deja fuera a propósito. Sin este filtro, el script
reintentaría los tres y uno de ellos volvería a gastar llamadas por una causa que nadie
diagnosticó.

**Alternatives considered**:
- *Recuperar todo lo que esté en `ERROR`*: viola FR-010 y gasta dinero en fallos no
  diagnosticados.
- *Filtrar por fecha* ("todo lo que falló después de que Groq se activó"): aproximación frágil
  que mezcla causas y depende de recordar la hora exacta.

---

## Decisión 5 — `marcarPendiente` gana un parámetro para reiniciar los intentos

**Decisión**: `marcarPendiente` acepta un `reiniciarIntentos?: boolean`, **por defecto `false`**.
El script lo pasa en `true`; nadie más cambia.

**Rationale**: el script necesita dos cosas en una sola sentencia —pasar a `PENDIENTE` y poner el
contador de intentos en cero—, porque los intentos previos fallaron por una causa que ya no
existe y contarlos en contra es injusto: un audio que ya gastó sus cinco intentos volvería a
`ERROR` en el primer tropiezo real.

La alternativa es que el script escriba su propio `UPDATE`, y entonces habría **dos** sentencias
con las mismas guardias —tenant, tipo de mensaje, estados que no se tocan—. Esas guardias son
justamente lo que 049 puso en el SQL y no en TypeScript, a propósito (`cola.ts:37-44`);
duplicarlas es pedir que se separen.

El valor por defecto preserva el comportamiento actual al pie de la letra (FR-007): un reintento
normal sigue acumulando intentos, que es lo que hace que el backoff y el tope de cinco funcionen.

**Alternatives considered**:
- *Que el script haga su propio UPDATE*: duplica las guardias.
- *Que `marcarPendiente` siempre reinicie*: rompería el tope de intentos para todos los demás
  llamadores, incluido el camino caliente de recepción.
- *Dejar los intentos como están*: para el audio de Ramón alcanzaría (lleva 1 de 5), pero el
  script quedaría con una bomba para cualquier audio futuro que agote reintentos antes de que se
  diagnostique su causa.
