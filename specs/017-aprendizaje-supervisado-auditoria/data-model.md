# Data Model: Registro de aprendizaje supervisado y auditoría de respuestas de IA

## `RespuestaPendienteRevision` (de `016` — columnas nuevas, aditivas)

| Campo nuevo | Tipo | Notas |
|---|---|---|
| `productoIdentificadoId` | `String?` | FK opcional a `Producto` (research.md Decisión 2). |
| `estrategiaUtilizadaId` | `String?` | Denormalizado desde `SeleccionEstrategiaLog` más cercano en tiempo — evita un join costoso en cada lectura del registro; se completa al ensamblar el registro, no requiere JOIN en cada consulta posterior. |
| `ejemplosUtilizadosIds` | `Json?` | `string[]` de `EjemploPrompt.id` (research.md Decisión 1). |
| `herramientasEjecutadas` | `Json?` | `string[]` de nombres de tool ejecutadas durante esta generación. |
| `confianza` | `Float?` | De la clasificación de `016` cuando exista. |
| `motivoTransferencia` | `String?` | Completado si `transferir_a_humano` se ejecutó durante esta generación (research.md Decisión 3). |
| `usoIAId` | `String?` | FK opcional a `UsoIA` — de ahí se resuelven versión del agente, modelo, tiempo y consumo por relación, sin duplicar esos campos (research.md Decisión 1). |

**Nota de nomenclatura**: esta spec no cambia el nombre de la tabla ni de sus columnas ya definidas por `016` — solo agrega las de arriba. Conceptualmente, tras esta spec, la tabla representa "todo registro de respuesta generada por el agente" (enviada o pendiente), no solo las pendientes; su enum `estado` (de `016`) gana un valor nuevo:

## `EstadoRespuestaRegistro` (extiende el `estado` string de `016` — ahora con un valor más)

`PENDIENTE` | `ENVIADA_TAL_CUAL` | `EDITADA_Y_ENVIADA` | `DESCARTADA` | **`ENVIADA_AUTOMATICAMENTE`** (nuevo — camino `ENVIAR` del gate de `016`, sin pasar por revisión).

## `EvaluacionRespuestaIA` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `respuestaId` | `String` | FK a `RespuestaPendienteRevision`, `onDelete: Cascade`. |
| `calificacion` | `String` | `BUENA` \| `NECESITA_MEJORA` (simple, research.md Decisión 4 — sin escala compleja). |
| `comentario` | `String?` | |
| `evaluadoPorUsuarioId` | `String?` | FK a `Usuario`, `onDelete: SetNull`. |
| `evaluadoEn` | `DateTime @default(now())` | |

Índices: `@@index([instanciaId])`, `@@index([respuestaId])`. Sin restricción de unicidad (Decisión 4 — más de una evaluación permitida).

## Relación

```text
RespuestaPendienteRevision (016, extendida) ──1:N──> EvaluacionRespuestaIA
        │
        ├── usoIAId ──────────> UsoIA (versión del agente, modelo, tiempo, consumo — por relación)
        ├── estrategiaUtilizadaId ──> PlaybookEstrategia (011)
        ├── ejemplosUtilizadosIds ──> EjemploPrompt[] (014, por id)
        └── productoIdentificadoId ──> Producto
```

Ninguna tabla existente pierde columnas ni cambia su forma previa — todo es aditivo sobre lo ya definido en `009`, `011`, `014` y `016`.
