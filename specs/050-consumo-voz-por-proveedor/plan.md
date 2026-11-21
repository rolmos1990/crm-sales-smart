# Implementation Plan: Consumo de voz por proveedor

**Branch**: `feature/050-consumo-voz-por-proveedor` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/050-consumo-voz-por-proveedor/spec.md`

**Tipo**: Feature (el desglose por proveedor es una capacidad que Karia nunca tuvo; las tarjetas
de total funcionan como se prometieron). Ciclo completo según `docs/SPEC-KIT-WORKFLOWS.md`.

**Base**: `main` @ `b0949f7`, que ya incluye `049-proveedores-de-voz` y el proveedor Groq.

## Summary

Hoy la pestaña de Voz muestra dos tarjetas con el total de la cuenta y nada más
(`src/configuracion/components/tab-voz.tsx:35-55`). Con dos o más proveedores configurados —que
es justo el escenario que 049 habilitó— el comercio no puede saber cuánto le cuesta cada uno.

**El dato ya está persistido y no hace falta migración.** `UsoVoz` guarda `proveedorVozId`,
`modelo` y `costoEstimado` ya materializado con la tarifa vigente al transcribir
(`prisma/schema.prisma:4519-4540`), y `src/voz/transcribir.ts:133,158` escribe una fila por
intento, con éxito y sin él. La feature es un cambio de **lectura y presentación**: no toca el
proceso de transcripción, ni la selección de proveedor, ni el registro de uso.

Tres decisiones estructuran la implementación (detalle en [research.md](./research.md)):

- **Un solo `groupBy`, y el total del mes se deriva de él.** No se corren dos consultas
  independientes —una para el total y otra para el desglose— porque entonces FR-004 ("las cifras
  cuadran") sería una coincidencia que algún día deja de cumplirse. Sumando los grupos el total
  es idéntico por construcción: `SUM(x)` sobre todas las filas ES la suma de los `SUM(x)` por
  grupo. FR-003 se cumple sin cambiar nada del cálculo.
- **El redondeo se reparte, no se aplica fila por fila.** Tres proveedores con 12.34 min cada uno
  se muestran como 12.3 + 12.3 + 12.3 = 36.9, mientras que la tarjeta dice 37.0. Es el único
  modo en que esta pantalla puede contradecirse a sí misma, y con 2–4 proveedores pasa seguido.
  Un reparto por resto mayor (~25 líneas, `reparto.ts`) lo elimina de raíz.
- **"Costo parcial" es un estado distinto de "costo cero" y de "sin costo".** `_sum` de Prisma
  ignora los NULL: un proveedor al que le cargaron la tarifa a mitad de mes devuelve un monto
  que parece completo y no lo es. Se detecta comparando `_count.costoEstimado` contra
  `_count._all` en el mismo `groupBy`, sin consulta extra.

Sin dependencias nuevas. Sin cambios de esquema. Sin backfill: el histórico ya registrado queda
desglosado retroactivamente al desplegar (FR-011).

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 15 (App Router, Server Components), Prisma 7, React 19,
Tailwind v4 / shadcn. **Sin dependencias nuevas.**

**Storage**: PostgreSQL. **Cero cambios de esquema** — se leen `UsoVoz` y `ProveedorVoz` tal como
están. Sin migración, sin índice nuevo: el `where` ya lo cubre `@@index([instanciaId, creadoEn])`
(`prisma/schema.prisma:4538`) y el agrupado corre sobre ese subconjunto ya filtrado.

**Testing**: Vitest sobre funciones puras —el reparto de redondeo, la fusión proveedores↔consumo
y la forma del `where`/`groupBy` con Prisma mockeado, igual que `src/voz/limites.test.ts`.
Sin Playwright: la pantalla es de solo lectura y no agrega interacción (FR-002, FR-013), así que
un E2E solo verificaría que el servidor renderiza texto. Verificación manual en
[quickstart.md](./quickstart.md).

**Target Platform**: app Next.js. **Nada de esto corre en el worker** — es una pantalla de
configuración. El worker sigue leyendo `UsoVoz` por su cuenta en `src/voz/limites.ts` y no se
toca.

**Project Type**: Web application (Next.js App Router, monorepo único).

**Performance Goals**: la pestaña de Voz mantiene su costo actual de 2 consultas a `UsoVoz`
(hoy un `aggregate` de hoy + uno del mes; después un `aggregate` de hoy + un `groupBy` del mes).
SC-005 se cumple por no agregar viajes a la base.

**Constraints**:
- El tab sigue siendo Server Component; sin estado de cliente ni carga diferida (FR-013).
- `apiKeyEncriptada` nunca sale al cliente; el `select` explícito de `obtenerProveedoresVoz` está
  así a propósito y se mantiene (FR-012).
- Los cortes de día/mes salen de `obtenerZonaNegocio`, nunca del navegador (FR-009, regla 7 de
  `CLAUDE.md`).
- Las dos tarjetas de total no cambian de cálculo, significado ni presentación (FR-003).

**Scale/Scope**: 1–5 proveedores por cuenta en la práctica; del orden de cientos a miles de filas
de `UsoVoz` por cuenta y mes. El agrupado es irrelevante a esa escala.

## Constitution Check

*GATE: pasa antes de Phase 0 y se vuelve a evaluar después de Phase 1.*

| Principio | Evaluación | Estado |
|---|---|---|
| **I. Modular Business Architecture** | La lectura vive en `src/configuracion/voz/queries.ts`, junto a la que ya existe. `ListaProveedoresVoz` es un Client Component que recibe datos por props y **no** toca Prisma. No se crea una abstracción paralela: se extiende `obtenerResumenUsoVoz`. | ✅ |
| **II. Server-Enforced Business Rules** | Feature de solo lectura: no hay mutación, ni transición de estado, ni entrada de usuario que validar. El filtro por `instanciaId` se aplica en el servidor (FR-010). | ✅ |
| **III. Reliable Data and Events** | Sin escrituras, sin transacciones, sin eventos, sin efectos de borde. No aplica. | ✅ |
| **IV. Replaceable Integrations** | No se llama a ningún proveedor externo. Se leen registros de uso ya persistidos; los adaptadores de `src/voz/proveedores/` no se tocan. | ✅ |
| **V. Security and Quality (NON-NEGOTIABLE)** | Toda consulta lleva `instanciaId` (FR-010). Ninguna credencial llega al cliente (FR-012). Tests unitarios proporcionales al riesgo real, que acá es aritmético: reparto de redondeo, fusión, y forma del `where`. | ✅ |
| **Technical Constraints** | Stack aprobado, sin dependencias nuevas, **sin migración Prisma** (nada destructivo que evaluar). La UI no cambia de layout ni de comportamiento en desktop; solo agrega una línea de texto por fila. | ✅ |
| **Development Workflow** | Spec previo con alcance, criterios, casos borde y exclusiones; supuestos documentados en `spec.md` § Assumptions. | ✅ |

**Resultado: pasa sin violaciones.** No se completa la tabla de Complexity Tracking.

**Re-evaluación post-Phase 1**: el diseño no introdujo ninguna capa, tabla, dependencia ni
abstracción nueva — solo tres funciones puras y un cambio de consulta. Sigue pasando.

## Project Structure

### Documentation (this feature)

```text
specs/050-consumo-voz-por-proveedor/
├── plan.md              # Este archivo
├── research.md          # Phase 0: las 6 decisiones y sus alternativas descartadas
├── data-model.md        # Phase 1: formas de datos (sin cambios de esquema)
├── quickstart.md        # Phase 1: verificación manual end-to-end
├── contracts/
│   └── consumo-voz.md   # Phase 1: contrato de las funciones de lectura y la fusión
├── checklists/
│   └── requirements.md  # Checklist de calidad del spec (16/16)
└── tasks.md             # Phase 2 (/speckit-tasks — NO lo crea /speckit-plan)
```

### Source Code (repository root)

```text
src/configuracion/
├── voz/
│   ├── queries.ts              # MODIFICADO — obtenerResumenUsoVoz pasa a groupBy y
│   │                           #   devuelve el desglose; obtenerProveedoresVoz sin cambios
│   ├── reparto.ts              # NUEVO — reparto de redondeo por resto mayor (función pura)
│   ├── reparto.test.ts         # NUEVO — el invariante: Σ filas mostradas == total mostrado
│   ├── fusion.ts               # NUEVO — cruza proveedores configurados × consumo del mes,
│   │                           #   y extrae la entrada de proveedores eliminados (pura)
│   ├── fusion.test.ts          # NUEVO — sin consumo, huérfanos, varios eliminados, orden
│   ├── queries.test.ts         # NUEVO — forma del where/groupBy con Prisma mockeado
│   └── actions.ts              # SIN CAMBIOS
└── components/
    ├── tab-voz.tsx             # MODIFICADO — fusiona y pasa por props; tarjetas intactas
    └── lista-proveedores-voz.tsx  # MODIFICADO — línea de consumo por fila + fila de
                                   #   proveedores eliminados
