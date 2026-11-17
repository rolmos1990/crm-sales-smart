# Data Model — Mostrar quién recibe en el listado de Pedidos

**Sin entidades nuevas y sin migración.**

El dato ya existe: `EntregaPedido.nombreDestinatario` (`String?`), declarado en `prisma/schema.prisma` y poblado desde el formulario de entrega del pedido y desde la cotización al generarlo (`generar-pedido-desde-cotizacion.service.ts` lo copia junto al resto del snapshot de envío).

Único cambio relacionado a datos: el `select` de la entrega en el listado (`incluirRelaciones`, `src/sales/pedidos/queries.ts`) pasa de `{ metodoEntrega }` a `{ metodoEntrega, nombreDestinatario }`. No cambia el plan de la consulta — el join con `EntregaPedido` ya se hacía para la columna "Método de envío".

El tipo `Pedido` (`src/sales/pedidos/types.ts`) refleja esa columna extra en `entrega`.
