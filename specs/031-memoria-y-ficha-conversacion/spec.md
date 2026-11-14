# Feature Specification: Memoria conversacional configurable y ficha de conversación para el nodo "Atención IA"

**Feature Branch**: `[031-memoria-y-ficha-conversacion]`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Necesito que el agente del nodo Atención IA pueda leer los últimos 1-10 mensajes previos de la conversación, que eso se pueda activar o no y configurar en cantidad desde el mismo componente del Workflow, con un nombre corto y claro para el usuario. El agente debe entender por qué fase va y qué debe responder. Además, una ficha de lo que ya pidió o mostró: tema, producto, intención del cliente, etapa de compra, datos conocidos, pregunta abierta, último precio mostrado y resumen. Analizar y mejorar esto de acuerdo a la estructura actual de Karia, sin generar afectación."

## Clasificación

**Feature**, no Hotfix. El síntoma suena a corrección ("el agente responde sin contexto"), pero encaja en el caso `007` de `docs/SPEC-KIT-WORKFLOWS.md`: Karia nunca prometió que el nodo Atención IA pudiera configurar su memoria, ni que el agente llevara registro de qué ya preguntó o mostró. Son dos capacidades nuevas, no un comportamiento prometido que dejó de funcionar.

## Punto de partida (verificado en código antes de escribir el spec)

Esta sección documenta el estado real del sistema para que `/speckit-plan` no vuelva a investigarlo. No son requisitos.

1. **El agente ya lee mensajes previos, pero a ciegas.** `construirContexto` (`src/ai/contexto/constructor.ts:30`) trae `take: 30` fijo y `resolverDecisionContexto` (`src/ai/contexto/router.ts`) recorta con `(limiteTokensCtx − 2000) / 150`, tope 30 y piso 3. Con el default `limiteTokensCtx = 4000` el agente recibe **13 mensajes**. Nadie puede verlo ni cambiarlo desde el producto.
2. **Hay un parámetro declarado que nunca se usa.** `OpcionesContexto.maxMensajes` (`src/ai/contexto/constructor.ts:12`) existe pero la función no lo lee. `src/conversaciones/actions-ia.ts:45` pasa `maxMensajes: 15` y se ignora en silencio: "sugerir respuesta" del panel humano pide 15 y recibe 13.
3. **Los mensajes vacíos queman cupo.** El filtro de contenido vacío corre *después* del corte (`.slice(...).reverse().filter(...)`), así que un mensaje de solo imagen ocupa un lugar y luego desaparece.
4. **La ficha ya tiene lugar reservado en la arquitectura.** `src/ai/contexto/context-builder.ts` documenta 11 capas con precedencia fija. La **capa 6 "Estado actual de la conversación"** no tiene productor alguno y la **capa 7 "Datos conocidos y faltantes"** es un placeholder (`producirCapaDatosConocidosFaltantes()` devuelve `null` siempre). La propuesta del negocio encaja casi campo a campo en esas dos capas.
5. **Ya existe el vocabulario comercial.** `IntencionComercial` (`src/ai/estrategia/tipos.ts`) cubre `EXPLORANDO … LISTO_PARA_COMPRAR`, y la etapa real del negocio vive en `Oportunidad.etapa`. No hace falta inventar un `purchaseStage` paralelo.
6. **Qué no se debe extender.** `PerfilClienteSnapshot` (spec 012) es **por contacto** y de largo plazo, recalculado por eventos de dominio. La ficha es **por conversación** y por turno. Son entidades distintas.
7. **El nombre `EstadoConversacion` está tomado** por un enum de Prisma (`ABIERTA`/`CERRADA`).

## Decisiones de diseño ya acordadas

Decisiones tomadas con el usuario antes de escribir el spec. **No** son supuestos del agente y `/speckit-plan` las hereda sin re-litigarlas.

