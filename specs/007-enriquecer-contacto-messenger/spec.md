# Feature Specification: Enriquecer el contacto al recibir mensajes de Facebook Messenger

**Feature Branch**: `[007-enriquecer-contacto-messenger]`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "en la integracion actual de facebook puedes verificar si en la informacion que retorna el API podemos inyectar parte de informacion del contacto (ejemplo: Nombre, Email, Telefono o lo que nos entregue el Api como tal para llenar un poco mas de infomracion cuando creamos el contacto, si es posible foto de perfil, asi como hacemos en la integracion de instagram para poblar un poco mas el contacto), actualmente hice una prueba escribiendo de mi Facebook y pude notar que no se llena la informacion que te indico, necesito poder corregir esto para la integracion de Facebook."

## Diagnóstico previo (investigación de código + documentación de Meta)

Antes de definir el alcance, se investigó qué datos de contacto entrega realmente la API de Meta para Facebook Messenger, y por qué el código actual no completa ninguno:

- **Instagram ya hace este enriquecimiento hoy**: al recibir un mensaje nuevo, si el contacto no tiene nombre o foto guardados, el sistema le pide a la API de Meta el nombre y la foto de perfil de esa cuenta de Instagram y completa el contacto automáticamente (`obtenerPerfilRemitenteIG`, ya en producción).
- **Facebook Messenger nunca hace esa misma consulta** — confirmado en el código: para cualquier mensaje que se resuelve como Messenger, el "perfil" que se usa para completar el contacto queda vacío a propósito (`perfil = {}`), sin llamar a ningún endpoint. Esta fue una decisión explícita al construir la integración (`005-facebook-messenger-integracion`), documentada entonces como "no verificado que el mismo endpoint de Instagram aplique igual a un contacto de Messenger" — es decir, no se sabía todavía si Meta ofrecía ese dato para Messenger. Por eso la prueba del usuario no completó nada: no es un error de conexión ni de permisos, es que el código nunca lo intenta.
- **Se confirmó contra la documentación oficial de Meta (Messenger Platform, User Profile API) qué datos existen realmente**:
  - **Nombre y foto de perfil**: SÍ están disponibles, con el mismo tipo de consulta que ya usa Instagram (`GET /{id-del-contacto}?fields=...` sobre la misma API de Meta) — es técnicamente viable replicar el mismo patrón.
  - **Email y teléfono**: Meta **no los entrega** a través de esta integración bajo ninguna circunstancia — no es una limitación de permisos ni de configuración, la API de Messenger simplemente no expone esos datos a las apps de negocio. Instagram tiene la misma limitación hoy (tampoco entrega teléfono ni email) — no es un retroceso respecto a lo que ya existe, es el mismo límite de la plataforma de Meta en ambos canales.
  - **Requisito adicional no resuelto todavía**: para poder pedirle a Meta el nombre y la foto de un contacto de Messenger en producción (para clientes reales, no solo para pruebas hechas por un administrador de la app), Meta exige aprobar una función adicional en el proceso de revisión de la app — algo que hoy no está solicitado. Sin esa aprobación, la consulta solo funciona para pruebas hechas por alguien que administra la app (como la prueba que hizo el usuario), no para los clientes reales que le escriban a la Página una vez en producción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el nombre y la foto del contacto al recibir un mensaje de Messenger (Priority: P1)

Como agente que atiende conversaciones de Facebook Messenger, cuando un cliente nuevo me escribe por primera vez, quiero ver su nombre y su foto de perfil en el contacto que se crea automáticamente, en lugar de un contacto sin nombre ni foto, para poder identificar con quién estoy hablando igual que ya puedo hacerlo hoy con los contactos de Instagram.

**Why this priority**: Es el pedido explícito del usuario y el valor central de la corrección — sin esto, cada conversación nueva de Messenger llega con un contacto vacío que hay que completar a mano.

**Independent Test**: Escribirle a una Página conectada desde una cuenta de Facebook de prueba que tenga nombre y foto de perfil públicos, y confirmar que el contacto creado en el CRM ya trae ese nombre y esa foto, sin que el agente tenga que completarlos manualmente.

**Acceptance Scenarios**:

1. **Given** un contacto nuevo (sin conversación previa) le escribe por primera vez a una Página de Messenger conectada, **When** el mensaje llega al CRM, **Then** el contacto que se crea automáticamente ya tiene el nombre del remitente, igual que ya sucede hoy con Instagram.
2. **Given** ese mismo contacto tiene una foto de perfil pública, **When** se crea el contacto, **Then** la foto de perfil queda asociada al contacto.
3. **Given** un contacto que ya existe en el CRM con nombre y foto ya completados (por Messenger o por cualquier otro canal), **When** vuelve a escribir por Messenger, **Then** el sistema no sobrescribe esos datos ya completados — mismo criterio que ya aplica hoy para Instagram (no gastar una consulta a Meta ni pisar información que el agente ya haya editado a mano).

