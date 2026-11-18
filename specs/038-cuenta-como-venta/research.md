# Research: Cuenta como Venta en el Flujo de Venta

**Feature**: 038-cuenta-como-venta | **Date**: 2026-11-18

Las cuatro decisiones de negocio del spec se cerraron con el usuario antes de escribirlo, así que no hubo `NEEDS CLARIFICATION` que resolver. Este documento registra las decisiones **técnicas** y, sobre todo, las alternativas que se evaluaron y descartaron.

---

## Decisión 1 — La pertenencia ("¿cuenta como venta?") se deriva en vivo y nunca se persiste

**Decisión**: `cuentaComoVenta` vive solo en `FlujoVentaEtapa`. Ninguna columna del `Pedido` guarda si cuenta como venta; cada consulta de KPIs lee el flag vigente de las etapas y construye un filtro `flujoVentaEtapaId IN (...)`.

**Rationale**: Es el requisito explícito del usuario (FR-008): *"quiero asegurar que si hacen cambios en la configuración del Flujo de Ventas sigan funcionando los datos y las consultas"*. Al no persistir lo que depende de la configuración, **no existe el estado que podría quedar desactualizado**. Marcar o desmarcar una etapa se refleja en la siguiente carga, sin migración, sin job y sin ventana de inconsistencia.

El código ya hace exactamente esto con `esFinal`/`esCancelacion` en `obtenerPedidosKpis` (`src/sales/pedidos/queries.ts:203-211`), así que el patrón no es nuevo ni añade abstracción.

**Precedente en el proyecto**: Preparación de Pedidos (026) tomó la misma decisión y dejó escrito el porqué en `src/sales/preparacion/utils/entrada.ts:11`:

> *"Se deriva a propósito en vez de mantener una bandera: `flujoVentaEtapaId` se escribe desde cuatro lugares distintos, y dos de ellos asignan la etapa inicial al CREAR el pedido, sin pasar por el motor. Con una bandera, un pedido creado directamente en 'Confirmado' nunca aparecería en el tablero."*

**Alternativas consideradas**:

| Alternativa | Por qué se descartó |
|---|---|
| `Pedido.esVenta Boolean` materializado | Hay que recalcularlo cada vez que cambia la config, y mantenerlo sincronizado desde los 4 sitios que mueven etapas. Es la bandera que 026 ya descartó por este mismo motivo. |
| `Pedido.esVenta` derivado en vivo también para la fecha | La pertenencia sí se deriva (es esta decisión), pero la FECHA no puede: ver Decisión 2. |

---

## Decisión 2 — La fecha se materializa en `Pedido`, no se calcula desde el historial en cada consulta

**Decisión**: nueva columna `Pedido.fechaVenta`, escrita en el mismo `update`/`create` que `flujoVentaEtapaId`, con índice `@@index([instanciaId, fechaVenta])`.

**Rationale**: Permite que el bloque de KPIs siga siendo cinco agregaciones indexadas en paralelo, sin `$queryRaw` ni window functions en cada render del listado.

**A diferencia de la pertenencia, la fecha SÍ queda acoplada a la configuración** (ver Decisión 3): se sella con las etapas marcadas en ese momento. Es el precio de la semántica de primer sellado que pidió el negocio, y se asume de forma consciente.

**Se verificó que el cálculo en vivo sería correcto**: los cuatro sitios que escriben `flujoVentaEtapaId` crean también su fila de `PedidoHistorialEtapa`, así que el historial está completo y la fecha es 100% derivable. El descarte es por costo, no por falta de datos.

**Alternativa considerada — calcular en vivo con `$queryRaw` + window function**:

Se evaluó resolver la fecha en cada consulta con `LAG()` sobre `PedidoHistorialEtapa`. Se descartó por dos costos, y el segundo pesa más que el primero:

1. **Costo de lectura sin techo.** `PedidoHistorialEtapa` acumula ~4-6 filas por pedido y no tiene índice por instancia. Un tenant con 50k pedidos cerrados son ~250k filas a recorrer con window function, en cada render del listado y por duplicado (total y mes). Hoy ese bloque son agregaciones indexadas de milisegundos.

