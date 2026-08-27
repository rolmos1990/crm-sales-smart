# Research: Corrección de colores en modo oscuro — Edición de pedido y regla de flujo de venta

**Feature**: `002-fix-pedido-flujo-dark-mode` | **Date**: 2026-08-27

Esta feature es continuación directa de `001-fix-cotizacion-dark-mode`, sobre los dos archivos que esa feature ya había detectado y dejado documentados como "hallazgo relacionado, fuera de alcance" (mismo patrón roto, misma causa raíz). No se investiga el mapeo de tokens desde cero — se reutiliza el ya validado en `specs/001-fix-cotizacion-dark-mode/research.md` (decisiones D1–D7) y `data-model.md`, verificando únicamente que siga aplicando 1:1 a estos dos archivos y detectando qué patrones nuevos (no vistos en cotizaciones) aparecen aquí.

## Método

1. Se leyeron completos `dialog-editar-pedido.tsx` (451 líneas) y `sheet-regla-validacion.tsx` (274 líneas).
2. Se contaron sus ocurrencias de paleta fija: 57 y 65 respectivamente (122 en total).
3. Se comparó cada patrón encontrado contra el mapeo D1–D7 ya establecido, confirmando reutilización directa donde aplica, y se identificaron los casos nuevos.

## Decisiones

### D1–D7 (heredadas de `001-fix-cotizacion-dark-mode`, sin cambios)

Se reutilizan tal cual — mismo rol de superficie, mismo token destino. Ver `specs/001-fix-cotizacion-dark-mode/research.md` para el detalle y rationale completos:

- Superficie de `SheetContent` (`bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10` → `bg-modal border-l border-border`) — aparece igual en ambos archivos (`dialog-editar-pedido.tsx:415`, `sheet-regla-validacion.tsx:106`).
- Texto principal/secundario (`text-stone-900/100` → `text-foreground`; `text-stone-300/400/500/600/700` → `text-muted-foreground`, salvo donde D8 aplica, ver abajo).
- Bordes (`border-stone-100/200/300`, `dark:border-white/N` → `border-border`).
- Superficies recesadas (`bg-stone-50`, `dark:bg-white/[0.0N]` → `bg-muted`).
- Hover de botones-ícono (`hover:bg-stone-100 dark:hover:bg-white/N` → `hover:bg-muted`).
- Acento lima (`lime-*`, `text-stone-950` sobre CTA) — se mantiene sin cambios (D7).

### D8 — Separador (`Separator`) entre subtotal y total

- **Decisión**: `bg-stone-200 dark:bg-white/10` (prop `className` del componente `Separator` en `dialog-editar-pedido.tsx:359`) → `bg-border`.
- **Rationale**: caso no visto en cotizaciones (esa pantalla no usa `<Separator>`), pero es la misma superficie semántica que D3 (borde) — `--border` es el token correcto también como color de fondo de una línea separadora de 1px.

### D9 — Tarjeta informativa con acento lima (`sheet-regla-validacion.tsx`)

- **Decisión**: NO tocar `border-lime-500/20 dark:border-lime-400/15 bg-lime-500/5 dark:bg-lime-400/5` (tarjeta "Se evaluará antes de asignar el estado…") ni el ícono `text-lime-600 dark:text-lime-400` que la acompaña — el texto interno (`text-stone-600 dark:text-stone-300`) sí se corrige a `text-muted-foreground` (D2).
- **Rationale**: es el mismo patrón de "chip informativo con acento de marca" ya presente en otras partes de la app (p. ej. `pipeline-filtros-drawer.tsx` con su chip de filtros activos), no una superficie genérica — cae dentro de la misma excepción D7 (acento con significado, no paleta a reemplazar).

### D10 — Indicador de resultado de prueba de regla: fuera de alcance (no se toca)

- **Hallazgo**: `sheet-regla-validacion.tsx` usa `bg-emerald-500/10 text-emerald-700 dark:text-emerald-400` / `bg-red-500/10 text-red-700 dark:text-red-400` para el badge "Cumple la regla" / "No cumple la regla", y `text-emerald-500` / `text-red-500` para los íconos de check/cruz por condición.
- **Decisión**: no se corrige en esta feature (ver FR-008 en `spec.md`). Se documenta como hallazgo para una futura iteración.
- **Rationale**: a diferencia de D7 (lima, patrón de acento pervasivo en toda la app y ya aceptado como excepción), este es un color de **estado semántico** (éxito/fallo) que sí tiene tokens propios en el proyecto (`--success`/`--success-muted`/`--success-text` para éxito; `--destructive` para fallo, ya usado en `text-destructive` en varios lugares) — la corrección correcta ahí no es "dejarlo igual" como con lima, sino migrar a esos tokens de estado, lo cual es un cambio de naturaleza distinta a la que cubre esta feature (reemplazo 1:1 superficie/texto/borde) y no fue parte del pedido explícito del usuario ("los mismos colores... stone-*, black/white literal"). Se deja fuera para no mezclar dos tipos de corrección en un mismo cambio, y para que sea revisable de forma independiente.

## Salida

Todo el mapeo necesario para esta feature ya existe (heredado + D8/D9/D10 documentados aquí); no quedan incógnitas técnicas para el Technical Context.
