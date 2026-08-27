# Feature Specification: Corrección de colores en modo oscuro — Edición de pedido y regla de flujo de venta

**Feature Branch**: `[002-fix-pedido-flujo-dark-mode]`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Ajustar los mismos colores hardcodeados de paleta fija (stone-*, black/white literal) en modo oscuro que ya se corrigieron en el módulo de cotizaciones, pero ahora en dialog-editar-pedido.tsx (módulo Pedidos) y sheet-regla-validacion.tsx (módulo Flujo de venta), aplicando el mismo mapeo a los tokens semánticos del sistema (bg-modal, border-border, text-foreground, text-muted-foreground, bg-muted, text-destructive) para que estas dos pantallas queden consistentes con el resto del CRM en modo oscuro, sin romper el modo claro ni cambiar comportamiento funcional."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el panel de edición de pedido consistente en modo oscuro (Priority: P1)

Como usuario del CRM que trabaja con el tema oscuro activado, al editar un pedido desde el módulo de Ventas, quiero que el panel lateral se vea con la misma paleta que el resto de la aplicación (superficies, bordes y textos con los tonos oscuros estándar del sistema), en lugar de fondo negro plano y tonos de gris que no coinciden con el resto del CRM.

**Why this priority**: Es el primero de los dos hallazgos documentados como pendientes tras corregir cotizaciones (`001-fix-cotizacion-dark-mode`), y el panel de edición de pedido es una pantalla de uso frecuente en el flujo de ventas.

**Independent Test**: Con el tema oscuro activo, abrir un pedido existente y usar su acción "Editar pedido"; comparar visualmente el panel resultante (fondo, bordes, textos, sección de datos de facturación, tabla de líneas, totales) contra una pantalla ya conforme del CRM (p. ej. el panel "Nueva cotización" ya corregido). Debe percibirse como parte del mismo sistema visual, sin superficies negras aisladas ni tonos de gris ajenos al sistema.

**Acceptance Scenarios**:

1. **Given** el usuario tiene el tema oscuro activo, **When** abre el panel "Editar pedido" desde un pedido existente, **Then** el fondo, los bordes y los textos del panel usan los mismos tokens que el resto de paneles/sheets del CRM, sin fondos negros puros ni grises fuera de la paleta del sistema.
2. **Given** el panel "Editar pedido" está abierto en modo oscuro, **When** el usuario recorre sus secciones (datos generales, datos de facturación colapsables, tabla de líneas, totales, notas), **Then** todas las secciones mantienen la misma paleta de superficies y textos entre sí.
3. **Given** el panel "Editar pedido" está abierto en modo oscuro, **When** el usuario observa el botón principal "Guardar cambios" y el spinner de guardado, **Then** el color de énfasis se limita a esos elementos con significado (acción principal, estado de carga) y no se usa como color de superficie o texto genérico.

---

### User Story 2 - Ver el panel de regla de validación de flujo de venta consistente en modo oscuro (Priority: P1)

Como usuario del CRM que trabaja con el tema oscuro activado, al crear o editar una regla de validación de una etapa del flujo de venta, quiero que el panel se vea con la misma paleta que el resto de la aplicación, en lugar de fondo negro plano y tonos de gris que no coinciden con el resto del CRM.

**Why this priority**: Es el segundo hallazgo documentado tras cotizaciones, con la misma causa raíz y el mismo mapeo de tokens ya validado; se aborda con la misma prioridad que User Story 1 porque ambas pantallas comparten exactamente el mismo patrón roto y no dependen entre sí.

**Independent Test**: Con el tema oscuro activo, abrir la configuración de una etapa del flujo de venta y crear o editar una regla de validación; comparar visualmente el panel resultante (header, tarjeta informativa, campos de nombre/prioridad/descripción, condiciones, columna de resumen y prueba) contra una pantalla ya conforme del CRM. Debe percibirse como parte del mismo sistema visual.

**Acceptance Scenarios**:

1. **Given** el usuario tiene el tema oscuro activo, **When** abre el panel de "Nueva regla" o "Editar regla" de una etapa del flujo de venta, **Then** el fondo, los bordes y los textos del panel usan los mismos tokens que el resto de paneles/sheets del CRM.
2. **Given** el panel de regla está abierto en modo oscuro, **When** el usuario recorre sus secciones (datos de la regla, condiciones, columna de resumen, columna de prueba con un pedido), **Then** todas las secciones mantienen la misma paleta de superficies y textos entre sí.
3. **Given** el usuario ejecuta una prueba de la regla contra un pedido, **When** observa el resultado ("Cumple la regla" / "No cumple la regla"), **Then** el indicador de éxito/fallo sigue comunicando su significado (verde para cumple, rojo para no cumple) de forma clara en ambos temas.

---

### User Story 3 - Verificar que la corrección no rompe el modo claro (Priority: P2)

Como usuario que también trabaja en modo claro, quiero que el ajuste de colores de ambos paneles no altere ni degrade su apariencia actual en modo claro.

**Why this priority**: El ajuste toca clases de color compartidas entre ambos temas; igual que en `001-fix-cotizacion-dark-mode`, existe riesgo de que una corrección de modo oscuro introduzca una regresión visible en modo claro.

**Independent Test**: Con el tema claro activo, repetir los flujos de edición de pedido y de regla de validación antes y después del ajuste, y confirmar que el aspecto visual se mantiene equivalente al actual.

**Acceptance Scenarios**:

1. **Given** el usuario tiene el tema claro activo, **When** abre y usa el panel "Editar pedido" y el panel de regla de validación, **Then** la apariencia visual (colores de fondo, bordes y textos) es equivalente a la que tenían antes del ajuste.

