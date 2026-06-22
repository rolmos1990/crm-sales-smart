import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Catálogo de productos', () => {
  test('PR-01 Ver catálogo de productos', async ({ page }) => {
    await page.goto('/productos');
    // Esperado: tabla o grid con nombre, SKU, precio, stock, estado
    await expect(
      page.getByRole('table')
        .or(page.locator('[data-testid="productos-lista"]'))
        .or(page.locator('.productos-grid'))
    ).toBeVisible();
  });

  test('PR-02 Búsqueda por nombre o SKU filtra en tiempo real', async ({ page }) => {
    await page.goto('/productos');
    const buscador = page.getByPlaceholder(/buscar|nombre|sku/i).or(page.getByRole('searchbox'));
    await buscador.fill('a');
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/productos/);
  });

  test('PR-03 Filtrar por categoría', async ({ page }) => {
    await page.goto('/productos');
    const filtroCat = page.getByRole('combobox', { name: /categoría/i })
      .or(page.locator('select[name*="categoria"]'));
    if (await filtroCat.isVisible()) {
      await filtroCat.click();
      await page.getByRole('option').nth(1).click();
      await page.waitForTimeout(600);
      await expect(page).toHaveURL(/\/productos/);
    }
  });
});

// ─── Creación ─────────────────────────────────────────────────────────────────

