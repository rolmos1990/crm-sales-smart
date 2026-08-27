# Feature Specification: Integración de Facebook Messenger en el CRM

**Feature Branch**: `[005-facebook-messenger-integracion]`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Necesito agregar la integracion con Facebook a traves de meta para poder recibir mensajes de Messenger Facebook (entiendo para eso serian los permisos de meta que ya tengo), esto debo hacerlo en Karia App y que recibe y se comporte lo mas estandar posible, integrados al Pipeline, conversaciones tal cual como puedo recibir los de instagram pero poder recibir los de Facebook, esto debe ser un componente en Integraciones que diga Facebook Messenger que permita activarlo y configurarlo, entiendo que ya debo tener en los .env las conexiones necesarias para el App de Meta que se necesita para el caso de facebook, solo verifica que este activo funcionando, recuerda que hay una parte que es asincrona y se comunica con eventos los webhook de los mensaje y creo que cuando se envia un mensaje, no debe modificar o afectar el flujo actual de instagram."

## Diagnóstico previo (investigación de código)

Antes de definir el alcance, se investigó cómo está construida hoy la integración de canales de mensajería (Instagram, WhatsApp) para entender qué se puede reutilizar y qué es genuinamente nuevo:

- Karia ya tiene una arquitectura de canales conectables (WhatsApp Business, WhatsApp Lite, Instagram): cada canal es un módulo independiente (conexión de cuenta, envío/recepción de mensajes, página propia en Integraciones) que se agrega al sistema sin modificar los canales existentes — confirmado en el registro de proveedores de mensajería y en el catálogo de integraciones.
- **Facebook Messenger no tiene hoy ningún código ni entrada en el catálogo de integraciones** — es una integración nueva de punta a punta, no una corrección sobre algo existente.
- El vínculo entre una conversación y el Pipeline (asignación automática de Oportunidad al pipeline/etapa configurados en la cuenta del canal) y el procesamiento asíncrono por eventos/webhook **ya son genéricos por canal** — no dependen de lógica específica de Instagram. Facebook Messenger puede sumarse a ese mismo mecanismo sin tocarlo.
- Las credenciales de la app de Meta que Karia ya usa para conectar Instagram vía Página de Facebook son la misma app de Meta que Facebook Messenger necesita, y el permiso `pages_messaging` que Messenger requiere para enviar/recibir mensajes ya está en proceso de aprobación ante Meta como parte de una extensión relacionada (Human Agent de Instagram, spec `004-fix-instagram-human-agent`) — esto confirma la expectativa del pedido de que la configuración de Meta de este lado ya está lista o en curso, y no hace falta gestionar una app de Meta nueva.
- Punto a resolver con cuidado durante la implementación (no cambia el alcance de este documento): hoy, los eventos de mensajería que llegan asociados a una Página de Facebook se interpretan exclusivamente como mensajes de una cuenta de Instagram vinculada a esa Página. Al sumar Facebook Messenger, el sistema deberá distinguir sin ambigüedad un mensaje nativo de Messenger de un mensaje de Instagram que llega por el mismo tipo de evento — ver Assumptions y Edge Cases.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conectar una Página de Facebook para Messenger (Priority: P1)

Como responsable de la integración, quiero conectar la Página de Facebook de mi negocio desde la sección de Integraciones para que los mensajes que los clientes envían por Messenger empiecen a llegar a Karia, de la misma forma en que hoy conecto una cuenta de Instagram.

**Why this priority**: Sin esto no existe la integración — es el punto de entrada de todo lo demás.

**Independent Test**: Desde Integraciones, conectar una Página de Facebook de prueba y confirmar que aparece listada como conectada y activa, con su nombre visible.

**Acceptance Scenarios**:

1. **Given** que no tengo ninguna Página de Facebook conectada, **When** entro a Integraciones y busco "Facebook Messenger", **Then** veo un componente dedicado que me permite iniciar la conexión.
2. **Given** que inicio la conexión y autorizo el acceso a mi Página de Facebook, **When** el proceso termina, **Then** la Página aparece en el panel de Facebook Messenger como conectada y activa.
3. **Given** que tengo más de una Página de Facebook, **When** conecto varias, **Then** cada una aparece listada de forma independiente — igual que hoy pasa con varias cuentas de Instagram.

---

### User Story 2 - Recibir y responder conversaciones de Messenger desde el inbox del CRM (Priority: P1)

Como agente de ventas/soporte, quiero que los mensajes que un cliente me escribe por Facebook Messenger aparezcan en el mismo inbox de conversaciones donde ya veo Instagram y WhatsApp, y poder responderlos desde ahí, sin usar una herramienta aparte.