### Edge Cases

- ¿Qué ocurre con la sección colapsable "Datos de facturación" del pedido (abierta/cerrada, hover del botón que la despliega)? Debe usar los mismos tokens de superficie/borde/texto que el resto del panel, sin importar su estado.
- ¿Qué ocurre con el estado de carga (spinner "Guardando..." / "Guardar borrador" / "Guardar regla") en ambos paneles? Debe usar los mismos tokens de color de énfasis ya aceptados como excepción (D7 en `001-fix-cotizacion-dark-mode`), no colores sueltos.
- ¿Qué ocurre con el resultado de la prueba de regla contra un pedido (indicador "Cumple" / "No cumple" y el detalle por condición)? Es un caso fuera del alcance principal de esta feature (ver Assumptions) — se documenta pero no se corrige aquí.
- ¿Qué ocurre con el separador visual (`Separator`) entre subtotal y total en el panel de pedido? Debe usar el mismo token de borde que el resto del panel, no un gris de paleta fija.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El panel "Editar pedido" (`dialog-editar-pedido.tsx`) MUST usar la misma familia de tokens semánticos ya establecida en `001-fix-cotizacion-dark-mode` (`bg-modal`/`bg-card` para superficies de sheet, `text-foreground` para texto principal, `text-muted-foreground` para texto secundario/deshabilitado, `border-border` para bordes, `bg-muted` para superficies recesadas) en lugar de valores de paleta fija, de modo que su apariencia en modo oscuro sea consistente con el resto de la aplicación.
- **FR-002**: El panel de regla de validación (`sheet-regla-validacion.tsx`) MUST usar la misma familia de tokens semánticos que FR-001, incluyendo su header sticky, tarjeta informativa, campos de formulario, columna de resumen y columna de prueba.
- **FR-003**: Todas las secciones de ambos paneles MUST mantener la misma paleta de superficies y textos entre sí (misma familia de tokens de FR-001/FR-002), sin variaciones de tono no justificadas.
- **FR-004**: El sistema MUST limitar el uso de color de énfasis (acento lima en botones principales y spinners) a elementos que comunican significado, sin tocarlo — misma excepción ya aceptada como D7 en `001-fix-cotizacion-dark-mode`.
- **FR-005**: El ajuste MUST ser puramente visual: el guardado del pedido, el guardado/publicación de la regla, la evaluación de prueba contra un pedido y el resto del comportamiento funcional MUST permanecer sin cambios.
- **FR-006**: La apariencia de ambos paneles en modo claro MUST mantenerse equivalente a la actual tras el ajuste (sin regresiones visibles).
- **FR-007**: El sistema MUST NOT introducir nuevos valores de color fijos (hex/rgb) ni nuevas clases de paleta fija. Cualquier clase tipo `stone-*`, `zinc-*`, `gray-*`, o `black`/`white` literal encontrada en estos dos archivos queda explícitamente deprecada y MUST reemplazarse por el token semántico equivalente.
- **FR-008**: El indicador de resultado de la prueba de regla ("Cumple" / "No cumple", en `sheet-regla-validacion.tsx`) queda **fuera de alcance** de esta feature — usa colores de paleta fija (`emerald-*`, `red-*`) distintos de los cubiertos por FR-007, y su corrección se documenta como hallazgo relacionado para una futura iteración (ver Assumptions).

### Key Entities

- **Pedido**: entidad comercial existente (`prisma.pedido`); esta especificación no modifica sus datos ni su ciclo de vida, solo la presentación visual del panel donde se edita.
- **Regla de validación (flujo de venta)**: entidad existente que define condiciones para permitir una transición de etapa; esta especificación no modifica su lógica de evaluación, solo la presentación visual del panel donde se crea/edita.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al abrir "Editar pedido" en modo oscuro, un usuario no percibe superficies negras aisladas ni tonos de gris ajenos al resto de la aplicación en ninguna de las secciones del panel.
- **SC-002**: Al abrir el panel de "Nueva regla" o "Editar regla" del flujo de venta en modo oscuro, un usuario no percibe superficies negras aisladas ni tonos de gris ajenos al resto de la aplicación en ninguna de las secciones del panel.
- **SC-003**: Los tres paneles corregidos hasta ahora (Nueva cotización, Editar pedido, Regla de validación) muestran una paleta visualmente equivalente entre sí en modo oscuro.
- **SC-004**: La apariencia en modo claro de ambos paneles no presenta cambios perceptibles antes/después del ajuste.

## Assumptions

- Esta feature es continuación directa de `001-fix-cotizacion-dark-mode`: reutiliza el mismo mapeo de tokens ya investigado y validado ahí (`research.md` decisiones D1–D7, `data-model.md` tabla de mapeo), sin volver a justificarlo desde cero.
- El acento lima (`lime-*`) en botones principales y spinners de ambos paneles se conserva sin cambios, con el mismo criterio que D7 de la feature anterior (patrón consistente en toda la app, no una desviación propia de estos módulos).
- El indicador de resultado de prueba de regla (`emerald-*`/`red-*` en `sheet-regla-validacion.tsx`) usa una paleta fija distinta (colores de estado, no de superficie/texto genérico) y queda fuera de alcance — se documenta como hallazgo para una futura feature, igual que se documentó el hallazgo de estos dos archivos al cerrar `001-fix-cotizacion-dark-mode`.
- No se requiere cambio de contenido, textos ni estructura de campos de ningún formulario — el alcance es exclusivamente de color/tema visual.
- No se requiere una migración de datos ni cambios en la lógica de servidor (acciones, queries) asociada a pedidos o reglas de flujo de venta.
