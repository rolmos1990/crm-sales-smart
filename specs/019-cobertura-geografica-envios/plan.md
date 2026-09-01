# Implementation Plan: Cobertura geográfica y costos de envío por transportista y delivery

**Branch**: `019-cobertura-geografica-envios` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-cobertura-geografica-envios/spec.md`

## Summary

Karia hoy modela el costo de envío por *método de entrega genérico* (`MetodoEntregaConfig`, único por instancia+método) más zonas de texto libre sin estructura geográfica (`ZonaCobertura.nombre`) — el transportista nunca participa en el cálculo de costo, y las tools de IA (`calcular_costo_envio`, `validar_cobertura`, `estimar_fecha_entrega`) hacen match exacto de string sin escalar cuando no encuentran nada. Este plan: (1) agrega un catálogo real de países/estados **con cobertura ISO completa, precargado en base de datos** (no una API externa en runtime — ver research.md Decisión 2) y un modelo de cobertura por transportista (país+estado+costo), expuesto en la UI mediante un Combobox con bandera/nombre/código ISO; (2) extiende el modelo de delivery propio existente con un modo de cobertura (todos lados con excepciones / solo zonas evaluadas) sin romper sus dos columnas ya usadas en producción; (3) hace que las tres tools de envío resuelvan costo/cobertura contra esa configuración real y **fuercen** (no sugieran) la transferencia a humano cuando no hay una única coincidencia clara; (4) agrega un modo geográfico de instancia (un solo país / multipaís) que determina si los formularios de cotización/pedido piden país o no. Todo cambio a modelos existentes es aditivo (columnas nuevas con default, sin renombrar ni quitar nada que ya esté en uso).

## Technical Context

**Language/Version**: TypeScript 5, Next.js 15.5 (App Router), React 19.2

**Primary Dependencies**: Prisma 7 (PostgreSQL), Zod 4, React Hook Form + `@hookform/resolvers/zod`, shadcn/ui (Radix/base-ui, `cmdk` para el Combobox — ya presente), TanStack Query v5 — todas ya presentes en runtime, **sin cambios**. Se agrega **una devDependency** (dataset ISO 3166-1/3166-2 de código abierto, ej. el dataset que respalda `country-state-city`) usada exclusivamente por el script de seed `scripts/seed-geografia.ts` — nunca importada desde código de runtime (research.md Decisiones 2 y 2b)

**Storage**: PostgreSQL vía Prisma — nuevas tablas `Pais`, `EstadoProvincia`, `TransportistaCoberturaGeografica`; columnas nuevas en `Transportista` (relación), `MetodoEntregaConfig`, `ZonaCoberturaMetodo`, `ConfiguracionEmpresa`, `EntregaCotizacion`, `EntregaPedido`

**Testing**: Vitest (unit — patrón ya usado por cada `*.tool.ts` con su `*.test.ts` hermano; la función pura de resolución de costo se testea igual que `gate.ts`/`decidirAutonomia`), Playwright (flujo de configuración de transportista y creación de cotización con selector de país/estado)

**Target Platform**: Web (Next.js server + browser), mismo despliegue actual

**Project Type**: Web application (monolito Next.js con Server Components + Server Actions) — no aplica la distinción frontend/backend separada

**Performance Goals**: Sin objetivo nuevo explícito — la resolución de costo es una consulta Prisma acotada por índices (`transportistaId`, `estadoProvinciaId`), del mismo orden de magnitud que las queries de zona actuales

**Constraints**: Ningún cambio de schema puede alterar el comportamiento de negocios que no adopten la nueva configuración (aditividad estricta — instrucción explícita del usuario: "sin romper o alterar otras áreas")

**Scale/Scope**: Catálogo ISO completo desde el día uno (~195 países + sus estados/provincias, research.md Decisión 2 revisada) — no limitado a los mercados actuales de Karia

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| I. Arquitectura modular por capacidad de negocio | Cumple — el catálogo geográfico y la cobertura de transportista viven en los módulos existentes (`sales/transportistas`, `configuracion/entregas`, `ai/tools`); no se crea un módulo paralelo. Los componentes React no acceden a Prisma directo — pasan por actions/queries. |
| II. Reglas de negocio en el servidor | Cumple — toda validación (FR-007, pertenencia de `estadoProvinciaId` a `paisId`, unicidad de costo por transportista+zona) se valida con Zod + lógica del action antes de tocar Prisma, nunca solo en el cliente. |
| III. Datos y eventos confiables | Cumple — la escalación a humano reutiliza la publicación de evento existente (`ConversacionClasificada`) dentro de una función compartida; no se introduce ningún evento nuevo (no hace falta: el catálogo geográfico no es un evento de dominio, es configuración). Los `upsert` de cobertura son operaciones atómicas simples, sin necesidad de transacción multi-tabla. |
| IV. Integraciones reemplazables / IA no bypassea reglas deterministas | Cumple — es el principio que motiva la Decisión 4 de research.md: la escalación pasa a ser server-enforced dentro de la tool, no queda a criterio del LLM. |
| V. Seguridad y calidad | Cumple — todo query/mutation nuevo se scope por `instanciaId` (transportista, cobertura, configuración geográfica); `Pais`/`EstadoProvincia` son catálogo global de solo lectura para el cliente (sin datos sensibles). Se agregan tests Vitest por tool modificada y un test de la función pura de resolución, más un test Playwright del flujo de configuración + creación de cotización. |
| Restricciones técnicas — migraciones Prisma seguras y reversibles | Cumple — todas las columnas nuevas son nullable o tienen default; ninguna migración borra ni renombra una columna en uso (`cubierta` se conserva; `esExcepcion` es aditiva). La migración de datos que resuelve `ConfiguracionEmpresa.pais` (texto libre) contra el catálogo nuevo es best-effort con fallback seguro a `MULTIPAIS` — no bloquea el deploy si no encuentra match. |
| Restricciones técnicas — sin dependencia nueva sin necesidad concreta | Cumple — catálogo de países/estados servido siempre desde tabla Prisma propia, nunca desde una API externa en runtime (research.md Decisión 2, con evaluación explícita API vs. precarga). La única dependencia nueva es una **devDependency** de datos ISO, usada solo por el script de seed, con necesidad concreta (cobertura ISO completa y correcta) y sin huella en el runtime de producción (research.md Decisión 2b). |

**Resultado**: Sin violaciones. No aplica `Complexity Tracking`.

## Project Structure

### Documentation (this feature)

```text
specs/019-cobertura-geografica-envios/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones y alternativas
├── data-model.md         # Fase 1 — entidades, campos, relaciones, validaciones
├── quickstart.md         # Fase 1 — escenarios de validación end-to-end
├── contracts/
│   ├── ai-tools.md              # Contratos de las tools de IA modificadas
│   ├── server-actions.md        # Contratos de las Server Actions nuevas/modificadas
│   └── selector-geografico.md   # Contrato del Combobox país/estado reutilizable
└── tasks.md              # Fase 2 — generado por /speckit-tasks (no por este comando)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma          # + Pais, EstadoProvincia, TransportistaCoberturaGeografica,
│                           #   ModoCoberturaDelivery, ModoGeografico; columnas nuevas en
│                           #   Transportista, MetodoEntregaConfig, ZonaCoberturaMetodo,
│                           #   ConfiguracionEmpresa, EntregaCotizacion, EntregaPedido
└── seed.ts                 # SIN cambios — sigue siendo solo demo data destructiva

