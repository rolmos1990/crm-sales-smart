# Quickstart: Transportistas por país

Guía de validación manual/E2E del feature completo. Requiere el catálogo geográfico ya sembrado (`npm run db:seed:geografia`, spec 019) y al menos un transportista de datos de prueba.

## Prerrequisitos

```bash
npm run db:migrate            # aplica la migración de Transportista.paisId
npx tsx scripts/backfill-pais-transportista.ts   # backfill de transportistas existentes
npm run dev
```

## Escenario 1 — Crear dos transportistas del mismo courier en países distintos

1. Ir a `/sales/transportistas` → "Nuevo transportista".
2. Completar Nombre: "UnoExpress", Tipo: "Courier externo", País: "🇵🇦 Panamá". Guardar.
3. Repetir: Nombre: "UnoExpress", Tipo: "Courier externo", País: "🇨🇴 Colombia". Guardar.
4. **Esperado**: la lista de transportistas muestra dos filas "UnoExpress", cada una con su propia bandera/país; abrir cada una confirma que tienen zonas/tarifas/condiciones completamente independientes (ver [data-model.md](data-model.md), [contracts/server-actions.md](contracts/server-actions.md) FR-002).

## Escenario 2 — Agregar una zona con el catálogo real de provincias

1. Entrar al transportista "UnoExpress" (Panamá) → pestaña "Zonas y tarifas" → "Agregar zona".
2. **Esperado**: el campo País aparece pre-completado con "🇵🇦 Panamá" y deshabilitado (no se puede tocar).
3. Completar Provincia/Estado: abrir el combobox y confirmar que solo aparecen provincias reales de Panamá (Panamá, Colón, Chiriquí, Veraguas, Coclé, …) — no se puede escribir un valor libre.
4. Guardar la zona y confirmar que la tabla de "Zonas y tarifas" muestra la provincia elegida en su propia columna (FR-005, FR-007).

## Escenario 3 — El país queda bloqueado apenas hay una tarifa

1. Sobre el transportista del Escenario 2, agregar una tarifa para la zona recién creada.
2. Volver a la pestaña "Información".
3. **Esperado**: el campo País aparece deshabilitado con un candado y el texto explicando por qué (FR-010, research.md Decisión 3).
4. Intentar forzar el cambio llamando directamente a `editarTransportista` con un `paisId` distinto (test de integración, no UI) → **Esperado**: `{ exito: false, error: "..." }`, el `paisId` en base de datos no cambia.

## Escenario 4 — Backfill de un transportista existente

1. Antes de correr el backfill, crear (por script/seed de prueba) un transportista sin `paisId`, con una tarifa sobre una zona cuya única ubicación es de Panamá.
2. Correr `npx tsx scripts/backfill-pais-transportista.ts`.
3. **Esperado**: el log muestra ese transportista asignado automáticamente a Panamá; `SELECT paisId FROM "Transportista" WHERE id = ...` confirma el valor.
4. Crear un segundo transportista sin `paisId`, con tarifas sobre dos zonas de países distintos (Panamá y Colombia).
5. Correr el backfill de nuevo.
6. **Esperado**: este segundo transportista queda con `paisId = NULL`; en la UI, su fila en la lista y su encabezado muestran el badge "País pendiente"; el botón "Agregar zona" de su pestaña "Zonas y tarifas" aparece deshabilitado con un tooltip explicando que falta completar el país (FR-008, FR-009).

## Escenario 5 — Completar el país pendiente no rompe nada

1. Sobre el transportista del punto 4-6 del Escenario 4, ir a "Información" y asignarle un país manualmente.
2. **Esperado**: el badge "País pendiente" desaparece de la lista y del encabezado; "Agregar zona"/"Agregar tarifa" quedan habilitados; las cotizaciones/pedidos que ya usaron ese transportista antes de completar el país siguen mostrando su información histórica sin cambios (FR-009).

## Referencias

- Requisitos funcionales: [spec.md](spec.md)
- Decisiones técnicas: [research.md](research.md)
- Contratos de Server Actions/queries: [contracts/server-actions.md](contracts/server-actions.md)
