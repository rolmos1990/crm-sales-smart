# Feature Specification: Niveles de autonomía y automatización por intención

**Feature Branch**: `[016-niveles-autonomia-automatizacion]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "El agente debe soportar niveles de autonomía (SuggestionOnly, AutoReplySafeIntents, ConditionalAutomation, HumanOnly), configurables por intención. Seguros: saludos, horarios, preguntas frecuentes verificadas, información general no sensible. Supervisados: recomendaciones, precios, disponibilidad, costos de envío, cotizaciones. Humanos: reclamos, reembolsos, descuentos especiales, problemas de pago, excepciones de entrega, clientes molestos, compromisos no definidos. No activar automatización global — decisión de negocio ya tomada: el envío automático actual se mantiene como default; los niveles se agregan como configuración opt-in por intención."

## Diagnóstico previo (investigación de código)

- Confirmado en `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` §1 (hallazgo de riesgo): hoy **no existe ningún nivel de autonomía** — `GenerarRespuestaIASuscriptor` (`src/suscriptores/ai/generar-respuesta-ia.suscriptor.ts`) genera y envía la respuesta al cliente de forma automática, siempre, para cualquier tipo de mensaje. El único camino "solo sugerencia" que existe hoy es `generarSugerenciaIA` (`src/conversaciones/actions-ia.ts`), un flujo manual separado donde un humano pide una sugerencia desde el panel — coexiste con el envío automático, no lo reemplaza ni lo controla.
- La decisión de negocio para esta spec ya fue tomada explícitamente por el usuario antes de iniciar el plan de specs (`docs/AGENTE-IA-EVOLUCION-ANALISIS.md` §9): el envío automático **se mantiene como comportamiento por defecto**. Los niveles de autonomía se agregan como configuración que un negocio activa explícitamente por intención — ningún negocio existente cambia de comportamiento al desplegar esta spec.
- No existe hoy ninguna clasificación de "categoría de intención de mensaje" del tipo que esta spec necesita (saludo, horario, pregunta frecuente, reclamo, cliente molesto, etc.) — es distinta de `IntencionComercial` ya definida en `011` (que describe el momento del embudo de venta: explorando, comparando, listo para comprar). Esta spec introduce su propio catálogo cerrado, específico para decidir automatización, sin reemplazar ni mezclarse con el de `011`.
- El enrutamiento de `010` ya permite asignar un proveedor económico a una tarea de clasificación — la clasificación de categoría de intención que esta spec necesita es candidata natural a ese mismo mecanismo, reutilizándolo en vez de crear un enrutamiento paralelo.
- `TransferirAHumanoTool` ya existe y ya marca una conversación para atención humana — esta spec no la reemplaza; el nivel `HumanOnly` de esta spec decide *no generar ni enviar* una respuesta automática, mientras que la transferencia es una acción que el propio agente puede decidir tomar dentro de una respuesta permitida. Son mecanismos complementarios, no el mismo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar el nivel de autonomía por categoría de intención (Priority: P1)

Como responsable de negocio, quiero definir, para cada categoría de intención de mensaje (saludos, horarios, preguntas frecuentes, información general, recomendaciones, precios, disponibilidad, costos de envío, cotizaciones, reclamos, reembolsos, descuentos especiales, problemas de pago, excepciones de entrega, clientes molestos, compromisos no definidos), si el agente puede responder automáticamente, debe pedir revisión humana antes de enviar, o no debe generar ninguna respuesta automática en absoluto.

**Why this priority**: Es la base configurable — sin esto no hay forma de expresar la política de autonomía de un negocio.

**Independent Test**: Configurar "Reclamos" como `HumanOnly` y "Saludos" como `AutoReplySafeIntents`, guardar, y confirmar que la configuración persiste tal cual.

**Acceptance Scenarios**:

1. **Given** que entro por primera vez a la configuración de automatización, **When** la abro, **Then** veo las 16 categorías de intención agrupadas según la clasificación inicial sugerida (seguras, supervisadas, humanas), cada una con un nivel de autonomía asignado por defecto según esa clasificación, sin que ningún negocio deba configurar nada para que el sistema funcione.
2. **Given** cualquier categoría, **When** cambio su nivel de autonomía, **Then** el cambio se guarda y queda reflejado al volver a consultar la pantalla.
3. **Given** una categoría configurada como `ConditionalAutomation`, **When** la reviso, **Then** puedo ver o ajustar las condiciones de confianza que debe cumplir para enviarse automáticamente.

---

### User Story 2 - El envío automático respeta el nivel configurado, sin cambiar el comportamiento existente por defecto (Priority: P1)

Como negocio, quiero que mientras no configure explícitamente ningún nivel de autonomía distinto al que ya viene por defecto, el agente siga respondiendo automáticamente exactamente igual que hoy, y que cuando sí configure un nivel más restrictivo para alguna categoría, el sistema lo respete a partir de ese momento.

**Why this priority**: Es el requisito de compatibilidad no negociable de esta spec — protege el comportamiento de producción actual mientras habilita el control pedido.

**Independent Test**: Sin ninguna configuración de automatización tocada, generar respuestas para mensajes de distintas categorías y confirmar que todas se envían automáticamente, igual que hoy. Configurar "Reclamos" como `HumanOnly`, generar una respuesta para un mensaje de esa categoría, y confirmar que no se envía automáticamente.

**Acceptance Scenarios**:

1. **Given** que ningún negocio configuró nunca esta funcionalidad, **When** llega cualquier mensaje de cualquier categoría, **Then** el agente genera y envía la respuesta automáticamente, exactamente igual que antes de esta spec.
2. **Given** que una categoría está configurada como `HumanOnly`, **When** llega un mensaje de esa categoría, **Then** el agente no genera ni envía una respuesta automática — la conversación queda disponible para que un humano la atienda.
3. **Given** que una categoría está configurada como `SuggestionOnly`, **When** llega un mensaje de esa categoría, **Then** el agente genera una respuesta propuesta, pero no la envía automáticamente — queda pendiente de revisión humana.
4. **Given** que una categoría está configurada como `AutoReplySafeIntents`, **When** llega un mensaje de esa categoría, **Then** el agente envía la respuesta automáticamente, igual que con el comportamiento por defecto.
5. **Given** que una categoría está configurada como `ConditionalAutomation` con condiciones de confianza definidas, **When** llega un mensaje de esa categoría, **Then** el agente envía automáticamente solo si se cumplen esas condiciones; si no se cumplen, la respuesta queda pendiente de revisión humana en lugar de enviarse.
6. **Given** que el sistema no puede determinar con certeza la categoría de un mensaje, **When** eso ocurre, **Then** el sistema aplica el mismo criterio que tenía por defecto antes de esta spec (envío automático), sin bloquear la conversación por una clasificación incierta.

---

### User Story 3 - Revisar y actuar sobre las respuestas que quedaron pendientes de aprobación (Priority: P2)

Como agente humano, quiero ver las respuestas que el sistema generó pero no envió automáticamente por estar en modo de revisión, para poder aprobarlas, editarlas antes de enviarlas, o descartarlas.

**Why this priority**: Es el complemento necesario para que `SuggestionOnly`/`ConditionalAutomation` con confianza insuficiente tengan una salida operativa real — sin esto, esas respuestas quedarían generadas pero invisibles.

**Independent Test**: Con una categoría configurada como `SuggestionOnly`, generar una respuesta pendiente, y confirmar que aparece en una bandeja donde puede aprobarse (y enviarse tal cual), editarse antes de enviar, o descartarse.

**Acceptance Scenarios**:

1. **Given** una respuesta generada en modo de revisión, **When** un agente humano la revisa, **Then** puede enviarla tal cual, editarla y enviar la versión editada, o descartarla sin enviar nada.
2. **Given** una respuesta pendiente que un humano edita antes de enviar, **When** se envía, **Then** el sistema registra que hubo una edición humana antes del envío (insumo para el aprendizaje supervisado de `017`).

### Edge Cases

- ¿Qué pasa si se cambia el nivel de autonomía de una categoría mientras hay respuestas ya pendientes de revisión bajo el nivel anterior? Esas respuestas ya generadas MUST conservar su estado pendiente hasta que un humano actúe sobre ellas — el cambio de nivel no las envía ni las descarta retroactivamente.
- ¿Qué pasa si un mismo mensaje podría clasificar en más de una categoría? El sistema MUST aplicar el nivel más restrictivo entre las categorías que coincidan (si alguna es `HumanOnly`, se trata como `HumanOnly`; si alguna es `SuggestionOnly` y ninguna más restrictiva, se trata como `SuggestionOnly`), priorizando la seguridad sobre la automatización.
- ¿Qué pasa si la clasificación de categoría falla (error técnico, no solo incertidumbre)? El sistema MUST aplicar el mismo criterio que un mensaje sin clasificación posible (Escenario 6 de la Historia 2) — nunca debe bloquear la generación de una respuesta por un fallo técnico de clasificación.
- ¿Qué pasa si `ConditionalAutomation` está configurado pero sin ninguna condición de confianza definida? El sistema MUST tratarlo como si no se cumpliera ninguna condición (queda pendiente de revisión), nunca como envío automático sin control.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST definir un catálogo cerrado de categorías de intención de mensaje que incluya, como mínimo: saludos, consultas de horario, preguntas frecuentes verificadas, información general no sensible, recomendaciones, consultas de precio, consultas de disponibilidad, consultas de costo de envío, solicitudes de cotización, reclamos, solicitudes de reembolso, solicitudes de descuento especial, problemas de pago, excepciones de entrega, clientes con expresión de molestia, y compromisos no definidos en el sistema.
- **FR-002**: El sistema MUST permitir configurar, por agente y por categoría, uno de cuatro niveles de autonomía: solo sugerencia, respuesta automática para intenciones seguras, automatización condicionada por confianza, o exclusivamente humano.
- **FR-003**: El sistema MUST proveer una clasificación inicial por defecto que asigne saludos/horarios/preguntas frecuentes/información general a un nivel de respuesta automática, recomendaciones/precios/disponibilidad/costos de envío/cotizaciones a un nivel supervisado, y reclamos/reembolsos/descuentos especiales/problemas de pago/excepciones de entrega/clientes molestos/compromisos no definidos a un nivel exclusivamente humano — editable por el negocio.
- **FR-004**: El sistema MUST mantener el comportamiento de envío automático existente antes de esta spec para cualquier agente y categoría que el negocio no haya configurado explícitamente de otra forma.
- **FR-005**: El sistema MUST clasificar la categoría de intención de cada mensaje entrante antes de decidir si la respuesta generada se envía automáticamente, queda pendiente de revisión, o no se genera.
- **FR-006**: El sistema MUST enviar automáticamente la respuesta generada solo cuando el nivel de autonomía configurado para la categoría del mensaje lo permita (respuesta automática para intenciones seguras, o automatización condicionada cuyas condiciones se cumplan).
- **FR-007**: El sistema MUST dejar la respuesta generada en estado pendiente de revisión humana, sin enviarla, cuando el nivel configurado sea solo sugerencia, o cuando sea automatización condicionada y sus condiciones no se cumplan.
- **FR-008**: El sistema MUST NOT generar ni enviar una respuesta automática cuando el nivel configurado sea exclusivamente humano — la conversación queda disponible para atención humana sin una respuesta automática de por medio.
- **FR-009**: El sistema MUST aplicar el nivel más restrictivo cuando un mensaje pueda clasificar en más de una categoría con niveles distintos.
- **FR-010**: El sistema MUST aplicar el criterio de comportamiento por defecto (envío automático) cuando la clasificación de categoría no pueda determinarse con certeza o falle por un error técnico, sin bloquear la generación de la respuesta.
- **FR-011**: El sistema MUST permitir a un agente humano revisar cualquier respuesta pendiente y enviarla tal cual, editarla antes de enviarla, o descartarla.
- **FR-012**: El sistema MUST registrar cuándo una respuesta pendiente fue editada por un humano antes de enviarse, de forma consultable.
- **FR-013**: El sistema MUST conservar el estado de cualquier respuesta ya pendiente de revisión cuando el nivel de autonomía de su categoría cambie después de haberse generado.

### Key Entities *(include if feature involves data)*

- **Configuración de autonomía por categoría**: por agente, para cada categoría de intención, el nivel de autonomía asignado y, si corresponde, las condiciones de confianza para automatización condicionada.
- **Respuesta pendiente de revisión**: una respuesta generada por el agente que no se envió automáticamente, con su categoría de intención detectada, el motivo por el que quedó pendiente, y su estado (pendiente, enviada tal cual, editada y enviada, descartada).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los negocios que no configuran esta funcionalidad no experimentan ningún cambio en el envío automático de respuestas.
- **SC-002**: El 100% de los mensajes clasificados en una categoría configurada como exclusivamente humana no reciben una respuesta automática.
- **SC-003**: El 100% de las respuestas generadas bajo un nivel de revisión quedan visibles y accionables por un agente humano en menos de 3 pasos.
- **SC-004**: Ningún mensaje queda sin ninguna respuesta posible ni sin ninguna vía de atención por un fallo de clasificación — siempre se resuelve hacia el comportamiento por defecto o hacia la bandeja de revisión humana.

## Assumptions

- El catálogo de categorías de intención de esta spec es independiente del catálogo `IntencionComercial` de `011` — ambos coexisten con propósitos distintos (autonomía de envío vs. selección de estrategia de venta).
- La clasificación de categoría de mensaje usa el gateway de IA ya existente (candidata natural al enrutamiento económico de `010`, por ser una tarea de clasificación, no una conversación en tiempo real).
- Las "condiciones de confianza" de `ConditionalAutomation` se definen en esta spec de forma simple y verificable (por ejemplo, un umbral de confianza de la propia clasificación, o la ausencia de señales de ambigüedad/cliente molesto del perfil de `012` cuando esté disponible) — no se construye un motor de reglas complejo; el detalle exacto de qué condiciones ofrecer se resuelve en el plan de implementación, priorizando algo simple y explicable sobre algo sofisticado.
- Esta spec no activa ninguna automatización nueva por sí misma — solo entrega el mecanismo y una clasificación inicial sugerida que cada negocio debe revisar y decidir si adoptar tal cual o ajustar.
- Fuera de alcance: el registro completo de aprendizaje supervisado (qué se corrigió, con qué confianza, etc.) — eso es `017-aprendizaje-supervisado-auditoria`, que consumirá el registro de edición humana que FR-012 ya deja disponible.