2. **Costo de mantenimiento — el decisivo.** Las cinco agregaciones comparten `construirWhere()` (`src/sales/pedidos/queries.ts:62-104`), un `PedidoWhereInput` que arma búsqueda por texto (6 `OR`), `lineas: { some: ... }`, `entrega: { is: ... }`, contacto, producto y rangos. Con `$queryRaw` ese filtro deja de servir: habría que reescribirlo a mano en SQL y mantener dos versiones sincronizadas para siempre. Cualquier filtro nuevo de la barra habría que implementarlo dos veces.

**Camino de reconstrucción**: `PedidoHistorialEtapa` guarda cada movimiento con su etapa y su `creadoEn`, así que `fechaVenta` siempre se puede recalcular contra cualquier configuración. No se implementó ese recálculo —el backfill inicial usa la entrega estimada, ver Decisión 7— pero los datos para hacerlo existen si el negocio alguna vez lo pide.

---

## Decisión 3 — La fecha se sella UNA SOLA VEZ, en el primer cruce a una etapa de venta

**Decisión**: `fechaVenta` se escribe la **primera** vez que el pedido entra a una etapa con `cuentaComoVenta`, y después no se vuelve a tocar.

Si "Pagado" y "Entregado" están marcadas y el pedido hace `Pagado 03-nov → Entregado 20-nov`, la venta queda fechada el **03-nov**: manda la primera etapa a la que llegó.

Reglas derivadas:

| Movimiento | Qué pasa con `fechaVenta` |
|---|---|
| Entra por primera vez a una etapa de venta | **se sella** con ese instante |
| Pasa de una etapa de venta a otra de venta | no se toca |
| Vuelve a una etapa que no cuenta | no se toca (el pedido deja de sumar, pero conserva cuándo se vendió) |
| Vuelve a cruzar a una etapa de venta | no se toca: sigue mandando la primera fecha |

En código, "no se toca" es `undefined` en el `data` de Prisma — nunca `null`, que borraría la columna.

**Rationale**: Es la semántica que pidió el negocio de forma explícita. Contablemente es la correcta: la venta ocurrió cuando se concretó por primera vez, y avanzar en el flujo administrativo después no la mueve de mes.

**Consecuencia que hay que tener presente**: a diferencia de la pertenencia (Decisión 1), **la fecha sí queda acoplada a la configuración vigente al momento de sellarse**. Si más adelante se marca una etapa ANTERIOR del flujo —por ejemplo, se agrega "Pagado" cuando ya existía "Entregado" marcada—, los pedidos ya sellados conservan la fecha de "Entregado"; solo los que todavía no cruzaron usan la nueva. No hay recálculo retroactivo.

Es un acoplamiento acotado y predecible, y el negocio lo aceptó sabiéndolo. `PedidoHistorialEtapa` conserva los datos para recalcular si alguna vez se pide.

**Implementación**: el sellado necesita dos datos en el momento de la escritura — si la etapa destino cuenta como venta, y si el pedido ya tiene fecha. Los cuatro sitios los resuelven antes del `update`:

- `motor.ts:_moverInterno` recibe `destinoCuentaComoVenta` y lee `fechaVenta` en el `findFirst` que ya hacía.
- `ejecutor.ts` suma `cuentaComoVenta` al `findUnique` de la etapa y `fechaVenta` al `select` del pedido.
- Los dos sitios de creación no necesitan leer nada: un pedido que nace no puede tener fecha previa, así que basta con mirar si su etapa inicial cuenta.

**Carrera conocida**: dos movimientos concurrentes podrían leer `fechaVenta = null` y sellar los dos. El resultado es el mismo valor con milisegundos de diferencia, así que no se añadió bloqueo.

**Alternativas consideradas**:

| Alternativa | Por qué se descartó |
|---|---|
| Reescribir la fecha en cada movimiento | Mantiene la columna independiente de la configuración, pero mueve la venta de mes cuando el pedido avanza entre dos etapas que ya contaban. El negocio lo rechazó: la venta ocurrió una sola vez. |
| Borrar la fecha al salir de una etapa de venta | Un pedido devuelto y vuelto a cerrar cambiaría de mes. Contradice el "y ya luego no se actualiza". |
| Permitir una sola etapa marcada por flujo | Elimina el problema de raíz, pero quita el caso legítimo de contar ventas en "Pagado" **y** "Entregado". |

