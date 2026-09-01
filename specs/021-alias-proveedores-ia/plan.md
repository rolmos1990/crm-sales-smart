# Implementation Plan: Alias único para múltiples instancias del mismo proveedor de IA

**Branch**: `021-alias-proveedores-ia` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-alias-proveedores-ia/spec.md`

## Summary

Hoy `ProveedorIA` restringe a una sola configuración por combinación `(proveedor, tipoAgenteIA)` — imposible tener dos agentes DeepSeek. Este plan agrega un campo `alias` obligatorio y único por instancia (insensible a mayúsculas/espacios), elimina esa restricción vieja, introduce la primera Server Action de edición del módulo (`actualizarProveedorIA`) y hace que el Alias — no el nombre del proveedor — sea lo que se muestre en el listado de Proveedores y en el selector de enrutamiento por objetivo. Los agentes existentes reciben un alias generado automáticamente por migración, sin intervención manual.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 16.2 (App Router, Server Actions), Prisma 7 / PostgreSQL, Zod 4, React Hook Form + `@hookform/resolvers/zod`, shadcn/ui (Radix/base-ui), TanStack Query no aplica aquí (esta pantalla ya usa Server Actions + `router`/`toast`, no fetch en cliente)

**Storage**: PostgreSQL vía Prisma — modificación aditiva de la tabla `ProveedorIA` existente (2 columnas nuevas, 1 índice único reemplazado)

**Testing**: Vitest (`npm run test:unit`) para Zod schema y Server Actions; Playwright (`npm run test:e2e:configuracion`, `tests/e2e/configuracion/configuracion.spec.ts`) para el flujo crítico crear/editar/duplicado en la UI real

**Target Platform**: Web (Next.js SSR + Server Actions), sin impacto en mobile/responsive más allá de un campo de formulario adicional

**Project Type**: Web application (monorepo Next.js único — no aplica la variante frontend/backend separados)

**Performance Goals**: N/A — pantalla de configuración administrativa de bajo volumen (decenas de proveedores por instancia como máximo); sin requisitos de throughput nuevos

**Constraints**: La migración de datos debe ser segura para instancias con filas existentes en `ProveedorIA` (constitución: "Prisma migrations MUST be versioned, reviewable, and safe for existing data") y no debe interrumpir el enrutamiento por objetivo ya configurado (spec 010) mientras corre

**Scale/Scope**: 1 tabla modificada, 2 Server Actions (1 nueva + 1 extendida), 1 schema Zod extendido, 3 componentes de UI tocados, 2 queries de lectura extendidas — sin nuevos módulos ni entidades

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| I. Modular Business Architecture | Extiende `src/configuracion/ia/*`, módulo ya existente y dueño de este dominio — no se crea ningún módulo ni abstracción paralela. Los componentes (`form-proveedor-ia.tsx`, `lista-proveedores-ia.tsx`, `seccion-enrutamiento.tsx`) no acceden a Prisma directo; siguen llamando Server Actions/queries. | PASS |
| II. Server-Enforced Business Rules | `alias` se valida con Zod en el boundary (`ActualizarProveedorIASchema`/`ProveedorIASchema` extendidos) antes de tocar Prisma. La unicidad case-insensitive se decide y aplica en el servidor (Server Action + `@@unique` de BD), nunca solo en el cliente. | PASS |
| III. Reliable Data and Events | El `create`/`update` de `ProveedorIA` es una escritura simple de una fila — no requiere transacción multi-tabla. No se introduce ningún evento de dominio nuevo (crear/editar un proveedor IA no es un evento de negocio catalogado en `src/eventos/catalogo`, es configuración administrativa; no se publica ni consume ningún evento). Ninguna condición de carrera queda sin resguardo (índice único + captura de `P2002`). | PASS |
| IV. Replaceable Integrations | No se toca ningún adapter de proveedor (`src/ai/proveedores/*`) ni sus contratos — el alias es puramente de identificación/presentación, nunca se pasa al SDK del proveedor externo. | PASS |
| V. Security and Quality | Toda query/mutación sigue escoping por `instanciaId` de la sesión (mismo patrón que `toggleProveedorIA`/`eliminarProveedorIA`). El `apiKeyEncriptada` sigue sin devolverse nunca al cliente (sin cambios ahí). Errores de duplicado usan un mensaje de negocio fijo, nunca el código/detalle crudo de Prisma. Se agregan tests unitarios (Zod + Server Actions) y se extiende el spec Playwright ya existente de `/configuracion` — proporcional al riesgo (pantalla administrativa, sin dinero ni PII involucrados). | PASS |

**Restricciones técnicas**: Prisma migration versionada con backfill explícito (ver research.md Decisión 3) — cumple "Prisma migrations MUST be versioned, reviewable, and safe for existing data". Sin dependencias nuevas (se descartó `citext` en research.md por no tener necesidad concreta frente a la alternativa ya disponible en el stack).

Sin violaciones — no aplica Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/021-alias-proveedores-ia/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas
├── data-model.md         # Fase 1 — modelo de datos
├── quickstart.md        # Fase 1 — guía de validación end-to-end
├── contracts/
│   └── server-actions.md # Fase 1 — contrato de Server Actions
└── tasks.md              # Fase 2 (/speckit-tasks — no generado por este comando)
```

### Source Code (repository root)

Proyecto Next.js de un solo módulo (no aplica la variante frontend/backend separados). Archivos reales afectados:

```text
prisma/
├── schema.prisma                                  # MODIFICAR: ProveedorIA (+alias, +aliasNormalizado, reemplazar @@unique)
└── migrations/
    └── <timestamp>_alias_proveedores_ia/
        └── migration.sql                          # NUEVA: agregar columnas, backfill, NOT NULL + índice único

src/configuracion/ia/
├── schema.ts                                       # MODIFICAR: +alias en ProveedorIASchema; +ActualizarProveedorIASchema
├── actions.ts                                       # MODIFICAR: crearProveedorIA (alias+duplicado); NUEVA actualizarProveedorIA
├── queries.ts                                       # MODIFICAR: obtenerProveedoresIA, obtenerProveedorIA, obtenerAsignacionesObjetivoIA (+alias)
└── actions.test.ts                                  # NUEVO: tests de duplicado, edición, exclusión del propio id, mensaje sin detalle de Prisma

src/configuracion/components/
├── form-proveedor-ia.tsx                            # MODIFICAR: campo Alias + prop `proveedorExistente` (modo edición)
├── lista-proveedores-ia.tsx                         # MODIFICAR: mostrar alias, acción "Editar"
└── seccion-enrutamiento.tsx                          # MODIFICAR: usar alias en vez de proveedor en los SelectItem

tests/e2e/configuracion/
└── configuracion.spec.ts                             # MODIFICAR: escenario crear 2 agentes mismo proveedor + alias duplicado rechazado
```

**Structure Decision**: Se extiende exclusivamente el módulo `src/configuracion/ia/` (dueño existente de `ProveedorIA`) y los tres componentes de `src/configuracion/components/` que ya consumen esos datos — sin crear ningún directorio ni módulo nuevo, siguiendo el Principio I y la convención del proyecto de extender antes que introducir abstracciones paralelas.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
