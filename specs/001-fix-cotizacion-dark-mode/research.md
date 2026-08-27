# Research: Corrección de colores en modo oscuro — Nueva cotización

**Feature**: `001-fix-cotizacion-dark-mode` | **Date**: 2026-08-27

Esta feature no tiene incógnitas de stack (Next.js/Tailwind/shadcn ya están fijados por el proyecto). La investigación se centró en **qué token semántico concreto** reemplaza cada clase de paleta fija, verificando precedentes ya existentes en el propio código en lugar de inventar un mapeo nuevo.

## Método

1. Se inventariaron los tres archivos afectados (`sheet-nueva-cotizacion.tsx`, `sheet-editar-cotizacion.tsx`, `form-cotizacion.tsx`) y se contaron sus ocurrencias de paleta fija (`stone-*`, `zinc-*`, `gray-*`, `white/N`, `text-red-500`, `bg-white`): 6, 14 y 115 respectivamente (135 en total).
2. Se buscó, dentro del propio repo, un `Sheet` ya conforme y una lista ya conforme (`lista-contactos.tsx`, citada como referencia en `CLAUDE.md`) para extraer el mapeo real que el equipo ya usa, en vez de derivar tokens "en teoría".
3. Se leyó `src/app/globals.css` para confirmar que cada token propuesto existe y resuelve correctamente en `:root` (claro) y `.dark` (oscuro).

## Decisiones

### D1 — Superficie del panel (`SheetContent`)

- **Decisión**: usar `bg-modal border-border` en el `SheetContent` que hoy tiene `bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10`.
- **Rationale**: `pipeline-filtros-drawer.tsx` ya tiene un `SheetContent` conforme con exactamente `bg-modal border-l border-border`. El token `--modal` (`#FFFFFF` claro / `#17232E` oscuro) es el que el proyecto reserva para superficies de sheet/dialog — es el precedente real que otro desarrollador ya eligió, no solo una alternativa teóricamente válida.
- **Alternativas consideradas**:
  - `bg-card` (mencionado como ejemplo ilustrativo en la clarificación de spec): rechazado como superficie del `SheetContent` porque no es el token que el repo usa para sheets (aunque es visualmente casi idéntico, `--card` es `#17232D` vs `--modal` `#17232E`); se reserva `bg-card` para bloques tipo tarjeta dentro del contenido (ver D4).
  - `bg-popover` (default del primitivo `Sheet` en `src/components/ui/sheet.tsx`): rechazado porque ningún `SheetContent` real del repo lo deja sin override — todos los que sí cumplen la política lo sobreescriben a `bg-modal`.

### D2 — Texto principal y secundario

- **Decisión**: `text-stone-900`/`text-stone-100` → `text-foreground`. `text-stone-400`/`text-stone-500`/`text-stone-600`/`text-stone-300` (incluyendo el separador "—") → `text-muted-foreground`.
- **Rationale**: `lista-contactos.tsx` (referencia explícita en `CLAUDE.md`) solo usa `text-foreground` y `text-muted-foreground` para todo su texto primario/secundario — el proyecto no expone una tercera clase de "texto muy tenue" como token de Tailwind independiente, así que los tres tonos de gris (400/500/600) y el tono más claro (300) colapsan al mismo `text-muted-foreground`.

### D3 — Bordes

- **Decisión**: `border-stone-100/200/300` y `dark:border-white/5/10/20` → `border-border` en todos los casos (separadores de sección, tarjetas internas, filas de tabla, checkbox).
- **Rationale**: `--border` ya resuelve a `--border-subtle` en ambos temas y es el único token de borde usado en el precedente conforme (`border-l border-border`). No hay evidencia en el repo de que el proyecto distinga "borde 100" vs "borde 200" como tokens separados — es gradación de opacidad de una paleta fija, no un sistema de tokens.

### D4 — Superficies recesadas (fondo de tabla, tarjeta de cliente, footer de totales)

- **Decisión**: `bg-stone-50`/`dark:bg-white/[0.03]`/`dark:bg-white/[0.02]` → `bg-muted`.
- **Rationale**: `--muted` = `--surface-2`, el rol de token para superficies recesadas/sutiles; coincide con el uso de `bg-muted` en `lista-contactos.tsx`. `bg-card` no aplica aquí porque estas superficies están *dentro* del panel (que ya es `bg-modal`), no son tarjetas de nivel superior.

### D5 — Estado de error

- **Decisión**: `text-red-500` (mensaje de error al cargar el formulario) → `text-destructive`.
- **Rationale**: `text-destructive` es el token semántico de error ya usado en el resto del CRM (p. ej. `lista-contactos.tsx`, variante `destructive` de `Button`) en vez de un rojo de Tailwind sin mapear a tema.

### D6 — Estados hover/disabled de botones-ícono inline

- **Decisión**: los botones ícono inline (quitar producto, minimizar/expandir cantidad, cerrar) que hoy usan `text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/5` pasan a `text-muted-foreground hover:bg-muted hover:text-foreground`.
- **Rationale**: es exactamente el patrón `hover:bg-muted hover:text-foreground` que ya usan las variantes `ghost` y `outline` de `src/components/ui/button.tsx` — no es un mapeo inventado, es el mismo comportamiento hover que el resto de botones del design system.

### D7 — Color de énfasis (acento lima) — se mantiene sin cambios

- **Decisión**: NO tocar `bg-lime-500/90`, `text-lime-500 dark:text-lime-400`, `text-stone-950` sobre fondo lima, ni el acento del checkbox (`text-lime-600 focus:ring-lime-500 accent-lime-500`). Queda fuera del alcance de esta feature.
- **Rationale**: un grep del repo (`grep -rl "lime-"`) muestra que la clase `lime-*` es un acento usado de forma consistente en decenas de módulos no relacionados (pedidos, flujo-venta, pipeline, configuración, páginas de auth). No es una desviación propia de cotizaciones — es la convención de acento vigente en toda la app. La Assumption ya aceptada en `/speckit-clarify` limita esta feature a superficies/bordes/texto genérico, no a re-tematizar el acento de toda la aplicación.
- **Alternativa considerada**: normalizar a `bg-primary`/`text-primary` (el token de marca real, `#6F9F32`): rechazada para esta feature — cambiar el acento solo en cotizaciones dejaría sus CTA *inconsistentes* con el resto de la app (viola el objetivo de FR-001), y re-tematizar `lime-*` a `primary-*` en todo el proyecto es un trabajo aparte, fuera de este alcance. Se deja como nota para una futura feature, no como tarea de esta.

## Hallazgo relacionado (fuera de alcance, documentado para el backlog)

El mismo patrón roto (`bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-white/10`) aparece copiado también en `src/sales/pedidos/components/dialog-editar-pedido.tsx` y `src/sales/flujo-venta/components/sheet-regla-validacion.tsx`. No forman parte de esta feature (spec limitada a cotizaciones), pero comparten la misma causa raíz y el mismo mapeo de tokens (D1–D6) sería aplicable ahí en una iteración futura.

## Salida

Todas las incógnitas quedaron resueltas con precedente verificable en el propio código; no quedan `NEEDS CLARIFICATION` pendientes para el Technical Context.
