# Feature Specification: Sincronizar la fecha de entrega al editar un pedido

**Feature Branch**: `fix/036-sync-fecha-entrega-edicion-pedido`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Al editar un pedido desde el diálogo 'Editar pedido', la fecha de entrega se guarda solo en `Pedido.fechaEntrega` y no se sincroniza con `EntregaPedido.fechaEstimada`, que es la que muestra la sección 'Entrega y seguimiento' del detalle. Resultado: después de editar un pedido, el listado y la sección de entrega muestran fechas distintas, o el listado muestra '—' mientras la sección sigue mostrando una fecha. Es el mismo problema que ya se arregló en el sentido inverso en `actualizarEntregaPedido` y en `generarPedidoDesdeCotizacion` (commit `8b078d1`). Falta cerrar el camino de edición manual."

## Diagnóstico previo (investigación de código)

### Qué se investigó y dónde

- `src/sales/pedidos/components/lista-pedidos.tsx:37-60` — la columna "Entrega estimada" del listado.
- `src/sales/pedidos/queries.ts:95-100` y `src/sales/pedidos/vista.ts:44-55` — el filtro "Entrega estimada" (hoy / mañana / personalizado).
- `src/sales/pedidos/components/seccion-entrega.tsx:125-128` — la fecha que muestra la sección "Entrega y seguimiento" del detalle.
- `src/sales/pedidos/actions.ts:500-580` (`actualizarEntregaPedido`) y `:408-430` (`editarPedido`) — los dos Server Actions que escriben una fecha de entrega.
- `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts:108-160` — la generación del pedido al aprobar una cotización.
- `src/ai/tools/shared/resolver-entrega-ia.ts:64-84` (`DatosEntregaPersistibles`) y `src/ai/tools/providers/crear-pedido.tool.ts:181` — la creación de pedidos por el agente IA.
- `prisma/schema.prisma` — modelos `Pedido` y `EntregaPedido`.

### Dos campos distintos, por diseño

| Campo | Quién lo lee |
|---|---|
| `Pedido.fechaEntrega` | Columna "Entrega estimada" del listado, su filtro, los KPIs y el tablero de Preparación (`src/sales/preparacion/queries.ts`) |
| `EntregaPedido.fechaEstimada` | Solo la sección "Entrega y seguimiento" del detalle del pedido |

No son redundantes por accidente: el listado y sus filtros necesitan la fecha en `Pedido` para consultarla sin un join, y la entrega la conserva como parte del seguimiento del envío. El código ya documenta la trampa en `actions.ts:549-556`. La consecuencia es que **todo camino que escriba una de las dos debe escribir la otra**.

### Qué se confirmó que SÍ funciona (no se toca)

- `actualizarEntregaPedido` (sección "Entrega y seguimiento") escribe **las dos** dentro de una `$transaction` — correcto desde el commit `cf4032d` (19-ago-2026).
- `generarPedidoDesdeCotizacion` copia la fecha de la cotización a **las dos** — corregido en el commit `8b078d1` (13-nov-2026), ya desplegado en producción (sha `00206ef`, deploy del 17-nov 05:32 UTC).
- `crear_pedido` del agente IA no escribe ninguna de las dos (`DatosEntregaPersistibles` no incluye `fechaEstimada`), así que no puede desincronizarlas.
- El alta manual de un pedido (`crearPedido`) escribe `Pedido.fechaEntrega` cuando el usuario la indica, y el pedido nace sin `EntregaPedido` — no hay nada que desincronizar hasta que se registre la entrega, y ese registro pasa por `actualizarEntregaPedido`, que ya sincroniza.

### Causa raíz exacta

`editarPedido` (`src/sales/pedidos/actions.ts:408-430`) actualiza `Pedido.fechaEntrega` dentro de su transacción:

```ts
fechaEntrega: fechaEntrega ?? null,
```

y **nunca toca `EntregaPedido.fechaEstimada`**. Es el único camino vivo que escribe una de las dos sin escribir la otra: el mismo descuido que ya se corrigió dos veces (en `actualizarEntregaPedido` y en `generarPedidoDesdeCotizacion`), que quedó pendiente acá.

