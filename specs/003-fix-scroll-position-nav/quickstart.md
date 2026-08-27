# Quickstart: Validar el reinicio de scroll al navegar

**Feature**: `003-fix-scroll-position-nav` | **Date**: 2026-08-27

Guía de validación manual end-to-end.

## Prerrequisitos

- Servidor de desarrollo corriendo: `npm run dev`
- Sesión activa con acceso a varias secciones del menú (CRM, Ventas)
- Suficientes datos de prueba para que el Dashboard tenga contenido más alto que el viewport (varios KPIs/listas) — si no, agrandar la ventana del navegador hacia abajo o reducir el zoom para forzar que el Dashboard requiera scroll

## Escenarios a validar

### 1. Navegación por menú (US1 — P1)

1. Abrir el Dashboard (`/crm`) y desplazarse hacia abajo hasta que el menú superior casi no se vea.
2. Hacer clic en "Pipeline" en el menú lateral.
3. **Verificar**: el Pipeline se muestra desde arriba — el menú superior, el selector de pipeline y los filtros son visibles de inmediato, sin necesidad de hacer scroll manual hacia arriba.
4. Repetir el mismo recorrido con al menos otras dos combinaciones de secciones (por ejemplo, Contactos → Cotizaciones, Pedidos → Dashboard) para confirmar que el comportamiento es consistente en toda la app (FR-003).

### 2. Recarga completa del navegador (US2 — P2)

1. Desplazarse hacia abajo en cualquier sección con contenido largo (por ejemplo, el Dashboard o un listado).
2. Recargar la página completa del navegador (F5 / Cmd+R).
3. **Verificar**: la sección se muestra desde arriba, con el menú superior y el título visibles.

### 3. Auto-refresh del Pipeline no debe perder el scroll (Edge case / FR-004)

1. Entrar al Pipeline y desplazarse hacia abajo o hacia un lado dentro del tablero (si hay suficientes tarjetas/columnas).
2. Esperar a que el indicador de auto-refresh dispare una actualización (o forzarla manualmente si el indicador lo permite).
3. **Verificar**: la posición de scroll dentro del tablero se mantiene igual después de la actualización — no vuelve a la parte superior por sí sola.

### 4. Paneles laterales no afectan el scroll de fondo (Edge case)

1. Desplazarse hacia abajo en una sección con datos (por ejemplo, Cotizaciones).
2. Abrir un panel lateral (por ejemplo, "Nueva cotización" desde una oportunidad, o "Editar" sobre un registro existente) y cerrarlo sin navegar.
3. **Verificar**: la posición de scroll de la sección de fondo no cambió por abrir/cerrar el panel.

### 5. Atrás/adelante del navegador (Edge case)

1. Navegar del Dashboard al Pipeline (como en el escenario 1).
2. Usar el botón "atrás" del navegador para volver al Dashboard.
3. **Verificar**: el Dashboard se muestra desde arriba (no reaparece en la posición de scroll que tenía antes de salir de él, salvo que se decida explícitamente lo contrario durante la implementación — ver Assumptions en `spec.md`).

## Criterio de aceptación

Todos los puntos "Verificar" deben cumplirse para considerar la feature completa (mapea a SC-001…SC-004 en `spec.md`). No se requiere ejecutar ninguna suite automatizada nueva — las suites existentes deben seguir pasando sin cambios, ya que no se altera ningún comportamiento funcional (FR-006).
