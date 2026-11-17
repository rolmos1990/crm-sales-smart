# Implementation Plan: Sincronizar la fecha de entrega al editar un pedido

**Branch**: `fix/036-sync-fecha-entrega-edicion-pedido` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Tipo**: Hotfix (plan liviano — ver `docs/SPEC-KIT-WORKFLOWS.md`)

## Summary

`editarPedido` escribe `Pedido.fechaEntrega` y no `EntregaPedido.fechaEstimada`. El fix agrega esa segunda escritura dentro de la transacción que ya existe, con el mismo criterio que `actualizarEntregaPedido` usa en el sentido inverso. Un archivo de producción tocado, más un test de comportamiento.

## Módulos afectados

| Módulo | Archivo | Cambio |
|---|---|---|
| Sales / Pedidos | `src/sales/pedidos/actions.ts` (`editarPedido`) | Sincronizar `EntregaPedido.fechaEstimada` dentro de la `$transaction` existente |
| Sales / Pedidos (test) | `src/sales/pedidos/sync-fecha-entrega.test.ts` (nuevo) | Test de comportamiento sobre doble de Prisma en memoria |

Sin cambios en UI, queries, schema Prisma, eventos ni contratos.

## Decisiones técnicas

**D1 — `updateMany` en lugar de `update` o `upsert`.**
`update` sobre una fila inexistente lanza `P2025` y haría fallar la edición de todo pedido sin entrega (servicios, entrega digital, o un envío todavía no registrado). `upsert` crearía un `EntregaPedido` con `metodoEntrega: COURIER_EXTERNO` por defecto, haciendo aparecer un bloque "Entrega y seguimiento" en pedidos que nunca tuvieron envío (FR-003). `updateMany` sobre `where: { pedidoId: id }` es un no-op silencioso cuando no hay entrega, que es exactamente el comportamiento buscado.

**D2 — La fecha del pedido manda sobre la copia de la entrega.**
`Pedido.fechaEntrega` es la fuente de verdad (listado, filtro, KPIs, Preparación); `EntregaPedido.fechaEstimada` es la copia que ve el detalle. Al editar el pedido se pisa la copia, incluido el caso de borrado (`null`). Es simétrico a lo que ya hace `actualizarEntregaPedido`, que escribe las dos desde el otro extremo.

**D3 — Se sincroniza aunque la etapa tenga `permiteEditarEntrega: false`.**
Ese flag gobierna la sección "Entrega y seguimiento" (transportista, guía, dirección, costo). La fecha ya era editable desde el diálogo del pedido con solo `permiteEditarPedido: true`, y el listado ya la reflejaba: mantener la copia al día no amplía lo que el usuario puede cambiar, solo evita que quede obsoleta. Ningún otro campo de la entrega se toca (FR-005).

**D4 — Dentro de la transacción existente.**
Los dos campos quedan siempre en el mismo estado, nunca uno sí y otro no (FR-004, Principio III de la constitución).

**D5 — Sin entrada de historial nueva.**
El cambio de fecha ya se registra como `PEDIDO_EDITADO` vía `diffCampo("fechaEntrega", ...)`. La escritura en la entrega es la misma fecha en su segunda ubicación, no un cambio distinto: duplicarla en el historial mostraría dos cambios donde el usuario hizo uno (FR-008).

## Artefactos omitidos y por qué

- **`research.md`**: no hay decisión técnica que investigar — la causa raíz y la solución quedaron cerradas en el Diagnóstico previo del spec, y las cuatro decisiones de diseño están arriba. (Permitido para Hotfix según `docs/SPEC-KIT-WORKFLOWS.md`.)
- **`data-model.md`**: sin cambios de modelo. `Pedido.fechaEntrega` y `EntregaPedido.fechaEstimada` ya existen tal cual; no se agrega, renombra ni elimina ninguna columna y no hay migración.

## Tests (proporcionales al riesgo — Principio V)

Test unitario de comportamiento (`vitest`) con un doble de Prisma en memoria, siguiendo el patrón ya establecido en `src/sales/pedidos/stock-combos.test.ts`, que ya ejercita `editarPedido` sin base de datos. Cubre:

1. Cambiar la fecha escribe el mismo valor en las dos ubicaciones.
2. Borrar la fecha deja `null` en las dos.
3. Un pedido sin entrega no gana una: la escritura en la entrega no afecta ninguna fila.
4. Editar sin tocar la fecha no altera ningún otro campo de la entrega.

No se agrega test E2E: el camino de UI (diálogo → Server Action) no cambia, y el riesgo está en la escritura, que el test unitario cubre de forma directa.

## Validación

- `npx vitest run src/sales/pedidos` — verde.
- `npx tsc --noEmit` sobre los archivos tocados, sin errores nuevos.
- `quickstart.md` corrido a mano, incluido el escenario de cero regresión.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper la edición de pedidos sin entrega | D1 (`updateMany`) + escenario 3 del test y del quickstart |
| Pisar datos de entrega no relacionados con la fecha | El `data` del `updateMany` contiene un solo campo; FR-005 y escenario 4 del test |
| Romper lo que ya funciona en la sección de entrega | No se toca `actualizarEntregaPedido`; escenario de cero regresión en `quickstart.md` |
