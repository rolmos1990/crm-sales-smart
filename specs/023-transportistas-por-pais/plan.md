# Implementation Plan: Transportistas por país

**Branch**: `023-transportistas-por-pais` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/023-transportistas-por-pais/spec.md`

## Summary

Hoy `Transportista` no tiene país propio — el país solo vive en cada `ZonaEntregaUbicacion` (catálogo `Pais`/`EstadoProvincia` de spec 019), y el campo "Provincia/Estado" del diálogo "Agregar zona" es texto libre sin relación con ese catálogo. Este plan: (1) agrega `paisId` (nullable, FK a `Pais`) a `Transportista`; (2) reemplaza el `<Input>` de provincia/estado en `DialogZonaEntrega` por `SelectorEstadoProvincia` (ya existente), con el país heredado y bloqueado al del transportista; (3) filtra el catálogo global de `ZonaEntrega` por país al mostrarlo/usarlo desde el contexto de un transportista, sin partir ese catálogo en sub-catálogos por transportista; (4) muestra el país (bandera + nombre) en lista, encabezado y tabla de zonas; (5) bloquea el cambio de país una vez que el transportista tiene alguna tarifa configurada; y (6) hace un backfill de los transportistas existentes, dejando "país pendiente" (banner + bloqueo de nuevas zonas/tarifas) cuando no se puede inferir sin ambigüedad.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 16.2 (App Router, Server Actions), Prisma 7 / PostgreSQL, Zod 4, React Hook Form + `@hookform/resolvers/zod`, TanStack Query (ya usado por `SelectorPais`/`SelectorEstadoProvincia`), shadcn/ui (Tabs, Table, Dialog, Badge)

**Storage**: PostgreSQL vía Prisma — 1 columna nueva (`Transportista.paisId`, nullable, FK a `Pais`), sin modelos nuevos; reutiliza `Pais`/`EstadoProvincia` (019) y `ZonaEntrega`/`ZonaEntregaUbicacion`/`TarifaTransportistaZona` (022) tal como están

**Testing**: Vitest (`npm run test:unit`) para: bloqueo de cambio de país con tarifas existentes, filtrado de zonas por país, lógica de backfill (inferencia única vs. ambigua vs. sin datos); Playwright extendiendo `tests/e2e/sales/transportistas.spec.ts` para el flujo completo crear-transportista-con-país → agregar-zona-con-catálogo-real

**Target Platform**: Web (Next.js SSR + Server Actions), mismo alcance responsive que 022

**Project Type**: Web application (monorepo Next.js único)

**Performance Goals**: N/A explícito — mismo volumen administrativo que 022 (decenas de transportistas/zonas por instancia)

**Constraints**: La migración de backfill MUST correr antes de que cualquier UI trate `paisId` como obligatorio para transportistas nuevos, y no debe interrumpir cotizaciones/pedidos ya existentes que referencian transportistas sin país (FR-009); el catálogo `ZonaEntrega` sigue siendo compartido por instancia (research.md Decisión 1) — este feature no le agrega `transportistaId`, solo lo filtra por país en las consultas que alimentan la UI de un transportista

**Scale/Scope**: 1 columna nueva + 1 migración de backfill, ~2 Server Actions modificadas (`crearTransportista`, `editarTransportista`), 1 query modificada con filtro opcional (`listarZonasEntrega`), 2 queries extendidas con `include: { pais: true }` (`obtenerTransportista`, `obtenerTransportistas`), ~5 componentes modificados (`FormTransportista`, `SeccionInformacionTransportista`, `ListaTransportistas`, `PanelTransportista`, `DialogZonaEntrega`), 0 componentes nuevos (todo reutiliza `SelectorPais`/`SelectorEstadoProvincia` ya existentes)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| I. Modular Business Architecture | Extiende `src/sales/transportistas/*` (dueño ya existente) y reutiliza `src/shared/entregas/queries-geografia.ts` + `SelectorPais`/`SelectorEstadoProvincia` (spec 019) sin duplicar catálogo ni crear un selector paralelo. No se toca el dominio `shared/entregas` más que para consumir lo que ya expone. | PASS |
| II. Server-Enforced Business Rules | El país obligatorio en creación, el filtrado de zonas por país, y el bloqueo de cambio de país con tarifas existentes se validan en Server Actions (Zod + chequeo server-side), nunca solo deshabilitando el campo en el cliente. | PASS |
| III. Reliable Data and Events | El backfill corre como script idempotente (mismo patrón que `scripts/seed-geografia.ts`), sin afectar datos de cotizaciones/pedidos ya emitidos. No se introduce ningún evento de dominio nuevo — asignar país a un transportista es configuración, no un evento catalogado. | PASS |
| IV. Replaceable Integrations | No se toca ninguna tool de IA ni adapter externo — `resolverCostoEnvio` y las tools de spec 019/022 siguen operando sobre `ZonaEntregaUbicacion.paisId` exactamente igual; el país del transportista es un filtro adicional en la UI de configuración, no en la resolución de costo. | PASS |
| V. Security and Quality | `paisId` en `Transportista` queda scopeado igual que el resto (a través de `instanciaId` del propio transportista); ningún dato nuevo requiere el permiso `"transportistas-costos"`. Se agregan tests unitarios para el bloqueo de cambio de país y la lógica de backfill (riesgo de datos), proporcional al cambio — no se requiere cobertura e2e nueva más allá de extender el flujo ya cubierto. | PASS |

**Restricciones técnicas**: `paisId` se agrega como columna **nullable** (no `NOT NULL` a nivel de base de datos) precisamente porque FR-009 exige que transportistas existentes sigan operando sin país mientras se completa — la obligatoriedad se aplica en la capa de Zod/Server Action para transportistas nuevos, mismo patrón ya usado por `ConfiguracionEmpresa.paisOperacionId` (nullable en Prisma, requerido por reglas de negocio en `MODO_GEOGRAFICO = UN_SOLO_PAIS`). Migración Prisma versionada, con script de backfill separado y ejecutado antes de habilitar la UI que trata el país como obligatorio (cumple "Prisma migrations MUST be versioned, reviewable, and safe for existing data").

Sin violaciones — no aplica Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/023-transportistas-por-pais/
├── plan.md                     # Este archivo
├── research.md                 # Fase 0 — decisiones técnicas
├── data-model.md               # Fase 1 — modelo de datos
├── quickstart.md               # Fase 1 — escenarios de validación
├── contracts/
│   └── server-actions.md       # Fase 1 — contratos de Server Actions y queries
└── tasks.md                    # Fase 2 (/speckit-tasks — no creado por /speckit-plan)
```

### Source Code (repository root)

```text
src/sales/transportistas/
├── schema.ts                            # + paisId en CrearTransportistaSchema/EditarTransportistaSchema
├── actions.ts                           # crearTransportista/editarTransportista: país obligatorio en alta, bloqueo de cambio con tarifas existentes
├── queries.ts                           # obtenerTransportista/obtenerTransportistas: include pais, conteo de tarifas totales para el lock
├── zonas/
│   ├── queries.ts                       # listarZonasEntrega: nuevo parámetro opcional paisId para filtrar
│   └── schema.ts                        # (sin cambios — UbicacionZonaSchema ya tiene paisId)
├── components/
│   ├── form-transportista.tsx           # + SelectorPais (obligatorio) al crear
│   ├── seccion-informacion-transportista.tsx  # + campo País (SelectorPais), bloqueado si hay tarifas; banner "país pendiente" si es null
│   ├── lista-transportistas.tsx         # + bandera/nombre del país junto al nombre
│   ├── panel-transportista.tsx          # + bandera/nombre del país en el encabezado
│   ├── dialog-zona-entrega.tsx          # país heredado y bloqueado (recibe paisId/paisLabel); provinciaEstado pasa a SelectorEstadoProvincia
│   └── seccion-zonas-tarifas.tsx        # deshabilita "Agregar zona"/"Agregar tarifa" si país pendiente; pasa paisId a los diálogos hijos
└── (sin modelos ni módulos nuevos)

scripts/
└── backfill-pais-transportista.ts       # script one-shot: infiere paisId desde las ubicaciones de zonas ya usadas por cada transportista

prisma/
└── schema.prisma                        # Transportista.paisId (nullable, FK a Pais) + migración
```

**Structure Decision**: Extensión pura del módulo `src/sales/transportistas/` ya existente (spec 022), sin nuevos submódulos ni modelos — coherente con que este feature es una conexión entre 019 (catálogo geográfico) y 022 (gestión de transportistas), no una capacidad de dominio nueva.

## Complexity Tracking

> Sin violaciones — tabla no aplica.