**Why this priority**: Es el valor central del pedido — que Facebook se reciba y se comporte "lo más estándar posible", igual que los demás canales.

**Independent Test**: Enviar un mensaje de prueba por Messenger a una Página conectada y verificar que aparece en el inbox de Karia en tiempo real; responder desde Karia y verificar que el cliente lo recibe en Messenger.

**Acceptance Scenarios**:

1. **Given** una Página de Facebook conectada, **When** un cliente envía un mensaje de texto por Messenger, **Then** el mensaje aparece en una conversación nueva (o existente) del inbox de Karia, identificado claramente como proveniente de Facebook Messenger.
2. **Given** una conversación de Messenger abierta en Karia, **When** el agente escribe y envía una respuesta, **Then** el cliente la recibe en su chat de Messenger.
3. **Given** que el cliente envía una imagen o un video por Messenger, **When** llega a Karia, **Then** se muestra correctamente en la conversación — igual que ya ocurre hoy con Instagram.

---

### User Story 3 - Las conversaciones de Messenger se integran al Pipeline como cualquier otro canal (Priority: P2)

Como responsable comercial, quiero que una conversación nueva de Messenger pueda generar o asociarse a una Oportunidad en el pipeline configurado para esa Página, igual que ya sucede con Instagram y WhatsApp, para no perder seguimiento comercial de esos contactos.

**Why this priority**: Es el valor de negocio explícito del pedido ("integrados al Pipeline"), pero depende de que las historias P1 anteriores ya funcionen — sin conversaciones no hay nada que asociar al pipeline.

**Independent Test**: Configurar un pipeline y etapa para la Página conectada, recibir una conversación nueva por Messenger de un contacto no existente, y confirmar que se refleja en el pipeline igual que las demás.

**Acceptance Scenarios**:

1. **Given** una Página de Facebook Messenger conectada con un pipeline y etapa configurados, **When** llega una conversación nueva de un contacto que no existía en el CRM, **Then** el sistema la asocia siguiendo la misma regla que ya usa para Instagram y WhatsApp.

---

### User Story 4 - Confirmar que la conexión de Facebook Messenger está realmente activa (Priority: P3)

Como responsable de la integración, quiero poder confirmar desde Karia que la conexión de una Página de Facebook Messenger está funcionando (credenciales válidas, recibiendo eventos), sin depender de esperar a que llegue o falle un mensaje real para enterarme de un problema.

**Why this priority**: Pedido explícito del usuario ("solo verifica que esté activo funcionando"). Es una mejora de visibilidad sobre algo que ya debe funcionar por las historias anteriores — no bloquea el valor central, pero evita descubrir un problema tarde.

**Independent Test**: Desde el panel de Facebook Messenger, consultar el estado de una Página conectada y ver si está activa/funcionando o si hay un problema de conexión.

**Acceptance Scenarios**:

1. **Given** una Página conectada, **When** el responsable revisa su estado en el panel, **Then** ve si la conexión está activa o si hay un problema (por ejemplo, credenciales inválidas o la Página desconectada del lado de Meta).

### Edge Cases

