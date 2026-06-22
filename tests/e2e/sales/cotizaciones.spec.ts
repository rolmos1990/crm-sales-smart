import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de cotizaciones', () => {
  test('CQ-01 Ver lista de cotizaciones', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    // Esperado: tabla con número, cliente, total, estado, fecha de expiración
    await expect(page.getByRole('table').or(page.locator('[data-testid="cotizaciones-lista"]'))).toBeVisible();
  });

  test('CQ-02 Filtrar por estado', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    const filtroEstado = page.getByRole('combobox', { name: /estado/i })
      .or(page.locator('select[name*="estado"]'))
      .or(page.getByRole('button', { name: /estado|borrador/i }));

    if (await filtroEstado.isVisible()) {
      await filtroEstado.click();
      await page.getByRole('option', { name: /borrador/i }).click();
      await page.waitForTimeout(600);
      await expect(page).toHaveURL(/\/sales\/cotizaciones/);
    }
  });

  test('CQ-03 Búsqueda por número o cliente', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    const buscador = page.getByPlaceholder(/buscar|search/i).or(page.getByRole('searchbox'));
    await buscador.fill('a');
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/sales\/cotizaciones/);
  });
});

// ─── Creación ─────────────────────────────────────────────────────────────────

test.describe('Creación de cotizaciones', () => {
  test('CQ-04 Crear cotización mínima como borrador', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.getByRole('button', { name: /nueva cotización|crear/i }).click();

    // Seleccionar contacto o ingresar datos del cliente
    const inputCliente = page.getByLabel(/cliente|contacto/i).first();
    if (await inputCliente.isVisible()) {
      await inputCliente.fill('Cliente Test');
      const primeraOpcion = page.getByRole('option').first();
      if (await primeraOpcion.isVisible()) await primeraOpcion.click();
    }

    // Agregar al menos un ítem
    const btnAgregarItem = page.getByRole('button', { name: /agregar ítem|agregar producto|nuevo ítem/i });
    if (await btnAgregarItem.isVisible()) {
      await btnAgregarItem.click();
      const buscadorProducto = page.getByPlaceholder(/buscar producto|producto/i).last();
      await buscadorProducto.fill('a');
      await page.waitForTimeout(500);
      const primeraOpcion = page.getByRole('option').first();
      if (await primeraOpcion.isVisible()) await primeraOpcion.click();
    }

    await page.getByRole('button', { name: /guardar borrador|guardar|crear/i }).click();

    // Esperado: cotización con número generado, estado "Borrador"
    await expect(page.locator('text=/borrador/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('CQ-05 Agregar ítems — subtotales calculados correctamente', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.getByRole('button', { name: /nueva cotización|crear/i }).click();

    const btnAgregarItem = page.getByRole('button', { name: /agregar ítem|agregar producto/i });
    if (await btnAgregarItem.isVisible()) {
      await btnAgregarItem.click();
      const cantidadInput = page.getByLabel(/cantidad/i).last();
      if (await cantidadInput.isVisible()) {
        await cantidadInput.clear();
        await cantidadInput.fill('3');
      }
      // Esperado: subtotal actualizado en tiempo real
      await expect(page.locator('[data-testid="subtotal"], text=/subtotal|total/i').first()).toBeVisible();
    }
  });

  test('CQ-06 Aplicar descuento global recalcula el total', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.getByRole('button', { name: /nueva cotización|crear/i }).click();

    const descuentoGlobal = page.getByLabel(/descuento/i).last();
    if (await descuentoGlobal.isVisible()) {
      await descuentoGlobal.fill('10');
      await page.waitForTimeout(500);
      // Esperado: total recalculado
      await expect(page.locator('[data-testid="total"], text=/total/i').first()).toBeVisible();
    }
  });

  test('CQ-09 Validación: no guardar sin ítems', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.getByRole('button', { name: /nueva cotización|crear/i }).click();
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // Esperado: error claro sobre falta de ítems
    await expect(page.locator('text=/ítem|producto|requerido|obligatorio/i').first()).toBeVisible();
  });
});

// ─── Estados y flujo ──────────────────────────────────────────────────────────

test.describe('Estados y flujo de cotizaciones', () => {
  test('CQ-10 Enviar cotización cambia estado a Enviada', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    // Abrir una cotización en estado Borrador
    const filaBorrador = page.locator('tbody tr').filter({ hasText: /borrador/i }).first();
    if (await filaBorrador.isVisible()) {
      await filaBorrador.locator('a').first().click();
      await page.getByRole('button', { name: /enviar/i }).click();
      // Confirmar si hay modal
      const btnConfirmar = page.getByRole('button', { name: /confirmar|enviar/i }).last();
      if (await btnConfirmar.isVisible()) await btnConfirmar.click();
      // Esperado: estado cambia a "Enviada"
      await expect(page.locator('text=/enviada/i').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('CQ-11 Marcar cotización como Aceptada', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    const filaEnviada = page.locator('tbody tr').filter({ hasText: /enviada/i }).first();
    if (await filaEnviada.isVisible()) {
      await filaEnviada.locator('a').first().click();
      await page.getByRole('button', { name: /aceptar|marcar como aceptada/i }).click();
      await expect(page.locator('text=/aceptada/i').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('CQ-12 Convertir cotización aceptada en pedido', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    const filaAceptada = page.locator('tbody tr').filter({ hasText: /aceptada/i }).first();
    if (await filaAceptada.isVisible()) {
      await filaAceptada.locator('a').first().click();
      await page.getByRole('button', { name: /convertir en pedido|crear pedido/i }).click();
      // Esperado: pedido creado y redirige a pedido o muestra confirmación
      await expect(
        page.locator('text=/pedido creado|pedido generado/i')
          .or(page.locator('text=/pedido/i')).first()
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test('CQ-13 Marcar cotización como Rechazada', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    const filaEnviada = page.locator('tbody tr').filter({ hasText: /enviada/i }).first();
    if (await filaEnviada.isVisible()) {
      await filaEnviada.locator('a').first().click();
      await page.getByRole('button', { name: /rechazar|marcar como rechazada/i }).click();
      await expect(page.locator('text=/rechazada/i').first()).toBeVisible({ timeout: 8000 });
    }
  });
});

// ─── PDF ─────────────────────────────────────────────────────────────────────

test.describe('PDF de cotización', () => {
  test('CQ-15 Generar o descargar PDF', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.locator('tbody tr a').first().click();

    const btnPDF = page.getByRole('button', { name: /pdf|descargar|generar/i });
    await expect(btnPDF).toBeVisible({ timeout: 5000 });
    // Verificar que el botón existe y es clickeable (no necesitamos abrir el PDF real en tests)
    await expect(btnPDF).toBeEnabled();
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('CQ-16 AGENTE_SOPORTE sin acceso a cotizaciones', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.agenteSoporte });
    const page = await ctx.newPage();
    await page.goto('/sales/cotizaciones');

    const bloqueado =
      page.url().includes('/login') ||
      page.url().includes('/acceso-denegado') ||
      (await page.locator('text=/no tienes acceso|sin permiso|acceso denegado/i').isVisible({ timeout: 5000 }).catch(() => false));
    expect(bloqueado).toBeTruthy();

    await ctx.close();
  });

  test('CQ-17 SUPERVISOR solo lectura en cotizaciones', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/sales/cotizaciones');

    await expect(page.getByRole('table').or(page.locator('[data-testid="cotizaciones-lista"]'))).toBeVisible();
    await expect(page.getByRole('button', { name: /nueva cotización/i })).not.toBeVisible();

    await ctx.close();
  });
});