1. **Alcance: solo el nodo de Workflow.** No se agrega control al perfil del agente ni cambia el camino del suscriptor de mensajes entrantes.
2. **La lectura interpretada corre después de enviar la respuesta**, nunca antes: latencia agregada cero para el cliente.
3. **Una sola spec con tres historias** (P1, P2, P3), no dos specs separadas.
4. **Rango 1–30 con valor inicial 10**, no 1–10: hoy el agente ya recibe ~13 por el presupuesto de tokens, y capar en 10 sería un retroceso silencioso para los agentes que ya están corriendo.
5. **La configuración de memoria arranca ausente**, no en "sí" ni en "no": es lo que garantiza que un Workflow ya publicado siga comportándose igual hasta que alguien entre a tocarlo.
6. **La ficha es por conversación.** No se toca ni se extiende el perfil del cliente.
7. **El registro de hechos se deriva de datos verificables**, nunca de lo que el modelo cree recordar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El negocio decide cuánta conversación recuerda el agente (Priority: P1)

Quien arma el Workflow abre el nodo "Atención IA" y encuentra dos controles nuevos: un interruptor **"Leer mensajes anteriores"** y, cuando lo activa, un campo **"Cuántos recordar"**. Elige, por ejemplo, 10. A partir de ahí el agente entra a cada turno con los últimos 10 mensajes de esa conversación, no con una cantidad que nadie eligió ni puede ver.

Si prefiere lo contrario — un nodo que responda solo a lo último que dijo el cliente, sin arrastrar historia — apaga el interruptor.

Los Workflows que ya están publicados y nunca tocaron estos controles siguen funcionando exactamente igual.

**Why this priority**: es la causa directa del síntoma reportado y la única historia que no necesita datos nuevos ni costo de IA. Entregada sola ya resuelve el caso de "el agente responde sin contexto".

**Independent Test**: en un Workflow de prueba, configurar el nodo con "Cuántos recordar = 3" sobre una conversación de 12 mensajes y verificar que el agente recibe exactamente los últimos 3. Repetir con el interruptor apagado y verificar que recibe solo el último mensaje del cliente.

**Acceptance Scenarios**:

1. **Given** un nodo Atención IA recién creado y nunca editado en estos controles, **When** el agente responde, **Then** recibe la misma cantidad de mensajes que recibía antes de esta feature.
2. **Given** un nodo con "Leer mensajes anteriores" activo y "Cuántos recordar = 5", **When** la conversación tiene 20 mensajes, **Then** el agente recibe los 5 más recientes en orden cronológico.
3. **Given** el mismo nodo, **When** la conversación tiene solo 2 mensajes, **Then** el agente recibe esos 2 y el flujo continúa sin error.
4. **Given** un nodo con "Leer mensajes anteriores" apagado, **When** el cliente escribe, **Then** el agente recibe únicamente ese último mensaje.
5. **Given** una conversación donde 3 de los últimos 8 mensajes son solo imágenes sin texto, **When** el nodo pide recordar 5, **Then** el agente recibe 5 mensajes **con texto**, no 5 lugares de los cuales 3 llegan vacíos.
6. **Given** un nodo con memoria configurada, **When** se mira su tarjeta en el lienzo del editor, **Then** el resumen indica la configuración vigente sin tener que abrir el panel.

---

### User Story 2 - El agente recuerda qué ya mostró y qué dejó preguntado (Priority: P2)

El negocio activa en el nodo el interruptor **"Recordar en qué va la conversación"**. Desde ese momento, después de cada respuesta de la IA el sistema anota para esa conversación, a partir de datos reales: qué producto está en foco, qué precio ya se le informó al cliente (con producto, monto, moneda y cuándo), qué pregunta quedó abierta sin respuesta, y si ya se generó una cotización o un pedido.

En el turno siguiente el agente entra sabiendo eso. Si ya dijo "USD 16", no vuelve con otro número sin avisar que el precio cambió. Si preguntó "¿desea ver el catálogo?" y el cliente contestó otra cosa, retoma esa pregunta en vez de inventar una nueva.

