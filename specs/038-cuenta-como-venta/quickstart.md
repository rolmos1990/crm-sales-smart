# Quickstart: validar "Cuenta como Venta"

**Feature**: 038-cuenta-como-venta | **Date**: 2026-11-18

Guía de validación end-to-end. Los detalles de columnas y migración están en [data-model.md](./data-model.md); el porqué de cada decisión, en [research.md](./research.md).

## Prerrequisitos

- Node 20+, PostgreSQL corriendo y `.env` configurado
- Rama `feature/038-cuenta-como-venta`
- Una instancia con Flujo de Venta configurado y al menos 10 pedidos en etapas distintas

```bash
npm install
npm run db:migrate     # aplica 20261118000000_cuenta_como_venta
npx tsx scripts/depurar-reglas-fecha-expiracion.ts   # paso 5 de la migración
npm run db:seed        # opcional, datos de prueba
```

## 1. Verificación automática

```bash
npx vitest run src/sales/pedidos src/sales/flujo-venta scripts/depurar-reglas
npx tsc --noEmit
npm run build
```

`tsc --noEmit` es la comprobación central de la User Story 3: si sobrevive **cualquier** referencia a `Pedido.fechaExpiracion`, falla. No se debe dar por terminada la eliminación sin verlo en verde.

### Cobertura esperada de los tests

| Qué se prueba | Requisito | Cómo |
|---|---|---|
| Solo las etapas marcadas suman | FR-006 | `construirCondicionVenta` con 2 marcadas de 4 → filtro con esos 2 ids |
| Ninguna etapa marcada → 0 | FR-009 | `construirCondicionVenta` con 0 marcadas → `{ in: [] }`, **no** "sin filtro" |
| Sin flujo dinámico → enum legacy | FR-010 | `construirCondicionVenta([])` → `{ estado: "ENTREGADO" }` |
| La venta se atribuye al mes correcto | FR-017 | pedido creado 28-oct, `fechaVenta` 03-nov → entra en nov, no en oct |
| Corte de día en zona de negocio | FR-019 | `America/Lima`, venta 31-oct 23:30 local → cuenta en octubre |
| Fecha escrita en los 4 caminos | FR-014, FR-015 | integración: tras crear / convertir / mover a mano / mover por disparador, el campo coincide con el `creadoEn` del historial |
| Pendientes/Expirados sobre entrega | FR-026, FR-027 | entrega ayer → Expirados; entrega hoy y mañana → Pendientes |
| Poda del árbol de condiciones | FR-024 | función pura: quita el nodo en nivel 1 y en nivel 2; árbol vacío → `BORRADOR` |

## 2. Verificación manual

```bash
npm run dev
```

### 2.1 — El flag aparece y arranca bien (US1, FR-030)

1. **Configuración → Flujo de Venta → editar "Entregado"**.
2. El toggle **"Cuenta como Venta"** existe y aparece **ya encendido** (backfill del paso 2).
3. La fila de la etapa muestra su distintivo, junto a los de Inicial / Final / Cancelación.
4. Editar una etapa de cancelación: marcarla como venta debe estar impedido o advertido (FR-005).

### 2.2 — Prueba central de FR-008: cambiar la config no requiere recálculo

Es el escenario que motivó todo el diseño. **No ejecutar ninguna migración ni script entre los pasos.**

1. Abrir **Ventas → Pedidos** y anotar el valor de **"Total ventas"**.
2. Volver a Flujo de Venta y marcar **también** una etapa intermedia (ej. "En proceso").
3. Recargar Pedidos → el total **sube**, incluyendo los pedidos de esa etapa.
4. Desmarcar "En proceso" y recargar → el total vuelve **exactamente** al valor del paso 1.

Si en algún punto hiciera falta correr algo para que los números cuadren, el diseño no se implementó como está especificado.

> Ojo con la diferencia entre **pertenencia** y **fecha**: lo que se reevalúa siempre es quién cuenta. La fecha de venta de los pedidos que ya cruzaron **no** se recalcula al marcar una etapa nueva. Un pedido de "En proceso" que nunca llegó a una etapa de venta no tiene fecha, así que suma en el total **sin filtro** pero queda fuera de cualquier total **filtrado por rango** hasta que cruce de verdad.

