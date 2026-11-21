# Data Model: El nombre del archivo deja de impedir la transcripción

**Feature**: `051-fix-nombre-archivo-voz` | **Date**: 2026-11-21

## Cambios de esquema

**Ninguno.** Sin migración, sin columnas, sin índices, sin backfill de datos. Lo único que se
reescribe son los dos campos de estado de los audios que la recuperación devuelve a la cola, y
eso lo hace la propia cola con su sentencia de siempre.

---

## Lo que se lee

### `MediaArchivo` — los tres campos que importan

Ya los selecciona `src/voz/transcribir.ts:38-49`; no se agrega ninguno.

| Campo | Qué aporta |
|---|---|
| `nombreOriginal` | Lo que hoy se le manda al proveedor. **En los 744 audios de producción no tiene extensión**, en ninguno |
| `keyOriginal` / `keyOptimizado` | La clave de storage. **Siempre termina en la extensión correcta** (`.mp4`, `.ogg`), porque `extDesde(mime)` la pone al guardar (`media-raw.service.ts:134`). Es la fuente de la extensión |
| `mimeOriginal` | Se sigue enviando como tipo declarado del `Blob`, sin cambios. **No se usa para derivar la extensión** (Decisión 1) |

Estado en producción:

| mime | ext. en la clave | ext. en el nombre | archivos |
|---|---|---|---|
| `video/mp4` | `mp4` | ninguna | 738 |
| `audio/ogg; codecs=opus` | `ogg` | ninguna | 6 |

### `UsoVoz` — cómo se distingue la causa del fallo

`entidadTipo = "MediaArchivo"` y `entidadId` apuntan al archivo; `error` guarda el código
funcional del intento (`src/voz/auditoria.ts:46-56`). Un `MediaArchivo` en `ERROR` es recuperable
por este hotfix **solo si** tiene al menos una fila de `UsoVoz` con el código de formato no
soportado.

En producción eso separa 1 audio recuperable de 2 que fallaron por otra causa y quedan fuera.

---

## Invariantes que este hotfix asume

**`keyOriginal` siempre termina en una extensión.** La pone `media-raw.service.ts:134` al
construir la clave, usando `extDesde(mime)`, que tiene `"bin"` como respaldo. Verificado contra
los 744 audios de producción.

> Si alguna vez se guarda un audio con una clave **sin** extensión, el nombre se envía sin
> extensión —igual que hoy— y Groq lo rechaza. El arreglo degrada al comportamiento actual, no a
> algo peor. Por eso no hay un respaldo que invente una extensión: adivinar mal convierte un
> fallo entendible en uno confuso (FR-002).

**`nombreOriginal` no es nulo.** Es `String` en el esquema. Puede estar vacío en teoría, y la
función lo contempla (ver [contracts/nombre-archivo.md](./contracts/nombre-archivo.md)).

**El código funcional de `UsoVoz` es estable.** Si se renombrara, la recuperación dejaría de
encontrar a quién recuperar — sin error, con un "nada que hacer" tranquilizador y falso. Por eso
el script nombra la constante del dominio, nunca una cadena suelta.

---

## Transición de estado de la recuperación

```
ERROR  ──(script, con confirmación explícita)──>  PENDIENTE
                                                  intentos = 0
                                                  bloqueadoHasta = NULL
```

Lo ejecuta `marcarPendiente` (`src/voz/cola.ts:46`), cuyas guardias ya existen y no se tocan:

- Solo desde `NO_APLICA` o `ERROR` → **nunca** arrebata un `PROCESANDO` ni resucita un `LISTO` o
  un `INAUDIBLE` (FR-011).
- Scope por `instanciaId` en el propio SQL (FR-010, principio II de la Constitución).
- Exige que el archivo esté referenciado por un mensaje `AUDIO`/`NOTA_VOZ` — el primero de los
  tres cortes de alcance de 049, que sigue vigente.

Lo único que cambia es `transcripcionIntentos = 0`, y solo cuando el llamador lo pide
explícitamente (Decisión 5).

---

## Qué NO cambia

- Los adaptadores de proveedor (`src/voz/proveedores/`), incluida la traducción de errores.
- El reclamo con lease, el backoff, el tope de cinco intentos y el tope diario de minutos.
- El registro de uso y costo, y la decisión de inaudible.
- `src/lib/media/` por completo: la extensión se lee de la clave que ese módulo ya produjo, sin
  importar cómo la produce.
