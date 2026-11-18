import { test, expect, type Page } from '@playwright/test';
import { authFile } from '../../fixtures';

// 041 — Segmentación comercial de Contactos: indicadores, pestañas, filtros,
// panel lateral, clasificación manual, No contactar y seguimiento.

async function crearContacto(page: Page, nombre: string, telefono?: string) {
  await page.goto('/crm/contactos/nuevo');
  await page.getByLabel(/nombre/i).first().fill(nombre);
  await page.getByLabel(/apellido/i).fill('Segmento');
  if (telefono) await page.getByLabel(/teléfono principal|telefono principal/i).fill(telefono);
  await page.getByRole('button', { name: /guardar|crear/i }).click();
  await expect(page.locator(`text=${nombre}`).first()).toBeVisible({ timeout: 8000 });
}

async function abrirEnLista(page: Page, nombre: string) {
  await page.goto('/crm/contactos');
  await page.getByPlaceholder(/buscar/i).fill(nombre);
  const fila = page.locator('tbody tr', { hasText: nombre });
  await expect(fila).toBeVisible({ timeout: 8000 });
  return fila;
}

test.describe('041 — Indicadores, pestañas y filtros (H1)', () => {
  test('S-01 Cinco indicadores compactos sin tendencias', async ({ page }) => {
    await page.goto('/crm/contactos');
    for (const etiqueta of ['Total contactos', 'Clientes', 'Interesados', 'Por recuperar', 'Leads']) {
      await expect(page.getByRole('button', { name: new RegExp(etiqueta, 'i') }).first()).toBeVisible();
    }
    await expect(page.getByText(/mes anterior/i)).toHaveCount(0);
    await expect(page.getByText(/pueden superponerse/i)).toBeVisible();
  });

  test('S-02 Indicador y pestaña comparten el segmento', async ({ page }) => {
    await page.goto('/crm/contactos');
    await page.getByRole('button', { name: /^Clientes/i }).first().click();
    await expect(page.getByRole('tab', { name: /^Clientes/i })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /^Interesados/i }).click();
    await expect(page.getByRole('button', { name: /^Interesados/i }).first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('S-03 Búsqueda por fragmento de teléfono', async ({ page }) => {
    const nombre = `Tel-${Date.now()}`;
    const fragmento = String(Date.now()).slice(-6);
    await crearContacto(page, nombre, `+507 6${fragmento}`);
    await page.goto('/crm/contactos');
    await page.getByPlaceholder(/buscar/i).fill(fragmento);
    await expect(page.locator('tbody tr', { hasText: nombre })).toBeVisible({ timeout: 8000 });
  });

  test('S-04 Sin columna Estado vieja; orden por defecto por prioridad', async ({ page }) => {
    await page.goto('/crm/contactos');
    await expect(page.getByRole('columnheader', { name: /^estado$/i })).toHaveCount(0);
    await expect(page.getByText(/ordenado por prioridad de atención/i)).toBeVisible();
  });

  test('S-05 Limpiar vuelve a la vista por defecto', async ({ page }) => {
    await page.goto('/crm/contactos');
    await page.getByPlaceholder(/buscar/i).fill('zzz_sin_resultados_041');
    await expect(page.getByText(/sin resultados para estos filtros/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /^limpiar/i }).first().click();
    await expect(page.getByPlaceholder(/buscar/i)).toHaveValue('');
  });

  test('S-06 En móvil no hay scroll horizontal de la página', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, storageState: authFile.owner });
    const page = await ctx.newPage();
    await page.goto('/crm/contactos');
    const anchoDoc = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(anchoDoc).toBeLessThanOrEqual(375);
    await ctx.close();
  });
});

