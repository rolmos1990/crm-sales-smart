# Data Model: Preparación de pedidos

**Feature**: 026-preparacion-pedidos | **Fecha**: 2026-09-17

Modelos nuevos y cambios sobre modelos existentes. Los nombres siguen la convención del proyecto (dominio en
español) y el patrón de bloques 1:1 que `Pedido` ya usa con `entrega` y `servicio`.

---

## Modelos nuevos

### `FlujoPreparacion`

La configuración de preparación de una instancia. Una por instancia.

```prisma
model FlujoPreparacion {
  id                String   @id @default(cuid())
  nombre            String   @default("Preparación")
  activo            Boolean  @default(true)
  agrupacionDefecto AgrupacionPreparacion @default(POR_PEDIDO)
  rangoDefecto      RangoPreparacion      @default(HOY)
  creadoEn          DateTime @default(now())
  actualizadoEn     DateTime @updatedAt

  instanciaId String
  instancia   Instancia @relation(fields: [instanciaId], references: [id], onDelete: Cascade)

  estados       EstadoPreparacion[]
  etapasEntrada FlujoPreparacionEntrada[]

  @@unique([instanciaId])
  @@index([instanciaId])
}
```

**Reglas**:
- `@@unique([instanciaId])` — una sola configuración por instancia en esta versión. Quitar el unique es el
  único cambio necesario si más adelante se quieren tableros por equipo (ver spec, Assumptions).
- Se crea de forma perezosa e idempotente al primer acceso al módulo (research Decisión 5).

---

### `FlujoPreparacionEntrada`

Qué etapas del Flujo de Venta hacen que un pedido entre al tablero.

```prisma
model FlujoPreparacionEntrada {
  id String @id @default(cuid())

  flujoPreparacionId String
  flujoPreparacion   FlujoPreparacion @relation(fields: [flujoPreparacionId], references: [id], onDelete: Cascade)

  flujoVentaEtapaId String
  flujoVentaEtapa   FlujoVentaEtapa @relation(fields: [flujoVentaEtapaId], references: [id], onDelete: Cascade)

  @@unique([flujoPreparacionId, flujoVentaEtapaId])
  @@index([flujoPreparacionId])
}
```

**Reglas**:
- `onDelete: Cascade` sobre la etapa: si la etapa desaparece del flujo de venta, la entrada desaparece con
  ella y el tablero sigue funcionando con el resto (FR-009).
- Sin filas configuradas, el comportamiento por defecto es: entran los pedidos cuya etapa **no** es final ni
  de cancelación (FR-003 + Decisión 5).
- Las consultas MUST filtrar además por `flujoVentaEtapa.activo` — una etapa desactivada no hace entrar
  pedidos nuevos, pero los que ya están en el tablero no se expulsan.

---

### `EstadoPreparacion`

Una columna del tablero.

```prisma
model EstadoPreparacion {
  id          String  @id @default(cuid())
  nombre      String
  color       String?
  orden       Int     @default(0)
  esInicial   Boolean @default(false)
  marcaInicio Boolean @default(false)
  esFinal     Boolean @default(false)
  activo      Boolean @default(true)
  creadoEn    DateTime @default(now())
  actualizadoEn DateTime @updatedAt

  flujoPreparacionId String
  flujoPreparacion   FlujoPreparacion @relation(fields: [flujoPreparacionId], references: [id], onDelete: Cascade)

  preparaciones PreparacionPedido[]
  historial     PreparacionHistorial[]

  @@index([flujoPreparacionId, orden])
}
```

**Reglas de validación** (server, Zod + chequeo en la acción):
- Exactamente **un** estado con `esInicial = true` por flujo activo.
- Exactamente **un** estado con `esFinal = true` por flujo activo.
- `marcaInicio` puede estar en 0 o 1 estados. Si está en 0, el inicio se sella al entrar al tablero (FR-013).
- `nombre` no vacío, máximo 60 caracteres, único (case-insensitive) dentro del flujo.
- `color` debe ser un token/valor soportado por la UI; no se aceptan hex arbitrarios en componentes (regla 6
  del proyecto — los colores intensos representan significado).
