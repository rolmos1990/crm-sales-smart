# Implementation Plan: Cuenta como Venta en el Flujo de Venta

**Branch**: `feature/038-cuenta-como-venta` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/038-cuenta-como-venta/spec.md`

## Summary

Cada `FlujoVentaEtapa` suma un flag `cuentaComoVenta`. Los KPIs de dinero del listado de Pedidos pasan a sumar solo los pedidos cuya etapa actual lo tenga activo, y a atribuir la venta a la fecha en que el pedido se volvió venta por primera vez.

El eje del diseño es la **separación entre lo que depende de la configuración y lo que no**:

| | Cómo se resuelve | Al cambiar la config |
|---|---|---|
| ¿Este pedido **cuenta** como venta? | **Nunca se persiste.** Se deriva en cada consulta del flag de la etapa, igual que hoy se deriva `esFinal`/`esCancelacion` en `obtenerPedidosKpis`. | **Se reevalúa siempre.** Marcás una etapa y el siguiente render ya la incluye; la desmarcás y sale en el acto (FR-008). |
| ¿**Cuándo** se volvió venta? | Se materializa en `Pedido.fechaVenta`, sellada la **primera** vez que el pedido entra a una etapa marcada, y nunca reescrita (FR-014b). | **No se recalcula.** Los pedidos ya sellados conservan su fecha; marcar más adelante una etapa anterior solo afecta a los que todavía no cruzaron. |

La pertenencia cumple FR-008 por construcción: lo sensible a la config no se guarda, así que no hay nada que pueda quedar desactualizado. Es el mismo criterio que ya aplica Preparación de Pedidos (026) — *"se deriva a propósito en vez de mantener una bandera"*, `src/sales/preparacion/utils/entrada.ts:11`.

La **fecha**, en cambio, sí queda acoplada a la configuración vigente al sellarse. Es el precio de la semántica de primer sellado que pidió el negocio, y se asume de forma consciente (research.md Decisión 3).

En paralelo se elimina `Pedido.fechaExpiracion` de todo el código y se recalculan contra `fechaEntrega` los dos KPIs que colgaban de ella.

## Technical Context

**Language/Version**: TypeScript 5 · Node.js 20+

**Primary Dependencies**: Next.js 16.2 (App Router), Prisma 7, Zod v4, TanStack Query v5, Tailwind v4 + shadcn/ui

**Storage**: PostgreSQL vía Prisma. Dos columnas nuevas (`FlujoVentaEtapa.cuentaComoVenta`, `Pedido.fechaVenta`), una eliminada (`Pedido.fechaExpiracion`), un índice compuesto nuevo.

**Testing**: Vitest para lógica pura y Server Actions con doble de Prisma en memoria (patrón de `src/sales/pedidos/sync-fecha-entrega.test.ts`). Playwright para el recorrido E2E.

**Target Platform**: Aplicación web multi-tenant, server-rendered.

**Project Type**: Web app monolítica con separación por dominio (`src/sales/`, `src/crm/`, `src/shared/`).

**Performance Goals**: El bloque de KPIs del listado debe conservar su costo actual — cinco agregaciones en paralelo sobre índices, sin consultas añadidas y sin `$queryRaw`. Es el motivo central de materializar la fecha en vez de derivarla del historial en cada lectura (ver [research.md](./research.md) Decisión 2).

**Constraints**:
- Rangos de fecha semiabiertos `{ gte, lt }` sobre la columna cruda, resueltos en la zona de negocio. Nunca `AT TIME ZONE` ni `DATE_TRUNC` sobre la columna (CLAUDE.md §7, `docs/fechas-y-zonas-horarias.md`).
- Toda query scopeada por `instanciaId`.
- La eliminación de `fechaExpiracion` es destructiva: exige depurar antes las Reglas de validación que la referencian (FR-024).

**Scale/Scope**: 2 columnas nuevas + 1 eliminada · 4 sitios de escritura de la fecha · 6 tarjetas KPI recalculadas · ~15 archivos tocados por la eliminación del campo.

## Constitution Check

*GATE: evaluado antes de Phase 0 y revalidado tras Phase 1.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Modular Business Architecture** | Todo cae dentro de `src/sales/` (pedidos + flujo-venta), extendiendo módulos existentes. Único toque fuera: `src/crm/pipeline/disparadores/ejecutor.ts`, que ya escribe `flujoVentaEtapaId` y debe escribir también la fecha. Ningún componente React toca Prisma. | ✅ PASS |
| **II. Server-Enforced Business Rules** | `cuentaComoVenta` entra por `EtapaSchema` (Zod) y se aplica en `crearEtapa`/`actualizarEtapa`, que ya exigen `requireAdminFlujo()`. Los totales se calculan solo en el servidor. La exclusión mutua con `esCancelacion` (FR-005) se valida en el servidor, no solo en la UI. | ✅ PASS |
| **III. Reliable Data and Events** | `fechaVenta` se escribe en el **mismo `update`/`create`** que `flujoVentaEtapaId`, dentro de la transacción que ya existe junto a la fila de `PedidoHistorialEtapa`. Imposible que queden desalineados. Sin efectos secundarios nuevos ni eventos nuevos. Carrera conocida y asumida: dos movimientos concurrentes podrían sellar ambos, con milisegundos de diferencia. | ✅ PASS |
| **IV. Replaceable Integrations** | No toca integraciones externas. | ✅ N/A |
| **V. Security and Quality** | Todas las queries siguen scopeadas por `instanciaId`; el flag se lee vía `obtenerEtapasFlujoActivo(instanciaId)`. Sin datos personales ni secretos. Tests unitarios para la construcción de condiciones y la atribución de fecha, integración para los 4 sitios de escritura, E2E para el recorrido de configuración. | ✅ PASS |

**Restricción técnica — migraciones seguras**: la migración es destructiva (`DROP COLUMN`). Se ordena en seis pasos con la depuración de reglas **antes** del `DROP`, y los dos backfills son idempotentes. Detalle en [data-model.md](./data-model.md).

**Resultado**: sin violaciones. La sección *Complexity Tracking* queda vacía y se elimina.

**Re-evaluación post-Phase 1**: sin cambios. El diseño no introdujo abstracciones nuevas — reutiliza `construirWhereBase`, `obtenerEtapasFlujoActivo` y los helpers de `src/shared/fechas/rangos.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/038-cuenta-como-venta/
├── spec.md              # Qué y por qué (/speckit-specify)
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Decisiones de diseño y alternativas descartadas
├── data-model.md        # Columnas, migración y backfills
├── quickstart.md        # Guía de validación end-to-end
└── checklists/
    └── requirements.md  # Validación de calidad del spec