**Why this priority**: es el salto de calidad comercial — elimina la contradicción de precios y la repetición de preguntas, que son los dos errores que más caro cuestan en una venta. Depende de P1 solo conceptualmente; técnicamente es independiente.

**Independent Test**: en una conversación de prueba, hacer que el agente informe un precio; en el turno siguiente, preguntar de nuevo por el mismo producto y verificar que el agente no da un monto distinto sin anunciar el cambio.

**Acceptance Scenarios**:

1. **Given** un nodo con la ficha desactivada, **When** el agente responde, **Then** no se registra ni se inyecta nada, y las instrucciones de sistema son idénticas a las de antes de esta feature.
2. **Given** un nodo con la ficha activa y un agente que acaba de informar "Esfera lunar — USD 16", **When** el cliente vuelve a preguntar el precio, **Then** el agente responde con el mismo monto, o anuncia explícitamente que cambió.
3. **Given** un agente que preguntó "¿desea ver el catálogo?", **When** el cliente responde algo que no contesta esa pregunta, **Then** el agente retoma la pregunta abierta en vez de plantear una distinta.
4. **Given** una conversación donde ya se creó una cotización, **When** el agente responde, **Then** sabe que existe y no ofrece crear otra como si fuera la primera.
5. **Given** un fallo al guardar la ficha, **When** el agente ya envió su respuesta, **Then** el cliente recibe el mensaje igual y el flujo del Workflow continúa.
6. **Given** la primera respuesta de una conversación nueva, **When** todavía no hay ficha, **Then** el agente responde normalmente, sin ese bloque de contexto.
7. **Given** un cliente con dos conversaciones abiertas, **When** el agente atiende una, **Then** ve la ficha de esa conversación y no la de la otra.

---

### User Story 3 - El agente entiende el tema y la fase de la conversación (Priority: P3)

Sobre lo anterior, el sistema agrega una lectura de la conversación: de qué se está hablando, qué intención comercial muestra el cliente, qué datos ya dio y cuáles faltan, y un resumen breve. Esa lectura se arma **después** de que la respuesta ya salió, así que el cliente nunca espera por ella, y se le entrega al agente en el turno siguiente.

Como es una interpretación y no un hecho, llega siempre marcada como tal: el agente puede apoyarse en ella para orientar la conversación, pero no para afirmarle algo al cliente como si estuviera confirmado.

**Why this priority**: es lo que convierte la ficha en "el agente entiende por qué fase va". Se deja en P3 porque es la única parte con costo de IA recurrente y la única que puede equivocarse, así que conviene encenderla cuando P1 y P2 ya estén estables.

**Independent Test**: sostener una conversación de 6 turnos en el simulador y verificar que, a partir del segundo, el contexto del agente incluye tema, intención y datos faltantes coherentes con lo conversado, y que el tiempo de respuesta percibido no cambia.

**Acceptance Scenarios**:

1. **Given** un nodo con la ficha activa, **When** el agente termina un turno, **Then** la lectura interpretada se deriva después del envío y el cliente no percibe demora adicional.
2. **Given** una lectura interpretada vigente, **When** el agente recibe su contexto, **Then** la ve separada de los hechos registrados y marcada como interpretada y no confirmada.
3. **Given** que la derivación falla o devuelve algo ininteligible, **When** llega el turno siguiente, **Then** se conserva la lectura anterior y nunca se borra lo que ya había.
4. **Given** un cliente que cambia de producto a mitad de la conversación, **When** se actualiza la lectura, **Then** el tema y la intención reflejan el producto nuevo.
5. **Given** un cliente que intenta dar instrucciones al agente dentro de su mensaje, **When** ese texto termina reflejado en la ficha, **Then** el agente lo trata como dato de la conversación y no como una orden que deba obedecer.

---

### Edge Cases

