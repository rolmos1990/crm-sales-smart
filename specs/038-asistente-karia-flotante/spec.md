# Feature Specification: Asistente Karia flotante (mascota animada)

**Feature Branch**: `feature/038-asistente-karia-flotante`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Asistente Karia flotante: botón flotante abajo a la derecha en todas las secciones autenticadas con la mascota de Karia (robot "K") sin fondo, siempre en movimiento, con 4 estados animados: Normal, Pestañeando, Pensando y Exitoso. La fuente es una cuadrícula 4×4 de ilustraciones con fondo blanco hueso. Al hacer clic abre un aviso de 'Próximamente' (el chat real es otra feature). Otras pantallas pueden cambiar su estado. Respeta la preferencia de movimiento reducido, se ve bien en modo claro y oscuro, no aparece en login ni páginas públicas y no tapa el compositor de conversaciones."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver a Karia presente y viva en la app (Priority: P1)

Un usuario autenticado navega por cualquier sección de Karia (CRM, Ventas, Productos, Configuración, etc.) y ve, en la esquina inferior derecha, a la mascota de Karia flotando suavemente, sin fondo propio, con un leve movimiento de cabeza y pestañeos espontáneos cada pocos segundos. La mascota da identidad a la marca y anticipa el futuro asistente.

**Why this priority**: Es el núcleo de la feature: sin la mascota visible y animada no hay nada más que construir. Por sí sola ya entrega valor de marca.

**Independent Test**: Iniciar sesión, entrar a `/crm` y observar durante 15 s: la mascota está visible, flota, mueve la cabeza y pestañea al menos una vez; su silueta se recorta limpia sobre el contenido (sin rectángulo ni círculo de fondo).

**Acceptance Scenarios**:

1. **Given** un usuario autenticado en cualquier sección, **When** la página termina de cargar, **Then** la mascota aparece abajo a la derecha, flotando y en estado Normal.
2. **Given** la mascota en estado Normal, **When** pasan entre 3 y 6 segundos, **Then** pestañea una vez y vuelve a Normal, y el ciclo se repite con intervalos variables.
3. **Given** el tema oscuro o el claro, **When** se observa la mascota sobre cualquier fondo de la app, **Then** se ve sin fondo propio, sin halo blanquecino en el contorno y distinguible del contenido detrás.
4. **Given** un visitante no autenticado en `/login` o en páginas públicas (políticas, términos), **When** carga la página, **Then** la mascota no aparece.

---

### User Story 2 - Hacer clic en Karia (Priority: P2)

El usuario hace clic (o la activa con teclado) sobre la mascota. Karia reacciona con alegría y muestra un globo con un saludo que avisa que pronto podrá ayudarle. El globo se cierra al hacer clic fuera o con Escape.

**Why this priority**: Da sentido a que sea un botón y evita la frustración de un elemento clicable que no hace nada; no bloquea la P1.

**Independent Test**: Hacer clic sobre la mascota y verificar el globo "Hola, soy Karia. Muy pronto podré ayudarte aquí."; cerrarlo con Escape; repetir solo con teclado (Tab + Enter).

**Acceptance Scenarios**:

1. **Given** la mascota visible, **When** el usuario hace clic, **Then** aparece el globo de saludo y la mascota muestra brevemente el estado Exitoso.
2. **Given** el globo abierto, **When** el usuario pulsa Escape o hace clic fuera, **Then** el globo se cierra y el foco vuelve a la mascota.
3. **Given** un usuario de teclado, **When** llega a la mascota con Tab, **Then** ve un indicador de foco y puede abrirla con Enter o Espacio; un lector de pantalla la anuncia como "Asistente Karia".

---

### User Story 3 - Karia refleja lo que está pasando (Priority: P3)

Otras pantallas de la app pueden pedirle a la mascota que pase a **Pensando** (ojos cerrados, balanceo y globo con tres puntos, mientras se procesa algo) o a **Exitoso** (ojos felices y un rebote al completarse algo), y luego volver a Normal.

**Why this priority**: Prepara la conexión con el futuro chat/IA; hoy no hay pantallas que la usen, así que su valor es habilitador.

