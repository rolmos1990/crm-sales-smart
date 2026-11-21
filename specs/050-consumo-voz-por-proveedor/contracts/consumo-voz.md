# Contrato: lectura de consumo de voz por proveedor

**Feature**: `050-consumo-voz-por-proveedor` | **Date**: 2026-11-21

Tres piezas. Dos son funciones puras y testeables sin base de datos; la tercera es la consulta.
Las formas de datos están en [../data-model.md](../data-model.md).

---

## 1. `repartirRedondeo` — `src/configuracion/voz/reparto.ts`

```ts
export function repartirRedondeo(
  valores: number[],
  decimales: number,
  objetivo?: number,
): number[]
```

Redondea cada valor a `decimales`, corrigiendo los restos para que la suma de las salidas sea
exactamente `objetivo` (o el redondeo de la suma de las entradas, si se omite).

> **`objetivo` se agregó durante la implementación**, no estaba en el contrato original. El
> llamador lo calcula con la MISMA expresión que usa la tarjeta de total. Derivarlo acá de
> `suma(valores)` deja a merced del punto flotante los casos que caen justo sobre un límite de
> redondeo — y con minutos salidos de segundos enteros esos límites se tocan seguido, uno cada
> 3 segundos (`0.05 min`). Un desvío de un ULP ahí vuelve a romper exactamente lo que esta
> función arregla, y además podría mover el valor de la tarjeta, violando FR-003.

### Invariante (es el motivo de existir de la función)

```
suma(repartirRedondeo(v, d, objetivo)) === objetivo
suma(repartirRedondeo(v, d))           === redondear(suma(v), d)
```

para todo `v` y todo `d >= 0`. Este es el test que no se borra: sin él, la pantalla puede mostrar
filas que no suman el total y nadie lo nota hasta que un usuario las suma a mano.

### Reglas

| Caso | Comportamiento |
|---|---|
| `valores` vacío | devuelve `[]` |
| un solo valor | devuelve `[redondear(v, d)]` |
| suma de redondeos ya coincide | devuelve los redondeos sin tocar |
| falta/sobra resto | se ajusta en las entradas de mayor resto fraccionario, una unidad de `10^-d` por entrada |
| empate de restos | gana el índice menor — **determinista**, para que dos renders del mismo dato den lo mismo |
| algún valor negativo | no ocurre en esta feature (minutos y costos son ≥ 0); la función no lo trata como caso especial |

### Casos borde que el test cubre

- `[12.34, 12.34, 12.34]`, 1 decimal → suma `37.0`, no `36.9`. Es el caso de la tabla de
  [../research.md](../research.md) § Decisión 2.
- `[0, 0, 0]` → `[0, 0, 0]`.
- Un valor y el resto en cero → el redondeo no se desplaza a una fila que no consumió nada
  (mostrar `0.1 min` en un proveedor sin uso sería peor que el problema original).

---

## 2. `fusionarConsumoProveedores` — `src/configuracion/voz/fusion.ts`

```ts
export function fusionarConsumoProveedores(
  proveedores: ProveedorVozListado[],
  mesPorProveedor: ConsumoProveedor[],
): {
  conConsumo: ProveedorVozConConsumo[]
  eliminados: ConsumoVoz | null
}
```

Cruza los proveedores configurados con los grupos del desglose.

### Reglas

| Regla | Comportamiento |
|---|---|
| Orden | `conConsumo` preserva el orden de `proveedores` tal como vino de la consulta (activos primero, luego prioridad, luego alias). La fusión **no** reordena |
| Proveedor sin grupo | recibe un `ConsumoVoz` en cero con `transcripciones: 0` → la fila dirá "sin consumo este mes" (FR-007) |
| Grupo con `proveedorVozId: null` | se devuelve en `eliminados` (FR-005) |
| Sin grupo huérfano | `eliminados` es `null` → la UI no renderiza la entrada (US2, escenario 3) |
| Grupo cuyo id no está en `proveedores` | **no puede ocurrir** (el borrado pone el id en `null`, no lo deja colgado). Si ocurriera, se acumula en `eliminados` en vez de descartarse: preservar FR-004 importa más que la prolijidad de la atribución |

> La última regla es deliberada. Descartar un grupo inesperado haría que las filas dejaran de
> sumar el total sin ningún síntoma; mandarlo a "Proveedor eliminado" es impreciso pero visible.

### Casos borde que el test cubre

- Proveedor configurado sin ninguna transcripción en el mes.
- Consumo huérfano presente y ausente.
- Dos proveedores eliminados distintos → **una** entrada con la suma (Decisión 4).
- Lista de proveedores vacía con consumo huérfano → solo `eliminados`.
- Orden preservado con proveedores activos e inactivos mezclados.

---

## 3. `obtenerResumenUsoVoz` — `src/configuracion/voz/queries.ts`

```ts
export async function obtenerResumenUsoVoz(instanciaId: string): Promise<ResumenUsoVoz>
```

Misma firma que hoy. Devuelve `hoy`, `mes` y el nuevo `mesPorProveedor`.

### Consultas

Dos, en `Promise.all`, igual que hoy:

