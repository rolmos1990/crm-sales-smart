# Feature Specification: Alias y match de ubicaciones para transportistas

**Feature Branch**: `[024-alias-ubicaciones-transportistas]`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Refactor final del módulo de transportistas: que las configuraciones de transportista permitan, mediante un servicio de consultas, que la IA encuentre el match exacto para responderle a los clientes cuando pregunten acerca de envíos. Basado en requerimiento-transportista.md — alias por destino, normalización de texto, niveles de confianza en la coincidencia, e importación masiva de destinos/tarifas con revisión previa."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un cliente pregunta por un destino usando una forma coloquial o abreviada (Priority: P1)

Como cliente que escribe al negocio por WhatsApp/Instagram/chat web, quiero que la IA entienda a qué destino me refiero aunque lo escriba de forma coloquial, abreviada o con un error de tipeo común (por ejemplo "Chorrera" en vez de "La Chorrera"), para recibir el precio y tiempo de envío correctos sin tener que corregir mi mensaje.

**Why this priority**: Es el problema concreto que motivó el pedido — hoy el motor de matching compara texto exacto, así que cualquier variante razonable de cómo la gente nombra un lugar no encuentra coincidencia y la conversación se pierde o escala innecesariamente. Sin esto, ninguna otra historia tiene valor real de cara al cliente.

**Independent Test**: Con un destino ya configurado con al menos un alias, escribirle a la IA usando ese alias y confirmar que responde con el precio y tiempo correctos sin transferir a un humano.

**Acceptance Scenarios**:

1. **Given** un destino configurado como "La Chorrera" con el alias "Chorrera", **When** un cliente pregunta "¿hacen envíos a Chorrera?", **Then** la IA responde con las opciones de envío para ese destino sin transferir a un humano.
2. **Given** un destino configurado sin alias registrados, **When** un cliente escribe el nombre exacto del destino (mayúsculas/minúsculas o tildes distintas), **Then** la IA lo reconoce igual, porque la comparación ignora mayúsculas, tildes y espacios repetidos.
3. **Given** un destino configurado, **When** un cliente escribe una variante con un error ortográfico leve no registrado como alias (ej. "Chorera"), **Then** la IA puede reconocerlo como coincidencia probable y lo indica como tal en vez de tratarlo como coincidencia exacta.

---

### User Story 2 - Un administrador agrega alias a un destino ya configurado (Priority: P1)

Como responsable de configurar transportistas, quiero agregar distintas formas de nombrar un destino ya existente (apodos, formas abreviadas, errores comunes que suelen escribir los clientes), para que la IA los reconozca automáticamente sin tener que crear un destino duplicado por cada variante.

**Why this priority**: Es el prerrequisito operativo de la Historia 1 — sin una forma de cargar alias, la IA nunca tiene con qué reconocer las variantes. Va en paralelo con la Historia 1 como base indispensable del feature.

**Independent Test**: Abrir la pestaña "Zonas y tarifas" de un transportista, agregar un alias a una ubicación existente, y confirmar que queda visible en la lista de alias de ese destino.

**Acceptance Scenarios**:

1. **Given** una zona con al menos un destino configurado, **When** el administrador agrega un alias para ese destino, **Then** el alias queda guardado y visible en la lista de alias de esa ubicación.
2. **Given** un alias ya registrado para un destino, **When** el administrador intenta agregar el mismo alias (mismo texto, sin importar mayúsculas/tildes/espacios) a otro destino distinto dentro del mismo negocio, **Then** el sistema rechaza la operación indicando que ese alias ya está en uso.
3. **Given** un alias ya registrado, **When** el administrador lo elimina, **Then** deja de usarse en futuras búsquedas sin afectar el destino al que pertenecía.

---

### User Story 3 - La IA presenta varias opciones de envío con su nivel de confianza (Priority: P2)

Como cliente que pregunta por varias opciones de envío o pide comparar transportistas/precios para un destino, quiero recibir todas las opciones disponibles ordenadas por precio, sin que la IA me revele información interna del negocio (costo real o margen de ganancia).

