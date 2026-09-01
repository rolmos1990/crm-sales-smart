# Implementation Plan: Construcción del contexto de IA por capas con precedencia

**Branch**: `013-context-builder-capas-precedencia` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-context-builder-capas-precedencia/spec.md`

## Summary

`construirSystemPrompt` (`009`) ya compone capas de forma procedural; `011` (selector de estrategia) y `012` (perfil de cliente) ya producen contenido que hoy no llega al prompt real. El enfoque: introducir un tipo `CapaContexto` explícito (nombre, precedencia, función productora) y una lista ordenada fija de 11 capas en un nuevo `src/ai/contexto/context-builder.ts`, que **reemplaza internamente** la implementación de `construirSystemPrompt`/`construirContexto` sin cambiar su firma pública externa (los mismos consumidores — suscriptor, `actions-ia.ts` — siguen llamando a las mismas funciones exportadas). Las capas de identidad/reglas (`009`), estrategia (`011`) y perfil (`012`) se conectan aquí por primera vez a un flujo real; las de ejemplos piloto e información operativa quedan como funciones productoras que siempre devuelven vacío, documentadas y listas para que `014`/`015` las reemplacen sin tocar el resto de la lista.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — consume `src/ai/estrategia/` (`011`) y `src/ai/perfil-cliente/` (`012`) ya existentes tras esas specs

**Storage**: N/A — no agrega tablas; lee de las ya creadas por `009`/`011`/`012`

**Testing**: Vitest para el orden de precedencia (dado un conjunto de capas con contenido simulado, el resultado respeta el orden fijo) y para la retrocompatibilidad exacta (mismo input que antes de la spec → mismo output textual)

**Target Platform**: Web — `src/ai/contexto/`, `src/ai/prompt/`

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: sin llamadas nuevas de red en el camino crítico — el perfil de cliente (`012`) y la estrategia (`011`) se leen de sus snapshots/queries ya calculados de forma asíncrona por eventos, nunca se recalculan de forma síncrona dentro de la generación de una respuesta

**Constraints**: SC-001 (retrocompatibilidad textual exacta) es la restricción más estricta de esta spec — cualquier capa nueva (estrategia, perfil) debe quedar realmente vacía cuando no hay datos, no con un texto de relleno, para no alterar el prompt de agentes que aún no usan `011`/`012`

**Scale/Scope**: refactor interno de `src/ai/contexto/constructor.ts` y `src/ai/prompt/builder.ts`, sin cambios de schema

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — el context builder vive en `src/ai/contexto/` ya existente; consume `src/ai/estrategia/` y `src/ai/perfil-cliente/` por su interfaz pública (queries/servicio), sin acceder a sus tablas Prisma directamente. |
| II. Server-Enforced Business Rules | PASS — la composición del prompt sigue ocurriendo enteramente server-side; FR-006 (regla obligatoria siempre prevalece) se garantiza por posición fija en el array de capas, no por instrucción esperando que el modelo la respete. |
| III. Reliable Data and Events | PASS — ninguna capa nueva introduce una operación síncrona bloqueante nueva; perfil y estrategia se leen ya calculados (side effects de `011`/`012` corridos antes, de forma asíncrona). |
| IV. Replaceable Integrations | PASS — el context builder no conoce proveedores de IA; produce texto plano consumido igual por cualquier `IProveedorIA`. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — no se introduce ninguna query nueva sin scope de instancia (se reutilizan las ya validadas de `011`/`012`); tests de regresión textual exacta cubren el riesgo principal (romper prompts en producción). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` no agrega entidades — es puramente de composición en memoria sobre datos ya modelados. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/013-context-builder-capas-precedencia/
├── plan.md              # This file
├── research.md          # Phase 0 output — mapeo capa→fuente de datos, estrategia de retrocompatibilidad
├── data-model.md        # Phase 1 output — CapaContexto, ContextoCompuesto (tipos en memoria, sin Prisma)
├── contracts/           # Phase 1 output — contrato de construirContextoCompuesto
└── quickstart.md        # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
src/
└── ai/
    ├── contexto/
    │   ├── context-builder.ts             # NUEVO — CapaContexto[], construirContextoCompuesto(...)
    │   ├── capas/                          # NUEVO — una función productora por capa
    │   │   ├── politicas-seguridad.ts      # capa 1 — el bloque fijo anti prompt-injection ya existente
    │   │   ├── identidad-agente.ts         # capa 2 — delega en lo ya construido por 009 (rol/comunicación)
    │   │   ├── reglas-negocio.ts           # capa 3 — reglas obligatorias + estructuradas de 009
    │   │   ├── estrategia-activa.ts        # capa 4 — NUEVO — invoca seleccionarEstrategia (011) + registra selección
    │   │   ├── perfil-cliente.ts           # capa 5 — NUEVO — invoca PerfilClienteService.obtenerPerfil (012)
    │   │   ├── estado-conversacion.ts      # capa 6 — mensajes recientes, ya existente en constructor.ts
    │   │   ├── datos-conocidos-faltantes.ts# capa 7 — placeholder documentado (sin fuente real todavía)
    │   │   ├── info-operativa.ts           # capa 8 — placeholder documentado (fuente real: spec 015)
    │   │   ├── ejemplos-piloto.ts          # capa 9 — placeholder documentado (fuente real: spec 014)
    │   │   ├── herramientas-permitidas.ts  # capa 10 — formaliza la lista ya usada por ejecutarHerramienta
    │   │   └── instruccion-final.ts        # capa 11 — la instrucción final ya existente ("Redacta la...")
    │   └── constructor.ts                  # se reescribe para delegar en context-builder.ts, misma firma pública
    └── prompt/
        └── builder.ts                      # construirSystemPrompt pasa a ser un caso particular de
                                             # construirContextoCompuesto (capas 1-3 + 11), sin romper su firma
```

**Structure Decision**: Se crea `src/ai/contexto/capas/` como la única carpeta nueva — cada capa es una función pura y pequeña, testeable en aislamiento, que `context-builder.ts` invoca en el orden fijo de `research.md`. Ni `construirSystemPrompt` ni `construirContexto` cambian su firma pública — sus consumidores actuales (`generar-respuesta-ia.suscriptor.ts`, `actions-ia.ts`, `gateway.ts`) no requieren ningún cambio.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
