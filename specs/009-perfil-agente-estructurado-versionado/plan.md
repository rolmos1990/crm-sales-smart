# Implementation Plan: Perfil estructurado y versionado del agente de IA

**Branch**: `009-perfil-agente-estructurado-versionado` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-perfil-agente-estructurado-versionado/spec.md`

## Summary

`AgenteIAConfig` ya genera su prompt desde campos estructurados (`src/ai/prompt/builder.ts`), pero le faltan las dimensiones de identidad/comunicación/reglas pedidas (nombre del agente, idiomas, longitud de respuesta, proactividad, intensidad comercial, estilo de recomendación, frases/comportamientos prohibidos, reglas personalizadas, condiciones de transferencia) y no tiene versionado — hoy es un `upsert` directo sin historial. El enfoque: (1) agregar los campos nuevos como columnas/JSON opcionales en `AgenteIAConfig` (retrocompatible, sin tocar los ya existentes) y extender `construirSystemPrompt` para componerlos en capas ordenadas; (2) introducir `AgenteIAConfigVersion` como tabla de historial (borrador/publicada), donde `AgenteIAConfig` pasa a representar la versión publicada vigente (denormalizada para no romper a los 6+ consumidores actuales que leen `AgenteIAConfig` directo) y cada `UsoIA` gana `agenteIAConfigVersionId` para trazabilidad; (3) reorganizar la tab "Inteligencia Artificial" en sub-secciones reutilizando `<Form>`/`<FormField>` ya existentes.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — Zod (schemas), Prisma 7 (nuevas tablas/columnas), React Hook Form (formularios), shadcn/ui (Tabs/Accordion para sub-secciones)

**Storage**: PostgreSQL vía Prisma — migración aditiva: columnas nuevas en `AgenteIAConfig`, tabla nueva `AgenteIAConfigVersion`, columna nueva `agenteIAConfigVersionId` (nullable) en `UsoIA`

**Testing**: Vitest para `construirSystemPrompt` extendido (nuevas capas), para el servicio de versionado (publicar/duplicar/restaurar) y para la detección de contradicciones (FR-007); ningún test Playwright nuevo obligatorio (cambio de configuración de back-office, no un flujo crítico de cliente final) pero se agrega uno smoke para la navegación por secciones

**Target Platform**: Web — `src/ai/`, `src/configuracion/ia/`, tab IA de `/configuracion`

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: N/A — sin impacto de latencia en el flujo de generación de respuesta (la resolución de versión publicada es una lectura adicional por `agenteIAConfigId`, ya indexado por ser PK/FK)

**Constraints**: Cero cambio de comportamiento para agentes existentes sin versión publicada explícita (FR-013); ninguna migración destructiva; el prompt generado no puede crecer sin límite — las nuevas capas deben omitirse cuando el campo no está configurado, igual que hace hoy `construirSystemPrompt` con campos vacíos

**Scale/Scope**: Extiende 1 modelo Prisma + agrega 1 modelo nuevo; toca `src/ai/prompt/builder.ts`, `src/configuracion/ia/*`, y los componentes de la tab IA en `src/configuracion/components/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — todo el cambio vive dentro del módulo de IA ya existente (`src/ai/`, `src/configuracion/ia/`); no se crea un módulo paralelo. El versionado se modela como sub-recurso de `AgenteIAConfig`, no como una abstracción nueva desconectada. |
| II. Server-Enforced Business Rules | PASS — validación con Zod en `agente-schema.ts` extendido; publicar/restaurar una versión son use cases explícitos en `agente-actions.ts` (`'use server'`), nunca mutaciones directas desde el cliente. |
| III. Reliable Data and Events | PASS — publicar una versión es una operación transaccional (crear `AgenteIAConfigVersion` + actualizar el puntero "publicada vigente" en la misma transacción Prisma); no depende de eventos ni colas. |
| IV. Replaceable Integrations | PASS — no se toca ningún proveedor de IA; el builder de prompt sigue siendo independiente del proveedor (Anthropic/OpenAI/etc. reciben el mismo string resultante). |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — toda query/mutación sigue scoped a `instanciaId` (igual que hoy `guardarAgenteIA`/`cargarConfigAgenteIA`); no se guardan secretos ni prompts completos en logs nuevos; se agregan tests unitarios proporcionales (builder, versionado, detección de contradicciones). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` agrega una tabla (`AgenteIAConfigVersion`) y columnas nuevas, todas aditivas y con `instanciaId`/aislamiento heredado de `AgenteIAConfig`. No introduce una capa arquitectónica nueva — es un historial del mismo agregado. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/009-perfil-agente-estructurado-versionado/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisiones de modelado del versionado y de las capas de prompt
├── data-model.md        # Phase 1 output — AgenteIAConfig extendido + AgenteIAConfigVersion + UsoIA.agenteIAConfigVersionId
├── contracts/           # Phase 1 output — contratos de los Server Actions nuevos/extendidos
└── quickstart.md        # Phase 1 output — guía de validación manual end-to-end
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                              # FR-001..004, FR-008..012 — columnas nuevas en AgenteIAConfig,
                                                # modelo AgenteIAConfigVersion, UsoIA.agenteIAConfigVersionId

src/
├── ai/
│   ├── prompt/
│   │   └── builder.ts                         # FR-001..006 — nuevas capas (idiomas, comunicación, reglas,
│   │                                           # comportamiento natural fijo) + FR-007 detección de contradicciones
│   ├── contexto/
│   │   └── constructor.ts                     # ajuste menor: resuelve la versión publicada vigente antes de
│   │                                           # llamar a construirSystemPrompt (FR-008, FR-012)
│   └── gateway/
│       └── gateway.ts                         # FR-012 — pasa agenteIAConfigVersionId a registrarUsoIA
│
└── configuracion/
    └── ia/
        ├── agente-schema.ts                   # FR-001..004 — Zod schema extendido (campos nuevos opcionales)
        ├── agente-actions.ts                  # FR-008..011 — guardarBorrador, publicarVersion, duplicarVersion,
        │                                       # restaurarVersion, listarVersiones
        ├── agente-queries.ts                  # lectura de versión publicada vigente + historial
        └── components/                        # NUEVO — sub-secciones de la tab IA
            ├── seccion-identidad.tsx           # FR-001
            ├── seccion-comunicacion.tsx        # FR-002
            ├── seccion-reglas.tsx              # FR-003, FR-004
            └── seccion-versiones.tsx           # FR-008..011, historial + duplicar/restaurar

src/configuracion/components/
└── form-agente-ia.tsx                         # (si no existe con este nombre, el form actual del agente) —
                                                # se reestructura para orquestar las 4 sub-secciones anteriores
```

**Structure Decision**: Se extiende el módulo `src/ai/` y `src/configuracion/ia/` ya existentes — sin crear módulos paralelos. La única carpeta nueva es `src/configuracion/ia/components/`, que agrupa las sub-secciones de la UI (Historia 3 de la spec); el resto son extensiones de archivos ya presentes.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
