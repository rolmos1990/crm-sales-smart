import { test, expect, type Page } from '@playwright/test';
import { authFile } from '../../fixtures';

// 042 — Configuración → IA → Análisis de contactos: criterio por rubro
// (Historia 3) y avance de la cuenta (Historia 6).

async function abrirSeccion(page: Page) {
  await page.goto('/configuracion');
  await page.getByRole('tab', { name: /inteligencia artificial/i }).click();
  const seccion = page.locator('[data-slot="editor-criterio"]');
  await expect(seccion).toBeVisible({ timeout: 10000 });
  return seccion;
}

test.describe('042 — Criterio de análisis (Historia 3)', () => {
  test('C-01 muestra el criterio vigente y las plantillas por rubro', async ({ page }) => {
    const seccion = await abrirSeccion(page);
    await expect(seccion.getByText('Criterio de análisis')).toBeVisible();
    await seccion.getByRole('combobox').click();
    for (const nombre of ['General', 'Comercio minorista', 'Servicios / citas', 'Venta B2B']) {
      await expect(page.getByRole('option', { name: nombre })).toBeVisible();
    }
    await page.keyboard.press('Escape');
  });

  test('C-02 usar una plantilla, agregar una señal y publicar deja una versión numerada', async ({ page }) => {
    const seccion = await abrirSeccion(page);
    await seccion.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Servicios / citas' }).click();
    await seccion.getByRole('button', { name: /usar plantilla/i }).click();
    await expect(page.getByText(/borrador creado/i)).toBeVisible();

    const senales = seccion.getByLabel(/señales de compra/i);
    await senales.fill(`${await senales.inputValue()}\nPide disponibilidad de agenda`);
    await seccion.getByRole('button', { name: /^publicar$/i }).click();
    await expect(page.getByText(/criterio publicado \(versión \d+\)/i)).toBeVisible({ timeout: 10000 });
    await expect(seccion.getByText(/versión publicada \d+/i)).toBeVisible();
  });

  test('C-03 instrucciones demasiado largas no se pueden guardar', async ({ page }) => {
    const seccion = await abrirSeccion(page);
    await seccion.getByLabel(/instrucciones del negocio/i).fill('x'.repeat(2001));
    await seccion.getByRole('button', { name: /guardar borrador/i }).click();
    await expect(seccion.getByText(/2000|2\.000/)).toBeVisible();
    await expect(page.getByText(/borrador guardado/i)).toHaveCount(0);
  });
});

test.describe('042 — Permisos de configuración', () => {
  test.use({ storageState: authFile.agenteVentas });

  test('C-04 un agente de ventas no puede editar el criterio (FR-049)', async ({ page }) => {
    await page.goto('/configuracion');
    const tabIA = page.getByRole('tab', { name: /inteligencia artificial/i });
    if ((await tabIA.count()) === 0) return; // sin acceso a la pestaña: también cumple
    await tabIA.click();
    await expect(page.getByRole('button', { name: /^publicar$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /usar plantilla/i })).toHaveCount(0);
  });
});

test.describe('042 — Avance del análisis (Historia 6)', () => {
  test('C-05 muestra la clasificación inicial separada de los contactos activos', async ({ page }) => {
    await page.goto('/configuracion');
    await page.getByRole('tab', { name: /inteligencia artificial/i }).click();
    const avance = page.locator('[data-slot="panel-avance-analisis"]');
    await expect(avance).toBeVisible({ timeout: 10000 });
    await expect(avance.getByText(/clasificación inicial/i)).toBeVisible();
    await expect(avance.getByText(/contactos activos/i)).toBeVisible();
    await expect(avance.getByText(/resueltos por reglas/i)).toBeVisible();
  });

  test('C-06 el modo de interés se elige entre Solo sugerir y Aplicar automáticamente', async ({ page }) => {
    await page.goto('/configuracion');
    await page.getByRole('tab', { name: /inteligencia artificial/i }).click();
    const form = page.locator('[data-slot="form-configuracion-analisis"]');
    await expect(form.getByRole('combobox')).toHaveText(/solo sugerir|aplicar automáticamente/i);
  });
});
