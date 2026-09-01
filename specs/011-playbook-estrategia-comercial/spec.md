# Feature Specification: Playbooks de estrategia comercial y selección explicable

**Feature Branch**: `[011-playbook-estrategia-comercial]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Crear un concepto independiente para administrar estrategias de atención, con plantillas precargadas que el negocio pueda activar/desactivar/duplicar/editar/priorizar/asignar a un agente/aplicar según tipo de cliente o intención/reemplazar con una estrategia personalizada. Plantillas iniciales: Venta consultiva suave, Cliente nuevo, Cliente regular, Cliente explorando, Cliente con intención alta, Cliente inactivo, Recomendación basada en ocasión. Las estrategias no deben acoplarse al proveedor de IA. Además, un componente que decida qué estrategia usar según tipo de relación/intención/estado de oportunidad/historial/información faltante/sentimiento o incidencia, de forma explicable y auditable."

## Diagnóstico previo (investigación de código)

- Karia no tiene hoy ningún concepto de "estrategia" o "playbook" comercial — no existe en el schema de Prisma, ni en `src/ai/`, ni en `src/configuracion/ia/`. Es una capacidad genuinamente nueva, no una extensión de algo existente.
- Lo más cercano hoy es `AgenteIAConfig.instrucciones` (lista de strings libres) e `objetivo`/`especialidad` — campos de texto, no una entidad activable/priorizable/asignable independiente. La spec `009-perfil-agente-estructurado-versionado` (en curso de definición, sin implementar aún) agrega reglas estructuradas al agente, pero esas reglas son del agente en sí, no una estrategia intercambiable según el tipo de cliente o intención del momento — son conceptos distintos y complementarios: el agente define *cómo habla siempre*, el playbook define *qué hacer en esta conversación puntual*.
- No existe ningún campo de "tipo de relación con el cliente" ni "intención comercial actual" en ningún lugar del sistema hoy — son producidos por la spec `012-perfil-dinamico-cliente` (independiente, en el mismo plan aprobado). Esta spec debe diseñar el selector de estrategia para **consumir** esa información cuando exista, sin bloquear su propio valor mientras tanto: el selector acepta esas señales como entrada opcional y usa un valor neutro por defecto si no se proveen (ver Assumptions).
- El prompt final del agente ya se compone en capas dentro de `src/ai/prompt/builder.ts` (ver `009`) — el contenido de la estrategia activa debe poder incorporarse ahí como una capa más, sin que el playbook conozca ni dependa de qué proveedor de IA se use (mismo principio de independencia de proveedor que ya sigue todo `src/ai/`).
- El registro de auditoría de IA existente (`UsoIA`) no tiene hoy ningún campo para registrar qué estrategia se usó ni por qué — se necesita extender el registro trazable para la explicabilidad pedida.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestionar playbooks de estrategia sin escribir código (Priority: P1)

Como responsable comercial de mi negocio, quiero ver una lista de plantillas de estrategia de atención y venta ya precargadas, poder activarlas, desactivarlas, duplicarlas, editarlas y darles prioridad, para adaptar cómo mi agente atiende sin depender de un desarrollador.

**Why this priority**: Es la base de todo lo demás — sin playbooks gestionables no hay nada que asignar ni seleccionar.

**Independent Test**: Entrar a la sección de estrategias, ver las 7 plantillas precargadas, activar dos, editar el texto de una, duplicarla, y confirmar que los cambios persisten sin afectar la plantilla original.

**Acceptance Scenarios**:

1. **Given** que entro por primera vez a la sección de estrategias, **When** la abro, **Then** veo las 7 plantillas precargadas (Venta consultiva suave, Cliente nuevo, Cliente regular, Cliente explorando, Cliente con intención alta, Cliente inactivo, Recomendación basada en ocasión), todas inicialmente inactivas.
2. **Given** una plantilla inactiva, **When** la activo, **Then** queda disponible para ser asignada a un agente.
3. **Given** una plantilla activa, **When** la edito (cambio o agrego una regla de su contenido), **Then** el cambio se guarda como parte de esa estrategia, sin crear una copia.
4. **Given** cualquier plantilla, **When** elijo duplicarla, **Then** se crea una copia independiente editable, dejando la original intacta.
5. **Given** dos o más estrategias activas, **When** les asigno una prioridad distinta, **Then** el orden de prioridad queda guardado y visible.
6. **Given** una estrategia activa, **When** la desactivo, **Then** deja de estar disponible para nuevas asignaciones, pero no se elimina ni pierde su configuración.

---

### User Story 2 - Asignar estrategias a un agente y que se apliquen según el tipo de cliente o intención (Priority: P1)

Como responsable comercial, quiero asignar una o más estrategias activas a un agente y definir a qué tipo de cliente o intención aplica cada una, para que el agente use automáticamente la estrategia correcta según la situación de cada conversación, y quiero poder ver por qué se eligió esa estrategia en cada caso.

**Why this priority**: Es el valor de negocio central — sin esto, los playbooks de la Historia 1 son solo texto guardado sin efecto.

**Independent Test**: Asignar la estrategia "Cliente nuevo" a un agente con condición "tipo de relación = nuevo contacto" y la estrategia "Cliente con intención alta" con condición "intención = listo para comprar"; simular ambos casos y verificar que cada uno selecciona la estrategia correcta, con el motivo registrado.

**Acceptance Scenarios**:

1. **Given** un agente con dos o más estrategias asignadas, cada una con sus condiciones de aplicación, **When** se necesita generar una respuesta para una conversación con un tipo de cliente/intención conocidos, **Then** el sistema selecciona la estrategia cuyas condiciones coinciden, respetando la prioridad configurada si más de una calificara.
2. **Given** que ninguna estrategia asignada tiene condiciones que coincidan con la situación actual, **When** se necesita generar una respuesta, **Then** el sistema continúa sin aplicar ninguna estrategia específica (comportamiento equivalente al actual, sin bloquear la generación).
3. **Given** una selección de estrategia realizada, **When** el responsable la revisa, **Then** puede ver qué estrategia se eligió y el motivo (qué condición coincidió).
4. **Given** que la información de tipo de cliente o intención todavía no está disponible para una conversación, **When** el sistema necesita seleccionar estrategia, **Then** no falla — usa el comportamiento por defecto (sin estrategia específica) y lo registra como tal.

---

### User Story 3 - Reemplazar una plantilla con una estrategia 100% personalizada (Priority: P3)

Como responsable comercial con necesidades propias, quiero poder crear una estrategia desde cero (sin partir de ninguna plantilla) o reemplazar completamente el contenido de una plantilla existente, para adaptar la atención a un caso que las plantillas precargadas no cubren.

**Why this priority**: Es una extensión de flexibilidad sobre las Historias 1 y 2 — valiosa, pero las plantillas precargadas ya cubren los casos más comunes, así que esto no bloquea el valor inicial.

**Independent Test**: Crear una estrategia nueva desde cero, con reglas propias, activarla, asignarla a un agente con una condición propia, y confirmar que participa en la selección igual que cualquier plantilla.

**Acceptance Scenarios**:

1. **Given** que quiero una estrategia sin partir de ninguna plantilla, **When** elijo crear una nueva, **Then** puedo definir su contenido y condiciones de aplicación libremente, igual que si fuera una plantilla editada.

### Edge Cases

- ¿Qué pasa si dos estrategias asignadas a un mismo agente tienen condiciones que coinciden simultáneamente? El sistema MUST elegir la de mayor prioridad configurada, y MUST registrar que hubo más de una candidata.
- ¿Qué pasa si se desactiva una estrategia que estaba siendo la seleccionada para conversaciones en curso? El sistema MUST dejar de seleccionarla desde ese momento, sin afectar respuestas ya generadas.
- ¿Qué pasa si se elimina (no solo desactiva) una estrategia asignada a un agente? El sistema MUST impedir la eliminación mientras esté asignada, o MUST quitar la asignación de forma explícita y visible como parte de esa acción.
- ¿Qué pasa si el negocio no configura ninguna estrategia? El sistema MUST comportarse exactamente igual que antes de esta funcionalidad — ninguna estrategia es obligatoria.
- ¿Qué pasa si la estrategia seleccionada contiene una instrucción que contradice una regla obligatoria del agente (por ejemplo, presionar para comprar)? La regla obligatoria del agente MUST prevalecer sobre la estrategia — ver precedencia general documentada en `docs/AGENTE-IA-EVOLUCION-ANALISIS.md` §7 (una estrategia nunca sobrescribe una regla obligatoria).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST precargar, por instancia, las 7 plantillas de estrategia descritas (Venta consultiva suave, Cliente nuevo, Cliente regular, Cliente explorando, Cliente con intención alta, Cliente inactivo, Recomendación basada en ocasión), inicialmente inactivas, con su contenido de reglas correspondiente.
- **FR-002**: El sistema MUST permitir activar y desactivar cualquier estrategia (plantilla o personalizada) de forma independiente.
- **FR-003**: El sistema MUST permitir duplicar cualquier estrategia existente, creando una copia independiente editable sin alterar el original.
- **FR-004**: El sistema MUST permitir editar el contenido (reglas) y las condiciones de aplicación de cualquier estrategia, incluidas las plantillas precargadas.
- **FR-005**: El sistema MUST permitir asignar una prioridad relativa a cada estrategia activa, usada para desempatar cuando más de una calificaría para la misma situación.
- **FR-006**: El sistema MUST permitir asignar una o más estrategias activas a un agente, cada una con sus condiciones de aplicación (tipo de cliente y/o intención comercial).
- **FR-007**: El sistema MUST seleccionar, para cada solicitud de generación de respuesta, como máximo una estrategia activa entre las asignadas al agente cuyas condiciones coincidan con la situación conocida, priorizando por la prioridad configurada en caso de empate.
- **FR-008**: El sistema MUST continuar generando respuestas normalmente cuando ninguna estrategia asignada coincide, o cuando el agente no tiene ninguna estrategia asignada — sin bloquear ni degradar el comportamiento actual.
- **FR-009**: El sistema MUST registrar, para cada selección realizada, qué estrategia fue elegida (o que no se eligió ninguna) y el motivo, de forma consultable por un responsable.
- **FR-010**: El sistema MUST permitir crear una estrategia completamente nueva sin partir de ninguna plantilla.
- **FR-011**: El sistema MUST impedir eliminar una estrategia mientras esté asignada a algún agente, o MUST quitar explícitamente esa asignación como parte de la eliminación, dejando constancia del cambio.
- **FR-012**: El contenido y las condiciones de una estrategia MUST representarse de forma independiente de cualquier proveedor de IA concreto — ninguna estrategia MUST referenciar un proveedor, modelo o API específica.
- **FR-013**: Una estrategia seleccionada MUST NOT tener capacidad de anular ni contradecir una regla obligatoria del agente; ante conflicto, la regla obligatoria del agente prevalece.

### Key Entities *(include if feature involves data)*

- **Estrategia (Playbook)**: nombre, descripción, origen (plantilla del sistema o personalizada), estado (activa/inactiva), contenido (lista estructurada de reglas/pasos de la estrategia), condiciones de aplicación (tipo de cliente y/o intención comercial a las que aplica), prioridad. Pertenece a una instancia (negocio).
- **Asignación de estrategia a agente**: vínculo entre una estrategia activa y un agente, con la prioridad efectiva de esa asignación para ese agente.
- **Registro de selección de estrategia**: para una solicitud de generación de respuesta dada, qué estrategia fue seleccionada (o ninguna), y el motivo (qué condición coincidió, o por qué no coincidió ninguna).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un responsable comercial puede activar, editar, duplicar y priorizar una estrategia sin ninguna intervención técnica.
- **SC-002**: El 100% de las estrategias precargadas están disponibles y editables desde el primer uso de esta funcionalidad, sin necesidad de creación manual.
- **SC-003**: Dada una selección de estrategia realizada, un responsable puede identificar la estrategia elegida y su motivo en menos de 3 pasos.
- **SC-004**: Ningún agente sin estrategias configuradas cambia su comportamiento de generación de respuesta tras desplegar esta funcionalidad.
- **SC-005**: Ninguna estrategia configurada logra que una respuesta generada contradiga una regla obligatoria del agente.

## Assumptions

- El selector de estrategia (Historia 2) recibe el tipo de relación y la intención comercial como entradas opcionales provistas por quien solicita la generación de respuesta. Mientras la spec `012-perfil-dinamico-cliente` no esté implementada, esas entradas estarán ausentes en los flujos reales y el selector operará siempre en el camino "sin coincidencia" (FR-008) — esto es esperado y no bloquea el valor de la Historia 1 (gestión de playbooks) ni la capacidad de configurarlos y probarlos manualmente (por ejemplo desde un flujo de prueba que sí provea esas entradas).
- El contenido de una estrategia es una lista de reglas/pasos en lenguaje natural (igual espíritu que las 7 plantillas descritas en el pedido original), no un formato ejecutable o con lógica condicional interna — la lógica condicional vive en las "condiciones de aplicación" (cuándo se selecciona), no dentro del contenido.
- "Tipo de cliente" e "intención comercial" como valores de condición usan el mismo vocabulario que definirá `012-perfil-dinamico-cliente` (tipo de relación: nuevo contacto, prospecto recurrente, cliente nuevo, cliente regular, cliente inactivo, cliente con incidencia activa; intención: explorando, comparando, solicitando recomendación, etc.) — se anticipa aquí como catálogo cerrado para que ambas specs queden alineadas sin necesidad de retrabajo.
- No se requiere en esta fase una interfaz de "sentimiento" o "estado de oportunidad" como condición de selección — el pedido original los menciona como señales futuras del selector; esta spec cubre tipo de cliente e intención, que son las señales explícitamente asignadas a plantillas concretas en el pedido. Ampliar a más señales queda para cuando `012` exista.
- Fuera de alcance de esta spec: el cálculo real de tipo de relación/intención (spec `012`), la incorporación del contenido de la estrategia dentro del prompt compuesto por capas con su precedencia final (spec `013-context-builder-capas-precedencia`, que consumirá el resultado del selector definido acá), y el simulador.
