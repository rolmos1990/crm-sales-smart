# Feature Specification: Perfil dinámico del cliente

**Feature Branch**: `[012-perfil-dinamico-cliente]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Implementar un servicio que construya un perfil actual del cliente usando información real de Karia: tipo de relación, intención comercial actual, número de pedidos completados, fechas de primera interacción y última compra, productos comprados/consultados, preferencias, zona habitual, método de entrega habitual, presupuesto conocido, ocasión, fecha requerida, oportunidades abiertas, cotizaciones activas, incidencias activas, resumen reciente. Separar información objetiva de interpretaciones de IA. No usar etiquetas subjetivas. Actualizar cuando cambie información relevante, no regenerar todo en cada mensaje."

## Diagnóstico previo (investigación de código)

- Karia no tiene hoy ningún concepto de "perfil de cliente" — el contexto que hoy se arma para el agente de IA (`construirContexto`, `src/ai/contexto/constructor.ts`) solo trae nombre/email/empresa del contacto y título/etapa/valor de una oportunidad activa. Nada de historial de pedidos, cotizaciones, ni intención.
- Los datos objetivos que este perfil necesita **ya existen y son consultables** en el schema actual: `Pedido` (con `estado`, fechas, `contactoId`), `Cotizacion` (`estado`, `contactoId`), `Oportunidad`/`OportunidadContacto` (con `fechaGanada`/`fechaPerdida` ya usadas hoy para filtrar "activas" en `customer.tool.ts`), `Conversacion` (con `clasificacion: ClasificacionConversacion` — `SOPORTE` es la señal más cercana a "incidencia activa" ya existente en el sistema), y `Contacto.creadoEn` (primera interacción).
- **No existe ningún campo hoy** para presupuesto, ocasión, fecha requerida, ni "productos consultados" — no hay ninguna tabla que registre qué productos se buscaron en una conversación (la tool `buscar_productos` ejecuta la búsqueda pero no persiste qué se buscó ni con qué resultado). Estos datos, cuando existan, solo pueden obtenerse interpretando el contenido de la conversación (extracción de datos vía IA), nunca de una tabla estructurada ya poblada — de ahí la separación pedida explícitamente entre "objetivo" e "interpretado por IA".
- El schema no tiene tampoco un modelo `Direccion` separado ni un campo de "zona habitual" en `Contacto` — `metodoEntrega` vive por documento (`Cotizacion.metodoEntrega`, `Pedido.metodoEntrega`), no como preferencia persistente del contacto. "Zona/método de entrega habitual" debe derivarse (el más frecuente entre los pedidos/cotizaciones históricos del contacto), no leerse de un campo directo.
- Karia usa RabbitMQ con consumidores idempotentes para reaccionar a eventos de dominio ya existentes (`OportunidadCreada`, `EtapaCambiada`, `OportunidadGanada/Perdida`, patrón visible en `src/suscriptores/`) — es el mecanismo natural para invalidar/actualizar el perfil de forma incremental sin recalcularlo en cada mensaje, tal como pide el requisito.
- Esta spec no depende de `011-playbook-estrategia-comercial` para construirse (calcula datos propios), pero el vocabulario de `TipoRelacionCliente`/`IntencionComercial` ya fue definido en `011` (`src/ai/estrategia/tipos.ts`) para que ambas specs queden alineadas — esta spec reutiliza esos tipos en vez de redefinirlos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el perfil objetivo de un cliente basado en datos reales (Priority: P1)

Como agente de ventas/soporte, quiero ver un resumen del perfil actual de un contacto — su tipo de relación, historial de pedidos, oportunidades y cotizaciones activas, y un resumen reciente — para entender rápido con quién estoy hablando sin tener que revisar manualmente cada módulo del CRM.

**Why this priority**: Es el valor central y la base de datos objetiva sobre la que todo lo demás (intención, interpretaciones) se apoya.

**Independent Test**: Abrir el perfil de un contacto con historial real (al menos un pedido completado y una oportunidad abierta) y verificar que el perfil calculado refleja esos datos correctamente.

**Acceptance Scenarios**:

1. **Given** un contacto con pedidos completados, **When** se calcula su perfil, **Then** el número de pedidos completados, la fecha de primera interacción y la fecha de última compra coinciden con los datos reales del contacto.
2. **Given** un contacto con oportunidades abiertas y cotizaciones activas, **When** se calcula su perfil, **Then** ambas listas aparecen reflejadas.
3. **Given** un contacto con una conversación clasificada como soporte sin resolver, **When** se calcula su perfil, **Then** se refleja como incidencia activa.
4. **Given** un contacto recién creado sin ningún historial, **When** se calcula su perfil, **Then** se clasifica como "nuevo contacto", sin errores ni datos inventados.
5. **Given** cualquier perfil calculado, **When** se revisa su contenido, **Then** no contiene ninguna etiqueta subjetiva o despectiva (por ejemplo "cliente difícil", "cliente tacaño") — solo señales objetivas expresadas como hechos verificables.

---

### User Story 2 - Distinguir claramente lo objetivo de lo interpretado por IA (Priority: P1)

Como responsable de negocio, quiero que el perfil del cliente muestre por separado los datos que provienen directamente de registros del CRM (objetivos) y los que son una interpretación generada a partir de la conversación (presupuesto, ocasión, preferencias, productos consultados), para no confundir un hecho verificado con una suposición.

**Why this priority**: Es un requisito explícito y no negociable del pedido original — mezclar ambos tipos de dato socava la confianza en el perfil completo.

**Independent Test**: Calcular el perfil de un contacto donde se haya extraído un presupuesto mencionado en una conversación, y confirmar que ese dato aparece marcado como interpretado, distinto de los datos de pedidos/oportunidades marcados como objetivos.

**Acceptance Scenarios**:

1. **Given** un perfil calculado, **When** se inspecciona su contenido, **Then** cada dato está clasificado inequívocamente como "objetivo" (proviene de un registro del CRM) o "interpretado" (extraído por IA de una conversación).
2. **Given** un dato interpretado (por ejemplo presupuesto u ocasión), **When** se muestra, **Then** se indica que es una interpretación, no un hecho confirmado.
3. **Given** que todavía no hay ninguna interpretación disponible para un contacto (conversación insuficiente), **When** se calcula su perfil, **Then** los campos interpretados aparecen ausentes, no con datos inventados ni con ceros/valores por defecto engañosos.

---

### User Story 3 - Actualizar el perfil solo cuando cambia algo relevante (Priority: P2)

Como responsable técnico, quiero que el perfil de un cliente se actualice cuando ocurre un evento relevante (nuevo pedido, cambio de etapa de oportunidad, nueva cotización, nueva clasificación de conversación), no que se recalcule por completo cada vez que el cliente envía un mensaje, para evitar costo y latencia innecesarios.

**Why this priority**: Es un requisito de eficiencia explícito del pedido — no bloquea el valor de las Historias 1 y 2, pero es necesario antes de integrar el perfil en el flujo de generación de respuesta en tiempo real (specs posteriores).

**Independent Test**: Calcular el perfil de un contacto, luego registrar un pedido nuevo para ese contacto, y verificar que el perfil se actualiza reflejando el nuevo pedido sin necesidad de que llegue un mensaje de conversación.

**Acceptance Scenarios**:

1. **Given** un perfil ya calculado y vigente, **When** ocurre un evento relevante para ese contacto (pedido completado, cambio de etapa de oportunidad, nueva cotización, nueva clasificación de conversación), **Then** el perfil se actualiza para reflejarlo sin que sea necesario un nuevo mensaje del cliente.
2. **Given** un perfil ya calculado y vigente, **When** no ocurre ningún evento relevante, **Then** el perfil no se recalcula por completo en cada mensaje entrante — se reutiliza el ya calculado.

### Edge Cases

- ¿Qué pasa si un contacto no tiene ninguna interacción registrada más allá de su creación? El sistema MUST devolver un perfil válido con tipo de relación "nuevo contacto" y el resto de los campos objetivos vacíos, sin error.
- ¿Qué pasa si dos eventos relevantes para el mismo contacto llegan casi al mismo tiempo? El sistema MUST terminar en un estado consistente (el perfil refleja ambos cambios), sin condición de carrera que pierda uno de los dos.
- ¿Qué pasa si la interpretación de IA (presupuesto, ocasión, preferencias) falla o no está disponible? El sistema MUST devolver el resto del perfil (los datos objetivos) igualmente, marcando los campos interpretados como no disponibles, no como un fallo total.
- ¿Qué pasa si se pide el perfil de un contacto de otra instancia? El sistema MUST rechazarlo — aislamiento multi-tenant, igual que el resto del sistema.
- ¿Qué pasa si un pedido o cotización cambia de estado y eso hace que ya no cuente como "activa"? El perfil MUST reflejar el nuevo estado en su próxima actualización relevante, no seguir contando algo que ya no aplica.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST calcular, para cualquier contacto de una instancia, un perfil que incluya: tipo de relación, número de pedidos completados, fecha de primera interacción, fecha de última compra, productos comprados, oportunidades abiertas, cotizaciones activas, incidencias activas, y un resumen reciente en lenguaje natural compuesto únicamente por hechos verificables.
- **FR-002**: El sistema MUST distinguir explícitamente, en la estructura del perfil, entre datos objetivos (derivados directamente de registros existentes del CRM) y datos interpretados (extraídos por IA a partir del contenido de conversaciones): intención comercial actual, productos consultados, preferencias identificadas, zona/método de entrega habitual derivado por frecuencia, presupuesto conocido, ocasión actual, fecha requerida.
- **FR-003**: El sistema MUST NOT usar etiquetas subjetivas o despectivas en ningún campo del perfil; toda observación MUST expresarse como un hecho verificable (por ejemplo: "ha solicitado comparar precios en 3 conversaciones", no "es indeciso").
- **FR-004**: El sistema MUST permitir consultar el perfil de un contacto sin necesidad de que exista una conversación en curso.
- **FR-005**: El sistema MUST actualizar el perfil de un contacto cuando ocurra un evento de dominio relevante para él (pedido creado/completado, cambio de etapa de una oportunidad, cotización creada/cambiada de estado, conversación reclasificada), sin esperar a que llegue un nuevo mensaje.
- **FR-006**: El sistema MUST NOT recalcular por completo el perfil de un contacto en cada mensaje entrante de una conversación cuando no hay ningún evento relevante nuevo desde el último cálculo.
- **FR-007**: El sistema MUST devolver el perfil con los datos objetivos disponibles incluso cuando la interpretación de IA no esté disponible o falle.
- **FR-008**: El sistema MUST restringir la consulta y el cálculo del perfil de un contacto a la instancia a la que pertenece ese contacto.
- **FR-009**: El sistema MUST clasificar el tipo de relación de cualquier contacto (incluyendo uno sin historial) usando el catálogo cerrado ya definido (`NUEVO_CONTACTO`, `PROSPECTO_RECURRENTE`, `CLIENTE_NUEVO`, `CLIENTE_REGULAR`, `CLIENTE_INACTIVO`, `CLIENTE_CON_INCIDENCIA`).

### Key Entities *(include if feature involves data)*

- **Perfil de cliente**: fotografía vigente del estado de un contacto, con dos bloques diferenciados — datos objetivos (calculados desde registros existentes) y datos interpretados (extraídos por IA, cada uno marcado como tal). Pertenece a un contacto de una instancia; se recalcula de forma incremental, no en cada mensaje.
- **Evento relevante de actualización**: un suceso de dominio ya existente en Karia (pedido, oportunidad, cotización, conversación) que dispara la actualización del perfil del contacto afectado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dado cualquier contacto con historial real en Karia, su perfil calculado refleja exactamente sus pedidos completados, oportunidades abiertas y cotizaciones activas, verificable contra los datos fuente.
- **SC-002**: El 100% de los campos interpretados por IA en cualquier perfil quedan visualmente/estructuralmente distinguibles de los campos objetivos.
- **SC-003**: Ningún perfil generado contiene una etiqueta subjetiva o despectiva, verificable por revisión de una muestra de perfiles generados.
- **SC-004**: El perfil de un contacto se actualiza en respuesta a un evento relevante sin requerir un nuevo mensaje de conversación.
- **SC-005**: Un contacto sin ningún historial obtiene un perfil válido (sin error) en el primer cálculo.

## Assumptions

- "Productos consultados" depende de que exista un registro de qué se buscó en el catálogo durante una conversación; en esta spec se calcula como dato interpretado de mejor esfuerzo a partir del contenido de la conversación (extracción de datos vía IA), no de un log estructurado de ejecuciones de herramientas — capturar ese log estructurado, si se decide más adelante, es una mejora incremental fuera de este alcance.
- "Zona/método de entrega habitual" se deriva por frecuencia entre los pedidos y cotizaciones históricos del contacto (el más repetido), no de un campo de preferencia explícito — Karia no tiene hoy un campo de dirección/zona persistente por contacto.
- El vocabulario de tipo de relación e intención comercial es el mismo catálogo cerrado ya definido en `011-playbook-estrategia-comercial` (`src/ai/estrategia/tipos.ts`), reutilizado aquí sin redefinirse.
- "Incidencia activa" se interpreta, con los datos hoy disponibles, como una conversación clasificada `SOPORTE` sin resolución registrada — es la señal objetiva más cercana ya existente; una noción más rica de "incidencia" (ticket dedicado) no existe hoy en Karia y está fuera de este alcance.
- Esta spec construye el servicio de perfil y su exposición para consulta (por ejemplo, desde la ficha del contacto); no integra el perfil dentro del prompt del agente ni de las herramientas de IA — eso es responsabilidad de `013-context-builder-capas-precedencia` y `015-herramientas-operativas-inventario-envios-acciones`, que consumirán este servicio.
