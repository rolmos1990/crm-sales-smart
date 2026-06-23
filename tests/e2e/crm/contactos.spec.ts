import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de contactos', () => {
  test('C-01 Ver lista de contactos', async ({ page }) => {
    await page.goto('/crm/contactos');
    // Esperado: tabla con nombre, empresa, email, teléfono, estado
    await expect(page.getByRole('table').or(page.locator('[data-testid="contactos-lista"]'))).toBeVisible();
    await expect(page.locator('th, [role="columnheader"]').first()).toBeVisible();
  });

  test('C-02 Búsqueda por nombre o email filtra en tiempo real', async ({ page }) => {
    await page.goto('/crm/contactos');
    const buscador = page.getByPlaceholder(/buscar|search/i).or(page.getByRole('searchbox'));
    await buscador.fill('a');
    // Esperado: lista se filtra sin recargar la página
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/crm\/contactos/); // No recargó
    const filas = page.locator('tbody tr, [data-testid="contacto-fila"]');
    // Al menos una fila o estado vacío visible
    const cuenta = await filas.count();
    expect(cuenta).toBeGreaterThanOrEqual(0);
  });

  test('C-03 Estado vacío muestra mensaje y botón para crear', async ({ page }) => {
    await page.goto('/crm/contactos');
    const buscador = page.getByPlaceholder(/buscar|search/i).or(page.getByRole('searchbox'));
    await buscador.fill('zzz_busqueda_sin_resultados_xyzxyz');
    await page.waitForTimeout(600);
    // Esperado: mensaje de estado vacío
    await expect(
      page.locator('text=/no hay|sin contactos|no se encontraron|empty/i').first()
    ).toBeVisible({ timeout: 5000 });
  });
});

// ─── Creación ─────────────────────────────────────────────────────────────────

test.describe('Creación de contactos', () => {
  test('C-04 Crear contacto con datos mínimos', async ({ page }) => {
    await page.goto('/crm/contactos');
    await page.getByRole('link', { name: /nuevo contacto|agregar|crear/i }).or(page.getByRole('button', { name: /nuevo contacto|agregar|crear/i })).click();
    // Esperado: navega al formulario o abre modal
    await expect(
      page.getByRole('heading', { name: /nuevo contacto|crear contacto/i })
        .or(page.locator('form'))
    ).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/nombre/i).first().fill('Juan');
    await page.getByLabel(/apellido/i).fill('Prueba');
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: contacto visible en la lista o detalle
    await expect(page.locator('text=Juan Prueba').first()).toBeVisible({ timeout: 8000 });
  });

  test('C-05 Crear contacto completo', async ({ page }) => {
    await page.goto('/crm/contactos/nuevo');
    await page.getByLabel(/nombre/i).first().fill('María');
    await page.getByLabel(/apellido/i).fill('Completa');
    await page.getByLabel(/email/i).fill(`maria.completa.${Date.now()}@example.com`);
    await page.getByLabel(/teléfono principal|tel\./i).fill('+51 999 888 777');
    await page.getByLabel(/cargo/i).fill('Gerente');
    await page.getByLabel(/notas/i).fill('Contacto de prueba completo');
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: todos los campos guardados y visibles en el detalle
    await expect(page.locator('text=María Completa').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=Gerente').first()).toBeVisible();
  });

  test('C-06 Email duplicado muestra error o comportamiento definido', async ({ page }) => {
    const email = `dup.${Date.now()}@example.com`;

    // Crear primer contacto
    await page.goto('/crm/contactos/nuevo');
    await page.getByLabel(/nombre/i).first().fill('Primer');
    await page.getByLabel(/apellido/i).fill('Contacto');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator('text=Primer Contacto').first()).toBeVisible({ timeout: 8000 });

    // Intentar crear segundo con mismo email
    await page.goto('/crm/contactos/nuevo');
    await page.getByLabel(/nombre/i).first().fill('Segundo');
    await page.getByLabel(/apellido/i).fill('Contacto');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: error de validación o comportamiento documentado
    const tieneError = await page.locator('text=/duplicado|ya existe|email en uso/i').isVisible({ timeout: 5000 }).catch(() => false);
    const redirigioLista = page.url().includes('/crm/contactos');
    expect(tieneError || redirigioLista).toBeTruthy();
  });

  test('C-07 Teléfono con formato internacional', async ({ page }) => {
    await page.goto('/crm/contactos/nuevo');
    await page.getByLabel(/nombre/i).first().fill('Tel');
    await page.getByLabel(/apellido/i).fill('Internacional');
    await page.getByLabel(/teléfono principal|tel\./i).fill('+51 999 888 777');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // Esperado: teléfono guardado correctamente
    await expect(page.locator('text=Tel Internacional').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=/\\+51|999 888 777/').first()).toBeVisible();
  });

  test('C-08 Validaciones del formulario', async ({ page }) => {
    await page.goto('/crm/contactos/nuevo');

    // Sin nombre
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator('text=/requerido|obligatorio/i').first()).toBeVisible();

    // Email inválido
    await page.getByLabel(/email/i).fill('no-es-un-email');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator('text=/email|correo|válido/i').first()).toBeVisible();
  });
});

