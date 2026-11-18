# Data Model: Cuenta como Venta en el Flujo de Venta

**Feature**: 038-cuenta-como-venta | **Date**: 2026-11-18

## Cambios en `prisma/schema.prisma`

### `FlujoVentaEtapa` — nueva columna

```prisma
model FlujoVentaEtapa {
  // ... campos existentes ...

  // Los pedidos cuya etapa actual tenga esto en true cuentan en "Total
  // ventas" y "Total ventas · mes actual" del listado de Pedidos.
  //
  // Se lee SIEMPRE en vivo y NUNCA se copia al Pedido: ese es justamente el
  // requisito (FR-008). Al no persistir lo que depende de la configuración,
  // marcar o desmarcar una etapa se refleja en los KPIs en la siguiente
  // consulta, sin recálculo ni migración. Mismo criterio que
  // src/sales/preparacion/utils/entrada.ts:11.
  cuentaComoVenta Boolean @default(false)
}
```

Sin índice propio: siempre se lee el conjunto completo de etapas activas de la instancia vía `obtenerEtapasFlujoActivo` (una fila por etapa, decenas como máximo), nunca se filtra por esta columna en una tabla grande.

### `Pedido` — una columna nueva, una eliminada

```prisma
model Pedido {
  // ... campos existentes ...

  // Cuándo el pedido se volvió venta. Eje de fecha de "Total ventas": una
  // venta se atribuye al período en que se concretó, no al que se creó el
  // pedido (FR-017).
  //
  // SE SELLA UNA SOLA VEZ: la primera vez que entra a una etapa con
  // `cuentaComoVenta`, y no se vuelve a tocar (FR-014b). Con varias etapas
  // marcadas manda la primera a la que llegó; volver a una que no cuenta
  // tampoco la borra.
  //
  // A diferencia de la pertenencia, esto SÍ queda atado a la configuración
  // vigente al sellarse: marcar luego una etapa anterior no reescribe los
  // pedidos ya sellados. PedidoHistorialEtapa conserva los datos para
  // recalcular si alguna vez se pide.
  //
  // Null mientras el pedido no haya cruzado.
  fechaVenta DateTime?

  // fechaExpiracion: ELIMINADA (un pedido no expira — FR-022). No confundir
  // con Cotizacion.fechaVencimiento ni con EntregaDigitalPedido.fechaExpiracion,
  // que se conservan intactas.

  @@index([instanciaId, fechaVenta])
}
```

**Por qué el índice compuesto con `instanciaId` primero**: mismo criterio que los índices `[instanciaId, fechaPedido]` y `[instanciaId, fechaEntrega]` que ya existen — todo `where` arranca por la instancia, y los rangos son semiabiertos sobre la columna cruda, que es lo que un B-tree puede aprovechar.

**Por qué `DateTime?` y no `@db.Date`**: coherencia con `fechaPedido`/`fechaEntrega` y con la decisión ya documentada en `docs/fechas-y-zonas-horarias.md`. Además es un instante real (el momento del movimiento), no un día de calendario.

---

## Migración — dos archivos

Seis pasos, **en este orden**, repartidos en dos migraciones para que la historia aditiva y la destructiva se puedan desplegar por separado:

| Archivo | Pasos | Naturaleza |
|---|---|---|
| `prisma/migrations/20261118000000_cuenta_como_venta/migration.sql` | 1-4 | Aditiva y reversible |
| `scripts/depurar-reglas-fecha-expiracion.ts` | 5 | Modifica configuración del cliente |
| `prisma/migrations/20261118000100_eliminar_fecha_expiracion_pedido/migration.sql` | 6 | **Destructiva** |

El paso 5 va **entre** las dos migraciones, nunca después.

### Paso 1 — Flag de etapa

```sql
ALTER TABLE "FlujoVentaEtapa"
  ADD COLUMN "cuentaComoVenta" BOOLEAN NOT NULL DEFAULT false;
```

### Paso 2 — Backfill de configuración (FR-030)

```sql
UPDATE "FlujoVentaEtapa"
   SET "cuentaComoVenta" = true
 WHERE "esFinal" = true
   AND "esCancelacion" = false;
```

Misma definición con la que hoy se calcula la tarjeta "Entregados" (`src/sales/pedidos/queries.ts:206`), así que cada cuenta arranca coherente con lo que ya veía. Idempotente.

### Paso 3 — Columna de fecha e índice