- **Borrado**: prohibido si existe alguna `PreparacionPedido` apuntando al estado (FR-004). La acción devuelve
  error de negocio, no excepción de base.
- **Desactivación**: requiere `estadoDestinoId`; los pedidos se migran en la misma transacción y cada
  migración deja fila en `PreparacionHistorial` con `tipo = AUTOMATICO`.
- No se puede desactivar el último estado activo, ni el inicial/final sin designar reemplazo.

---

### `PreparacionPedido`

El registro de preparación de un pedido. Bloque 1:1 con `Pedido`.

```prisma
model PreparacionPedido {
  id           String    @id @default(cuid())
  iniciadaEn   DateTime?
  completadaEn DateTime?
  notas        String?
  creadoEn     DateTime  @default(now())
  actualizadoEn DateTime @updatedAt

  pedidoId String @unique
  pedido   Pedido @relation(fields: [pedidoId], references: [id], onDelete: Cascade)

  estadoId String
  estado   EstadoPreparacion @relation(fields: [estadoId], references: [id])

  // Quien movió el pedido al estado final (decisión del usuario)
  asignadaAId String?
  asignadaA   Usuario? @relation(fields: [asignadaAId], references: [id], onDelete: SetNull)

  historial PreparacionHistorial[]

  @@index([estadoId])
  @@index([completadaEn])
}
```

**Reglas**:
- Se crea perezosamente (`upsert` por `pedidoId`) cuando el pedido aparece en el tablero o se mueve.
- No se borra al salir el pedido del tablero (FR-008): es el registro histórico de qué se preparó y quién.
- `onDelete: Cascade` desde `Pedido`: si el pedido se elimina, su preparación no tiene sentido.
- `asignadaA` con `onDelete: SetNull`: si el usuario se elimina, el registro sobrevive; el nombre queda
  preservado en el historial (`usuarioNombre`), igual que hace `PedidoHistorialEtapa`.

---

### `PreparacionHistorial`

Traza de cada cambio de estado. Alimenta "Actividad reciente".

```prisma
model PreparacionHistorial {
  id                   String   @id @default(cuid())
  estadoNombre         String
  estadoAnteriorNombre String?
  tipo                 TipoMovimientoEtapa @default(MANUAL)
  usuarioId            String?
  usuarioNombre        String?
  creadoEn             DateTime @default(now())

  preparacionId String
  preparacion   PreparacionPedido @relation(fields: [preparacionId], references: [id], onDelete: Cascade)

  estadoId String
  estado   EstadoPreparacion @relation(fields: [estadoId], references: [id])

  @@index([preparacionId])
  @@index([creadoEn])
}
```

**Reglas**:
- Se guardan los **nombres** además de los ids (snapshot), igual que `PedidoHistorialEtapa`, para que el
  historial siga siendo legible si el estado se renombra o se desactiva.
- Reutiliza el enum existente `TipoMovimientoEtapa` (`MANUAL` | `AUTOMATICO`) — no se crea un enum nuevo.

---

### Enums nuevos

```prisma
enum AgrupacionPreparacion {
  POR_PEDIDO
  POR_PRODUCTO
}

enum RangoPreparacion {
  HOY
  MANANA
  SEMANA
  PERSONALIZADO
}
```

---

## Cambios sobre modelos existentes

### `PedidoLinea` — avance por ítem

```prisma
// nuevos campos
cantidadPreparada Decimal   @default(0)
preparadaEn       DateTime?
preparadaPorId    String?
preparadaPor      Usuario?  @relation("LineasPreparadasPorUsuario", fields: [preparadaPorId], references: [id], onDelete: SetNull)
```

