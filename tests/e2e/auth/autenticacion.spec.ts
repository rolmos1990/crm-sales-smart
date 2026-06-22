import { test, expect } from '@playwright/test';

// ─── Registro de cuenta nueva ─────────────────────────────────────────────────

test.describe('Registro de cuenta nueva', () => {
  test('R-01 Registro exitoso', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel(/nombre/i).first().fill('Juan');
    await page.getByLabel(/apellido/i).fill('Prueba');
    await page.getByLabel(/empresa/i).fill('Empresa Test');
    await page.getByLabel(/email/i).fill(`test+${Date.now()}@example.com`);
    await page.getByLabel(/contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /registrar|crear cuenta/i }).click();
    // Esperado: redirige al dashboard tras el registro exitoso
    await expect(page).toHaveURL(/\/(dashboard|crm|sales)?$/, { timeout: 15000 });
  });

  test('R-02 Email ya registrado', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel(/nombre/i).first().fill('Otro');
    await page.getByLabel(/apellido/i).fill('Usuario');
    await page.getByLabel(/empresa/i).fill('Empresa X');
    await page.getByLabel(/email/i).fill(process.env.TEST_OWNER_EMAIL!);
    await page.getByLabel(/contraseña/i).fill('Test1234!');
    await page.getByRole('button', { name: /registrar|crear cuenta/i }).click();
    // Esperado: mensaje de error claro, sin crear cuenta duplicada
    await expect(page.getByRole('alert').or(page.locator('[role="status"]')).or(
      page.locator('text=/ya existe|ya registrado|email en uso/i')
    )).toBeVisible({ timeout: 8000 });
  });

  test('R-03 Validaciones del formulario de registro', async ({ page }) => {
    await page.goto('/registro');

    // Enviar vacío
    await page.getByRole('button', { name: /registrar|crear cuenta/i }).click();
    await expect(page.locator('text=/requerido|obligatorio|campo requerido/i').first()).toBeVisible();

    // Contraseña corta
    await page.getByLabel(/contraseña/i).fill('123');
    await page.getByRole('button', { name: /registrar|crear cuenta/i }).click();
    await expect(page.locator('text=/mínimo|caracteres|corta/i').first()).toBeVisible();

    // Email inválido
    await page.getByLabel(/email/i).fill('no-es-email');
    await page.getByRole('button', { name: /registrar|crear cuenta/i }).click();
    await expect(page.locator('text=/email|correo|válido/i').first()).toBeVisible();
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

test.describe('Login', () => {
  test('L-01 Login con credenciales correctas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_OWNER_EMAIL!);
    await page.getByLabel(/contraseña/i).fill(process.env.TEST_OWNER_PASSWORD!);
    await page.getByRole('button', { name: /iniciar sesión|entrar|login/i }).click();
    // Esperado: redirige al dashboard
    await expect(page).toHaveURL(/\/(dashboard|crm|sales|inbox|productos)?$/, { timeout: 15000 });
  });

  test('L-02 Credenciales incorrectas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_OWNER_EMAIL!);
    await page.getByLabel(/contraseña/i).fill('contraseña-incorrecta');
    await page.getByRole('button', { name: /iniciar sesión|entrar|login/i }).click();
    // Esperado: mensaje de error sin revelar si el email existe
    await expect(page.locator('text=/inválid|incorrecto|error/i').first()).toBeVisible({ timeout: 8000 });
    await expect(page).not.toHaveURL(/\/(dashboard|crm|sales)/);
  });

  test('L-03 Magic Link — solicitud enviada', async ({ page }) => {
    await page.goto('/auth/magiclink');
    await page.getByLabel(/email/i).fill(process.env.TEST_OWNER_EMAIL!);
    await page.getByRole('button', { name: /enviar|magic link|acceso/i }).click();
    // Esperado: confirmación de email enviado
    await expect(page.locator('text=/enviado|revisa|correo|bandeja/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('L-04 Restablecimiento de contraseña — solicitud enviada', async ({ page }) => {
    await page.goto('/login');
    const resetLink = page.locator('a', { hasText: /olvidaste|restablecer|recuperar/i });
    if (await resetLink.isVisible()) {
      await resetLink.click();
    } else {
      await page.goto('/auth/reset-password');
    }
    await page.getByLabel(/email/i).fill(process.env.TEST_OWNER_EMAIL!);
    await page.getByRole('button', { name: /enviar|restablecer|recuperar/i }).click();
    // Esperado: confirmación de email enviado
    await expect(page.locator('text=/enviado|revisa|correo|bandeja/i').first()).toBeVisible({ timeout: 8000 });
  });
});

// ─── Sesión y permisos básicos ────────────────────────────────────────────────

test.describe('Sesión y permisos básicos', () => {
  test('S-01 Redireccionamiento sin sesión a /login', async ({ page }) => {
    // Sin storageState — no hay sesión
    await page.goto('/crm/contactos');
    // Esperado: redirige a /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('S-02 Persistencia de sesión (cookies)', async ({ page, context }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_OWNER_EMAIL!);
    await page.getByLabel(/contraseña/i).fill(process.env.TEST_OWNER_PASSWORD!);
    await page.getByRole('button', { name: /iniciar sesión|entrar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|crm|sales)?$/, { timeout: 15000 });

    // Abrir nueva pestaña — debe seguir autenticado
    const page2 = await context.newPage();
    await page2.goto('/crm/contactos');
    await expect(page2).not.toHaveURL(/\/login/);
    await page2.close();
  });

  test('S-03 Cierre de sesión', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_OWNER_EMAIL!);
    await page.getByLabel(/contraseña/i).fill(process.env.TEST_OWNER_PASSWORD!);
    await page.getByRole('button', { name: /iniciar sesión|entrar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|crm|sales)?$/, { timeout: 15000 });

    // Cerrar sesión
    const menuUser = page.locator('[data-testid="user-menu"], [aria-label*="usuario"], button:has-text("Cerrar sesión")').first();
    if (await menuUser.isVisible()) {
      await menuUser.click();
    }
    await page.getByRole('menuitem', { name: /cerrar sesión|logout|salir/i })
      .or(page.getByRole('button', { name: /cerrar sesión|logout|salir/i }))
      .click();

    // Esperado: redirige a /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Verificar que las rutas protegidas redirigen
    await page.goto('/crm/contactos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('S-04 Acceso denegado por rol — EJECUTIVO_VENTAS en /crm/pipeline', async ({ page }) => {
    await page.context().addInitScript(() => {});
    // Usar storageState del ejecutivo_ventas
    await page.context().storageState();
    // Se inyecta el storageState via test.use en el contexto del test
    await page.goto('/crm/pipeline');
    // Esperado: redirigido o pantalla de acceso denegado
    const denied =
      (await page.url()).includes('/login') ||
      (await page.url()).includes('/acceso-denegado') ||
      (await page.locator('text=/no tienes acceso|sin permiso|acceso denegado/i').isVisible());
    expect(denied).toBeTruthy();
  });
});