**Why this priority**: Amplía el valor de la Historia 1 más allá de una respuesta binaria — hoy la IA solo puede confirmar o negar cobertura para un único transportista/costo; esta historia habilita comparación real de opciones, que es justo lo que el pedido original describe como "servicio de consultas para que la IA encuentre el match exacto".

**Independent Test**: Configurar dos transportistas con tarifas para el mismo destino y confirmar que la IA, ante una consulta de opciones, devuelve ambas ordenadas por precio sin mencionar costo interno ni margen.

**Acceptance Scenarios**:

1. **Given** dos o más transportistas con tarifa vigente para el mismo destino, **When** un cliente pide comparar opciones de envío, **Then** la IA presenta todas las opciones ordenadas por precio al cliente, cada una con su tiempo estimado.
2. **Given** cualquier respuesta de opciones de envío generada por la IA, **When** se revisa su contenido, **Then** no aparece el costo interno del transportista, el margen de ganancia, ni datos de contacto interno del transportista (teléfono, correo, notas internas).
3. **Given** un destino con una única opción de envío disponible, **When** un cliente consulta por ese destino, **Then** la IA responde con esa opción sin necesidad de transferir a un humano.

---

### User Story 4 - Un administrador importa un lote de destinos y tarifas desde un archivo (Priority: P2)

Como responsable de configurar transportistas, quiero cargar un archivo CSV/Excel con una lista de destinos y sus tarifas, y revisar antes de confirmar cuáles son destinos nuevos, cuáles coinciden con destinos ya configurados y cuáles son casos dudosos, para no tener que cargar cada destino manualmente ni terminar con destinos duplicados.

**Why this priority**: Reduce significativamente el esfuerzo de poblar el catálogo de destinos con alias en negocios que ya reciben listas de tarifas de sus couriers, pero el sistema ya es funcionalmente útil sin esto (carga manual vía Historia 2) — es una mejora de eficiencia operativa, no un requisito para que el match funcione.

**Independent Test**: Subir un archivo con una mezcla de destinos nuevos y destinos ya existentes (incluyendo un caso de alias ambiguo), confirmar que la revisión previa clasifica cada fila correctamente, y que solo se importan los casos aprobados.

**Acceptance Scenarios**:

1. **Given** un archivo CSV/Excel con destinos y tarifas, **When** el administrador lo sube, **Then** el sistema muestra una revisión previa que clasifica cada fila como destino nuevo, coincidencia exacta con un destino existente, posible duplicado, o alias ambiguo.
2. **Given** la revisión previa con filas clasificadas, **When** el administrador confirma la importación, **Then** solo se crean o actualizan los destinos/tarifas de las filas aprobadas, y el resultado queda registrado en el historial de importaciones.
3. **Given** una fila marcada como "alias ambiguo" (el texto de destino coincide con más de un destino ya configurado), **When** el administrador intenta confirmar sin resolverla, **Then** esa fila queda excluida de la importación hasta que se resuelva.

---

### User Story 5 - La IA comunica cuando una ubicación es ambigua o no tiene cobertura (Priority: P3)

Como cliente que pregunta por un destino que no está claro o no existe en el catálogo del negocio, quiero que la IA me lo indique claramente (pidiéndome más detalle o informando que debe verificarse) en vez de darme un precio inventado o incorrecto.

**Why this priority**: Es una red de seguridad sobre las historias anteriores — evita respuestas incorrectas en los casos límite, pero el valor principal del feature (Historias 1-3) ya funciona sin ella para el caso común. Complementa, no bloquea.

**Independent Test**: Preguntar por un nombre de lugar que coincide de forma aproximada con dos destinos distintos configurados, y confirmar que la IA pide precisión en vez de elegir uno al azar.

**Acceptance Scenarios**:

1. **Given** un texto de ubicación que no coincide (ni exacto, ni por alias, ni de forma aproximada razonable) con ningún destino configurado, **When** un cliente pregunta por ese destino, **Then** la IA informa que debe verificarse la cobertura, sin inventar un precio.
2. **Given** un texto de ubicación que coincide de forma aproximada con dos o más destinos distintos y ninguno alcanza coincidencia exacta o por alias, **When** un cliente pregunta por ese destino, **Then** la IA indica la ambigüedad y pide precisar la ubicación en vez de asumir una de las opciones.

