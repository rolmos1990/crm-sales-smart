# Implementation Plan: Segmentación comercial de Contactos

**Branch**: `feature/041-contactos-segmentacion-comercial` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/041-contactos-segmentacion-comercial/spec.md`

## Summary

Convertir `/crm/contactos` en una lista comercial paginada en el servidor, con cinco indicadores interactivos (Total, Clientes, Interesados, Por recuperar, Leads), pestañas, filtros, orden por prioridad de atención, panel lateral, interés editable con historial y la preferencia "No contactar", que bloquea los envíos de la IA y de los Workflows. No se agregan llamadas a IA.

Enfoque técnico (detalle en [research.md](./research.md)):

- **Una sola definición de las reglas.** Cliente, Interesado, Lead y los estados de seguimiento son constructores puros de `Prisma.ContactoWhereInput` (D1). Los usan los conteos, los filtros, la paginación y el cálculo por fila, así que nunca se contradicen. Cliente reutiliza `construirCondicionVenta` (038) y nunca se persiste.
- **Orden por prioridad sin SQL crudo**: paginación por cuatro tramos excluyentes con sus conteos (D2).
- **Dos hechos materializados en `Contacto`**: `ultimaInteraccionEn` y `esperandoRespuestaDesde`, escritos en línea en los puntos de escritura verificados (D3). Para distinguir mensajes de personas de los automáticos, `enviarMensajeInterno` pasa a exigir `autor` (D4).
- **"No contactar"**: el corte principal está en `enviarMensajeInterno`, más cortes tempranos en el orquestador de IA y en el disparo de Workflows. A una persona solo se le avisa (D5).
- **Patrón de vista**: igual que Pedidos (`useVistaFiltrada` + Server Action), con los filtros fuera de la URL (D8).

## Technical Context

**Language/Version**: TypeScript 5 (estricto), Node.js 20+

**Primary Dependencies**: Next.js 16.2 App Router, React 19, Prisma 7, Zod v4, TanStack Query v5, React Hook Form, shadcn/ui (Radix + `@base-ui/react/select`), Tailwind v4, Lucide. **Sin dependencias nuevas.**

**Storage**: PostgreSQL vía Prisma. Una migración aditiva + un script de datos idempotente.

**Testing**: Vitest (reglas puras, servicio de clasificación, envío), Playwright (`tests/e2e/crm/contactos.spec.ts`, inbox, regresión de pipeline y pedidos).

**Target Platform**: aplicación web (app Next.js + worker `src/worker/disparadores.ts`).

**Project Type**: aplicación web monolítica (Next.js) organizada por dominio.

**Performance Goals**: SC-003. Con 20.000 contactos, primera carga < 2 s y cambio de página, filtro u orden con p95 < 1 s.

**Constraints**: aislamiento por `instanciaId` en toda consulta; fechas en UTC con cortes en la zona del negocio (`obtenerZonaNegocio`, rangos semiabiertos); regla 10 de CLAUDE.md (Cliente derivado); no romper `obtenerContactos` ni `buscarContactos`.

**Scale/Scope**: hasta decenas de miles de contactos por instancia (más allá: DT-05). Alrededor de 12 archivos nuevos y 15 modificados.

## Constitution Check

*GATE: debe pasar antes de la Fase 0. Revisado de nuevo después de la Fase 1.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Arquitectura modular | Todo vive en `src/crm/contactos/` (segmentación, vista, clasificación, interacción). Los componentes no tocan Prisma: leen mediante Server Actions. Se extienden módulos existentes (envío, orquestador, disparo, configuración) en vez de crear paralelos. | ✅ |
| II. Reglas en el servidor | Zod al inicio de cada acción; permisos `contactos` r/rw y `configuracion` rw verificados en el servidor; las transiciones de interés y "No contactar" pasan por un único servicio (`clasificacion.ts`) que rechaza las transiciones automáticas prohibidas. El corte de envío está en el servidor. | ✅ |
| III. Datos y eventos confiables | Cada cambio de clasificación escribe el contacto y su historial en una transacción y publica el evento después del commit. `ultimaInteraccionEn`/`esperandoRespuestaDesde` no son efectos secundarios externos sino datos derivados en la misma base, escritos con `updateMany` condicional (idempotente, tolera desorden). El script de datos es idempotente. | ✅ (ver Complexity Tracking) |
| IV. Integraciones reemplazables | Sin integraciones nuevas. El bloqueo actúa antes de cualquier adaptador de canal. | ✅ |
| V. Seguridad y calidad | Tenant en toda consulta, incluido el panel (acceso por id verificado contra la instancia). Sin datos personales en logs. Tests: unit para reglas y servicio, Playwright para los recorridos críticos y regresiones. `npm run build` y las suites relevantes como condición de "hecho". | ✅ |
| Restricciones técnicas | Migración aditiva y reversible (solo columnas, tabla e índices nuevos). Responsive con vista móvil propia. Fechas explícitas en UTC. Sin dependencias nuevas. La constitución nombra Next.js 15; el proyecto ya está en 16.2 (preexistente, no lo introduce esta feature). | ✅ |
| Flujo de trabajo | La spec define alcance, reglas, bordes y exclusiones; las decisiones faltantes quedaron en Supuestos, Clarificaciones y Deuda técnica. | ✅ |

**Post-diseño**: sin violaciones nuevas. El cambio de firma de `enviarMensajeInterno` (de `origen?` a `autor` obligatorio) es interno y lo verifica el compilador en sus cuatro llamadores.

## Project Structure

### Documentation (this feature)

```text
specs/041-contactos-segmentacion-comercial/
├── spec.md
├── plan.md              # este archivo
├── research.md          # D1–D15
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── server-actions.md
│   └── eventos.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                                   # MOD: enums, campos Contacto/ConfiguracionEmpresa, ContactoClasificacionHistorial, índices
└── migrations/<ts>_contactos_segmentacion_comercial/   # NUEVO
scripts/
└── 041-sembrar-interes-contactos.ts                # NUEVO: backfill + siembra idempotente