test.describe('041 — Panel lateral, interés y No contactar (H2)', () => {
  test('S-07 La fila abre el panel sin perder la búsqueda', async ({ page }) => {
    const nombre = `Panel-${Date.now()}`;
    await crearContacto(page, nombre);
    const fila = await abrirEnLista(page, nombre);
    await fila.click();
    const panel = page.getByRole('dialog');
    await expect(panel.getByText(/información general/i)).toBeVisible();
    await expect(panel.getByText(/sin analizar/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder(/buscar/i)).toHaveValue(nombre);
  });

  test('S-08 Fijar interés Alto lo convierte en Interesado y queda en el historial', async ({ page }) => {
    const nombre = `Interes-${Date.now()}`;
    await crearContacto(page, nombre);
    const fila = await abrirEnLista(page, nombre);
    await fila.click();
    const panel = page.getByRole('dialog');
    await panel.getByRole('combobox', { name: /nivel de interés/i }).click();
    await page.getByRole('option', { name: /^alto$/i }).click();
    await expect(page.getByText(/interés actualizado/i)).toBeVisible({ timeout: 8000 });
    await expect(fila.getByText(/interesado/i)).toBeVisible({ timeout: 8000 });
    await panel.getByText(/historial de clasificación/i).click();
    await expect(panel.getByText(/sin evaluar → alto/i)).toBeVisible();
  });

  test('S-09 Marcar y desmarcar No contactar', async ({ page }) => {
    const nombre = `NoContactar-${Date.now()}`;
    await crearContacto(page, nombre);
    const fila = await abrirEnLista(page, nombre);
    await fila.click();
    const panel = page.getByRole('dialog');
    await panel.getByRole('button', { name: /marcar no contactar/i }).click();
    await page.getByRole('button', { name: /sí, no contactar/i }).click();
    await expect(fila.getByText(/no contactar/i)).toBeVisible({ timeout: 8000 });
    await panel.getByRole('button', { name: /volver a contactable/i }).click();
    await expect(fila.getByText(/no contactar/i)).toHaveCount(0, { timeout: 8000 });
  });

  test('S-10 SUPERVISOR ve el panel pero no los controles de clasificación', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/crm/contactos');
    await page.locator('tbody tr').first().click();
    const panel = page.getByRole('dialog');
    await expect(panel.getByText(/actividad comercial/i)).toBeVisible();
    await expect(panel.getByRole('button', { name: /marcar no contactar/i })).toHaveCount(0);
    await ctx.close();
  });
});

test.describe('041 — Seguimiento y recomendación (H3)', () => {
  test('S-11 Columna Recomendación y filtro de seguimiento en "Más filtros"', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/crm/contactos');
    await expect(page.getByRole('columnheader', { name: /recomendación/i })).toBeVisible();
    await page.getByRole('button', { name: /más filtros/i }).click();
    await page.getByRole('combobox', { name: /seguimiento/i }).click();
    await page.getByRole('option', { name: /por recuperar/i }).click();
    await expect(page.getByRole('button', { name: /más filtros/i })).toContainText('1');
  });

  test('S-12 Umbrales: rechaza valores que no cumplen Pendiente < Por recuperar ≤ Inactivo', async ({ page }) => {
    await page.goto('/configuracion');
    await page.getByRole('tab', { name: /preferencias/i }).click();
    const seccion = page.locator('[data-slot="seccion-seguimiento-contactos"]');
    const inputs = seccion.locator('input[type="number"]');
    await inputs.nth(0).fill('7');
    await inputs.nth(1).fill('3');
    await expect(seccion.getByText(/pendiente < por recuperar/i)).toBeVisible();
    await expect(seccion.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  test('S-13 Umbrales: guarda valores válidos', async ({ page }) => {
    await page.goto('/configuracion');
    await page.getByRole('tab', { name: /preferencias/i }).click();
    const seccion = page.locator('[data-slot="seccion-seguimiento-contactos"]');
    const inputs = seccion.locator('input[type="number"]');
    const pendiente = Number(await inputs.nth(0).inputValue()) === 3 ? '4' : '3';
    await inputs.nth(0).fill(pendiente);
    await seccion.getByRole('button', { name: /guardar/i }).click();
    await expect(page.getByText(/seguimiento de contactos actualizado/i)).toBeVisible({ timeout: 8000 });
  });
});
