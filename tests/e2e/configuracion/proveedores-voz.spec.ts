import { test, expect, type Page } from '@playwright/test';

// 049 — Configuración → Voz: alta de proveedor, interruptor de transcripción y
// la garantía de que la API key nunca viaja al navegador.

async function abrirPestanaVoz(page: Page) {
  await page.goto('/configuracion');
  await page.getByRole('tab', { name: /^voz$/i }).click();
  await expect(page.getByRole('heading', { name: /proveedores de voz/i })).toBeVisible({
    timeout: 10000,
  });
}

test.describe('049 — Proveedores de Voz', () => {
  test('V-01 la pestaña muestra el consumo y el interruptor apagado por defecto', async ({ page }) => {
    await abrirPestanaVoz(page);

    await expect(page.getByText(/minutos transcritos/i)).toBeVisible();
    await expect(page.getByText(/costo estimado del mes/i)).toBeVisible();

    const interruptor = page.getByRole('switch', { name: /transcripción automática/i });
    await expect(interruptor).toBeVisible();
    await expect(interruptor).not.toBeChecked();
  });

  test('V-02 el interruptor está bloqueado mientras no haya un proveedor con credencial', async ({ page }) => {
    await abrirPestanaVoz(page);

    const hayProveedores = await page.getByRole('button', { name: /^editar$/i }).count();
    test.skip(hayProveedores > 0, 'La instancia de prueba ya tiene proveedores cargados');

    // Decir que está activa sin poder transcribir sería mentirle al comercio.
    await expect(page.getByRole('switch', { name: /transcripción automática/i })).toBeDisabled();
    await expect(page.getByText(/primero cargá un proveedor de voz activo/i)).toBeVisible();
  });

  test('V-03 alta de un proveedor y su aparición en la lista', async ({ page }) => {
    await abrirPestanaVoz(page);

    const alias = `E2E voz ${Date.now()}`;
    await page.getByRole('button', { name: /agregar/i }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByLabel(/^nombre$/i).fill(alias);
    await dialogo.getByLabel(/api key/i).fill('sk-e2e-no-real');
    await dialogo.getByRole('button', { name: /^crear$/i }).click();

    await expect(dialogo).not.toBeVisible();
    await expect(page.getByText(alias)).toBeVisible({ timeout: 10000 });
  });

  test('V-04 la API key nunca llega al navegador', async ({ page }) => {
    // FR-002: ni en claro ni cifrada. El `select` de la query la excluye y el
    // formulario de edición arranca vacío.
    const cuerpos: string[] = [];
    page.on('response', async (res) => {
      if (res.request().resourceType() === 'image') return;
      try {
        cuerpos.push(await res.text());
      } catch {
        /* respuestas binarias o ya consumidas */
      }
    });

    await abrirPestanaVoz(page);
    await page.waitForTimeout(1000);

    const todo = cuerpos.join('\n');
    expect(todo).not.toContain('apiKeyEncriptada');
    expect(todo).not.toContain('enc:v1:');
    expect(todo).not.toContain('sk-e2e-no-real');
  });

  test('V-05 editar sin tocar la API key no la borra', async ({ page }) => {
    await abrirPestanaVoz(page);

    const editar = page.getByRole('button', { name: /^editar$/i }).first();
    test.skip((await editar.count()) === 0, 'No hay proveedores que editar');

    await editar.click();
    const dialogo = page.getByRole('dialog');

    // El campo arranca vacío y el placeholder lo explica: vacío = conservar.
    await expect(dialogo.getByLabel(/api key/i)).toHaveValue('');
    await expect(dialogo.getByPlaceholder(/dejar vacío para conservar/i)).toBeVisible();

    await dialogo.getByRole('button', { name: /^guardar$/i }).click();
    await expect(dialogo).not.toBeVisible();

    // Si la credencial se hubiera borrado, aparecería el aviso "Sin API key".
    await expect(page.getByText(/sin api key/i)).toHaveCount(0);
  });
});