src/crm/contactos/
├── segmentacion/
│   ├── condiciones.ts                              # NUEVO: where puros (Cliente, Interesado, Lead, seguimiento, tramos)
│   ├── condiciones.test.ts                         # NUEVO
│   ├── cortes.ts                                   # NUEVO: umbrales → fechas de corte (zona negocio)
│   ├── recomendacion.ts                            # NUEVO: función pura FR-031
│   ├── recomendacion.test.ts                       # NUEVO
│   └── canales.ts                                  # NUEVO: grupos de canal → valores de identificador
├── vista.ts                                        # NUEVO: cargarVistaContactos (conteos, tramos, filas)
├── vista.test.ts                                   # NUEVO: paginación por tramos
├── clasificacion.ts                                # NUEVO: servicio interés / No contactar + historial + eventos
├── clasificacion.test.ts                           # NUEVO
├── interaccion.ts                                  # NUEVO: registrarInteraccion / registrarMensajeEntrante / registrarRespuesta
├── actions.ts                                      # MOD: consultarVista, obtenerResumen, actualizarInteres, actualizarPreferencia
├── schema.ts                                       # MOD: esquemas Zod de filtros y acciones
├── types.ts                                        # MOD: tipos derivados
├── queries.ts                                      # SIN CAMBIOS en obtenerContactos/buscarContactos; NUEVO obtenerResumenContacto
└── components/
    ├── vista-contactos.tsx                         # NUEVO: orquesta indicadores, pestañas, filtros, tabla, panel
    ├── contactos-indicadores.tsx                   # NUEVO
    ├── contactos-filtros.tsx                       # NUEVO (Selects con `items`)
    ├── tabla-contactos.tsx                         # NUEVO: tabla desktop + tarjetas móvil, paginación controlada
    ├── insignias-contacto.tsx                      # NUEVO: tipo, interés, recomendación, No contactar
    ├── panel-contacto.tsx                          # NUEVO: Sheet lateral
    ├── control-clasificacion.tsx                   # NUEVO: editar interés / No contactar
    ├── lista-contactos.tsx                         # MOD → se conserva AccionesContacto (ver/editar/eliminar); se retira la lista vieja
    ├── avatar-contacto.tsx                         # MOD: tokens
    └── panel-perfil-cliente.tsx                    # MOD: tokens (si se muestra en el panel)

src/app/crm/contactos/
├── page.tsx                                        # MOD: carga inicial con cargarVistaContactos
└── loading.tsx                                     # MOD: skeleton con indicadores + tabla