```sql
ALTER TABLE "Pedido"
  ADD COLUMN "fechaVenta" TIMESTAMP(3);

CREATE INDEX "Pedido_instanciaId_fechaVenta_idx"
  ON "Pedido" ("instanciaId", "fechaVenta");
```

### Paso 4 — Backfill de fecha (FR-031)

A los pedidos que **ya cuentan como venta** se les pone la **fecha de entrega estimada**. Decisión de negocio explícita: no se reconstruye desde `PedidoHistorialEtapa`. El histórico queda fechado con la entrega estimada y de ahí en adelante la fecha se sella sola según la configuración.

```sql
-- Con flujo dinámico: los pedidos en una etapa que cuenta como venta.
UPDATE "Pedido" p
   SET "fechaVenta" = COALESCE(p."fechaEntrega", p."fechaPedido")
  FROM "FlujoVentaEtapa" e
 WHERE e."id" = p."flujoVentaEtapaId"
   AND e."cuentaComoVenta" = true
   AND p."fechaVenta" IS NULL;

-- Sin flujo dinámico: los KPIs caen al enum legacy, así que sus pedidos
-- entregados también necesitan fecha.
UPDATE "Pedido" p
   SET "fechaVenta" = COALESCE(p."fechaEntrega", p."fechaPedido")
 WHERE p."flujoVentaEtapaId" IS NULL
   AND p."estado" = 'ENTREGADO'
   AND p."fechaVenta" IS NULL;
```

Tres decisiones dentro de este paso:

- **Solo los que ya cuentan como venta, no todos los pedidos.** `fechaVenta` se sella una sola vez y no se reescribe, así que sellar hoy un pedido **abierto** con su entrega *estimada* lo dejaría para siempre con una fecha que nunca fue una venta —y que incluso puede estar en el futuro—, porque al cerrarse de verdad la regla de primer sellado ya no lo tocaría. Dejándolos en `NULL`, reciben la fecha real al cruzar.
- **`COALESCE` a `fechaPedido`.** Un pedido cerrado sin entrega estimada quedaría en `NULL` y desaparecería de cualquier total filtrado por fecha, sin ningún aviso. La fecha de creación es la aproximación disponible.
- **`AND "fechaVenta" IS NULL`.** Lo hace idempotente: re-ejecutarlo no pisa nada ya escrito.

### Paso 5 — Depuración de Reglas de validación (FR-024, FR-025)

**Debe correr antes del paso 6.** Al desaparecer `general.fechaExpiracion` del catálogo, `evaluador.ts:220-221` resuelve `undefined` y la regla bloquea silenciosamente el avance de los pedidos.

```sql
-- 5a. Tabla legada (condiciones planas AND)
DELETE FROM "FlujoVentaReglaCondicion"
 WHERE "campo" IN ('general.fechaExpiracion', 'fechaExpiracion');

-- 5b. Árbol tipado: quitar los nodos condition que apunten al campo,
--     en el grupo raíz y en los grupos de nivel 2.
-- 5c. Reglas que quedaron sin condiciones → BORRADOR (no se borran).
```

Los pasos **5b y 5c manipulan JSON anidado** (`arbolCondiciones`), lo que en SQL plano queda ilegible y difícil de testear. Se implementan en `scripts/depurar-reglas-fecha-expiracion.ts`, con su `.test.ts` sobre la función pura de poda del árbol. El script:

1. Lee las reglas cuyo `arbolCondiciones::text` contiene `general.fechaExpiracion`.
2. Poda los nodos `condition` con ese `fieldKey`, en los dos niveles de anidamiento que permite `ArbolCondicionesSchema`.
3. Si el grupo raíz queda sin hijos, pone la regla en `estado = 'BORRADOR'` y deja `arbolCondiciones = null`.
4. Emite al log el id, nombre e instancia de cada regla tocada y si quedó en borrador (FR-025).

Se ejecuta como parte del despliegue, antes de aplicar el paso 6.

### Paso 6 — Eliminar la columna (destructivo)

```sql
ALTER TABLE "Pedido" DROP COLUMN "fechaExpiracion";
```

No se elimina ninguna otra columna. `EntregaDigitalPedido.fechaExpiracion`, `EntregaDigitalCotizacion.fechaExpiracion` y `Cotizacion.fechaVencimiento` quedan intactas (FR-023).

---

## Entidades y relaciones

Ninguna relación nueva. El modelo de datos no cambia de forma; solo se mueve de lugar **qué dato decide un total**.

