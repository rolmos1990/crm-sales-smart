# Research — Mostrar quién recibe en el listado de Pedidos

## Decisión 1 — De dónde sale el dato

**Decision**: `EntregaPedido.nombreDestinatario`, agregado al `select` de la entrega que el listado ya trae (`incluirRelaciones` en `src/sales/pedidos/queries.ts`, que hoy pide solo `metodoEntrega`).

**Rationale**: El listado ya hace join con `EntregaPedido` para la columna "Método de envío", así que sumar una columna al `select` no agrega una consulta ni un join nuevo. El campo ya existe y es el que el detalle del pedido muestra como "Recibe" (`seccion-entrega.tsx:120`).

**Alternatives considered**:
- *Un campo nuevo en `Pedido`*: duplicaría un dato que ya vive en la entrega, con el mismo riesgo de desincronización que acaba de costar el Hotfix 036. Descartado.
- *Traerlo en una segunda consulta*: innecesario, el join ya existe.

## Decisión 2 — Dónde y cómo se muestra

**Decision**: Un chip bajo el nombre del cliente, dentro de la misma columna "Cliente", con el texto `Recibe: <nombre>`, reutilizando el lenguaje visual del chip de preparación (`chip-estado-preparacion.tsx`): `rounded-full border border-border bg-muted/40 text-muted-foreground`, `text-[11px]`.

**Rationale**: Es lo que pidió el usuario y lo que muestra su mockup. Mantenerlo dentro de la columna "Cliente" —y no como columna propia— deja claro que es un dato subordinado al cliente y no agrega una columna más a una tabla que ya tiene ocho. Reutilizar el estilo del chip de preparación evita inventar un tercer lenguaje visual para "dato secundario en una celda".

**Alternatives considered**:
- *Columna propia "Recibe"*: con 9 de 251 pedidos usando el campo, sería una columna casi vacía ocupando ancho en todas las filas.
- *Badge del design system (`<Badge variant="outline">`)*: tiene `h-5` y `text-xs`, pensado para estados; se ve más pesado que el dato auxiliar que esto es. El chip de preparación ya resolvió exactamente este problema en esta misma tabla.

## Decisión 3 — Qué hacer si el destinatario coincide con el cliente

**Decision**: Mostrarlo igual. Sin heurística de deduplicación.

**Rationale**: Se midió contra producción (251 pedidos de la cuenta principal): 9 tienen destinatario y **ninguno** coincide exactamente con el nombre del cliente. Sí hay varias coincidencias parciales — "Yirali P." / "Yirali Paz", "Eleanie Araúz Domínguez" / "Elanie" — donde cualquier comparación laxa escondería un dato que el usuario cargó a propósito, y una comparación estricta no se activaría nunca. Una regla que no se dispara en ningún caso real solo agrega código que mantener.

**Alternatives considered**:
- *Ocultar si es idéntico (normalizando acentos y mayúsculas)*: 0 casos en producción. Se puede sumar después si el dato se populariza y aparece ruido real.

## Decisión 4 — Destinatarios largos

**Decision**: `max-w` + `truncate` + `title` con el valor completo.

**Rationale**: El campo es texto libre y en producción ya se usa como cajón de sastre: `"Julio Ortiz  6394-4040  8-947-2275  Chitré"` (PED-2026-0244). Sin acotarlo, esa fila ensancha la columna "Cliente" y desacomoda la tabla entera. El `title` mantiene el valor accesible sin abrir el pedido.

**Alternatives considered**:
- *Dejarlo fluir*: rompe la tabla en el caso que ya existe hoy en los datos.
- *Tooltip del design system*: la tabla no monta tooltips por fila; `title` nativo alcanza para un dato auxiliar y no agrega JS por fila.
