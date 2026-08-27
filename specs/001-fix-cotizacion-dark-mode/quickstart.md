# Quickstart: Validar la corrección de colores — Nueva cotización

**Feature**: `001-fix-cotizacion-dark-mode` | **Date**: 2026-08-27

Guía de validación manual end-to-end. No requiere nuevas herramientas: es una comprobación visual en los tres puntos de entrada del módulo de cotizaciones, en ambos temas.

## Prerrequisitos

- Servidor de desarrollo corriendo: `npm run dev`
- Sesión con acceso al módulo de Ventas/CRM (permiso `cotizaciones:modificar`) y al menos:
  - Una oportunidad en el pipeline con un contacto asociado
  - Una cotización existente para probar el flujo de edición
- Un toggle de tema (claro/oscuro) accesible en la UI, o forzar `class="dark"` en `<html>` desde devtools si el proyecto no expone un switch visible

## Escenarios a validar

### 1. Crear cotización desde el pipeline (US1 — P1)

1. Abrir el pipeline (`/crm/pipeline`) con el tema oscuro activo.
2. Abrir una oportunidad que tenga contacto asociado.
3. Clic en **"Nueva cotización"**.
4. **Verificar**: el panel lateral no muestra fondo negro puro ni bordes/texto en tonos grises que no aparecen en el resto del CRM; el fondo, los bordes y el texto se perciben como parte del mismo sistema visual que, por ejemplo, el panel de detalle de la oportunidad.
5. Recorrer todas las secciones del formulario (cliente, tabla de productos, totales, entrega/servicio, adjuntos) — **verificar** que todas comparten la misma paleta, sin secciones más oscuras que otras.
6. **Verificar** que el botón principal de guardar y el spinner de carga siguen mostrando el acento (verde lima) — eso es intencional, no un defecto (D7 en `research.md`).

### 2. Editar una cotización existente (US3)

1. Con el tema oscuro activo, abrir una cotización existente y usar su acción de editar.
2. Repetir la verificación del paso 4–6 anterior sobre el panel de edición.

### 3. Crear cotización desde la página completa de Ventas (US3)

1. Con el tema oscuro activo, navegar a `/sales/cotizaciones/nueva`.
2. Repetir la verificación del paso 4–6 anterior sobre la página completa.

### 4. Regresión en modo claro (US2 — P2)

1. Cambiar a tema claro.
2. Repetir los tres flujos anteriores (pipeline, edición, página de Ventas).
3. **Verificar**: la apariencia es equivalente a la que tenían antes del cambio (sin fondos, bordes o textos que se vean distintos a como lucían previamente en claro).

### 5. Estados borde (Edge Cases de la spec)

1. **Carga**: reabrir el panel "Nueva cotización" (forzar recarga de datos si es posible) y observar brevemente el estado "Cargando formulario…" — el texto debe verse con el tono de texto secundario del sistema, no un gris suelto.
2. **Error**: forzar un error de carga (p. ej. cortar la red brevemente al abrir el panel) — el mensaje de error debe usar el rojo semántico del sistema (`text-destructive`), igual que los mensajes de error en otras pantallas del CRM.
3. **Botón deshabilitado**: abrir una oportunidad SIN contacto asociado — el botón "Nueva cotización" debe verse deshabilitado con el mismo tratamiento visual que otros botones deshabilitados del CRM.
4. **Scroll en la tabla de productos**: agregar productos hasta forzar scroll dentro del panel — el encabezado fijo (sticky) de la tabla debe mantener el mismo tono de superficie que el resto, sin salto de contraste al hacer scroll.

## Criterio de aceptación

Todos los puntos "Verificar" de los escenarios 1–4 deben cumplirse simultáneamente en ambos temas para considerar la feature completa (mapea a SC-001…SC-004 en `spec.md`). No se requiere ejecutar ninguna suite automatizada nueva — las suites existentes (unit/integration/E2E) deben seguir pasando sin cambios, ya que el comportamiento funcional no se modifica (FR-005).
