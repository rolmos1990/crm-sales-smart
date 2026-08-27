# Feature Specification: Corrección de colores en modo oscuro — Nueva cotización

**Feature Branch**: `[001-fix-cotizacion-dark-mode]`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "necesito validar que cuando creo una cotizacion desde el pipeline se ve aun color negro (dark mode) y si bien no cumple con las polticas de colores que cumple el resto del app, necesito validar y ajustar esto."

## Clarifications

### Session 2026-08-27

- Q: ¿El estándar a aplicar en cotizaciones es la familia completa de tokens semánticos (bg-card, text-foreground, text-muted-foreground, border-border) deprecando toda paleta fija (stone-*, zinc-*, gray-*, black/white literal), o solo los dos tokens mencionados (bg-card, text-foreground) puntualmente? → A: Familia completa — bg-card, text-foreground, text-muted-foreground y border-border (más sus equivalentes ya usados en el resto del CRM) son el estándar único; cualquier valor de paleta fija tipo stone-*/zinc-*/gray-*/black/white literal (p. ej. `text-stone-400`, `bg-stone-950`, `border-stone-200`) queda explícitamente deprecado en todo el módulo de cotizaciones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el panel de "Nueva cotización" consistente en modo oscuro (Priority: P1)

Como usuario del CRM que trabaja con el tema oscuro activado, al crear una cotización desde una oportunidad en el pipeline, quiero que el panel lateral y el formulario se vean con la misma paleta que el resto de la aplicación (superficies, bordes y textos con los tonos oscuros estándar del sistema), en lugar de un negro plano y tonos que no coinciden con el resto del CRM.

**Why this priority**: Es el problema reportado directamente por el usuario y el punto de entrada más usado para crear cotizaciones (desde el pipeline). Una superficie que "se ve negra" y desentona rompe la percepción de calidad del producto en el flujo de venta más frecuente.

**Independent Test**: Con el tema oscuro activo, abrir una oportunidad en el pipeline, hacer clic en "Nueva cotización" y comparar visualmente el panel resultante (fondo, bordes, textos, tabla de productos, totales) contra otra pantalla ya conforme (p. ej. el panel de la oportunidad o el listado de contactos). Debe percibirse como parte del mismo sistema visual, sin superficies negras aisladas ni tonos de gris que no aparecen en el resto del CRM.

**Acceptance Scenarios**:

1. **Given** el usuario tiene el tema oscuro activo, **When** abre el panel "Nueva cotización" desde una oportunidad del pipeline, **Then** el fondo, los bordes y los textos del panel usan los mismos tonos oscuros (tokens) que el resto de paneles/sheets del CRM, sin fondos negros puros ni grises fuera de la paleta del sistema.
2. **Given** el panel "Nueva cotización" está abierto en modo oscuro, **When** el usuario recorre sus secciones (datos del cliente, tabla de productos y precios, entrega/servicio, adjuntos, totales), **Then** todas las secciones mantienen la misma paleta de superficies y textos, sin secciones que se vean más oscuras o con contraste distinto entre sí.
3. **Given** el panel "Nueva cotización" está abierto en modo oscuro, **When** el usuario observa los elementos de énfasis (botón principal de guardar, spinner de carga), **Then** el color de énfasis se limita a esos elementos con significado (acción principal, estado) y no se usa como color de superficie o texto genérico.

---

### User Story 2 - Verificar que la corrección no rompe el modo claro (Priority: P2)

Como usuario que también trabaja en modo claro, quiero que el ajuste de colores del panel "Nueva cotización" no altere ni degrade su apariencia actual en modo claro.

**Why this priority**: El ajuste toca clases de color compartidas entre ambos temas; un cambio mal dirigido podría corregir el modo oscuro pero introducir una regresión visible en modo claro, que es el tema por defecto para parte de los usuarios.

**Independent Test**: Con el tema claro activo, repetir el mismo recorrido del panel "Nueva cotización" (desde el pipeline) antes y después del ajuste, y confirmar que el aspecto visual (fondos, bordes, textos, tabla, totales) se mantiene equivalente al actual.

**Acceptance Scenarios**:

1. **Given** el usuario tiene el tema claro activo, **When** abre y usa el panel "Nueva cotización" desde el pipeline, **Then** la apariencia visual (colores de fondo, bordes y textos) es equivalente a la que tenía antes del ajuste.

---

### User Story 3 - Consistencia en las demás pantallas que comparten el mismo formulario de cotización (Priority: P3)

Como usuario, quiero que la misma corrección de colores aplique a cualquier otro lugar donde aparezca el mismo formulario de cotización (edición de una cotización existente, creación desde la página completa de cotizaciones), ya que comparten el mismo componente visual y hoy presentan el mismo problema.

**Why this priority**: El problema reportado ocurre en un componente reutilizado por varias pantallas (creación desde pipeline, edición, creación desde la sección de Ventas). Corregirlo solo en el punto de entrada del pipeline dejaría el resto de pantallas inconsistentes, contradiciendo el objetivo de cumplir la política de colores en toda la app.

**Independent Test**: Repetir la verificación de la User Story 1 abriendo (a) el panel de edición de una cotización existente y (b) la página completa "Nueva cotización" desde el módulo de Ventas, confirmando que ambas también quedan alineadas con la paleta del sistema en modo oscuro.

**Acceptance Scenarios**:

1. **Given** el usuario tiene el tema oscuro activo, **When** edita una cotización existente desde su panel de edición, **Then** el panel usa la misma paleta de tokens que el resto del CRM.
2. **Given** el usuario tiene el tema oscuro activo, **When** crea una cotización desde la página completa del módulo de Ventas, **Then** el formulario usa la misma paleta de tokens que el resto del CRM.