### 2.3 — La venta se atribuye a cuándo se concretó (US2, FR-017)

1. Tomar un pedido creado el **mes pasado** que siga abierto.
2. Moverlo hoy a la etapa marcada como venta.
3. En Pedidos, filtrar por el **mes en curso** → el pedido suma en "Total ventas".
4. Filtrar por el **mes pasado** → no suma.
5. Comprobar que la lista sigue ordenándose por fecha de creación: el pedido **no aparece** en la lista del mes en curso. Es el comportamiento esperado (Decisión 4), y por eso el subtítulo de la tarjeta dice **"Vendidos en este rango"**.

### 2.3b — La fecha se sella una sola vez (FR-014b)

Con **dos** etapas marcadas como venta (ej. "Pagado" y "Entregado"):

1. Mover un pedido a "Pagado" y anotar en qué mes suma.
2. Moverlo después a "Entregado".
3. El pedido **sigue sumando en el mes de "Pagado"**. Si se movió al mes de "Entregado", la regla de primer sellado no está implementada.
4. Devolverlo a una etapa que no cuenta → deja de sumar, pero al volver a cerrarlo recupera **la fecha original**, no una nueva.

### 2.4 — La fecha de expiración desapareció (US3, FR-022)

Recorrer y confirmar que no queda rastro:

- Formulario de **creación** de pedido
- Diálogo de **edición** de pedido
- **Detalle** del pedido (sin badge de expiración ni de vencido)
- **Listado** (sin columna "Expiración")
- **CSV exportado** (sin esa columna ni su encabezado)
- **Reglas de validación** → el campo "Fecha de expiración" ya no se ofrece

### 2.5 — Lo que NO debía tocarse (FR-023)

- **Cotización** → su fecha de vencimiento sigue presente y funcionando.
- **Pedido con producto digital** → la entrega digital conserva su fecha de caducidad por línea.

### 2.6 — Pendientes y Expirados (US4)

Con pedidos **abiertos**:

| Entrega estimada | Tarjeta esperada |
|---|---|
| ayer | Expirados |
| hoy | Pendientes (todo el día, hora local) |
| mañana | Pendientes |
| sin fecha | ninguna |

Y un pedido **cerrado** con entrega de ayer: ninguna de las dos.

### 2.7 — Reglas de validación depuradas (FR-024, FR-025)

Si alguna cuenta tenía una regla sobre "Fecha de expiración":

1. Revisar el log del script: debe listar id, nombre e instancia de cada regla tocada.
2. Abrir esa regla en la UI → la condición ya no está; si era la única, la regla quedó en **BORRADOR** y no bloquea nada.
3. Mover un pedido a la etapa destino de esa regla → **avanza**. Que se quede trabado sin mensaje es exactamente el fallo que este paso previene.

## 3. Criterios de aceptación del despliegue

- [ ] `npx tsc --noEmit` limpio y `npm run build` en verde
- [ ] Suite de Vitest en verde, incluyendo el caso "ninguna etapa marcada → 0"
- [ ] 2.2 pasa **sin ejecutar nada** entre marcar y ver el resultado
- [ ] Todos los pedidos que YA cuentan como venta tienen `fechaVenta` (FR-031, SC-008):
      ```sql
      SELECT COUNT(*) FROM "Pedido" p
        JOIN "FlujoVentaEtapa" e ON e.id = p."flujoVentaEtapaId"
       WHERE e."cuentaComoVenta" = true AND p."fechaVenta" IS NULL;   -- → 0
      ```
      Los pedidos **abiertos** deben quedar en `NULL` a propósito: reciben su fecha real al cruzar. Que ese conteo sea distinto de cero no es el problema; que lo sea el de arriba, sí.
- [ ] Ninguna regla referencia el campo eliminado:
      `SELECT COUNT(*) FROM "FlujoVentaRegla" WHERE "arbolCondiciones"::text LIKE '%fechaExpiracion%';` → **0**
- [ ] Se comunicó que los totales **bajan** respecto de los de hoy — es la corrección buscada, no una regresión