- ¿Qué pasa si la misma Página de Facebook ya está conectada a Instagram (por tener una cuenta de Instagram vinculada) y ahora también se conecta para Messenger? Ambos canales MUST convivir sin interferirse — un mensaje de Instagram sigue siendo de Instagram y uno de Messenger sigue siendo de Messenger, cada uno en su propia conversación, sin mezclarse ni duplicarse.
- ¿Qué pasa si un cliente escribe por Messenger fuera de la ventana estándar de respuesta de 24 horas? El sistema debe comportarse de forma consistente con lo ya resuelto para Instagram (ver `004-fix-instagram-human-agent`) en vez de fallar sin ninguna explicación para el agente.
- ¿Qué pasa si la Página se desconecta desde el lado de Meta (el usuario revoca el permiso) sin haberla desconectado primero desde Karia? El sistema MUST reflejar que la conexión dejó de estar activa la próxima vez que se intente usar, en lugar de fallar silenciosamente.
- ¿Qué pasa si llega un mensaje de un tipo no soportado (por ejemplo audio, sticker o ubicación)? El sistema MUST manejarlo sin romper la conversación, con el mismo criterio de "no soportado" que ya aplica hoy a Instagram.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir conectar una o más Páginas de Facebook desde un componente dedicado "Facebook Messenger" en la sección de Integraciones, siguiendo el mismo patrón de conexión/activación/desconexión ya usado por Instagram y WhatsApp.
- **FR-002**: El sistema MUST recibir los mensajes que los clientes envían por Facebook Messenger (texto, imagen, video) a una Página conectada y mostrarlos en el inbox de conversaciones del CRM en tiempo real, igual que ya ocurre con Instagram.
- **FR-003**: El sistema MUST permitir que un agente responda una conversación de Facebook Messenger desde el inbox del CRM, y esa respuesta MUST llegarle al cliente en su chat de Messenger.
- **FR-004**: El sistema MUST asociar automáticamente las conversaciones nuevas de Facebook Messenger al Pipeline y etapa configurados para la Página conectada, con la misma regla que ya aplica a los demás canales.
- **FR-005**: El sistema MUST procesar los mensajes entrantes y salientes de Facebook Messenger de forma asíncrona (por eventos/webhook), sin bloquear ni degradar la experiencia de envío/recepción de los demás canales.
- **FR-006**: El sistema MUST distinguir sin ambigüedad un mensaje de Facebook Messenger de un mensaje de Instagram, incluso cuando ambos lleguen asociados a la misma Página de Facebook conectada.
- **FR-007**: El sistema MUST NOT modificar el comportamiento actual de la integración de Instagram (conexión, recepción, envío, ventana de 24h/Human Agent) al agregar Facebook Messenger.
- **FR-008**: El sistema MUST permitir a quien administra la integración confirmar si la conexión de una Página de Facebook Messenger está activa y funcionando, sin depender de esperar un mensaje real para descubrir un problema.
- **FR-009**: El sistema MUST permitir desconectar una Página de Facebook Messenger conectada, deteniendo la recepción de nuevos mensajes para esa Página.

### Key Entities

- **Cuenta de canal (Facebook Messenger)**: la conexión de una Página de Facebook a una instancia de Karia — mismo concepto que ya existe para Instagram y WhatsApp, aplicado a un canal nuevo.
- **Conversación**: hilo de mensajes entre un contacto y la Página conectada — reutiliza el mismo modelo que ya usan los demás canales, sin cambios estructurales.
- **Mensaje de conversación**: mensaje individual (entrante o saliente) dentro de una conversación de Facebook Messenger — mismo modelo ya usado por Instagram, WhatsApp y Email.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un responsable de la integración puede conectar una Página de Facebook para Messenger en menos de 2 minutos, sin ayuda técnica.
- **SC-002**: El 100% de los mensajes de texto que un cliente envía por Messenger a una Página conectada llegan al inbox del CRM en menos de 10 segundos.
- **SC-003**: Un agente puede responder una conversación de Messenger desde el inbox del CRM y el cliente la recibe sin que el agente tenga que salir del CRM.
- **SC-004**: Ninguna conversación, envío o comportamiento existente de Instagram cambia después de activar Facebook Messenger — cero regresiones reportadas sobre el flujo de Instagram.
- **SC-005**: Un responsable de la integración puede confirmar si una Página de Facebook Messenger conectada está activa sin depender de que un cliente escriba primero.

## Assumptions

- Facebook Messenger admite conectar más de una Página por instancia, igual que Instagram admite conectar más de una cuenta — no se limita a una sola Página.
- El alcance de tipos de mensaje soportados (texto, imagen, video) replica lo que ya soporta Instagram hoy; audio, documentos, plantillas y botones quedan fuera de alcance, igual que están fuera de alcance para Instagram actualmente.
- La gestión de comentarios o menciones públicas de la Página (fuera de la mensajería directa) queda fuera de alcance — el pedido es específicamente sobre mensajes de Messenger, igual que Instagram solo cubre mensajes directos y no comentarios.
- La ventana estándar de 24 horas para responder y la extensión para agente humano (Human Agent) que ya existen para Instagram se replican para Facebook Messenger con el mismo criterio, en vez de dejar que los envíos tardíos fallen sin explicación — evita reproducir el problema que ya se corrigió para Instagram en `004-fix-instagram-human-agent`.
- Las credenciales de la app de Meta (App ID/Secret) y el permiso `pages_messaging` necesarios ya están configurados o en proceso de aprobación ante Meta (ver `004-fix-instagram-human-agent`); esta funcionalidad puede probarse en modo desarrollo con roles de tester en la app de Meta antes de que la revisión de Meta quede aprobada para producción.
- La integración de Facebook Messenger es independiente de si la misma Página tiene o no una cuenta de Instagram vinculada — conectar una no depende de la otra.
- No se requiere migrar ni reprocesar conversaciones o mensajes históricos — el alcance aplica a partir de que la integración quede activa.