```

Sin directorio `contracts/`: la feature no expone interfaces externas. Su superficie son Server Actions internas (`actualizarEtapa`) y Server Components, cuyos contratos ya viven en los esquemas Zod de `src/sales/flujo-venta/schema.ts`.

### Source Code (repository root)

```text
prisma/
├── schema.prisma                                   # +cuentaComoVenta, +fechaVenta, −fechaExpiracion
└── migrations/
    └── 20261118000000_cuenta_como_venta/
        └── migration.sql                           # 6 pasos (ver data-model.md)

src/sales/flujo-venta/
├── schema.ts                                       # EtapaSchema += cuentaComoVenta
├── types.ts                                        # FlujoVentaEtapa += cuentaComoVenta
├── actions.ts                                      # crearEtapa/actualizarEtapa + regla FR-005
├── queries.ts                                      # obtenerEtapasFlujoActivo selecciona el flag
├── motor.ts                                        # _moverInterno escribe la fecha   [sitio 3/4]
├── components/panel-config-etapas.tsx              # toggle + badge
└── reglas/
    ├── catalogo-campos.ts                          # − general.fechaExpiracion
    └── resolver-hechos.ts                          # − general.fechaExpiracion

src/sales/pedidos/
├── queries.ts                                      # condicionVenta + construirWhereVentas + KPIs
├── vista.ts                                        # pasa rangoHoy; EtapaFlujoVista += flag
├── actions.ts                                      # escribe la fecha [sitio 1/4]; − fechaExpiracion
├── schema.ts, types.ts                             # − fechaExpiracion
├── utils/exportar-csv.ts                           # − columna Expiración
└── components/
    ├── pedidos-kpi-cards.tsx                       # etiquetas y subtítulos
    ├── lista-pedidos.tsx                           # − ExpiracionCell y su columna
    ├── form-pedido.tsx, dialog-editar-pedido.tsx   # − campo de expiración
    └── ...

src/sales/cotizaciones/services/
└── generar-pedido-desde-cotizacion.service.ts      # escribe la fecha [sitio 2/4]

src/crm/pipeline/disparadores/
└── ejecutor.ts                                     # escribe la fecha [sitio 4/4]

src/app/sales/pedidos/
├── page.tsx                                        # KPIs iniciales
└── [id]/page.tsx                                   # − badge de expiración

scripts/
└── depurar-reglas-fecha-expiracion.ts              # FR-024/FR-025, con su .test.ts
```

**Structure Decision**: se respeta la organización por dominio ya establecida. La feature vive casi por completo en `src/sales/flujo-venta/` (configuración) y `src/sales/pedidos/` (consumo), los dos módulos que el spec involucra. El único archivo fuera de `src/sales/` es `src/crm/pipeline/disparadores/ejecutor.ts`, incluido porque es uno de los cuatro sitios que mueven un pedido de etapa (FR-014) — dejarlo afuera abriría exactamente el agujero que documenta `src/sales/preparacion/servicios/asegurar-preparacion-pedido.ts:10`.
