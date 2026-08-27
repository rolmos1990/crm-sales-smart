# Data Model: Corrección de colores en modo oscuro — Nueva cotización

**Feature**: `001-fix-cotizacion-dark-mode` | **Date**: 2026-08-27

Esta feature no crea, modifica ni elimina entidades de negocio, campos de Prisma, ni contratos de eventos — es un cambio puramente visual (FR-005). No aplica un `data-model.md` tradicional de entidades de dominio.

En su lugar, el "modelo" relevante para esta feature es el **mapeo de tokens de color** que reemplaza cada clase de paleta fija, y el **inventario de superficies** donde se aplica. Ambos quedan documentados aquí como referencia para la fase de tareas/implementación.

## Entidad de negocio (sin cambios)

- **Cotización**: documento comercial existente (`prisma.cotizacion`). Sus campos, estados y relaciones no cambian. Se menciona solo porque el formulario que se corrige visualmente es el que la crea/edita.

## Mapeo de tokens (rol de superficie → token semántico)

| Rol | Clase(s) de paleta fija actual | Token semántico destino | Ver decisión |
|---|---|---|---|
| Superficie del panel (Sheet) | `bg-white dark:bg-stone-950` | `bg-modal` | D1 |
| Borde del panel / secciones / tabla / checkbox | `border-stone-100/200/300`, `dark:border-white/5/10/20` | `border-border` | D3 |
| Texto principal | `text-stone-900`, `text-stone-100` | `text-foreground` | D2 |
| Texto secundario / deshabilitado / separador | `text-stone-300/400/500/600` | `text-muted-foreground` | D2 |
| Superficie recesada (header de tabla, tarjeta de cliente, footer de totales) | `bg-stone-50`, `dark:bg-white/[0.02]`, `dark:bg-white/[0.03]` | `bg-muted` | D4 |
| Texto de error | `text-red-500` | `text-destructive` | D5 |
| Hover de botón-ícono inline | `hover:text-stone-600 dark:hover:text-stone-200`, `hover:bg-stone-100 dark:hover:bg-white/5` | `hover:text-foreground hover:bg-muted` | D6 |
| Acento de acción principal (botón guardar, spinner, checkbox, link "editar cliente") | `bg-lime-*`, `text-lime-*`, `accent-lime-*`, `focus:ring-lime-*` | **Sin cambio** — fuera de alcance | D7 |

_Detalle de rationale y alternativas de cada fila: ver `research.md`._

## Inventario de superficies afectadas (por archivo)

| Archivo | Ocurrencias de paleta fija | Puntos de entrada que lo usan |
|---|---|---|
| `src/sales/cotizaciones/components/sheet-nueva-cotizacion.tsx` | 6 | Crear cotización desde el pipeline (US1) |
| `src/sales/cotizaciones/components/sheet-editar-cotizacion.tsx` | 14 | Editar cotización existente (US3) |
| `src/sales/cotizaciones/components/form-cotizacion.tsx` | 115 | Los tres puntos de entrada (pipeline, edición, página `/sales/cotizaciones/nueva`) — es el formulario compartido |

Total: 135 ocurrencias de paleta fija a reemplazar según el mapeo de arriba, sin tocar las marcadas como "sin cambio" (D7).

## Reglas de validación (heredadas del FR, no nuevas)

- Ningún archivo del módulo de cotizaciones MUST introducir un nuevo valor hex/rgb ni una nueva clase `stone-*`/`zinc-*`/`gray-*`/`black`/`white` literal tras el cambio (FR-007).
- El comportamiento (validación de formulario, submit, mensajes funcionales de error) no cambia — solo la clase CSS que pinta el mensaje de error (FR-005, D5).
