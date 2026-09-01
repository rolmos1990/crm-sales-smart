# Implementation Plan: Herramientas operativas de inventario, envíos y acciones comerciales controladas

**Branch**: `015-herramientas-operativas-inventario-envios-acciones` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-herramientas-operativas-inventario-envios-acciones/spec.md`

## Summary

Dos frentes independientes bajo el mismo módulo de tools ya existente (`src/ai/tools/`): (1) tools de solo lectura sobre datos que ya existen (`Producto.cantidadDisponible`/`precio`) más una configuración nueva y mínima de métodos de entrega/zonas/ubicaciones de retiro que hoy no existe en ningún lado del schema; (2) el modo de confirmación humana sobre `crear_cotizacion`/`crear_pedido`, resuelto marcando el documento (`generadoPorIA`, `confirmadoPorHumano`) en vez de crear un tipo de documento paralelo — controlado por un flag nuevo y opcional en `AgenteIAConfig`, default `false` (comportamiento actual, decisión de negocio ya tomada).

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — Zod, Prisma 7

**Storage**: PostgreSQL vía Prisma — 3 tablas nuevas (`MetodoEntregaConfig`, `ZonaCobertura`, `UbicacionRetiro`), 3 columnas nuevas en `Cotizacion` y `Pedido` (`generadoPorIA`, `confirmadoPorHumano`, `confirmadoPorUsuarioId`) y 1 columna nueva en `AgenteIAConfig` (`accionesComercialesModoBorrador`)

**Testing**: Vitest para cada tool nueva (disponibilidad, precio, promociones, validar combinación, métodos de entrega, costo de envío, cobertura, fecha estimada, ubicaciones de retiro) y para el enforcement del modo de confirmación en `crear_cotizacion`/`crear_pedido`

**Target Platform**: Web — `src/ai/tools/providers/`, nuevo módulo `src/configuracion/entregas/` para la configuración de métodos/zonas/ubicaciones

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: N/A — todas las tools son lecturas puntuales o escrituras simples ya del mismo orden de magnitud que las tools existentes

**Constraints**: FR-016/SC-003 (retrocompatibilidad del modo de creación directa) es la restricción más estricta — `accionesComercialesModoBorrador` debe ser `false` por default en la migración para cualquier agente existente, sin excepción

**Scale/Scope**: ~9 tools nuevas + 1 módulo de configuración nuevo + cambios mínimos y aditivos en `Cotizacion`/`Pedido`/`AgenteIAConfig`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — las tools nuevas viven en `src/ai/tools/providers/` ya existente, siguiendo el patrón `IProveedorTool` sin excepción; la configuración de métodos de entrega es un módulo nuevo (`src/configuracion/entregas/`) análogo a `src/configuracion/ia/`, no mezclado con el dominio de Sales existente. |
| II. Server-Enforced Business Rules | PASS — toda tool valida y calcula server-side; `agregar_productos_a_oportunidad` reutiliza las validaciones ya existentes del caso de uso de Sales para esa operación (no las reimplementa). |
| III. Reliable Data and Events | PASS — sin transacciones complejas nuevas; marcar `generadoPorIA`/`confirmadoPorHumano` es parte del mismo `create` ya existente en `crear-cotizacion.tool.ts`/`crear-pedido.tool.ts`, sin pasos adicionales. |
| IV. Replaceable Integrations | PASS — ninguna tool nueva depende de un proveedor de IA concreto; siguen el mismo contrato `IProveedorTool` ya independiente de proveedor. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — cada tool nueva valida `instanciaId` desde `ContextoTool` (nunca de los argumentos del LLM, mismo patrón que las 7 tools existentes); tests unitarios por tool, proporcional al riesgo (mayor en las dos que escriben: `crear_cotizacion`/`crear_pedido` modificadas). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` agrega 3 tablas de configuración con `instanciaId` y 4 columnas aditivas en tablas existentes, todas con default que preserva el comportamiento actual. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/015-herramientas-operativas-inventario-envios-acciones/
├── plan.md              # This file
├── research.md          # Phase 0 output — shape de MetodoEntregaConfig/ZonaCobertura, criterio de "combinación válida"
├── data-model.md        # Phase 1 output — tablas nuevas + columnas aditivas
├── contracts/           # Phase 1 output — contrato de cada tool nueva
└── quickstart.md        # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                                  # MetodoEntregaConfig, ZonaCobertura, UbicacionRetiro (nuevos);
                                                     # Cotizacion/Pedido.generadoPorIA/confirmadoPorHumano/
                                                     # confirmadoPorUsuarioId; AgenteIAConfig.accionesComercialesModoBorrador

src/
├── ai/
│   └── tools/
│       └── providers/
│           ├── consultar-disponibilidad.tool.ts    # FR-001
│           ├── consultar-precio-actual.tool.ts      # FR-002
│           ├── consultar-promociones.tool.ts        # FR-003 (siempre "sin promociones" por ahora)
│           ├── validar-combinacion-productos.tool.ts# FR-004
│           ├── obtener-metodos-entrega.tool.ts       # FR-007
│           ├── calcular-costo-envio.tool.ts          # FR-007
│           ├── estimar-fecha-entrega.tool.ts         # FR-007
│           ├── validar-cobertura.tool.ts             # FR-007
│           ├── obtener-ubicaciones-retiro.tool.ts    # FR-007
│           ├── agregar-productos-oportunidad.tool.ts # FR-012
│           ├── crear-cotizacion.tool.ts              # MODIFICADO — FR-009, FR-010
│           └── crear-pedido.tool.ts                  # MODIFICADO (ya existe, confirmado) — FR-009, FR-010
│
└── configuracion/
    └── entregas/                                    # NUEVO módulo — configuración de métodos/zonas/ubicaciones
        ├── schema.ts
        ├── actions.ts
        ├── queries.ts
        └── components/
            └── seccion-metodos-entrega.tsx
```

**Structure Decision**: Todas las tools nuevas son archivos nuevos en `src/ai/tools/providers/`, mismo patrón exacto que las 7 existentes — cero refactor de `ToolRegistry`/`executor.ts`. La configuración de métodos de entrega es el único módulo nuevo de UI, separado de `src/sales/` para no acoplar la configuración de IA/agente a los módulos de dominio de ventas (Constitution I).

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