### Por qué el síntoma se explica por esta causa y no por otra

Después de editar un pedido que tiene entrega registrada, las dos pantallas leen fuentes distintas que ya divergieron:

- Si el usuario **cambia** la fecha en el diálogo → el listado y el filtro muestran la nueva; "Entrega y seguimiento" sigue mostrando la vieja.
- Si el usuario **borra** la fecha en el diálogo → el listado muestra `—` y el pedido sale del filtro; "Entrega y seguimiento" sigue mostrando la fecha. Esto es indistinguible, para quien lo ve, del bug de cotizaciones ya corregido.

Se descartó que fuera un problema de presentación (zona horaria, formato): el listado lee un campo que efectivamente quedó con otro valor en base de datos, no el mismo valor formateado distinto.

### Alcance acotado

El pedido `cmwcn4ugp001z0ssht1mc7j2k`, que originó la investigación, **no** se repara con este Hotfix: su desincronización viene del bug de cotizaciones ya corregido, y los ~37 pedidos afectados por aquel se reparan con `scripts/backfill-fecha-entrega-pedido.ts`, que es una tarea operativa aparte (ver Assumptions).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar la fecha de entrega al editar un pedido (Priority: P1)

Como usuario de ventas, quiero que al cambiar la fecha de entrega desde "Editar pedido" esa fecha quede reflejada en todas las pantallas del pedido, para no tener que recordar en cuál de las dos confiar.

**Why this priority**: Es la causa raíz y el caso más frecuente — editar un pedido es una operación de todos los días, y hoy deja los datos contradictorios.

**Independent Test**: Sobre un pedido con entrega registrada y fecha estimada, cambiar la fecha desde el diálogo "Editar pedido", guardar, y comprobar que el listado y la sección "Entrega y seguimiento" muestran la misma fecha nueva.

**Acceptance Scenarios**:

1. **Given** un pedido con entrega registrada y fecha estimada 12/11/2026, **When** el usuario cambia la fecha de entrega a 20/11/2026 desde "Editar pedido" y guarda, **Then** la columna "Entrega estimada" del listado y la sección "Entrega y seguimiento" muestran ambas 20/11/2026.
2. **Given** ese mismo pedido ya editado, **When** el usuario aplica el filtro "Entrega estimada" sobre el rango que incluye 20/11/2026, **Then** el pedido aparece en los resultados.
3. **Given** un pedido **sin** entrega registrada, **When** el usuario le pone fecha de entrega desde "Editar pedido" y guarda, **Then** la fecha aparece en el listado y el pedido **no** gana una sección "Entrega y seguimiento" que antes no tenía.

---

### User Story 2 - Quitar la fecha de entrega al editar un pedido (Priority: P2)

Como usuario de ventas, quiero que al borrar la fecha de entrega desde "Editar pedido" deje de aparecer en todas las pantallas, para que un pedido sin fecha se vea sin fecha en todos lados.

**Why this priority**: Mismo mecanismo que la US1 pero sobre el caso de borrado, que es el que produce el síntoma más confuso (listado en `—` con el detalle mostrando una fecha, idéntico al bug de cotizaciones ya corregido).

**Independent Test**: Sobre un pedido con entrega y fecha, vaciar el campo "Fecha de entrega" en el diálogo, guardar, y comprobar que ni el listado ni la sección de entrega muestran fecha.

**Acceptance Scenarios**:

1. **Given** un pedido con entrega registrada y fecha estimada, **When** el usuario borra la fecha de entrega desde "Editar pedido" y guarda, **Then** el listado muestra `—` y la sección "Entrega y seguimiento" también queda sin fecha estimada.
2. **Given** ese pedido sin fecha, **When** el usuario aplica el filtro "Entrega estimada" de cualquier rango, **Then** el pedido no aparece en los resultados.

---

### Edge Cases

