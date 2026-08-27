# Implementation Plan: Corrección de colores en modo oscuro — Edición de pedido y regla de flujo de venta

**Branch**: `002-fix-pedido-flujo-dark-mode` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-fix-pedido-flujo-dark-mode/spec.md`

## Summary

`dialog-editar-pedido.tsx` y `sheet-regla-validacion.tsx` comparten el mismo patrón de paleta fija (`stone-*`, `black`/`white` literal) ya corregido en el módulo de cotizaciones (`001-fix-cotizacion-dark-mode`) — fueron detectados ahí mismo como "hallazgo relacionado, fuera de alcance". El enfoque técnico es idéntico: reemplazo de clases 1:1, sin cambios de estructura, lógica ni layout, reutilizando el mapeo de tokens ya validado (`bg-modal`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-muted`) más 3 casos nuevos (separador, tarjeta informativa con acento, badge de estado) documentados en `research.md`. El acento lima y el badge de resultado de prueba (`emerald-*`/`red-*`) quedan fuera de alcance.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router, sin cambios de versión)

**Primary Dependencies**: Tailwind CSS v4 (tokens semánticos de `src/app/globals.css`), shadcn/ui / `@base-ui/react` (`Sheet`, `Button`, `Separator`, `Switch`) — sin dependencias nuevas

**Storage**: N/A — sin cambios de datos ni de esquema Prisma

**Testing**: Validación visual manual (dark/light) según `quickstart.md`; suites automatizadas existentes deben seguir pasando sin modificación (FR-005)

**Target Platform**: Web (misma app, mismo mecanismo de tema `.dark` que `001-fix-cotizacion-dark-mode`)

**Project Type**: Web application — mismo proyecto Next.js único ya existente

**Performance Goals**: N/A — reemplazo de clases CSS

**Constraints**: No alterar la apariencia en modo claro (FR-006); no introducir nuevos valores hex/rgb ni nuevas clases de paleta fija (FR-007); cero cambios de comportamiento (FR-005); el badge `emerald-*`/`red-*` de resultado de prueba queda explícitamente fuera de alcance (FR-008)

**Scale/Scope**: 2 archivos existentes (`src/sales/pedidos/components/dialog-editar-pedido.tsx`, `src/sales/flujo-venta/components/sheet-regla-validacion.tsx`), 122 ocurrencias de paleta fija a reemplazar (57 + 65) según `data-model.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — cambio confinado a componentes de presentación existentes en `src/sales/pedidos/` y `src/sales/flujo-venta/`; no se tocan Server Actions, queries ni Prisma. |
| II. Server-Enforced Business Rules | N/A / PASS — no se modifica validación ni reglas de negocio del servidor (FR-005). |
| III. Reliable Data and Events | N/A / PASS — sin cambios de datos, transacciones ni eventos. |
| IV. Replaceable Integrations | N/A / PASS — sin cambios de adaptadores ni proveedores externos. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — riesgo bajo (solo clases CSS); testing proporcional = validación visual manual vía `quickstart.md`; build y suites existentes deben seguir pasando. |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: el mapeo de tokens de `data-model.md` (heredado + D8/D9/D10) no introduce dependencias ni abstracciones nuevas — gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-pedido-flujo-dark-mode/
├── plan.md              # This file
├── research.md          # Phase 0 output — mapeo heredado + D8/D9/D10
├── data-model.md         # Phase 1 output — tabla de mapeo + inventario
└── quickstart.md         # Phase 1 output — guía de validación manual dark/light
```

No se genera `tasks.md` en este paso (Fase 2, comando `/speckit-tasks`). No se genera `contracts/`: sin interfaz externa involucrada, igual que en `001-fix-cotizacion-dark-mode`.

### Source Code (repository root)

```text
src/
├── sales/
│   └── pedidos/
│       └── components/
│           └── dialog-editar-pedido.tsx      # 57 ocurrencias — panel "Editar pedido"
└── sales/
    └── flujo-venta/
        └── components/
            └── sheet-regla-validacion.tsx    # 65 ocurrencias — panel de regla de validación
```

Referencia (no se modifica): `src/app/globals.css` — mismos tokens que en `001-fix-cotizacion-dark-mode` (`--card`, `--modal`, `--foreground`, `--muted-foreground`, `--border`, `--muted`).

**Structure Decision**: no se crean directorios ni archivos nuevos. El cambio vive enteramente en los dos componentes existentes listados arriba, cada uno en su módulo de negocio ya establecido (`src/sales/pedidos/`, `src/sales/flujo-venta/`).

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