---

### Edge Cases

- ¿Qué pasa si dos alias distintos, al normalizarse (sin tildes, en minúsculas), terminan siendo el mismo texto? El sistema los trata como duplicados y aplica la misma validación de unicidad que a los alias idénticos.
- ¿Qué pasa si se agrega un alias para un nivel geográfico (ej. corregimiento) que el destino tiene vacío? El alias no puede aplicarse a un nivel vacío del destino — la interfaz debe guiar al usuario a elegir un nivel que sí esté completado.
- ¿Qué pasa si el archivo importado incluye una fila con tarifa pero sin costo interno o precio al cliente? La fila se marca como incompleta en la revisión previa y no se puede aprobar hasta completarse.
- ¿Qué pasa si el mismo destino aparece dos veces en el archivo importado, con tarifas distintas? La segunda fila para el mismo destino se marca como posible duplicado, igual que si coincidiera con un destino ya existente en el sistema.
- ¿Qué pasa con las tres tools de IA existentes (`calcular_costo_envio`, `validar_cobertura`, `estimar_fecha_entrega`) una vez agregados los alias? Su comportamiento no cambia — siguen usando comparación exacta y escalando a un humano ante cualquier ambigüedad, tal como hoy. Los alias y la coincidencia aproximada solo aplican a la nueva consulta de opciones (Historia 3).
- ¿Qué pasa si un negocio no tiene ningún transportista o destino configurado? La consulta de opciones responde que no hay cobertura configurada, sin error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST normalizar todo texto de ubicación (nombre de destino, alias, y texto recibido en una consulta) de forma determinística — minúsculas, sin tildes, espacios repetidos colapsados, sin espacios en los bordes — de modo que la misma entrada produzca siempre el mismo resultado normalizado.
- **FR-002**: El sistema MUST permitir registrar múltiples alias por destino ya configurado, cada uno asociado al nivel geográfico específico al que se refiere (provincia/estado, distrito/ciudad, corregimiento, o sector/código postal).
- **FR-003**: El sistema MUST impedir que el mismo alias (comparado en su forma normalizada) se registre para dos destinos distintos dentro del mismo negocio.
- **FR-004**: El sistema MUST permitir eliminar un alias sin afectar el destino ni las tarifas asociadas a él.
- **FR-005**: El motor de búsqueda de destinos MUST reconocer tres niveles de coincidencia al evaluar un nombre de destino contra un texto de ubicación recibido: coincidencia exacta (texto normalizado idéntico), coincidencia por alias (texto normalizado idéntico a un alias registrado), y coincidencia probable (similitud aproximada, para tolerar errores ortográficos leves).
- **FR-006**: El sistema MUST devolver, ante una consulta de opciones de envío, el nivel de confianza de la coincidencia (exacta, por alias, probable, ambigua, o sin coincidencia) junto con las opciones encontradas.
- **FR-007**: El sistema MUST clasificar como "ambigua" una consulta cuyo texto de ubicación coincide de forma aproximada con dos o más destinos distintos sin que ninguno alcance coincidencia exacta o por alias, y en ese caso comunicarlo en vez de elegir un destino al azar.
- **FR-008**: El sistema MUST proveer una consulta que la IA pueda invocar para obtener todas las opciones de envío vigentes que cubren un destino (transportista, servicio, precio al cliente, tiempo estimado), ordenadas por precio, sin necesidad de escalar la conversación a un humano salvo en el caso de ambigüedad de la Historia 5.
- **FR-009**: La respuesta de esa consulta MUST excluir siempre: identificador interno del transportista, teléfono, correo, notas internas, costo interno y margen de ganancia.
- **FR-010**: El comportamiento existente de las tools de IA `calcular_costo_envio`, `validar_cobertura` y `estimar_fecha_entrega` MUST NOT cambiar — siguen resolviendo únicamente por coincidencia exacta y escalando a un humano ante cualquier ambigüedad, igual que hoy.
- **FR-011**: La nueva consulta de opciones de envío MUST quedar efectivamente disponible para que la IA la invoque en una conversación real, sin depender de un paso de configuración adicional que hoy no aplica a las demás herramientas operativas del mismo grupo.
- **FR-012**: El sistema MUST permitir importar un lote de destinos y tarifas desde un archivo CSV/Excel, mostrando antes de confirmar una revisión previa que distinga: destinos nuevos, destinos que coinciden exactamente con uno ya configurado, posibles duplicados (coincidencia aproximada con un destino existente), y alias que coinciden con más de un destino.
- **FR-013**: El sistema MUST impedir confirmar la importación de una fila clasificada como alias ambiguo hasta que quede resuelta o excluida del lote.
- **FR-014**: El sistema MUST registrar cada importación de destinos (archivo, cantidad de filas, resultado) de forma consultable, igual que las importaciones existentes de otras entidades.
- **FR-015**: El sistema MUST completar el nombre visible y el nombre normalizado de todos los destinos ya configurados antes de este cambio (migración de datos), de modo que el nuevo matching funcione también sobre destinos existentes sin que el administrador tenga que volver a cargarlos.