### Edge Cases

- ¿Qué pasa si el contacto no tiene nombre o foto de perfil públicos, o Meta no puede entregarlos? El contacto se crea igual, sin esos datos — mismo comportamiento que ya tiene Instagram en ese caso (no bloquea la creación de la conversación).
- ¿Qué pasa mientras la función adicional de Meta para acceder a este dato todavía no está aprobada para producción? El sistema debe intentarlo igual (funciona para pruebas hechas por administradores de la app) y, si Meta lo rechaza, debe seguir creando el contacto sin nombre/foto en lugar de fallar — mismo criterio de tolerancia a fallos que ya usa Instagram cuando la consulta de perfil no responde.
- ¿Qué pasa con el email y el teléfono que pidió el usuario? No se completan — Meta no los entrega para Messenger (ni para Instagram, hoy). Se documenta como límite de la plataforma, no como algo pendiente de corregir.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST pedirle a Meta el nombre del remitente cuando llegue un mensaje nuevo de Facebook Messenger de un contacto que todavía no tiene nombre guardado, y completar el contacto con ese dato si Meta lo entrega — mismo criterio que ya aplica a Instagram.
- **FR-002**: El sistema MUST pedirle a Meta la foto de perfil del remitente en las mismas condiciones que FR-001, y asociarla al contacto si Meta la entrega.
- **FR-003**: El sistema MUST NOT volver a consultar el nombre/foto de un contacto que ya los tiene completados — mismo criterio de "no volver a pedir si ya lo tenemos" que ya aplica a Instagram.
- **FR-004**: El sistema MUST seguir creando el contacto y la conversación con normalidad cuando Meta no pueda entregar el nombre o la foto (por falta de aprobación, por privacidad del contacto, o por cualquier otro motivo) — nunca debe bloquear la recepción del mensaje por esto.
- **FR-005**: El sistema MUST NOT prometer ni intentar completar email o teléfono desde Facebook Messenger — Meta no entrega esos datos a través de esta integración.
- **FR-006**: El sistema MUST NOT alterar el comportamiento ya existente de enriquecimiento de contactos de Instagram al agregar esto para Facebook Messenger.

### Key Entities

- **Contacto**: ya existe en el CRM; esta corrección solo cambia qué tan completo llega automáticamente cuando se crea a partir de un mensaje de Messenger (nombre, foto de perfil) — sin campos nuevos.
- **Cuenta de canal (Facebook Messenger)**: la Página conectada — sin cambios; se usa la misma credencial ya guardada para pedirle el dato a Meta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cuando un contacto de Messenger con nombre público le escribe por primera vez a una Página conectada (en un entorno donde la función de Meta ya esté aprobada, o el remitente sea un tester de la app), el contacto se crea con su nombre completado, sin que el agente tenga que escribirlo a mano.
- **SC-002**: Cuando ese mismo contacto tiene foto de perfil pública, la foto queda visible en el contacto sin intervención manual.
- **SC-003**: Ningún contacto que ya tenía nombre/foto completados los pierde o los ve sobrescritos después de este cambio.
- **SC-004**: Un mensaje de un contacto sin nombre/foto disponible (o mientras la aprobación de Meta está pendiente) sigue llegando al inbox con normalidad, sin errores visibles para el agente.

## Assumptions

- Se investigó la documentación oficial de Meta para Facebook Messenger y se confirmó que nombre y foto de perfil son datos que la plataforma sí puede entregar (mismo tipo de consulta que ya usa Instagram); email y teléfono no están disponibles bajo ninguna circunstancia — se excluyen del alcance por ser un límite de la plataforma de Meta, no una decisión de producto.
- Completar el nombre/foto en producción (para clientes reales, no solo para quienes administran la app) depende de que Meta apruebe una función adicional en el proceso de revisión de la app — igual que ya sucede con Human Agent para Instagram. Esta corrección deja el código listo para cuando esa aprobación llegue, y funciona de inmediato en pruebas hechas por administradores de la app (como la prueba que ya hizo el usuario), sin bloquear el resto de la integración de Messenger mientras tanto.
- No se requiere ningún cambio de datos ni migración — se reutiliza el modelo de contacto ya existente.