```
FlujoVentaEtapa ──┬── cuentaComoVenta (nuevo)       config, se lee en vivo
                  │
                  │ 1..N
                  ▼
                Pedido ──┬── flujoVentaEtapaId       ┐ escritos juntos,
                         ├── fechaVenta   ┘ misma transacción
                         ├── fechaPedido             (eje de la lista)
                         ├── fechaEntrega            (eje de Pendientes/Expirados)
                         └── fechaExpiracion         ✗ eliminada
                         │
                         │ 1..N
                         ▼
                PedidoHistorialEtapa                 fuente del backfill
                  └── creadoEn
```

### Invariante central

> `Pedido.fechaVenta` **siempre** coincide con el `creadoEn` de la fila de `PedidoHistorialEtapa` creada en el mismo movimiento.

Se garantiza escribiendo ambos en la **misma transacción** y con el **mismo valor de `Date`** — no con dos `new Date()` separados. Las transacciones ya existen en los cuatro sitios; solo hay que sumar el campo.

| # | Sitio | Archivo | Transacción existente |
|---|---|---|---|
| 1 | Creación manual del pedido | `src/sales/pedidos/actions.ts:163-178` | `prisma.$transaction([update, historial.create])` |
| 2 | Conversión desde cotización | `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts:139` + `:246` | `tx` del servicio |
| 3 | Movimiento manual/automático | `src/sales/flujo-venta/motor.ts:90-106` (`_moverInterno`) | `prisma.$transaction([update, historial.create])` |
| 4 | Disparador de pipeline | `src/crm/pipeline/disparadores/ejecutor.ts:332-350` | update + create consecutivos — **envolverlos en una transacción** como parte de esta feature |

> El sitio 4 hoy no está transaccionado: hace `pedido.update` y luego `pedidoHistorialEtapa.create` por separado. Para sostener la invariante hay que envolverlos, lo que además corrige un hueco preexistente (si el proceso cae entre ambos, el pedido queda movido sin rastro en el historial).

---

## Estado derivado en consultas — no es parte del modelo

Lo siguiente se calcula en cada lectura y **no se almacena**. Se documenta acá porque es donde vive la semántica de "venta".

```ts
// src/sales/pedidos/queries.ts — función pura, testeable sin DB
function construirCondicionVenta(
  etapasFlujo: { id: string; cuentaComoVenta: boolean }[],
): Prisma.PedidoWhereInput {
  if (etapasFlujo.length === 0) {
    return { estado: "ENTREGADO" };          // sin flujo dinámico (FR-010)
  }
  const idsVenta = etapasFlujo.filter((e) => e.cuentaComoVenta).map((e) => e.id);
  return { flujoVentaEtapaId: { in: idsVenta } };  // vacío → no matchea → 0 (FR-009)
}
```

`obtenerEtapasFlujoActivo` (`src/sales/flujo-venta/queries.ts:16`) suma `cuentaComoVenta: true` a su `select`.

### Eje de fecha por KPI

| KPI | Población | Eje de fecha |
|---|---|---|
| Total pedidos | todos los del filtro | `fechaPedido` *(sin cambio)* |
| **Total ventas** | `condicionVenta` | **`fechaVenta`** |
| **Total ventas · mes actual** | `condicionVenta` | **`fechaVenta`** con `rangoMesHastaHoy`, ignorando filtros de pantalla *(como hoy)* |
| **Pendientes** | abiertos | `fechaEntrega >= rangoHoy(tz).desde` |
| **Expirados** | abiertos | `fechaEntrega < rangoHoy(tz).desde` |
| **Entregados → Ventas** | `condicionVenta` (count) | el del filtro activo |

`construirWhereVentas` reutiliza `construirWhereBase` (filtros no-fecha, sin tocar) y aplica el rango sobre `fechaVenta`. El filtro de entrega estimada (`entregaDesde`/`entregaHasta`) se sigue aplicando como predicado independiente (`research.md` Decisión 5).

---

## Validaciones

| Regla | Dónde | Requisito |
|---|---|---|
| `cuentaComoVenta` es booleano opcional | `EtapaSchema` en `src/sales/flujo-venta/schema.ts` | FR-001 |
| Una etapa de cancelación no puede contar como venta | `crearEtapa`/`actualizarEtapa` en `src/sales/flujo-venta/actions.ts` — en el servidor, no solo en la UI | FR-005 |
| Varias etapas pueden estar marcadas | sin restricción (a diferencia de `esInicial`) | FR-002 |
| Todo `where` scopeado por `instanciaId` | `construirWhereBase` y `obtenerEtapasFlujoActivo`, sin cambios | Constitución V |
