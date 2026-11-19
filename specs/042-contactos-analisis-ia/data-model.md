# Data Model: Análisis inteligente de Contactos (042)

Todas las migraciones son **aditivas**: tablas nuevas, columnas nulables o con
default, y valores nuevos en enums. No se modifican ni se borran datos
existentes (FR-056). Cada tabla lleva `instanciaId` con `onDelete: Cascade` y
un índice que empieza por `instanciaId` (FR-054).

`ContactoAnalisisCola` y `ContactoEvaluacion` tienen además FK a `Contacto` con
`onDelete: Cascade`: al eliminar un contacto desaparecen su cola y su
evaluación. `EjecucionAnalisisContactosItem.contactoId` **no** tiene FK, para
conservar el detalle auditado. La fila de cola es lo que la spec llama
"Contacto pendiente" cuando está en estado `PENDIENTE`.

---

## Cambios a modelos existentes

### `Contacto`

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| `puntajeComercial` | `Int?` | `null` | Copia del puntaje vigente para ordenar la tabla (research D15). Se escribe en la misma transacción que `ContactoEvaluacion`. 0–100 |

Índices nuevos: `@@index([instanciaId, puntajeComercial])` (orden de la tabla) y `@@index([instanciaId, creadoEn])` (barrido de reconciliación de contactos nuevos).

Relaciones nuevas: `evaluacion ContactoEvaluacion?`,
`colaAnalisis ContactoAnalisisCola?`.

### `UsoIA`

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| `tokensCacheados` | `Int` | `0` | Lo informa el proveedor cuando lo soporta (research D9) |

### `enum TareaIA`

Valor nuevo: `ANALISIS_CONTACTOS`. Se agrega también a `SolicitudIASchema` y a
los objetivos de enrutamiento (`casosDeUso`), así una cuenta puede asignarle un
proveedor y modelo (FR-023).

### `enum OrigenClasificacion`

Sin cambios. La IA ya existe como origen (041).

---

## Modelos nuevos

### `ConfiguracionAnalisisContactos` (1:1 con `Instancia`)

| Campo | Tipo | Default | Validación / Notas |
|---|---|---|---|
| `habilitado` | `Boolean` | `true` | Análisis con IA activo (Clarifications Q1). Las reglas corren siempre |
| `modoInteres` | `ModoAplicacionInteres` | `SOLO_SUGERIR` | FR-016 |
| `mesesAntiguedadInicial` | `Int` | `12` | 1–60. Filtro de la clasificación inicial con IA (Clarifications Q2) |
| `tamanoLote` | `Int` | `20` | 1–50 |
| `maxLotesSimultaneos` | `Int` | `1` | 1–10 |
| `presupuestoDiarioCosto` | `Decimal?` | `null` | Sin presupuesto propio por defecto (Clarifications Q3) |
| `presupuestoDiarioTokens` | `Int?` | `null` | Se usa si el proveedor no tiene costos |
| `ventanaAgrupacionSeg` | `Int` | `300` | 0–3.600 |
| `esperaMaximaSeg` | `Int` | `1800` | ≥ `ventanaAgrupacionSeg` |
| `historicoPausado` | `Boolean` | `false` | FR-030 |
| `peso` | `Int` | `1` | 1–10. Lo ajusta el equipo de Karia; no hay pantalla |
| `siguienteTurnoEn` | `DateTime` | `now()` | Planificador (research D2) |
| `lotesEnCurso` | `Int` | `0` | Se recalcula en la recuperación |
| `ultimaAtencionEn` | `DateTime?` | | Avance (FR-052) |
| `modoInteresCambiadoPorId` / `modoInteresCambiadoEn` | `String?` / `DateTime?` | | FR-050a |

Índice: `@@index([habilitado, siguienteTurnoEn])`. Se crea de forma perezosa
(research D16).

### `ContactoAnalisisCola` (1:1 con `Contacto`, permanente)

