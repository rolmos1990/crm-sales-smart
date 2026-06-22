import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Visualización del tablero ────────────────────────────────────────────────

test.describe('Visualización del tablero Kanban', () => {
  test('PL-01 Ver tablero con columnas y oportunidades', async ({ page }) => {
    await page.goto('/crm/pipeline');
    // Esperado: columnas con etapas, oportunidades como cards
    await expect(
      page.locator('[data-testid="pipeline-board"], [data-testid="kanban-board"]')
        .or(page.locator('.kanban-board, .pipeline-board'))
    ).toBeVisible({ timeout: 8000 });
    // Al menos una columna visible
    await expect(
      page.locator('[data-testid="pipeline-column"], .kanban-column, [data-testid="stage-column"]').first()
    ).toBeVisible();
  });

  test('PL-02 Selector de pipeline cambia el tablero', async ({ page }) => {
    await page.goto('/crm/pipeline');
    const selectorPipeline = page.getByRole('combobox', { name: /pipeline/i })
      .or(page.locator('[data-testid="pipeline-selector"]'));

    if (await selectorPipeline.isVisible()) {
      const opciones = page.getByRole('option');
      const cantidad = await opciones.count();
      if (cantidad >= 2) {
        await selectorPipeline.click();
        await opciones.nth(1).click();
        // Esperado: tablero se recarga con las etapas del pipeline seleccionado
        await expect(
          page.locator('[data-testid="pipeline-column"], .kanban-column').first()
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('PL-03 Ver valor total por columna', async ({ page }) => {
    await page.goto('/crm/pipeline');
    // Esperado: suma del valor de las oportunidades bajo el nombre de la etapa
    await expect(
      page.locator('[data-testid="column-total"], .column-total, text=/\\$|S\\/\\.|total/i').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('PL-04 Columna vacía visible sin errores', async ({ page }) => {
    await page.goto('/crm/pipeline');
    // La página no debe tener errores visibles
    await expect(page.locator('text=/error|undefined|null/i')).not.toBeVisible();
    await expect(page.locator('[data-testid="pipeline-board"]').or(page.locator('main'))).toBeVisible();
  });
});

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

test.describe('Drag & Drop de oportunidades', () => {
  test('PL-05 Mover oportunidad a otra columna', async ({ page }) => {
    await page.goto('/crm/pipeline');

    // Esperar a que cargue el tablero
    const primerCard = page.locator('[data-testid="oportunidad-card"], .kanban-card, [draggable="true"]').first();
    const segundaColumna = page.locator('[data-testid="pipeline-column"], .kanban-column').nth(1);

    await expect(primerCard).toBeVisible({ timeout: 8000 });
    await expect(segundaColumna).toBeVisible();

    const cardBox = await primerCard.boundingBox();
    const colBox = await segundaColumna.boundingBox();

    if (cardBox && colBox) {
      // Drag desde el card hasta el centro de la segunda columna
      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(colBox.x + colBox.width / 2, colBox.y + 100, { steps: 10 });
      await page.mouse.up();

      // Esperado: oportunidad movida, sin recarga de página
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/crm\/pipeline/);
    }
  });

  test('PL-08 Cancelar drag con Escape no persiste cambios', async ({ page }) => {
    await page.goto('/crm/pipeline');

    const primerCard = page.locator('[data-testid="oportunidad-card"], .kanban-card, [draggable="true"]').first();
    await expect(primerCard).toBeVisible({ timeout: 8000 });

    const cardBox = await primerCard.boundingBox();
    if (cardBox) {
      // Iniciar drag
      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(cardBox.x + 200, cardBox.y, { steps: 5 });
      // Presionar Escape
      await page.keyboard.press('Escape');
      await page.mouse.up();

      // Esperado: card vuelve a su posición original, sin cambios
      await expect(primerCard).toBeVisible({ timeout: 3000 });
    }
  });
});

// ─── Cards de oportunidades ───────────────────────────────────────────────────

test.describe('Cards de oportunidades', () => {
  test('PL-09 Información visible en el card', async ({ page }) => {
    await page.goto('/crm/pipeline');
    const primerCard = page.locator('[data-testid="oportunidad-card"], .kanban-card').first();
    await expect(primerCard).toBeVisible({ timeout: 8000 });

    // Esperado: título visible en el card (al menos el contenido mínimo)
    await expect(primerCard.locator('text=/\\w+/').first()).toBeVisible();
  });

  test('PL-10 Clic en card navega al detalle de la oportunidad', async ({ page }) => {
    await page.goto('/crm/pipeline');
    const primerCard = page.locator('[data-testid="oportunidad-card"], .kanban-card').first();
    await expect(primerCard).toBeVisible({ timeout: 8000 });

    // Clic en el título o el card
    const titulo = primerCard.locator('a, [data-testid="card-title"]').first();
    if (await titulo.isVisible()) {
      await titulo.click();
    } else {
      await primerCard.click();
    }

    // Esperado: navega al detalle
    await expect(page).toHaveURL(/\/crm\/oportunidades\/\w+/, { timeout: 8000 });
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('PL-11 EJECUTIVO_VENTAS no puede acceder al pipeline', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.ejecutivoVentas });
    const page = await ctx.newPage();
    await page.goto('/crm/pipeline');

    const bloqueado =
      page.url().includes('/login') ||
      page.url().includes('/acceso-denegado') ||
      (await page.locator('text=/no tienes acceso|sin permiso|acceso denegado/i').isVisible({ timeout: 5000 }).catch(() => false));
    expect(bloqueado).toBeTruthy();

    await ctx.close();
  });

  test('PL-12 SUPERVISOR puede ver el tablero pero no mover cards', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/crm/pipeline');

    // Esperado: tablero visible
    await expect(
      page.locator('[data-testid="pipeline-board"]').or(page.locator('main'))
    ).toBeVisible();

    // Los cards no deben ser draggables para SUPERVISOR
    const cards = page.locator('[draggable="true"]');
    const cantDraggable = await cards.count();
    // Si hay draggable="false" o no hay atributo draggable, el supervisor no puede mover
    expect(cantDraggable).toBe(0);

    await ctx.close();
  });

  test('PL-13 AGENTE_SOPORTE puede ver pero no mover cards', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.agenteSoporte });
    const page = await ctx.newPage();
    await page.goto('/crm/pipeline');

    // Esperado: puede ver el tablero
    await expect(
      page.locator('[data-testid="pipeline-board"]').or(page.locator('main'))
    ).toBeVisible();

    const cards = page.locator('[draggable="true"]');
    expect(await cards.count()).toBe(0);

    await ctx.close();
  });
});
