# Implementation Plan: Niveles de autonomía y automatización por intención

**Branch**: `016-niveles-autonomia-automatizacion` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-niveles-autonomia-automatizacion/spec.md`

## Summary

`GenerarRespuestaIASuscriptor` hoy siempre envía — no hay ningún gate. El enfoque: introducir `CategoriaIntencionAutonomia` (16 valores fijos del pedido) y `AutonomiaIntencionConfig` (por agente, nivel + condiciones de confianza), sembradas con la clasificación inicial sugerida (segura/supervisada/humana) pero **sin que su sola existencia cambie nada** — el suscriptor solo consulta esta configuración si decide clasificar el mensaje, y la clasificación en sí es una llamada nueva y aislada (`TareaIA.CLASIFICACION`, enrutable por `010`) que, si falla o no está disponible, hace que el suscriptor tome exactamente el camino que toma hoy (enviar). Las respuestas que quedan pendientes se persisten en `RespuestaPendienteRevision`, con una bandeja nueva para que un humano actúe.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencias**: Ninguna nueva — gateway de IA ya existente para la clasificación; opcionalmente `PerfilClienteService` (`012`) para señales de confianza de `ConditionalAutomation`, de forma tolerante a su ausencia

**Storage**: PostgreSQL vía Prisma — 2 tablas nuevas: `AutonomiaIntencionConfig`, `RespuestaPendienteRevision`; 1 enum nuevo: `CategoriaIntencionAutonomia`; 1 enum nuevo: `NivelAutonomia`

**Testing**: Vitest para la función de decisión de gate (dado nivel + clasificación + condiciones → enviar/pendiente/no generar) cubriendo los 4 niveles y los Edge Cases de doble categoría y fallo de clasificación; test de integración sobre el suscriptor modificado

**Target Platform**: Web — `src/ai/autonomia/` (nuevo), `src/suscriptores/ai/generar-respuesta-ia.suscriptor.ts` (modificado)

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: la clasificación agrega una llamada de IA adicional por mensaje solo cuando hay al menos una categoría configurada con un nivel distinto al comportamiento por defecto para ese agente — si el agente no tiene ninguna fila de `AutonomiaIntencionConfig` con nivel restrictivo, el suscriptor MUST omitir la clasificación por completo (no gasta una llamada de IA para nada, ver `research.md` Decisión 3)

**Constraints**: FR-004/SC-001 es la restricción central — el suscriptor debe poder distinguir "nadie configuró nada distinto al default" de "alguien configuró un nivel" sin ambigüedad, y en el primer caso ni siquiera debe intentar clasificar

**Scale/Scope**: módulo nuevo (`src/ai/autonomia/`), 2 tablas + 2 enums, modificación puntual y acotada del suscriptor existente

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — `src/ai/autonomia/` es un módulo nuevo dentro del dominio de IA; el suscriptor existente se modifica de forma acotada (un gate antes de `enviarMensaje`), sin reestructurar su flujo. |
| II. Server-Enforced Business Rules | PASS — la decisión de enviar/retener corre enteramente server-side dentro del suscriptor (que ya corre sin sesión de usuario, en cola); nunca se decide en un cliente. |
| III. Reliable Data and Events | PASS — persistir `RespuestaPendienteRevision` es una escritura simple adicional dentro del mismo flujo del suscriptor, tolerante a fallo de clasificación (se degrada al comportamiento actual, nunca bloquea el mensaje). |
| IV. Replaceable Integrations | PASS — la clasificación usa el gateway de IA ya existente, sin acoplarse a un proveedor. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — `AutonomiaIntencionConfig`/`RespuestaPendienteRevision` llevan `instanciaId`/`agenteIAConfigId` con aislamiento; tests unitarios sobre la función de decisión (lógica de negocio de alto riesgo — decide si algo se envía a un cliente real, tratado con la seriedad que corresponde). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` agrega 2 tablas con default que preserva el comportamiento actual (ausencia de fila = comportamiento previo). Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/016-niveles-autonomia-automatizacion/
├── plan.md              # This file
├── research.md          # Phase 0 output — catálogo de categorías, condiciones de confianza, criterio de doble categoría
├── data-model.md        # Phase 1 output — AutonomiaIntencionConfig, RespuestaPendienteRevision
├── contracts/           # Phase 1 output — función de decisión de gate + Server Actions de la bandeja
└── quickstart.md        # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                          # CategoriaIntencionAutonomia, NivelAutonomia (enums),
                                             # AutonomiaIntencionConfig, RespuestaPendienteRevision
prisma/
└── seed.ts                                # extendido: siembra la clasificación inicial (research.md Decisión 1)

src/
├── ai/
│   └── autonomia/                         # NUEVO módulo
│       ├── tipos.ts                       # CategoriaIntencionAutonomia, NivelAutonomia (tipos de aplicación)
│       ├── clasificador.ts                # FR-005 — clasifica un mensaje en una categoría, tolerante a fallo
│       ├── gate.ts                        # FR-006..010 — decidirAutonomia(nivel, clasificacion, condiciones)
│       ├── schema.ts / actions.ts / queries.ts  # gestión de AutonomiaIntencionConfig
│       └── components/
│           └── seccion-automatizacion.tsx # Historia 1
│
└── suscriptores/
    └── ai/
        └── generar-respuesta-ia.suscriptor.ts  # MODIFICADO — inserta el gate antes de enviarMensaje
```

**Structure Decision**: Módulo nuevo `src/ai/autonomia/`, mismo patrón de carpetas que `011`/`012`/`014`. La única modificación de un archivo existente fuera de ese módulo es el suscriptor de generación de respuesta, y es puntual (un `if` de gate antes de `enviarMensaje`, con fallback explícito al comportamiento actual).

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