---

## Decisión 4 — Eje de fecha distinto para la lista y para los totales de dinero

**Decisión**: con un rango de fechas activo, la lista y "Total pedidos" siguen filtrando por `fechaPedido`; "Total ventas" y "Total ventas · mes actual" filtran por `fechaVenta`.

**Rationale**: Es literalmente lo que pide FR-017. Una venta pertenece al período en que se concretó, no al que se originó.

**Consecuencia asumida**: las dos poblaciones divergen. Un pedido creado el 28-oct y vendido el 03-nov suma en el filtro de noviembre pero no aparece en la lista filtrada por noviembre. El usuario vio este escenario exacto antes de decidir y lo aceptó.

**Mitigación** (FR-020): los subtítulos de las dos tarjetas de dinero pasan de "Este rango de fechas" a **"Vendidos en este rango"**, para que la diferencia se lea como intencional. No es cosmético: el código ya documenta que una divergencia parecida entre lista y KPIs se leyó como bug y obligó a un fix (`src/sales/pedidos/vista.ts:69-75`, comentario de `cerradosForzados`).

**Alternativa considerada — selector "contar por: fecha de pedido / fecha de venta"**: descartada por el usuario; añade un control más a una barra de filtros ya cargada y duplica los casos a probar.

---

## Decisión 5 — El filtro de entrega estimada sigue siendo un predicado, no un eje

**Decisión**: `entregaDesde`/`entregaHasta` se siguen aplicando tal cual sobre `fechaEntrega` en todos los KPIs, incluidos los de dinero. Solo el par `desde`/`hasta` cambia de eje.

**Rationale**: "Entrega estimada" es un filtro operativo que acota *qué pedidos mirar*, no una afirmación sobre cuándo ocurrió la venta. Mantenerlo como predicado conserva su significado actual y evita tener que explicar dos ejes de fecha simultáneos.

---

## Decisión 6 — Depurar las Reglas de validación antes de borrar la columna

**Decisión**: la migración depura `FlujoVentaRegla.arbolCondiciones` y `FlujoVentaReglaCondicion` **antes** del `DROP COLUMN`, y una regla que quede sin condiciones pasa a `estado = BORRADOR` en vez de borrarse.

**Rationale**: Es el único punto donde esta feature puede romper algo que hoy funciona. `src/sales/flujo-venta/reglas/evaluador.ts:220-221` hace:

```ts
const campo = camposPorKey.get(nodo.fieldKey);
const valorActual = campo ? campo.resolver(hechos) : undefined;
```

Al quitar `general.fechaExpiracion` del catálogo, una regla existente que lo use resuelve `undefined`, la condición no se cumple y **la regla bloquea silenciosamente el avance de los pedidos a esa etapa**. El usuario no vería un error: vería pedidos que no avanzan.

Pasar la regla a `BORRADOR` en vez de eliminarla respeta el gobierno que ya existe (`EstadoFlujoVentaRegla`): deja de evaluarse pero queda visible para que la cuenta la revise y la rearme (FR-025).

**Alternativas consideradas**:

| Alternativa | Por qué se descartó |
|---|---|
| Borrar las reglas afectadas | Destruye configuración del cliente sin dejar rastro. |
| Dejar el campo en el catálogo marcado como obsoleto | Contradice FR-022 y deja un campo que siempre resuelve `undefined` — el mismo bloqueo silencioso, solo que visible en la UI. |

---

## Decisión 7 — Backfill: etapas finales no-cancelación, y fecha de venta = entrega estimada

**Decisión (config)**: `UPDATE "FlujoVentaEtapa" SET "cuentaComoVenta" = true WHERE "esFinal" = true AND "esCancelacion" = false`.

Es exactamente la definición con la que hoy se calcula la tarjeta "Entregados" (`src/sales/pedidos/queries.ts`). Cada cuenta arranca con una configuración coherente con lo que ya veía y la ajusta después según su proceso.

