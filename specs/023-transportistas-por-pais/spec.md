# Feature Specification: Transportistas por país

**Feature Branch**: `[023-transportistas-por-pais]`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Transportistas por país: cada transportista (courier) queda asociado a un único país (campo obligatorio, catálogo Pais existente). Esto permite tener el mismo courier comercial registrado varias veces, una por país en el que opera (ej. \"UnoExpress\" como registro separado para Panamá y para Colombia), cada uno con su propia configuración de zonas, tarifas y condiciones. La pestaña \"Zonas y tarifas\" de un transportista queda acotada al país de ese transportista: al crear/editar una zona de entrega desde ahí, el país de la ubicación viene heredado del transportista (bloqueado, no editable), y el campo Provincia/Estado deja de ser texto libre — pasa a ser un combobox que consulta el catálogo real EstadoProvincia (ya existente en el proyecto, poblado por scripts/seed-geografia.ts) filtrado por ese país, igual que el componente SelectorEstadoProvincia ya usado en cotizaciones/pedidos. La lista de transportistas y el header de detalle muestran el país (bandera + nombre) junto al nombre del transportista para distinguir registros del mismo courier en distintos países. Transportistas existentes sin país asignado deben migrarse (backfill) antes de que el campo se vuelva obligatorio."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Asignar el país de operación de un transportista (Priority: P1)

Como negocio que trabaja con el mismo courier comercial en varios países, quiero indicar el país en el que opera cada transportista al crearlo o editarlo, para poder tener registros separados e independientes del mismo courier por país (por ejemplo "UnoExpress" en Panamá y "UnoExpress" en Colombia) sin que se mezclen sus zonas, tarifas ni condiciones.

**Why this priority**: Es la base de todo lo demás — sin un país asignado al transportista no existe forma de acotar sus zonas de cobertura ni de distinguir dos registros del mismo courier. Ninguna otra historia es útil sin esta.

**Independent Test**: Crear dos transportistas con el mismo nombre comercial pero país distinto, y confirmar que cada uno se guarda y se edita como un registro completamente independiente.

**Acceptance Scenarios**:

1. **Given** que se está creando un nuevo transportista, **When** se completa el formulario, **Then** el país es un campo obligatorio que se elige de un catálogo de países (no texto libre).
2. **Given** un transportista ya creado con un país asignado, **When** se abre su pestaña de información, **Then** el país aparece visible junto al resto de sus datos.
3. **Given** dos transportistas con el mismo nombre comercial pero país distinto, **When** se editan por separado, **Then** los cambios en uno (nombre, condiciones, zonas, tarifas) no afectan en absoluto al otro.

---

### User Story 2 - Configurar zonas y tarifas usando el catálogo real de estados/provincias del país del transportista (Priority: P1)

Como negocio, al agregar o editar una zona de entrega desde la pestaña "Zonas y tarifas" de un transportista, quiero que el país quede fijado automáticamente al país de ese transportista y que la provincia/estado se elija de una lista real de opciones válidas para ese país, para no tener que volver a elegir el país cada vez ni arriesgarme a escribir un nombre de provincia que no existe o está mal escrito.

**Why this priority**: Es el problema concreto que motivó este pedido — hoy la provincia/estado es texto libre, sin relación con ningún catálogo, lo que permite errores de tipeo y zonas que no corresponden a ninguna división real. Depende de la Historia 1 (necesita saber el país del transportista para acotar las opciones).

**Independent Test**: Abrir "Agregar zona" en un transportista con país asignado, confirmar que el campo país aparece pre-completado y no se puede cambiar ahí, y que el campo provincia/estado ofrece únicamente las opciones reales de ese país.

**Acceptance Scenarios**:

1. **Given** un transportista con país asignado, **When** se abre el diálogo para agregar una nueva zona de entrega, **Then** el país de la ubicación aparece pre-completado con el país del transportista y no se puede modificar desde ese diálogo.
2. **Given** el diálogo de nueva zona abierto, **When** se completa el campo provincia/estado, **Then** solo se pueden elegir opciones que realmente existen para el país del transportista (no texto libre).
3. **Given** una zona ya creada con una provincia/estado del catálogo, **When** se revisa la tabla de zonas y tarifas, **Then** la provincia/estado configurada se muestra con su nombre real de catálogo.

---

### User Story 3 - Distinguir a simple vista transportistas del mismo courier en distintos países (Priority: P2)

Como negocio, quiero ver el país de cada transportista (bandera y nombre) junto a su nombre comercial en la lista de transportistas y en el encabezado de su pantalla de detalle, para identificar de inmediato cuál registro corresponde a cuál país cuando el mismo courier aparece más de una vez.

**Why this priority**: Mejora la usabilidad y evita errores al operar (elegir el transportista equivocado), pero el sistema ya es funcionalmente correcto sin esto una vez resueltas las Historias 1 y 2 — es una mejora de claridad, no de capacidad.

**Independent Test**: Con dos transportistas del mismo nombre en países distintos ya creados, abrir la lista de transportistas y confirmar que se distinguen a simple vista sin necesidad de entrar a cada uno.

**Acceptance Scenarios**:

1. **Given** dos o más transportistas registrados, **When** se abre la lista de transportistas, **Then** cada fila muestra el país (bandera y nombre) del transportista además de su nombre comercial.
2. **Given** un transportista abierto en su pantalla de detalle, **When** se ve el encabezado, **Then** el país aparece junto al nombre del transportista.

---

### User Story 4 - Completar el país de transportistas creados antes de este cambio (Priority: P2)

Como administrador, cuando el sistema empieza a exigir el país en cada transportista, quiero que los transportistas que ya existían sigan funcionando con normalidad y que se me indique con claridad cuáles necesitan que les complete el país, para no perder ni interrumpir la operación de couriers que ya estaban activos.

**Why this priority**: Es una condición de transición, no una capacidad nueva de uso diario — pero es obligatoria para poder activar las Historias 1 y 2 sin romper transportistas existentes ni sus zonas/tarifas ya configuradas.

**Independent Test**: Sobre una base con transportistas creados antes de este cambio, confirmar que ninguno queda inutilizable tras la migración y que los que no pudieron completarse automáticamente muestran un aviso claro pidiendo completar el país.

**Acceptance Scenarios**:

1. **Given** un transportista creado antes de este cambio cuyo país se pudo inferir sin ambigüedad a partir de sus zonas ya configuradas, **When** se aplica la migración, **Then** el transportista queda con ese país asignado automáticamente, sin intervención manual.
2. **Given** un transportista creado antes de este cambio cuyo país no se pudo inferir sin ambigüedad, **When** se aplica la migración, **Then** el transportista sigue operando con normalidad (sus cotizaciones y pedidos existentes no se ven afectados) pero muestra un aviso visible pidiendo completar su país antes de poder agregar nuevas zonas.
3. **Given** un transportista con el aviso de país pendiente, **When** el administrador completa el país, **Then** el aviso desaparece y el transportista queda con las mismas capacidades que uno creado después de este cambio.

---

### Edge Cases

- ¿Qué pasa si se intenta cambiar el país de un transportista que ya tiene zonas o tarifas configuradas? El sistema no debe permitir dejar zonas/tarifas "huérfanas" de un país distinto al nuevo — ver FR-010.
- ¿Qué pasa si dos transportistas terminan con el mismo nombre comercial y el mismo país (duplicado exacto, no una variante por país)? El sistema lo permite (no es un caso prohibido) pero no es el patrón que este feature promueve — el patrón esperado es mismo nombre, país distinto.
- ¿Qué pasa si el país de un transportista no tiene ninguna provincia/estado cargada en el catálogo? El campo provincia/estado queda disponible pero sin opciones; la zona igual puede crearse dejando ese nivel vacío (comodín), consistente con el resto del catálogo geográfico del proyecto.
- ¿Qué pasa con las cotizaciones y pedidos ya entregados por un transportista antes de este cambio, si ese transportista queda con el aviso de país pendiente? Siguen mostrando su información histórica sin cambios; el aviso solo bloquea agregar zonas/tarifas nuevas, no el historial.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exigir que todo transportista tenga un país asignado, elegido de un catálogo cerrado de países (no texto libre), tanto al crear un transportista nuevo como condición para poder agregarle zonas o tarifas.
- **FR-002**: El sistema MUST permitir que existan varios transportistas con el mismo nombre comercial, siempre que cada uno tenga su propio registro independiente (con su propio país, zonas, tarifas y condiciones).
- **FR-003**: El sistema MUST mostrar el país (con su indicador visual — bandera — y nombre) del transportista en: el formulario de información del transportista, el encabezado de su pantalla de detalle, y cada fila de la lista de transportistas.
- **FR-004**: Al crear o editar una zona de entrega desde la pestaña "Zonas y tarifas" de un transportista, el sistema MUST fijar automáticamente el país de esa ubicación al país del transportista, sin permitir elegir un país distinto desde ese flujo.
- **FR-005**: Al crear o editar una zona de entrega desde la pestaña "Zonas y tarifas" de un transportista, el sistema MUST ofrecer el campo provincia/estado como una selección acotada a las opciones reales del catálogo geográfico correspondientes al país del transportista, en lugar de texto libre.
- **FR-006**: El sistema MUST seguir permitiendo que el nivel provincia/estado quede vacío quando el país del transportista no tiene provincias/estados cargados en el catálogo, o cuando la zona debe cubrir todo el país (comodín) — sin bloquear la creación de la zona por esto.
- **FR-007**: La tabla de zonas y tarifas de un transportista MUST mostrar la provincia/estado real configurada en cada zona (tomada del catálogo), no solo el nombre libre de la zona.
- **FR-008**: El sistema MUST migrar (backfill) los transportistas creados antes de este cambio: cuando el país pueda inferirse sin ambigüedad a partir de las ubicaciones de sus zonas ya configuradas, se asigna automáticamente; en caso contrario, el transportista queda operando con normalidad pero marcado con un aviso visible de "país pendiente".
- **FR-009**: Un transportista con el aviso de "país pendiente" MUST poder seguir usándose con normalidad para todo lo ya configurado (sus zonas, tarifas, condiciones y el historial de cotizaciones/pedidos que ya lo usaron), pero el sistema MUST impedir agregarle zonas o tarifas nuevas hasta que se complete su país.
- **FR-010**: El sistema MUST impedir cambiar el país de un transportista que ya tiene al menos una zona o tarifa configurada, para evitar dejar esa configuración asociada a un país distinto al vigente; el país solo puede cambiarse si antes se quitan todas sus zonas/tarifas, o queda fijo apenas se crea la primera.

### Key Entities

- **Transportista**: representa a un courier operando en un único país. Ya existe en el sistema; este feature le agrega la asociación obligatoria a un país del catálogo. Dos transportistas pueden compartir el mismo nombre comercial si representan al mismo courier operando en países distintos, pero son registros completamente independientes entre sí.
- **País**: catálogo existente de países, ya usado en otras partes del sistema (cotizaciones, pedidos). Este feature lo reutiliza como el origen de la lista de países disponibles para un transportista.
- **Provincia/Estado**: catálogo existente de divisiones geográficas por país, ya usado en otras partes del sistema. Este feature lo reutiliza para acotar las opciones del campo provincia/estado al crear o editar una zona de entrega de un transportista, en lugar de aceptar texto libre.
- **Zona de entrega / Ubicación de zona**: ya existen en el sistema. Este feature no cambia su estructura, solo acota qué país puede tener cada ubicación creada desde un transportista (el del transportista) y de dónde salen las opciones válidas de provincia/estado (del catálogo, filtradas por ese país).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El negocio puede registrar el mismo courier comercial operando en dos países distintos como dos transportistas independientes, sin que ninguna acción sobre uno (editar, desactivar, cambiar tarifas) afecte al otro.
- **SC-002**: Al configurar una zona de entrega desde un transportista, el usuario completa el país y la provincia/estado sin escribir texto libre en ningún momento — el país no vuelve a preguntarse y la provincia/estado se elige de una lista.
- **SC-003**: Cero zonas de entrega quedan creadas con un nombre de provincia/estado que no corresponde a ninguna división real del catálogo, a partir de la entrada en vigencia de este cambio.
- **SC-004**: El 100% de los transportistas que existían antes de este cambio sigue operando sin interrupciones inmediatamente después de la migración, ya sea con su país asignado automáticamente o con el aviso de "país pendiente" visible.
- **SC-005**: En la lista de transportistas, un usuario puede identificar a qué país corresponde cada registro sin necesidad de abrir su pantalla de detalle.

## Assumptions

- El catálogo de países y de provincias/estados ya existente en el sistema (usado hoy en cotizaciones y pedidos) es la fuente de verdad reutilizada aquí; este feature no introduce un catálogo ni una integración externa nueva.
- No se exige unicidad de nombre comercial entre transportistas: se permite que dos registros compartan nombre (es el patrón esperado cuando representan al mismo courier en países distintos), y también se permite —aunque no es el caso de uso promovido— que compartan nombre y país.
- El campo país, una vez fijado en un transportista que ya tiene zonas o tarifas, se vuelve de solo lectura; para operar en un país distinto se crea un transportista nuevo en vez de reutilizar el existente.
- La inferencia automática del país durante la migración de transportistas existentes se basa únicamente en datos ya cargados (las ubicaciones de sus zonas actuales); no se le pide al negocio ninguna acción manual antes de que el cambio entre en vigencia.
- Mostrar el país en listas y encabezados usa el mismo formato (bandera + nombre) que ya usan los selectores de país existentes en otras partes del sistema, sin inventar un formato nuevo.
