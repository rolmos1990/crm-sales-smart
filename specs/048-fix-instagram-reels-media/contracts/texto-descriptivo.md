# Contrato: texto descriptivo de contenidos compartidos

Es el valor de `MensajeConversacion.contenido` para los adjuntos que no son media directa. Lo leen:
- El inbox: burbuja y vista previa de la lista.
- La búsqueda.
- El contexto de la IA (`src/ai/contexto/constructor.ts`).
- Las condiciones de Workflows.

Vive en un único módulo del provider de Instagram, con una función pura por familia. No debe haber strings duplicados en el webhook ni en la UI.

| Familia | Imagen guardada | `contenido` |
|---|---|---|
| Reel | nunca | `Compartió un Reel`, más `: «{title}»` si Meta envía título |
| Publicación | sí | `Compartió una publicación` (+ `: «{title}»`) |
| Publicación | no: falla | `Compartió una publicación (no se pudo guardar la imagen)` |
| Publicación | no: era video | `Compartió una publicación` (+ título) |
| Mención en historia | sí, o no porque era video | `Te mencionó en su historia` |
| Mención en historia | no: falla | `Te mencionó en su historia (no se pudo guardar la imagen)` |
| Respuesta a historia | cualquiera | `Respondió a tu historia: {text}`. Sin `text`: `Respondió a tu historia` |
| `ephemeral` | — | `Envió contenido temporal que no puede guardarse` |
| No admitido / desconocido | — | `Envió un contenido que Instagram no permite mostrar` (Messenger: `…que Messenger no permite mostrar`) |
| Histórico limpiado (R7) | — | `Contenido compartido que ya no está disponible` (solo si `contenido` era NULL) |

Reglas:
- El `title` se recorta a 200 caracteres y se trata como texto plano.
- La aclaración "(no se pudo guardar la imagen)" solo aparece ante un **fallo**. No aparece cuando el contenido era un video y se omitió por decisión de alcance (research R0).
- En respuesta a historia, si la imagen no se conserva, el texto queda igual, para no ensuciar la respuesta del contacto.