| Campo | Tipo | Notas |
|---|---|---|
| `contactoId` | `String @unique` | |
| `instanciaId` | `String` | |
| `estado` | `EstadoColaAnalisis` | AL_DIA · PENDIENTE · EN_PROCESO · FALLIDO |
| `prioridad` | `PrioridadAnalisis` | P0 · P1 · P2. Cuando la fila vuelve a AL_DIA, se reinicia a P2 |
| `tipo` | `TipoEjecucionAnalisis` | INICIAL · INCREMENTAL · REEVALUACION |
| `versionDatos` | `BigInt` | Monótona; sube en cada `marcarPendiente` (research D4) |
| `versionReclamada` | `BigInt?` | Versión que tomó el lote en curso |
| `forzarIA` | `Boolean` | Pedido explícito de un usuario (P0 manual, selección, segmento) |
| `primerMarcadoEn` | `DateTime?` | Base de la espera máxima |
| `elegibleDesde` | `DateTime` | Ventana de agrupación y backoff |
| `datosHasta` | `DateTime?` | Fecha de la última interacción considerada (barrido D3) |
| `intentos` | `Int` | Se reinicia al completar |
| `bloqueadoHasta` | `DateTime?` | Lease |
| `ultimaEjecucionId` | `String?` | |
| `motivo` | `String?` | Último motivo de marcado (`MENSAJE`, `PEDIDO`, `COTIZACION`, `OPORTUNIDAD`, `VENCIMIENTO`, `MANUAL`, `SEGMENTO`, `RECONCILIACION`, `INICIAL`, `CRITERIO`) |
| `actualizadoEn` | `DateTime @updatedAt` | |

Índices:

- Parcial (en SQL de la migración, `WHERE "estado" = 'PENDIENTE'`):
  `(instanciaId, prioridad, elegibleDesde)`.
- Parcial (`WHERE "estado" = 'EN_PROCESO'`): `(bloqueadoHasta)`.
- `@@index([instanciaId, estado])`, para el avance.

**Estados**:

```
AL_DIA ──marcarPendiente──▶ PENDIENTE ──reclamar──▶ EN_PROCESO
   ▲                            ▲                       │
   │                            │ datos nuevos o error   │ completar con
   └────── completar con ───────┤ (intentos < 5)         │ versión igual
          versión igual         │                        │
                                │ lease vencido          ▼
                                └───────────────── EN_PROCESO
EN_PROCESO ──error con intentos ≥ 5──▶ FALLIDO ──"Reintentar fallidos"──▶ PENDIENTE
```

**Reglas de `marcarPendiente`** (upsert):

- `versionDatos += 1` y la prioridad pasa a `min(actual, nueva)` (P0 < P1 <
  P2). Si la fila estaba `EN_PROCESO`, conserva ese estado.
- Si estaba `AL_DIA` o `FALLIDO` → `PENDIENTE`, con `primerMarcadoEn = now` e
  `intentos = 0` (si venía de `FALLIDO`, solo por la acción manual).
- `elegibleDesde = inmediato ? now : min(now + ventana, primerMarcadoEn +
  esperaMaxima)`.

### `ContactoEvaluacion` (1:1 con `Contacto`, resultado vigente)

| Campo | Tipo | Notas |
|---|---|---|
| `contactoId` | `String @unique` | |
| `instanciaId` | `String` | |
| `origen` | `OrigenEvaluacion` | REGLA · IA |
| `relacionComercial` | `RelacionComercial` | PROSPECTO · CLIENTE · CLIENTE_RECURRENTE · CLIENTE_INACTIVO. Foto al momento; no es fuente de filtros |
| `puntaje` | `Int` | 0–100 |
| `puntajeBase` | `Int` | 0–60 |
| `ajusteIA` | `Int?` | −40…40 |
| `intencion` | `IntencionCompra?` | ALTA · MEDIA · BAJA · DESCONOCIDA (null si nunca hubo IA) |
| `urgencia` | `NivelUrgencia?` | ALTA · MEDIA · BAJA |
| `recuperacion` | `NivelRecuperacion?` | ALTA · MEDIA · BAJA · NO_APLICA |
| `senalesReglas` / `motivosReglas` | `Json` | `string[]`. Las reescriben las reglas en **cada** evaluación |
| `senales` / `objeciones` / `motivos` | `Json` | `string[]` (hasta 5 de 120 caracteres). Solo de la IA; una evaluación solo por reglas **no** los toca (así un pedido nuevo no borra lo que la IA leyó) |
| `accionIA` | `AccionComercial?` | Última acción sugerida por la IA |
| `accionSugerida` | `AccionComercial` | Acción visible: la de las reglas si es RESPONDER/NO_CONTACTAR (FR-021); si no, `accionIA`; si no, la de las reglas |
| `versionEvaluada` | `BigInt` | Guarda de escritura (research D4) |
| `iaHasta` | `DateTime?` | Último mensaje que vio la IA (embudo D5) |
| `evaluadoEn` / `evaluadoIAEn` | `DateTime` / `DateTime?` | |
| `proximaEvaluacionEn` | `DateTime?` | |
| `criterioVersionId` | `String?` | FK a `CriterioAnalisisContactosVersion`, `onDelete: SetNull` |
| `plantillaAplicada` | `String?` | Cuando no hay criterio propio (`GENERAL`) |
| `ejecucionId` | `String?` | Atención que la produjo |
| `interesSugerido` | `NivelInteres?` | D14 |
| `interesSugeridoEstado` | `EstadoSugerencia?` | PENDIENTE · ACEPTADA · DESCARTADA · REEMPLAZADA |
| `noContactarSugerido` | `Boolean` | default `false` |
| `noContactarMotivo` | `String?` | Descripción con palabras propias (FR-017a) |
| `noContactarSugeridoEstado` | `EstadoSugerencia?` | |
| `noContactarResueltoEn` | `DateTime?` | Cuándo una persona aceptó o descartó la sugerencia; la IA no vuelve a sugerir sin un rechazo posterior |
| `sugerenciaResueltaPorId` / `sugerenciaResueltaEn` | `String?` / `DateTime?` | Quién aceptó o descartó |

