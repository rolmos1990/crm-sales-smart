# Implementation Plan: Playbooks de estrategia comercial y selección explicable

**Branch**: `011-playbook-estrategia-comercial` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-playbook-estrategia-comercial/spec.md`

## Summary

No existe hoy ningún concepto de estrategia comercial en Karia — es una entidad nueva de punta a punta. El enfoque: modelar `PlaybookEstrategia` como entidad independiente de `AgenteIAConfig` (relación N:M vía `AgentePlaybookAsignacion`), sembrar las 7 plantillas del pedido como datos semilla (seed) inactivos por instancia, y construir un `SelectorEstrategia` puro (sin efectos secundarios, fácil de testear) que recibe señales opcionales de tipo de cliente/intención y devuelve la estrategia ganadora + motivo, registrado en una tabla de auditoría nueva. El selector se integra al flujo de generación como un paso adicional antes de construir el prompt, pero no reemplaza ni modifica `construirSystemPrompt` de `009` en esta spec — solo deja el resultado (contenido de la estrategia + motivo) disponible para que `013-context-builder-capas-precedencia` lo incorpore como capa. Contenido de la estrategia representado como texto estructurado (lista de reglas), nunca como configuración específica de un proveedor de IA.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — Zod, Prisma 7, `@dnd-kit` ya disponible en el proyecto si se requiere reordenar prioridad por arrastre (opcional, no obligatorio — un campo numérico de prioridad con inputs alcanza para el alcance de esta spec)

**Storage**: PostgreSQL vía Prisma — 3 tablas nuevas: `PlaybookEstrategia`, `AgentePlaybookAsignacion`, `SeleccionEstrategiaLog`; seed de las 7 plantillas vía `prisma/seed.ts` (extendido, no reemplazado)

**Testing**: Vitest para `SelectorEstrategia` (función pura: dado agente + señales → estrategia + motivo) cubriendo los edge cases de la spec (empate por prioridad, sin coincidencia, sin señales)

**Target Platform**: Web — nuevo módulo `src/ai/estrategia/`, nueva sección en `src/configuracion/ia/`

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: N/A — selección en memoria sobre estrategias ya cargadas (pocas decenas por agente como máximo), sin impacto de latencia relevante en el flujo de generación

**Constraints**: FR-013 (regla obligatoria del agente siempre prevalece) se garantiza por diseño: el selector solo produce contenido para una capa que `013` insertará *después* de las reglas obligatorias del agente en el orden de precedencia — esta spec no reordena nada de `009`, solo prepara el insumo

**Scale/Scope**: Módulo nuevo (`src/ai/estrategia/`), sección nueva de UI, 3 tablas Prisma, seed extendido

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — se crea `src/ai/estrategia/` como módulo propio dentro del dominio de IA ya existente, siguiendo el mismo patrón de carpetas (`actions.ts`, `queries.ts`, `schema.ts`) que el resto del proyecto; no depende de `src/configuracion/ia/` ni al revés más allá de una relación de datos explícita. |
| II. Server-Enforced Business Rules | PASS — activar/desactivar/asignar/priorizar son Server Actions con Zod; la selección de estrategia ocurre server-side dentro del flujo de generación, nunca decidida por el cliente. |
| III. Reliable Data and Events | PASS — no requiere eventos ni colas nuevas; el registro de selección (`SeleccionEstrategiaLog`) se escribe de forma síncrona junto con la generación, tolerando que la escritura del log no bloquee la respuesta al cliente si falla (se registra el error, no se aborta la generación). |
| IV. Replaceable Integrations | PASS — FR-012 es explícito: el contenido de una estrategia no referencia ningún proveedor de IA; el `SelectorEstrategia` no conoce ni depende de `src/ai/proveedores/`. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — todas las tablas nuevas llevan `instanciaId` con índice; FR-011 (no eliminar estrategia asignada) se aplica server-side; tests unitarios sobre el selector, proporcional al riesgo (lógica de negocio pura, sin I/O). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` agrega 3 tablas, todas con `instanciaId` y relaciones explícitas hacia `AgenteIAConfig` ya existente — ninguna introduce acoplamiento nuevo hacia proveedores de IA. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/011-playbook-estrategia-comercial/
├── plan.md              # This file
├── research.md          # Phase 0 output — modelado de condiciones de aplicación, shape del contenido
├── data-model.md        # Phase 1 output — PlaybookEstrategia, AgentePlaybookAsignacion, SeleccionEstrategiaLog
├── contracts/           # Phase 1 output — Server Actions + contrato del SelectorEstrategia
└── quickstart.md        # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                          # PlaybookEstrategia, AgentePlaybookAsignacion, SeleccionEstrategiaLog
└── seed.ts                                # extendido: siembra las 7 plantillas por instancia (inactivas)

src/
└── ai/
    └── estrategia/                        # NUEVO módulo
        ├── actions.ts                     # activar/desactivar/duplicar/editar/priorizar/asignar (FR-002..006, 010, 011)
        ├── queries.ts                     # listar estrategias, listar asignaciones de un agente
        ├── schema.ts                      # Zod: PlaybookEstrategiaSchema, CondicionAplicacionSchema
        ├── tipos.ts                       # TipoRelacionCliente, IntencionComercial (catálogo compartido, ver research.md)
        ├── selector.ts                    # FR-007..009, FR-013 — función pura seleccionarEstrategia(...)
        └── components/
            ├── lista-estrategias.tsx      # Historia 1 — activar/desactivar/duplicar/editar/priorizar
            └── asignar-estrategias-agente.tsx  # Historia 2 — asignación + condiciones por agente
```

**Structure Decision**: Módulo nuevo `src/ai/estrategia/` (no `src/configuracion/ia/`) porque una estrategia es un concepto de dominio de IA reutilizable, no una preferencia de configuración de un agente puntual — sigue el mismo criterio ya usado para separar `src/ai/tools/` (dominio) de `src/configuracion/ia/` (configuración de un agente/instancia). La UI de gestión sí se expone como una nueva pestaña/sección dentro de la tab "Inteligencia Artificial" de `/configuracion`, reutilizando el layout que `009` ya reorganiza en secciones.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