src/conversaciones/
├── envio.ts                                        # MOD: `autor`, corte No contactar, registrarRespuesta/Interaccion
├── actions.ts                                      # MOD: entrante (514) y eco nativo (616) → interacción; enviarMensaje autor PERSONA + usuarioId de sesión
└── components/{inbox-layout,panel-conversacion}.tsx # MOD: aviso No contactar en el compositor
src/ai/respuesta/responder-con-agente.ts            # MOD: autor IA/WORKFLOW
src/ai/autonomia/actions.ts                         # MOD: autor WORKFLOW
src/suscriptores/ai/orquestar-ia.suscriptor.ts      # MOD: corte temprano No contactar
src/workflows/motor/disparo.ts                      # MOD: corte temprano No contactar
src/workflows/motor/adaptadores.ts                  # MOD: autor WORKFLOW; MENSAJE_NO_CONTACTAR → ErrorDefinitivoWorkflow
src/crm/actividades/actions.ts                      # MOD: registrarInteraccion
src/sales/pedidos/actions.ts                        # MOD: registrarInteraccion
src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts  # MOD: registrarInteraccion
src/ai/tools/providers/crear-pedido.tool.ts         # MOD: registrarInteraccion
src/ai/perfil-cliente/calculo-objetivo.ts (+ .test) # MOD: construirCondicionVenta (FR-027)
src/configuracion/empresa/actions.ts                # MOD: guardarUmbralesSeguimientoAction
src/configuracion/components/tab-preferencias.tsx   # MOD: sección Seguimiento de contactos
src/eventos/catalogo.ts                             # MOD: 2 eventos
src/eventos/contratos/contacto-interes-actualizado.event.ts              # NUEVO
src/eventos/contratos/contacto-preferencia-contacto-actualizada.event.ts # NUEVO
docs/eventos.md                                     # MOD

tests/e2e/crm/contactos.spec.ts                     # MOD: escenarios H1–H3
tests/e2e/conversaciones/inbox.spec.ts              # MOD: aviso No contactar
```

**Structure Decision**: monolito Next.js por dominio. Todo lo nuevo de negocio vive en `src/crm/contactos/` (dominio CRM); las reglas puras van en `segmentacion/` para probarlas sin base, siguiendo el precedente de `src/sales/pedidos/condicion-venta.ts`.

## Orden de implementación por historia

1. **Fundación** (bloquea todo): migración, `interaccion.ts` + sus puntos de llamada, cambio `autor` en `enviarMensajeInterno`, script de backfill/siembra, `condiciones.ts` + `cortes.ts` con tests, fix 012 (D11).
2. **H1 (P1)**: `vista.ts` (conteos, tramos, filas), acción de consulta, página, indicadores, pestañas, filtros visibles, tabla y móvil. El seguimiento se calcula con los umbrales por defecto; no hay columna Recomendación todavía.
3. **H2 (P2)**: `clasificacion.ts` + eventos, panel lateral, control de interés y de "No contactar", cortes de envío (D5), aviso en el compositor.
4. **H3 (P3)**: umbrales en Configuración, filtro de seguimiento y de preferencia en "Más filtros", columna Recomendación.

Cada historia termina con su Playwright en verde y `npm run build`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El orden por prioridad no cumple SC-003 (DT-01) | Medición dedicada en quickstart; índices de D13; si falla, `EXPLAIN ANALYZE` antes de rediseñar. |
| Un llamador futuro de `enviarMensajeInterno` olvida declarar el autor | `autor` es obligatorio: no compila sin él. |
| La siembra o el backfill bloquean tablas en instancias grandes | Por instancia y en lotes; solo actualiza filas aún nulas; se puede cortar y reanudar. |
| Workflows en espera reintentan contra un contacto "No contactar" | `ErrorDefinitivoWorkflow` (sin reintentos), con test. |
| La lista vieja se usaba en otro lugar | Verificado: `ListaContactos` solo se usa en `/crm/contactos`; `obtenerContactos` sigue igual para Pipeline. |

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Datos derivados escritos en línea (`ultimaInteraccionEn`, `esperandoRespuestaDesde`) en vez de por suscriptor de eventos (principio III) | Son datos en la misma base, no efectos externos. La lista debe reflejarlos en el mismo render en que el agente ve el mensaje. `updateMany` condicional los hace idempotentes y tolerantes al desorden. | Suscriptor a 4 eventos: consistencia eventual en la pantalla principal y más piezas para un `UPDATE` de una fila. |
