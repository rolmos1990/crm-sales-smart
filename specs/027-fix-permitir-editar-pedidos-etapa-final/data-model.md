# Data Model: Permitir configurar edición de pedidos en etapas Final/Cancelación

Sin entidades nuevas ni cambios de schema Prisma. Este Hotfix reutiliza campos que ya existen en `FlujoVentaEtapa` (`prisma/schema.prisma`):

- `permiteEditarPedido: Boolean` — ya existe, ya se persiste, ya se lee en el enforcement de servidor. Este cambio deja de forzarlo a `false` en la UI de configuración para etapas `esFinal`/`esCancelacion`.
- `permiteEditarEntrega: Boolean` — mismo caso, para el control de edición de datos de entrega/tracking.

No se requiere migración (`prisma migrate`). No se agregan campos, tablas, ni relaciones. `EtapaSchema` (Zod, `src/sales/flujo-venta/schema.ts`) ya acepta ambos campos como `z.boolean().optional()` — no necesita cambios.