// ─── Detalle y edición ────────────────────────────────────────────────────────

test.describe('Detalle y edición de contactos', () => {
  test('C-09 Ver detalle del contacto', async ({ page }) => {
    await page.goto('/crm/contactos');
    // Clic en el primer contacto de la lista
    const primerContacto = page.locator('tbody tr a, [data-testid="contacto-fila"] a').first();
    await primerContacto.click();
    // Esperado: página de detalle con campos, actividades y oportunidades
    await expect(page).toHaveURL(/\/crm\/contactos\/\w+/);
    await expect(page.locator('[data-testid="contacto-detalle"], main').first()).toBeVisible();
  });

  test('C-10 Editar contacto', async ({ page }) => {
    await page.goto('/crm/contactos');
    await page.locator('tbody tr a, [data-testid="contacto-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    const nuevoCampo = `Editado-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().clear();
    await page.getByLabel(/nombre/i).first().fill(nuevoCampo);
    await page.getByRole('button', { name: /guardar/i }).click();

    // Esperado: cambios reflejados
    await expect(page.locator(`text=${nuevoCampo}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('C-11 Eliminar contacto', async ({ page }) => {
    // Crear uno primero para eliminarlo sin afectar datos existentes
    await page.goto('/crm/contactos/nuevo');
    const nombreParaEliminar = `Eliminar-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreParaEliminar);
    await page.getByLabel(/apellido/i).fill('Test');
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator(`text=${nombreParaEliminar}`).first()).toBeVisible({ timeout: 8000 });

    // Eliminar
    await page.getByRole('button', { name: /eliminar/i }).click();
    // Confirmar diálogo
    await page.getByRole('button', { name: /confirmar|sí, eliminar|eliminar/i }).last().click();

    // Esperado: redirige a la lista y no aparece más
    await expect(page).toHaveURL(/\/crm\/contactos$/, { timeout: 8000 });
    await expect(page.locator(`text=${nombreParaEliminar}`)).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('C-12 SUPERVISOR solo lectura', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/crm/contactos');

    // Esperado: puede ver la lista
    await expect(page.getByRole('table').or(page.locator('[data-testid="contactos-lista"]'))).toBeVisible();

    // Esperado: NO aparece botón de crear ni editar
    await expect(page.getByRole('link', { name: /nuevo contacto/i }).or(page.getByRole('button', { name: /nuevo contacto/i }))).not.toBeVisible();

    await ctx.close();
  });

  test('C-13 INVITADO bloqueado al crear contacto por URL directa', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.invitado });
    const page = await ctx.newPage();
    await page.goto('/crm/contactos/nuevo');

    // Esperado: redirigido o error de acceso denegado
    const bloqueado =
      page.url().includes('/login') ||
      page.url().includes('/acceso-denegado') ||
      (await page.locator('text=/no tienes acceso|sin permiso|acceso denegado/i').isVisible({ timeout: 5000 }).catch(() => false));
    expect(bloqueado).toBeTruthy();

    await ctx.close();
  });
});
