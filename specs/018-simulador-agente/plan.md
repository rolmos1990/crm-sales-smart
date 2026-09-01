# Implementation Plan: Simulador de agente y experiencia de configuración consolidada

**Branch**: `018-simulador-agente` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-simulador-agente/spec.md`

## Summary

Todas las piezas del pipeline ya existen tras `009`-`017`; falta ejercitarlas bajo demanda sin efectos reales. El enfoque: agregar un `modoSimulacion: boolean` a `ContextoTool` (propagado desde un nuevo `SimuladorService.ejecutar(...)` que arma un `InsumosContexto` con datos simulados en vez de reales para cliente/perfil), de forma que las tools que escriben (`crear_cotizacion`, `crear_pedido`, `agregar_productos_oportunidad`, `transferir_a_humano`, `actualizar_info_contacto`, `agregar_etiqueta_contacto`) verifiquen ese flag al inicio y devuelvan una previsualización con la misma forma de `ResultadoTool` sin tocar Prisma; las tools de solo lectura (`buscar_productos`, `consultar_disponibilidad`, etc.) ignoran el flag y consultan datos reales sin problema (Assumption de la spec). El simulador reutiliza `construirContextoCompuesto` (`013`) pasándole un perfil de cliente simulado en vez de uno calculado por `012`, y expone todo el diagnóstico ya disponible en `ContextoCompuesto`/`DecisionAutonomia`/`ResultadoSeleccion` sin persistirlo en las tablas de auditoría de `017`. La navegación consolidada (Historia 4) es un refactor de layout sobre las sub-secciones ya construidas por cada spec anterior.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — reutiliza `009`–`017` en su totalidad

**Storage**: PostgreSQL vía Prisma — sin tablas nuevas persistentes de producción; opcionalmente una tabla ligera `SimulacionEjecutada` para conservar el historial de sesiones de simulación del propio administrador (no mezclado con `UsoIA`/`RespuestaPendienteRevision` reales)

**Testing**: Vitest para el flag `modoSimulacion` en cada tool que escribe (confirma que ninguna ejecuta un `prisma.create`/`update`/`delete` real cuando está activo) y para `SimuladorService.ejecutar` (arma el escenario simulado correctamente); un test Playwright smoke para el flujo de la pantalla (Constitution V — proporcional al riesgo de una pantalla nueva de configuración, no un flujo crítico de cliente)

**Target Platform**: Web — nuevo módulo `src/ai/simulador/`, nueva ruta `/configuracion/ia/simulador` (o sub-sección dentro de la tab IA reorganizada)

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: N/A — mismo costo que una generación de respuesta real (una llamada de IA), sin llamadas adicionales significativas

**Constraints**: FR-006/FR-007/SC-002/SC-003 son las restricciones no negociables — cualquier tool que escriba datos MUST verificar `modoSimulacion` como primera línea de su `execute`, antes de cualquier `prisma.create`/`update`; un test explícito por tool lo verifica, no solo una revisión manual

**Scale/Scope**: 1 módulo nuevo (`src/ai/simulador/`), modificación puntual (agregar el chequeo de flag) en 6 tools existentes, 1 refactor de navegación de la tab IA

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — `src/ai/simulador/` es un módulo nuevo que orquesta módulos ya existentes por su interfaz pública; no accede a Prisma de otros dominios directamente. |
| II. Server-Enforced Business Rules | PASS — el modo simulación se decide y aplica enteramente server-side, dentro de cada tool; el cliente no puede forzar `modoSimulacion: false` sobre una llamada que el servidor marcó como simulación. |
| III. Reliable Data and Events | PASS — ninguna simulación publica eventos de dominio reales (`PedidoCreado`, etc.) — las tools en modo simulación retornan antes de cualquier `prisma.create`, por lo que tampoco disparan los suscriptores que reaccionan a esos eventos. |
| IV. Replaceable Integrations | PASS — el simulador usa el mismo gateway de IA agnóstico de proveedor ya existente. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — tests explícitos por cada tool que escribe, verificando ausencia de escritura real en modo simulación (el riesgo más alto de esta spec); `SimulacionEjecutada` (si se implementa) lleva `instanciaId`. |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` no agrega ninguna tabla obligatoria a los flujos de producción — la única tabla opcional es de uso exclusivo del propio simulador. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/018-simulador-agente/
├── plan.md              # This file
├── research.md          # Phase 0 output — diseño de modoSimulacion, qué se omite si una spec previa falta
├── data-model.md         # Phase 1 output — ContextoTool extendido, SimulacionEjecutada (opcional)
├── contracts/            # Phase 1 output — SimuladorService + contrato de modoSimulacion por tool
└── quickstart.md         # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                          # SimulacionEjecutada (opcional, ver research.md)

src/
├── ai/
│   ├── tools/
│   │   └── types.ts                       # ContextoTool gana modoSimulacion?: boolean
│   ├── tools/providers/
│   │   ├── crear-cotizacion.tool.ts        # + chequeo modoSimulacion al inicio de execute
│   │   ├── crear-pedido.tool.ts            # ídem
│   │   ├── agregar-productos-oportunidad.tool.ts  # ídem (015)
│   │   ├── transferir-a-humano.tool.ts     # ídem
│   │   ├── actualizar-info-contacto.tool.ts # ídem
│   │   └── agregar-etiqueta-contacto.tool.ts # ídem
│   └── simulador/                          # NUEVO módulo
│       ├── tipos.ts                        # EscenarioSimulacion, DiagnosticoRespuestaSimulada
│       ├── servicio.ts                     # ejecutar(escenario) — orquesta 010-016 con datos simulados
│       └── components/
│           ├── panel-simulador.tsx         # Historia 1, 2, 3
│           └── comparador-versiones.tsx    # Historia 3
│
└── app/
    └── configuracion/
        └── ia/                             # reorganización de navegación (Historia 4) — 10 secciones
```

**Structure Decision**: Módulo nuevo `src/ai/simulador/`, mismo patrón que el resto de `src/ai/`. Las modificaciones a tools existentes son mínimas y uniformes (una guarda al inicio de `execute`). La reorganización de navegación es la única tarea puramente de UI/routing, sin lógica de negocio nueva.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