- **Conversación más corta que la cantidad pedida**: se entrega lo que hay, sin error ni relleno.
- **Conversación sin ningún mensaje con texto** (solo imágenes o audios): el agente responde igual, con el contexto que tenga.
- **Primer turno de una conversación nueva**: no hay ficha todavía; el bloque simplemente no aparece.
- **El cliente manda varios mensajes seguidos** mientras está activa la espera antes de responder: todos entran dentro de la ventana de memoria configurada, no solo el último.
- **Un humano toma la conversación** a mitad: la ficha deja de considerarse vigente y se recalcula cuando la atención vuelve a ser automática.
- **El precio del catálogo cambia entre dos turnos**: el agente debe anunciar el cambio, no contradecirse en silencio ni quedarse con el valor viejo.
- **El cliente responde la pregunta abierta**: deja de aparecer como pendiente en el turno siguiente.
- **El límite de tokens del agente no alcanza** para la ficha más la cantidad de mensajes elegida: se recortan primero los mensajes más antiguos y queda registro de que se recortó.
- **Dos nodos Atención IA en el mismo Workflow con configuraciones distintas**: cada uno aplica la suya.
- **El Workflow se republica**: la configuración viaja con la versión publicada, como el resto de la definición.
- **El mismo contacto con varias conversaciones abiertas**: una ficha por conversación, sin mezclarse.

## Requirements *(mandatory)*

### Functional Requirements

#### Memoria conversacional (P1)

- **FR-001**: El panel de configuración del nodo "Atención IA" MUST ofrecer un control "Leer mensajes anteriores" (sí/no) y, cuando está activo, un campo "Cuántos recordar" con rango de 1 a 30 y valor inicial 10.
- **FR-002**: Un nodo cuya configuración de memoria nunca fue establecida MUST comportarse exactamente como antes de esta feature: el agente recibe la cantidad de mensajes que resulta del presupuesto de tokens vigente.
- **FR-003**: Con "Leer mensajes anteriores" activo y una cantidad N elegida, el agente MUST recibir exactamente los últimos N mensajes con contenido de texto de esa conversación, en orden cronológico.
- **FR-004**: Con "Leer mensajes anteriores" inactivo, el agente MUST recibir únicamente el último mensaje del cliente.
- **FR-005**: Los mensajes sin contenido de texto MUST NOT consumir cupo de la cantidad elegida.
- **FR-006**: El resumen del nodo en el lienzo del editor MUST reflejar la configuración de memoria vigente.
- **FR-007**: La cantidad elegida MUST seguir sujeta al límite de tokens de contexto del agente. Si el límite obliga a recortar, el sistema MUST descartar primero los mensajes más antiguos y dejar constancia en el log del servidor.
- **FR-008**: La validación de la configuración MUST rechazar la publicación de un Workflow con una cantidad fuera del rango 1–30.

#### Ficha de conversación — hechos registrados (P2)

- **FR-010**: El panel del nodo MUST ofrecer un control "Recordar en qué va la conversación" (sí/no), inactivo por omisión.
- **FR-011**: Con ese control activo, después de cada respuesta de la IA el sistema MUST registrar para esa conversación: producto en foco, último precio informado al cliente (producto, monto, moneda, mensaje en que se informó y momento), pregunta abierta sin responder, documentos comerciales generados en la conversación, cantidad de turnos y momento del último turno.
- **FR-012**: Los hechos registrados MUST derivarse únicamente de datos verificables — resultados de las herramientas que el agente ejecutó y mensajes efectivamente enviados —, nunca de la interpretación del modelo.
- **FR-013**: En el turno siguiente el agente MUST recibir esos hechos junto con reglas de consistencia explícitas: no contradecir un precio ya informado sin anunciar el cambio, y no abrir un tema nuevo antes de resolver la pregunta pendiente.
- **FR-014**: Si el registro de la ficha falla, el mensaje ya enviado al cliente MUST NOT verse afectado y la ejecución del Workflow MUST continuar normalmente.
- **FR-015**: La ficha MUST ser por conversación y MUST NOT mezclarse con el perfil del contacto, que tiene otro alcance y otro ciclo de vida.
- **FR-016**: La ficha MUST marcarse como no vigente cuando un humano toma la conversación, y recalcularse cuando la atención vuelve a ser automática.
- **FR-017**: El último precio informado MUST presentarse como dato de consistencia y nunca como fuente para cotizar: ante cualquier duda el agente MUST volver a consultar el precio vigente antes de informarlo.

