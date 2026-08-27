# Research: Diagnóstico claro de envíos de Instagram fuera de la ventana de 24h

**Feature**: `004-fix-instagram-human-agent` | **Date**: 2026-08-27

La investigación de causa raíz ya se hizo durante `/speckit-specify` (ver "Diagnóstico previo" en `spec.md`) y se confirmó con el usuario vía `/speckit-clarify`. Esta fase de research se enfoca en el **cómo**: qué pieza de código toca cada Functional Requirement, y si hace falta algún dato nuevo que hoy no exista.

## Hallazgo clave: los datos ya existen, falta mostrarlos

- `MensajeConversacion.codigoError` y `.motivoError` ya se persisten correctamente en `alAgotarReintentos()` ([enviar-mensaje.suscriptor.ts:115-136](../../src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts)), con un `motivoError` que **ya es un texto específico por tipo de error** (no genérico) — confirmado en `errores.ts`/`instagram.ts`: cada `EnvioMensajeError` trae su propio `mensaje` funcional (ej. HUMAN_AGENT_NO_APROBADO: *"La ventana estándar de 24h de Instagram expiró y esta integración no tiene habilitada la extensión para agentes humanos."*, distinto de FUERA_VENTANA_MENSAJERIA: *"La ventana de mensajería de Instagram para este contacto ya venció (más de 7 días...)"*).
- `codigoError`/`motivoError` **ya viajan hasta el frontend** — `MensajeConMeta` (`src/conversaciones/types.ts:38-41`) ya los expone, y `burbuja-mensaje.tsx:296` ya los lee — pero únicamente como atributo `title` (tooltip nativo, solo visible al pasar el mouse) sobre un ícono de 12px.
- Conclusión: **no hace falta ningún cambio de datos, de tipos ni de la lógica de envío** para resolver FR-001/002/003 — es enteramente un cambio de presentación en un componente ya existente.

## Decisiones

### D1 — Reemplazar el tooltip por un bloque de error visible en la burbuja

- **Decisión**: cuando `estadoEfectivo === "FALLIDO"` en `burbuja-mensaje.tsx`, en vez de (o adicionalmente a) el ícono con `title`, mostrar un bloque de texto siempre visible con el `motivoError`, siguiendo el mismo patrón visual que ya usa `BurbujaImagen` para sus propios estados de error (`esRechazada`/`estado === "ERROR"`, líneas 44-67 del mismo archivo): ícono + texto corto en una superficie `bg-muted`/`bg-danger-muted` con `border-border`/`border-danger-border`, según severidad.
- **Rationale**: es el patrón que el propio archivo ya usa para errores de adjuntos — reutilizarlo cumple el principio de diseño de no duplicar un patrón nuevo cuando ya existe uno equivalente en el mismo componente. `motivoError` ya es el texto correcto; no hace falta redactar mensajes nuevos por código de error, solo dejar de ocultarlo detrás de un hover.
- **Alternativas consideradas**: un `toast` (Sonner) al momento del fallo — rechazada como mecanismo principal porque el fallo llega minutos después del envío (vía el evento `MensajeEnviado` que dispara un refetch, no en el momento del clic), y un toast que aparece sin que el agente esté mirando la pantalla se pierde; el estado visible en la burbuja es persistente y se ve en cualquier momento que se revise la conversación. No se descarta un toast como *complemento* opcional si en la fase de tareas se decide reforzarlo, pero no es el mecanismo base.

### D2 — Distinguir severidad/acción sugerida por `codigoError`, sin inventar textos nuevos

- **Decisión**: usar el `codigoError` ya persistido (no el texto) para elegir el **ícono e intensidad visual** del bloque de error (D1), agrupando los códigos ya existentes en `errores.ts`/`instagram.ts` en 3 familias:
  - *Requiere acción externa con Meta* (`HUMAN_AGENT_NO_APROBADO`, `FUERA_VENTANA_MENSAJERIA`, `PERMISO_DENEGADO_META`) — icono de advertencia, tono neutro/informativo (no es un bug de Karia).
  - *Requiere acción del usuario en Karia* (`TOKEN_INVALIDO`) — mismo tono, pero el texto ya indica "reconectar la integración" (el `motivoError` de ese código ya lo dice).
  - *Transitorio / desconocido* (`RATE_LIMIT`, `ERROR_TEMPORAL_META`, `ERROR_RED`, `RESPUESTA_INESPERADA`, `ERROR_DESCONOCIDO_META`) — mismo bloque visible, tono de "no se pudo entregar" sin implicar una causa externa específica.
- **Rationale**: satisface FR-003 (distinguir motivos) sin necesitar un catálogo de textos nuevo — el `motivoError` ya es correcto y específico por código; el research solo necesitaba confirmar que existe una forma de agrupar los ~9 códigos ya definidos en un número manejable de variantes visuales, no de escribir contenido nuevo.
- **Nota sobre "pendiente de reintento" (mencionado en FR-003/Edge Cases de la spec)**: se investigó `ConsumidorBase` ([consumidor.ts](../../src/shared/rabbitmq/consumidor.ts)) y se confirmó que los códigos centrales de este bug (`HUMAN_AGENT_NO_APROBADO`, `FUERA_VENTANA_MENSAJERIA`, `TOKEN_INVALIDO`, `PERMISO_DENEGADO_META`) están marcados `reintentable: false` — fallan de inmediato, sin pasar por un estado intermedio de reintento. El sistema no persiste hoy un estado "reintentando" (el mensaje permanece como `ENVIADO` durante los reintentos de los códigos que sí son transitorios, hasta `ENTREGADO` o `FALLIDO`). Agregar un estado `REINTENTANDO` nuevo sería un cambio de esquema no justificado por el bug reportado — se descarta explícitamente (ver Alcance en `data-model.md`).

### D3 — Visibilidad de Human Agent a nivel de cuenta: consulta de solo lectura, sin nueva tabla

- **Decisión**: agregar una consulta que cuenta, para una `CuentaCanal` de Instagram, cuántos mensajes salientes de los últimos 30 días tienen `codigoError = "HUMAN_AGENT_NO_APROBADO"` (vía `MensajeConversacion` → `Conversacion.cuentaCanalId`, ambos ya indexados), y mostrar el resultado como un indicador simple ("Sin rechazos recientes" / "N mensajes rechazados por Meta en los últimos 30 días") en el panel de Integraciones → Instagram (`panel-instagram.tsx`), junto a cada cuenta conectada.
- **Rationale**: responde FR-004 con los datos que ya existen (`codigoError` ya persistido), sin tabla ni columna nueva. 30 días es una ventana razonable para detectar el problema sin volverse una consulta pesada ni un histórico completo — es un indicador de salud, no un reporte.
- **Alternativas consideradas**: una llamada activa a la Graph API de Meta para verificar el estado real de la capability Human Agent — rechazada: Meta no expone un endpoint público y estable para consultar el estado de aprobación de "Human Agent" por app (es información del App Dashboard, no de la Graph API de mensajería); inferir el estado a partir de los propios envíos rechazados es la única señal disponible sin salir del sistema.

## Salida

No quedan incógnitas técnicas. El alcance completo se resuelve con: un cambio de presentación en `burbuja-mensaje.tsx` (D1/D2) y una consulta de solo lectura + una sección nueva en `panel-instagram.tsx` (D3) — ambos sobre datos que ya existen en el modelo actual.