**Decisión (fecha)**: a los pedidos que **ya cuentan como venta** se les pone `fechaVenta = COALESCE(fechaEntrega, fechaPedido)`. El histórico queda fechado con la entrega estimada y de ahí en adelante la fecha se sella sola, según la configuración.

**Rationale**: decisión explícita del negocio. Reconstruir desde `PedidoHistorialEtapa` habría dado la fecha del movimiento real, pero se prefirió la entrega estimada por ser el dato que el negocio usa para ubicar temporalmente una venta cerrada.

**Por qué solo los que ya cuentan como venta, y no todos los pedidos**: `fechaVenta` se sella una sola vez y después no se reescribe. Sellar hoy un pedido **pendiente** con su entrega *estimada* lo dejaría para siempre con una fecha que nunca fue una venta —y que incluso puede estar en el futuro—, porque al cerrarse de verdad la regla de primer sellado ya no lo tocaría. Dejándolos en `NULL`, reciben su fecha real al cruzar.

**Por qué `COALESCE` a `fechaPedido`**: un pedido cerrado sin entrega estimada quedaría en `NULL` y desaparecería de cualquier total filtrado por fecha, sin ningún aviso. La fecha de creación es la aproximación disponible.

**Instancias sin flujo dinámico**: sus KPIs caen al enum legacy (`estado = 'ENTREGADO'`), así que el backfill tiene una segunda sentencia que cubre esos pedidos con el mismo criterio.

**Nota sobre el cambio de cifras**: los totales **bajarán** tras el despliegue, porque hoy suman todos los pedidos del filtro sin mirar la etapa. Es la corrección buscada, no una regresión — el spec lo registra como Edge Case y como supuesto.

---

## Decisión 8 — "Pendientes" / "Expirados" contra `fechaEntrega`, con el corte en el inicio del día de negocio

**Decisión**: `Pendientes` = abiertos con `fechaEntrega >= inicio de hoy`; `Expirados` = abiertos con `fechaEntrega < inicio de hoy`. El corte se obtiene con `rangoHoy(zonaHoraria).desde` (`src/shared/fechas/rangos.ts:23`) y se pasa resuelto a la query, igual que ya se pasa `rangoMesActual`.

**Rationale**: Hoy el corte es `new Date()` contra `fechaExpiracion` (`queries.ts:217-218`), un instante. Con `fechaEntrega` —que es una fecha de calendario— comparar contra "ahora" haría que un pedido con entrega **hoy** apareciera como expirado a partir de la medianoche UTC, que puede caer en mitad del día de negocio. Cortar en el inicio del día local hace que "entrega hoy" cuente como pendiente durante todo el día (FR-026), y respeta CLAUDE.md §7: la query no calcula fechas, las recibe resueltas.

**Pedidos sin `fechaEntrega`**: quedan fuera de ambas tarjetas (FR-029). Replica el comportamiento actual, donde `fechaExpiracion: { gte }` también excluye los `null`. Incluirlos en "Pendientes" sería más útil, pero cambiaría un número que el usuario ve hoy sin que lo haya pedido.

---

## Decisión 9 — Helpers puros y testeables para las condiciones

**Decisión**: extraer dos funciones puras en `src/sales/pedidos/queries.ts` (o un módulo vecino) — `construirCondicionVenta(etapasFlujo)` y `construirWhereVentas(instanciaId, filtros, condicionVenta, rango?)` — en lugar de armar los objetos inline dentro de `obtenerPedidosKpis`.

**Rationale**: `vitest.config.ts` está montado para lógica pura sin base de datos. Con estas funciones separadas, los casos del spec —dos etapas marcadas, ninguna marcada, sin flujo dinámico— se prueban como funciones, sin doble de Prisma y sin asertar sobre llamadas espiadas. Es lo mismo que ya se hizo con `construirWhereEntrada` en Preparación (`src/sales/preparacion/utils/entrada.ts`), que es pura y por eso testeable.

**Caso borde que la función debe cubrir explícitamente**: si el tenant tiene flujo dinámico pero ninguna etapa marcada, `idsVenta` queda vacío y `{ flujoVentaEtapaId: { in: [] } }` no matchea nada → total 0 (FR-009). Debe tener su propio test, porque es fácil que una refactorización lo convierta sin querer en "sin filtro" y pase a sumar todo.
