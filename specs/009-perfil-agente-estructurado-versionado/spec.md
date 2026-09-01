# Feature Specification: Perfil estructurado y versionado del agente de IA

**Feature Branch**: `[009-perfil-agente-estructurado-versionado]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Extender la configuración actual del agente de IA (AgenteIAConfig, hoy 1:1 con Usuario tipo AGENTE) para soportar dimensiones estructuradas adicionales de identidad y comportamiento, sin reemplazar lo existente: identidad (nombre del agente, rol, idioma principal/permitidos), comunicación (longitud de respuesta, proactividad, intensidad comercial, estilo de recomendación), reglas y límites (frases preferidas/prohibidas, comportamientos prohibidos, reglas personalizadas, condiciones de transferencia a humano), comportamiento natural base fijo del sistema, generación de prompt 100% desde configuración estructurada, y versionado (borrador/publicado/historial/duplicar/restaurar, trazabilidad de qué versión generó cada respuesta). AgenteIAConfig sigue 1:1 con Usuario. Todo opcional y retrocompatible."

## Diagnóstico previo (investigación de código)

Karia ya tiene una implementación de configuración de agente de IA no trivial — esto no es una funcionalidad nueva desde cero, es una extensión:

- `AgenteIAConfig` (Prisma) es una extensión 1:1 de `Usuario` (tipo `AGENTE`) con: `sistemaPrompt`, `personalidad`, `objetivo`, `especialidad`, `tipo` (COMERCIAL/GERENCIA), `temperaturaOverride`, `modeloPreferido`, `herramientas`, `canalesPermitidos`, `memoriaHabilitada`, `limiteTokensCtx`, `instrucciones` (lista libre), `configuracionTono` (JSON: tono, formalidad, emojis, tuteo, humor, llamar por nombre).
- El prompt final **ya se genera desde estos campos estructurados**, no desde un texto libre (`src/ai/prompt/builder.ts`): rol → tono → especialidad → restricciones fijas (aislamiento por instancia, idioma del cliente, concisión) → instrucciones adicionales → contexto dinámico → `sistemaPrompt` como override libre al final → bloque fijo anti prompt-injection.
- Confirmado: no existe hoy ningún campo de nombre de agente, longitud de respuesta preferida, proactividad, intensidad comercial, estilo de recomendación, frases prohibidas/preferidas, comportamientos prohibidos, reglas personalizadas estructuradas (hoy `instrucciones` es una lista de strings sin categorizar), idioma principal/permitidos, ni condiciones de transferencia a humano como configuración (hoy la transferencia es una tool fija, `transferir_a_humano`, sin condiciones configurables por el negocio).
- Confirmado: no existe versionado. `guardarAgenteIA` (`src/configuracion/ia/agente-actions.ts`) hace `upsert` directo sobre la única fila de `AgenteIAConfig` del usuario — cada guardado sobreescribe el anterior sin dejar historial, y no hay concepto de borrador vs. publicado.
- Confirmado: `UsoIA` (tabla de auditoría de cada llamada al proveedor) tiene `agenteIAConfigId` pero no una referencia a una versión específica de esa configuración — hoy es imposible saber con qué configuración exacta se generó una respuesta pasada si la configuración cambió después.
- El formulario existente en `/configuracion` → tab "Inteligencia Artificial" (`src/configuracion/components/form-configuracion-ia.tsx`, `form-proveedor-ia.tsx`, más el schema/actions de `src/configuracion/ia/`) es un formulario plano por agente, reutilizable como base de layout pero sin sub-navegación por secciones.
- Esta spec no toca: playbooks de estrategia comercial, perfil dinámico del cliente, conversaciones piloto, niveles de autonomía/automatización, simulador, ni el enrutamiento de modelo por objetivo/tarea — todas cubiertas por specs separadas y posteriores en el plan aprobado (ver `docs/AGENTE-IA-EVOLUCION-ANALISIS.md`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar identidad, comunicación y reglas del agente sin escribir un prompt (Priority: P1)

Como responsable de configurar el agente de IA de mi negocio, quiero definir su nombre, rol, estilo de comunicación (longitud, proactividad, intensidad comercial, estilo de recomendación) y sus reglas y límites (frases prohibidas/preferidas, comportamientos prohibidos, reglas propias, cuándo debe transferir a un humano) mediante campos y opciones concretas, para que el agente hable y se comporte como yo espero sin que yo tenga que redactar un prompt técnico.

**Why this priority**: Es el valor central del pedido — configuración estructurada en vez de un prompt monolítico. Sin esto, ninguna de las demás historias tiene sentido.

**Independent Test**: Desde la configuración del agente, completar los campos de identidad/comunicación/reglas, guardar, y verificar (vía el simulador manual de sugerencia ya existente o una respuesta real) que el tono y las restricciones configuradas se reflejan en la respuesta generada.

**Acceptance Scenarios**:

1. **Given** un agente sin ninguno de los campos nuevos configurados, **When** el responsable abre su configuración, **Then** ve las secciones Identidad, Comunicación y Reglas con valores por defecto equivalentes al comportamiento actual (ningún campo obligatorio nuevo bloquea guardar).
2. **Given** que el responsable define frases prohibidas y un comportamiento prohibido ("no presionar para comprar"), **When** se genera una respuesta del agente, **Then** el prompt enviado al proveedor de IA incluye esas restricciones de forma explícita.
3. **Given** que el responsable define una condición de transferencia a humano ("cliente menciona un reclamo"), **When** se genera el prompt, **Then** esa condición queda incluida como instrucción para que el agente use la herramienta de transferencia en ese caso.
4. **Given** que el responsable escribe en el campo avanzado de instrucciones libres (`sistemaPrompt`) algo que contradice una regla obligatoria fija del sistema (por ejemplo "puedes prometer precios sin confirmar"), **When** guarda la configuración, **Then** el sistema le muestra una advertencia identificando la contradicción, pero le permite guardar si igual lo desea (no bloqueo silencioso ni bloqueo forzado).

---

### User Story 2 - Publicar cambios sin perder la versión anterior y saber qué versión generó cada respuesta (Priority: P2)

Como responsable de configurar el agente, quiero poder editar su configuración como borrador, publicarla cuando esté conforme, y conservar el historial de versiones anteriores (con la posibilidad de restaurar una), para poder experimentar con cambios sin arriesgar el comportamiento en producción y poder revertir si algo sale mal.

**Why this priority**: Es la protección operativa del pedido — depende de que exista la configuración estructurada de la Historia 1, pero es necesaria antes de dar por cerrada esta base porque todo lo que se construya después (playbooks, autonomía, etc.) también necesitará poder versionarse con este mismo mecanismo.

**Independent Test**: Editar la configuración de un agente ya publicado, guardar como borrador sin publicar, confirmar que el agente en producción sigue usando la versión publicada anterior, luego publicar el borrador y confirmar que las respuestas nuevas usan la configuración publicada más reciente. Restaurar una versión previa y confirmar que vuelve a quedar publicada.

**Acceptance Scenarios**:

1. **Given** un agente con una versión publicada, **When** el responsable edita y guarda cambios sin publicar, **Then** las respuestas que el agente genera en ese momento siguen usando la versión publicada, no el borrador.
2. **Given** un borrador con cambios, **When** el responsable lo publica, **Then** se crea una nueva versión publicada, la anterior queda visible en el historial (no se borra), y las respuestas nuevas usan la versión recién publicada.
3. **Given** un historial con al menos dos versiones publicadas, **When** el responsable elige restaurar una versión anterior, **Then** esa versión anterior pasa a ser la versión publicada vigente (sin perder ninguna versión del historial).
4. **Given** una respuesta generada por el agente en el pasado, **When** el responsable la revisa en el historial de uso, **Then** puede identificar exactamente qué versión de la configuración del agente la generó.
5. **Given** una versión publicada existente, **When** el responsable elige duplicarla, **Then** se crea un nuevo borrador editable con el mismo contenido, sin afectar la versión publicada original.

---

### User Story 3 - Encontrar cada tipo de configuración en su propia sección (Priority: P3)

Como responsable de configurar el agente, quiero que la pantalla de configuración esté organizada en secciones claras (Identidad, Comunicación, Reglas, Versiones) en vez de un formulario largo y plano, para encontrar rápido lo que quiero ajustar sin perderme entre campos de distinto tipo.

**Why this priority**: Es una mejora de usabilidad sobre las historias anteriores — no aporta capacidad nueva por sí sola, pero es necesaria para que el resto de las secciones (que se irán sumando en specs futuras: estrategias, conocimiento, piloto, automatización, simulador) tengan un lugar consistente donde integrarse.

**Independent Test**: Abrir la configuración del agente y verificar que cada grupo de campos está en su propia sección navegable, y que el historial de versiones de la Historia 2 es visible como una sección propia.

**Acceptance Scenarios**:

1. **Given** que el responsable abre la configuración del agente, **When** navega entre secciones, **Then** encuentra Identidad, Comunicación, Reglas y Versiones como sub-secciones diferenciadas dentro de la tab "Inteligencia Artificial" existente.

### Edge Cases

- ¿Qué pasa si un agente no tiene ninguna versión publicada todavía (agente nuevo)? El sistema MUST seguir generando respuestas usando el comportamiento equivalente al actual (sin versión) hasta que exista al menos una versión publicada.
- ¿Qué pasa si dos personas editan el borrador del mismo agente al mismo tiempo? El sistema MUST evitar que un guardado sobreescriba silenciosamente los cambios del otro sin avisar.
- ¿Qué pasa si se publica una versión con reglas que se contradicen entre sí (por ejemplo, una frase marcada como preferida y también como prohibida)? El sistema MUST advertir la contradicción antes de publicar, sin impedir la publicación.
- ¿Qué pasa con agentes ya existentes en producción al desplegar esta funcionalidad? MUST seguir respondiendo exactamente igual que hoy hasta que su responsable configure explícitamente alguno de los campos nuevos o publique una primera versión.
- ¿Qué pasa si se restaura una versión muy antigua que no tiene algunos de los campos agregados después? El sistema MUST aplicar los valores por defecto equivalentes al comportamiento actual para los campos que esa versión antigua no tenía.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir configurar, para cada agente, nombre del agente, rol, idioma principal e idiomas permitidos, además de los campos de identidad ya existentes (objetivo, personalidad).
- **FR-002**: El sistema MUST permitir configurar, para cada agente, longitud de respuesta preferida, nivel de proactividad, intensidad comercial y estilo de recomendación, como opciones estructuradas (no texto libre), además del tono/formalidad/emojis ya existentes.
- **FR-003**: El sistema MUST permitir configurar, para cada agente, una lista de frases preferidas, una lista de frases prohibidas, una lista de comportamientos prohibidos, y una lista de reglas personalizadas — cada una como una lista estructurada e independiente entre sí (no un único texto libre combinado).
- **FR-004**: El sistema MUST permitir configurar condiciones (en lenguaje natural, en forma de lista) que indiquen cuándo el agente debe transferir la conversación a un humano.
- **FR-005**: El sistema MUST incluir un conjunto fijo de reglas de comportamiento natural que aplican siempre a todo agente, sin necesidad de configuración por negocio: responder primero lo que el cliente preguntó, hacer como máximo una pregunta principal por mensaje, no repetir preguntas ya respondidas en la conversación, recomendar como máximo tres alternativas, y no prometer precio, disponibilidad o fecha de entrega sin haber consultado la información real primero.
- **FR-006**: El sistema MUST generar el prompt final del agente combinando todos los campos estructurados definidos en FR-001 a FR-005; el campo de instrucciones libres (`sistemaPrompt`) actual MUST mantenerse como complemento de menor prioridad, aplicado después de las reglas estructuradas y obligatorias, nunca como reemplazo de ellas.
- **FR-007**: El sistema MUST detectar cuando el contenido del campo de instrucciones libres contradice una regla obligatoria o una regla estructurada configurada (por ejemplo, permite lo que una regla prohíbe) y MUST mostrar una advertencia visible a quien lo configura, sin impedir que guarde o publique si de todas formas lo decide.
- **FR-008**: El sistema MUST distinguir entre una configuración en estado borrador y una configuración publicada; las respuestas generadas para clientes reales MUST usar siempre la última versión publicada, nunca un borrador sin publicar.
- **FR-009**: El sistema MUST conservar el historial completo de versiones publicadas de la configuración de cada agente; publicar una nueva versión MUST NOT eliminar ni sobrescribir las versiones anteriores.
- **FR-010**: El sistema MUST permitir duplicar cualquier versión existente (publicada o borrador) como punto de partida de un nuevo borrador editable.
- **FR-011**: El sistema MUST permitir restaurar una versión anterior del historial, convirtiéndola en la versión publicada vigente sin eliminar ninguna versión del historial.
- **FR-012**: El sistema MUST registrar, para cada respuesta generada por un agente, una referencia a la versión exacta de su configuración que la produjo, de forma consultable posteriormente.
- **FR-013**: El sistema MUST mantener el comportamiento actual sin cambios para cualquier agente existente que no tenga ninguno de los campos nuevos configurados ni ninguna versión publicada explícitamente creada tras el despliegue de esta funcionalidad.
- **FR-014**: El sistema MUST presentar la configuración del agente organizada en secciones diferenciadas (al menos Identidad, Comunicación, Reglas y Versiones) dentro de la ubicación donde hoy se configura la Inteligencia Artificial.

### Key Entities *(include if feature involves data)*

- **Configuración del agente (identidad/comunicación/reglas)**: extiende la configuración ya existente del agente con los campos nuevos descritos en FR-001 a FR-004; pertenece a un único agente (que a su vez pertenece a un único usuario de tipo agente, dentro de una única instancia/negocio).
- **Versión de configuración**: una fotografía completa de la configuración de un agente en un momento dado, con estado (borrador o publicada), quién y cuándo la creó/publicó, y su posición en el historial. Un agente tiene muchas versiones a lo largo del tiempo, pero como máximo una versión publicada vigente en cualquier momento.
- **Referencia de versión en una respuesta generada**: vínculo entre un registro de uso de IA (una respuesta ya generada) y la versión de configuración específica que la produjo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un responsable de negocio puede configurar completamente la identidad, comunicación y reglas de un agente sin escribir ni editar manualmente un prompt de texto libre.
- **SC-002**: El 100% de los agentes existentes antes de este cambio siguen generando respuestas de comportamiento equivalente al que tenían, sin que su responsable haga ningún cambio de configuración.
- **SC-003**: Publicar una nueva versión de configuración no elimina ninguna versión anterior del historial; el 100% de las versiones publicadas quedan disponibles para consulta o restauración.
- **SC-004**: Dada cualquier respuesta generada por un agente después de este cambio, un responsable puede identificar en menos de 3 pasos qué versión de configuración la generó.
- **SC-005**: Restaurar una versión anterior deja al agente respondiendo según esa configuración anterior en la siguiente respuesta generada, sin intervención adicional.

## Assumptions

- Se mantiene la decisión de negocio ya tomada: `AgenteIAConfig` sigue 1:1 con un `Usuario` de tipo agente; esta spec no introduce agentes desacoplados de una cuenta de usuario.
- "Publicar" es una acción explícita y deliberada de quien configura el agente; guardar un borrador nunca publica automáticamente.
- El campo `sistemaPrompt` libre actual se conserva por compatibilidad como mecanismo de ajuste avanzado; no se elimina ni se oculta, solo pasa a tener menor prioridad frente a las reglas estructuradas y obligatorias.
- Las reglas de comportamiento natural fijas (FR-005) son iguales para todos los agentes de todos los negocios en esta fase; no son configurables ni desactivables por negocio.
- La detección de contradicciones (FR-007) se basa en coincidencias razonables entre el texto libre y las reglas estructuradas configuradas; no se espera una comprensión semántica perfecta, sino una advertencia útil en los casos más evidentes.
- El historial de versiones no tiene límite de cantidad definido en esta fase; no se requiere purga ni archivado automático.
- Fuera de alcance de esta spec: playbooks de estrategia comercial, perfil dinámico del cliente, conversaciones piloto, recuperación de ejemplos, niveles de autonomía/automatización, enrutamiento de modelo por objetivo/tarea, y el simulador — todas cubiertas por specs independientes posteriores.