scripts/
└── seed-geografia.ts       # NUEVO — idempotente, production-safe (upsert, nunca delete),
                              #   siembra Pais/EstadoProvincia desde el dataset ISO
                              #   (devDependency, research.md Decisión 2b); expuesto como
                              #   `npm run db:seed:geografia`

src/
├── shared/
│   └── entregas/
│       ├── resolver-costo-envio.ts   # NUEVO — función pura de resolución de costo/cobertura
│       │                              #   (data-model.md "Flujo de resolución") + obtenerCostoSugerido
│       │                              #   (query de UI) — consumida por las tools de IA, por
│       │                              #   form-cotizacion.tsx y por form-entrega.tsx (evita que
│       │                              #   pedidos importe de cotizaciones, o viceversa)
│       ├── queries-geografia.ts      # NUEVO — listarPaises/listarEstadosProvincia
│       │                              #   (contracts/selector-geografico.md)
│       └── components/
│           ├── selector-pais.tsx              # NUEVO — Combobox (Popover+Command)
│           └── selector-estado-provincia.tsx  # NUEVO — Combobox dependiente del país
├── sales/
│   └── transportistas/
│       ├── actions.ts                # + guardarCoberturaGeografica, eliminarCoberturaGeografica
│       ├── queries.ts                # + listarCoberturaGeografica(transportistaId)
│       ├── schema.ts                 # + CoberturaGeograficaSchema
│       ├── types.ts                  # + tipo TransportistaCoberturaGeografica
│       └── components/
│           ├── form-transportista.tsx        # sin cambios de contrato — el formulario de
│           │                                   #   creación/edición del transportista en sí
│           │                                   #   no cambia (FR-001 se cumple con el
│           │                                   #   siguiente componente, embebido en el
│           │                                   #   mismo diálogo)
│           └── seccion-cobertura-geografica.tsx  # NUEVO — usa SelectorPais/
│                                                    #   SelectorEstadoProvincia + costo,
│                                                    #   embebido en dialog-transportista.tsx
├── configuracion/
│   ├── empresa/
│   │   ├── actions.ts                # + guardarConfiguracionGeografica
│   │   └── schema.ts                 # + ConfiguracionGeograficaSchema
│   └── entregas/
│       ├── actions.ts                # guardarMetodoEntregaConfig (+ modoCobertura),
│       │                               #   guardarZonaCoberturaMetodo (+ esExcepcion,
│       │                               #   validación FR-007)
│       ├── schema.ts                 # + campos en MetodoEntregaConfigSchema/
│       │                               #   ZonaCoberturaMetodoSchema
│       └── components/
│           └── seccion-metodos-entrega.tsx  # + selector de modo de cobertura y sección
│                                               #   de excepciones cuando el método no es
│                                               #   COURIER_EXTERNO
├── ai/tools/
│   ├── shared/
│   │   └── transferir-a-humano-interno.ts  # NUEVO — efecto secundario extraído de
│   │                                          #   transfer.tool.ts
│   └── providers/
│       ├── transfer.tool.ts               # refactor: delega a transferir-a-humano-interno
│       ├── calcular-costo-envio.tool.ts   # usa resolver-costo-envio + escalación
│       ├── validar-cobertura.tool.ts      # usa resolver-costo-envio + escalación
│       └── estimar-fecha-entrega.tool.ts  # usa resolver-costo-envio + escalación
└── sales/
    ├── cotizaciones/
    │   ├── schema.ts                  # EntregaCotizacionSchema + paisId/estadoProvinciaId/ciudad
    │   └── components/
    │       └── form-cotizacion.tsx    # sección entrega: + SelectorPais (condicional por
    │                                    #   modoGeografico)/SelectorEstadoProvincia/ciudad,
    │                                    #   prellenado de costoEnvio
    └── pedidos/
        ├── schema.ts                  # ActualizarEntregaPedidoSchema + mismos 3 campos
        ├── services/
        │   └── generar-pedido-desde-cotizacion.service.ts  # copia los 3 campos nuevos
        └── components/
            └── form-entrega.tsx       # mismos selects que form-cotizacion.tsx

tests/
├── (unit, junto a cada archivo — patrón ya establecido: *.test.ts hermano)
│   ├── src/shared/entregas/resolver-costo-envio.test.ts
│   ├── src/ai/tools/providers/calcular-costo-envio.test.ts   # extiende el existente
│   ├── src/ai/tools/providers/validar-cobertura.test.ts      # nuevo si no existía
│   └── src/configuracion/entregas/actions.test.ts             # valida FR-007
└── e2e/ (Playwright)
    └── cobertura-geografica-envios.spec.ts   # Escenarios 1 y 4 de quickstart.md
```

**Structure Decision**: Se reutiliza la estructura modular ya establecida (`src/[dominio]/[entidad]/{actions,queries,schema,types,components}`) — no se introduce ningún módulo nuevo de alto nivel. La única pieza compartida nueva (`src/shared/entregas/resolver-costo-envio.ts`) sigue el patrón ya usado en `src/shared/` para lógica de dominio reutilizada por más de un módulo (igual que `src/shared/db/prisma`, `src/shared/auth/*`).

## Complexity Tracking

*Sin violaciones de la Constitution Check — sección no aplica.*
