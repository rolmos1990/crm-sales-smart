# Implementation Plan: Inbox agrupado por contacto

**Branch**: `feature/035-inbox-agrupado-contacto` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/035-inbox-agrupado-contacto/spec.md`

## Summary

El Inbox pasa de una lista plana de conversaciones a una lista agrupada por contacto, suma un aviso de
"también escribió por otro canal" dentro del chat y una sección de identidades de canal en el panel derecho.

La aproximación técnica es deliberadamente angosta: **toda la información ya está cargada en el cliente**.
`obtenerConversacionesInbox` trae las conversaciones con su contacto, su cuenta de canal y su último
mensaje, y `contactoSelect` ya pide los `identificadoresCanal` desde Postgres — que hoy se descartan en
`mapearConversacion`. Entonces no hay consultas nuevas: hay un derivado en memoria sobre el arreglo que ya
vive en el estado de `InboxLayout`, y un campo que se deja de tirar en el mapeo.

La decisión estructural que manda sobre todo lo demás: **la lógica de agrupación, agregación de badges y
selección del aviso va en un módulo puro `src/conversaciones/agrupacion.ts`**, sin React. El corredor de
tests unitarios del proyecto es Vitest con `environment: "node"` e `include: ["src/**/*.test.ts"]` — no hay
React Testing Library ni DOM, así que lo que no sea una función pura no se puede testear. Los componentes
`.tsx` quedan como presentación delgada sobre ese módulo.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 16.2 (App Router)

**Primary Dependencies**: ninguna nueva. Se reutiliza lo que el Inbox ya usa — `lucide-react`, `date-fns`,
`cn()`, tokens semánticos de Tailwind v4, y los primitivos existentes de `src/components/ui/`.

**Storage**: N/A — esta feature no lee ni escribe en Postgres. El único cambio del lado del servidor es de
**mapeo**: `mapearConversacion` deja de descartar `identificadoresCanal`, que ya viene en el `select`.

**Testing**: Vitest (`npm run test:unit`) para `src/conversaciones/agrupacion.test.ts` — funciones puras,
sin DB ni DOM. Playwright (`npm run test:e2e:conversaciones`) para el recorrido del Inbox, extendiendo
`tests/e2e/conversaciones/inbox.spec.ts`.

**Target Platform**: navegador (escritorio y móvil), misma matriz de hoy. El Inbox ya es responsive con
corte en 768px.

**Project Type**: aplicación web — módulo de dominio `src/conversaciones/` con sus componentes.

**Performance Goals**: la agrupación es O(n) sobre el arreglo ya cargado. Con 200 conversaciones el derivado
debe ser imperceptible dentro del `useMemo` que ya se recalcula en cada cambio de filtro o búsqueda.

**Constraints**:
- **Cero consultas nuevas** (FR-019). Ni en la carga inicial, ni en el refresco de 30s, ni al expandir un
  grupo, ni al abrir el panel de identidades.
- **Cero cambios en base de datos** — sin migración, sin campos nuevos, sin escrituras.
- **No tocar** `procesarMensajeEntrante`/`resolverContactoYConversacion`, el worker, los suscriptores de IA,
  Workflows ni `envio.ts` (FR-023).
- El universo visible sigue siendo el que ya carga el Inbox: abiertas + en espera + últimas 50 cerradas.

**Scale/Scope**: 4 archivos existentes tocados, 4 nuevos. Una pantalla (`/crm/inbox`).

## Constitution Check

*GATE: evaluado antes de Phase 0 y re-evaluado después del diseño de Phase 1.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Modular Business Architecture** | Todo queda dentro del módulo `src/conversaciones/`. Los componentes no tocan Prisma: siguen recibiendo `ConversacionResumen` ya mapeado. El único punto de contacto con persistencia es `queries.ts`, que ya existe y solo cambia el mapeo. No se introduce ninguna abstracción paralela. | ✅ Pasa |
| **II. Server-Enforced Business Rules** | La feature no introduce reglas de negocio, validación ni transiciones de estado. No hay entrada de usuario que validar: todo es derivado de solo lectura. Las acciones que sí mutan (abrir, cerrar, enviar) quedan intactas con su autorización actual. | ✅ Pasa (no aplica) |
| **III. Reliable Data and Events** | No hay escrituras, transacciones ni eventos nuevos. El SSE y el auto-refresco existentes se conservan sin cambios; la agrupación se recalcula sobre el estado que esos mecanismos ya actualizan. | ✅ Pasa (no aplica) |
| **IV. Replaceable Integrations** | No se toca ningún proveedor ni adaptador de canal. El canal se usa solo como dato de presentación (ícono y etiqueta), con el mismo criterio que ya aplica `infoCanal`. | ✅ Pasa (no aplica) |
| **V. Security and Quality (NO NEGOCIABLE)** | **Aislamiento de tenant**: no se agregan consultas, así que no hay superficie nueva; las existentes ya filtran por `instanciaId` de la sesión. **Datos personales**: las identidades de canal que se muestran son del mismo contacto cuya conversación el agente ya tiene abierta y autorizada — no se expone nada de otro tenant ni de otro contacto. **Tests proporcionales al riesgo**: unitarios en Vitest para el módulo puro de agrupación (donde está todo el riesgo real) y extensión del recorrido Playwright del Inbox. | ✅ Pasa |

**Technical Constraints de la constitución**:
- Sin dependencias nuevas ✅
- Sin migraciones Prisma ✅
- UI responsive y sin regresión de escritorio: el corte móvil actual (lista oculta al seleccionar) se
  conserva tal cual ✅
- Fechas: se usa el formato relativo que el Inbox ya aplica; no entra ninguna fecha a una consulta, así que
  no aplica la regla de zona de negocio ✅

**Veredicto**: sin violaciones. La sección *Complexity Tracking* queda vacía.

**Re-evaluación post-diseño (Phase 1)**: el diseño no introdujo ninguna violación nueva. Dos puntos que el
diseño aclaró y refuerzan el cumplimiento:

- El módulo `agrupacion.ts` es puro y no importa Prisma ni React — eso es exactamente la separación de capas
  que pide el Principio I, y queda escrito como restricción en `contracts/agrupacion.md`.
- `research.md` Decisión 7 detectó un riesgo de regresión real (el `instanciaId` del que dependen las
  plantillas y el botón de IA se deriva del selector que se reemplaza). Está cubierto con una verificación
  explícita en `quickstart.md`, Escenario 5 — Principio V, "una modificación no está completa si rompe algo
  que funcionaba".

## Project Structure

### Documentation (this feature)

```text
specs/035-inbox-agrupado-contacto/
├── spec.md              # Especificación (/speckit-specify)
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Phase 0 — decisiones de diseño con evidencia en código
├── data-model.md        # Phase 1 — modelo derivado en memoria (no hay cambios en Prisma)
├── quickstart.md        # Phase 1 — cómo validar la feature
├── contracts/
│   └── agrupacion.md    # Phase 1 — contrato del módulo puro de agrupación
├── checklists/
│   └── requirements.md  # Checklist de calidad del spec
└── tasks.md             # Phase 2 (/speckit-tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/conversaciones/
├── agrupacion.ts                      # NUEVO — lógica pura: agrupar, agregar badges, elegir aviso
├── agrupacion.test.ts                 # NUEVO — unitarios Vitest del módulo puro
├── types.ts                           # MOD — IdentidadCanalResumen + GrupoContacto + campo en ContactoResumen
├── queries.ts                         # MOD — mapearConversacion deja de descartar identificadoresCanal
└── components/
    ├── inbox-layout.tsx               # MOD — render agrupado + aviso de otro canal
    ├── grupo-contacto-inbox.tsx       # NUEVO — fila de persona + sus conversaciones
    ├── aviso-otro-canal.tsx           # NUEVO — banner dentro del chat
    ├── seccion-identidades-canal.tsx  # NUEVO — sección del panel derecho
    ├── panel-contacto-inbox.tsx       # MOD — monta la sección de identidades
    └── input-mensaje.tsx              # MOD — canal como etiqueta fija, no selector (FR-020)

tests/e2e/conversaciones/
└── inbox.spec.ts                      # MOD — recorrido de grupo, aviso e identidades
```

**Structure Decision**: se respeta la estructura por capacidad de negocio que ya usa el proyecto
(`src/[dominio]/[entidad]/`). No se crea ningún directorio nuevo: la feature es una extensión del módulo
`src/conversaciones/` existente. La separación entre `agrupacion.ts` (puro, testeable) y los `.tsx`
(presentación) es la única decisión estructural, y la impone el corredor de tests del proyecto —
ver `research.md`, Decisión 1.

## Complexity Tracking

> Sin violaciones de la constitución que justificar. Sección vacía a propósito.