```

**Structure Decision**: se respeta la organización por capacidad de negocio que ya usa el módulo
(`src/configuracion/voz/` para dominio y lectura, `src/configuracion/components/` para UI). Las
tres piezas nuevas son funciones puras en archivos propios porque son exactamente lo que hay que
testear sin base de datos; meterlas dentro de `queries.ts` las volvería inalcanzables para
Vitest sin mockear Prisma, que es el motivo por el que el reparto de redondeo —el punto más
frágil de la feature— merece su propio archivo.

## Phase 0 — Research

Completo en [research.md](./research.md). Seis decisiones:

1. Un `groupBy` del que se deriva el total, en vez de dos consultas independientes.
2. Reparto de redondeo por resto mayor para que Σ filas == total.
3. `_count.costoEstimado` vs `_count._all` para distinguir costo parcial de costo completo.
4. El grupo `proveedorVozId: null` como la entrada de proveedores eliminados (sin snapshot de alias).
5. Desglose solo del mes, no de "hoy".
6. Sin índice nuevo ni cambio de esquema.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — formas de datos de entrada y salida; **ningún cambio de esquema**.
- [contracts/consumo-voz.md](./contracts/consumo-voz.md) — firmas, invariantes y casos borde de
  `obtenerResumenUsoVoz`, `repartirRedondeo` y `fusionarConsumoProveedores`.
- [quickstart.md](./quickstart.md) — verificación manual de los cinco escenarios que importan.
