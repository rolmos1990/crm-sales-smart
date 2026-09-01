# Data Model: Niveles de autonomía y automatización por intención

## `CategoriaIntencionAutonomia` (enum nuevo)

`SALUDO`, `CONSULTA_HORARIO`, `PREGUNTA_FRECUENTE`, `INFORMACION_GENERAL`, `RECOMENDACION`, `CONSULTA_PRECIO`, `CONSULTA_DISPONIBILIDAD`, `COSTO_ENVIO`, `SOLICITUD_COTIZACION`, `RECLAMO`, `SOLICITUD_REEMBOLSO`, `DESCUENTO_ESPECIAL`, `PROBLEMA_PAGO`, `EXCEPCION_ENTREGA`, `CLIENTE_MOLESTO`, `COMPROMISO_NO_DEFINIDO`.

## `NivelAutonomia` (enum nuevo)

`SUGGESTION_ONLY`, `AUTO_REPLY_SAFE_INTENTS`, `CONDITIONAL_AUTOMATION`, `HUMAN_ONLY`.

## `AutonomiaIntencionConfig` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `agenteIAConfigId` | `String` | FK a `AgenteIAConfig`, `onDelete: Cascade`. |
| `categoria` | `CategoriaIntencionAutonomia` | |
| `nivel` | `NivelAutonomia` | |
| `condicionesConfianza` | `Json?` | `{ confianzaMinimaClasificacion?: number; requiereAusenciaSenalClienteMolestoEnPerfil?: boolean }` — solo relevante cuando `nivel = CONDITIONAL_AUTOMATION` (research.md Decisión 4). |
| `actualizadoEn` | `DateTime @updatedAt` | |

Índices: `@@unique([agenteIAConfigId, categoria])`, `@@index([instanciaId])`.

**Invariante de compatibilidad (FR-004)**: la *ausencia total* de filas para un agente equivale al comportamiento anterior a esta spec (envío automático sin clasificar, `research.md` Decisión 3) — no es lo mismo que "todas las categorías en `AUTO_REPLY_SAFE_INTENTS`", aunque el efecto observable sea el mismo (evita el costo de clasificación). El seed (Decisión 1) sí crea filas para toda instancia nueva tras el despliegue de esta spec, aplicando ya la clasificación sugerida del pedido — instancias que ya existían antes del seed conservan el criterio de "sin filas = comportamiento anterior" hasta que el seed corra sobre ellas también (ver `tasks.md`, es una decisión de migración, no de diseño de datos).

## `RespuestaPendienteRevision` (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `instanciaId` | `String` | |
| `agenteIAConfigId` | `String` | |
| `conversacionId` | `String` | FK a `Conversacion`, `onDelete: Cascade`. |
| `categoriaDetectada` | `CategoriaIntencionAutonomia?` | `null` si la clasificación falló (Edge Case) pero igual quedó pendiente por otra razón — en la práctica, un fallo de clasificación no genera esta fila (Decisión 3/FR-010), así que este campo casi siempre tiene valor cuando la fila existe. |
| `mensajeCliente` | `String` | Copia del mensaje que originó la respuesta, para contexto del revisor. |
| `respuestaPropuesta` | `String` | |
| `motivoPendiente` | `String` | Texto explicativo (ej. "Categoría RECLAMO configurada como solo humano", "Confianza de clasificación 0.6, por debajo del mínimo 0.8 configurado"). |
| `estado` | `String` | `PENDIENTE` \| `ENVIADA_TAL_CUAL` \| `EDITADA_Y_ENVIADA` \| `DESCARTADA`. |
| `respuestaEditada` | `String?` | Solo si `estado = EDITADA_Y_ENVIADA` (FR-012). |
| `resueltaPorUsuarioId` | `String?` | |
| `resueltaEn` | `DateTime?` | |
| `creadoEn` | `DateTime @default(now())` | |

Índices: `@@index([instanciaId, estado])`, `@@index([conversacionId])`.

## Relación

```text
AgenteIAConfig 1───N AutonomiaIntencionConfig (una fila por categoría, 16 como máximo)
Conversacion 1───N RespuestaPendienteRevision (una por respuesta generada que no se auto-envió)
```

Sin cambios a ninguna tabla existente — `RespuestaPendienteRevision` es independiente de `Mensaje` (el mensaje real al cliente no existe hasta que un humano decide enviarlo, momento en el cual se crea vía `enviarMensaje` ya existente, exactamente igual que hoy).
