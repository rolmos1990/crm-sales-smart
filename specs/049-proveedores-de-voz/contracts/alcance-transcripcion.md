# Contrato: qué se transcribe y qué no

**Este es el contrato de mayor riesgo de la feature.** Incumplirlo no produce ningún error
visible: el proveedor acepta la entrada, devuelve 200, factura, y nadie se entera. Los tests
asociados no se borran.

## La regla

Un `MediaArchivo` es elegible si y solo si:

1. Existe al menos un `MensajeConversacion` con `mediaArchivoId` apuntando a él y
   `tipo IN ('AUDIO','NOTA_VOZ')`, **y**
2. la instancia tiene `ConfiguracionEmpresa.transcripcionVozHabilitada = true`, **y**
3. la instancia tiene al menos un `ProveedorVoz` activo con credencial, **y**
4. `pesoOriginal ≤ 25 MB`.

Cualquier otra cosa — video, imagen, documento, sticker, archivo huérfano — es `NO_APLICA`.

## Por qué el mime no es criterio

Medido en producción, cuenta DecostoreKt:

| `mimeOriginal` | `tipo` del mensaje | filas |
|---|---|---:|
| `video/mp4` | `AUDIO` | 727 |
| `video/mp4` | `VIDEO` | **203** |
| `audio/ogg; codecs=opus` | `NOTA_VOZ` | 6 |

Las notas de voz de Instagram viajan en contenedor MP4 y Karia guarda el `Content-Type` tal como
lo entrega el CDN de Meta (`src/app/api/webhooks/instagram/route.ts:182`). **727 notas de voz y
203 videos son indistinguibles por mime.** Scribe acepta MP4 como entrada válida.

Un filtro por `mimeOriginal LIKE 'audio/%'` pierde el 99 % del volumen real.
Un filtro por audio **o** video transcribe y cobra 203 videos, que además pesan 7× más por
archivo.

El único dato que distingue es `MensajeConversacion.tipo`, que asigna el provider al mapear el
adjunto (`src/conversaciones/providers/instagram.ts:290`).

## Tres cortes, no uno

| # | Dónde | Qué hace |
|---|---|---|
| 1 | `marcarPendiente`, llamado desde la creación del mensaje | Es el único punto que conoce el `tipo`. Solo marca con `AUDIO`/`NOTA_VOZ`. |
| 2 | `transcribir()`, inmediatamente antes de llamar al proveedor | Revalida contra la base que el archivo siga referenciado por un mensaje `AUDIO`/`NOTA_VOZ`. Si no, pasa a `NO_APLICA` y **no llama**. |
| 3 | `scripts/049-backfill-transcripciones.ts` | Parte de `MensajeConversacion` filtrando por `tipo`. Nunca de `MediaArchivo`. |

El corte 2 parece redundante y no lo es: protege de una fila marcada por una versión anterior
del código, por un backfill mal invocado o por una escritura manual.

## Tests obligatorios

| Caso | Esperado |
|---|---|
| `MediaArchivo` `video/mp4` ← mensaje `VIDEO` | **cero** llamadas al proveedor; queda `NO_APLICA` |
| `MediaArchivo` `video/mp4` ← mensaje `AUDIO` | se transcribe |
| `MediaArchivo` `audio/ogg` ← mensaje `NOTA_VOZ` | se transcribe |
| `MediaArchivo` `image/jpeg` ← mensaje `IMAGEN` | cero llamadas |
| Fila en `PENDIENTE` cuyo mensaje es `VIDEO` (marcada a mano) | corte 2 la pasa a `NO_APLICA`, cero llamadas |
| Toggle apagado | cero llamadas, sea cual sea el tipo |
| Archivo > 25 MB con mensaje `AUDIO` | cero llamadas |

> El primero y el quinto son los que una refactorización del tipo "simplifiquemos el filtro al
> mime" rompe sin que ningún otro test falle.

## Invariante verificable

```sql
-- Debe dar 0 siempre (SC-002).
SELECT COUNT(*) FROM "MediaArchivo" ma
WHERE ma."transcripcionEstado" <> 'NO_APLICA'
  AND NOT EXISTS (
    SELECT 1 FROM "MensajeConversacion" m
    WHERE m."mediaArchivoId" = ma.id AND m.tipo IN ('AUDIO','NOTA_VOZ')
  );
```
