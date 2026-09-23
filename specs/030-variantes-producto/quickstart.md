# Quickstart: validating 030-variantes-producto

## Setup

```bash
npx prisma migrate deploy      # never `migrate dev` against the shared database
npx vitest run src/shared/productos src/sales src/ai
```

## Manual end to end

1. **Existing product:** "Base Luminaria" (SKU BASE-001, $15, stock control on, 10).
2. **Turn on "Este producto tiene variantes":**
   - attribute "Color de luz" with Amarilla and Multicolor;
   - the table shows 2 rows plus "Stock actual por distribuir: 10";
   - try 5/4 → saving is blocked ("asignado 9");
   - enter 6/4 → it saves;
   - the product total shows 10.
3. **Add the "Tamaño" attribute** (Pequeña, Grande): 4 combinations appear. The Amarilla/Multicolor combinations without a size no longer exist, so they are deactivated if they were sold, or deleted if they weren't.
4. **New order → Agregar línea → Del catálogo → Base Luminaria:**
   - the picker asks for the variant, showing its availability;
   - choose Amarilla and save 2 → Amarilla goes down by 2, Multicolor doesn't change;
   - the order detail shows "Variante: Amarilla".
5. **Rename and deactivate the variant:** the old order still says "Amarilla", and the picker no longer offers it.
6. **Quote with a variant → approve:** the order keeps the variant and deducts its stock.
7. **Unrelated product:** creating and editing orders works exactly as before.
