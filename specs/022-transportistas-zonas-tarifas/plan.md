# Implementation Plan: Gestión integral de transportistas — zonas, tarifas y condiciones

**Branch**: `022-transportistas-zonas-tarifas` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-transportistas-zonas-tarifas/spec.md`

## Summary

Hoy `Transportista` es un registro mínimo (nombre, tipo, activo) cuya única cobertura (`TransportistaCoberturaGeografica`, spec 019) da un costo único por país+provincia, sin zonas reutilizables ni separación costo/precio/margen. Este plan: (1) extiende `Transportista` con datos de contacto y condiciones operativas; (2) introduce un catálogo reutilizable de `ZonaEntrega` (multi-país, multi-nivel administrativo) y `TarifaTransportistaZona` (costo interno/precio cliente/margen por transportista+zona+servicio), reemplazando `TransportistaCoberturaGeografica` (Clarificación de sesión 2026-09-01); (3) reemplaza el modal de edición por un panel con pestañas Información/Zonas y tarifas/Condiciones; (4) conecta esa configuración a cotizaciones y pedidos (resolución automática de zona, snapshot inmutable al convertir en pedido); (5) protege costo interno/margen con un nuevo permiso financiero; (6) agrega auditoría de cambios; y (7) expone una nueva herramienta de IA que lista opciones de envío sin datos internos del transportista.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 16.2 (App Router, Server Actions, rutas dinámicas `[id]`), Prisma 7 / PostgreSQL, Zod 4, React Hook Form + `@hookform/resolvers/zod`, shadcn/ui (Tabs, Table, Dialog, Switch, Badge), TanStack Query no aplica (Server Actions + `router.refresh()`, patrón ya usado en el módulo)

**Storage**: PostgreSQL vía Prisma — 6 modelos nuevos (`ZonaEntrega`, `ZonaEntregaUbicacion`, `ServicioTransportista`, `TarifaTransportistaZona`, `CondicionesTransportista`, `TransportistaHistorial`), extensión de 3 existentes (`Transportista`, `EntregaCotizacion`, `EntregaPedido`), retiro de 1 (`TransportistaCoberturaGeografica`) con migración de datos

**Testing**: Vitest (`npm run test:unit`) para cálculo de margen, unicidad de tarifas, resolución de zona, permisos financieros, snapshot; Playwright (`npm run test:e2e:transportistas`, extendiendo `tests/e2e/sales/transportistas.spec.ts`; revisar/retirar los casos de `tests/e2e/sales/cobertura-geografica-envios.spec.ts` que prueban la pantalla retirada)

**Target Platform**: Web (Next.js SSR + Server Actions), responsive escritorio/mobile (requisito explícito del spec)

**Project Type**: Web application (monorepo Next.js único)

**Performance Goals**: N/A explícito — pantalla de configuración administrativa y flujo de venta de volumen moderado (decenas de zonas/tarifas por transportista, no miles); sin requisitos de throughput nuevos

**Constraints**: La migración debe preservar el 100% de las coberturas país+provincia existentes (SC-006) sin downtime lógico; el retiro de `TransportistaCoberturaGeografica` solo puede ejecutarse después de que la migración de datos haya corrido y verificado (orden estricto de pasos, ver research.md Decisión 1); `resolverCostoEnvio` debe seguir sirviendo a las 3 tools de IA de spec 019 sin cambiar su contrato externo (research.md Decisión 4)

**Scale/Scope**: 6 modelos nuevos + 3 extendidos + 1 retirado, ~15 Server Actions (nuevas o modificadas), 1 permiso nuevo (`transportistas-costos`), 1 página nueva (`/sales/transportistas/[id]`), ~6 componentes de UI nuevos + 4 extendidos, 1 tool de IA nueva + 3 adaptadas, 1 modelo de auditoría nuevo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|---|---|---|
| I. Modular Business Architecture | Extiende `src/sales/transportistas/*` (dueño ya existente del dominio) con submódulos `zonas/`, `tarifas/`, `condiciones/` — no se crea un módulo paralelo. Reutiliza `Pais`/`EstadoProvincia` (spec 019), `PedidoHistorial` como patrón de auditoría, `ZonaCobertura` como patrón de catálogo por empresa, y el motor `resolverCostoEnvio` en vez de duplicar lógica de resolución. Componentes de UI siguen llamando Server Actions/queries, nunca Prisma directo. | PASS |
| II. Server-Enforced Business Rules | Costo/precio no negativos, unicidad de tarifa, confirmación de costo antes de convertir a pedido, y visibilidad de costo interno/margen se validan y aplican en Server Actions (Zod + permisos), nunca solo en el cliente. | PASS |
| III. Reliable Data and Events | La migración de `TransportistaCoberturaGeografica` → zonas/tarifas y la copia de snapshot en `generarPedidoDesdeCotizacion` corren dentro de transacciones (`prisma.$transaction`), igual que el resto del servicio ya existente. No se introduce ningún evento de dominio nuevo — la selección de transportista/tarifa en una cotización no es un evento catalogado, es configuración/datos de un documento ya existente. | PASS |
| IV. Replaceable Integrations | No se toca ningún adapter externo — la nueva tool de IA (`consultar_opciones_envio`) sigue el mismo contrato `IProveedorTool` ya usado, sin infraestructura de protocolo nueva (research.md Decisión 4, justificado explícitamente por ausencia de necesidad concreta de MCP externo). | PASS |
| V. Security and Quality | Todo modelo nuevo lleva `instanciaId` y se scopea en cada query/mutación (Principio de aislamiento, FR-055). El nuevo permiso `"transportistas-costos"` protege costo interno/margen en las 3 superficies (tarifas, cotización, pedido) sin excepción. Ningún dato de contacto/notas internas del transportista ni costo interno llega a la respuesta de la tool de IA (FR-059, verificado en contracts/ai-tools.md). Se agregan tests unitarios (margen, duplicados, resolución de zona, permisos) e e2e (creación, configuración, uso en cotización) proporcionales al riesgo — este es un cambio financiero y de datos de negocio, por lo que la cobertura es más amplia que en features puramente administrativas. | PASS |

**Restricciones técnicas**: Migración Prisma versionada con pasos explícitos de backfill antes de retirar `TransportistaCoberturaGeografica` (cumple "Prisma migrations MUST be versioned, reviewable, and safe for existing data"). Nuevo permiso agregado extendiendo el mapa `PERMISOS` existente, sin cambiar su forma (research.md Decisión 8) — no introduce una dependencia nueva ni un sistema de permisos paralelo.

Sin violaciones — no aplica Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/022-transportistas-zonas-tarifas/
├── plan.md                     # Este archivo
├── research.md                 # Fase 0 — 8 decisiones técnicas
├── data-model.md               # Fase 1 — modelo de datos completo
├── quickstart.md               # Fase 1 — 6 escenarios de validación
├── contracts/
│   ├── server-actions.md       # Fase 1 — contratos de Server Actions
│   ├── ai-tools.md             # Fase 1 — contrato de la nueva tool de IA + adaptación de las 3 existentes
│   └── ui-panel.md             # Fase 1 — contrato del panel de configuración (tabs, componentes)
└── tasks.md                    # Fase 2 (/speckit-tasks — no generado por este comando)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                                     # MODIFICAR: +6 modelos, extender 3, retirar TransportistaCoberturaGeografica
└── migrations/
    └── <timestamp>_transportistas_zonas_tarifas/
        └── migration.sql                             # NUEVA: crear tablas, backfill zonas/tarifas desde cobertura país+provincia, extender Entrega*, drop TransportistaCoberturaGeografica

src/shared/auth/
└── permisos.ts                                        # MODIFICAR: +"transportistas-costos" en Modulo y PERMISOS

src/sales/transportistas/
├── schema.ts                                          # MODIFICAR: +camposContacto en Editar/CrearTransportistaSchema; -CoberturaGeograficaSchema
├── actions.ts                                         # MODIFICAR: corregir permiso a "transportistas"; +siembra servicios/condiciones al crear
├── queries.ts                                         # MODIFICAR: +datos de contacto, +conteo de zonas activas
├── types.ts                                           # MODIFICAR: tipos extendidos
├── zonas/
│   ├── schema.ts                                       # NUEVO
│   ├── actions.ts                                      # NUEVO: crearZonaEntrega, editarZonaEntrega, eliminarZonaEntrega
│   └── queries.ts                                      # NUEVO: listarZonasEntrega, buscarZonasEntrega
├── tarifas/
│   ├── schema.ts                                       # NUEVO
│   ├── actions.ts                                      # NUEVO: crearTarifa, editarTarifa, duplicarTarifa, toggleTarifa, eliminarTarifa, aplicarCambioMasivo
│   └── queries.ts                                      # NUEVO: listarTarifas, obtenerPromedioTarifas
├── condiciones/
│   ├── schema.ts                                       # NUEVO
│   ├── actions.ts                                      # NUEVO: guardarCondicionesTransportista
│   └── queries.ts                                      # NUEVO: obtenerCondicionesTransportista
├── historial/
│   └── queries.ts                                      # NUEVO: listarHistorialTransportista (para una futura pantalla de auditoría; no bloqueante para el MVP)
└── components/
    ├── dialog-transportista.tsx                        # MODIFICAR: recortar a nombre/tipo/estado + redirect
    ├── form-transportista.tsx                          # MODIFICAR: +4 campos de contacto (o mover a la pestaña Información del panel)
    ├── lista-transportistas.tsx                         # MODIFICAR: quitar edición inline, agregar link a /sales/transportistas/[id]
    ├── panel-transportista.tsx                          # NUEVO: encabezado + Tabs + botones Volver/Guardar cambios
    ├── seccion-informacion-transportista.tsx             # NUEVO
    ├── seccion-zonas-tarifas.tsx                         # NUEVO
    ├── dialog-zona-entrega.tsx                           # NUEVO: crear zona sin salir del flujo
    ├── seccion-condiciones-transportista.tsx             # NUEVO
    └── seccion-cobertura-geografica.tsx                  # ELIMINAR (retirado, Decisión 1)

src/app/sales/transportistas/
├── page.tsx                                            # MODIFICAR: quitar dialog de edición inline, quitar cobertura embebida
└── [id]/
    └── page.tsx                                        # NUEVO: panel de configuración completo

src/shared/entregas/
├── resolver-costo-envio.ts                              # MODIFICAR: Fuente 1 reescrita contra zonas; +obtenerCandidatosEnvioPorZona (research.md Decisión 3/4)
└── resolver-costo-envio.test.ts / .integration.test.ts   # MODIFICAR: casos de zona reemplazan casos de país+estado

src/ai/tools/providers/
├── consultar-opciones-envio.tool.ts                      # NUEVO — registrado en src/ai/tools/inicializar.ts
├── calcular-costo-envio.tool.ts                           # MODIFICAR: fuente interna (sin cambio de contrato)
└── validar-cobertura.tool.ts                              # MODIFICAR: ídem

src/sales/cotizaciones/
├── actions.ts                                            # MODIFICAR: +campos de envío (zona/servicio/tarifa/costo manual/confirmación)
├── schema.ts                                             # MODIFICAR: +campos de envío
└── components/
    └── form-cotizacion.tsx                               # MODIFICAR: selector de zona/transportista/servicio por opciones resueltas, campos costo interno/margen gateados por permiso

src/sales/pedidos/
├── services/generar-pedido-desde-cotizacion.service.ts    # MODIFICAR: copiar campos nuevos del snapshot
└── components/
    ├── form-entrega.tsx                                   # MODIFICAR: mismo patrón que form-cotizacion
    └── seccion-entrega.tsx                                 # MODIFICAR: mostrar snapshot completo en modo lectura

src/configuracion/empresa/
├── schema.ts                                             # MODIFICAR: +permiteConvertirSinConfirmarCostoEnvio
└── actions.ts                                            # MODIFICAR: idem

scripts/
└── migrar-cobertura-a-zonas.ts                            # NUEVO (opcional, o inline en la migración SQL) — script de verificación post-migración, análogo a scripts/seed-geografia.ts

tests/
├── unit: nuevos *.test.ts junto a cada actions.ts/queries.ts nuevo (mismo patrón que 019/021)
└── e2e/sales/
    ├── transportistas.spec.ts                            # MODIFICAR/EXTENDER: nuevo flujo panel de pestañas
    └── cobertura-geografica-envios.spec.ts                # MODIFICAR: retirar/reemplazar casos de la pantalla país+provincia
```

**Structure Decision**: Se extiende `src/sales/transportistas/` (dueño existente) con submódulos por sub-dominio (`zonas/`, `tarifas/`, `condiciones/`, `historial/`) siguiendo la misma convención de carpetas que ya usa el resto del proyecto (`actions.ts`/`queries.ts`/`schema.ts`/`types.ts` por entidad) — sin introducir un módulo nuevo de nivel superior. Se reutiliza `src/shared/entregas/` (ya compartido) para el motor de resolución, y `src/ai/tools/providers/` (ya existente) para la nueva tool de IA.

## Complexity Tracking

*Sin violaciones de la Constitution Check — tabla no aplica.*
