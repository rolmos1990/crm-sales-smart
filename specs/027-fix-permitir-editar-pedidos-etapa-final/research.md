# Research: Permitir configurar edición de pedidos en etapas Final/Cancelación

Hotfix con causa raíz ya confirmada en el Diagnóstico previo del `spec.md` — no quedan incógnitas técnicas (`NEEDS CLARIFICATION`) que investigar. Este documento deja constancia de las dos decisiones técnicas mínimas del cambio.

## Decisión 1: Dónde remover el candado

- **Decision**: Remover el forzado a `false` y el `disabled` exclusivamente en `DialogEditarEtapa` (`src/sales/flujo-venta/components/panel-config-etapas.tsx`), sin tocar `actions.ts` (servidor) ni `schema.ts` (validación Zod).
- **Rationale**: El servidor y la página de detalle del pedido ya leen el flag persistido sin ningún hardcode de `esFinal`/`esCancelacion` (confirmado por lectura directa de `src/sales/pedidos/actions.ts:262-269` y `src/app/sales/pedidos/[id]/page.tsx:129`). El único lugar que impide guardar `true` es el propio diálogo de configuración. Tocar más archivos de los necesarios violaría el principio de Hotfix acotado y el requisito "no alterar comportamiento existente" (FR-006).
- **Alternatives considered**: Agregar un flag nuevo a nivel de Flujo de Venta completo (p. ej. `flujoVenta.permiteEditarPedidosFinalizados` global) — descartado porque el spec pide control por etapa individual, no un interruptor global, y porque duplicaría un mecanismo (`permiteEditarPedido` por etapa) que ya existe y ya es la fuente de verdad consultada por el servidor.

## Decisión 2: Qué pasa con etapas Final/Cancelación ya existentes

- **Decision**: No migrar datos. El valor guardado de `permiteEditarPedido`/`permiteEditarEntrega` en etapas Final/Cancelación existentes queda tal cual esté en base de datos (previsiblemente `false`, por haber sido forzado hasta ahora). Al abrir el diálogo, el `useState` inicial (`etapa?.permiteEditarPedido ?? true` / `etapa?.permiteEditarEntrega ?? false`) ya lee ese valor real — solo dejaba de importar porque `permiteEfectivo`/`permiteEntregaEfectivo` lo sobreescribían igual al guardar.
- **Rationale**: Cambiar el comportamiento de edición de pedidos ya finalizados de forma automática (sin que un administrador lo decida explícitamente) sería una alteración de comportamiento no solicitada y arriesgada para negocios que dependían del bloqueo actual. El spec (Assumptions) y el usuario confirmaron que la activación es manual.
- **Alternatives considered**: Ninguna — la opción de "activar automáticamente edición en etapas Final existentes" fue descartada explícitamente por contradecir el requisito de cero regresión (FR-006, SC-003).

## Resultado

Ambas decisiones habilitan pasar directo a Fase 1 (`data-model.md`, `quickstart.md`) sin research adicional de librerías, patrones externos ni integraciones — el cambio no introduce dependencias nuevas ni toca ninguna integración.
