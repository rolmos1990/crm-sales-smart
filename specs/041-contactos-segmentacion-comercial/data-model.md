# Data Model: Segmentación comercial de Contactos (041)

Todos los cambios son **aditivos**: columnas con default o nulables, tablas nuevas, índices nuevos. Ningún dato existente se borra ni cambia de significado. Migración única: `prisma/migrations/<timestamp>_contactos_segmentacion_comercial/`.

## Enums nuevos

```prisma
/// El orden de declaración ES el orden de "ordenar por interés" (asc = Alto primero).
enum NivelInteres {
  ALTO
  MEDIO
  BAJO
  SIN_EVALUAR
}

enum OrigenClasificacion {
  MANUAL
  REGLA
  IA
}

enum DimensionClasificacion {
  INTERES
  PREFERENCIA_CONTACTO
}
```

## `Contacto` — campos nuevos

| Campo | Tipo | Default | Regla |
|---|---|---|---|
| `nivelInteres` | `NivelInteres` | `SIN_EVALUAR` | Valor vigente. Lo escriben personas (041) o la IA (042) si `nivelInteresFijado = false`. |
| `nivelInteresOrigen` | `OrigenClasificacion?` | `null` | `null` = nunca se clasificó. |
| `nivelInteresFijado` | `Boolean` | `false` | `true` tras un cambio manual. Ningún proceso automático escribe `nivelInteres` mientras sea `true`. |
| `nivelInteresActualizadoEn` | `DateTime?` | `null` | |
| `noContactarDesde` | `DateTime?` | `null` | No nulo = "No contactar". Solo una persona lo vuelve a `null`. |
| `noContactarOrigen` | `OrigenClasificacion?` | `null` | En 041 siempre `MANUAL`; la 042 podrá escribir `IA`. |
| `noContactarPorId` | `String?` | `null` | `UsuarioInstancia.id` de quien lo marcó (null si fue automático). |
| `ultimaInteraccionEn` | `DateTime?` | `null` | Hecho materializado (research D3). Solo avanza, nunca retrocede. |
| `esperandoRespuestaDesde` | `DateTime?` | `null` | Fecha del primer mensaje del contacto aún sin respuesta. Se limpia con cualquier respuesta, humana o automática. |

Sin cambios: `estado` (`EstadoContacto`) y `activo` siguen existiendo; la lista deja de mostrarlos (DT-06).

Índices nuevos:

```prisma
@@index([instanciaId, ultimaInteraccionEn])
@@index([instanciaId, nivelInteres])
@@index([instanciaId, esperandoRespuestaDesde])
@@index([instanciaId, noContactarDesde])
```

## `ContactoClasificacionHistorial` — tabla nueva

Traza de cada cambio de interés o de preferencia de contacto (FR-022, SC-006). Solo inserción.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `dimension` | `DimensionClasificacion` | |
| `valorAnterior` | `String?` | Para INTERES: un valor de `NivelInteres`; para PREFERENCIA_CONTACTO: `CONTACTABLE` / `NO_CONTACTAR`. |
| `valorNuevo` | `String` | Mismo dominio que `valorAnterior`. |
| `fijado` | `Boolean` | Estado de `nivelInteresFijado` después del cambio (false para PREFERENCIA_CONTACTO). |
| `origen` | `OrigenClasificacion` | |
| `usuarioInstanciaId` | `String?` | Quién lo hizo; `null` si fue automático o siembra. |
| `contactoId` | `String` | FK `Contacto`, `onDelete: Cascade` (el historial se va con el contacto, igual que sus conversaciones). |
| `instanciaId` | `String` | FK `Instancia`, `onDelete: Cascade`. |
| `creadoEn` | `DateTime @default(now())` | |

Índices: `@@index([contactoId, creadoEn])`, `@@index([instanciaId])`.

`valorAnterior`/`valorNuevo` como texto (no enum) porque la tabla guarda dos dominios distintos; la validación la hace el esquema Zod de la acción.

## `ConfiguracionEmpresa` — campos nuevos

| Campo | Tipo | Default | Regla |
|---|---|---|---|
| `diasSeguimientoPendiente` | `Int` | `3` | Entero ≥ 1. |
| `diasSeguimientoRecuperar` | `Int` | `7` | > `diasSeguimientoPendiente`. |
| `diasSeguimientoInactivo` | `Int` | `60` | ≥ `diasSeguimientoRecuperar`. |

Validación (Zod, en la acción de guardado): `1 ≤ pendiente < recuperar ≤ inactivo ≤ 3650`.

## Índices en tablas existentes (aditivos)

| Tabla | Índice | Motivo |
|---|---|---|
| `Pedido` | `@@index([contactoId])` | `EXISTS` de Cliente |
| `Cotizacion` | `@@index([contactoId])` | señal de Interesado |
| `OportunidadContacto` | `@@index([contactoId])` | señal de Interesado |
| `Actividad` | `@@index([contactoId, completada, fecha])` | actividad pendiente vencida / no vencida |
| `ContactoIdentificadorCanal` | `@@index([contactoId, canal])` (reemplaza `[contactoId]`) | filtro por canal |

