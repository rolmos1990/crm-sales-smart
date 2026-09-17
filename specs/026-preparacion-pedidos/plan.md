# Implementation Plan: Preparación de pedidos — tablero operativo con estados configurables

**Branch**: `main` (trabajo directo sobre main, por decisión del usuario) | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-preparacion-pedidos/spec.md`

## Summary

Un módulo nuevo (`/sales/preparacion`) con tablero kanban y vista de lista, donde cada empresa define sus
propios estados de preparación (de dos a los que necesite) y mueve pedidos entre ellos, registrando cuándo
empezó el armado, cuándo terminó y quién lo cerró. El avance se registra línea por línea, con cantidades
parciales, lo que habilita un resumen consolidado por producto para preparar por lote. El estado resultante
se muestra como chip secundario en la lista y el detalle de pedidos.

**Enfoque técnico**: máquina de estados propia e independiente del Flujo de Venta (decisión del usuario), con
la pertenencia al tablero **derivada** de la etapa del pedido y el registro de preparación **materializado
perezosamente** — porque `flujoVentaEtapaId` se escribe desde cuatro lugares distintos y engancharse a uno
solo dejaría pedidos fuera del tablero (research Decisión 1). Los movimientos usan compare-and-swap con
`updateMany` para resolver concurrencia sin agregar columna de versión. El kanban replica el patrón ya
probado de `pipeline-kanban-dinamico` con dnd-kit.

## Technical Context

**Language/Version**: TypeScript 5, Node 20.19+

**Primary Dependencies**: Next.js 15.5 (App Router), React 19.2, Prisma 7.8 (`@prisma/adapter-pg`), Zod 4,
React Hook Form 7.76, TanStack Table 8, dnd-kit (`core` 6.3 / `sortable` 10), Tailwind v4, shadcn/ui sobre
`@base-ui/react`, date-fns 4, sonner, lucide-react. Sin dependencias nuevas.

**Storage**: PostgreSQL vía Prisma. 5 modelos nuevos, 2 enums nuevos, 3 campos nuevos en `PedidoLinea`,
relaciones inversas en `Pedido`/`Instancia`/`Usuario`/`FlujoVentaEtapa`. Migración aditiva, sin backfill.

**Testing**: Vitest (`src/**/*.test.ts`, lógica pura, sin DB ni browser) + Playwright (`tests/e2e/**`).

**Target Platform**: Aplicación web (desktop y móvil), servida por Next.js.

**Project Type**: Web app monolítica con App Router — dominio en `src/[dominio]/[entidad]/`, rutas en `src/app/`.

**Performance Goals**: Tablero con decenas de pedidos por rango (no miles). Primera carga del tablero en una
sola ronda de consultas paralelas (`Promise.all`); el bundle del kanban entra por `next/dynamic` para no
pesar en la carga inicial de otras páginas.

**Constraints**: Sin dependencias nuevas. Migración segura para datos existentes. Cero regresión en lista y
detalle de pedidos para instancias que no usen el módulo (FR-026). Fechas siempre en la zona horaria de
negocio, nunca la del navegador.

**Scale/Scope**: ~4 pantallas nuevas o modificadas (tablero, panel de configuración, lista de pedidos,
detalle de pedido), 4 historias de usuario, 38 requisitos funcionales.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|-----------|-----------|--------|
| **I. Modular Business Architecture** | Módulo nuevo bajo `src/sales/preparacion/` con la estructura canónica (`actions.ts`, `queries.ts`, `schema.ts`, `types.ts`, `servicios/`, `components/`). Ningún componente React toca Prisma: las páginas son Server Components y las mutaciones pasan por Server Actions. Extiende el módulo `sales` existente en vez de crear una abstracción paralela. | ✅ PASS |
| **II. Server-Enforced Business Rules** | Todas las transiciones pasan por `moverPreparacion` (servidor). Validación Zod al inicio de cada acción. Las reglas duras — un solo estado inicial/final, `cantidadPreparada <= cantidad`, prohibición de borrar un estado con pedidos, exigencia de estado destino al desactivar — se aplican en servidor; la UI solo las anticipa. | ✅ PASS |
| **III. Reliable Data and Events** | Movimiento de estado + fila de historial + sellado de fechas ocurren en una sola transacción. Los eventos de dominio se publican **después** del commit. El CAS con `updateMany` garantiza que dos movimientos concurrentes no se pisen. Publicar eventos es idempotente respecto del movimiento: un fallo de cola no revierte el estado. | ✅ PASS |
| **IV. Replaceable Integrations** | La feature no integra proveedores externos. No hay IA, ni mensajería, ni S3 involucrados. | ✅ N/A |
| **V. Security and Quality (NON-NEGOTIABLE)** | Toda query y mutación resuelve `instanciaId` desde la sesión; el cliente nunca lo envía. Módulo de permisos propio `preparacion`, separable de `pedidos`. Sin datos personales nuevos en logs. Tests proporcionales: Vitest para las reglas de negocio, Playwright para el recorrido crítico y la no-regresión del listado. | ✅ PASS |
| **Technical Constraints** | Stack aprobado, sin dependencias nuevas. Migración aditiva y reversible. UI responsive con tokens semánticos (`bg-card`, `text-foreground`, `border-border`), sin hex hardcodeados. Fechas con representación explícita en zona horaria de negocio, reutilizando `utils/fechas-zona.ts`. | ✅ PASS |
| **Development Workflow** | Spec con alcance, criterios de aceptación, reglas, casos borde y exclusiones; dos decisiones de negocio abiertas se elevaron al usuario y se resolvieron (ver Clarifications) en vez de inventarlas. | ✅ PASS |

**Resultado del gate**: PASS, sin violaciones. La sección "Complexity Tracking" queda vacía a propósito.

**Re-evaluación post-Phase 1**: sin cambios. El diseño no introdujo capas ni abstracciones extra: cinco
modelos, un servicio de transición, una query de tablero. La única decisión que merecía justificación —
máquina de estados propia en vez de reutilizar las etapas del Flujo de Venta — es una **decisión de producto
del usuario**, tomada con el trade-off explícito sobre la mesa (ver más abajo).

### Nota sobre la decisión de arquitectura del usuario

Durante el modelado se recomendó reutilizar `FlujoVentaEtapa` (misma máquina de estados, cero duplicación,
badge ya existente en pedidos). El usuario eligió eje propio por independencia respecto del estado comercial.
Consecuencias asumidas y registradas:

- Coexisten tres representaciones de "dónde está el pedido": etapa del flujo, estado de preparación y
  `EntregaPedido.estadoEntrega` (que ya tiene un valor `PREPARANDO`). Mitigación acordada: FR-036a exige
  bloques y etiquetas distinguibles; ninguna sincronización automática entre ejes (Decisión 8).
- Las reglas de validación y los disparadores del Flujo de Venta **no** aplican a las transiciones de
  preparación. Si más adelante se quieren, hay que construirlos o extender el motor existente.
- No se reutiliza `PedidoHistorialEtapa`: la preparación tiene su propio historial.

## Project Structure

### Documentation (this feature)

```text
specs/026-preparacion-pedidos/
├── plan.md              # Este archivo
├── spec.md              # Especificación (con Clarifications resueltas)
├── research.md          # Phase 0 — 11 decisiones técnicas
├── data-model.md        # Phase 1 — modelos, reglas, transiciones, índices
├── quickstart.md        # Phase 1 — guía de validación manual y automatizada
├── contracts/
│   ├── server-actions.md   # Queries, servicios, Server Actions, esquemas Zod
│   └── eventos.md          # Los 3 eventos de dominio y lo que NO emite evento
├── checklists/
│   └── requirements.md     # Checklist de calidad del spec (16/16)
└── tasks.md             # Phase 2 — lo genera /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                          # + 5 modelos, 2 enums, 3 campos en PedidoLinea
├── migrations/<timestamp>_preparacion_pedidos/
└── seed.ts                                # sin cambios (el default se crea perezosamente)

src/
├── app/
│   └── sales/
│       └── preparacion/
│           ├── page.tsx                   # Server Component: Promise.all(tablero, resumen, actividad)
│           └── loading.tsx                # skeleton
├── sales/
│   └── preparacion/
│       ├── actions.ts                     # Server Actions (mover, avance, configuración)
│       ├── queries.ts                     # obtenerTableroPreparacion, resumen, actividad, configuración
│       ├── schema.ts                      # esquemas Zod
│       ├── types.ts                       # tipos derivados con z.infer<>
│       ├── constantes.ts                  # etiquetas de rango y agrupación
│       ├── servicios/
│       │   ├── asegurar-flujo-preparacion.ts
│       │   ├── asegurar-preparacion-pedido.ts
│       │   ├── mover-preparacion.ts       # motor: CAS + sellado + historial + eventos
│       │   └── mover-preparacion.test.ts  # Vitest: reglas de sellado
│       ├── utils/
│       │   ├── avance.ts                  # avance derivado del pedido y de la línea
│       │   ├── avance.test.ts
│       │   ├── rangos.ts                  # "esta semana" sobre utils/fechas-zona de pedidos
│       │   └── rangos.test.ts
│       └── components/
│           ├── tablero-kanban.tsx         # dnd-kit, patrón de pipeline-kanban-dinamico
│           ├── tablero-lista.tsx
│           ├── tarjeta-preparacion.tsx
│           ├── preparacion-tabs-rango.tsx
│           ├── panel-config-preparacion.tsx
│           ├── resumen-por-producto.tsx
│           ├── actividad-reciente.tsx
│           └── chip-estado-preparacion.tsx   # reutilizado por lista y detalle de pedidos
├── sales/pedidos/
│   ├── queries.ts                         # + relación `preparacion` en incluirRelaciones
│   ├── types.ts                           # + preparacion?: ... | null
│   └── components/lista-pedidos.tsx       # + chip subordinado al badge de etapa
├── app/sales/pedidos/[id]/page.tsx        # + bloque "Preparación (armado)", separado de Entrega
├── shared/auth/permisos.ts                # + módulo "preparacion" en Modulo y en la matriz PERMISOS
├── shared/ui/app-sidebar.tsx              # + ítem "Preparación" en la sección VENTAS
└── eventos/
    ├── catalogo.ts                        # + 3 nombres de evento
    └── contratos/
        ├── preparacion-iniciada.event.ts
        ├── preparacion-completada.event.ts
        └── linea-pedido-preparada.event.ts

tests/e2e/sales/
└── preparacion.spec.ts                    # tablero E2E + chip en pedidos + no regresión

docs/
└── eventos.md                             # + los 3 eventos nuevos
```

**Structure Decision**: se sigue la estructura vigente del proyecto sin variantes — lógica de dominio en
`src/sales/preparacion/`, rutas en `src/app/sales/preparacion/`, primitivos en `src/components/ui/`
(no se crea ninguno nuevo: el tablero se arma con Card, Badge, Button, Select y Tabs existentes). El chip de
estado vive en el módulo de preparación y lo importan lista y detalle de pedidos, para no duplicar markup
entre módulos. Sin barrel files: imports directos al archivo fuente.

## Phase 0 — Research

Completo. 11 decisiones en [research.md](./research.md). Las tres que más condicionan la implementación:

1. **Pertenencia derivada + materialización perezosa** (Decisión 1) — porque hay cuatro escritores de
   `flujoVentaEtapaId`, dos de los cuales crean el pedido ya en su etapa inicial.
2. **CAS con `updateMany`** (Decisión 2) — concurrencia sin columna de versión.
3. **Coexistencia sin sincronización con `EstadoEntrega`** (Decisión 8) — resuelta por el usuario, con
   FR-036a como mitigación de la ambigüedad visual.

No quedan `NEEDS CLARIFICATION` abiertos. Un punto menor queda para confirmar durante la implementación sin
bloquearla: qué rol concreto usa el equipo de armado, para calibrar la matriz de permisos (Decisión 9).

## Phase 1 — Design & Contracts

Completo:

- [data-model.md](./data-model.md) — 5 modelos nuevos, 2 enums, cambios en `PedidoLinea`, reglas de
  validación, tabla de transiciones, 5 invariantes, índices por consulta y nota de migración.
- [contracts/server-actions.md](./contracts/server-actions.md) — 4 queries, 3 servicios, 10 Server Actions,
  esquemas Zod, mapa de `revalidatePath` y el contrato de no-regresión para la lista de pedidos.
- [contracts/eventos.md](./contracts/eventos.md) — 3 eventos con payload, momento de publicación y la lista
  explícita de lo que **no** emite evento.
- [quickstart.md](./quickstart.md) — 9 recorridos de validación manual trazados a FR/SC, más los comandos de
  test.

## Complexity Tracking

> Sin violaciones de la constitución que justificar. Sección intencionalmente vacía.