**Reglas**:
- `0 <= cantidadPreparada <= cantidad` — validado en servidor; intentar exceder devuelve error (FR-029).
- `cantidadPreparada = 0` significa sin avance; `= cantidad` significa línea completa.
- Al editar el pedido: agregar una línea la crea con `cantidadPreparada = 0`, lo que devuelve el pedido a
  avance incompleto (FR-030) sin tocar el historial. Quitar una línea elimina su avance con ella.
- El "avance del pedido" es **derivado**, no persistido: `todas las líneas con cantidadPreparada = cantidad`.
  No se agrega ninguna columna de avance al pedido — evita un segundo lugar que pueda quedar desincronizado.

### `Pedido` — relación inversa

```prisma
preparacion PreparacionPedido?
```

### `FlujoVentaEtapa` — relación inversa

```prisma
entradasPreparacion FlujoPreparacionEntrada[]
```

### `Instancia` y `Usuario` — relaciones inversas

```prisma
// Instancia
flujoPreparacion FlujoPreparacion?

// Usuario
preparacionesAsignadas PreparacionPedido[]
lineasPreparadas       PedidoLinea[] @relation("LineasPreparadasPorUsuario")
```

### Sin cambios

`EntregaPedido.estadoEntrega` y el enum `EstadoEntrega` **no se modifican** (Decisión 8). El valor
`PREPARANDO` conserva su significado y su comportamiento actuales.

---

## Transiciones de estado

Máquina de estados de `PreparacionPedido`, independiente del Flujo de Venta.

| Evento | Precondición | Efecto |
|--------|--------------|--------|
| Materialización | El pedido está en una etapa de entrada y no tiene `PreparacionPedido` | Se crea en el estado `esInicial`. Si ningún estado tiene `marcaInicio`, también se sella `iniciadaEn = now()` |
| Mover a estado con `marcaInicio` | `iniciadaEn` es null | `iniciadaEn = now()` |
| Mover a estado con `marcaInicio` | `iniciadaEn` ya tiene valor | No se re-sella (el inicio es el primero, no el último) |
| Mover a estado `esFinal` | — | `completadaEn = now()`, `asignadaAId = usuario que movió` |
| Mover desde `esFinal` a cualquier otro | — | `completadaEn = null`, `asignadaAId = null`. Ambos movimientos quedan en el historial |
| Mover con `estadoId` esperado distinto del actual | Otro usuario ya movió la tarjeta | Conflicto: no se aplica nada, se devuelve resultado de conflicto (FR-017) |
| El pedido alcanza etapa final/cancelación del flujo de venta | — | Sale del tablero por consulta. `PreparacionPedido` se conserva intacta |
| Estado desactivado con pedidos | Se indicó `estadoDestinoId` | Los pedidos se mueven al destino, con historial `tipo = AUTOMATICO` |

**Invariantes**:
1. Un pedido tiene como máximo una `PreparacionPedido`.
2. `completadaEn` no es null ⟺ el estado actual es `esFinal`.
3. `completadaEn` no es null ⟹ `iniciadaEn` no es null.
4. `asignadaAId` no es null ⟹ `completadaEn` no es null.
5. Cada cambio de `estadoId` tiene exactamente una fila en `PreparacionHistorial`.

---

## Índices y consultas

Consultas del camino caliente y el índice que las sostiene:

| Consulta | Índice |
|----------|--------|
| Tablero: pedidos por etapa de entrada + rango de `fechaEntrega` | `Pedido.@@index([flujoVentaEtapaId])` (ya existe) |
| Agrupar tarjetas por columna | `PreparacionPedido.@@index([estadoId])` |
| Actividad reciente | `PreparacionHistorial.@@index([creadoEn])` |
| Resumen por producto del rango | `PedidoLinea.pedidoId` (ya indexado por la FK) + `groupBy productoId` |
| Chip en la lista de pedidos | relación 1:1 vía `PreparacionPedido.pedidoId @unique` |

**Nota de migración**: todos los campos nuevos son nullables o tienen default, y ningún campo existente
cambia de tipo ni de nombre. La migración es aditiva y segura para los datos actuales (constitución:
"Prisma migrations MUST be safe for existing data"). No requiere script de backfill.
