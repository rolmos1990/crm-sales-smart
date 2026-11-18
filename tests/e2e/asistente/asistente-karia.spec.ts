import { test, expect, type Page } from '@playwright/test';

// Spec 038 — Asistente Karia flotante.

const boton = (page: Page) => page.getByRole('button', { name: 'Asistente Karia' });
const avatarFlotante = (page: Page) => page.locator('[data-slot="asistente-karia"] [data-slot="karia-avatar"]');
const SALUDO = 'Hola, soy Karia. Muy pronto podré ayudarte aquí.';

test.describe('US1 — Karia visible con sesión', () => {
  for (const ruta of ['/crm', '/sales/pedidos']) {
    test(`aparece en ${ruta} en reposo`, async ({ page }) => {
      await page.goto(ruta);
      await expect(boton(page)).toBeVisible();
      await expect(avatarFlotante(page)).toHaveAttribute('data-state', 'idle');
    });
  }

  test('no aparece en la bandeja (/crm/inbox)', async ({ page }) => {
    await page.goto('/crm/inbox');
    await page.waitForLoadState('networkidle');
    await expect(boton(page)).toHaveCount(0);
  });

  test('con movimiento reducido no flota', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/crm');
    const cuerpo = avatarFlotante(page).locator('.karia-cuerpo');
    await expect(cuerpo).toBeVisible();
    const animacion = await cuerpo.evaluate((n) => getComputedStyle(n).animationName);
    expect(animacion).toBe('none');
  });
});

test.describe('US1 — sin sesión', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('no aparece en /login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(boton(page)).toHaveCount(0);
  });
});

test.describe('US2 — clic en Karia', () => {
  test('saluda, celebra y vuelve a reposo en menos de 2 s', async ({ page }) => {
    await page.goto('/crm');
    await boton(page).click();
    await expect(page.getByText(SALUDO)).toBeVisible();
    await expect(avatarFlotante(page)).toHaveAttribute('data-state', 'success');
    await expect(avatarFlotante(page)).toHaveAttribute('data-state', 'idle', { timeout: 2000 });
  });

  test('Escape cierra el saludo y devuelve el foco', async ({ page }) => {
    await page.goto('/crm');
    await boton(page).click();
    await expect(page.getByText(SALUDO)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(SALUDO)).toBeHidden();
    await expect(boton(page)).toBeFocused();
  });

  test('se abre con teclado', async ({ page }) => {
    await page.goto('/crm');
    await boton(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(SALUDO)).toBeVisible();
  });
});

test.describe('Arrastrar a Karia', () => {
  test('se mueve sin abrir el saludo, recuerda la posición y vuelve con Inicio', async ({ page }) => {
    await page.goto('/crm');
    const caja = await boton(page).boundingBox();
    expect(caja).not.toBeNull();
    const inicio = { x: caja!.x + caja!.width / 2, y: caja!.y + caja!.height / 2 };

    await page.mouse.move(inicio.x, inicio.y);
    await page.mouse.down();
    await page.mouse.move(inicio.x - 300, inicio.y - 200, { steps: 10 });
    await page.mouse.up();

    const movida = await boton(page).boundingBox();
    expect(movida!.x).toBeLessThan(caja!.x - 250);
    expect(movida!.y).toBeLessThan(caja!.y - 150);
    await expect(page.getByText(SALUDO)).toBeHidden();

    // Un clic normal después del arrastre sí abre el saludo.
    await boton(page).click();
    await expect(page.getByText(SALUDO)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.reload();
    const tras = await boton(page).boundingBox();
    expect(Math.abs(tras!.x - movida!.x)).toBeLessThan(2);

    await boton(page).focus();
    await page.keyboard.press('Home');
    const reiniciada = await boton(page).boundingBox();
    expect(Math.abs(reiniciada!.x - caja!.x)).toBeLessThan(2);
  });

  test('no se puede sacar de la pantalla', async ({ page }) => {
    await page.goto('/crm');
    const caja = await boton(page).boundingBox();
    await page.mouse.move(caja!.x + 10, caja!.y + 10);
    await page.mouse.down();
    await page.mouse.move(-500, -500, { steps: 10 });
    await page.mouse.up();
    const movida = await boton(page).boundingBox();
    expect(movida!.x).toBeGreaterThanOrEqual(0);
    expect(movida!.y).toBeGreaterThanOrEqual(0);
  });
});

test.describe('US3 — estados desde otras pantallas', () => {
  test('pensar, celebrar y reposar cambian al flotante', async ({ page }) => {
    await page.goto('/dev/karia');
    await page.getByRole('button', { name: 'Pensar' }).click();
    await expect(avatarFlotante(page)).toHaveAttribute('data-state', 'thinking');
    await expect(avatarFlotante(page).locator('.karia-puntos')).toBeVisible();

    await page.getByRole('button', { name: 'Celebrar' }).click();
    await expect(avatarFlotante(page)).toHaveAttribute('data-state', 'success');
    await expect(avatarFlotante(page)).toHaveAttribute('data-state', 'idle', { timeout: 2000 });

    await page.getByRole('button', { name: 'Pensar' }).click();
    await page.getByRole('button', { name: 'Reposar' }).click();
    await expect(avatarFlotante(page)).toHaveAttribute('data-state', 'idle');
  });
});

test.describe('US4 — instancias reutilizables', () => {
  test('cada instancia respeta sus props y no depende del flotante', async ({ page }) => {
    await page.goto('/dev/karia');
    const instancias = page.getByTestId('instancias-karia').locator('[data-slot="karia-avatar"]');
    await expect(instancias).toHaveCount(8);

    await expect(page.getByRole('img', { name: 'state="idle" emotion="happy"' })).toHaveAttribute('data-emotion', 'happy');
    await expect(page.getByRole('img', { name: 'state="thinking"' })).toHaveAttribute('data-state', 'thinking');

    await page.getByRole('button', { name: 'Pensar' }).click();
    await expect(avatarFlotante(page)).toHaveAttribute('data-state', 'thinking');
    await expect(page.getByRole('img', { name: 'state="idle" emotion="neutral"' })).toHaveAttribute('data-state', 'idle');
  });
});