Índices: `@@index([instanciaId, proximaEvaluacionEn])` (barrido) y
`@@index([instanciaId, interesSugeridoEstado])`.

**Escritura**: la transacción incluye `ContactoEvaluacion` (solo si
`versionEvaluada < versionReclamada`), `Contacto.puntajeComercial`, la cola y el
detalle de la atención. `actualizarInteres` (modo automático) y el evento
`ContactoAnalizado` van después del commit.

### `CriterioAnalisisContactos` (1:1 con `Instancia`)

| Campo | Tipo | Notas |
|---|---|---|
| `versionPublicadaId` | `String? @unique` | |
| `creadoEn` / `actualizadoEn` | | |

### `CriterioAnalisisContactosVersion`

| Campo | Tipo | Notas |
|---|---|---|
| `criterioId` | `String` | |
| `instanciaId` | `String` | |
| `numero` | `Int?` | Se asigna al publicar |
| `estado` | `EstadoVersionCriterio` | BORRADOR · PUBLICADA · ARCHIVADA. A lo sumo un BORRADOR por criterio |
| `plantillaOrigen` | `String` | `GENERAL`, `RETAIL`, `SERVICIOS`, `B2B` |
| `contenido` | `Json` | Ver `contracts/criterio.md`; validado con Zod al guardar y al publicar |
| `publicadaEn` | `DateTime?` | |
| `creadaPorId` / `publicadaPorId` | `String?` | |

Índice: `@@index([criterioId, estado])`.

### `EjecucionAnalisisContactos` (una fila por intento)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | cuid | |
| `instanciaId` | `String` | |
| `loteId` | `String` | Igual en reintentos y divisiones del mismo lote |
| `loteRaizId` | `String?` | Cuando es una división |
| `intento` | `Int` | |
| `tipo` | `TipoEjecucionAnalisis` | |
| `prioridad` | `PrioridadAnalisis` | |
| `modo` | `ModoEjecucionAnalisis` | REGLAS · IA |
| `estado` | `EstadoEjecucionAnalisis` | PENDIENTE · EN_CURSO · COMPLETADA · PARCIAL · FALLIDA · CANCELADA · ABANDONADA |
| `proveedorIAId` | `String?` | `onDelete: SetNull` |
| `proveedor` / `modelo` | `String?` | Texto, para que sobreviva al borrado del proveedor |
| `configAplicada` | `Json` | Tamaño de lote, criterio y versión, temperatura, alias. **Nunca claves** |
| `contactosPedidos` / `Procesados` / `Exitosos` / `Fallidos` | `Int` | |
| `tokensEntrada` / `tokensSalida` / `tokensCacheados` | `Int` | |
| `costoEstimado` | `Decimal?` | |
| `usoIAId` | `String?` | Trazabilidad con `UsoIA` |
| `duracionMs` | `Int?` | |
| `esperaColaMs` | `Int?` | `iniciadoEn − min(elegibleDesde)` del lote |
| `iniciadoEn` / `finalizadoEn` / `leaseHasta` | `DateTime` / `DateTime?` / `DateTime` | |
| `errorCodigo` | `String?` | `PROVEEDOR_TIMEOUT`, `PROVEEDOR_LIMITE`, `PROVEEDOR_ERROR`, `RESPUESTA_INVALIDA`, `SIN_PRESUPUESTO`, `INTERRUMPIDA` |
| `errorMensaje` | `String?` | Sanitizado y limitado a 300 caracteres |
| `creadoEn` | `DateTime` | |

Índices: `@@index([instanciaId, creadoEn])`, `@@index([estado, leaseHasta])`,
`@@index([loteId])`.

### `EjecucionAnalisisContactosItem` (retención de 90 días)