## Conceptos derivados (no se guardan)

Definidos en `src/crm/contactos/segmentacion/condiciones.ts` (research D1). `ahora` y los cortes los calcula el llamador con la zona del negocio.

| Concepto | Condición |
|---|---|
| **Cliente** | `pedidos.some(construirCondicionVenta(etapas))` |
| **Señal objetiva** | oportunidad vinculada con `fechaGanada = null` y `fechaPerdida = null`, **o** cotización en `BORRADOR`/`REVISADA`/`APROBADA`/`ENVIADA` (mismo conjunto que `calculo-objetivo.ts`) |
| **Interesado** | `nivelInteres ∈ {ALTO, MEDIO}` **o** (señal objetiva **y no** (`nivelInteres = BAJO` y `nivelInteresFijado`)) |
| **Lead** | no Cliente y no Interesado |
| **Referencia de fecha** | `ultimaInteraccionEn`, o `creadoEn` si es nula |
| **Actividad pendiente vencida** | actividad del contacto con `completada = false` y `fecha < ahora` |
| **Actividad pendiente vigente** | `completada = false` y `fecha ≥ ahora` |

**Seguimiento** (FR-028, en orden; el primero que aplica gana):

| # | Estado | Condición |
|---|---|---|
| 1 | Pendiente | `esperandoRespuestaDesde ≠ null` **o** actividad pendiente vencida |
| 2 | Al día | actividad pendiente vigente **o** referencia ≥ corte Pendiente |
| 3a | Pendiente | Interesado, `noContactarDesde = null`, no (BAJO y fijado), corte Recuperar ≤ referencia < corte Pendiente |
| 3b | Por recuperar | mismas condiciones que 3a, referencia < corte Recuperar |
| 4 | Inactivo | referencia < corte Inactivo |
| 5 | Al día | resto |

**Cortes**: `corte X = inicio del día de hoy en la zona del negocio − díasX días`, calculado con los helpers de `src/shared/fechas/rangos.ts`. "Más reciente que el umbral" es `referencia ≥ corte` (`gte`) y "igual o más antigua" es `referencia < corte` (`lt`), rangos semiabiertos. Con los defaults: interacción hace 2 días → Al día; hace 4 días → Pendiente; hace 9 días → Por recuperar; hace 70 días → Inactivo. Los tests fijan los bordes exactos (referencia igual al corte cae del lado "más reciente").

**Tramos de prioridad** (orden por defecto, research D2): T1 = `esperandoRespuestaDesde ≠ null`; T2 = Pendiente ∧ ¬T1; T3 = Por recuperar ∧ ¬T1 ∧ ¬T2; T4 = resto.

**Recomendación** (FR-031): función pura sobre la fila ya cargada (seguimiento, tipo, interés, preferencia), no es filtro de base de datos. Valores: `NO_CONTACTAR`, `RESPONDER`, `RETOMAR_CONVERSACION`, `CONTACTAR_HOY`, `DAR_SEGUIMIENTO`, `OFRECER_NOVEDADES`, `EVALUAR`, `SIN_URGENCIA`.

## Transiciones de estado

**Interés**

```
SIN_EVALUAR ──manual──▶ cualquier valor (fijado=true)
cualquier valor (fijado=false) ──IA (042) / siembra──▶ otro valor (fijado=false)
cualquier valor (fijado=true) ──manual──▶ otro valor (fijado=true)
cualquier valor (fijado=true) ──"liberar" manual──▶ SIN_EVALUAR (fijado=false)
cualquier valor (fijado=true) ──automático──▶ ✗ rechazado
```

**Preferencia de contacto**

```
CONTACTABLE ──manual o IA (042)──▶ NO_CONTACTAR
NO_CONTACTAR ──manual──▶ CONTACTABLE
NO_CONTACTAR ──automático──▶ ✗ rechazado (la función de servicio no acepta origen ≠ MANUAL para esta transición)
```

Cada transición válida escribe la fila de `Contacto` y una fila de `ContactoClasificacionHistorial` en la **misma transacción**, y publica su evento después del commit.

## Migración de datos (una vez, idempotente)

Script `scripts/041-sembrar-interes-contactos.ts`, por instancia y en lotes:

1. `ultimaInteraccionEn` = máximo de: mensajes `CONTACTO` y `AGENTE_CANAL_NATIVO` (no notas internas) de sus conversaciones, `creadoEn` de sus actividades que no crearon un Workflow ni un disparador (`metadata` sin `workflowEjecucionId` ni `disparadorId`), `creadoEn` de sus pedidos. Solo filas con valor nulo.
2. `esperandoRespuestaDesde` = `creadoEn` del último mensaje no-nota, no-`SISTEMA` del contacto, si ese mensaje es `CONTACTO`; si no, `null`. Solo filas con valor nulo.
3. `nivelInteres` desde `PerfilClienteSnapshot.datosInterpretados.intencionComercialActual` (tabla en research D10). Solo filas con `nivelInteresOrigen` nulo. Una fila de historial por contacto sembrado (origen IA, sin usuario).

Correrlo dos veces no cambia nada (cada paso filtra por "todavía nulo").
