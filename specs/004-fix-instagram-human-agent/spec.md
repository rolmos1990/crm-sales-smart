# Feature Specification: Diagnóstico claro de envíos de Instagram fuera de la ventana de 24h (Human Agent)

**Feature Branch**: `[004-fix-instagram-human-agent]`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "necesito solucionar el problema que tengo que no puedo enviar mensajes de instagram a clientes que tienen mas de 24 hora, actualmente manejo la integracion meta y en teoria tengo habilitado human agent ese permiso, es decir puedo responder de 24h a 7dias a clientes que hayan escrito, pero por algun motivo no me deja, necesito analizar y solucionar ese problema."

## Diagnóstico previo (investigación de código)

Antes de definir el alcance, se investigó la lógica actual de envío de Instagram (ventana de 24h/7 días, uso del tag `HUMAN_AGENT`, y la clasificación de errores que devuelve Meta):

- El sistema **ya intenta automáticamente** la extensión Human Agent para cualquier contacto entre 24 horas y 7 días desde su último mensaje — no hay ninguna condición ni interruptor en Karia que bloquee ese intento de este lado.
- No se encontró ningún error de lógica en el cálculo de la ventana, en el campo que identifica el último mensaje del contacto, ni en el formato de la solicitud que se le envía a Meta (que coincide con lo documentado por Meta para este caso).
- Cuando Meta rechaza uno de estos envíos, el motivo hoy queda registrado internamente, pero **se muestra al agente de forma muy poco visible**: un ícono pequeño que solo revela el motivo al pasar el mouse por encima, sin distinguir claramente "Meta no tiene aprobada la extensión Human Agent para esta cuenta" de otros motivos de fallo (ventana vencida hace más de 7 días, token vencido, error temporal de Meta).
- Conclusión: la causa más probable del síntoma reportado no es un error de lógica dentro de Karia, sino que **Meta esté rechazando específicamente estos envíos** (lo más común: la extensión Human Agent no está realmente aprobada para esta app/cuenta en el Meta App Dashboard — un permiso separado que Meta aprueba caso por caso, distinto de cualquier ajuste visible dentro de la cuenta de Instagram) — y que, al día de hoy, Karia no le muestra al agente esa información con la claridad suficiente para poder actuar. Ver Assumptions para el detalle completo y sus implicancias de alcance.

## Clarifications

### Session 2026-08-27

- Q: ¿Qué ves exactamente hoy cuando falla un envío de Instagram fuera de las 24h? → A: El mensaje aparece como enviado por un momento y luego se marca como fallido, con un ícono pequeño que solo revela el motivo al pasar el mouse por encima — confirma el comportamiento ya encontrado en el código (`burbuja-mensaje.tsx`). El trabajo es mejorar un aviso que ya existe pero es difícil de ver, no construir uno donde hoy no hay ninguno.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entender por qué un mensaje de Instagram no se entregó (Priority: P1)

Como agente que responde conversaciones de Instagram, cuando envío un mensaje a un contacto que escribió hace más de 24 horas (pero menos de 7 días) y el envío no se entrega, quiero ver de inmediato y con claridad el motivo específico (por ejemplo, "Meta no tiene aprobada la extensión para responder después de 24h en esta cuenta"), en lugar de un indicador pequeño que hay que descubrir pasando el mouse por encima.

**Why this priority**: Es el problema reportado directamente por el usuario. Sin un motivo claro, el agente no puede distinguir si es algo que Karia debe corregir o algo que debe resolver directamente con Meta, y termina sintiendo que "no lo deja enviar" sin entender por qué.

**Independent Test**: Provocar el rechazo de un envío fuera de la ventana de 24h (por ejemplo, respondiendo a un contacto cuyo último mensaje fue hace más de 24h en una cuenta donde Meta todavía no aprobó Human Agent) y verificar que el agente ve, sin necesidad de pasar el mouse por un ícono ni pedir ayuda técnica, un mensaje que identifica ese motivo específico.

**Acceptance Scenarios**:

1. **Given** un contacto de Instagram cuyo último mensaje fue hace entre 24 horas y 7 días, **When** el agente envía una respuesta y Meta la rechaza por no tener aprobada la extensión Human Agent, **Then** el agente ve un mensaje claro y visible (no oculto detrás de un hover) que identifica ese motivo específico, distinto de cualquier otro tipo de fallo.
2. **Given** un contacto de Instagram cuyo último mensaje fue hace más de 7 días, **When** el agente intenta responder, **Then** el agente ve un mensaje claro indicando que la ventana de respuesta ya venció por completo (más de 7 días), distinto del mensaje de "Human Agent no aprobado".
3. **Given** un envío falla por un motivo temporal (por ejemplo, un error pasajero de Meta), **When** el agente revisa el mensaje, **Then** ve una indicación de que el sistema reintentará, distinta de los motivos permanentes anteriores.

---

### User Story 2 - Verificar el estado de Human Agent sin depender de un envío fallido (Priority: P2)

Como responsable de la integración de Instagram, quiero poder comprobar desde Karia si la extensión Human Agent está realmente funcionando para mi cuenta, en lugar de enterarme solo cuando un agente reporta que un mensaje no llegó.

**Why this priority**: Reduce el tiempo hasta detectar el problema — hoy la única forma de descubrirlo es que alguien intente responder tarde a un contacto y note el fallo. Es de menor prioridad que la User Story 1 porque no es indispensable para resolver el caso puntual reportado, pero previene que vuelva a pasar desapercibido.

