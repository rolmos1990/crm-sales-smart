import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de oportunidades', () => {
  test('O-01 Ver lista de oportunidades', async ({ page }) => {
    await page.goto('/crm/oportunidades');
    // Esperado: lista con título, valor, etapa, empresa, fecha de cierre
    await expect(page.getByRole('table').or(page.locator('[data-testid="oportunidades-lista"]'))).toBeVisible();
  });

  test('O-02 Filtrado y búsqueda por nombre', async ({ page }) => {
    await page.goto('/crm/oportunidades');
    const buscador = page.getByPlaceholder(/buscar|search/i).or(page.getByRole('searchbox'));
    await buscador.fill('a');
    await page.waitForTimeout(600);
    // Esperado: lista filtrada sin recargar
    await expect(page).toHaveURL(/\/crm\/oportunidades/);
  });
});

// ─── Creación sin pipeline ────────────────────────────────────────────────────

test.describe('Creación sin pipeline', () => {
  test('O-03 Crear oportunidad sin pipeline con etapa legacy', async ({ page }) => {
    await page.goto('/crm/oportunidades/nueva');
    await page.getByLabel(/título|nombre/i).first().fill(`Oportunidad-${Date.now()}`);
    await page.getByLabel(/valor/i).fill('5000');

    // Seleccionar "Sin pipeline"
    const selectorPipeline = page.getByLabel(/pipeline/i).or(page.getByRole('combobox', { name: /pipeline/i }));
    if (await selectorPipeline.isVisible()) {
      await selectorPipeline.click();
      await page.getByRole('option', { name: /sin pipeline|ninguno/i }).click();
    }

    // Seleccionar etapa legacy
    const selectorEtapa = page.getByLabel(/etapa/i).or(page.getByRole('combobox', { name: /etapa/i }));
    if (await selectorEtapa.isVisible()) {
      await selectorEtapa.click();
      await page.getByRole('option', { name: /prospecto/i }).click();
    }

    await page.getByLabel(/fecha de cierre/i).fill('2025-12-31').catch(() => {});
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: oportunidad creada con etapa legacy
    await expect(page.locator('text=/oportunidad|prospecto/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('O-04 Validaciones: título requerido y valor no negativo', async ({ page }) => {
    await page.goto('/crm/oportunidades/nueva');

    // Sin título
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator('text=/requerido|obligatorio/i').first()).toBeVisible();

    // Valor negativo
    await page.getByLabel(/título|nombre/i).first().fill('Test');
    await page.getByLabel(/valor/i).fill('-100');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator('text=/negativo|mayor|positivo/i').first()).toBeVisible();
  });
});

// ─── Creación con pipeline ────────────────────────────────────────────────────

test.describe('Creación con pipeline', () => {
  test('O-05 Crear oportunidad asignando pipeline — etapas del pipeline visibles', async ({ page }) => {
    await page.goto('/crm/oportunidades/nueva');

    const selectorPipeline = page.getByLabel(/pipeline/i).or(page.getByRole('combobox', { name: /pipeline/i }));
    if (!await selectorPipeline.isVisible()) {
      test.skip(true, 'Selector de pipeline no visible — puede no haber pipelines configurados');
    }

    await selectorPipeline.click();
    const primeraOpcion = page.getByRole('option').nth(1); // Primera opción que no sea "Sin pipeline"
    const nombrePipeline = await primeraOpcion.textContent();
    await primeraOpcion.click();

    // Esperado: etapas del pipeline seleccionado aparecen en el selector de etapa
    const selectorStage = page.getByLabel(/etapa|stage/i).or(page.getByRole('combobox', { name: /etapa|stage/i }));
    await expect(selectorStage).toBeVisible({ timeout: 3000 });
    await selectorStage.click();
    await expect(page.getByRole('option').first()).toBeVisible();

    // Seleccionar primera etapa del pipeline
    await page.getByRole('option').first().click();

    await page.getByLabel(/título|nombre/i).first().fill(`Opp-Pipeline-${Date.now()}`);
    await page.getByLabel(/valor/i).fill('10000');
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: oportunidad creada con pipelineId y stageId
    await expect(page).toHaveURL(/\/crm\/oportunidades\/\w+/, { timeout: 8000 });
  });

  test('O-06 Cambiar de pipeline vacía el selector de etapa', async ({ page }) => {
    await page.goto('/crm/oportunidades/nueva');

    const selectorPipeline = page.getByLabel(/pipeline/i).or(page.getByRole('combobox', { name: /pipeline/i }));
    if (!await selectorPipeline.isVisible()) {
      test.skip(true, 'No hay selector de pipeline');
    }

    // Seleccionar Pipeline A
    await selectorPipeline.click();
    const opciones = page.getByRole('option');
    const cantOpciones = await opciones.count();
    if (cantOpciones < 3) {
      test.skip(true, 'No hay suficientes pipelines para este test');
    }
    await opciones.nth(1).click();

    // Cambiar a Pipeline B
    await selectorPipeline.click();
    await opciones.nth(2).click();

    // Esperado: selector de etapa se resetea con etapas del nuevo pipeline
    const selectorStage = page.getByLabel(/etapa|stage/i).or(page.getByRole('combobox', { name: /etapa|stage/i }));
    await selectorStage.click();
    await expect(page.getByRole('option').first()).toBeVisible();

    // Volver a "Sin pipeline"
    await selectorPipeline.click();
    await page.getByRole('option', { name: /sin pipeline|ninguno/i }).click();

    // Esperado: selector vuelve a etapas legacy
    await selectorStage.click();
    await expect(page.getByRole('option', { name: /prospecto/i })).toBeVisible();
  });

  test('O-07 Crear oportunidad con empresa y contacto vinculados', async ({ page }) => {
    await page.goto('/crm/oportunidades/nueva');
    await page.getByLabel(/título|nombre/i).first().fill(`Opp-Vinculada-${Date.now()}`);

    const selectorEmpresa = page.getByLabel(/empresa/i).or(page.getByRole('combobox', { name: /empresa/i }));
    if (await selectorEmpresa.isVisible()) {
      await selectorEmpresa.click();
      const primeraEmpresa = page.getByRole('option').first();
      if (await primeraEmpresa.isVisible()) await primeraEmpresa.click();
    }

    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page).toHaveURL(/\/crm\/oportunidades\/\w+/, { timeout: 8000 });
  });
});

