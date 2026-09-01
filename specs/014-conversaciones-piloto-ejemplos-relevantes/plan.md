# Implementation Plan: Conversaciones piloto y recuperación de ejemplos relevantes

**Branch**: `014-conversaciones-piloto-ejemplos-relevantes` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-conversaciones-piloto-ejemplos-relevantes/spec.md`

## Summary

Capacidad nueva de punta a punta: no hay few-shot ni análisis de conversaciones hoy. El enfoque: `ConversacionPiloto` referencia una `Conversacion` real con contenido anonimizado copiado aparte (nunca se anonimiza ni modifica la conversación original); un proceso de análisis (`AnalizadorPiloto`, usando el gateway de IA ya existente con `TareaIA.REPORTE` o `CLASIFICACION`) produce `RecomendacionComportamiento` en estado pendiente; el administrador actúa sobre cada una (aprobar/rechazar/convertir); convertir en ejemplo crea `EjemploPrompt`. La recuperación (`RecuperadorEjemplos`) es una función con interfaz estable que hoy filtra por etiquetas estructuradas y mañana puede delegar en similitud semántica sin que el context builder de `013` note la diferencia — completa la capa 9 que esa spec dejó reservada.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — Zod, Prisma 7, el gateway de IA ya existente; reutiliza `TipoRelacionCliente`/`IntencionComercial` de `011`

**Storage**: PostgreSQL vía Prisma — 3 tablas nuevas: `ConversacionPiloto`, `RecomendacionComportamiento`, `EjemploPrompt`

**Testing**: Vitest para `RecuperadorEjemplos` (dado un conjunto de ejemplos con etiquetas variadas, devuelve entre 2 y 4 relevantes, nunca de otro tenant/agente) y para la función de anonimización (sustitución determinística de nombre/email/teléfono conocidos)

**Target Platform**: Web — nuevo módulo `src/ai/piloto/`

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: la recuperación de ejemplos (FR-010) corre en el camino de generación de respuesta — debe resolverse con una query filtrada y en memoria sobre un conjunto acotado (no cientos de ejemplos por agente en la práctica), sin necesitar un índice vectorial en esta fase

**Constraints**: FR-004 (anonimización) se aplica sobre una copia del contenido, nunca sobre `Mensaje`/`Conversacion` originales — la conversación real de Karia no se modifica jamás por esta funcionalidad; FR-008 (ninguna escritura automática a la config publicada del agente) se garantiza por diseño: "convertir en regla" es una acción de UI que redirige al flujo ya existente y validado de `009`, no una escritura directa desde este módulo

**Scale/Scope**: módulo nuevo (`src/ai/piloto/`), 3 tablas Prisma, una función productora nueva para la capa 9 de `013`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — `src/ai/piloto/` es un módulo nuevo dentro del dominio de IA; lee `Conversacion`/`Mensaje` solo por sus queries ya expuestas, sin acoplarse al módulo de conversaciones más allá de eso. |
| II. Server-Enforced Business Rules | PASS — anonimización, aprobación/rechazo de recomendaciones y conversión a regla/ejemplo son Server Actions explícitas; ninguna se decide en el cliente. |
| III. Reliable Data and Events | PASS — el análisis es una operación bajo demanda (no un evento reactivo obligatorio); no requiere transacciones complejas más allá de las mutaciones simples de cada entidad. |
| IV. Replaceable Integrations | PASS — el análisis usa el gateway de IA ya existente sin acoplarse a un proveedor; `RecuperadorEjemplos` no depende de ningún motor de búsqueda concreto (FR-014). |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — las 3 tablas nuevas llevan `instanciaId` indexado (FR-012); la anonimización se testea explícitamente (riesgo de privacidad, proporcional); no se envían prompts completos ni contenido sin anonimizar a ningún log. |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` agrega 3 tablas con aislamiento por instancia y sin nuevo acoplamiento a proveedores de IA. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/014-conversaciones-piloto-ejemplos-relevantes/
├── plan.md              # This file
├── research.md          # Phase 0 output — estrategia de anonimización, shape de RecuperadorEjemplos
├── data-model.md        # Phase 1 output — ConversacionPiloto, RecomendacionComportamiento, EjemploPrompt
├── contracts/           # Phase 1 output — Server Actions + contrato de RecuperadorEjemplos
└── quickstart.md        # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                          # ConversacionPiloto, RecomendacionComportamiento, EjemploPrompt

src/
└── ai/
    └── piloto/                            # NUEVO módulo
        ├── schema.ts                      # Zod
        ├── anonimizacion.ts               # FR-004 — sustitución determinística nombre/email/teléfono
        ├── actions.ts                     # FR-001..006, FR-009 — CRUD de ConversacionPiloto + acciones sobre recomendaciones
        ├── queries.ts                     # listados scoped a instancia
        ├── analizador.ts                  # FR-007, FR-008 — genera RecomendacionComportamiento (sin auto-aplicar)
        ├── recuperador-ejemplos.ts        # FR-010..014 — completa la capa 9 de 013
        └── components/
            ├── seleccionar-conversacion-piloto.tsx  # Historia 1
            ├── bandeja-recomendaciones.tsx           # Historia 2
            └── (integración en el context builder de 013, no un componente nuevo)
```

**Structure Decision**: Módulo nuevo `src/ai/piloto/`, mismo patrón de carpetas que `src/ai/estrategia/` (`011`) y `src/ai/perfil-cliente/` (`012`). `recuperador-ejemplos.ts` es la única pieza que otra spec ya escrita (`013`) referenciará directamente — se implementa con la firma exacta que su placeholder documenta.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