#### Lectura interpretada (P3)

- **FR-020**: Con la ficha activa, después de enviar la respuesta el sistema MUST derivar una lectura de la conversación: tema, intención comercial, datos conocidos, datos faltantes y resumen breve.
- **FR-021**: La intención comercial MUST usar el vocabulario de intenciones que el sistema ya tiene definido. MUST NOT introducirse un vocabulario paralelo de etapas de compra.
- **FR-022**: La derivación MUST ocurrir después del envío del mensaje. El cliente MUST NOT percibir demora adicional por causa de esta feature.
- **FR-023**: Si la derivación falla o su resultado no es interpretable, el sistema MUST conservar la lectura anterior. MUST NOT borrar lo que ya había.
- **FR-024**: La lectura interpretada MUST llegarle al agente etiquetada como interpretada y no confirmada, visiblemente separada de los hechos registrados.

#### Transversales

- **FR-030**: Un nodo sin memoria ni ficha configuradas MUST producir exactamente las mismas instrucciones de sistema que producía antes de esta feature.
- **FR-031**: El contenido de la ficha, por derivarse de texto escrito por el cliente, MUST tratarse como dato y nunca como instrucción, y MUST ubicarse por debajo de las reglas obligatorias del agente en el orden de precedencia del contexto.
- **FR-032**: El simulador del agente MUST poder ejercitar ambas capacidades con una ficha simulada, sin leer ni escribir datos reales.
- **FR-033**: Toda lectura y escritura de la ficha MUST estar acotada a la instancia (tenant) dueña de la conversación.
- **FR-034**: Esta feature MUST NOT alterar el comportamiento del agente cuando responde fuera de un Workflow.

### Key Entities

- **Ficha de conversación**: lo que el sistema sabe sobre una conversación en curso. Una por conversación. Tiene dos mitades que nunca se mezclan: **hechos registrados** (derivados de datos verificables) y **lectura interpretada** (derivada por IA, puede equivocarse). Lleva marca de última actualización y de vigencia.
- **Hechos registrados**: producto en foco, último precio informado (producto, monto, moneda, mensaje, momento), pregunta abierta, documentos comerciales generados, turnos y momento del último turno.
- **Lectura interpretada**: tema, intención comercial, datos conocidos, datos faltantes, resumen y momento de la derivación.
- **Configuración de memoria del nodo**: si se leen mensajes anteriores y cuántos. Vive en la definición del Workflow y viaja con la versión publicada.
- **Configuración de ficha del nodo**: si el nodo registra y usa la ficha. Misma ubicación y mismo ciclo de vida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un Workflow publicado antes de esta feature produce instrucciones de sistema **byte a byte idénticas** a las anteriores, verificado por un test de regresión automatizado (mismo criterio que la spec 013).
- **SC-002**: Con "Cuántos recordar = N", el agente recibe exactamente N mensajes con texto, para cualquier N entre 1 y 30, verificable sin ejecutar el modelo.
- **SC-003**: El tiempo entre el mensaje del cliente y la respuesta enviada no aumenta respecto de la medición previa, con la ficha activada y en el mismo escenario.
- **SC-004**: En una conversación de prueba donde el agente ya informó un precio, en los 3 turnos siguientes no informa un monto distinto para el mismo producto sin anunciar el cambio.
- **SC-005**: En una conversación donde el agente hizo una pregunta y el cliente respondió otra cosa, el agente retoma esa pregunta en vez de plantear una nueva.
- **SC-006**: Sobre 10 conversaciones piloto, el agente no vuelve a pedir ningún dato que el cliente ya entregó dentro de la ventana de memoria configurada.
- **SC-007**: Inyectando fallos en el registro y en la derivación de la ficha, el 100% de los mensajes que el agente generó llegan igual al cliente.
- **SC-008**: Quien arma el Workflow configura memoria y ficha desde el panel del nodo en menos de 1 minuto, sin asistencia técnica y sin leer documentación.
- **SC-009**: Con la ficha desactivada en el nodo, el costo de IA por turno no aumenta.

