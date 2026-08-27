---
name: design-systems
description: "Reglas globales de UI/UX para Karia CRM: identidad visual y tokens de color, generación de componentes primitivos y de patrones compuestos reutilizables. Fusiona los antiguos skills ui-component y ui-pattern para evitar solapamiento."
category: design
risk: safe
---

# Design Systems — Karia CRM

Punto de entrada único para todo lo relacionado a UI/UX del proyecto. Reemplaza a los skills
separados `ui-component` y `ui-pattern` (fusionados aquí porque cubrían el mismo dominio con
reglas casi idénticas de tokens y estructura de archivos).

## Cuándo usar

- Crear o modificar un componente primitivo en `src/components/ui/`, o extender uno de shadcn/ui existente
- Crear una sección compuesta reutilizable (lista con filtros, grid de cards KPI, tabla con acciones, form section)
- Revisar o ajustar dark mode / light mode, o cuando una pantalla se vea básica, plana o inconsistente
- Verificar que un componente no tenga colores o hex hardcodeados

## Contenido

1. [`visual-language.md`](./visual-language.md) — identidad visual y filosofía de color. Fuente de verdad de los valores: `src/app/globals.css`
2. [`component-guidelines.md`](./component-guidelines.md) — cómo generar/extender un componente primitivo nuevo
3. [`pattern-guidelines.md`](./pattern-guidelines.md) — cómo generar un patrón compuesto reutilizable entre módulos

## Regla no negociable

Nunca hardcodear valores hex/rgb ni clases de color crudas de Tailwind (`bg-stone-950`,
`text-white`, `bg-lime-500`, etc.) si existe un token semántico equivalente. El valor vigente
de cada token vive en `src/app/globals.css` — no copiarlo a mano en documentación ni en
componentes; consumir el token (`var(--card)`, `bg-card`, `text-foreground`, `border-border`).
Ver `visual-language.md` para el detalle.

## Limitations
- Usar este skill solo cuando la tarea calza con el alcance descrito arriba.
- No es sustituto de revisión visual manual del resultado.
- Si el componente ya cumple la identidad visual del proyecto, dejarlo igual — no rediseñar por rediseñar.