**Independent Test**: Desde un control temporal de desarrollo, pedir Pensando → verificar balanceo + tres puntos sostenidos; pedir Exitoso → verificar rebote con ojos felices y regreso automático a Normal en menos de 2 s.

**Acceptance Scenarios**:

1. **Given** la mascota en Normal, **When** una pantalla solicita Pensando, **Then** la mascota muestra ojos cerrados, balanceo y tres puntos, y se mantiene así hasta que se solicite otro estado.
2. **Given** cualquier estado, **When** una pantalla solicita Exitoso, **Then** la mascota muestra ojos felices con un rebote y vuelve sola a Normal en menos de 2 s.
3. **Given** la mascota en Pensando, **When** una pantalla solicita volver a reposo, **Then** vuelve a Normal y retoma los pestañeos espontáneos.
4. **Given** la mascota en Pensando, **When** llega el momento de un pestañeo espontáneo, **Then** no pestañea (los pestañeos solo ocurren en Normal).

---

### User Story 4 - Reutilizar a Karia en otras pantallas (Priority: P3)

El equipo de producto quiere poner a Karia en otros lugares (estado vacío de una lista, encabezado de un futuro chat, pantalla de bienvenida) a distintos tamaños y con distintas actitudes, sin que sea necesariamente el botón flotante. La misma mascota se puede colocar en cualquier pantalla autenticada indicando qué está haciendo (en reposo, pensando, con éxito), con qué emoción (neutral, feliz, tranquila) y si pestañea o no.

**Why this priority**: Es la base para las acciones que se agregarán después; el botón flotante es solo el primer uso.

**Independent Test**: Colocar la mascota en una página de prueba de desarrollo en tres tamaños y combinaciones distintas (reposo/feliz/pestañeando, pensando, éxito sin pestañeo) y verificar que cada instancia se comporta según lo indicado, independiente de las otras y del botón flotante.

**Acceptance Scenarios**:

1. **Given** dos instancias de la mascota en la misma pantalla, **When** una se configura en Pensando y la otra en reposo, **Then** cada una muestra su propio estado sin afectar a la otra ni al botón flotante.
2. **Given** una instancia con pestañeo desactivado, **When** pasan 30 s, **Then** no pestañea nunca.
3. **Given** una instancia con emoción feliz en reposo, **When** se observa, **Then** muestra ojos felices y sigue flotando.

---

### Edge Cases

