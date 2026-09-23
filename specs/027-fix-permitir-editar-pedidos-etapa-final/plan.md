# Implementation Plan: Permitir configurar edición de pedidos en etapas Final/Cancelación

**Branch**: `027-fix-permitir-editar-pedidos-etapa-final` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-fix-permitir-editar-pedidos-etapa-final/spec.md`

## Summary

Hotfix acotado a la capa de configuración del Flujo de Venta (UI + su Server Action), sin tocar el modelo de datos ni el enforcement que consume el flag. El motor de permisos por etapa (`FlujoVentaEtapa.permiteEditarPedido` / `permiteEditarEntrega`) ya existe y ya se respeta correctamente donde se **lee** (`src/sales/pedidos/actions.ts` y `src/app/sales/pedidos/[id]/page.tsx`). El candado estaba duplicado en dos capas donde se **escribe**: el diálogo `DialogEditarEtapa` (`src/sales/flujo-venta/components/panel-config-etapas.tsx`) y, se confirmó durante la implementación, también en los Server Actions `crearEtapa`/`actualizarEtapa` (`src/sales/flujo-venta/actions.ts`), que volvían a forzar `false` del lado servidor sin importar lo que mandara el cliente. Se corrigieron ambas capas con el mismo criterio. No hay migración de datos.

## Technical Context

**Language/Version**: TypeScript 5, React 19 (Client Component)

**Primary Dependencies**: Next.js 16 (App Router), Prisma 7 (ya generado, sin cambios de schema), shadcn/ui (Dialog, Tooltip) — todo ya en uso en el mismo archivo

**Storage**: PostgreSQL vía Prisma — sin cambios de schema; los campos `permiteEditarPedido`/`permiteEditarEntrega` en `FlujoVentaEtapa` ya existen

**Testing**: Vitest (unit, si aplica) / Playwright (e2e existente en `tests/e2e/sales/flujo-venta.spec.ts`) — se valida manualmente vía quickstart.md; se evalúa agregar un caso a los tests e2e existentes de flujo-venta como parte de las tasks

**Target Platform**: Web app (navegador), Server Components + Client Component existente

**Project Type**: Web application (Next.js App Router monolito) — Opción 1 de la plantilla, sin frontend/backend separados

**Performance Goals**: N/A — cambio de lógica de UI en un diálogo de configuración, sin impacto de performance

**Constraints**: No alterar el comportamiento de etapas Iniciales ni intermedias (FR-006); no requiere migración de datos (Assumptions)

**Scale/Scope**: 1 archivo de componente (`panel-config-etapas.tsx`), ~4 líneas de lógica + ajustes de JSX/tooltips asociados. Sin cambios en `actions.ts`, `schema.ts`, `queries.ts`, ni `prisma/schema.prisma`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Modular Business Architecture**: ✅ Cambio contenido dentro del módulo `sales/flujo-venta` existente, en su componente de UI. No introduce abstracciones paralelas ni cruza límites de módulo.
- **II. Server-Enforced Business Rules**: ✅ No se debilita — el servidor (`actions.ts`) sigue siendo la única autoridad que bloquea/permite la edición del pedido según el flag persistido; este cambio solo deja de bloquear artificialmente el flag en la UI que lo configura. No se agrega ni relaja validación de servidor.
- **III. Reliable Data and Events**: N/A — no hay efectos secundarios, eventos ni colas involucradas en este cambio (es un toggle de configuración, no una transición de estado del pedido).
- **IV. Replaceable Integrations**: N/A — no toca integraciones externas.
- **V. Security and Quality**: ✅ La mutación (`actualizarEtapa`) ya está scoped por tenant y validada con Zod (`EtapaSchema`, que ya acepta `permiteEditarPedido`/`permiteEditarEntrega` como booleanos opcionales) — no requiere cambios de schema. Se agrega cobertura de test proporcional al riesgo (bajo: cambio de UI) en `tasks.md`.

**Resultado**: PASA sin excepciones. No aplica Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/027-fix-permitir-editar-pedidos-etapa-final/
├── plan.md              # Este archivo
├── research.md          # Fase 0 (trivial — sin incógnitas técnicas, ver research.md)
├── data-model.md         # Fase 1 — "sin entidades nuevas"
├── quickstart.md         # Fase 1 — guía de validación manual
└── tasks.md              # Fase 2 (/speckit-tasks) — no creado por este comando
```

### Source Code (repository root)

```text
src/sales/flujo-venta/
├── components/
│   └── panel-config-etapas.tsx   # ÚNICO archivo con cambios de lógica/JSX
├── schema.ts                      # Sin cambios — EtapaSchema ya acepta los campos
├── actions.ts                     # Sin cambios — actualizarEtapa ya persiste los campos tal cual llegan
└── types.ts                       # Sin cambios — FlujoVentaEtapa ya tipa ambos campos

src/sales/pedidos/
├── actions.ts                     # Sin cambios — enforcement ya correcto (líneas 262-269)
└── (src/app/sales/pedidos/[id]/page.tsx)  # Sin cambios — cálculo ya correcto (línea 129)

tests/e2e/sales/
└── flujo-venta.spec.ts            # Posible caso nuevo (ver tasks.md) validando que el toggle
                                     # queda habilitado y persiste en etapas Final/Cancelación
```

**Structure Decision**: Proyecto único (Next.js App Router monolito, ya existente) — no aplica Opción 2/3 de la plantilla. El cambio vive enteramente dentro de `src/sales/flujo-venta/components/panel-config-etapas.tsx`; el resto de archivos listados se citan solo para dejar constancia de que se inspeccionaron y no requieren cambios.

## Complexity Tracking

*No aplica — Constitution Check pasó sin violaciones.*