- **Pedido sin `EntregaPedido`** (servicio, entrega digital, o envío todavía no registrado): la edición actualiza solo `Pedido.fechaEntrega`; no se crea una entrega que no existía, porque eso haría aparecer un bloque de envío (con método "Courier externo" por defecto) en pedidos que nunca lo tuvieron.
- **Pedido en una etapa que permite editar el pedido pero no la entrega** (`permiteEditarPedido: true`, `permiteEditarEntrega: false`): la sincronización igual ocurre. No amplía lo que el usuario puede cambiar — la fecha ya se podía cambiar desde el diálogo y el listado ya la reflejaba; lo único que cambia es que la copia de la entrega deja de quedar obsoleta. Ningún otro campo de la entrega (transportista, guía, dirección, costo) se toca.
- **Edición que no modifica la fecha** (el usuario cambia una línea o una nota): el valor escrito es el mismo que ya estaba; no debe producir ningún cambio observable ni entradas de historial sobre la fecha.
- **Falla la escritura de cualquiera de los dos campos**: ninguno se escribe. Deben quedar siempre en el mismo estado, nunca uno sí y otro no.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al editar un pedido, el sistema MUST guardar la fecha de entrega indicada en las dos ubicaciones que la consumen (la del pedido y la de la entrega), de modo que el listado, su filtro y la sección "Entrega y seguimiento" muestren siempre el mismo valor.
- **FR-002**: Al borrar la fecha de entrega en la edición, el sistema MUST dejar sin fecha ambas ubicaciones.
- **FR-003**: El sistema MUST NOT crear un registro de entrega para un pedido que no lo tiene. Si el pedido no tiene entrega registrada, la edición solo actualiza la fecha del pedido.
- **FR-004**: La escritura de ambas ubicaciones MUST ser atómica: si falla una, no se aplica ninguna (Principio III de la constitución).
- **FR-005**: El sistema MUST NOT alterar ningún otro dato de la entrega (método, estado, transportista, número de guía, dirección, zona, costo de envío ni el snapshot de tarifa) al editar un pedido.
- **FR-006**: El sistema MUST NOT alterar el comportamiento existente de la sección "Entrega y seguimiento" (`actualizarEntregaPedido`), que ya escribe ambas ubicaciones, ni el de la generación de pedidos desde una cotización, ni el de la creación de pedidos por el agente IA.
- **FR-007**: El sistema MUST NOT alterar las reglas vigentes sobre quién puede editar un pedido (permiso de usuario y `permiteEditarPedido` de la etapa del Flujo de Venta).
- **FR-008**: El historial del pedido MUST seguir registrando el cambio de fecha de entrega exactamente como hoy — una sola entrada `PEDIDO_EDITADO`, sin duplicar el cambio como si fuera también una actualización de entrega.

### Key Entities

- **Pedido**: su fecha de entrega es la fuente de verdad que alimentan el listado, el filtro "Entrega estimada", los KPIs y el tablero de Preparación.
- **EntregaPedido**: registro de seguimiento del envío (opcional, uno por pedido). Conserva una copia de la fecha estimada, que es la que ve el usuario en el detalle y que debe mantenerse igual a la del pedido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Después de editar la fecha de entrega de un pedido, el 100% de las pantallas que muestran esa fecha (listado, filtro, detalle) coinciden, sin que el usuario tenga que hacer nada extra.
- **SC-002**: No existe ninguna secuencia de acciones en la aplicación que deje un pedido con una fecha visible en el detalle y otra (o ninguna) en el listado.
- **SC-003**: Las operaciones que hoy funcionan sobre entrega, cotizaciones aprobadas y pedidos creados por el agente siguen comportándose igual — cero regresión verificada con los escenarios de `quickstart.md`.

## Assumptions

- La fecha que el usuario elige en "Editar pedido" es la intención vigente del negocio y por lo tanto manda sobre la copia guardada en la entrega. No se contempla un caso en que ambas deban diferir a propósito.
- La reparación de los pedidos ya desincronizados (los generados desde cotizaciones antes del commit `8b078d1`) queda fuera de este Hotfix: se resuelve ejecutando `scripts/backfill-fecha-entrega-pedido.ts`, decisión operativa pendiente del responsable.
- No hay cambios en el modelo de datos: ambos campos ya existen y no se agrega, renombra ni elimina ninguna columna.