| | Consulta | Para qué |
|---|---|---|
| Hoy | `usoVoz.aggregate` — **sin cambios** | detalle de la tarjeta de minutos |
| Mes | `usoVoz.groupBy({ by: ["proveedorVozId"] })` | desglose **y** total del mes (Decisión 1) |

### `where` — idéntico en ambas, y no negociable

```
instanciaId : el de la sesión            FR-010, tenant scoping
exito       : true                       FR-008, mismo criterio que la tarjeta actual
creadoEn    : { gte, lt }                FR-009, rango semiabierto
```

El rango sale de `rangoEsteMes(zona, ahora)` con `zona = await obtenerZonaNegocio(instanciaId)`,
convertido con `aFiltroPrisma`. **Nunca** `lte` sobre un límite de día, **nunca** `AT TIME ZONE`
sobre la columna, **nunca** la zona del navegador (regla 7 de `CLAUDE.md`).

### Agregaciones del `groupBy`

```
_sum   : { segundos: true, costoEstimado: true }
_count : { _all: true, costoEstimado: true }     ← los dos; ver Decisión 3
```

### Invariantes

1. **El total del mes se deriva de los grupos**, nunca de una consulta aparte:
   `mes.minutos === suma(mesPorProveedor[].consumo.minutos)` y lo mismo para el costo (FR-004).
2. **Los `Decimal` se suman como `Decimal`.** `Prisma.Decimal.add` entre grupos; `Number()` una
   sola vez, al borde de la presentación. Acumular con `+` de JavaScript introduce desvío en
   decimales y rompe el invariante 1 justo donde no se ve.
3. **El redondeo ocurre una sola vez**, al final, vía `repartirRedondeo` sobre los valores
   exactos. Redondear antes de sumar rompe el invariante 1.
4. **El costo total del mes suma solo lo estimable**, con el mismo criterio de hoy. Un grupo
   `NO_ESTIMABLE` aporta minutos y no aporta costo (US3, escenario 3).
5. **`hoy` no se desglosa** y conserva su cálculo actual palabra por palabra (Decisión 5).

### Casos borde que el test cubre (Prisma mockeado, como `src/voz/limites.test.ts`)

- El `where` del `groupBy` lleva los tres filtros y el rango es semiabierto.
- `mes` coincide con la suma de los grupos.
- Un grupo con `_count.costoEstimado` entre 1 y `_all - 1` ⇒ `costoCobertura: "PARCIAL"`.
- Un grupo con `_count.costoEstimado: 0` ⇒ `costo: null`, nunca `0`.
- Cuenta sin ninguna fila de `UsoVoz` ⇒ totales en cero, `mesPorProveedor` vacío, sin excepción.

---

## 4. Contrato de UI

### `TabVoz` (`src/configuracion/components/tab-voz.tsx`) — Server Component

Sigue haciendo un `Promise.all` de tres lecturas, llama a `fusionarConsumoProveedores` y pasa el
resultado por props. **No introduce estado de cliente ni carga diferida** (FR-013).

Las dos `TarjetaMetrica` quedan tal cual: mismo título, mismo valor, mismo detalle (FR-003).

### `ListaProveedoresVoz` (`src/configuracion/components/lista-proveedores-voz.tsx`)

Recibe `proveedores: ProveedorVozConConsumo[]` y `eliminados: ConsumoVoz | null`. Sigue siendo
Client Component por sus botones (probar, activar, editar, eliminar); el consumo entra como dato,
no como fetch.

Cada fila agrega **una** línea de texto bajo la que ya existe:

| Estado de la fila | Texto |
|---|---|
| Con consumo y costo completo | `12.3 min este mes · 2.61` |
| Con consumo y costo parcial | `12.3 min este mes · 2.61 (parte del mes sin tarifa)` |
| Con consumo, sin tarifa | `12.3 min este mes · costo no estimado` |
| Sin consumo | `Sin consumo este mes` |

La entrada de eliminados se renderiza al final de la lista, con el mismo tratamiento visual pero
sin botones de acción —no hay nada que accionar— y rotulada "Proveedor eliminado".

Dice "costo no estimado" y no "sin tarifa cargada" —como decía el contrato original— porque la
línea inmediatamente superior de la misma fila **ya avisa** `· sin tarifa cargada` cuando
`costoPorHora` es `null`. Repetirlo deja la fila diciendo lo mismo dos veces seguidas. FR-006 se
sigue cumpliendo: entre las dos líneas, el aviso de tarifa faltante es explícito, y "costo no
estimado" no es confundible con un cero.

El monto se muestra con el mismo formato que ya usa la tarjeta de total y la tarifa por hora de
la fila: sin símbolo de moneda. Unificar la moneda es un tema aparte (`spec.md` § Assumptions).

### Lo que la UI NO hace

- No formatea fechas (no hay ninguna que mostrar).
- No recibe ni toca `apiKeyEncriptada`: `ProveedorVozConConsumo` extiende `ProveedorVozListado`,
  que ya la excluye por construcción (FR-012).
- No agrega `<Select>`, así que la regla de la prop `items` de `docs/selects.md` no aplica.
