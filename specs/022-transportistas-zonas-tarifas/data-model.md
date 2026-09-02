# Data Model: Gestión integral de transportistas — zonas, tarifas y condiciones

## `Transportista` (existente — extendido)

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `personaContacto` | `String?` | Opcional | Nuevo (FR-004) |
| `telefono` | `String?` | Opcional, validado si se completa (FR-005) | Nuevo |
| `correoElectronico` | `String?` | Opcional, validado si se completa (FR-005) | Nuevo |
| `notasInternas` | `String?` | Opcional | Nuevo |
| *(resto)* | — | `nombre` (obligatorio, FR-005), `tipo`, `activo` sin cambios | Existente |

Relaciones nuevas: `servicios ServicioTransportista[]`, `condiciones CondicionesTransportista?` (1-1), `historial TransportistaHistorial[]`. Se **elimina** la relación `coberturaGeografica` (modelo `TransportistaCoberturaGeografica` retirado, Decisión 1).

## `ZonaEntrega` (nuevo)

Catálogo reutilizable por empresa (FR-009), independiente de cualquier transportista.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String` | PK |
| `instanciaId` | `String` | FK `Instancia`, aislamiento (FR-055) |
| `nombre` | `String` | Obligatorio |
| `descripcion` | `String?` | Opcional |
| `activa` | `Boolean` | default `true` |
| `creadoEn`/`actualizadoEn` | `DateTime` | auditoría estándar |

`@@unique([instanciaId, nombre])` — mismo patrón que `ZonaCobertura` (spec 015).

Relación: `ubicaciones ZonaEntregaUbicacion[]` (1 a N, FR-010), `tarifas TarifaTransportistaZona[]`.

## `ZonaEntregaUbicacion` (nuevo)

Un punto geográfico dentro de una zona (FR-010/FR-011). Ver research.md Decisión 2 para el porqué de país-como-catálogo + resto-texto-libre.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String` | PK |
| `zonaEntregaId` | `String` | FK `ZonaEntrega` (Cascade) |
| `paisId` | `String` | FK `Pais` (catálogo global existente, spec 019), obligatoria |
| `provinciaEstado` | `String?` | Texto libre, opcional — vacío = comodín |
| `distritoCiudad` | `String?` | Texto libre, opcional — vacío = comodín |
| `corregimiento` | `String?` | Texto libre, opcional — vacío = comodín |
| `sectorOCodigoPostal` | `String?` | Texto libre, opcional — vacío = comodín |

`@@index([zonaEntregaId])`, `@@index([paisId])`.

## `ServicioTransportista` (nuevo)

Modalidad de envío ofrecida por un transportista concreto (FR-016).

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String` | PK |
| `transportistaId` | `String` | FK `Transportista` (Cascade) |
| `nombre` | `String` | Obligatorio; sembrado con "Estándar"/"Express"/"Personalizado" al crear el transportista |
| `descripcion` | `String?` | Opcional |
| `activo` | `Boolean` | default `true` |

`@@unique([transportistaId, nombre])`, `@@index([transportistaId])`.

## `TarifaTransportistaZona` (nuevo)

Costo/precio/margen para la combinación transportista+zona+servicio (FR-015). Ver research.md Decisión 5 y 6.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String` | PK |
| `instanciaId` | `String` | FK `Instancia`, aislamiento directo (FR-055) |
| `transportistaId` | `String` | FK `Transportista` (Cascade) |
| `zonaEntregaId` | `String` | FK `ZonaEntrega` |
| `servicioTransportistaId` | `String` | FK `ServicioTransportista` |
| `costoInterno` | `Decimal` | `>= 0` (FR-024) |
| `precioCliente` | `Decimal` | `>= 0` (FR-024); si `< costoInterno` se advierte, no se bloquea (FR-025) |
| `tiempoMinimoDias` | `Int?` | Opcional |
| `tiempoMaximoDias` | `Int?` | Opcional |
| `vigenteDesde` | `DateTime?` | Opcional |
| `vigenteHasta` | `DateTime?` | Opcional — fuera de rango = no disponible para nuevas cotizaciones (Edge Case) |
| `activa` | `Boolean` | default `true` |
| `creadoEn`/`actualizadoEn` | `DateTime` | auditoría estándar |