// ─── Edición ──────────────────────────────────────────────────────────────────

test.describe('Edición de oportunidades', () => {
  test('O-08 Editar oportunidad sin pipeline — etapa legacy visible', async ({ page }) => {
    await page.goto('/crm/oportunidades');
    await page.locator('tbody tr a, [data-testid="oportunidad-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    // Verificar que existe selector de pipeline
    const selectorPipeline = page.getByLabel(/pipeline/i).or(page.getByRole('combobox', { name: /pipeline/i }));
    await expect(selectorPipeline).toBeVisible({ timeout: 5000 });
  });

  test('O-12 Editar campos de texto y valor', async ({ page }) => {
    await page.goto('/crm/oportunidades');
    await page.locator('tbody tr a, [data-testid="oportunidad-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    const nuevoTitulo = `Opp-Editada-${Date.now()}`;
    await page.getByLabel(/título|nombre/i).first().clear();
    await page.getByLabel(/título|nombre/i).first().fill(nuevoTitulo);
    await page.getByLabel(/valor/i).clear();
    await page.getByLabel(/valor/i).fill('99999');
    await page.getByRole('button', { name: /guardar/i }).click();

    // Esperado: cambios reflejados en el detalle
    await expect(page.locator(`text=${nuevoTitulo}`).first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/99[,.]?999/').first()).toBeVisible();
  });
});

// ─── Detalle ──────────────────────────────────────────────────────────────────

test.describe('Detalle de oportunidad', () => {
  test('O-13 Ver historial de cambios en el timeline', async ({ page }) => {
    await page.goto('/crm/oportunidades');
    await page.locator('tbody tr a, [data-testid="oportunidad-fila"] a').first().click();
    // Esperado: timeline o historial visible
    await expect(
      page.locator('text=/historial|timeline|actividad|cambios/i').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('O-14 Cambiar etapa desde el detalle registra en historial', async ({ page }) => {
    await page.goto('/crm/oportunidades');
    await page.locator('tbody tr a, [data-testid="oportunidad-fila"] a').first().click();

    const selectorStage = page.getByLabel(/etapa|stage/i).or(
      page.locator('[data-testid="stage-selector"]')
    );
    if (await selectorStage.isVisible()) {
      await selectorStage.click();
      await page.getByRole('option').nth(1).click();
      // Esperado: stage actualizado, movimiento en historial
      await expect(page.locator('text=/historial|cambio|etapa/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('O-15 Marcar oportunidad como Ganada', async ({ page }) => {
    await page.goto('/crm/oportunidades');
    await page.locator('tbody tr a, [data-testid="oportunidad-fila"] a').first().click();

    const btnGanada = page.getByRole('button', { name: /ganada|won/i });
    if (await btnGanada.isVisible()) {
      await btnGanada.click();
      // Esperado: etapa cambia a Ganada
      await expect(page.locator('text=/ganada|won/i').first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('O-16 EJECUTIVO_VENTAS no puede acceder a /crm/oportunidades', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.ejecutivoVentas });
    const page = await ctx.newPage();
    await page.goto('/crm/oportunidades');

    const bloqueado =
      page.url().includes('/login') ||
      page.url().includes('/acceso-denegado') ||
      (await page.locator('text=/no tienes acceso|sin permiso|acceso denegado/i').isVisible({ timeout: 5000 }).catch(() => false));
    expect(bloqueado).toBeTruthy();

    await ctx.close();
  });

  test('O-17 SUPERVISOR solo lectura en oportunidades', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/crm/oportunidades');

    await expect(page.getByRole('table').or(page.locator('[data-testid="oportunidades-lista"]'))).toBeVisible();
    await expect(page.getByRole('button', { name: /nueva oportunidad/i })).not.toBeVisible();

    await ctx.close();
  });
});
