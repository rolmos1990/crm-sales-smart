# Feature Specification: Alias único para múltiples instancias del mismo proveedor de IA

**Feature Branch**: `[021-alias-proveedores-ia]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "ayudame a organizar en la configuracion de agentes IA puedo tener uno o varios del mismo tipo por ejemplo Deepseek podria tener 2 o 3 diferentes (con el mismo o diferente token) pero serian diferentes agentes para el sistema. Para identificarlos debo poder agregarle un Alias al momento de crearlo o editarlo, este alias es por el que me referire al momento de seleccionar el enrutamiento por objetos, importante los alias son unicos y no se deben repetir para evitar confusiones de angentes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear varias configuraciones del mismo proveedor con un Alias propio (Priority: P1)

Como responsable de configurar la IA de mi negocio, quiero poder crear más de una configuración de agente IA para el mismo proveedor (por ejemplo, dos o tres configuraciones de DeepSeek, con el mismo token o con tokens distintos), asignándole a cada una un Alias al momento de crearla, para poder tratarlas como agentes independientes dentro del sistema.

**Why this priority**: Es el bloqueo actual — hoy el sistema no permite tener más de una configuración del mismo proveedor para el mismo tipo de agente, así que no hay forma de tener "dos DeepSeek diferentes". Sin esto no hay nada que alias-ar.

**Independent Test**: Crear una configuración de DeepSeek con Alias "DeepSeek Ventas", y luego crear una segunda configuración de DeepSeek (mismo o distinto token) con Alias "DeepSeek Soporte"; verificar que ambas quedan guardadas como agentes separados y visibles en el listado de proveedores.

**Acceptance Scenarios**:

1. **Given** que ya tengo un agente de IA configurado para el proveedor DeepSeek, **When** creo un segundo agente para el mismo proveedor DeepSeek con un Alias distinto, **Then** el sistema lo guarda como un agente adicional, sin reemplazar ni entrar en conflicto con el primero.
2. **Given** que estoy creando un nuevo agente de IA, **When** completo el formulario, **Then** el campo Alias es obligatorio y debo completarlo antes de poder guardar.
3. **Given** que ya existe un agente con Alias "DeepSeek Ventas", **When** intento crear otro agente usando exactamente ese mismo Alias, **Then** el sistema rechaza el guardado y me indica que ese Alias ya está en uso.
4. **Given** que dos o más agentes usan el mismo token de proveedor, **When** los creo con Alias distintos, **Then** el sistema los acepta como agentes independientes sin exigir que el token también sea distinto.

---

### User Story 2 - Editar el Alias (y el resto de la configuración) de un agente existente (Priority: P1)

Como responsable de configurar la IA de mi negocio, quiero poder editar un agente de IA ya creado — incluyendo su Alias — para corregir un nombre poco claro o actualizar sus credenciales sin tener que borrarlo y crearlo de nuevo.

**Why this priority**: El pedido explícito incluye "al momento de crearlo o editarlo" — hoy el sistema no tiene ninguna pantalla de edición para un agente ya creado (solo se puede activar/desactivar o eliminar), así que esta capacidad no existe y es necesaria para que el Alias sea mantenible en el tiempo, no solo asignable una vez.

**Independent Test**: Abrir un agente de IA ya creado, cambiar su Alias por uno nuevo no usado por ningún otro agente, guardar, y verificar que el nuevo Alias se refleja en el listado de proveedores y en la pantalla de enrutamiento por objetivo.

**Acceptance Scenarios**:

1. **Given** un agente de IA ya creado, **When** entro a editarlo, **Then** puedo ver y modificar su Alias junto con el resto de su configuración (credenciales, modelos, prioridad, límites).
2. **Given** que edito el Alias de un agente, **When** intento guardar un Alias que ya usa otro agente distinto, **Then** el sistema rechaza el guardado y me indica que ese Alias ya está en uso, sin perder los cambios que ya había hecho en el formulario.
3. **Given** que edito un agente y le dejo el mismo Alias que ya tenía, **When** guardo, **Then** el sistema lo permite sin marcarlo como duplicado consigo mismo.

---

### User Story 3 - Distinguir agentes del mismo proveedor al elegir el enrutamiento por objetivo (Priority: P1)

Como responsable de configurar la IA de mi negocio, quiero que en la pantalla de enrutamiento por objetivo (y en cualquier otro lugar donde deba elegir un agente) se muestre el Alias de cada agente en vez de únicamente el nombre del proveedor, para poder distinguir con certeza cuál de mis varios agentes DeepSeek estoy asignando a cada objetivo.

**Why this priority**: Es la razón de negocio detrás de todo el pedido — un Alias que existe pero no se ve en el selector de enrutamiento no resuelve la confusión que el usuario quiere evitar.

**Independent Test**: Con dos o más agentes DeepSeek activos con Alias distintos, entrar a la pantalla de enrutamiento por objetivo y verificar que el menú desplegable de cada objetivo lista los Alias de los agentes, no el nombre repetido del proveedor.

**Acceptance Scenarios**:

1. **Given** dos o más agentes activos del mismo proveedor, **When** abro el selector de proveedor para cualquier objetivo de enrutamiento, **Then** cada opción del menú muestra el Alias del agente, permitiéndome distinguirlos entre sí sin ambigüedad.
2. **Given** que asigno un objetivo a un agente identificado por su Alias, **When** vuelvo a entrar a la pantalla, **Then** la asignación sigue mostrando el Alias correcto de ese agente.

### Edge Cases

- ¿Qué pasa con los agentes de IA creados antes de esta funcionalidad, que no tienen Alias? El sistema MUST asignarles automáticamente un Alias único y válido (derivado del proveedor) al aplicar esta funcionalidad, sin requerir intervención manual, para que sigan funcionando y sean seleccionables en el enrutamiento.
- ¿Qué pasa si se intenta usar un Alias que solo difiere en mayúsculas/minúsculas o espacios al principio/final de uno ya existente ("DeepSeek Ventas" vs "deepseek ventas ")? El sistema MUST tratarlos como el mismo Alias a efectos de duplicado, para evitar la confusión que el usuario busca prevenir.
- ¿Qué pasa si se intenta guardar un Alias vacío o compuesto solo de espacios? El sistema MUST rechazarlo, ya que el Alias es obligatorio.
- ¿Qué pasa con la restricción actual que limita un proveedor a una sola configuración por tipo de agente (Comercial/Gerencia/General)? El sistema MUST eliminar esa restricción — ahora puede haber cualquier cantidad de agentes del mismo proveedor y del mismo tipo de agente, diferenciados únicamente por su Alias único.
- ¿Qué pasa si se elimina un agente que tenía un objetivo de enrutamiento asignado? Se mantiene el comportamiento ya existente (el objetivo queda señalado como inválido hasta reasignarlo) — fuera de alcance de este cambio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir crear más de un agente de IA para el mismo proveedor (por ejemplo, DeepSeek), cada uno con sus propias credenciales, ya sea el mismo token o uno diferente.
- **FR-002**: El sistema MUST eliminar cualquier restricción que hoy impida crear dos o más agentes con el mismo proveedor y el mismo tipo de agente (Comercial/Gerencia/General) dentro de la misma instancia.
- **FR-003**: El sistema MUST requerir un Alias al crear un nuevo agente de IA, y MUST impedir guardar el agente si el campo queda vacío.
- **FR-004**: El sistema MUST garantizar que el Alias de cada agente sea único dentro de la misma instancia de negocio, sin distinguir mayúsculas/minúsculas ni espacios al principio o al final.
- **FR-005**: El sistema MUST rechazar la creación o edición de un agente cuyo Alias coincida (según la regla de FR-004) con el de otro agente ya existente en la misma instancia, mostrando un mensaje claro que indique que el Alias ya está en uso.
- **FR-006**: El sistema MUST permitir editar un agente de IA ya creado, incluyendo su Alias y el resto de su configuración (credenciales, modelos disponibles, prioridad, límites, tipo de agente).
- **FR-007**: El sistema MUST permitir guardar la edición de un agente conservando su propio Alias sin marcarlo como duplicado de sí mismo.
- **FR-008**: El sistema MUST mostrar el Alias de cada agente (en vez de únicamente el nombre del proveedor) en todo listado o selector donde se elija un agente de IA específico, incluyendo la pantalla de enrutamiento por objetivo y el listado de proveedores configurados.
- **FR-009**: El sistema MUST asignar automáticamente un Alias único y válido a todo agente de IA que ya existiera antes de esta funcionalidad, de forma que ninguna configuración ni asignación de enrutamiento previa quede rota o requiera corrección manual inmediata.

### Key Entities *(include if feature involves data)*

- **Agente de IA (configuración de proveedor)**: una configuración individual de conexión a un proveedor de IA (proveedor, credenciales, modelos, prioridad, límites, tipo de agente). Antes de este cambio se identificaba solo por la combinación proveedor + tipo de agente; después de este cambio se identifica además por su Alias, único dentro de la instancia, y pueden coexistir varios agentes del mismo proveedor.
- **Alias**: nombre corto elegido por quien configura el agente, único dentro de la instancia (sin distinguir mayúsculas/minúsculas ni espacios de borde), usado para identificar inequívocamente ese agente en cualquier selector del sistema, en particular el enrutamiento por objetivo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un responsable de negocio puede crear 3 agentes de IA del mismo proveedor (mismo o distinto token) dentro de la misma instancia, cada uno con su propio Alias, sin ninguna intervención técnica.
- **SC-002**: El 100% de los intentos de guardar un Alias duplicado (al crear o editar) son rechazados antes de persistirse, con un mensaje que identifica el motivo.
- **SC-003**: En la pantalla de enrutamiento por objetivo, con múltiples agentes del mismo proveedor activos, un responsable puede identificar a qué agente específico está asignando cada objetivo leyendo únicamente el Alias mostrado en el selector.
- **SC-004**: El 100% de los agentes de IA que existían antes de esta funcionalidad siguen siendo seleccionables y funcionales inmediatamente después de aplicarla, cada uno con un Alias asignado automáticamente.

## Assumptions

- El Alias es un texto corto (se asume un máximo razonable de 50 caracteres) sin restricciones especiales de formato más allá de no poder estar vacío; la comparación de unicidad ignora mayúsculas/minúsculas y espacios al principio/final.
- La unicidad del Alias aplica por instancia de negocio (tenant), no de forma global entre distintas instancias del sistema.
- Para los agentes existentes sin Alias, un valor por defecto derivado del nombre del proveedor (agregando un sufijo si hace falta para garantizar unicidad) es una migración aceptable — el responsable de negocio puede luego renombrarlos vía la edición cubierta en la Historia 2.
- El tipo de proveedor (por ejemplo, DeepSeek) de un agente ya creado no cambia como parte de esta funcionalidad; la edición cubierta aquí no incluye migrar un agente de un proveedor a otro.
- Fuera de alcance de esta spec: cambios al mecanismo de selección de proveedor por resguardo ante fallas, al enrutamiento por objetivo en sí (spec `010-enrutamiento-modelos-ia-por-objetivo`, ya existente) y a la gestión de costos/límites de uso — todos se mantienen sin alterar salvo por mostrar el Alias donde corresponda.
