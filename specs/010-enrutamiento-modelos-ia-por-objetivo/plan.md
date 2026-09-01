# Implementation Plan: Enrutamiento de modelos de IA por objetivo

**Branch**: `010-enrutamiento-modelos-ia-por-objetivo` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-enrutamiento-modelos-ia-por-objetivo/spec.md`

## Summary

Karia ya soporta múltiples proveedores de IA por instancia y ya etiqueta cada llamada con un `TareaIA`, pero `seleccionarProveedor` solo prioriza por `TipoAgenteIA` (rol del agente) — el campo `ProveedorIA.casosDeUso` pensado para enrutar por objetivo existe en el schema y está muerto en el código. El enfoque: activar `casosDeUso` como el mapa `objetivo → proveedor preferido` de la instancia, desacoplar ese eje de selección del eje actual (`TipoAgenteIA`), y agregar un enum `IDENTIFICACION_PRODUCTO` a `TareaIA` más un parámetro opcional `requiereRazonamientoSuperior` en las solicitudes de `CHAT` para que un llamador pueda pedir el proveedor "superior" en vez del estándar. Todo con resguardo: sin asignación configurada, se preserva exactamente el criterio actual.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — Zod, Prisma 7, shadcn/ui `<Select>` (con la nota de `docs/selects.md`: como el value de cada proveedor no coincide con su etiqueta visible, el `<Select>` raíz debe recibir la prop `items`)

**Storage**: PostgreSQL vía Prisma — sin tablas nuevas; se activa `ProveedorIA.casosDeUso` (ya existente) y se agrega un valor al enum `TareaIA` (`IDENTIFICACION_PRODUCTO`)

**Testing**: Vitest para la función de resolución de proveedor por objetivo (`resolverProveedorPorObjetivo`) y para el fallback cuando no hay asignación o el proveedor asignado no está disponible

**Target Platform**: Web — `src/ai/orquestador/`, `src/configuracion/ia/`, tab IA de `/configuracion`

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: N/A — la resolución de proveedor por objetivo es una lectura adicional sobre datos ya cargados en memoria por `obtenerProveedoresActivos` (sin query extra)

**Constraints**: Cero cambio de comportamiento para instancias sin ninguna asignación configurada (FR-005, FR-010); el enum `TareaIA` solo puede crecer (valor nuevo aditivo), nunca renombrar/quitar valores existentes usados en `UsoIA` histórico

**Scale/Scope**: Toca `src/ai/orquestador/orquestador.ts` (lógica de selección), `src/configuracion/ia/schema.ts`/`actions.ts` (UI de asignación), y las firmas de `SolicitudIA`/`SolicitudConHerramientas` en `src/ai/gateway/types.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — se extiende `src/ai/orquestador/` y `src/configuracion/ia/` ya existentes; no se crea un módulo de "routing" paralelo. |
| II. Server-Enforced Business Rules | PASS — la asignación se valida server-side (Zod + verificación de que el proveedor esté activo, FR-003) antes de persistir; el enrutamiento efectivo ocurre en el gateway (servidor), nunca decidido por el cliente. |
| III. Reliable Data and Events | PASS — no hay eventos ni colas nuevas; la selección de proveedor sigue siendo síncrona dentro del gateway existente, con el mismo circuit breaker/fallback ya implementado. |
| IV. Replaceable Integrations | PASS — el enrutamiento decide *cuál* adaptador de proveedor usar, sin acoplar la lógica de negocio a un proveedor concreto; sigue pasando por `IProveedorIA` igual que hoy. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — toda asignación queda scoped a `instanciaId`; no se exponen API keys ni payloads de proveedor en la UI de asignación (solo nombre/etiqueta del proveedor); tests unitarios proporcionales al riesgo (lógica de selección, no UI). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` no agrega tablas — reutiliza `ProveedorIA.casosDeUso` y agrega un valor de enum. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/010-enrutamiento-modelos-ia-por-objetivo/
├── plan.md              # This file
├── research.md          # Phase 0 output — shape de casosDeUso, cómo desacoplar de TipoAgenteIA
├── data-model.md        # Phase 1 output — shape de ProveedorIA.casosDeUso, enum TareaIA extendido
├── contracts/           # Phase 1 output — contrato de resolverProveedorPorObjetivo + Server Actions de asignación
└── quickstart.md        # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                          # FR-001 — agregar IDENTIFICACION_PRODUCTO a enum TareaIA (aditivo)

src/
├── ai/
│   ├── orquestador/
│   │   └── orquestador.ts                 # FR-004..007 — nueva resolverProveedorPorObjetivo(instanciaId, tarea,
│   │                                       # requiereRazonamientoSuperior?) usando casosDeUso; seleccionarProveedor
│   │                                       # pasa a delegar en ella manteniendo compat con tipoAgenteIA
│   └── gateway/
│       ├── types.ts                       # FR-006 — SolicitudIA/SolicitudConHerramientas ganan
│       │                                   # requiereRazonamientoSuperior?: boolean (solo aplica a tarea CHAT)
│       └── gateway.ts                     # pasa el parámetro nuevo a resolverProveedorPorObjetivo
│
└── configuracion/
    └── ia/
        ├── schema.ts                      # FR-001..003 — AsignacionObjetivoIASchema nuevo
        ├── actions.ts                     # FR-001..003, FR-008 — guardarAsignacionesObjetivoIA,
        │                                   # obtenerAsignacionesObjetivoIA (con flag de "proveedor inválido")
        └── components/
            └── seccion-enrutamiento.tsx    # NUEVO — tabla de 7 objetivos con <Select> de proveedor c/u
```

**Structure Decision**: Extiende `src/ai/orquestador/` y `src/configuracion/ia/` ya existentes. La única pieza de UI nueva (`seccion-enrutamiento.tsx`) se integra como una sub-sección más de la tab IA, en el mismo lugar donde `009-perfil-agente-estructurado-versionado` ya reorganiza esa tab en secciones — ambas specs son compatibles entre sí sin conflicto de archivos (`009` toca la config del *agente*; `010` toca la config de *proveedores/instancia*, que ya vive en `form-proveedor-ia.tsx` como pantalla separada).

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