## Assumptions

- **Cantidad de mensajes**: se adopta el rango 1–30 con valor inicial 10 en vez del 1–10 que mencionó el pedido original, porque hoy el agente ya recibe ~13 por el presupuesto de tokens y un tope de 10 sería un retroceso silencioso. Decisión confirmada con el usuario.
- **Parámetro de cantidad hoy ignorado**: se asume que hacerlo funcionar es lo correcto, lo que implica un cambio acotado y deliberado fuera del Workflow — "sugerir respuesta" del panel de conversación pasa de recibir 13 mensajes a los 15 que siempre pidió. Es la única excepción a FR-034 y queda señalada para que el negocio pueda vetarla en `/speckit-plan`; la alternativa es quitar el parámetro en ese punto de llamada y dejar el comportamiento exactamente igual.
- **Costo de la lectura interpretada**: una derivación por turno de IA, enrutable a un modelo económico por el mecanismo de enrutamiento por objetivo que ya existe (spec 010). Se asume aceptable para los nodos que la activen explícitamente.
- **Presupuesto de tokens**: con el límite de contexto por omisión del agente (4000), la ficha más 10 mensajes queda ajustada. Se asume que la reserva de tokens pasa a contemplar el tamaño de la ficha, para que activarla no recorte mensajes en silencio; algunas instancias podrán necesitar subir ese límite.
- **Detección de la pregunta abierta**: se asume que basta con la última interrogación que el agente envió y que el cliente no respondió, sin análisis semántico adicional en esta entrega.
- **Vigencia tras intervención humana**: se asume que una ficha de una conversación atendida por un humano se descarta y se vuelve a derivar, en vez de intentar reconstruirla desde los mensajes del humano.
- **Dependencias**: esta feature se apoya en el orden de capas de contexto establecido por la spec 013, en el vocabulario de intenciones de la spec 011/012 y en el enrutamiento de modelos de la spec 010. Ninguna de ellas se modifica.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El presupuesto de tokens por omisión (4000) no alcanza para ficha + N mensajes | La reserva de tokens contempla el tamaño de la ficha; se recortan los mensajes más antiguos primero y queda registro (FR-007) |
| Inyección de instrucciones: la ficha se arma con texto escrito por el cliente | La ficha va por debajo de las reglas obligatorias del agente y se presenta como dato, nunca como instrucción (FR-031) |
| El agente toma el último precio informado como fuente para cotizar | El bloque lo presenta explícitamente como dato de consistencia y obliga a reconsultar ante duda (FR-017) |
| Ficha desactualizada tras intervención humana | Se marca como no vigente y se recalcula al volver a atención automática (FR-016) |
| La lectura interpretada se equivoca y el agente afirma algo falso | Llega siempre etiquetada como no confirmada y separada de los hechos (FR-024) |
| Costo de IA creciente en conversaciones largas | La derivación es por turno y solo en nodos que la activan; sin ficha, costo igual al actual (SC-009) |

## Fuera de alcance

- Agregar la memoria o la ficha al perfil del agente (Configuración → IA) o al camino en que la IA responde fuera de un Workflow.
- Mostrarle la ficha al agente humano en el panel de conversación.
- Interfaz para `delayRespuesta` y para la restricción de herramientas del nodo: existen en la configuración y en el motor, pero hoy no son editables desde el editor de Workflows. No se agregan acá.
- Resumen automático de conversaciones largas como reemplazo de los mensajes crudos.
- Búsqueda semántica o embeddings sobre el historial de la conversación.
