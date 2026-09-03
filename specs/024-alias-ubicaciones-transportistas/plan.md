# Implementation Plan: Alias y match de ubicaciones para transportistas

**Branch**: `024-alias-ubicaciones-transportistas` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/024-alias-ubicaciones-transportistas/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Agregar alias y normalización de texto sobre el catálogo de destinos ya existente (`ZonaEntregaUbicacion`) para que el matching de ubicaciones tolere variantes coloquiales, abreviaturas y errores ortográficos leves, con niveles de confianza explícitos (exacta/alias/probable/ambigua/sin coincidencia). Sobre esa base, implementar la tool de IA `consultar_opciones_envio` (documentada en spec 022, nunca construida) para que la IA pueda comparar opciones de envío sin escalar a un humano salvo ambigüedad real, y un flujo de importación CSV/Excel de destinos con revisión previa. El enfoque técnico es **extender**, no reemplazar, el modelo de zonas/tarifas mergeado hoy por las specs 022/023 — y, por pedido explícito del usuario, esta pasada también audita y limpia el código muerto que haya quedado de esos refactors recientes en el dominio de transportistas (ver `research.md`, sección de auditoría de código muerto).

## Technical Context

**Language/Version**: TypeScript 5 (estricto, sin `any`), Next.js 16.2 App Router, Node.js 20+

**Primary Dependencies**: Prisma 7 (PostgreSQL), Zod v4 + React Hook Form, TanStack Query v5, shadcn/ui (Radix/Base UI), `papaparse`/`xlsx` (ya en `package.json`, reutilizados para el import de destinos)

**Storage**: PostgreSQL vía Prisma — extiende el modelo ya mergeado (`Transportista`, `ZonaEntrega`, `ZonaEntregaUbicacion`, `TarifaTransportistaZona`, `ServicioTransportista`, `CondicionesTransportista`); agrega columnas a `ZonaEntregaUbicacion` y un modelo nuevo `AliasUbicacion`

**Testing**: Vitest (unit — motor de matching, normalización, similitud, backfill), Playwright (e2e — flujo de alias y de importación en `tests/e2e/sales/transportistas.spec.ts`)

**Target Platform**: Web (Next.js Server Components + Server Actions), consumido también por el pipeline de IA (tools de function-calling en `src/ai/tools/`)

**Project Type**: Web application (monolito Next.js con dominio compartido `src/shared/`, sin separación frontend/backend en repos distintos)

**Performance Goals**: El matching (incluida la comparación aproximada) corre sobre el conjunto de `ZonaEntregaUbicacion`/`AliasUbicacion` de una sola instancia (decenas/cientos de filas) por consulta — sin requisito de tiempo real estricto más allá de responder dentro del ciclo normal de generación de una respuesta de IA (segundos, no milisegundos)

**Constraints**: No debe alterar el comportamiento observable de `calcular_costo_envio`/`validar_cobertura`/`estimar_fecha_entrega` (FR-010); la tool de IA nunca debe exponer costo interno, margen, ni datos de contacto interno del transportista (FR-009); toda mutación queda scoped por `instanciaId` (aislamiento de tenant, Constitución V)

**Scale/Scope**: Extiende un módulo ya existente (`src/sales/transportistas/`) — no crea un dominio nuevo. Alcance acotado a alias/normalización/matching/import/tool de IA (ver Assumptions del spec para lo explícitamente fuera de alcance)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| I. Modular Business Architecture | Extiende `src/sales/transportistas/` (módulo existente); la tool de IA vive en `src/ai/tools/providers/` y consume el motor compartido `src/shared/entregas/`, sin que React acceda a Prisma directo. No se introduce un módulo paralelo. | PASS |
| II. Server-Enforced Business Rules | Alias/normalización/unicidad se validan en Server Actions con Zod antes de tocar Prisma; el nivel de confianza y qué campos expone la tool se deciden en el servidor, nunca en el cliente ni delegado al LLM. | PASS |
| III. Reliable Data and Events | La importación corre en transacciones por lotes (mismo patrón que `src/crm/datos/`). No se identifica un evento de dominio nuevo necesario (crear un alias o importar destinos es una operación de catálogo interna, sin consumidores externos vía RabbitMQ) — se documenta la decisión en `research.md` en vez de inventar un evento sin consumidor. | PASS |
| IV. Replaceable Integrations | La tool nueva sigue el contrato `IProveedorTool` ya usado por las demás tools de envío — ningún acoplamiento a un proveedor de IA específico. | PASS |
| V. Security and Quality | `AliasUbicacion` queda scoped por `instanciaId`; costo interno/margen nunca se exponen a la tool de IA (FR-009); se agregan tests unitarios (matching, normalización, similitud, backfill) y se extiende el e2e existente de transportistas. | PASS |

