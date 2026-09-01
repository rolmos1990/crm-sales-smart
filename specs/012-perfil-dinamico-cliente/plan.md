# Implementation Plan: Perfil dinámico del cliente

**Branch**: `012-perfil-dinamico-cliente` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-perfil-dinamico-cliente/spec.md`

## Summary

No existe perfil de cliente hoy — los datos objetivos que necesita (pedidos, oportunidades, cotizaciones, clasificación de conversación) ya están en el schema pero nunca se agregan en una sola vista; los datos interpretados (presupuesto, ocasión, productos consultados, preferencias) no existen como dato estructurado y requieren extracción de IA sobre el contenido de la conversación. El enfoque: (1) `PerfilClienteSnapshot` como cache persistente por contacto, con dos bloques (`datosObjetivos`, `datosInterpretados`) más `senalesObjetivas: string[]` en lenguaje natural sin adjetivos; (2) `PerfilClienteService.calcular(contactoId)` que arma `datosObjetivos` con queries Prisma agregadas (reutilizando el mismo criterio de "oportunidad activa" que ya usa `customer.tool.ts`) y dispara la extracción de IA (`TareaIA.EXTRACCION_ENTIDADES`, ya enrutable a un proveedor económico por `010`) para `datosInterpretados`, tolerando su fallo; (3) invalidación incremental suscrita a los eventos de dominio ya existentes vía RabbitMQ (mismo patrón que `src/suscriptores/`), en vez de recalcular en cada mensaje.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — Prisma 7 (queries agregadas), RabbitMQ ya integrado (`src/shared/rabbitmq/`), el gateway de IA ya existente (`src/ai/gateway/`) para la extracción interpretada

**Storage**: PostgreSQL vía Prisma — 1 tabla nueva (`PerfilClienteSnapshot`); sin cambios a tablas existentes (todos los datos objetivos se leen, no se escriben, de `Pedido`/`Oportunidad`/`Cotizacion`/`Conversacion`)

**Testing**: Vitest para el cálculo de `datosObjetivos` (dado un set de pedidos/oportunidades/cotizaciones/conversaciones de prueba, el perfil calculado es el esperado) y para la clasificación de `tipoRelacion`; test de integración para la invalidación por evento (mock del consumidor RabbitMQ)

**Target Platform**: Web — nuevo módulo `src/ai/perfil-cliente/`

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: cálculo de `datosObjetivos` en una sola ronda de queries agregadas (no N+1); la extracción interpretada usa el modelo económico ya enrutado por `010`, sin bloquear la lectura del perfil si tarda o falla (FR-007)

**Constraints**: FR-006 — ningún mensaje entrante por sí solo dispara un recálculo completo; solo los eventos de dominio ya existentes lo hacen (lista cerrada en `research.md`). FR-003 — la generación de `senalesObjetivas` usa plantillas de texto parametrizadas, no un LLM, para garantizar ausencia de adjetivos subjetivos por diseño (no por instrucción a un modelo que podría no cumplirla)

**Scale/Scope**: 1 tabla nueva, 1 módulo nuevo, N consumidores RabbitMQ nuevos (uno por tipo de evento relevante, reutilizando `ConsumidorBase` ya existente)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — `src/ai/perfil-cliente/` es un módulo nuevo dentro del dominio de IA ya existente; lee de otros módulos (Sales, CRM) solo a través de sus queries/eventos ya expuestos, sin importar entre slices directamente (Constitution I / regla VSA del proyecto: comunicación por eventos). |
| II. Server-Enforced Business Rules | PASS — el cálculo del perfil corre enteramente server-side; ninguna clasificación de tipo de relación o intención se decide en el cliente. |
| III. Reliable Data and Events | PASS — la actualización incremental usa los eventos de dominio y RabbitMQ ya existentes (idempotente: recalcular dos veces el mismo perfil ante un evento duplicado no corrompe nada, es una operación de reemplazo total del snapshot). La extracción de IA es un side effect que corre después de calcular los datos objetivos, tolerante a fallo (FR-007). |
| IV. Replaceable Integrations | PASS — la extracción interpretada pasa por el gateway de IA ya existente (`generarRespuesta` con `tarea: "EXTRACCION_ENTIDADES"`), sin acoplarse a un proveedor concreto. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — `PerfilClienteSnapshot` lleva `instanciaId` indexado; toda query de cálculo filtra por `instanciaId` del contacto (FR-008); tests unitarios sobre el cálculo objetivo (lógica de negocio pura) e integración sobre la invalidación por evento. |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` agrega una única tabla de cache, sin relaciones nuevas hacia módulos de Sales/CRM más allá de lecturas ya permitidas. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/012-perfil-dinamico-cliente/
├── plan.md              # This file
├── research.md          # Phase 0 output — criterio de tipoRelacion/intención, lista cerrada de eventos relevantes
├── data-model.md        # Phase 1 output — PerfilClienteSnapshot
├── contracts/           # Phase 1 output — PerfilClienteService + contrato de extracción interpretada
└── quickstart.md        # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                          # PerfilClienteSnapshot (nuevo)

src/
└── ai/
    └── perfil-cliente/                    # NUEVO módulo
        ├── tipos.ts                       # PerfilCliente, DatosObjetivos, DatosInterpretados
        ├── calculo-objetivo.ts            # FR-001, FR-009 — queries agregadas + clasificación tipoRelacion
        ├── senales.ts                     # FR-003 — generación de senalesObjetivas por plantilla (sin IA)
        ├── extraccion-interpretada.ts     # FR-002, FR-007 — llama al gateway con TareaIA.EXTRACCION_ENTIDADES
        ├── servicio.ts                    # PerfilClienteService.obtenerPerfil/recalcular (orquesta lo anterior)
        ├── queries.ts                     # lectura del snapshot vigente, scoped a instancia (FR-004, FR-008)
        └── suscriptores/
            └── invalidar-perfil.suscriptor.ts  # FR-005, FR-006 — consumidor RabbitMQ de eventos relevantes
```

**Structure Decision**: Módulo nuevo `src/ai/perfil-cliente/`, análogo en estructura a `src/ai/estrategia/` de `011`. No se modifica ningún módulo de Sales/CRM existente — el perfil los consulta solo por lectura (queries agregadas) y se suscribe a sus eventos ya publicados, respetando la regla VSA del proyecto de no importar entre slices salvo por eventos.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
