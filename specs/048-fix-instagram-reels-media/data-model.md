# Data Model: 048

**Sin entidades nuevas, sin cambios de esquema.** Solo una migración de datos (research R7).

## MensajeConversacion (existente)

| Campo | Cambio de uso |
|---|---|
| `contenido` | Para Reels, publicaciones, menciones y respuestas a historia lleva el texto descriptivo de `contracts/texto-descriptivo.md`. En respuesta a historia incluye el texto original del contacto. |
| `tipo` | Familias nuevas: `IMAGEN` si se guardó la imagen, `TEXTO` en otro caso. Nunca `VIDEO`. La familia directa no cambia. |
| `mediaUrl` | **Invariante nuevo** para `instagram` y `facebook_messenger`: es una URL del storage de Karia o `NULL`. Nunca un host de Meta. Siempre `NULL` en Reels. |
| `mediaArchivoId` | Igual que hoy: se asigna cuando el contenido se conservó. |

### Transiciones al recibir un adjunto (Instagram)

```
adjunto entrante
 ├─ directa (image/video/audio/file) ─────────► comportamiento actual, sin cambios
 ├─ reel ─────────────────────────────────────► tipo TEXTO, sin descarga, contenido "Compartió un Reel[: «título»]"
 ├─ publicación / mención en historia / respuesta a historia
 │    ├─ responde image/* y se guarda ────────► tipo IMAGEN + mediaArchivoId + contenido descriptivo
 │    ├─ responde video/* u otro mime ────────► tipo TEXTO (sin bajar el cuerpo), contenido descriptivo
 │    └─ falla / timeout ─────────────────────► tipo TEXTO, contenido "…(no se pudo guardar la imagen)"
 └─ ephemeral / is_unsupported / desconocido ─► tipo TEXTO, mediaUrl NULL, contenido genérico
```

## MediaArchivo (existente)

Sin cambios. Las imágenes de publicaciones e historias se guardan con:
- `instanciaId` de la cuenta receptora.
- `modulo: "conversaciones"`.
- `canalOrigen: "instagram"`.

La deduplicación por `(instanciaId, hash)` aplica igual. Nunca se crea un registro por un Reel.
