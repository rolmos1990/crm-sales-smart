# Data Model: Reinicio de scroll al navegar entre secciones

**Feature**: `003-fix-scroll-position-nav` | **Date**: 2026-08-27

Esta feature no crea, modifica ni elimina entidades de negocio — es una corrección de comportamiento de UI en el shell de la aplicación (`AppLayout`). No aplica un `data-model.md` de entidades de dominio.

En su lugar, se documenta aquí la **matriz de disparadores**: qué eventos deben reiniciar el scroll del contenedor principal (`<main>`) y cuáles deben preservarlo, derivada de los Functional Requirements de `spec.md` y las decisiones D1–D3 de `research.md`.

## Matriz de disparadores

| Evento | ¿Reinicia el scroll de `<main>`? | Requisito |
|---|---|---|
| Clic en una opción del menú principal (cambia de sección) | Sí | FR-001, FR-003 |
| Navegación a otra sección vía cualquier enlace interno (`<Link>`/`router.push` a otro pathname) | Sí | FR-001, FR-003 |
| Navegación atrás/adelante del navegador (cambia el pathname) | Sí | Edge case en `spec.md` |
| Recarga completa del navegador (F5) | Sí (nace en `0` de forma natural + defensa D2) | FR-002 |
| Primer montaje de la aplicación | Sí (estado inicial correcto) | FR-002 |
| Auto-refresh en segundo plano de una sección (p. ej. `router.refresh()` del Pipeline) — mismo pathname | No — se preserva la posición actual | FR-004 |
| Cambio de parámetros de búsqueda en la misma sección (filtros, paginación, `?p=id`) — mismo pathname | No — se preserva la posición actual | D3 (research.md) |
| Abrir/cerrar un panel lateral (sheet) sobre la sección actual | No — no es cambio de sección | Edge case en `spec.md` |
| Scroll interno de un panel/tablero con su propio contenedor (p. ej. desplazamiento horizontal del Kanban) | No se ve afectado — el reinicio no alcanza ese contenedor | FR-005 |

## Reglas de validación (heredadas del FR, no nuevas)

- El reinicio MUST aplicarse únicamente al contenedor de nivel de sección (`<main>`), nunca a contenedores de scroll internos de una página (FR-005).
- El reinicio MUST NOT alterar URLs, parámetros de filtro ni datos cargados (FR-006) — es un cambio exclusivamente de posición de scroll.
