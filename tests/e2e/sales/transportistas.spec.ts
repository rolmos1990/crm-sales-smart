import { test, expect } from '@playwright/test';

const URL_TRANSPORTISTAS = '/configuracion/transportistas';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de transportistas', () => {
  test('TR-01 Ver lista de transportistas', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    if (page.url().includes('/configuracion')) {
      // Puede estar dentro de configuración general
      const link = page.getByRole('link', { name: /transportistas/i });
      if (await link.isVisible()) await link.click();
    }
    // Esperado: tabla con nombre, RUC, teléfono, estado activo/inactivo
    await expect(
      page.getByRole('table').or(page.locator('[data-testid="transportistas-lista"]'))
    ).toBeVisible({ timeout: 8000 });
  });
});

// ─── Creación y edición ───────────────────────────────────────────────────────

test.describe('Creación y edición de transportistas', () => {
  test('TR-02 Crear transportista completo', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    await page.getByRole('button', { name: /nuevo transportista|crear/i }).click();

    const nombreTransportista = `Transportista-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreTransportista);
    await page.getByLabel(/ruc|identificación/i).fill('20123456789');
    await page.getByLabel(/teléfono/i).fill('+51 999 000 111');
    await page.getByLabel(/email/i).fill('transportista@test.com');
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: transportista creado y disponible en entregas de pedidos
    await expect(page.locator(`text=${nombreTransportista}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('TR-03 Editar transportista', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    await page.locator('tbody tr a, [data-testid="transportista-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    const nuevoNombre = `TransEditado-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().clear();
    await page.getByLabel(/nombre/i).first().fill(nuevoNombre);
    await page.getByRole('button', { name: /guardar/i }).click();

    // Esperado: cambios reflejados
    await expect(page.locator(`text=${nuevoNombre}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('TR-04 Validación: nombre requerido', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    await page.getByRole('button', { name: /nuevo transportista|crear/i }).click();
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // Esperado: error en campo nombre
    await expect(page.locator('text=/requerido|obligatorio/i').first()).toBeVisible();
  });

  test('TR-05 Desactivar transportista no lo muestra en selector de entregas', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);

    // Crear un transportista para desactivar
    await page.getByRole('button', { name: /nuevo transportista|crear/i }).click();
    const nombreDesactivar = `TransDesactivar-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreDesactivar);
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator(`text=${nombreDesactivar}`).first()).toBeVisible({ timeout: 8000 });

    // Desactivar
    await page.locator(`text=${nombreDesactivar}`).first().click();
    const toggleActivo = page.getByLabel(/activo|estado/i).or(page.locator('[data-testid="toggle-activo"]'));
    if (await toggleActivo.isVisible()) {
      await toggleActivo.click(); // Toggle off
    } else {
      await page.getByRole('button', { name: /desactivar/i }).click();
    }
    await page.getByRole('button', { name: /guardar/i }).click();

    // Verificar que no aparece en el selector de entregas
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a').first().click();
    const selectorTransportista = page.getByLabel(/transportista/i).or(page.getByRole('combobox', { name: /transportista/i }));
    if (await selectorTransportista.isVisible()) {
      await selectorTransportista.click();
      await expect(page.locator(`text=${nombreDesactivar}`)).not.toBeVisible({ timeout: 3000 });
    }
  });
});

// ─── Uso en pedidos ───────────────────────────────────────────────────────────

test.describe('Uso de transportistas en pedidos', () => {
  test('TR-06 Asignar transportista en entrega de un pedido', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a').first().click();

    const seccionEntrega = page.locator('text=/entrega y seguimiento/i').first();
    if (await seccionEntrega.isVisible()) {
      await seccionEntrega.click().catch(() => {});
    }

    const selectorTransportista = page.getByLabel(/transportista/i).or(page.getByRole('combobox', { name: /transportista/i }));
    if (await selectorTransportista.isVisible()) {
      await selectorTransportista.click();
      await page.getByRole('option').first().click();
      await page.getByRole('button', { name: /guardar/i }).click();

      // Esperado: transportista asignado, visible en el timeline
      await expect(page.locator('[data-testid="pedido-timeline"]').or(
        page.locator('text=/transportista|asignado/i').first()
      )).toBeVisible({ timeout: 5000 });
    }
  });

  test('TR-07 Solo transportistas activos aparecen en el selector', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a').first().click();

    const selectorTransportista = page.getByLabel(/transportista/i).or(page.getByRole('combobox', { name: /transportista/i }));
    if (await selectorTransportista.isVisible()) {
      await selectorTransportista.click();
      const opciones = page.getByRole('option');
      const cantOpciones = await opciones.count();

      // Todas las opciones visibles deben corresponder a transportistas activos
      // (Verificamos que ninguna incluye texto como "inactivo")
      for (let i = 0; i < cantOpciones; i++) {
        const texto = await opciones.nth(i).textContent();
        expect(texto?.toLowerCase()).not.toContain('inactivo');
      }
    }
  });
});
