# Implementation Plan: Corrección de colores en modo oscuro — Nueva cotización

**Branch**: `001-fix-cotizacion-dark-mode` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-fix-cotizacion-dark-mode/spec.md`

## Summary

El panel "Nueva cotización" (y sus variantes de edición y página completa) usa clases de paleta fija de Tailwind (`stone-*`, `zinc-*`, `black`/`white` literal) en vez de los tokens semánticos que ya usa el resto del CRM, lo que hace que se vea con fondo negro plano y tonos que desentonan en modo oscuro. El enfoque técnico es un reemplazo de clases 1:1 (sin cambios de estructura, lógica ni layout) en los tres archivos que comparten el formulario de cotización, siguiendo el mapeo de tokens ya validado contra precedentes existentes en el propio repo (`research.md` / `data-model.md`). El acento lima de las acciones principales se conserva intencionalmente (fuera de alcance).

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router, sin cambios de versión)

**Primary Dependencies**: Tailwind CSS v4 (tokens semánticos definidos en `src/app/globals.css`), shadcn/ui / `@base-ui/react` (`Sheet`, `Button`) — no se agregan dependencias nuevas

**Storage**: N/A — sin cambios de datos ni de esquema Prisma

**Testing**: Validación visual manual (dark/light) según `quickstart.md`; las suites automatizadas existentes (unit/integration/E2E) deben seguir pasando sin modificación, ya que no cambia comportamiento (FR-005)

**Target Platform**: Web (aplicación existente, tema oscuro/claro vía clase `.dark` — `@custom-variant dark (&:is(.dark *))` en `globals.css`)

**Project Type**: Web application — proyecto Next.js único ya existente (no aplica estructura frontend/backend separada)

**Performance Goals**: N/A — reemplazo de clases CSS, sin impacto de performance medible

**Constraints**: No alterar la apariencia en modo claro (FR-006); no introducir nuevos valores hex/rgb ni nuevas clases de paleta fija (FR-007); cero cambios de comportamiento/validación/guardado (FR-005)

**Scale/Scope**: 3 archivos existentes en `src/sales/cotizaciones/components/` (`sheet-nueva-cotizacion.tsx`, `sheet-editar-cotizacion.tsx`, `form-cotizacion.tsx`), ~135 ocurrencias de clases de paleta fija a reemplazar por el mapeo de tokens de `data-model.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — cambio confinado a componentes de presentación ya existentes dentro de `src/sales/cotizaciones/`; no se tocan Server Actions, queries ni acceso a Prisma. |
| II. Server-Enforced Business Rules | N/A / PASS — no se modifica validación Zod ni reglas de negocio del lado servidor (FR-005). |
| III. Reliable Data and Events | N/A / PASS — no hay cambios de datos, transacciones ni eventos de dominio. |
| IV. Replaceable Integrations | N/A / PASS — no se tocan adaptadores ni proveedores externos. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — riesgo bajo (solo clases CSS); testing proporcional al riesgo = validación visual manual documentada en `quickstart.md`, sin necesidad de nueva cobertura automatizada; las pruebas existentes deben seguir pasando (build + suites actuales), cumpliendo "la build y los tests relevantes deben pasar". |

**Restricciones técnicas relevantes**: "Las modificaciones de UI MUST mantenerse responsive y accesibles, preservar el comportamiento desktop..." — se cumple porque el cambio es exclusivamente de color (tokens), sin tocar layout, breakpoints ni estructura DOM.

No hay violaciones. **Complexity Tracking no aplica** (tabla vacía intencionalmente).

*Re-chequeo post-diseño (Fase 1)*: el mapeo de tokens de `data-model.md` no introduce ninguna dependencia, capa ni abstracción nueva — sigue pasando todos los principios sin excepciones. Gate confirmado.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-cotizacion-dark-mode/
├── plan.md              # This file
├── research.md          # Phase 0 output — mapeo de tokens y su rationale
├── data-model.md         # Phase 1 output — tabla de mapeo + inventario de superficies afectadas
├── quickstart.md         # Phase 1 output — guía de validación manual dark/light
└── tasks.md              # Phase 2 output (/speckit-tasks — no generado por este comando)
```

No se genera carpeta `contracts/`: esta feature no expone ni consume ninguna interfaz externa (API, evento, CLI) — es un cambio de presentación puramente interno a tres componentes React ya existentes.

### Source Code (repository root)

Proyecto Next.js único ya existente (sin frontend/backend separados). Los únicos archivos que cambian son:

```text
src/
└── sales/
    └── cotizaciones/
        └── components/
            ├── sheet-nueva-cotizacion.tsx    # 6 ocurrencias — panel "Nueva cotización" desde el pipeline
            ├── sheet-editar-cotizacion.tsx   # 14 ocurrencias — panel de edición
            └── form-cotizacion.tsx           # 115 ocurrencias — formulario compartido por los 3 puntos de entrada
```

Referencia (no se modifica): `src/app/globals.css` — fuente de verdad de los tokens semánticos consumidos (`--card`, `--modal`, `--foreground`, `--muted-foreground`, `--border`, `--muted`, `--destructive`).

**Structure Decision**: no se crean directorios ni archivos nuevos. El cambio vive enteramente dentro de los tres componentes ya existentes listados arriba, siguiendo la estructura por capacidad de negocio (`src/sales/cotizaciones/`) ya establecida en el proyecto.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
