import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Directorio donde se guardan los estados de sesión
const AUTH_DIR = path.join(process.cwd(), '.auth');

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  storageFile: string
) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /iniciar sesión|entrar|login/i }).click();
  // Esperar a que llegue al dashboard tras el login
  await expect(page).toHaveURL(/\/(dashboard|crm|sales|inbox|productos)/, { timeout: 45000 });
  await page.context().storageState({ path: storageFile });
}

setup('autenticar como owner', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_OWNER_EMAIL!,
    process.env.TEST_OWNER_PASSWORD!,
    path.join(AUTH_DIR, 'owner.json')
  );
});

setup('autenticar como admin', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_ADMIN_EMAIL!,
    process.env.TEST_ADMIN_PASSWORD!,
    path.join(AUTH_DIR, 'admin.json')
  );
});

setup('autenticar como agente_ventas', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_AGENTE_VENTAS_EMAIL!,
    process.env.TEST_AGENTE_VENTAS_PASSWORD!,
    path.join(AUTH_DIR, 'agente_ventas.json')
  );
});

setup('autenticar como ejecutivo_ventas', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_EJECUTIVO_VENTAS_EMAIL!,
    process.env.TEST_EJECUTIVO_VENTAS_PASSWORD!,
    path.join(AUTH_DIR, 'ejecutivo_ventas.json')
  );
});

setup('autenticar como supervisor', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_SUPERVISOR_EMAIL!,
    process.env.TEST_SUPERVISOR_PASSWORD!,
    path.join(AUTH_DIR, 'supervisor.json')
  );
});

setup('autenticar como agente_soporte', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_AGENTE_SOPORTE_EMAIL!,
    process.env.TEST_AGENTE_SOPORTE_PASSWORD!,
    path.join(AUTH_DIR, 'agente_soporte.json')
  );
});

setup('autenticar como invitado', async ({ page }) => {
  await loginAs(
    page,
    process.env.TEST_INVITADO_EMAIL!,
    process.env.TEST_INVITADO_PASSWORD!,
    path.join(AUTH_DIR, 'invitado.json')
  );
});
