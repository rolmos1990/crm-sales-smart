# Feature Specification: Registrar en Karia los mensajes enviados desde la app nativa del canal

**Feature Branch**: `[020-fix-mensajes-app-nativa]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "tengo actualmente integracion de cuenta instagram, facebook y whatsapp el mismo problema, cuando alguien integra su cuenta para atender desde Karia App funciona perfecto pero si un operador escribe desde la cuenta real de instagram el mensaje no se registra en Karia App (a pesar de estar la integración activa), necesito analizar y ajustar esto pero con cuidado no se duplique los mensajes enviados si se envia desde Karia App. Verifica poder integrar esto para las integraciones actuales de Instagram, Facebook y Whatsapp."

## Diagnóstico previo (investigación de código)

- **Causa raíz confirmada, idéntica en los tres canales**: el webhook/listener de cada canal descarta *todo* evento de "mensaje propio" (el eco que la plataforma reenvía de cualquier mensaje saliente de esa cuenta) sin verificar si ese mensaje ya fue enviado y registrado por Karia. El filtro usado no distingue "lo envió Karia" de "lo envió alguien desde la app nativa" — ambos casos generan la misma señal (`is_echo`/`fromMe`) y hoy se tratan igual: se ignoran.
  - **Instagram / Facebook Messenger** — `src/app/api/webhooks/instagram/route.ts:309`: `if (event.message?.is_echo || event.read) continue;` — corta el procesamiento antes de mirar si el mensaje corresponde a uno ya conocido.
  - **WhatsApp** (vía Baileys, no vía Business Cloud API — no hay webhook HTTP para WhatsApp, es una conexión de socket persistente) — el mismo patrón está duplicado en dos archivos: `src/integraciones/whatsapp-lite/reconectar.ts:135` y `src/app/api/integraciones/whatsapp-lite/sesion/route.ts:180`: `if (msg.key.fromMe) continue;`.
- **Ya existe la pieza que permite distinguir ambos casos sin romper nada**: cada vez que Karia envía un mensaje, guarda el ID que la plataforma le devuelve en `MensajeConversacion.idExterno` (`src/suscriptores/mensajes/enviar-mensaje.suscriptor.ts:95-98`, usando el `mid` de Meta o el `key.id` de Baileys — `src/conversaciones/providers/whatsapp-lite.ts:113-125`). El propio webhook de Instagram ya usa esa columna para deduplicar mensajes *entrantes* del contacto (`src/app/api/webhooks/instagram/route.ts:352-355`: `prisma.mensajeConversacion.findFirst({ where: { idExterno: mid } })`), pero esa comprobación nunca llega a ejecutarse para los eventos de eco porque el `continue` de la línea 309 corta antes.
- **Lo que falta, y es la causa exacta del síntoma reportado**: cuando llega un evento de eco/`fromMe`, el sistema debería preguntarse "¿este ID ya está en `MensajeConversacion.idExterno`?" — si sí, es un mensaje que Karia ya envió y registró (se ignora, sin cambios respecto a hoy); si no, es un mensaje que salió por la app nativa y **nunca se registró en ningún lado** porque hoy se descarta sin esa comprobación.
- **Confirmado que el síntoma es idéntico en los tres canales** — no hay ninguno que ya funcione correctamente para este caso; los tres necesitan el mismo ajuste.
- **Limitación de origen de datos confirmada**: ni el webhook de Meta ni el evento de Baileys identifican *qué persona* escribió desde la app nativa (solo confirman que salió de esa cuenta/número) — cualquier ajuste solo puede registrar el mensaje y marcar su origen como "enviado desde el canal nativo", no atribuirlo a un usuario específico de Karia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un mensaje enviado desde la app nativa de Instagram/Messenger queda registrado en Karia (Priority: P1)

Como negocio, quiero que si un operador responde a un cliente directamente desde la app de Instagram o Facebook Messenger (sin pasar por Karia), ese mensaje aparezca igual en el historial de la conversación en Karia, para no perder contexto de lo que el cliente ya recibió.

**Why this priority**: Es el síntoma reportado explícitamente y el que más directamente rompe la confianza en Karia como registro único de la conversación — si Karia no ve lo que el cliente ya recibió, cualquier respuesta posterior (humana o de IA) puede contradecir o repetir algo que el cliente ya leyó.

**Independent Test**: Con la integración de Instagram (o Messenger) activa y una conversación existente, responder al cliente desde la app nativa de Instagram/Messenger (no desde Karia) y confirmar que el mensaje aparece en el historial de esa conversación en Karia, en el orden correcto.

**Acceptance Scenarios**:

1. **Given** una conversación activa de Instagram con integración activa, **When** un operador responde al cliente desde la app nativa de Instagram, **Then** ese mensaje queda registrado en la misma conversación en Karia, en orden cronológico correcto.
2. **Given** la misma situación en Facebook Messenger, **When** un operador responde desde la app/web nativa de Messenger, **Then** el mensaje queda registrado igual que en el escenario 1.
3. **Given** un mensaje registrado por haber sido enviado desde la app nativa, **When** se revisa el historial de la conversación, **Then** su origen se distingue claramente de un mensaje enviado por un agente desde Karia.
4. **Given** un mensaje que un agente ya envió desde Karia, **When** la plataforma reenvía el eco de ese mismo mensaje, **Then** Karia lo reconoce como ya registrado y NO crea un segundo registro (sin cambios respecto al comportamiento actual).

---

### User Story 2 - Un mensaje enviado desde la app nativa de WhatsApp queda registrado en Karia (Priority: P1)

Como negocio, quiero que si un operador responde a un cliente directamente desde WhatsApp (app o WhatsApp Web, no desde Karia), ese mensaje aparezca igual en el historial de la conversación en Karia.

**Why this priority**: Mismo impacto que la Historia 1 — WhatsApp es, además, el canal donde es más común que un operador tenga el teléfono a mano y responda directamente sin abrir Karia.

**Independent Test**: Con una sesión de WhatsApp vinculada y una conversación existente, responder al cliente desde la app de WhatsApp (o WhatsApp Web) vinculada a ese número, y confirmar que el mensaje aparece en el historial de esa conversación en Karia.

**Acceptance Scenarios**:

1. **Given** una conversación activa de WhatsApp con la sesión vinculada activa, **When** un operador responde al cliente desde la app o WhatsApp Web de ese número, **Then** ese mensaje queda registrado en la misma conversación en Karia, en orden cronológico correcto.
2. **Given** un mensaje que un agente ya envió desde Karia por WhatsApp, **When** Baileys reporta el evento `fromMe` de ese mismo mensaje, **Then** Karia lo reconoce como ya registrado y NO crea un segundo registro (sin cambios respecto al comportamiento actual).
3. **Given** que la sesión de WhatsApp se reconecta (reinicio, pérdida de conexión), **When** vuelve a estar activa, **Then** el comportamiento de reconocer mensajes ya registrados vs. mensajes nuevos de la app nativa sigue funcionando igual (la corrección aplica a los dos puntos del código donde hoy se descartan estos eventos, no solo a uno).

### Edge Cases

- ¿Qué pasa si el eco de un mensaje enviado por Karia llega al webhook/listener *antes* de que Karia haya terminado de guardar el ID externo de ese mismo mensaje (condición de carrera)? El sistema MUST evitar registrar un duplicado en ese caso — sin bloquear ni retrasar de forma perceptible el registro de mensajes genuinamente nuevos de la app nativa.
- ¿Qué pasa si dos operadores distintos responden casi al mismo tiempo, uno desde Karia y otro desde la app nativa? El sistema MUST registrar ambos mensajes exactamente una vez cada uno, sin fusionarlos ni perder ninguno.
- ¿Qué pasa si un mensaje enviado desde la app nativa no se puede asociar a ninguna conversación existente en Karia (ej. es el primer contacto con alguien completamente nuevo, iniciado por el operador desde la app nativa)? El sistema MUST manejarlo de forma consistente con cómo ya maneja hoy un mensaje entrante nuevo sin conversación previa, sin fallar silenciosamente.
- ¿Qué pasa con reacciones o mensajes de solo lectura (recibos de lectura) enviados desde la app nativa? Estos MUST seguir procesándose como ya se procesan hoy (ver manejo existente de `event.read` y reacciones) — el ajuste es específicamente sobre mensajes de texto/contenido salientes no reconocidos, no sobre todo evento de eco.
- ¿Qué pasa si la cuenta/integración se marca como inactiva? El sistema MUST seguir sin registrar ningún mensaje para esa cuenta, igual que hoy — este ajuste no cambia el comportamiento de integraciones inactivas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST, ante cualquier evento de "mensaje propio" (eco/`fromMe`) recibido de Instagram, Facebook Messenger o WhatsApp, verificar si ese mensaje ya fue registrado por Karia (por su identificador externo) antes de decidir qué hacer con él — en ningún caso MUST descartarlo sin esa verificación.
- **FR-002**: Cuando el identificador externo del evento coincide con un mensaje que Karia ya registró, el sistema MUST seguir ignorándolo, exactamente igual que hoy (sin duplicados).
- **FR-003**: Cuando el identificador externo del evento NO coincide con ningún mensaje ya registrado por Karia, el sistema MUST registrar ese mensaje en la conversación correspondiente del contacto, en el orden cronológico correcto.
- **FR-004**: Un mensaje registrado por haber sido enviado desde el canal nativo (fuera de Karia) MUST quedar identificable como tal en el historial de la conversación, distinguible de un mensaje enviado por un agente desde Karia.
- **FR-005**: Este comportamiento MUST aplicar de manera consistente a Instagram, Facebook Messenger y WhatsApp — ningún canal queda exceptuado ni con un comportamiento distinto a los otros dos.
- **FR-006**: Para WhatsApp, el ajuste MUST aplicarse en todos los puntos del sistema donde hoy se descartan los eventos de mensaje propio (la sesión inicial y la reconexión), no solo en uno de ellos.
- **FR-007**: El sistema MUST seguir enviando y registrando exactamente igual que hoy los mensajes que un agente envía desde Karia — este ajuste no MUST alterar de ninguna forma observable ese flujo ya existente.
- **FR-008**: El sistema MUST seguir procesando exactamente igual que hoy los eventos de recibo de lectura y reacciones — el ajuste aplica únicamente a mensajes de contenido salientes no reconocidos.
- **FR-009**: El sistema MUST seguir sin registrar ningún mensaje para una cuenta/integración marcada como inactiva.

### Key Entities

- **Cuenta de canal**: la integración de Instagram, Facebook Messenger o WhatsApp conectada a un negocio, con su estado activo/inactivo.
- **Conversación**: el hilo de mensajes entre un negocio y un contacto en un canal determinado.
- **Mensaje de conversación**: cada mensaje individual dentro de una conversación, con su remitente, su identificador en la plataforma externa (cuando existe), y su origen (contacto, agente desde Karia, o — nuevo con este ajuste — agente desde la app nativa del canal).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los mensajes enviados desde la app nativa de Instagram, Facebook Messenger o WhatsApp quedan visibles en el historial de la conversación correspondiente en Karia, en el mismo minuto en que se enviaron.
- **SC-002**: El 100% de los mensajes enviados desde Karia siguen apareciendo exactamente una vez en el historial de la conversación — cero duplicados introducidos por este ajuste, en los tres canales.
- **SC-003**: Un equipo que revisa el historial de una conversación puede distinguir, sin ambigüedad, si un mensaje saliente fue enviado desde Karia o desde la app nativa del canal.
- **SC-004**: El comportamiento es idéntico en los tres canales (Instagram, Facebook Messenger, WhatsApp) — ninguno queda con el defecto original mientras los otros ya están corregidos.

## Assumptions

- "Operador que escribe desde la cuenta real" se interpreta como cualquier persona con acceso a la app nativa (Instagram, Messenger o WhatsApp) de la cuenta/número conectado a Karia, no necesariamente un usuario registrado en Karia — por eso el mensaje se registra con origen "app nativa", sin poder atribuirlo a una persona específica del equipo (ninguna de las tres plataformas expone esa información en el evento).
- El identificador externo (`idExterno`) que Karia ya guarda al enviar un mensaje es único y estable por plataforma — es la base confiable para decidir "esto ya lo registré" vs. "esto es nuevo", sin necesidad de una fuente de verdad adicional.
- Para WhatsApp, "sesión vinculada" sigue significando lo mismo que hoy (vínculo vía código QR con el número real, gestionado por la conexión de socket existente) — este ajuste no cambia cómo se establece o mantiene esa sesión, solo cómo se procesan los mensajes que llegan por ella.
- Fuera de alcance: identificar o mostrar *qué persona* del equipo envió un mensaje desde la app nativa (no hay esa información disponible); sincronizar mensajes históricos enviados desde la app nativa *antes* de este ajuste (el ajuste aplica hacia adelante, desde que se despliega); y cualquier canal o integración fuera de Instagram, Facebook Messenger y WhatsApp.
