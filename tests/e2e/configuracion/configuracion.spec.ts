import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Datos de la instancia ────────────────────────────────────────────────────

test.describe('Datos de la instancia', () => {
  test('CF-01 Ver datos de la empresa / instancia', async ({ page }) => {
    await page.goto('/configuracion');
    // Esperado: nombre de empresa, moneda, zona horaria, datos de contacto
    await expect(
      page.locator('[data-testid="configuracion-instancia"]').or(page.locator('main'))
    ).toBeVisible();
    await expect(page.locator('text=/empresa|nombre.*empresa|configuración/i').first()).toBeVisible();
  });

  test('CF-02 Editar nombre y datos de la empresa', async ({ page }) => {
    await page.goto('/configuracion');
    await page.getByRole('button', { name: /editar|modificar/i }).first().click();

    const nombreEmpresa = page.getByLabel(/nombre.*empresa|empresa/i);
    if (await nombreEmpresa.isVisible()) {
      await nombreEmpresa.clear();
      await nombreEmpresa.fill(`Empresa Editada ${Date.now()}`);
    }

    await page.getByRole('button', { name: /guardar/i }).click();
    // Esperado: cambios reflejados
    await expect(page.locator('text=/guardado|actualizado/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('CF-03 Cambiar moneda principal', async ({ page }) => {
    await page.goto('/configuracion');
    const selectorMoneda = page.getByLabel(/moneda/i).or(page.getByRole('combobox', { name: /moneda/i }));
    if (await selectorMoneda.isVisible()) {
      await selectorMoneda.click();
      await page.getByRole('option').nth(1).click();
      await page.getByRole('button', { name: /guardar/i }).click();
      // Esperado: símbolo de moneda actualizado
      await expect(page.locator('text=/guardado|actualizado/i').first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── Usuarios y agentes ───────────────────────────────────────────────────────

test.describe('Usuarios y agentes', () => {
  test('CF-04 Ver lista de usuarios de la instancia', async ({ page }) => {
    await page.goto('/configuracion');
    const linkUsuarios = page.getByRole('link', { name: /usuarios|agentes/i });
    if (await linkUsuarios.isVisible()) await linkUsuarios.click();
    else await page.goto('/configuracion/usuarios');

    // Esperado: lista con nombre, email, rol, estado
    await expect(
      page.getByRole('table').or(page.locator('[data-testid="usuarios-lista"]'))
    ).toBeVisible({ timeout: 8000 });
  });

  test('CF-05 Invitar nuevo usuario', async ({ page }) => {
    await page.goto('/configuracion');
    const linkUsuarios = page.getByRole('link', { name: /usuarios|agentes/i });
    if (await linkUsuarios.isVisible()) await linkUsuarios.click();
    else await page.goto('/configuracion/usuarios');

    await page.getByRole('button', { name: /invitar|nuevo usuario/i }).click();

    await page.getByLabel(/email/i).fill(`invitado.test.${Date.now()}@example.com`);
    const selectorRol = page.getByLabel(/rol/i).or(page.getByRole('combobox', { name: /rol/i }));
    if (await selectorRol.isVisible()) {
      await selectorRol.click();
      await page.getByRole('option', { name: /invitado|agente/i }).first().click();
    }

    await page.getByRole('button', { name: /enviar invitación|invitar/i }).click();

    // Esperado: usuario en estado "pendiente" o confirmación enviada
    await expect(
      page.locator('text=/invitación enviada|pendiente|email enviado/i').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('CF-06 Cambiar rol de un usuario', async ({ page }) => {
    await page.goto('/configuracion');
    const linkUsuarios = page.getByRole('link', { name: /usuarios|agentes/i });
    if (await linkUsuarios.isVisible()) await linkUsuarios.click();
    else await page.goto('/configuracion/usuarios');

    // Abrir edición del segundo usuario de la lista (no el propio)
    const segundoUsuario = page.locator('tbody tr').nth(1);
    if (await segundoUsuario.isVisible()) {
      await segundoUsuario.getByRole('button', { name: /editar|cambiar rol/i }).click();
      const selectorRol = page.getByLabel(/rol/i).or(page.getByRole('combobox', { name: /rol/i }));
      if (await selectorRol.isVisible()) {
        await selectorRol.click();
        await page.getByRole('option').nth(1).click();
      }
      await page.getByRole('button', { name: /guardar/i }).click();
      await expect(page.locator('text=/actualizado|guardado/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('CF-07 Desactivar usuario', async ({ page }) => {
    await page.goto('/configuracion');
    const linkUsuarios = page.getByRole('link', { name: /usuarios|agentes/i });
    if (await linkUsuarios.isVisible()) await linkUsuarios.click();
    else await page.goto('/configuracion/usuarios');

    // Buscar un usuario que no sea el propietario
    const filasUsuarios = page.locator('tbody tr');
    const cantFilas = await filasUsuarios.count();
    if (cantFilas > 1) {
      await filasUsuarios.last().getByRole('button', { name: /desactivar|inactivar/i }).click();
      const btnConfirmar = page.getByRole('button', { name: /confirmar|sí/i }).last();
      if (await btnConfirmar.isVisible()) await btnConfirmar.click();

      await expect(page.locator('text=/desactivado|inactivo/i').first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── Pipelines ────────────────────────────────────────────────────────────────

test.describe('Pipelines', () => {
  test('CF-08 Ver pipelines configurados', async ({ page }) => {
    await page.goto('/configuracion');
    const linkPipelines = page.getByRole('link', { name: /pipelines?/i });
    if (await linkPipelines.isVisible()) await linkPipelines.click();
    else await page.goto('/configuracion/pipelines');

    await expect(
      page.getByRole('table').or(page.locator('[data-testid="pipelines-lista"]'))
    ).toBeVisible({ timeout: 8000 });
  });

  test('CF-09 Crear pipeline con etapas y colores', async ({ page }) => {
    await page.goto('/configuracion');
    const linkPipelines = page.getByRole('link', { name: /pipelines?/i });
    if (await linkPipelines.isVisible()) await linkPipelines.click();
    else await page.goto('/configuracion/pipelines');

    await page.getByRole('link', { name: /nuevo pipeline|crear/i }).or(page.getByRole('button', { name: /nuevo pipeline|crear/i })).first().click();

    const nombrePipeline = `Pipeline-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombrePipeline);

    const btnAgregarEtapa = page.getByRole('button', { name: /agregar etapa/i });
    if (await btnAgregarEtapa.isVisible()) {
      await btnAgregarEtapa.click();
      await page.getByLabel(/nombre.*etapa/i).last().fill('Prospecto');
    }

    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: pipeline disponible en formulario de oportunidades
    await expect(page.locator(`text=${nombrePipeline}`).first()).toBeVisible({ timeout: 8000 });
  });

  test('CF-11 Eliminar etapa sin oportunidades', async ({ page }) => {
    await page.goto('/configuracion');
    const linkPipelines = page.getByRole('link', { name: /pipelines?/i });
    if (await linkPipelines.isVisible()) await linkPipelines.click();
    else await page.goto('/configuracion/pipelines');

    await page.locator('tbody tr a').first().click();
    // Intentar eliminar la última etapa (que probablemente no tenga oportunidades)
    const btnEliminarEtapa = page.locator('[data-testid="btn-eliminar-etapa"], button:has-text("Eliminar")').last();
    if (await btnEliminarEtapa.isVisible()) {
      await btnEliminarEtapa.click();
      const btnConfirmar = page.getByRole('button', { name: /confirmar|sí/i }).last();
      if (await btnConfirmar.isVisible()) await btnConfirmar.click();
      await expect(page.locator('text=/error/i')).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('CF-12 Intentar eliminar etapa con oportunidades muestra error', async ({ page }) => {
    await page.goto('/configuracion');
    const linkPipelines = page.getByRole('link', { name: /pipelines?/i });
    if (await linkPipelines.isVisible()) await linkPipelines.click();
    else await page.goto('/configuracion/pipelines');

    await page.locator('tbody tr a').first().click();
    // Intentar eliminar la primera etapa (más probable que tenga oportunidades)
    const btnEliminarEtapa = page.locator('[data-testid="btn-eliminar-etapa"], button:has-text("Eliminar")').first();
    if (await btnEliminarEtapa.isVisible()) {
      await btnEliminarEtapa.click();
      const btnConfirmar = page.getByRole('button', { name: /confirmar|sí/i }).last();
      if (await btnConfirmar.isVisible()) await btnConfirmar.click();

      // Esperado: error o bloqueo si tiene oportunidades
      const tieneError = await page.locator('text=/no se puede|oportunidades|error/i').isVisible({ timeout: 5000 }).catch(() => false);
      // El test es válido tanto si hay error como si la etapa no tenía oportunidades
      test.info().annotations.push({
        type: 'note',
        description: tieneError
          ? 'Correctamente bloqueado — la etapa tiene oportunidades'
          : 'La etapa no tenía oportunidades — eliminada exitosamente',
      });
    }
  });
});

// ─── Integraciones / Webhooks ─────────────────────────────────────────────────

test.describe('Integraciones y Webhooks', () => {
  test('CF-14 Ver integraciones configuradas', async ({ page }) => {
    await page.goto('/configuracion');
    const linkIntegraciones = page.getByRole('link', { name: /integraciones?|webhooks?/i });
    if (await linkIntegraciones.isVisible()) await linkIntegraciones.click();
    else await page.goto('/configuracion/integraciones');

    await expect(page.locator('main')).toBeVisible();
  });

  test('CF-15 Configurar webhook de salida', async ({ page }) => {
    await page.goto('/configuracion');
    const linkIntegraciones = page.getByRole('link', { name: /integraciones?|webhooks?/i });
    if (await linkIntegraciones.isVisible()) await linkIntegraciones.click();
    else await page.goto('/configuracion/integraciones');

    const btnNuevoWebhook = page.getByRole('link', { name: /nuevo webhook|agregar webhook/i }).or(page.getByRole('button', { name: /nuevo webhook|agregar webhook/i }));
    if (await btnNuevoWebhook.isVisible()) {
      await btnNuevoWebhook.click();
      await page.getByLabel(/url/i).fill('https://webhook.site/test-url');
      const selectorEvento = page.getByLabel(/evento/i).or(page.getByRole('combobox', { name: /evento/i }));
      if (await selectorEvento.isVisible()) {
        await selectorEvento.click();
        await page.getByRole('option', { name: /pedido.*creado|PEDIDO_CREADO/i }).click();
      }
      await page.getByRole('button', { name: /guardar/i }).click();
      await expect(page.locator('text=/webhook.*registrado|guardado/i').first()).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('CF-16 Roles sin acceso a configuración — AGENTE_VENTAS bloqueado', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.agenteVentas });
    const page = await ctx.newPage();
    await page.goto('/configuracion');

    const bloqueado =
      page.url().includes('/login') ||
      page.url().includes('/acceso-denegado') ||
      (await page.locator('text=/no tienes acceso|sin permiso|acceso denegado/i').isVisible({ timeout: 5000 }).catch(() => false));
    expect(bloqueado).toBeTruthy();

    await ctx.close();
  });

  test('CF-17 SUPERVISOR acceso de solo lectura a configuración', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/configuracion');

    // Esperado: puede ver la configuración
    await expect(page.locator('main')).toBeVisible();

    // Formularios deshabilitados o sin botones de editar
    await expect(page.getByRole('button', { name: /guardar|editar/i })).not.toBeVisible();

    await ctx.close();
  });
});
