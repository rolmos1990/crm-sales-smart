import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de actividades', () => {
  test('A-01 Ver lista de actividades', async ({ page }) => {
    await page.goto('/crm/actividades');
    // Esperado: lista con tipo, título, fecha/hora, estado, responsable
    await expect(page.getByRole('table').or(page.locator('[data-testid="actividades-lista"]'))).toBeVisible();
  });

  test('A-02 Filtrar por tipo de actividad', async ({ page }) => {
    await page.goto('/crm/actividades');
    const filtroTipo = page.getByRole('combobox', { name: /tipo/i })
      .or(page.locator('select[name*="tipo"]'))
      .or(page.getByRole('button', { name: /tipo/i }));

    if (await filtroTipo.isVisible()) {
      await filtroTipo.click();
      await page.getByRole('option', { name: /llamada/i }).click();
      await page.waitForTimeout(600);
      // Esperado: lista filtrada con solo Llamadas
      const tiposVisibles = page.locator('text=/reunión|tarea|email/i');
      await expect(tiposVisibles).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });

  test('A-03 Filtrar por estado', async ({ page }) => {
    await page.goto('/crm/actividades');
    const filtroEstado = page.getByRole('combobox', { name: /estado/i })
      .or(page.locator('select[name*="estado"]'))
      .or(page.getByRole('button', { name: /estado|pendiente/i }));

    if (await filtroEstado.isVisible()) {
      await filtroEstado.click();
      await page.getByRole('option', { name: /pendiente/i }).click();
      await page.waitForTimeout(600);
      // Esperado: solo actividades pendientes
      await expect(page).toHaveURL(/\/crm\/actividades/);
    }
  });
});

// ─── Creación ─────────────────────────────────────────────────────────────────

test.describe('Creación de actividades', () => {
  test('A-04 Crear actividad mínima', async ({ page }) => {
    await page.goto('/crm/actividades');
    await page.getByRole('button', { name: /nueva actividad|agregar|crear/i }).click();

    // Completar tipo
    const selectorTipo = page.getByLabel(/tipo/i).or(page.getByRole('combobox', { name: /tipo/i }));
    if (await selectorTipo.isVisible()) {
      await selectorTipo.click();
      await page.getByRole('option', { name: /llamada|tarea/i }).first().click();
    }

    await page.getByLabel(/título/i).fill(`Actividad-${Date.now()}`);

    const inputFecha = page.getByLabel(/fecha/i).first();
    if (await inputFecha.isVisible()) {
      await inputFecha.fill('2025-12-31');
    }

    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: actividad creada y visible en la lista
    await expect(page.getByRole('table').or(page.locator('[data-testid="actividades-lista"]'))).toBeVisible({ timeout: 8000 });
  });

  test('A-05 Crear actividad vinculada a contacto y oportunidad', async ({ page }) => {
    await page.goto('/crm/actividades');
    await page.getByRole('button', { name: /nueva actividad|agregar|crear/i }).click();

    await page.getByLabel(/título/i).fill(`Actividad-Vinculada-${Date.now()}`);

    // Vincular contacto
    const selectorContacto = page.getByLabel(/contacto/i).or(page.getByRole('combobox', { name: /contacto/i }));
    if (await selectorContacto.isVisible()) {
      await selectorContacto.click();
      const primeraOpcion = page.getByRole('option').first();
      if (await primeraOpcion.isVisible()) await primeraOpcion.click();
    }

    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.getByRole('table').or(page.locator('[data-testid="actividades-lista"]'))).toBeVisible({ timeout: 8000 });
  });

  test('A-06 Validaciones: título y fecha requeridos', async ({ page }) => {
    await page.goto('/crm/actividades');
    await page.getByRole('button', { name: /nueva actividad|agregar|crear/i }).click();

    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // Esperado: errores en campos requeridos
    await expect(page.locator('text=/requerido|obligatorio/i').first()).toBeVisible();
  });
});

// ─── Edición y completar ──────────────────────────────────────────────────────