Sin violaciones — no aplica la sección de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/024-alias-ubicaciones-transportistas/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                        # + ZonaEntregaUbicacion.nombreVisible/nombreNormalizado, + modelo AliasUbicacion
└── migrations/                          # 2 migraciones: columnas nullable + tabla nueva; luego NOT NULL de seguimiento

src/shared/lib/
├── slug.ts                              # generarSlug() pasa a ser wrapper de normalizarTexto()
├── normalizar-texto.ts                  # NUEVO — primitiva de normalización genérica
└── similitud-texto.ts                   # NUEVO — Levenshtein/similitud para coincidencia "probable"

src/shared/entregas/
├── resolver-costo-envio.ts              # + obtenerOpcionesEnvioConConfianza(), matching con alias/aproximado
└── normalizar-ubicacion.ts              # NUEVO — normalizarUbicacion() (nombre de dominio sobre normalizar-texto)

src/sales/transportistas/
├── zonas/
│   ├── normalizar.ts                    # NUEVO — construirNombreVisible()/calcularNombreNormalizado()
│   ├── alias-schema.ts                  # NUEVO — Zod para alta de alias
│   ├── alias-actions.ts                 # NUEVO — listar/agregar/eliminar AliasUbicacion
│   ├── actions.ts                       # LIMPIEZA — elimina editarZonaEntrega y listarZonasEntregaAction (código muerto, ver research.md §10.1)
│   ├── actions.test.ts                  # LIMPIEZA — quita los describe() de las funciones eliminadas
│   └── queries.ts                       # LIMPIEZA — elimina obtenerZonaEntrega (código muerto, ver research.md §10.1)
├── importacion-destinos/                # NUEVO namespace — wizard de import CSV/Excel
│   ├── types.ts / schema.ts / queries.ts / actions.ts
│   └── components/ (wizard, pasos)
└── components/
    ├── seccion-zonas-tarifas.tsx        # + entrada a gestión de alias por zona
    └── dialog-alias-ubicacion.tsx       # NUEVO

src/ai/tools/
├── providers/consultar-opciones-envio.tool.ts   # NUEVO — tool de IA
├── constantes.ts                                 # NUEVO — HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES compartida
└── inicializar.ts                                # + registro de la tool nueva

src/suscriptores/ai/generar-respuesta-ia.suscriptor.ts   # fix: unir herramientas "siempre disponibles" a herramientasPermitidas
src/configuracion/components/sheet-editar-agente.tsx      # usa la constante compartida en vez de la lista local

scripts/
└── backfill-normalizar-ubicaciones.ts + .test.ts   # NUEVO — backfill de nombreVisible/nombreNormalizado

tests/
├── (unit, junto a cada módulo, patrón *.test.ts ya usado en el repo — Vitest)
├── sales/transportistas.md              # ACTUALIZAR — agregar casos de país/zonas/tarifas (022/023) y alias/importación (024), ver research.md §10.2
└── e2e/sales/transportistas.spec.ts     # + casos de alias y de importación
```

**Limpieza incluida en este feature** (research.md §10, pedido explícito del usuario): se elimina código muerto confirmado por auditoría (`editarZonaEntrega`, `obtenerZonaEntrega`, `listarZonasEntregaAction` — cero callers reales) como tarea temprana, antes de agregar `AliasUbicacion`, para no mezclar "código nuevo" con "código eliminado" en el mismo diff lógico. Otros hallazgos de la auditoría (`aplicarCambioMasivo`, `CondicionesTransportista`/enum `CONDICIONES`, scripts de backfill de spec 023) se investigaron y **no** se tocan — son historias sin terminar de specs 022/023 ya documentadas, no código muerto (detalle completo en research.md §10.3).

**Structure Decision**: Next.js monolito con dominio compartido (`src/shared/`) — sin separación de repos frontend/backend. Este feature extiende dos módulos ya existentes (`src/sales/transportistas/`, `src/shared/entregas/`, `src/ai/tools/`) en vez de crear un dominio nuevo, siguiendo el principio I de la constitución.

## Constitution Check — re-evaluación post-diseño (Fase 1)

Sin cambios respecto a la evaluación inicial (todas PASS). El diseño detallado de Fase 1 confirma en particular el Principio I: la limpieza de código muerto (research.md §10) elimina abstracciones sin uso en vez de sumar una paralela, y ningún artefacto de `data-model.md`/`contracts/` introduce un módulo nuevo fuera de los tres ya extendidos (`src/sales/transportistas/`, `src/shared/entregas/`, `src/ai/tools/`).

## Complexity Tracking

*No aplica — el Constitution Check (inicial y post-diseño) no registró violaciones.*
