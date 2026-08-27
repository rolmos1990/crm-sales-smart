# Quickstart: Validar la corrección de colores — Edición de pedido y regla de flujo de venta

**Feature**: `002-fix-pedido-flujo-dark-mode` | **Date**: 2026-08-27

Guía de validación manual end-to-end. Sigue el mismo patrón que `specs/001-fix-cotizacion-dark-mode/quickstart.md`.

## Prerrequisitos

- Servidor de desarrollo corriendo: `npm run dev`
- Sesión con acceso a Ventas (permiso sobre pedidos y flujo de venta) y al menos:
  - Un pedido existente para probar edición
  - Al menos una etapa del flujo de venta para crear/editar una regla de validación
- Toggle de tema claro/oscuro accesible, o forzar `class="dark"` en `<html>` desde devtools

## Escenarios a validar

### 1. Editar un pedido (US1 — P1)

1. Con tema oscuro activo, abrir un pedido existente y usar "Editar pedido".
2. **Verificar**: el panel no muestra fondo negro puro ni bordes/texto en grises ajenos al resto del CRM.
3. Recorrer las secciones: datos generales, "Datos de facturación" (colapsar y expandir), tabla de líneas, totales (incluyendo el separador antes del total), notas — **verificar** paleta consistente en todas.
4. **Verificar** que el botón "Guardar cambios" conserva el acento lima (intencional, D7).

### 2. Crear/editar una regla de validación de flujo de venta (US2 — P1)

1. Con tema oscuro activo, abrir la configuración de una etapa del flujo de venta y crear (o editar) una regla de validación.
2. **Verificar**: el panel (header, tarjeta informativa, campos, condiciones, columna de resumen y prueba) no muestra fondo negro puro ni grises ajenos al sistema.
3. Ejecutar una prueba con un pedido y **verificar** que el badge de resultado ("Cumple"/"No cumple") sigue siendo legible y comunica su significado (verde/rojo) — no forma parte de esta corrección (FR-008), solo se confirma que no quedó roto visualmente por los cambios de alrededor.

### 3. Regresión en modo claro (US3 — P2)

1. Cambiar a tema claro.
2. Repetir los flujos 1 y 2.
3. **Verificar**: apariencia equivalente a la que tenían antes del ajuste.

### 4. Estados borde

1. **Colapsable**: abrir/cerrar "Datos de facturación" varias veces — el botón y su hover deben verse consistentes con el resto del CRM.
2. **Carga**: observar brevemente "Guardando..." / "Guardar borrador" / spinners — deben usar el mismo tratamiento que en cotizaciones.

## Criterio de aceptación

Todos los puntos "Verificar" deben cumplirse en ambos temas (mapea a SC-001…SC-004 en `spec.md`). No se requiere ejecutar ninguna suite automatizada nueva — las suites existentes deben seguir pasando sin cambios (FR-005).
