# Research: Consumo de voz por proveedor

**Feature**: `050-consumo-voz-por-proveedor` | **Date**: 2026-11-21

Seis decisiones. Ninguna requiere investigación externa: todo se resolvió leyendo el código y los
tipos que Prisma ya generó.

---

## Decisión 1 — Un solo `groupBy`, y el total del mes se deriva de él

**Decisión**: `obtenerResumenUsoVoz` reemplaza el `aggregate` del mes
(`src/configuracion/voz/queries.ts:81`) por un `groupBy({ by: ["proveedorVozId"] })` sobre el
**mismo** `where`, y calcula el total del mes sumando los grupos. El `aggregate` de "hoy" queda
exactamente como está.

**Rationale**: FR-004 exige que la suma de las filas coincida con la tarjeta de total. Si el
total sale de una consulta y el desglose de otra, esa igualdad es una coincidencia que se sostiene
mientras nadie toque uno de los dos `where`. Derivando el total de los grupos, la igualdad es
aritmética y no se puede romper: `SUM(x)` sobre todas las filas **es** la suma de los `SUM(x)`
por grupo, porque `GROUP BY` particiona el conjunto filtrado sin solaparlo ni perder filas
—incluidas las de `proveedorVozId IS NULL`, que en Postgres forman su propio grupo.

Esto además satisface FR-003 sin esfuerzo: el número de la tarjeta no cambia porque la
aritmética es idéntica, no "parecida".

**Cuidado con los `Decimal`**: `costoEstimado` es `Decimal?`. Los sumandos por grupo se acumulan
con `Prisma.Decimal.add`, nunca con `+` de JavaScript, y la conversión a `Number` ocurre una sola
vez al borde de la presentación — que es lo que el código ya hace hoy (`Number(r._sum.costoEstimado)`).

**Alternatives considered**:
- *Dos consultas independientes (el `aggregate` actual + un `groupBy` nuevo)*: una consulta más
  por render y la igualdad de FR-004 queda sin garantía estructural. Rechazado.
- *Una sola consulta y el total calculado en SQL con `GROUPING SETS`*: Prisma no lo expone; haría
  falta `$queryRaw`, perdiendo el tipado y el filtro por `instanciaId` verificado por el cliente.
  Desproporcionado para sumar 1–5 números en memoria.

---

## Decisión 2 — El redondeo se reparte por resto mayor

**Decisión**: una función pura `repartirRedondeo(valores: number[], decimales: number): number[]`
en `src/configuracion/voz/reparto.ts`, con el invariante
`sum(repartirRedondeo(v, d)) === redondear(sum(v), d)`.

**Rationale**: es la única forma en que esta pantalla puede contradecirse a sí misma, y no es un
caso raro. Hoy el total hace `Math.round((segundos / 60) * 10) / 10`
(`src/configuracion/voz/queries.ts:86`). Si cada fila aplica lo mismo por su cuenta, los errores
de redondeo se acumulan:

| | minutos exactos | fila mostrada |
|---|---|---|
| ElevenLabs | 12.34 | 12.3 |
| Groq | 12.34 | 12.3 |
| OpenAI | 12.34 | 12.3 |
| **Σ filas** | | **36.9** |
| **Tarjeta de total** | 37.02 | **37.0** |

Cada error individual cae en [-0.05, +0.05]; la discrepancia aparece cuando la suma de errores
supera 0.05, lo que con 2–4 proveedores ocurre buena parte de las veces. Con el reparto, una fila
absorbe el resto (12.3 + 12.3 + 12.4 = 37.0). El desvío introducido en esa fila es de 0.1 min
—seis segundos— y es inmaterial para decidir qué proveedor conviene; números que no suman, no.

Se aplica igual a los minutos y al costo. En el costo, el reparto corre **solo sobre los grupos
con monto estimable**: un grupo sin tarifa no participa (ver Decisión 3).