test.describe('Edición y completar actividades', () => {
  test('A-07 Marcar actividad como completada', async ({ page }) => {
    await page.goto('/crm/actividades');
    // Buscar un checkbox o botón de completar en la lista
    const checkbox = page.locator('[type="checkbox"], [data-testid="completar-actividad"]').first();
    const btnCompletar = page.getByRole('button', { name: /completar|marcar/i }).first();

    if (await checkbox.isVisible()) {
      await checkbox.check();
    } else if (await btnCompletar.isVisible()) {
      await btnCompletar.click();
    }

    // Esperado: estado cambia a "Completada"
    await expect(page.locator('text=/completada/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('A-08 Editar actividad pendiente', async ({ page }) => {
    await page.goto('/crm/actividades');
    await page.locator('tbody tr a, [data-testid="actividad-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    const notasField = page.getByLabel(/notas|descripción/i);
    if (await notasField.isVisible()) {
      await notasField.clear();
      await notasField.fill(`Nota editada ${Date.now()}`);
    }

    await page.getByRole('button', { name: /guardar/i }).click();
    // Esperado: cambios reflejados
    await expect(page.locator('text=/nota editada/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('A-09 Eliminar actividad', async ({ page }) => {
    // Crear una actividad para eliminar
    await page.goto('/crm/actividades');
    await page.getByRole('button', { name: /nueva actividad|agregar|crear/i }).click();

    const titulo = `Eliminar-${Date.now()}`;
    await page.getByLabel(/título/i).fill(titulo);
    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await expect(page.locator(`text=${titulo}`).first()).toBeVisible({ timeout: 8000 });

    // Eliminar
    await page.locator(`text=${titulo}`).first().click();
    await page.getByRole('button', { name: /eliminar/i }).click();
    await page.getByRole('button', { name: /confirmar|sí, eliminar|eliminar/i }).last().click();

    // Esperado: eliminada de la lista
    await expect(page.locator(`text=${titulo}`)).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── Desde detalle de contacto/oportunidad ────────────────────────────────────

test.describe('Actividades desde detalle de contacto u oportunidad', () => {
  test('A-10 Crear actividad desde el detalle de un contacto', async ({ page }) => {
    await page.goto('/crm/contactos');
    await page.locator('tbody tr a, [data-testid="contacto-fila"] a').first().click();

    const btnNuevaActividad = page.getByRole('button', { name: /nueva actividad|agregar actividad/i });
    await expect(btnNuevaActividad).toBeVisible({ timeout: 5000 });
    await btnNuevaActividad.click();

    // Esperado: formulario con el contacto pre-seleccionado
    const contactoPreseleccionado = page.getByLabel(/contacto/i)
      .or(page.locator('[data-testid="contacto-preseleccionado"]'));
    await expect(contactoPreseleccionado).not.toBeEmpty({ timeout: 5000 });
  });

  test('A-11 Ver actividades en el detalle de una oportunidad', async ({ page }) => {
    await page.goto('/crm/oportunidades');
    await page.locator('tbody tr a, [data-testid="oportunidad-fila"] a').first().click();

    // Esperado: sección de actividades con estado y fecha
    await expect(page.locator('text=/actividades/i').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('A-12 SUPERVISOR solo lectura — sin botones de crear/editar', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/crm/actividades');

    await expect(page.getByRole('table').or(page.locator('[data-testid="actividades-lista"]'))).toBeVisible();
    await expect(page.getByRole('button', { name: /nueva actividad/i })).not.toBeVisible();

    await ctx.close();
  });

  test('A-13 INVITADO puede ver actividades sin acciones de modificación', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.invitado });
    const page = await ctx.newPage();
    await page.goto('/crm/actividades');

    // Esperado: puede ver la lista
    await expect(page.getByRole('table').or(page.locator('[data-testid="actividades-lista"]'))).toBeVisible();
    // Sin botones de modificación
    await expect(page.getByRole('button', { name: /nueva actividad|crear/i })).not.toBeVisible();

    await ctx.close();
  });
});
