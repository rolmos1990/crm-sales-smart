# Feature Specification: Acceso al login/configuración de Facebook Messenger desde Integraciones

**Feature Branch**: `[006-fix-facebook-messenger-setup]`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "he implementado la integracion para poder recibir mensajes y enviar de facebook (muy parecido a la integracion que mantengo de instagram) pero quedo con un problema cuando activo la integracion de Facebook Messenger solo dice Activar por ningun lado me deja configurar donde hago el Login y todo el proceso de Meta para poder registrar mi cuenta como una cuenta valida, actualmente solamente queda en activar y dice activado pero por algun motivo no hay pasos siguiente de configuracion, verifica lo que puede faltar de esta integracion para que quede correcta y haz los ajustes necesarios."

## Diagnóstico previo (investigación de código)

Antes de definir el alcance, se investigó cómo "Activar" una integración desde la tarjeta genérica de Integraciones y por qué no lleva al login de Meta:

- La tarjeta genérica de cada integración (`CardIntegracion` en `lista-integraciones.tsx`, usada por la sección Integraciones para **todas** las integraciones del catálogo, incluida Facebook Messenger) maneja un ciclo `Instalar → Activar/Desactivar → Desinstalar` que es **puramente de catálogo**: solo escribe en una tabla genérica (`IntegracionInstancia`) que registra si la integración aparece como instalada/activa en el listado. No tiene ninguna relación con la conexión real de una cuenta (`CuentaCanal`) ni con el flujo de OAuth de Meta.
- Esa misma tarjeta ya resuelve este problema para las otras dos integraciones de mensajería que sí requieren login externo: cuando `instalada.estado === "ACTIVA"`, muestra un botón adicional **"Configurar"** que enlaza a la página dedicada de cada una (`/integraciones/whatsapp-lite` para WhatsApp Lite, `/integraciones/instagram` para Instagram) — ahí es donde vive el botón real de "Conectar" que dispara el login de Meta.
- **La condición que muestra ese botón "Configurar" está codificada explícitamente por integración** (`integracion.clave === "whatsapp_lite"` / `"instagram"`) — Facebook Messenger nunca se agregó a esa condición, aunque la página dedicada con su propio flujo de login (`/integraciones/facebook-messenger`, con su botón "Conectar Facebook Messenger" que dispara `/api/integraciones/facebook-messenger/oauth`) **ya existe y ya funciona**, construida en `005-facebook-messenger-integracion`.
- Conclusión: no falta ninguna pieza de la integración de Facebook Messenger en sí (conexión, login, recepción/envío de mensajes) — falta exclusivamente el enlace desde la tarjeta genérica de "Activar" hacia la página donde ese login ya está disponible. Es el mismo síntoma que reportó el usuario ("queda en Activar, activado, sin pasos siguientes") explicado por una condición de UI incompleta, no por un flujo de Meta faltante.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Llegar al login de Meta después de activar Facebook Messenger (Priority: P1)

Como responsable de la integración, después de instalar y activar Facebook Messenger desde la sección de Integraciones, quiero ver un acceso claro para configurarla — que me lleve a conectar mi Página de Facebook con Meta — en lugar de quedarme en un estado "Activado" sin ningún paso siguiente.

**Why this priority**: Es el bloqueo reportado — sin este acceso, la integración activada es inutilizable: no hay forma de conectar una cuenta real ni de recibir/enviar mensajes.

**Independent Test**: Instalar y activar Facebook Messenger desde Integraciones y confirmar que aparece un botón/enlace de configuración que lleva a la pantalla donde se inicia el login con Meta.

**Acceptance Scenarios**:

1. **Given** que instalé Facebook Messenger y lo activé desde la tarjeta de Integraciones, **When** miro la tarjeta ya activada, **Then** veo un botón "Configurar" (igual que ya existe para WhatsApp e Instagram) que me lleva a la pantalla de Facebook Messenger.
2. **Given** que estoy en la pantalla de configuración de Facebook Messenger, **When** no tengo ninguna Página conectada todavía, **Then** veo el botón para iniciar el login de Meta y conectar mi Página, igual que ya funciona en esa pantalla hoy.
3. **Given** que ya conecté una Página de Facebook, **When** vuelvo a la tarjeta de Integraciones, **Then** el botón "Configurar" me sigue llevando a esa misma pantalla, donde veo la Página ya conectada.

### Edge Cases

- ¿Qué pasa si el usuario instala Facebook Messenger pero todavía no lo activa? No debe verse el botón "Configurar" — mismo comportamiento ya existente para WhatsApp e Instagram (el botón solo aparece con `estado === "ACTIVA"`).
- ¿Qué pasa con las integraciones que no tienen una pantalla de configuración propia (por ejemplo Mailchimp, Stripe, todavía sin implementar)? No deben verse afectadas — el ajuste se limita a agregar Facebook Messenger a la condición existente, sin cambiar el comportamiento de ninguna otra integración.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar, en la tarjeta de Facebook Messenger dentro de Integraciones, un botón "Configurar" cuando la integración esté activa (`estado === "ACTIVA"`) — mismo criterio y mismo lugar ya usados para WhatsApp Lite e Instagram.
- **FR-002**: El botón "Configurar" de Facebook Messenger MUST llevar a la pantalla dedicada donde ya está disponible el inicio del login con Meta para conectar una Página (`/integraciones/facebook-messenger`).
- **FR-003**: El sistema MUST NOT alterar el comportamiento de "Configurar" ya existente para WhatsApp Lite e Instagram, ni el ciclo genérico de Instalar/Activar/Desactivar/Desinstalar para el resto de integraciones del catálogo.
- **FR-004**: El sistema MUST NOT modificar el flujo de login de Meta ni la lógica de conexión de Facebook Messenger ya construidos en `005-facebook-messenger-integracion` — el alcance es exclusivamente exponer el acceso a esa pantalla desde la tarjeta genérica.

### Key Entities

- **Integración instalada (`IntegracionInstancia`)**: registro de catálogo que ya existe (instalada/activa) — esta corrección no le agrega campos, solo cambia qué botón se muestra en la UI según su `estado` y su `clave`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde que un responsable de la integración activa Facebook Messenger, puede llegar al login de Meta en un solo clic adicional, sin necesidad de conocer o escribir la URL de la pantalla de configuración.
- **SC-002**: El comportamiento de "Configurar" para WhatsApp Lite e Instagram, y el ciclo Instalar/Activar/Desactivar/Desinstalar de cualquier otra integración del catálogo, no cambia en absoluto tras esta corrección.

## Assumptions

- Se investigó el código de la tarjeta genérica de Integraciones (`lista-integraciones.tsx`) y se confirmó que el botón "Configurar" ya existe como patrón (usado por WhatsApp Lite e Instagram) pero su condición de visibilidad no incluye la clave `"facebook_messenger"` — no falta construir ninguna pantalla ni flujo nuevo, la pantalla y el login de Meta (`/integraciones/facebook-messenger`) ya existen y funcionan (`005-facebook-messenger-integracion`).
- El ciclo genérico Instalar/Activar/Desactivar/Desinstalar del catálogo (tabla `IntegracionInstancia`) es independiente de la conexión real de la cuenta (`CuentaCanal`) para las tres integraciones de mensajería — esta corrección no cambia esa relación, solo agrega el enlace de navegación faltante.
- No se requiere ningún cambio de datos ni migración — es una corrección de interfaz.