**Alternatives considered**:
- *Aceptar el desvío*: contradice FR-004, que es explícito ("sin excepción ni redondeo que genere
  diferencia visible"). Y la pantalla existe precisamente para dar confianza en los números.
- *Calcular la tarjeta de total como la suma de las filas ya redondeadas*: haría cuadrar todo,
  pero cambia el valor de la tarjeta y viola FR-003.
- *Mostrar más decimales en las filas*: no resuelve nada, el problema se traslada un decimal más
  abajo, y empeora la lectura.
- *Mostrar minutos enteros en las filas*: empeora el problema (errores de hasta 0.5 por fila).

---

## Decisión 3 — "Costo parcial" se detecta con `_count.costoEstimado` vs `_count._all`

**Decisión**: el `groupBy` pide `_count: { _all: true, costoEstimado: true }`. Un grupo tiene
costo **completo** si `_count.costoEstimado === _count._all`, **parcial** si está entre 1 y
`_all - 1`, y **no estimable** si es 0.

**Rationale**: `_sum` en SQL ignora los NULL, así que un grupo mixto devuelve un monto que luce
completo y no lo es. El caso llega solo: el comercio configura un proveedor, lo usa unos días,
después carga la tarifa por hora. Las transcripciones previas quedaron con `costoEstimado` en
NULL a propósito —`calcularCostoVoz` devuelve `null` sin tarifa
(`src/voz/auditoria.ts:21-27`), y el comentario del archivo explica por qué: un costo inventado
contamina todos los agregados—. Sin este chequeo, la fila mostraría el costo de los últimos días
como si fuera el del mes entero.

`_count` sobre un campo específico cuenta los no-NULL; `UsoVozCountAggregateOutputType` ya expone
`costoEstimado: number` (`src/generated/prisma/models/UsoVoz.ts:71-85`), así que no hace falta ni
una consulta extra ni un tipo nuevo.

FR-006 se cubre con los tres estados, y la distinción "no estimable" ≠ "cero" queda explícita en
los datos, no solo en el texto de la UI.

**Alternatives considered**:
- *Inferir la falta de tarifa desde `ProveedorVoz.costoPorHora === null`*: es la tarifa **actual**,
  no la que estaba vigente cuando se transcribió. Da el resultado contrario al correcto en el caso
  que motiva la decisión (tarifa cargada a mitad de mes) y además no dice nada de un proveedor ya
  eliminado.
- *Un segundo `groupBy` filtrando `costoEstimado: { not: null }`*: una consulta más para un dato
  que el primer `groupBy` ya puede devolver.

---

## Decisión 4 — El grupo `proveedorVozId: null` ES la entrada de proveedores eliminados

**Decisión**: el grupo con `proveedorVozId: null` que devuelve el `groupBy` se muestra como una
única entrada rotulada "Proveedor eliminado". No se agrega ningún campo a `UsoVoz`.

**Rationale**: el NULL tiene un solo origen posible. `ProveedorVoz` se relaciona con
`onDelete: SetNull` (`prisma/schema.prisma:4536`) y `eliminarProveedorVoz` lo documenta como
deliberado: "borrar un proveedor no puede borrar el gasto que ya se facturó"
(`src/configuracion/voz/actions.ts:153`). En la escritura el id nunca es null:
`registrarUsoVoz` lo recibe de `seleccion.proveedorVozId`, que `orquestador.ts:48` siempre puebla
con `config.id`, en los dos llamados —el del fallo y el del éxito—
(`src/voz/transcribir.ts:133,158`).

Agregar un snapshot del alias al registro de uso no se hace porque **no arregla el problema que
tiene**: las filas que ya perdieron el vínculo seguirían sin alias, que son justamente las del
comercio que ya eliminó un proveedor. Sería esquema nuevo para el mismo resultado visible, y
contradiría FR-011.

Varios proveedores eliminados colapsan en una sola entrada, por el mismo motivo: no hay forma de
separarlos sin inventar la atribución. `modelo` queda en la fila, pero dos proveedores pueden
correr el mismo modelo y uno solo puede correr varios, así que no identifica nada.

**Alternatives considered**:
- *`onDelete: Cascade`*: borraría gasto ya facturado. Lo contrario de lo que el histórico existe
  para hacer.
- *Snapshot de `proveedor`/`alias` en `UsoVoz`*: descrito arriba. Queda anotado por si alguna vez
  se pide el desglose histórico de proveedores eliminados *por separado*; hoy nadie lo pidió.
- *Ocultar el consumo huérfano*: rompe FR-004 y hace que la pantalla parezca rota.

---

## Decisión 5 — El desglose es del mes, no de "hoy"

**Decisión**: cada fila muestra minutos y costo **del mes en curso**. "Hoy" sigue existiendo solo
en el detalle de la tarjeta de total.

**Rationale**: la pregunta que originó el pedido es "cuánto me cuesta cada proveedor", y esa se
responde con el mes —que además es la unidad en que se factura—. Repetir "hoy" por fila agrega
una cifra que casi siempre es cero o cercana a cero, en una línea que ya carga alias, servicio,
modelo, prioridad, tarifa y tope diario.

Mantenerlo en una sola ventana también deja el costo de la pantalla donde está: el `aggregate` de
hoy sigue siendo uno solo y total (SC-005).

**Alternatives considered**:
- *"X min hoy · Y min este mes" por fila*: densidad sin pregunta que responda.
- *Selector de período*: contradice FR-002 y FR-013 (sin interacción, sin estado de cliente), y es
  exactamente la alternativa que el usuario descartó al elegir el desglose en línea.

---

## Decisión 6 — Sin índice nuevo, sin cambio de esquema

**Decisión**: no se agrega ningún índice ni columna. No hay migración.

**Rationale**: el `where` del `groupBy` es el mismo de hoy —`instanciaId`, `exito: true`,
`creadoEn` en rango semiabierto— y `@@index([instanciaId, creadoEn])`
(`prisma/schema.prisma:4538`) lo cubre. El agrupado por `proveedorVozId` ocurre **después** del
filtro, sobre las filas de una cuenta en un mes: del orden de cientos a unos pocos miles. Un
`HashAggregate` sobre eso es ruido frente al propio viaje a la base.

El índice `@@index([proveedorVozId])` que ya existe no participa acá —está para la integridad
referencial y el `SET NULL`—, y crear uno compuesto `[instanciaId, creadoEn, proveedorVozId]`
sería escritura más lenta en la tabla más escrita del módulo de voz a cambio de nada medible.

**Verificación pendiente para el implementador**: correr `EXPLAIN ANALYZE` del `groupBy` resultante
contra una cuenta con volumen real y confirmar que usa `Index Scan` sobre
`[instanciaId, creadoEn]`. Si apareciera un `Seq Scan`, revisar el plan antes de agregar índices.

**Alternatives considered**:
- *Tabla de agregados precalculados por proveedor y mes*: necesitaría backfill, un proceso que la
  mantenga y una ventana de inconsistencia, para sustituir una consulta que ya es barata.
  Contradice FR-011 y SC-004.
- *Índice compuesto nuevo*: descrito arriba.
