# Research: Preparación de pedidos

**Feature**: 026-preparacion-pedidos | **Fecha**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

Investigación sobre el código existente para resolver las incógnitas técnicas del plan. Cada decisión
indica qué se eligió, por qué, y qué alternativa se descartó.

---

## Decisión 1 — Cómo entra un pedido al tablero: pertenencia derivada + materialización perezosa

**Contexto**: FR-006/FR-007 exigen que un pedido aparezca en el tablero automáticamente al alcanzar
una etapa habilitada.

**Hallazgo (el que cambia el diseño)**: `flujoVentaEtapaId` se escribe desde **cuatro** lugares, no uno:

| # | Origen | Ubicación |
|---|--------|-----------|
| 1 | Movimiento de etapa (manual o automático) | `src/sales/flujo-venta/motor.ts:93` (`_moverInterno`) |
| 2 | Disparador `CAMBIAR_ETAPA` | `src/crm/pipeline/disparadores/ejecutor.ts:274` |
| 3 | Pedido nacido de una cotización aprobada | `src/sales/cotizaciones/services/generar-pedido-desde-cotizacion.service.ts:127` |
| 4 | Pedido creado manualmente | `src/sales/pedidos/actions.ts:172` |

Los casos 3 y 4 asignan la **etapa inicial** al crear el pedido, sin pasar por `procesarCambioEtapaPedido`.

**Decisión**: la pertenencia al tablero se **deriva por consulta** (`pedido.flujoVentaEtapaId ∈ etapas de entrada`),
y el registro `PreparacionPedido` se **materializa perezosamente**: se crea la primera vez que el pedido se
lee en el tablero o se mueve, lo que ocurra antes. La creación es idempotente (`upsert` por `pedidoId`).

**Rationale**: es imposible que un pedido "se pierda" por un camino de escritura no instrumentado, y no
hay que parchear cuatro sitios ni mantenerlos sincronizados a futuro. El estado real siempre se puede
reconstruir desde la etapa del pedido más la configuración.

**Alternativa descartada**: enganchar la creación en `procesarCambioEtapaPedido` (motor de disparadores).
Cubre solo los casos 1 y 2; un pedido creado ya en etapa "Confirmado" nunca aparecería en el tablero.

**Consecuencia para tasks**: no se modifican los cuatro sitios de escritura; se agrega un servicio
`asegurarPreparacionPedido(pedidoId)` invocado desde la query del tablero y desde la acción de mover.

---

## Decisión 2 — Concurrencia: compare-and-swap con `updateMany`

**Contexto**: FR-017 exige que dos operarios moviendo la misma tarjeta no pierdan ni dupliquen movimientos.

**Hallazgo**: `_moverInterno` (flujo de venta) actualiza sin verificar el estado previo — dos movimientos
simultáneos se pisan silenciosamente. No hay columna de versión ni bloqueo optimista en el proyecto.

**Decisión**: mover con `prisma.preparacionPedido.updateMany({ where: { id, estadoId: estadoEsperado }, data: {...} })`
dentro de una transacción; si `count === 0`, el estado cambió y se devuelve un resultado de conflicto que la UI
traduce en aviso + refresco. El cliente envía el `estadoId` que tenía en pantalla.

**Rationale**: `updateMany` con condición sobre el estado previo es un CAS atómico en Postgres sin agregar
columna de versión ni cambiar el esquema de nada existente.

**Alternativa descartada**: campo `version Int` con incremento — más ceremonia para el mismo resultado, y
obliga a propagar la versión por toda la UI.

---

## Decisión 3 — Avance por línea: columnas en `PedidoLinea`, no tabla aparte

**Contexto**: FR-027/FR-028 requieren cantidad preparada, momento y responsable por línea.

**Decisión**: agregar `cantidadPreparada`, `preparadaEn` y `preparadaPorId` a `PedidoLinea`.

**Rationale**: la relación es 1:1 estricta con la línea y se lee siempre junto con ella (la tarjeta del
tablero muestra las líneas). Una tabla aparte agregaría un join en el camino más caliente sin aportar nada.

**Alternativa descartada**: `PreparacionLinea(preparacionId, pedidoLineaId)` — solo tendría sentido si una
línea pudiera prepararse en varias preparaciones distintas, que no es el caso.

---

## Decisión 4 — `PreparacionPedido` como bloque 1:1, no columnas en `Pedido`

**Hallazgo**: `Pedido` ya usa este patrón para sus bloques opcionales: `entrega EntregaPedido?` y
`servicio ServicioPedido?`, ambos 1:1 con `@unique` sobre `pedidoId`.

**Decisión**: `PreparacionPedido` sigue exactamente ese patrón.

**Rationale**: consistencia con el modelo existente; el registro existe solo para pedidos que entraron al
tablero; evita sumar cinco columnas más a un modelo que ya tiene más de cuarenta.

---

## Decisión 5 — Flujo de preparación por defecto: creación perezosa idempotente

**Contexto**: FR-003 exige que el módulo funcione sin configuración previa.

**Decisión**: `asegurarFlujoPreparacion(instanciaId)` crea, la primera vez que se accede al módulo, un flujo
con dos estados ("Por preparar" inicial, "Preparado" final con `marcaInicio` en el primero) y sin etapas de
entrada configuradas (por defecto entran los pedidos en etapas no finales ni de cancelación).

**Rationale**: no requiere migración de datos sobre todas las instancias existentes, y una instancia creada
después de la migración queda cubierta por el mismo camino.

