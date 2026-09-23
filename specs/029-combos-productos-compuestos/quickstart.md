# Quickstart: validating 029-combos-productos-compuestos

## Prerequisites

- Apply the migration with `npx prisma migrate deploy`. Do not use `migrate dev` against the shared database.
- `npm run dev` running.

## 1. Unit tests

```bash
npx vitest run src/shared/productos src/sales src/ai/tools/providers/consultar-disponibilidad.test.ts
```

Expected: all new cases pass. The 4 pre-existing failures in `crear-cotizacion`/`modo-simulacion` are not related to this feature.

## 2. Manual end-to-end

1. **Productos → Nuevo:** create "Base Luminaria Grande" ($15, stock control on, 15, **Disponible para venta directa: NO**) and "Esfera Luna Grande" ($10, stock 10, venta directa NO).
2. **Productos → Nuevo:** create "Luminaria Luna Grande", $26.
   - Turn on "Este producto es un combo" and add Base × 1 and Esfera × 1.
   - Check that it shows "Valor de los componentes: $25.00".
   - Save.
3. **Pedidos → Nuevo → Agregar línea → Del catálogo:**
   - "Combos" tab: Luminaria Luna Grande, COMBO badge, "10 disponibles".
   - "Productos" tab: Base and Esfera do not appear.
4. Add 2 combos and save.
   - The order shows 1 line (2 × $26 = $52).
   - In Productos: Base 13, Esfera 8.
5. Edit the order to 1 combo → Base 14, Esfera 9. Remove the line → Base 15, Esfera 10.
6. Change the combo to Base × 2. An old order created with the previous composition returns 1 Base per combo when edited (snapshot).
7. **Configuración → Preferencias:** "Productos mostrados al crear pedidos" = Solo combos. The picker opens on "Combos", and you can still switch to "Todos".
8. **Cotización** with 2 combos → approve → the generated order has the combo line, and the components go down by 2.

## 3. Build

```bash
npx tsc --noEmit -p .   # no new errors in the files touched
npx next build
```
