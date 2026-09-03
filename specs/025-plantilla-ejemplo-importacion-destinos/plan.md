# Implementation Plan: Plantilla de ejemplo para importar destinos y tarifas

**Branch**: `025-plantilla-ejemplo-importacion-destinos` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-plantilla-ejemplo-importacion-destinos/spec.md`

## Summary

En el paso "Subir archivo" del asistente de importación de destinos y tarifas de un transportista (`src/sales/transportistas/importacion-destinos/`), agregar una opción de descarga de plantilla de ejemplo (CSV o Excel) que muestre las columnas reconocidas, marque las obligatorias y traiga una fila de datos de muestra — generada en el navegador a partir de las constantes de dominio ya existentes (`COLUMNAS_DESTINO`, `ETIQUETAS_COLUMNA_DESTINO`, `COLUMNAS_DESTINO_REQUERIDAS` en `types.ts`), sin persistencia ni llamada al servidor.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 15 (App Router), React 19

**Primary Dependencies**: `xlsx` (^0.18.5) y `papaparse` (^5.5.3) — ya son dependencias del proyecto (usadas en `src/crm/datos/utils/parsear-archivo.ts` para parsear, y `papaparse`-equivalente manual en `src/sales/pedidos/utils/exportar-csv.ts` para exportar CSV); no se agrega ninguna dependencia nueva. UI con `Button`/`DropdownMenu` de `src/components/ui/`.

**Storage**: N/A — la plantilla no persiste en base de datos; se genera en memoria en el cliente a partir de constantes ya definidas en `types.ts` y se entrega como descarga de archivo (Blob).

**Testing**: Vitest para la función pura que arma el contenido de la plantilla (encabezados, fila de ejemplo, columnas obligatorias); no se agrega test Playwright dedicado — el patrón existente de descarga de archivo (`exportar-csv.ts`) tampoco lo tiene, y el riesgo es bajo (sin datos de tenant, sin mutación).

**Target Platform**: Web — navegador, dentro del CRM (misma pantalla que el asistente de importación de destinos existente)

**Project Type**: Web application (Next.js App Router) — estructura de proyecto única ya existente, no aplica "frontend/backend" separados

**Performance Goals**: Descarga percibida como instantánea (archivo de pocas filas, generado y descargado sin round-trip al servidor)

**Constraints**: No introducir dependencias nuevas (reutilizar `xlsx`/manual-CSV ya presentes); las columnas de la plantilla MUST derivarse de `COLUMNAS_DESTINO`/`ETIQUETAS_COLUMNA_DESTINO`/`COLUMNAS_DESTINO_REQUERIDAS` (no hardcodear una lista paralela) para que no queden desincronizadas si el dominio de columnas cambia

**Scale/Scope**: Archivo mínimo — 1 fila de encabezados + 1 fila de ejemplo (ver research.md Decisión 3 para si se agrega una segunda fila ilustrando alias múltiples)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Modular Business Architecture**: PASS. La lógica nueva vive dentro del módulo existente `src/sales/transportistas/importacion-destinos/` (un `utils/` nuevo + el componente `paso-archivo.tsx` ya existente). No se accede a Prisma desde componentes React — la generación de la plantilla es una función pura sin persistencia.
- **II. Server-Enforced Business Rules**: N/A — no hay estado de negocio, transición, ni cálculo monetario real involucrado; la plantilla es un artefacto ilustrativo estático en su forma, no una operación que el servidor deba autorizar o validar.
- **III. Reliable Data and Events**: N/A — no hay escritura en base de datos ni efectos secundarios (mensajes, eventos, colas). La descarga no dispara ningún evento de dominio.
- **IV. Replaceable Integrations**: N/A — no interviene ningún proveedor externo (WhatsApp, email, S3, IA).
- **V. Security and Quality (NON-NEGOTIABLE)**: PASS. No hay query ni mutation que requiera scoping por tenant (FR-007 exige explícitamente que la plantilla no contenga datos reales de ningún tenant). Se agrega un test unitario (Vitest) para la función generadora, proporcional al riesgo (bajo: sin dinero, sin datos sensibles, sin mutación).

Sin violaciones — no aplica la tabla de Complexity Tracking.

**Post-Design Re-check** (tras Phase 1): el diseño en `data-model.md`/`contracts/` confirma que no se agregó persistencia, mutación, evento de dominio ni dependencia de proveedor externo — los cinco principios se mantienen PASS/N/A sin cambios respecto al chequeo inicial.

## Project Structure

### Documentation (this feature)

```text
specs/025-plantilla-ejemplo-importacion-destinos/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/sales/transportistas/importacion-destinos/
├── actions.ts                            # (existente, sin cambios)
├── schema.ts                             # (existente, sin cambios)
├── types.ts                              # (existente, sin cambios — fuente de verdad de columnas)
├── utils/
│   ├── plantilla-ejemplo-destinos.ts     # NUEVO — función pura: arma { encabezados, fila(s) de ejemplo } a partir de COLUMNAS_DESTINO/ETIQUETAS_COLUMNA_DESTINO/COLUMNAS_DESTINO_REQUERIDAS
│   ├── plantilla-ejemplo-destinos.test.ts # NUEVO — test unitario de la función pura de arriba
│   ├── descargar-plantilla-destinos.ts   # NUEVO — wrapper browser-only: arma CSV (BOM + escape, mismo criterio que src/sales/pedidos/utils/exportar-csv.ts) o Excel (XLSX.utils.aoa_to_sheet + writeFile, mismo criterio que src/crm/datos/utils/parsear-archivo.ts) y dispara la descarga
└── components/
    ├── paso-archivo.tsx                  # MODIFICADO — agrega la opción de descarga (CSV / Excel) antes/junto al selector de archivo
    ├── paso-mapeo-columnas.tsx            # (existente, sin cambios)
    ├── paso-revision.tsx                  # (existente, sin cambios)
    ├── paso-confirmacion.tsx              # (existente, sin cambios)
    └── wizard-importacion-destinos.tsx    # (existente, sin cambios)
```

**Structure Decision**: Proyecto único (Next.js App Router ya existente). La feature extiende el módulo de dominio ya existente `src/sales/transportistas/importacion-destinos/` (Principio I — extender antes que crear abstracciones paralelas) en vez de reutilizar `src/crm/datos/utils/plantillas-config.ts` (que sirve archivos estáticos `.csv` desde `public/templates/` para el wizard genérico de CRM): ese mecanismo no cubre Excel ni columnas fijas por dominio con marcado de obligatoriedad, y esta importación ya tiene su propio conjunto de tipos/columnas separado a propósito de ese wizard genérico (ver nota en `types.ts` sobre US4/research.md §7 de la spec 024). Se separa la función pura de armado de contenido (testable en Vitest, `environment: "node"`) del wrapper que toca `Blob`/`document`/`XLSX.writeFile` (browser-only, sin test unitario — mismo criterio que `exportar-csv.ts`).

## Complexity Tracking

*Sin violaciones a justificar.*