`@@unique([transportistaId, zonaEntregaId, servicioTransportistaId])` (FR-026 — un `@@unique` de BD, resguardo final ante condiciones de carrera además de la verificación en la Server Action). `@@index([instanciaId])`, `@@index([transportistaId, activa])`, `@@index([zonaEntregaId])`.

**Margen**: no es una columna — se calcula como `precioCliente - costoInterno` en cada lectura (Decisión 6).

**Eliminación (FR-020)**: solo permitida si `id` no aparece en ningún `EntregaCotizacion.tarifaTransportistaZonaId` ni `EntregaPedido.tarifaTransportistaZonaId` existente; en caso contrario, la Server Action solo permite `activa: false`.

## `CondicionesTransportista` (nuevo, 1-1 con `Transportista`)

Reglas generales de operación/restricciones/cobro (FR-029/030/031). No se duplica nada que ya viva en `TarifaTransportistaZona` (tiempo de entrega, peso — ver FR-033).

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String` | PK |
| `transportistaId` | `String` | FK `Transportista` (Cascade), `@unique` |
| `diasEntrega` | `Json` | Array de días de semana (ej. `["LUN","MAR","MIE","JUE","VIE","SAB"]`) |
| `horaLimiteMismoDia` | `String?` | Texto `"HH:mm"`, opcional |
| `tiempoPreparacionDias` | `Int` | default `0` |
| `permiteEntregaMismoDia` | `Boolean` | default `true` |
| `pesoMaximoKg` | `Decimal?` | Opcional |
| `requiereDireccionCompleta` | `Boolean` | default `true` |
| `permiteArticulosFragiles` | `Boolean` | default `true` |
| `permitePagoContraEntrega` | `Boolean` | default `false` — única fuente de verdad para esta regla (no se duplica en `Transportista` raíz ni en cada tarifa, ver Assumptions de spec.md) |
| `observaciones` | `String?` | Opcional |
| `metodoPagoTransportista` | `String?` | Texto libre corto (ej. "Transferencia", "Crédito 30 días") |
| `frecuenciaFacturacion` | `String?` | Texto libre corto (ej. "Semanal", "Quincenal") |
| `responsableCoordinacion` | `String?` | Texto libre |
| `instruccionesCoordinacion` | `String?` | Opcional |

## `TransportistaHistorial` (nuevo)

Auditoría (FR-051, Historia 6). Ver research.md Decisión 7 — mismo patrón que `PedidoHistorial`.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | `String` | PK |
| `instanciaId` | `String` | FK `Instancia`, aislamiento |
| `entidadTipo` | `enum TipoEntidadHistorialTransportista` | `TRANSPORTISTA \| TARIFA \| CONDICIONES \| ZONA_MANUAL \| COSTO_MANUAL` |
| `entidadId` | `String` | id de la fila afectada (`Transportista.id`, `TarifaTransportistaZona.id`, `CondicionesTransportista.id`, o `EntregaCotizacion.id`/`EntregaPedido.id` para los dos últimos tipos) |
| `accion` | `String` | ej. `"creado"`, `"editado"`, `"activado"`, `"desactivado"`, `"zona_cambiada_manualmente"`, `"costo_sobrescrito_manualmente"` |
| `valorAnterior` | `Json?` | Snapshot antes del cambio |
| `valorNuevo` | `Json?` | Snapshot después del cambio |
| `usuarioId` | `String?` | Quién hizo el cambio |
| `usuarioNombre` | `String?` | Denormalizado, igual que `PedidoHistorial.usuarioNombre` |
| `creadoEn` | `DateTime` | `@default(now())` |

`@@index([instanciaId])`, `@@index([entidadTipo, entidadId])`.

## `EntregaCotizacion` / `EntregaPedido` (existentes — extendidos, mismos campos en ambos)

| Campo nuevo | Tipo | Propósito |
|---|---|---|
| `zonaEntregaId` | `String?` | FK `ZonaEntrega` — zona resuelta o elegida (FR-041) |
| `zonaAsignadaManualmente` | `Boolean` | default `false` — true si el usuario corrigió la zona detectada (FR-038) |
| `servicioTransportistaId` | `String?` | FK `ServicioTransportista` elegido |
| `tarifaTransportistaZonaId` | `String?` | FK `TarifaTransportistaZona` de origen — identificador de la tarifa usada (FR-046), se conserva aunque la tarifa se desactive después |
| `costoInternoEnvio` | `Decimal?` | Snapshot del costo interno al momento de crear el documento (solo visible con permiso financiero) |
| `costoEnvioConfirmado` | `Boolean` | default `true` — `false` = "Costo de entrega por confirmar" (FR-039/044); default `true` preserva el comportamiento de toda fila existente antes de esta feature |
| `costoManualAutorizadoPorId` | `String?` | Si el costo fue sobrescrito manualmente con autorización (FR-044), quién lo autorizó |
| `corregimiento` | `String?` | Nuevo nivel de destino (junto a `ciudad` ya existente, que cubre distrito/ciudad) |
| `sectorOCodigoPostal` | `String?` | Nuevo nivel de destino |

Sin cambios: `transportistaId`, `metodoEntrega`, `paisId`, `estadoProvinciaId`, `ciudad`, `fechaEstimada`, `observaciones` (y en `EntregaPedido`: `numeroGuia`, `urlSeguimiento`).

`costoEnvio` en `Cotizacion`/`Pedido` (raíz del documento) **no cambia de significado** — sigue siendo el precio de envío al cliente ya sumado al total (Decisión 6).

## Modelos retirados

- **`TransportistaCoberturaGeografica`**: eliminado tras la migración de sus datos a `ZonaEntrega`/`ZonaEntregaUbicacion`/`TarifaTransportistaZona` (Decisión 1). `Pais`/`EstadoProvincia` **no se eliminan** — `EstadoProvincia` sigue en uso por el sistema de delivery-propio (`resolverCostoEnvio` Fuente 2) y como catálogo de referencia para poblar `provinciaEstado` en el selector de ubicación de zona.

## Permisos (extensión de `Modulo`, sin cambiar la forma del sistema)

- Nuevo valor de `Modulo`: `"transportistas-costos"` — gate para ver costo interno/margen y para sobrescribir manualmente un costo de envío en cotizaciones (FR-042, FR-049, FR-050; ver research.md Decisión 8).
- `"transportistas"` (ya existente) pasa a ser también el módulo que chequean las Server Actions de `src/sales/transportistas/actions.ts` (hoy chequean `"configuracion"` — corrección de la inconsistencia detectada).

## Diagrama de relaciones (resumen)

```
Transportista 1─* ServicioTransportista
Transportista 1─1 CondicionesTransportista
Transportista 1─* TarifaTransportistaZona *─1 ZonaEntrega
ServicioTransportista 1─* TarifaTransportistaZona
ZonaEntrega 1─* ZonaEntregaUbicacion *─1 Pais
EntregaCotizacion / EntregaPedido *─1 ZonaEntrega, *─1 ServicioTransportista, *─1 TarifaTransportistaZona (snapshot)
TransportistaHistorial *─1 Instancia (entidadId apunta a Transportista | TarifaTransportistaZona | CondicionesTransportista | EntregaCotizacion | EntregaPedido, sin FK física — mismo criterio flexible que otros historiales del proyecto)
```
