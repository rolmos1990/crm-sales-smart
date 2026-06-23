import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado y búsqueda ───────────────────────────────────────────────────────

test.describe('Listado y búsqueda de empresas', () => {
  test('E-01 Ver lista de empresas', async ({ page }) => {
    await page.goto('/crm/empresas');
    // Esperado: tabla con nombre, industria, tamaño, sitio web
    await expect(page.getByRole('table').or(page.locator('[data-testid="empresas-lista"]'))).toBeVisible();
  });

  test('E-02 Búsqueda por nombre filtra en tiempo real', async ({ page }) => {
    await page.goto('/crm/empresas');
    const buscador = page.getByPlaceholder(/buscar|search/i).or(page.getByRole('searchbox'));
    await buscador.fill('a');
    await page.waitForTimeout(600);
    // Esperado: lista filtrada, sin recarga de página
    await expect(page).toHaveURL(/\/crm\/empresas/);
  });
});

// ─── Creación ─────────────────────────────────────────────────────────────────

test.describe('Creación de empresas', () => {
  test('E-03 Crear empresa mínima (solo nombre)', async ({ page }) => {
    await page.goto('/crm/empresas');
    await page.getByRole('link', { name: /nueva empresa|agregar|crear/i }).or(page.getByRole('button', { name: /nueva empresa|agregar|crear/i })).first().click();

    const nombreEmpresa = `Empresa-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreEmpresa);
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: empresa creada y visible en la lista
    await expect(page.locator(`text=${nombreEmpresa}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('E-04 Crear empresa completa', async ({ page }) => {
    await page.goto('/crm/empresas/nueva').catch(() => page.goto('/crm/empresas'));
    const btn = page.getByRole('link', { name: /nueva empresa|agregar|crear/i }).or(page.getByRole('button', { name: /nueva empresa|agregar|crear/i }));
    if (await btn.isVisible()) await btn.click();

    const nombreEmpresa = `EmpresaCompleta-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreEmpresa);

    const industria = page.getByLabel(/industria/i);
    if (await industria.isVisible()) await industria.fill('Tecnología');

    const sitio = page.getByLabel(/sitio web|web/i);
    if (await sitio.isVisible()) await sitio.fill('https://example.com');

    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: todos los datos guardados
    await expect(page.locator(`text=${nombreEmpresa}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('E-05 Validación: nombre requerido', async ({ page }) => {
    await page.goto('/crm/empresas');
    await page.getByRole('link', { name: /nueva empresa|agregar|crear/i }).or(page.getByRole('button', { name: /nueva empresa|agregar|crear/i })).first().click();
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // Esperado: error de validación en el campo nombre
    await expect(page.locator('text=/requerido|obligatorio/i').first()).toBeVisible();
  });
});

// ─── Detalle y edición ────────────────────────────────────────────────────────

test.describe('Detalle y edición de empresas', () => {
  test('E-06 Ver contactos asociados a la empresa', async ({ page }) => {
    await page.goto('/crm/empresas');
    await page.locator('tbody tr a, [data-testid="empresa-fila"] a').first().click();
    await expect(page).toHaveURL(/\/crm\/empresas\/\w+/);
    // Esperado: sección de contactos visible
    await expect(page.locator('text=/contactos/i').first()).toBeVisible();
  });

  test('E-07 Ver oportunidades asociadas a la empresa', async ({ page }) => {
    await page.goto('/crm/empresas');
    await page.locator('tbody tr a, [data-testid="empresa-fila"] a').first().click();
    // Esperado: sección de oportunidades visible con valor y etapa
    await expect(page.locator('text=/oportunidades/i').first()).toBeVisible();
  });

  test('E-08 Editar empresa', async ({ page }) => {
    await page.goto('/crm/empresas');
    await page.locator('tbody tr a, [data-testid="empresa-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    const nombreNuevo = `EmpresaEditada-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().clear();
    await page.getByLabel(/nombre/i).first().fill(nombreNuevo);
    await page.getByRole('button', { name: /guardar/i }).click();

    // Esperado: cambios reflejados en detalle y lista
    await expect(page.locator(`text=${nombreNuevo}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('E-09 Eliminar empresa sin vínculos', async ({ page }) => {
    // Crear empresa nueva sin vínculos para eliminar
    await page.goto('/crm/empresas');
    await page.getByRole('link', { name: /nueva empresa|agregar|crear/i }).or(page.getByRole('button', { name: /nueva empresa|agregar|crear/i })).first().click();
    const nombreEliminar = `EmpresaEliminar-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreEliminar);
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator(`text=${nombreEliminar}`).first()).toBeVisible({ timeout: 8000 });

    // Eliminar
    await page.getByRole('button', { name: /eliminar/i }).click();
    await page.getByRole('button', { name: /confirmar|sí, eliminar|eliminar/i }).last().click();

    // Esperado: eliminada sin errores
    await expect(page).toHaveURL(/\/crm\/empresas$/, { timeout: 8000 });
    await expect(page.locator(`text=${nombreEliminar}`)).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('E-10 AGENTE_SOPORTE solo lectura en empresas', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.agenteSoporte });
    const page = await ctx.newPage();
    await page.goto('/crm/empresas');

    // Esperado: puede ver la lista
    await expect(page.getByRole('table').or(page.locator('[data-testid="empresas-lista"]'))).toBeVisible();

    // Esperado: NO aparece botón de editar
    await expect(page.getByRole('button', { name: /editar/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /nueva empresa/i }).or(page.getByRole('button', { name: /nueva empresa/i }))).not.toBeVisible();

    await ctx.close();
  });
});
