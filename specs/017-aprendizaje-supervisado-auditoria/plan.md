# Implementation Plan: Registro de aprendizaje supervisado y auditoría de respuestas de IA

**Branch**: `017-aprendizaje-supervisado-auditoria` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-aprendizaje-supervisado-auditoria/spec.md`

## Summary

Los datos ya existen repartidos entre `UsoIA`, `SeleccionEstrategiaLog` (`011`) y `RespuestaPendienteRevision` (`016`, solo camino de revisión). El enfoque: extender `RespuestaPendienteRevision` con las columnas que le faltan (producto identificado, ejemplos usados, herramientas ejecutadas, confianza, motivo de transferencia, evaluación posterior) y **generalizar su creación** para que el suscriptor de `016` cree una fila también en el camino `ENVIAR` (auto-enviado), no solo en `PENDIENTE` — con un nuevo campo `estado: ENVIADA_AUTOMATICAMENTE` que se suma a los ya definidos por `016`. Se persiste además el motivo de `transferir_a_humano` (hoy solo texto de respuesta de la tool, no guardado). El insumo hacia `014` se resuelve pasando las correcciones registradas (`estado` con edición) como contexto adicional del análisis ya existente, sin nueva escritura hacia `AgenteIAConfig`.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.2 App Router), sin cambios de versión

**Primary Dependencies**: Ninguna nueva — reutiliza infraestructura de `009`, `011`, `014`, `016`

**Storage**: PostgreSQL vía Prisma — columnas aditivas en `RespuestaPendienteRevision` (de `016`) + 1 tabla nueva `EvaluacionRespuestaIA`

**Testing**: Vitest para el ensamblado del registro completo (dado los resultados intermedios de una generación — estrategia, ejemplos, tools ejecutadas, confianza — arma el registro con todos los campos disponibles) y para el enforcement de "nunca escribe en AgenteIAConfig"

**Target Platform**: Web — `src/ai/autonomia/` (extendido, de `016`), `src/ai/tools/providers/transfer.tool.ts` (extendido)

**Project Type**: Web application — mismo proyecto Next.js único (VSA)

**Performance Goals**: N/A — el registro es una escritura adicional dentro del mismo flujo del suscriptor, sin llamadas de red nuevas más allá de lo ya generado por la respuesta misma

**Constraints**: FR-010 — el registro nunca debe bloquear el envío/generación real; toda escritura de traza va en un `try/catch` que solo loguea el error sin propagarlo

**Scale/Scope**: extensión de columnas en una tabla ya definida por `016`, 1 tabla nueva pequeña (`EvaluacionRespuestaIA`), cambios puntuales en el suscriptor y en `transfer.tool.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Modular Business Architecture | PASS — se extiende `src/ai/autonomia/` (dueño natural de `RespuestaPendienteRevision` tras `016`); no se crea un módulo de "auditoría" paralelo que dupliegue esa tabla. |
| II. Server-Enforced Business Rules | PASS — agregar una evaluación posterior es una Server Action explícita; el uso de correcciones como insumo de `014` pasa por su Server Action ya existente (`ejecutarAnalisisPiloto`), no por una escritura directa. |
| III. Reliable Data and Events | PASS — el registro de traza es un side effect tolerante a fallo (FR-010), nunca bloqueante de la operación principal (enviar/dejar pendiente la respuesta). |
| IV. Replaceable Integrations | PASS — no se introduce ningún acoplamiento nuevo a un proveedor de IA; los campos de modelo/proveedor ya vienen de `UsoIA`, agnóstico de proveedor. |
| V. Security and Quality (NON-NEGOTIABLE) | PASS — `EvaluacionRespuestaIA` lleva `instanciaId` indexado (FR-011); no se registra el contenido completo de prompts sensibles en ningún log nuevo, solo en las columnas ya definidas de la tabla (que ya es de acceso restringido por instancia). |

No hay violaciones. **Complexity Tracking no aplica**.

*Re-chequeo post-diseño (Fase 1)*: `data-model.md` solo agrega columnas aditivas y una tabla pequeña sin nuevas relaciones hacia proveedores de IA. Gate confirmado sin excepciones.

## Project Structure

### Documentation (this feature)

```text
specs/017-aprendizaje-supervisado-auditoria/
├── plan.md              # This file
├── research.md          # Phase 0 output — qué campos vienen de dónde, cómo se ensambla el registro
├── data-model.md        # Phase 1 output — columnas nuevas + EvaluacionRespuestaIA
├── contracts/           # Phase 1 output — ensamblado del registro + Server Actions de evaluación
└── quickstart.md        # Phase 1 output — guía de validación manual
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma                          # columnas nuevas en RespuestaPendienteRevision (016);
                                             # EvaluacionRespuestaIA (nuevo)

src/
└── ai/
    ├── autonomia/
    │   ├── registro.ts                    # NUEVO — ensamblarRegistroRespuesta(...) reúne estrategia/ejemplos/
    │   │                                   # tools/confianza/versión/modelo/tiempo en un solo objeto
    │   ├── actions.ts                     # extendido — agregarEvaluacion, y crearRespuestaPendiente (016)
    │   │                                   # ahora también cubre el camino ENVIADA_AUTOMATICAMENTE
    │   └── generar-respuesta-ia.suscriptor.ts  # extendido — llama a registro.ts en AMBOS caminos (ENVIAR y PENDIENTE)
    ├── piloto/
    │   └── analizador.ts                  # extendido — recibe correcciones registradas como insumo adicional (014)
    └── tools/
        └── providers/
            └── transfer.tool.ts           # extendido — persiste el motivo en el registro de la respuesta actual
```

**Structure Decision**: Ningún módulo nuevo — todo vive como extensión de `src/ai/autonomia/` (dueño de la tabla desde `016`) y ajustes puntuales en `014`/`transfer.tool.ts`. Es la spec más "de consolidación" del plan completo: no introduce ningún concepto de dominio nuevo, conecta trazabilidad ya existente.

## Complexity Tracking

> No aplica — sin violaciones de Constitution Check que justificar.