**Independent Test**: Desde la sección de Integraciones de Instagram, consultar el estado de Human Agent para una cuenta conectada y confirmar que refleja si los envíos recientes fuera de la ventana de 24h se entregaron o fueron rechazados por Meta.

**Acceptance Scenarios**:

1. **Given** una cuenta de Instagram conectada con intentos recientes de envío fuera de la ventana de 24h, **When** el responsable de la integración consulta su estado, **Then** ve si esos intentos se entregaron o fueron rechazados por Meta, sin tener que interpretar mensajes técnicos.

### Edge Cases

- ¿Qué pasa si Meta rechaza el envío por un motivo que el sistema no reconoce (no es "ventana vencida", ni "Human Agent no aprobado", ni un error temporal conocido)? El agente MUST ver igualmente que el mensaje no se entregó, con la mejor descripción disponible, en lugar de quedar en un estado ambiguo.
- ¿Qué pasa con mensajes que ya fallaron antes de esta corrección? No es necesario reprocesarlos automáticamente — la mejora aplica a partir de los envíos nuevos (ver Assumptions).
- ¿Qué pasa si el agente reintenta manualmente un mensaje que falló por "Human Agent no aprobado" sin que la aprobación de Meta haya cambiado? Debe fallar de nuevo con el mismo motivo claro — no se espera que el reintento lo resuelva, ya que la causa es externa a Karia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST seguir intentando automáticamente la extensión Human Agent para cualquier contacto de Instagram entre 24 horas y 7 días desde su último mensaje, sin requerir ninguna acción manual adicional del agente (comportamiento ya correcto, que esta corrección no debe alterar).
- **FR-002**: Cuando Meta rechaza un envío por no tener aprobada la extensión Human Agent para la cuenta, el sistema MUST mostrarle al agente ese motivo de forma clara y visible de inmediato — sin depender de un hover ni de un ícono que haya que descubrir — distinguiéndolo de otros motivos (ventana vencida por más de 7 días, token inválido, error temporal).
- **FR-003**: El sistema MUST distinguir visiblemente, para el agente, entre un mensaje entregado, uno pendiente de reintento por un error temporal, y uno que no se pudo entregar por un motivo permanente — cada caso con una explicación específica en el idioma del agente, no un estado genérico de "error".
- **FR-004**: El sistema MUST ofrecer, a quien administra la integración de Instagram, una forma de comprobar si la extensión Human Agent está funcionando para su cuenta (por ejemplo, si los intentos recientes de envío fuera de la ventana de 24h se entregaron o fueron rechazados), sin depender de que un agente reporte un mensaje fallido.
- **FR-005**: El sistema MUST NOT alterar el cálculo de la ventana de 24h/7 días, el uso del tag correcto para extenderla, ni ningún otro comportamiento de envío ya verificado como correcto — el alcance es exclusivamente mejorar el diagnóstico/visibilidad del resultado, no la lógica de la ventana en sí.

### Key Entities

- **Mensaje de conversación**: mensaje saliente hacia un contacto de Instagram; ya registra si se entregó o falló y por qué motivo internamente — esta especificación no cambia esos datos, solo cómo se comunican al agente.
- **Cuenta de canal (Instagram)**: la conexión de Instagram de la instancia; esta especificación no cambia su configuración, solo agrega visibilidad sobre el resultado de sus envíos recientes fuera de la ventana de 24h.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cuando un envío fuera de la ventana de 24h falla, el agente identifica el motivo exacto sin ayuda externa (sin pedir soporte técnico ni adivinar).
- **SC-002**: El 100% de los mensajes que Meta rechaza por falta de aprobación de Human Agent muestran ese motivo específico al agente, no un mensaje genérico de error.
- **SC-003**: Un responsable de la integración puede confirmar, desde dentro de Karia, si Human Agent está funcionando o siendo rechazado para su cuenta, sin depender de que un agente reporte un mensaje fallido.
- **SC-004**: Ningún envío dentro de la ventana normal de 24h ni el cálculo de la ventana de 7 días cambia de comportamiento respecto a como funciona hoy.

## Assumptions

- Se investigó el código de envío de Instagram (ventana de 24h/7 días, uso del tag `HUMAN_AGENT`, clasificación de errores de Meta) y se confirmó que la lógica actual ya es correcta: el sistema intenta automáticamente el tag Human Agent para cualquier contacto entre 24 horas y 7 días desde su último mensaje, sin ninguna condición que lo bloquee de este lado. No se encontró ningún error de lógica ni de formato en la solicitud a Meta.
- Por eso, la causa más probable del síntoma reportado no es un error de lógica dentro de Karia, sino que Meta esté rechazando estos envíos específicamente porque la extensión Human Agent no está realmente aprobada para esta app/cuenta en el Meta App Dashboard — un permiso que Meta aprueba caso por caso y que es independiente de cualquier ajuste visible dentro de la cuenta de Instagram del usuario.
- Esta corrección no puede forzar ni verificar la aprobación de Meta — eso ocurre fuera de Karia. El alcance es que, si Meta rechaza el envío por ese motivo, Karia se lo comunique al agente con total claridad, para que sepa que el siguiente paso es gestionar esa aprobación directamente con Meta.
- Los mensajes que ya fallaron antes de esta corrección no se reprocesan automáticamente — la mejora de diagnóstico aplica a los envíos nuevos a partir de su implementación.
- No se requiere ningún cambio en la ventana de 24h/7 días, en el tag enviado a Meta, ni en el resto de la lógica de envío ya verificada como correcta.
