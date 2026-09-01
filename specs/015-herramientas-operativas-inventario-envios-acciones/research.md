# Research: Herramientas operativas de inventario, envíos y acciones comerciales controladas

## Decisión 1 — Modelo mínimo de configuración de entregas (no existe ninguno hoy)

**Decisión**: 3 tablas nuevas, deliberadamente simples:

- `MetodoEntregaConfig`: por instancia, un `MetodoEntrega` (enum ya existente) activo con `costoBase`, `diasEstimadosMin`/`diasEstimadosMax`.
- `ZonaCobertura`: por instancia, un nombre/código de zona (texto libre — Karia no tiene un catálogo geográfico hoy), asociada a uno o más `MetodoEntregaConfig` vía tabla puente `ZonaCoberturaMetodo` (costo adicional y cobertura booleana por combinación zona+método).
- `UbicacionRetiro`: por instancia, nombre, dirección, activo — solo relevante para el método `RETIRO_TIENDA` ya existente en el enum `MetodoEntrega`.

**Rationale**: es el modelo más simple que permite responder honestamente las 5 preguntas operativas del pedido (métodos disponibles, costo, cobertura, fecha estimada, ubicaciones de retiro) sin inventar una geografía o un motor de tarifas que Karia no tiene y que el pedido no especifica con ese nivel de detalle. Zona como texto libre (no un catálogo de ciudades/provincias) evita construir un catálogo geográfico completo que no fue pedido.

**Alternativas consideradas**: reutilizar `Cotizacion.costoEnvio`/`Pedido.metodoEntrega` como si fueran configuración — rechazado, son valores de un documento puntual ya decidido por un humano, no una tarifa general consultable antes de crear ningún documento.

## Decisión 2 — Criterio de "combinación de productos válida" (FR-004)

**Decisión**: una combinación de `productoId[]` es válida si todos existen, pertenecen a la instancia, están `activo: true`, y — único criterio de incompatibilidad ya existente en el schema — no mezclan tipos de cumplimiento que Karia ya trata como mutuamente excluyentes a nivel de documento cuando corresponde (`tipoCumplimiento` de `Cotizacion`/`Pedido` se resuelve "a partir del producto de la primera línea", según el comentario ya existente en el schema) — la tool señala esto como advertencia, no como bloqueo, dado que hoy Karia ya permite mezclar productos de distinto tipo en una misma cotización (`tipoCumplimiento` es una resolución, no una restricción dura).

**Rationale**: no inventar una regla de negocio de "combinación inválida" que Karia no tiene hoy — la única fuente de verdad real es existencia + estado activo; la advertencia de tipo mixto es informativa, apoyada en un comentario ya presente en el schema, no una prohibición nueva no pedida.

**Alternativas consideradas**: definir reglas de incompatibilidad de categorías (ej. "no vender X con Y") — rechazado por no existir ese concepto en el catálogo de Karia hoy; agregarlo sería inventar una regla de negocio no solicitada.

## Decisión 3 — Cómo se marca el modo de confirmación humana sin tabla paralela

**Decisión**: `Cotizacion` y `Pedido` ganan `generadoPorIA: Boolean @default(false)`, `confirmadoPorHumano: Boolean @default(true)`, `confirmadoPorUsuarioId: String? `. Cuando `AgenteIAConfig.accionesComercialesModoBorrador = false` (default), las tools de creación no tocan estos campos nuevos (quedan en su default `generadoPorIA: false, confirmadoPorHumano: true` — indistinguible de un documento creado por un humano, comportamiento actual exacto). Cuando `= true`, las tools crean con `generadoPorIA: true, confirmadoPorHumano: false`; una acción humana explícita (`confirmarDocumentoIA`) setea `confirmadoPorHumano: true, confirmadoPorUsuarioId`.

**Rationale**: cumple FR-016/SC-003 de forma literal — el default de las columnas nuevas reproduce exactamente el estado de un documento creado hoy, así que un negocio que nunca activa el flag no puede notar ninguna diferencia, ni siquiera mirando la base de datos. Evita crear un tipo de "propuesta" paralelo a `Cotizacion`/`Pedido` que luego habría que "convertir" en el documento real — con este diseño, el documento ya es el real desde el principio, solo con una marca de revisión pendiente.

**Alternativas consideradas**: tabla `PropuestaComercialIA` separada que se "promueve" a `Cotizacion`/`Pedido` real al confirmar — rechazada por duplicar todo el modelo de líneas/cálculo de totales ya existente en `Cotizacion`/`Pedido`, y por complicar innecesariamente reportes/pipeline que ya esperan encontrar `Cotizacion`/`Pedido` reales.

## Decisión 4 — Promociones: tool honesta sin fuente de datos

**Decisión**: `consultar_promociones.tool.ts` se implementa completa (validaciones, contrato, registro), pero su lógica de datos siempre resuelve "sin promociones configuradas" — no se agrega ningún campo de promoción a `Producto` en esta spec.

**Rationale**: cumplir FR-003 tal como está escrito (la tool existe y es honesta) sin inventar un modelo de promociones que el pedido no detalla (vigencia, tipo de descuento, condiciones) y que merece su propia spec de producto si el negocio lo necesita — agregar ese modelo de forma apurada acá sería una funcionalidad de venta a medias, no bien pensada.

**Alternativas consideradas**: no incluir la tool hasta que exista el modelo de promociones — rechazada porque el pedido la lista explícitamente entre las tools de esta sección y el agente necesita poder responder "no hay promociones" en vez de no tener ninguna forma de responder esa pregunta en absoluto.
