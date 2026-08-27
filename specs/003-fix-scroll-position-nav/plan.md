# Implementation Plan: Reinicio de scroll al navegar entre secciones

**Branch**: `003-fix-scroll-position-nav` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-fix-scroll-position-nav/spec.md`

## Summary

El shell de la app usa un contenedor de scroll propio (`<main overflow-y-auto>` dentro de `AppLayout`) en vez del scroll nativo de la ventana, y Next.js App Router solo reinicia el scroll de la ventana al navegar — nunca este contenedor personalizado. Como resultado, al navegar de una sección alta (p. ej. Dashboard) a otra (p. ej. Pipeline), el contenedor conserva su posición de scroll previa y la nueva sección aparece "cortada" desde la mitad. El enfoque técnico es agregar un efecto acotado en `AppLayout` (`src/shared/ui/app-sidebar.tsx`) que reinicia `<main>` a la parte superior cada vez que cambia el `pathname` (cambio real de sección), sin afectar el auto-refresh del Pipeline (que hoy preserva el scroll a propósito) ni el scroll interno de tableros/paneles con su propio contenedor.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router, sin cambios de versión)

**Primary Dependencies**: `next/navigation` (`usePathname`) — ya usado en el mismo archivo; sin dependencias nuevas

**Storage**: N/A — sin cambios de datos

**Testing**: Validación visual/interactiva manual según `quickstart.md`; las suites automatizadas existentes (unit/E2E) deben seguir pasando sin cambios, ya que no se altera comportamiento funcional (FR-006)

**Target Platform**: Web (misma app, mismo shell `AppLayout` usado por `/crm/*` y `/sales/*`)

**Project Type**: Web application — mismo proyecto Next.js único ya existente

**Performance Goals**: N/A — el reinicio de scroll es una operación síncrona trivial (`scrollTop = 0`) sin impacto medible

**Constraints**: No alterar el scroll interno de paneles/tableros con contenedor propio (FR-005); no alterar el comportamiento de preservación de scroll del auto-refresh del Pipeline (FR-004); no alterar URLs, filtros ni datos cargados (FR-006)

**Scale/Scope**: 1 archivo existente (`src/shared/ui/app-sidebar.tsx`, componente `AppLayout`) — el shell es compartido por todas las secciones bajo `/crm/*` y `/sales/*`, así que corregirlo ahí resuelve el bug en toda la app sin tocar páginas individuales

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — el cambio vive en el componente de shell ya existente (`AppLayout`), que es exactamente el lugar correcto para lógica transversal de layout/navegación; no se introduce una abstracción paralela ni se duplica por página. |
| II. Server-Enforced Business Rules | N/A / PASS — no hay validación ni reglas de negocio involucradas; es comportamiento de UI puro. |
| III. Reliable Data and Events | N/A / PASS — sin cambios de datos, transacciones ni eventos de dominio. |
| IV. Replaceable Integrations | N/A / PASS — sin cambios de adaptadores ni proveedores externos. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — riesgo bajo (un efecto de layout acotado); testing proporcional = validación manual interactiva vía `quickstart.md`, cubriendo explícitamente el caso que NO debe romperse (auto-refresh del Pipeline). |

**Restricciones técnicas relevantes**: "Las modificaciones de UI MUST mantenerse responsive y accesibles, preservar el comportamiento desktop..." — se cumple: el cambio no toca breakpoints, estructura DOM ni accesibilidad; solo la posición de scroll inicial de cada sección.

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: la matriz de disparadores de `data-model.md` no introduce ninguna dependencia, capa ni abstracción nueva — sigue pasando todos los principios sin excepciones. Gate confirmado.

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-scroll-position-nav/
├── plan.md              # This file
├── research.md          # Phase 0 output — diagnóstico + decisiones D1-D3
├── data-model.md         # Phase 1 output — matriz de disparadores (reinicia / preserva scroll)
└── quickstart.md         # Phase 1 output — guía de validación manual
```

No se genera `tasks.md` en este paso (Fase 2, comando `/speckit-tasks`). No se genera `contracts/`: sin interfaz externa involucrada — es un ajuste de comportamiento de UI interno al shell de la app.

### Source Code (repository root)

```text
src/
└── shared/
    └── ui/
        └── app-sidebar.tsx    # Componente AppLayout — único archivo a modificar
```

Consumido (sin cambios) por `src/app/crm/layout.tsx` y `src/app/sales/layout.tsx`, que ya renderizan `<AppLayout>` — al corregir el componente compartido, la corrección aplica automáticamente a todas las secciones bajo esos dos layouts.

**Structure Decision**: no se crean directorios ni archivos nuevos. El cambio vive enteramente en el componente de shell ya existente, siguiendo la estructura ya establecida del proyecto (`src/shared/ui/` para componentes de UI compartidos transversales a todos los módulos).

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