- **Movimiento reducido**: si el sistema operativo pide reducir movimiento, la mascota no flota, no rebota ni se balancea; cada estado se representa con una imagen fija apropiada (ojos abiertos, ojos cerrados con tres puntos estáticos, ojos felices).
- **Compositor de conversaciones**: en la bandeja de conversaciones la mascota no debe tapar el campo para escribir ni el botón de enviar.
- **Pantallas angostas (móvil)**: la mascota se reduce de tamaño y no tapa acciones fijas inferiores ni causa scroll horizontal.
- **Imagen que no carga**: si el recurso de la mascota falla, no aparece un ícono roto; el botón queda invisible o con un fallback discreto y la página sigue funcionando.
- **Pestaña en segundo plano**: al volver a la pestaña, la mascota retoma su ciclo sin acumular pestañeos atrasados.
- **Solicitudes de estado repetidas o simultáneas**: gana la última; Exitoso repetido reinicia su rebote sin quedar trabado.
- **Impresión**: la mascota no aparece al imprimir una página (ej. cotización o pedido).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar la mascota de Karia como un botón fijo en la esquina inferior derecha de todas las secciones autenticadas.
- **FR-002**: El sistema MUST NOT mostrar la mascota en `/login`, registro ni páginas públicas.
- **FR-003**: La mascota MUST mostrarse sin fondo propio (silueta recortada con transparencia), sin halo visible en tema claro ni oscuro.
- **FR-004**: La mascota MUST estar siempre en movimiento mientras no se pida movimiento reducido: flotación suave continua en todos los estados.
- **FR-005**: La mascota MUST soportar cuatro estados: **Normal** (bucle lento de giro de cabeza), **Pestañeando** (un pestañeo y regreso a Normal), **Pensando** (ojos cerrados, balanceo, tres puntos; sostenido) y **Exitoso** (ojos felices y rebote; regreso automático a Normal en menos de 2 s).
- **FR-006**: En estado Normal, la mascota MUST pestañear espontáneamente a intervalos aleatorios de 3 a 6 segundos.
- **FR-007**: Otras pantallas de la app MUST poder solicitar los estados Pensando, Exitoso y Normal; la última solicitud prevalece.
- **FR-008**: Al activar la mascota (clic, Enter o Espacio), el sistema MUST mostrar un globo con el texto "Hola, soy Karia. Muy pronto podré ayudarte aquí." y la mascota MUST mostrar brevemente el estado Exitoso.
- **FR-009**: La mascota MUST ser accesible: nombre accesible "Asistente Karia", foco visible con teclado, globo cerrable con Escape y retorno del foco al botón.
- **FR-010**: Con la preferencia de movimiento reducido activa, el sistema MUST eliminar flotación, rebote, balanceo y secuencias de frames, mostrando una imagen fija por estado.
- **FR-011**: La mascota MUST NOT tapar el compositor de mensajes de la bandeja de conversaciones ni acciones fijas inferiores en pantallas angostas.
- **FR-012**: La mascota MUST NOT retrasar la carga inicial de las páginas: se carga después del contenido principal y su recurso gráfico pesa menos de 150 KB.
- **FR-013**: La mascota MUST NOT aparecer en la impresión de páginas.
- **FR-015**: La mascota MUST existir como una pieza visual reutilizable, independiente del botón flotante, configurable en: qué hace (reposo, pensando, éxito), emoción (neutral, feliz, tranquila), si pestañea o no, tamaño y si flota o no. El botón flotante MUST ser solo un uso de esa pieza.
- **FR-016**: Cada instancia de la mascota MUST controlar su propia animación; varias instancias en la misma pantalla no se sincronizan ni se afectan entre sí.
- **FR-017**: La mascota y el botón flotante MUST mostrarse únicamente a usuarios con sesión iniciada.
- **FR-014**: El recurso gráfico de la mascota MUST poder regenerarse de forma reproducible a partir de la ilustración original versionada en el repositorio.

### Key Entities

- **Estado de la mascota**: uno de Normal, Pestañeando, Pensando, Exitoso. Vive solo en el navegador del usuario durante la sesión; no se persiste ni se comparte entre usuarios o pestañas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100 % de las secciones autenticadas la mascota es visible, y en el 0 % de las páginas públicas aparece.
- **SC-002**: Al observarla 30 s en estado Normal, la mascota pestañea entre 5 y 10 veces y nunca está inmóvil.
- **SC-003**: El estado Exitoso vuelve a Normal en menos de 2 s en el 100 % de los casos.
- **SC-004**: La carga de las páginas autenticadas no empeora de forma perceptible (diferencia menor a 100 ms en el tiempo hasta que el contenido principal es visible).
- **SC-005**: Revisada sobre fondos claros y oscuros de la app, no se observa recuadro ni halo blanquecino alrededor de la mascota.
- **SC-006**: Un usuario solo con teclado puede abrir y cerrar el saludo de Karia en menos de 3 pulsaciones.

## Assumptions

- El chat o asistente conversacional real queda **fuera de alcance**; esta feature solo entrega la mascota, sus estados y el saludo "Próximamente".
- No hay pantallas que soliciten Pensando/Exitoso en esta entrega más allá del clic sobre la mascota; la capacidad queda disponible para features futuras (ej. respuestas de IA).
- La ilustración fuente es la cuadrícula 4×4 entregada por el usuario; no hay frames dedicados a "Pensando", por lo que ese estado se compone con los frames de ojos cerrados más efectos (balanceo y tres puntos).
- Se descartó el formato GIF: no admite transparencia suave (dejaría halos), limita los colores (bandas en el brillo verde) e impide cambiar de estado o respetar el movimiento reducido.
- Si el recorte automático del fondo deja imperfecciones visibles, se solicitará al autor de la ilustración una versión exportada con fondo transparente.
- La mascota no se puede ocultar ni configurar por usuario en esta entrega.
- No hay cambios de datos, eventos de dominio ni integraciones externas.