| Campo | Tipo | Notas |
|---|---|---|
| `ejecucionId` | `String` | `onDelete: Cascade` |
| `instanciaId` / `contactoId` | `String` | `contactoId` sin FK, para conservar el detalle si se borra el contacto |
| `estado` | `EstadoItemAnalisis` | EXITOSO · OMITIDO · INVALIDO · DESCARTADO_VERSION · FALLIDO |
| `antes` / `despues` | `Json?` | Resumen: `{relacion, puntaje, intencion, accion}` |
| `motivo` / `errorCodigo` | `String?` | |
| `procesadoEn` | `DateTime` | |

Índices: `@@index([instanciaId, contactoId, procesadoEn])`,
`@@index([procesadoEn])` (purga).

### `ResumenDiarioAnalisisContactos` (se conserva para siempre)

Clave `@@unique([instanciaId, dia])`, con `dia` como `String` `YYYY-MM-DD` en
la zona del negocio.

Campos: `atenciones`, `atencionesFallidas`, `contactosEvaluados`,
`contactosPorReglas`, `contactosConIA`, `contactosFallidos`, `tokensEntrada`,
`tokensSalida`, `tokensCacheados`, `costoEstimado`, `duracionTotalMs`,
`esperaTotalMs`.

---

## Enums nuevos

```text
ModoAplicacionInteres   SOLO_SUGERIR | APLICAR_AUTOMATICO
EstadoColaAnalisis      AL_DIA | PENDIENTE | EN_PROCESO | FALLIDO
PrioridadAnalisis       P0 | P1 | P2
TipoEjecucionAnalisis   INICIAL | INCREMENTAL | REEVALUACION
ModoEjecucionAnalisis   REGLAS | IA
EstadoEjecucionAnalisis PENDIENTE | EN_CURSO | COMPLETADA | PARCIAL | FALLIDA | CANCELADA | ABANDONADA
EstadoItemAnalisis      EXITOSO | OMITIDO | INVALIDO | DESCARTADO_VERSION | FALLIDO
OrigenEvaluacion        REGLA | IA
RelacionComercial       PROSPECTO | CLIENTE | CLIENTE_RECURRENTE | CLIENTE_INACTIVO
IntencionCompra         ALTA | MEDIA | BAJA | DESCONOCIDA
NivelUrgencia           ALTA | MEDIA | BAJA
NivelRecuperacion       ALTA | MEDIA | BAJA | NO_APLICA
AccionComercial         RESPONDER | NO_CONTACTAR | CONTACTAR_HOY | ENVIAR_COTIZACION |
                        DAR_SEGUIMIENTO | RESOLVER_OBJECION | REACTIVAR | OFRECER_NOVEDADES |
                        ESPERAR | SIN_ACCION
EstadoSugerencia        PENDIENTE | ACEPTADA | DESCARTADA | REEMPLAZADA
EstadoVersionCriterio   BORRADOR | PUBLICADA | ARCHIVADA
```

**Relación de `AccionComercial` con la recomendación de la 041**: el panel
muestra `calcularRecomendacion` de la 041 cuando da `NO_CONTACTAR` o `RESPONDER`
(FR-021). En cualquier otro caso muestra `accionSugerida`.

---

## Compatibilidad con el perfil del cliente (012)

- `PerfilClienteSnapshot` no cambia de forma.
- Tras una evaluación con IA, el ejecutor actualiza
  `PerfilClienteSnapshot.datosInterpretados` conservando el resto del JSON
  (FR-022).
- **No hay equivalencias aproximadas**: la salida del lote incluye
  `intencionComercial`, elegida de la misma lista `INTENCIONES_COMERCIALES`
  (`src/ai/estrategia/tipos.ts`) que usa hoy la extracción. Así el selector
  de estrategia y el gate de autonomía reciben exactamente los mismos valores
  que antes. Mapear ALTA a `LISTO_PARA_COMPRAR` se descartó porque cambiaría
  la estrategia del agente.
- La salida también incluye `productosConsultados`, `presupuestoConocido`,
  `ocasionActual` y `fechaRequerida`, para reemplazar sin pérdida a
  `extraccion-interpretada.ts`. Es el mismo shape de `DatosInterpretados`.
- Si la IA devuelve null en un campo, se conserva el valor anterior, igual que
  hoy ("nunca se borra").
- Lectores que deben seguir funcionando: `autonomia/gate.ts:39`,
  `contexto/capas/ejemplos-piloto.ts:31`, `contexto/capas/estrategia-activa.ts:40`
  y `contexto/capas/perfil-cliente.ts`.