### Edge Cases

- ¿Qué ocurre con el estado de carga (spinner "Cargando formulario…") y el estado de error del panel? Deben usar los mismos tokens de superficie/texto/estado (éxito, error) que el resto del CRM, no colores sueltos.
- ¿Qué ocurre cuando la tabla de productos tiene muchas filas y el usuario hace scroll dentro del panel? El encabezado fijo (sticky) y el resto de la tabla deben conservar el mismo tono de superficie sin saltos de contraste.
- ¿Qué ocurre con los estados "vacío" o "deshabilitado" (por ejemplo, el botón "Nueva cotización" deshabilitado cuando la oportunidad no tiene contacto)? Deben seguir siendo distinguibles usando los tokens de estado deshabilitado del sistema, no un gris arbitrario.
- ¿El color de énfasis (usado hoy en el botón principal y el spinner) se conserva como color con significado (acción primaria) o debe normalizarse también a un token semántico del sistema? Ver Assumptions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El panel "Nueva cotización" (y su variante de edición) MUST usar la familia estándar de tokens semánticos de color ya vigente en el resto del CRM (equivalentes a `bg-card` para superficies, `text-foreground` para texto principal, `text-muted-foreground` para texto secundario/deshabilitado y `border-border` para bordes) en lugar de valores de paleta fijos, de modo que su apariencia en modo oscuro sea consistente con el resto de la aplicación.
- **FR-002**: Todas las secciones del formulario de cotización (datos del cliente, tabla de productos y precios, totales, entrega/servicio, adjuntos) MUST mantener la misma paleta de superficies y textos entre sí (misma familia de tokens de FR-001), sin variaciones de tono no justificadas.
- **FR-003**: El sistema MUST limitar el uso de color de énfasis (acento) a elementos que comunican significado (acción principal, estado de carga/éxito/error), y no usarlo como color de superficie o texto genérico.
- **FR-004**: El ajuste MUST aplicarse por igual a los tres puntos de entrada que comparten el mismo formulario de cotización: creación desde el pipeline (panel lateral), edición de una cotización existente (panel lateral) y creación desde la página completa del módulo de Ventas.
- **FR-005**: El ajuste MUST ser puramente visual: la validación, el guardado, los mensajes de error funcionales y el resto del comportamiento del formulario de cotización MUST permanecer sin cambios.
- **FR-006**: La apariencia del panel/formulario en modo claro MUST mantenerse equivalente a la actual tras el ajuste (sin regresiones visibles).
- **FR-007**: El sistema MUST NOT introducir nuevos valores de color fijos (hex/rgb) ni nuevas dependencias de paleta fuera de los tokens semánticos ya definidos para la aplicación. Cualquier clase de paleta fija tipo `stone-*`, `zinc-*`, `gray-*`, o `black`/`white` literal encontrada en el módulo de cotizaciones queda explícitamente deprecada y MUST reemplazarse por el token semántico equivalente (FR-001).

### Key Entities

- **Cotización**: Documento comercial que se crea desde una oportunidad del pipeline o desde el módulo de Ventas; esta especificación no modifica sus datos ni su ciclo de vida, solo la presentación visual de los paneles donde se crea/edita.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al abrir "Nueva cotización" en modo oscuro, un usuario no percibe superficies negras aisladas ni tonos de gris ajenos al resto de la aplicación en ninguna de las secciones del panel.
- **SC-002**: El 100% de los tres puntos de entrada que comparten el formulario de cotización (pipeline, edición, página de Ventas) muestran una paleta visualmente equivalente entre sí en modo oscuro.
- **SC-003**: La apariencia en modo claro de los mismos paneles no presenta cambios perceptibles antes/después del ajuste.
- **SC-004**: Una revisión visual del panel confirma que el color de énfasis aparece únicamente en el botón de acción principal y en indicadores de estado (carga/error), y en ningún otro elemento de superficie o texto genérico.

## Assumptions

- El reporte del usuario ("se ve aún color negro") se interpreta como una inconsistencia de tokens de color en modo oscuro (fondos y bordes con valores de paleta fijos en vez de los tokens semánticos definidos en `globals.css`), no como un defecto funcional del formulario.
- La familia de tokens `bg-card` / `text-foreground` / `text-muted-foreground` / `border-border` (ya usada en el resto del CRM) es el estándar canónico para el módulo de cotizaciones; cualquier clase de paleta fija tipo `stone-*`, `zinc-*`, `gray-*` o `black`/`white` literal (p. ej. `text-stone-400`, `bg-stone-950`, `border-stone-200`) queda explícitamente deprecada, sin importar si aparecía antes en el propio módulo de cotizaciones.
- El componente de formulario de cotización es compartido por los tres puntos de entrada mencionados (pipeline, edición, página de Ventas); por eso el alcance de esta especificación cubre los tres, aunque el reporte original mencione solo el flujo desde el pipeline.
- El color de énfasis (acento) usado hoy en el botón principal y el spinner de carga se considera un uso legítimo de "color con significado" (acción primaria / estado) según la política de colores del proyecto, y se conserva; lo que se corrige es su uso como color de superficie/texto genérico en el resto del panel.
- No se requiere cambio de contenido, textos ni estructura de campos del formulario — el alcance es exclusivamente de color/tema visual.
- No se requiere una migración de datos ni cambios en la lógica de servidor (acciones, queries) asociada a cotizaciones.