**Alternativa descartada**: backfill por migración — dejaría sin cubrir a las instancias futuras y obliga a
un script de datos que hay que mantener.

---

## Decisión 6 — Kanban: reutilizar el patrón de `pipeline-kanban-dinamico`

**Hallazgo**: `src/crm/pipeline/components/pipeline-kanban-dinamico.tsx` ya resuelve con dnd-kit columnas
dinámicas, `useDroppable` por columna, `useSortable` por tarjeta, overlay de arrastre y contenedor con scroll
horizontal (`kanban-scroll-container.tsx`).

**Decisión**: replicar ese patrón en `src/sales/preparacion/components/`, cargando el tablero con
`next/dynamic` (`ssr: false`) desde la página, igual que hace pipeline.

**Rationale**: dnd-kit ya está en dependencias; el patrón está probado en producción en este mismo proyecto,
incluido el comportamiento táctil y el scroll.

**No se hace**: extraer un kanban genérico compartido entre pipeline y preparación. Las entidades, acciones
y reglas difieren lo suficiente como para que la abstracción prematura cueste más de lo que ahorra.

---

## Decisión 7 — Rangos de fecha: reutilizar `utils/fechas-zona.ts` de pedidos

**Hallazgo**: `src/sales/pedidos/utils/fechas-zona.ts` ya expone `rangoDiaEnZona`, `fechaYMDEnZona`,
`rangoMesActualEnZona`, `inicioDiaEnZona`, `parseYMD` y `sumarDias`, y el listado de pedidos los usa para que
"Hoy/Mañana" coincidan entre servidor y cliente en la zona horaria de negocio.

**Decisión**: importar esas funciones directamente desde el módulo de preparación (sin barrel files, según
convención del proyecto). "Esta semana" se implementa sobre `rangoDiaEnZona` + `sumarDias`.

**Rationale**: si preparación calculara "hoy" por su cuenta, los contadores del tablero y los del listado de
pedidos podrían no coincidir cerca de medianoche — exactamente el bug que esas utilidades ya resuelven.

---

## Decisión 8 — Los dos ejes no se tocan (resuelto por el usuario)

**Contexto**: `EntregaPedido.estadoEntrega` incluye hoy el valor `PREPARANDO` (enum `EstadoEntrega`).

**Decisión** (clarificación del usuario, sesión 2026-09-17): conviven sin sincronización. Preparación es el
armado interno; entrega es la logística. Ningún movimiento de un eje escribe en el otro.

**Consecuencia de diseño**: como quedan dos "preparando" visibles, FR-036a exige bloques y etiquetas
distinguibles. En el detalle del pedido, el bloque de preparación se rotula "Preparación (armado)" y se
ubica separado del bloque de Entrega; en la lista, el chip de preparación va subordinado al badge de etapa.

**Riesgo aceptado y registrado**: un usuario puede actualizar un eje y olvidar el otro. No se mitiga con
código en esta feature, por decisión explícita.

---

## Decisión 9 — Permisos: módulo propio `preparacion`

**Hallazgo**: `src/shared/auth/permisos.ts` define el type `Modulo` (línea 45) y una matriz
`PERMISOS: Record<Rol, Record<Modulo, NivelAcceso>>`. Agregar un módulo obliga a completar la matriz para
todos los roles — el compilador lo exige, así que no hay riesgo de olvido silencioso.

**Decisión**: agregar `"preparacion"`. Nivel sugerido: OWNER/ADMIN modificar; AGENTE_VENTAS ver; el rol
operativo que prepare pedidos necesita modificar en `preparacion` sin necesitar modificar en `pedidos`.

**Pendiente menor para el plan**: confirmar con el usuario qué rol concreto usa el equipo de armado; el
default propuesto no bloquea la implementación.

---

## Decisión 10 — Eventos de dominio

**Hallazgo**: `src/eventos/catalogo.ts` agrupa los nombres por módulo; los contratos viven en
`src/eventos/contratos/*.event.ts` y el sobre `EventoDominio` (en `base.event.ts`) ya lleva `version: number`,
por lo que el payload no repite la versión.

**Decisión**: agregar a `EventosSistema` los nombres `PreparacionIniciada` (`PREPARACION_INICIADA`),
`PreparacionCompletada` (`PREPARACION_COMPLETADA`) y `LineaPedidoPreparada` (`LINEA_PEDIDO_PREPARADA`), con
un contrato por evento y documentación en `docs/eventos.md`.

**Nota**: el movimiento entre estados intermedios **no** emite evento — solo inicio, fin y preparación de
línea. Evita ruido en la cola por cada arrastre de tarjeta.

---

## Decisión 11 — Tests

**Hallazgo**: el proyecto separa Vitest (`src/**/*.test.ts`, lógica pura, sin DB ni browser) de Playwright
(`tests/e2e/**`, integración real). Existe `tests/e2e/sales/flujo-venta.spec.ts` como referencia directa.

**Decisión**:
- **Vitest**: sellado de fechas y responsable (las cuatro reglas de la tabla de transiciones), cálculo de
  avance de un pedido a partir de sus líneas, validación de cantidad preparada ≤ cantidad pedida, y
  resolución del rango "esta semana".
- **Playwright**: `tests/e2e/sales/preparacion.spec.ts` — mover una tarjeta extremo a extremo, ver el chip en
  la lista de pedidos, y no-regresión de la lista/detalle para una instancia sin preparación.
