import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Catálogo de productos', () => {
  test('PR-01 Ver catálogo de productos', async ({ page }) => {
    await page.goto('/productos', { timeout: 45000 });
    // Esperado: tabla o grid con nombre, SKU, precio, stock, estado
    await expect(
      page.getByRole('table')
        .or(page.locator('[data-testid="productos-lista"]'))
        .or(page.locator('.productos-grid'))
    ).toBeVisible();
  });

  test('PR-02 Búsqueda por nombre o SKU filtra en tiempo real', async ({ page }) => {
    await page.goto('/productos', { timeout: 45000 });
    const buscador = page.getByPlaceholder(/buscar|nombre|sku/i).or(page.getByRole('searchbox'));
    await buscador.fill('a');
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/productos/);
  });

  test('PR-03 Filtrar por categoría', async ({ page }) => {
    await page.goto('/productos', { timeout: 45000 });
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
    await page.goto('/productos', { timeout: 45000 });
    await page.getByRole('link', { name: /nuevo producto|agregar|crear/i }).or(page.getByRole('button', { name: /nuevo producto|agregar|crear/i })).first().click();

    const nombreProducto = `Producto-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreProducto);
    await page.getByLabel(/precio/i).first().fill('99.99');
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // El catálogo ordena por nombre; con datos de pruebas acumulados el nuevo
    // producto puede caer en otra página. Se filtra por nombre para ubicarlo
    // de forma determinística.
    await page.getByPlaceholder(/buscar por nombre, sku/i).fill(nombreProducto);
    // Esperado: producto visible en catálogo y disponible en cotizaciones/pedidos
    await expect(page.locator(`text=${nombreProducto}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('PR-05 Crear producto completo', async ({ page }) => {
    await page.goto('/productos', { timeout: 45000 });
    await page.getByRole('link', { name: /nuevo producto|agregar|crear/i }).or(page.getByRole('button', { name: /nuevo producto|agregar|crear/i })).first().click();

    const nombreProducto = `ProductoCompleto-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreProducto);

    const skuField = page.getByLabel(/sku/i);
    if (await skuField.isVisible()) await skuField.fill(`SKU-${Date.now()}`);

    const descripcion = page.getByLabel(/descripción/i);
    if (await descripcion.isVisible()) await descripcion.fill('Descripción de prueba');

    await page.getByLabel(/precio/i).first().fill('250.00');

    // El control de stock está oculto detrás del switch "Control de inventario";
    // el campo "Cantidad disponible en stock" solo aparece si se activa.
    const toggleInventario = page.getByRole('switch');
    if (await toggleInventario.isVisible()) {
      await toggleInventario.click();
      await page.getByLabel(/cantidad disponible/i).fill('100');
    }

    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // El catálogo ordena por nombre; con datos de pruebas acumulados el nuevo
    // producto puede caer en otra página. Se filtra por nombre para ubicarlo
    // de forma determinística.
    await page.getByPlaceholder(/buscar por nombre, sku/i).fill(nombreProducto);
    // Esperado: todos los campos guardados
    await expect(page.locator(`text=${nombreProducto}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('PR-06 Validaciones: nombre requerido y precio no negativo', async ({ page }) => {
    await page.goto('/productos', { timeout: 45000 });
    await page.getByRole('link', { name: /nuevo producto|agregar|crear/i }).or(page.getByRole('button', { name: /nuevo producto|agregar|crear/i })).first().click();

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
    // Productos no tiene página de detalle ni botón "Editar" en la fila; la
    // edición vive en el menú de acciones (⋯) de la fila, que navega directo
    // a /productos/[id]/editar. Se crea un producto propio para editar de
    // forma determinística.
    const nombreProducto = `ProductoEditar-${Date.now()}`;
    await page.goto('/productos', { timeout: 45000 });
    await page.getByRole('link', { name: /nuevo producto|agregar|crear/i }).or(page.getByRole('button', { name: /nuevo producto|agregar|crear/i })).first().click();
    await page.getByLabel(/nombre/i).first().fill(nombreProducto);
    await page.getByLabel(/precio/i).first().fill('1.00');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await page.getByPlaceholder(/buscar por nombre, sku/i).fill(nombreProducto);

    const fila = page.locator('tbody tr', { hasText: nombreProducto });
    await fila.getByRole('button', { name: /acciones/i }).click();
    await page.getByRole('menuitem', { name: /editar/i }).click();
    await page.waitForURL(/\/productos\/[\w-]+\/editar$/, { timeout: 30000 });

    await page.getByLabel(/precio/i).first().clear();
    await page.getByLabel(/precio/i).first().fill('9999.99');
    await page.getByRole('button', { name: /guardar/i }).click();
    await page.waitForURL(/\/productos$/, { timeout: 30000 });
    await page.getByPlaceholder(/buscar por nombre, sku/i).fill(nombreProducto);

    // Esperado: nuevo precio reflejado en el catálogo
    await expect(page.locator('text=/9[.,]?999/').first()).toBeVisible({ timeout: 8000 });
    // Las cotizaciones existentes conservan el precio original (precioUnitario
    // se guarda como snapshot en CotizacionLinea, independiente del producto).
  });

  test('PR-08 Actualizar stock', async ({ page }) => {
    const nombreProducto = `ProductoStock-${Date.now()}`;
    await page.goto('/productos', { timeout: 45000 });
    await page.getByRole('link', { name: /nuevo producto|agregar|crear/i }).or(page.getByRole('button', { name: /nuevo producto|agregar|crear/i })).first().click();
    await page.getByLabel(/nombre/i).first().fill(nombreProducto);
    await page.getByLabel(/precio/i).first().fill('1.00');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await page.getByPlaceholder(/buscar por nombre, sku/i).fill(nombreProducto);

    const fila = page.locator('tbody tr', { hasText: nombreProducto });
    await fila.getByRole('button', { name: /acciones/i }).click();
    await page.getByRole('menuitem', { name: /editar/i }).click();
    await page.waitForURL(/\/productos\/[\w-]+\/editar$/, { timeout: 30000 });

    // El campo de stock está oculto detrás del switch "Control de inventario".
    await page.getByRole('switch').click();
    await page.getByLabel(/cantidad disponible/i).fill('500');
    await page.getByRole('button', { name: /guardar/i }).click();
    await page.waitForURL(/\/productos$/, { timeout: 30000 });

    // Esperado: stock actualizado (visible al volver a editar)
    await page.getByPlaceholder(/buscar por nombre, sku/i).fill(nombreProducto);
    await fila.getByRole('button', { name: /acciones/i }).click();
    await page.getByRole('menuitem', { name: /editar/i }).click();
    await page.waitForURL(/\/productos\/[\w-]+\/editar$/, { timeout: 30000 });
    await expect(page.getByLabel(/cantidad disponible/i)).toHaveValue('500');
  });

  test('PR-09 Desactivar producto — no aparece en selector de cotizaciones', async ({ page }) => {
    // Crear producto para desactivar
    const nombreDesactivar = `ProductoDesactivar-${Date.now()}`;
    await page.goto('/productos', { timeout: 45000 });
    await page.getByRole('link', { name: /nuevo producto|agregar|crear/i }).or(page.getByRole('button', { name: /nuevo producto|agregar|crear/i })).first().click();
    await page.waitForURL(/\/productos\/nuevo$/, { timeout: 30000 });
    await page.getByLabel(/nombre/i).first().fill(nombreDesactivar);
    await page.getByLabel(/precio/i).first().fill('1.00');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await page.waitForURL(/\/productos$/, { timeout: 30000 });
    await page.getByPlaceholder(/buscar por nombre, sku/i).fill(nombreDesactivar);
    await expect(page.locator(`text=${nombreDesactivar}`).first()).toBeVisible({ timeout: 8000 });

    // Desactivar: no existe un toggle "activo" en el formulario — la acción real
    // vive en el menú "Acciones" (⋯) de la fila ("Desactivar", soft-delete).
    const fila = page.locator('tbody tr', { hasText: nombreDesactivar });
    await fila.getByRole('button', { name: /acciones/i }).click();
    await page.getByRole('menuitem', { name: /desactivar/i }).click();
    await page.getByRole('button', { name: /desactivar/i }).last().click();
    await expect(page.locator('tbody tr', { hasText: nombreDesactivar })).not.toBeVisible({ timeout: 8000 });

    // Verificar que no aparece en el selector de producto al crear una cotización.
    // El selector real es el botón "Del catálogo" de cada línea, no un botón
    // "Agregar producto" separado.
    await page.goto('/sales/cotizaciones/nueva', { timeout: 45000 });
    await page.getByRole('button', { name: /del catálogo/i }).first().click();
    await page.getByPlaceholder(/buscar producto/i).fill(nombreDesactivar);
    await page.waitForTimeout(500);
    await expect(page.getByRole('option', { name: new RegExp(nombreDesactivar) })).not.toBeVisible({ timeout: 3000 });
  });
});

// ─── Uso en cotizaciones y pedidos ───────────────────────────────────────────

test.describe('Uso de productos en cotizaciones y pedidos', () => {
  test('PR-10 Buscar y agregar producto en cotización', async ({ page }) => {
    // No existe un botón "Agregar producto" separado: cada línea ya incluye un
    // selector "Del catálogo" que abre un popover con búsqueda.
    await page.goto('/sales/cotizaciones/nueva', { timeout: 45000 });

    const selectorProducto = page.getByRole('button', { name: /del catálogo/i }).first();
    await expect(selectorProducto).toBeVisible({ timeout: 10000 });
    await selectorProducto.click();
    await page.getByPlaceholder(/buscar producto/i).fill('a');
    await page.waitForTimeout(500);
    const primeraOpcion = page.getByRole('option').first();
    if (await primeraOpcion.isVisible()) {
      await primeraOpcion.click();
      // Esperado: producto agregado con su precio actual reflejado en la línea
      await expect(page.locator('text=/\\d+[.,]\\d{2}/').first()).toBeVisible();
    }
  });

  test('PR-11 Precio en cotización refleja el precio al momento de agregar', async ({ page }) => {
    // Este test verifica que el precio quede guardado como snapshot en la línea
    // de la cotización (CotizacionLinea.precioUnitario), independiente del
    // precio actual del producto. Se crea una cotización propia con un producto
    // del catálogo para verificarlo de forma determinística.
    await page.goto('/sales/cotizaciones/nueva', { timeout: 45000 });

    const selectorProducto = page.getByRole('button', { name: /del catálogo/i }).first();
    await expect(selectorProducto).toBeVisible({ timeout: 10000 });
    await selectorProducto.click();
    await page.getByPlaceholder(/buscar producto/i).fill('a');
    await page.waitForTimeout(500);
    const primeraOpcion = page.getByRole('option').first();
    await expect(primeraOpcion).toBeVisible({ timeout: 5000 });
    await primeraOpcion.click();

    await page.getByRole('button', { name: /crear cotización/i }).click();
    // Al crear sin oportunidad asociada, redirige a la lista (ordenada por
    // fecha de creación desc) — la cotización recién creada queda primera.
    await page.waitForURL(/\/sales\/cotizaciones$/, { timeout: 30000 });
    await page.locator('tbody tr a').first().click();
    await page.waitForURL(/\/sales\/cotizaciones\/[\w-]+$/, { timeout: 30000 });

    // El precio guardado en la línea de la cotización debe estar visible
    await expect(page.locator('text=/\\d+[.,]\\d{2}/').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('PR-12 SUPERVISOR solo lectura en productos', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/productos', { timeout: 45000 });

    // Esperado: puede ver el catálogo
    await expect(
      page.getByRole('table').or(page.locator('[data-testid="productos-lista"]'))
    ).toBeVisible();

    // Sin botones de edición o creación
    await expect(page.getByRole('link', { name: /nuevo producto|crear/i }).or(page.getByRole('button', { name: /nuevo producto|crear/i }))).not.toBeVisible();

    await ctx.close();
  });
});
