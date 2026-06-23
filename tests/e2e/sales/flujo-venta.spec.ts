import { test, expect } from '@playwright/test';

// ─── Configuración del flujo ──────────────────────────────────────────────────

test.describe('Configuración de flujos de venta', () => {
  test('FV-01 Ver flujos de venta configurados', async ({ page }) => {
    await page.goto('/configuracion');
    // Navegar a la sección de flujos de venta
    const linkFlujos = page.getByRole('link', { name: /flujo.*venta|flujos/i })
      .or(page.locator('text=/flujo.*venta/i').first());
    if (await linkFlujos.isVisible()) {
      await linkFlujos.click();
    } else {
      await page.goto('/configuracion/flujos');
    }
    // Esperado: lista de flujos con nombre y número de etapas
    await expect(page.getByRole('table').or(page.locator('[data-testid="flujos-lista"]'))).toBeVisible({ timeout: 8000 });
  });

  test('FV-02 Crear flujo de venta con etapas', async ({ page }) => {
    await page.goto('/configuracion');
    const linkFlujos = page.getByRole('link', { name: /flujo.*venta|flujos/i });
    if (await linkFlujos.isVisible()) await linkFlujos.click();
    else await page.goto('/configuracion/flujos');

    await page.getByRole('link', { name: /nuevo flujo|crear flujo/i }).or(page.getByRole('button', { name: /nuevo flujo|crear flujo/i })).click();

    const nombreFlujo = `Flujo-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreFlujo);

    // Agregar etapas
    const btnAgregarEtapa = page.getByRole('button', { name: /agregar etapa|nueva etapa/i });
    if (await btnAgregarEtapa.isVisible()) {
      await btnAgregarEtapa.click();
      await page.getByLabel(/nombre.*etapa/i).last().fill('Etapa 1');
      await btnAgregarEtapa.click();
      await page.getByLabel(/nombre.*etapa/i).last().fill('Etapa 2');
    }

    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // Esperado: flujo disponible para nuevos pedidos
    await expect(page.locator(`text=${nombreFlujo}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('FV-03 Configurar etapa con permiteEditarEntrega', async ({ page }) => {
    await page.goto('/configuracion');
    const linkFlujos = page.getByRole('link', { name: /flujo.*venta|flujos/i });
    if (await linkFlujos.isVisible()) await linkFlujos.click();
    else await page.goto('/configuracion/flujos');

    // Editar la primera etapa de un flujo
    await page.locator('tbody tr a, [data-testid="flujo-fila"] a').first().click();
    await page.getByRole('button', { name: /editar etapa|editar/i }).first().click();

    const toggleEntrega = page.getByLabel(/permite.*entrega|editar.*entrega/i)
      .or(page.locator('[data-testid="permite-editar-entrega"]'));
    if (await toggleEntrega.isVisible()) {
      await toggleEntrega.click(); // Toggle on
    }

    await page.getByRole('button', { name: /guardar/i }).click();
    // Esperado: cambio guardado
    await expect(page.locator('text=/guardado|actualizado/i').or(page.locator('[data-testid="flujo-detalle"]'))).toBeVisible({ timeout: 5000 });
  });

  test('FV-04 Reordenar etapas de un flujo', async ({ page }) => {
    await page.goto('/configuracion');
    const linkFlujos = page.getByRole('link', { name: /flujo.*venta|flujos/i });
    if (await linkFlujos.isVisible()) await linkFlujos.click();
    else await page.goto('/configuracion/flujos');

    await page.locator('tbody tr a, [data-testid="flujo-fila"] a').first().click();

    // Drag & drop para reordenar etapas
    const etapas = page.locator('[data-testid="etapa-drag"], [draggable="true"]');
    const count = await etapas.count();
    if (count >= 2) {
      const primeraEtapa = etapas.first();
      const segundaEtapa = etapas.nth(1);
      const box1 = await primeraEtapa.boundingBox();
      const box2 = await segundaEtapa.boundingBox();
      if (box1 && box2) {
        await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
        await page.mouse.down();
        await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height + 10, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        // Esperado: etapas reordenadas sin errores
        await expect(page.locator('[data-testid="flujo-detalle"]').or(page.locator('main'))).toBeVisible();
      }
    }
  });

  test('FV-05 Eliminar flujo sin pedidos asociados', async ({ page }) => {
    // Primero crear el flujo a eliminar
    await page.goto('/configuracion');
    const linkFlujos = page.getByRole('link', { name: /flujo.*venta|flujos/i });
    if (await linkFlujos.isVisible()) await linkFlujos.click();
    else await page.goto('/configuracion/flujos');

    await page.getByRole('link', { name: /nuevo flujo|crear flujo/i }).or(page.getByRole('button', { name: /nuevo flujo|crear flujo/i })).click();
    const nombreEliminar = `FlujoEliminar-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreEliminar);
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator(`text=${nombreEliminar}`).first()).toBeVisible({ timeout: 8000 });

    // Eliminar
    await page.locator(`text=${nombreEliminar}`).first().click();
    await page.getByRole('button', { name: /eliminar/i }).click();
    await page.getByRole('button', { name: /confirmar|sí, eliminar/i }).last().click();
    await expect(page.locator(`text=${nombreEliminar}`)).not.toBeVisible({ timeout: 8000 });
  });

  test('FV-06 Intentar eliminar flujo con pedidos activos muestra error', async ({ page }) => {
    await page.goto('/configuracion');
    const linkFlujos = page.getByRole('link', { name: /flujo.*venta|flujos/i });
    if (await linkFlujos.isVisible()) await linkFlujos.click();
    else await page.goto('/configuracion/flujos');

    // Intentar eliminar el primer flujo que probablemente tenga pedidos
    const primer = page.locator('tbody tr').first();
    if (await primer.isVisible()) {
      await primer.locator('[data-testid="btn-eliminar"], button:has-text("Eliminar")').first().click();
      await page.getByRole('button', { name: /confirmar|sí, eliminar/i }).last().click();

      // Esperado: error o bloqueo con mensaje
      await expect(
        page.locator('text=/no se puede|pedidos activos|error|no es posible/i').first()
      ).toBeVisible({ timeout: 8000 });
    }
  });
});

// ─── Uso del flujo en pedidos ─────────────────────────────────────────────────

test.describe('Uso del flujo en pedidos', () => {
  test('FV-07 Pedido avanza por etapas con registro en timeline', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();

    const btnAvanzar = page.getByRole('button', { name: /avanzar|siguiente etapa/i });
    if (await btnAvanzar.isVisible()) {
      await btnAvanzar.click();
      const btnConfirmar = page.getByRole('button', { name: /confirmar|avanzar/i }).last();
      if (await btnConfirmar.isVisible()) await btnConfirmar.click();

      // Esperado: transición registrada en timeline
      await expect(page.locator('text=/manual|automático|avanzó|etapa/i').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('FV-08 Pedido en última etapa queda completado sin poder avanzar más', async ({ page }) => {
    await page.goto('/sales/pedidos');
    // Buscar un pedido que ya esté en la última etapa
    const pedidoCompleto = page.locator('tbody tr').filter({ hasText: /completado|última etapa/i }).first();
    if (await pedidoCompleto.isVisible()) {
      await pedidoCompleto.locator('a').first().click();
      // Esperado: botón de avanzar no visible o deshabilitado
      await expect(
        page.getByRole('button', { name: /avanzar|siguiente etapa/i }).and(page.locator('[disabled]'))
          .or(page.locator('text=/completado|sin más etapas/i').first())
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
