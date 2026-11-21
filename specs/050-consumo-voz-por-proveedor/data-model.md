# Data Model: Consumo de voz por proveedor

**Feature**: `050-consumo-voz-por-proveedor` | **Date**: 2026-11-21

## Cambios de esquema

**Ninguno.** No hay migración Prisma, no hay columnas nuevas, no hay índices nuevos, no hay
backfill (FR-011, Decisión 6 de [research.md](./research.md)).

Este documento describe qué se lee de las tablas existentes y qué formas de datos circulan de la
consulta a la pantalla.

---

## Entidades persistidas (solo lectura)

### `UsoVoz` — la única fuente del desglose

`prisma/schema.prisma:4519-4540`. Una fila por **intento** de transcripción, exitoso o no.

| Campo | Tipo | Rol en esta feature |
|---|---|---|
| `instanciaId` | `String` | Filtro obligatorio de tenant (FR-010) |
| `creadoEn` | `DateTime` | Filtro de rango semiabierto del mes (FR-009) |
| `exito` | `Boolean` | Filtro: solo `true`, mismo criterio que la tarjeta actual (FR-008) |
| `proveedorVozId` | `String?` | **Clave de agrupación.** `null` ⇒ proveedor eliminado (Decisión 4) |
| `segundos` | `Int` | Origen de los minutos |
| `costoEstimado` | `Decimal?` | Costo ya materializado con la tarifa vigente al transcribir. `null` ⇒ no estimable |
| `modelo` | `String` | **No se usa.** Anotado porque es el candidato obvio para identificar un proveedor eliminado, y no sirve: dos proveedores pueden correr el mismo modelo |

**Invariante de escritura que esta feature asume**: `proveedorVozId` nunca se escribe en `null`.
`registrarUsoVoz` lo recibe de `seleccion.proveedorVozId`, que `src/voz/orquestador.ts:48` puebla
siempre, en los dos llamados de `src/voz/transcribir.ts` (133 el fallo, 158 el éxito). El único
camino al `null` es `onDelete: SetNull`. **Si se agrega un camino de escritura que deje el id en
`null`, la entrada "Proveedor eliminado" empieza a mentir** — y no hay error que lo delate.

`costoEstimado` se calcula una vez, al transcribir, y no se recalcula nunca
(`src/voz/auditoria.ts:21-27`). Por eso un cambio de tarifa a mitad de mes no reescribe lo ya
registrado: el desglose del mes es la suma de costos históricos, no una multiplicación por la
tarifa actual.

### `ProveedorVoz` — la lista sobre la que se pinta el consumo

`prisma/schema.prisma:4476-4514`. Se sigue leyendo con `obtenerProveedoresVoz`, **sin tocar su
`select`**: la exclusión explícita de `apiKeyEncriptada` del objeto devuelto es la barrera de
FR-012 y no se relaja.

Un proveedor desactivado (`activo: false`) **sí** muestra su consumo: desactivarlo no borra lo
gastado (US1, escenario 5).

---

## Formas de datos en memoria

Nada de esto se persiste. Los nombres son los del contrato en
[contracts/consumo-voz.md](./contracts/consumo-voz.md).

### `ConsumoVoz` — una cifra de consumo, ya lista para mostrar

```
minutos         : number          minutos ya redondeados y repartidos (Decisión 2)
costo           : number | null   null ⇒ nada estimable en este grupo
costoCobertura  : "COMPLETO" | "PARCIAL" | "NO_ESTIMABLE"
transcripciones : number          cantidad de intentos exitosos
```

`costoCobertura` sale de comparar `_count.costoEstimado` con `_count._all` dentro del mismo
grupo (Decisión 3):

| `_count.costoEstimado` | Cobertura | Qué muestra la fila |
|---|---|---|
| `=== _all` (y `_all > 0`) | `COMPLETO` | el monto |
| `0 < n < _all` | `PARCIAL` | el monto, advirtiendo que cubre parte del mes |
| `0` con `_all > 0` | `NO_ESTIMABLE` | "sin tarifa cargada", **nunca** un cero (FR-006) |
| `_all === 0` | `NO_ESTIMABLE` | "sin consumo este mes" (FR-007) |

Las dos últimas filas comparten cobertura pero se distinguen por `transcripciones === 0`. Es
intencional: "no gastó" y "no se puede estimar lo que gastó" son estados distintos para el
usuario, y la UI los separa por `transcripciones`, no por la cobertura.

### `ConsumoProveedor` — una entrada del desglose

```
proveedorVozId : string | null    null ⇒ la agrupación de proveedores eliminados
consumo        : ConsumoVoz
```

### `ResumenUsoVoz` — lo que devuelve la consulta (forma actual + un campo)

```
hoy            : ConsumoVoz           SIN CAMBIOS de cálculo
mes            : ConsumoVoz           mismo valor que hoy devuelve, derivado del groupBy
mesPorProveedor: ConsumoProveedor[]   NUEVO
```

`mes` se deriva sumando `mesPorProveedor`, de modo que FR-004 es aritmética y no convención
(Decisión 1). `hoy` conserva su `aggregate` propio porque no se desglosa (Decisión 5).

> **Compatibilidad**: `ResumenUsoVoz` hoy expone `{ minutos, costo, transcripciones }` en `hoy` y
> `mes`. Esta feature **agrega** `costoCobertura` a esa forma y `mesPorProveedor` a la raíz. No
> quita ni renombra nada, y `TabVoz` es el único consumidor
> (`src/configuracion/components/tab-voz.tsx:13`).

### `ProveedorVozConConsumo` — lo que recibe la lista

```
ProveedorVozListado  (sin cambios, sin credenciales)
+ consumoMes : ConsumoVoz
```

Lo produce `fusionarConsumoProveedores`, una función pura que cruza los proveedores configurados
con los grupos del desglose y separa la entrada de eliminados. Vive aparte de `queries.ts`
justamente para poder testear sin base de datos los cuatro casos que importan: proveedor sin
consumo, consumo huérfano, varios eliminados colapsando en uno, y preservación del orden de la
lista.

---

## Qué NO cambia

- El proceso de transcripción (`src/voz/transcribir.ts`), la selección de proveedor
  (`src/voz/orquestador.ts`) y el registro de uso (`src/voz/auditoria.ts`).
- El tope diario de minutos (`src/voz/limites.ts`), que lee `UsoVoz` con su propio `aggregate` y
  su propio criterio de ventana. Son dos lecturas independientes de la misma tabla y así quedan.
- `obtenerProveedoresVoz` y todas las Server Actions de `src/configuracion/voz/actions.ts`.
- Las dos tarjetas de total: mismo cálculo, mismo significado, misma presentación (FR-003).
