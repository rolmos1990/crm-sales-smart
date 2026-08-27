# Feature Specification: Reinicio de scroll al navegar entre secciones

**Feature Branch**: `[003-fix-scroll-position-nav]`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Actualmente tengo un problema y es que se corta la pantalla cada vez que refresco y no se ve la parte superior, no se si es por algun cambio de estilo pero cada vez que navego entre opciones por ejemplo del Dashboard al Pipeline no veo los menus superiores, titulos ya que se corta (parece un error en algo de diseno) puedes verificar y armar una especificacion que permita corregir este bug."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver siempre la parte superior al navegar entre secciones del menú (Priority: P1)

Como usuario del CRM, cuando hago clic en una opción del menú principal para ir a otra sección (por ejemplo, de "Dashboard" a "Pipeline"), quiero que la nueva sección se muestre desde su parte superior, con el menú superior y el título visibles de inmediato, en lugar de aparecer "cortada" mostrando contenido de más abajo.

**Why this priority**: Es el problema reportado directamente por el usuario y ocurre en la navegación más básica y frecuente de la aplicación (moverse entre secciones del menú). Mientras persista, cada cambio de sección puede dejar al usuario viendo contenido a mitad de página sin contexto (sin saber en qué sección está ni qué acciones tiene disponibles arriba).

**Independent Test**: Estando en una sección con suficiente contenido para requerir scroll (por ejemplo, el Dashboard), desplazarse hacia abajo y luego hacer clic en otra opción del menú (por ejemplo, "Pipeline"). La nueva sección debe mostrarse desde arriba, con su menú superior y título visibles, sin que el usuario tenga que desplazarse manualmente.

**Acceptance Scenarios**:

1. **Given** el usuario está en una sección con scroll hacia abajo, **When** hace clic en otra opción del menú principal, **Then** la sección de destino se muestra desde su parte superior, con el menú superior y el título visibles sin scroll manual.
2. **Given** el usuario navega entre dos secciones cualesquiera de la aplicación (CRM, Ventas, Productos, Configuración, etc.), **When** la navegación se completa, **Then** el comportamiento de "mostrar desde arriba" es el mismo en todas las secciones, no solo en el caso Dashboard → Pipeline.

---

### User Story 2 - Ver siempre la parte superior al recargar la página (Priority: P2)

Como usuario del CRM, cuando recargo el navegador estando en cualquier sección, quiero que la página se muestre desde su parte superior, con el menú superior y el título visibles, en lugar de aparecer cortada.

**Why this priority**: Es el segundo síntoma reportado por el usuario. Es menos frecuente que la navegación por menú (User Story 1) pero igual de confuso cuando ocurre, y podría compartir la misma causa.

**Independent Test**: Estando en cualquier sección con scroll hacia abajo, recargar la página completa del navegador. La sección debe mostrarse desde arriba, con su menú superior y título visibles.

**Acceptance Scenarios**:

1. **Given** el usuario está en cualquier sección con scroll hacia abajo, **When** recarga la página del navegador, **Then** la sección se muestra desde su parte superior, con el menú superior y el título visibles.

---

### Edge Cases

- ¿Qué ocurre con secciones que tienen su propio desplazamiento interno independiente (por ejemplo, el tablero del Pipeline, que se desplaza horizontalmente entre etapas)? Solo debe reiniciarse el desplazamiento general de la sección; el desplazamiento interno de esos tableros/paneles no debe verse forzado a un estado distinto al que ya tenían.
- ¿Qué ocurre cuando una sección actualiza sus datos automáticamente sin que el usuario haya cambiado de sección (por ejemplo, el auto-refresh del Pipeline)? La posición de scroll del usuario MUST conservarse en ese caso — el reinicio solo aplica cuando el usuario efectivamente cambia de sección o recarga la página, no en cada actualización de datos en segundo plano.
- ¿Qué ocurre si el usuario abre un panel lateral (por ejemplo, "Nueva cotización") sobre la sección actual? No debe verse afectado el scroll de la sección de fondo, ya que no es un cambio de sección.
- ¿Qué ocurre si el usuario navega hacia atrás/adelante con los botones del navegador? Debe mostrarse la parte superior de la sección de destino, igual que con un clic normal en el menú.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al navegar desde el menú principal (o cualquier enlace interno) hacia otra sección de la aplicación, el sistema MUST mostrar esa sección desde su parte superior, con el menú superior y el título visibles, sin requerir que el usuario haga scroll manual.
- **FR-002**: Al recargar completamente el navegador en cualquier sección, el sistema MUST mostrar esa sección desde su parte superior.
- **FR-003**: El comportamiento de FR-001 y FR-002 MUST ser consistente en todas las secciones de la aplicación, no solo en el caso reportado (Dashboard → Pipeline).
- **FR-004**: El sistema MUST preservar la posición de scroll del usuario cuando una sección actualiza sus datos en segundo plano sin que el usuario haya cambiado de sección (por ejemplo, el auto-refresh del Pipeline) — el reinicio de scroll de FR-001 solo aplica ante un cambio real de sección o una recarga completa.
- **FR-005**: El sistema MUST NOT alterar el desplazamiento interno propio de paneles o tableros con su propio scroll independiente (por ejemplo, el desplazamiento horizontal entre etapas del Pipeline) al aplicar el reinicio de FR-001/FR-002.
- **FR-006**: La corrección MUST ser puramente de comportamiento de scroll/visualización: no debe alterar URLs, parámetros de filtro, datos cargados ni ningún otro comportamiento funcional de las secciones afectadas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al navegar entre dos secciones cualesquiera del menú principal, el usuario ve el menú superior y el título de la sección de destino en el 100% de los casos, sin necesidad de hacer scroll manual.
- **SC-002**: Al recargar el navegador en cualquier sección, el usuario ve el menú superior y el título de esa sección en el 100% de los casos.
- **SC-003**: El usuario no necesita ninguna interacción adicional (scroll manual, clics extra) para ver el menú superior y el título tras navegar o recargar.
- **SC-004**: Las secciones que se actualizan automáticamente en segundo plano (por ejemplo, el auto-refresh del Pipeline) no pierden la posición de scroll que el usuario tenía antes de la actualización.

## Assumptions

- El síntoma reportado ("se corta la pantalla", "no veo los menús superiores") se interpreta como que el área de contenido principal conserva su posición de desplazamiento previa al cambiar de sección o al recargar, en lugar de reiniciarse a la parte superior — no como un problema de recorte visual permanente ni de elementos ocultos por CSS.
- El alcance de esta corrección es el reinicio del desplazamiento del contenedor principal de cada sección; los paneles o tableros con su propio scroll independiente (como el Pipeline) conservan su comportamiento de scroll interno actual.
- Las actualizaciones automáticas de datos que no representan un cambio de sección (como el auto-refresh del Pipeline, que hoy preserva intencionalmente la posición de scroll) deben seguir preservándola — esta corrección no debe alterar ese comportamiento ya existente.
- La navegación con los botones "atrás"/"adelante" del navegador se trata igual que una navegación normal hacia adelante, salvo que la investigación técnica durante la planificación determine que el navegador ya restaura una posición previa de forma nativa y deba respetarse esa restauración.
- No se requiere ningún cambio de contenido, datos ni estructura de las páginas — el alcance es exclusivamente el comportamiento de scroll al cambiar de sección o recargar.