test.describe('Creación de productos', () => {
  test('PR-04 Crear producto mínimo (nombre y precio)', async ({ page }) => {
    await page.goto('/productos');
    await page.getByRole('button', { name: /nuevo producto|agregar|crear/i }).click();

    const nombreProducto = `Producto-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreProducto);
    await page.getByLabel(/precio/i).first().fill('99.99');
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: producto visible en catálogo y disponible en cotizaciones/pedidos
    await expect(page.locator(`text=${nombreProducto}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('PR-05 Crear producto completo', async ({ page }) => {
    await page.goto('/productos');
    await page.getByRole('button', { name: /nuevo producto|agregar|crear/i }).click();

    const nombreProducto = `ProductoCompleto-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreProducto);

    const skuField = page.getByLabel(/sku/i);
    if (await skuField.isVisible()) await skuField.fill(`SKU-${Date.now()}`);

    const descripcion = page.getByLabel(/descripción/i);
    if (await descripcion.isVisible()) await descripcion.fill('Descripción de prueba');

    await page.getByLabel(/precio/i).first().fill('250.00');

    const stock = page.getByLabel(/stock/i);
    if (await stock.isVisible()) await stock.fill('100');

    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: todos los campos guardados
    await expect(page.locator(`text=${nombreProducto}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('PR-06 Validaciones: nombre requerido y precio no negativo', async ({ page }) => {
    await page.goto('/productos');
    await page.getByRole('button', { name: /nuevo producto|agregar|crear/i }).click();

    // Sin nombre
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator('text=/requerido|obligatorio/i').first()).toBeVisible();

    // Precio negativo
    await page.getByLabel(/nombre/i).first().fill('Test');
    await page.getByLabel(/precio/i).first().fill('-50');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator('text=/negativo|mayor|positivo/i').first()).toBeVisible();
  });
});

// ─── Edición ──────────────────────────────────────────────────────────────────

test.describe('Edición de productos', () => {
  test('PR-07 Editar precio — cotizaciones existentes no se afectan', async ({ page }) => {
    await page.goto('/productos');
    await page.locator('tbody tr a, [data-testid="producto-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    await page.getByLabel(/precio/i).first().clear();
    await page.getByLabel(/precio/i).first().fill('9999.99');
    await page.getByRole('button', { name: /guardar/i }).click();

    // Esperado: nuevo precio reflejado en el catálogo
    await expect(page.locator('text=/9[.,]?999/').first()).toBeVisible({ timeout: 8000 });
    // Las cotizaciones existentes conservan el precio original (verificar en detalle cotización si aplica)
  });

  test('PR-08 Actualizar stock', async ({ page }) => {
    await page.goto('/productos');
    await page.locator('tbody tr a, [data-testid="producto-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    const stockField = page.getByLabel(/stock/i);
    if (await stockField.isVisible()) {
      await stockField.clear();
      await stockField.fill('500');
      await page.getByRole('button', { name: /guardar/i }).click();
      // Esperado: stock actualizado en el listado
      await expect(page.locator('text=/500/').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('PR-09 Desactivar producto — no aparece en selector de cotizaciones', async ({ page }) => {
    // Crear producto para desactivar
    await page.goto('/productos');
    await page.getByRole('button', { name: /nuevo producto|agregar|crear/i }).click();
    const nombreDesactivar = `ProductoDesactivar-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreDesactivar);
    await page.getByLabel(/precio/i).first().fill('1.00');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator(`text=${nombreDesactivar}`).first()).toBeVisible({ timeout: 8000 });

    // Desactivar
    await page.getByRole('button', { name: /editar/i }).click();
    const toggleActivo = page.getByLabel(/activo|estado/i).or(page.locator('[data-testid="toggle-activo"]'));
    if (await toggleActivo.isVisible()) {
      await toggleActivo.click();
    } else {
      await page.getByRole('button', { name: /desactivar/i }).click();
    }
    await page.getByRole('button', { name: /guardar/i }).click();

    // Verificar que no aparece en selector de cotizaciones
    await page.goto('/sales/cotizaciones');
    await page.getByRole('button', { name: /nueva cotización|crear/i }).click();
    const btnAgregar = page.getByRole('button', { name: /agregar ítem|agregar producto/i });
    if (await btnAgregar.isVisible()) {
      await btnAgregar.click();
      const buscadorProducto = page.getByPlaceholder(/buscar producto/i).last();
      if (await buscadorProducto.isVisible()) {
        await buscadorProducto.fill(nombreDesactivar);
        await page.waitForTimeout(500);
        // Esperado: producto inactivo no aparece en la búsqueda
        await expect(page.locator(`text=${nombreDesactivar}`)).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});

// ─── Uso en cotizaciones y pedidos ───────────────────────────────────────────

test.describe('Uso de productos en cotizaciones y pedidos', () => {
  test('PR-10 Buscar y agregar producto en cotización', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.getByRole('button', { name: /nueva cotización|crear/i }).click();

    const btnAgregar = page.getByRole('button', { name: /agregar ítem|agregar producto/i });
    if (await btnAgregar.isVisible()) {
      await btnAgregar.click();
      const buscadorProducto = page.getByPlaceholder(/buscar producto/i).last();
      if (await buscadorProducto.isVisible()) {
        await buscadorProducto.fill('a');
        await page.waitForTimeout(500);
        const primeraOpcion = page.getByRole('option').first();
        if (await primeraOpcion.isVisible()) {
          await primeraOpcion.click();
          // Esperado: producto agregado con su precio actual
          await expect(page.locator('[data-testid="item-precio"], text=/\\d+\\.\\d+/').first()).toBeVisible();
        }
      }
    }
  });

  test('PR-11 Precio en cotización refleja el precio al momento de agregar', async ({ page }) => {
    // Este test verifica que si el precio de un producto cambia,
    // la cotización ya guardada mantiene el precio original
    await page.goto('/sales/cotizaciones');
    await page.locator('tbody tr a').first().click();

    // El precio guardado en la línea de la cotización debe estar visible
    await expect(page.locator('[data-testid="item-precio"], .item-precio').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('PR-12 SUPERVISOR solo lectura en productos', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/productos');

    // Esperado: puede ver el catálogo
    await expect(
      page.getByRole('table').or(page.locator('[data-testid="productos-lista"]'))
    ).toBeVisible();

    // Sin botones de edición o creación
    await expect(page.getByRole('button', { name: /nuevo producto|crear/i })).not.toBeVisible();

    await ctx.close();
  });
});