### Key Entities

- **Destino (ubicación de una zona de entrega)**: representa un punto geográfico configurado dentro de una zona de un transportista (provincia/estado, distrito/ciudad, corregimiento, sector — los que apliquen). Se le agrega un nombre visible (para mostrarlo en pantalla) y su versión normalizada (para buscarlo). Puede tener uno o varios alias.
- **Alias de destino**: un nombre alternativo por el que puede reconocerse un destino ya configurado (apodo, forma abreviada, error ortográfico común). Pertenece a un único destino y a un nivel geográfico específico de ese destino. Es único dentro del negocio en su forma normalizada.
- **Registro de importación**: representa el resultado de un lote de destinos/tarifas importado desde archivo — cuántas filas se procesaron, cuántas tuvieron éxito, cuántas quedaron con error o pendientes de revisión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cliente que escribe una variante común (alias registrado o error ortográfico leve) de un destino ya configurado recibe una respuesta con el precio correcto sin ser transferido a un humano, en los casos de coincidencia exacta o por alias.
- **SC-002**: Un administrador puede cargar un lote de al menos 30 destinos por archivo y confirmar la importación después de revisar los casos dudosos, sin que se creen destinos duplicados en el catálogo.
- **SC-003**: El 100% de las respuestas de la IA sobre opciones de envío verificadas no revelan costo interno ni margen de ganancia del negocio.
- **SC-004**: El comportamiento de las tres tools de IA existentes de envío no cambia para ninguna ubicación que ya coincidía de forma exacta antes de este cambio.
- **SC-005**: Un administrador puede agregar un alias a un destino existente y confirmar en menos de un minuto que quedó disponible para la búsqueda.

## Assumptions

- El umbral de similitud usado para la coincidencia "probable" es un valor inicial razonable, ajustable en el futuro según los resultados observados en conversaciones reales — no es una decisión de producto cerrada por este spec.
- La importación de destinos reutiliza las utilidades de lectura de archivos (CSV/Excel) ya existentes en el proyecto, pero implementa su propio flujo de revisión — no se asume que deba integrarse al asistente de importación genérico de Contactos/Empresas, porque el dominio (resolver contra un catálogo con niveles de confianza) es distinto al de crear registros nuevos.
- Los datos operativos usados para enriquecer las opciones de envío (pago contra entrega, días de entrega, hora límite) se leen de la configuración de condiciones del transportista ya existente — este spec no agrega ni modifica esa administración, que sigue siendo de solo lectura.
- Este spec cubre exclusivamente alias, normalización, niveles de confianza e importación de destinos/tarifas. Quedan fuera del alcance (para specs futuros): modalidades de margen configurables, estrategias de recomendación por negocio, simulador visual de "cómo lo encontraría la IA", historial de cambios visible en pantalla, y recargos por peso/dimensiones.
- Los negocios existentes ya tienen transportistas, zonas y tarifas configurados (specs 022/023); este spec extiende ese catálogo, no lo reemplaza.
