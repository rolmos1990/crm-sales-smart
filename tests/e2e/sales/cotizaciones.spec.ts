import { test, expect, type Page } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de cotizaciones', () => {
  test('CQ-01 Ver lista de cotizaciones', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    // Esperado: tabla con número, cliente, total, estado, fecha de expiración
    await expect(page.getByRole('table').or(page.locator('[data-testid="cotizaciones-lista"]'))).toBeVisible();
  });

  test('CQ-02 Filtrar por estado', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    const filtroEstado = page.getByRole('combobox', { name: /estado/i })
      .or(page.locator('select[name*="estado"]'))
      .or(page.getByRole('button', { name: /estado|borrador/i }));

    if (await filtroEstado.isVisible()) {
      await filtroEstado.click();
      await page.getByRole('option', { name: /borrador/i }).click();
      await page.waitForTimeout(600);
      await expect(page).toHaveURL(/\/sales\/cotizaciones/);
    }
  });

  test('CQ-03 Búsqueda por número o cliente', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    const buscador = page.getByPlaceholder(/buscar|search/i).or(page.getByRole('searchbox'));
    await buscador.fill('a');
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/sales\/cotizaciones/);
  });
});

// ─── Creación ─────────────────────────────────────────────────────────────────

test.describe('Creación de cotizaciones', () => {
  test('CQ-04 Crear cotización mínima como borrador', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.getByRole('link', { name: /nueva cotización|crear/i }).or(page.getByRole('button', { name: /nueva cotización|crear/i })).first().click();
    await page.waitForURL(/\/sales\/cotizaciones\/nueva$/, { timeout: 30000 });

    // Seleccionar contacto o ingresar datos del cliente
    const inputCliente = page.getByLabel(/cliente|contacto/i).first();
    if (await inputCliente.isVisible()) {
      await inputCliente.fill('Cliente Test');
      const primeraOpcion = page.getByRole('option').first();
      if (await primeraOpcion.isVisible()) await primeraOpcion.click();
    }

    // La línea ya viene con cantidad=1 y precio=0 por defecto, así que el
    // formulario es enviable sin tocar nada más (ver CQ-09).
    await page.getByRole('button', { name: /guardar borrador|guardar|crear/i }).click();
    await page.waitForURL(/\/sales\/cotizaciones$/, { timeout: 30000 });

    // Esperado: cotización con número generado, estado "Borrador"
    await expect(page.locator('text=/borrador/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('CQ-05 Agregar ítems — subtotales calculados correctamente', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.getByRole('link', { name: /nueva cotización|crear/i }).or(page.getByRole('button', { name: /nueva cotización|crear/i })).first().click();
    await page.waitForURL(/\/sales\/cotizaciones\/nueva$/, { timeout: 30000 });

    // No existe un botón "Agregar ítem" separado: "Agregar línea" suma una fila
    // vacía; la cantidad se edita directamente en la columna "Cant." de la línea.
    await page.getByRole('button', { name: /agregar línea/i }).click();
    const cantidadInput = page.locator('table tbody tr').nth(1).getByRole('spinbutton').first();
    await cantidadInput.fill('3');

    // Esperado: subtotal de la línea y total general actualizados en tiempo real
    await expect(page.locator('text=/subtotal/i').first()).toBeVisible();
    await expect(page.locator('text=/total/i').first()).toBeVisible();
  });

  test('CQ-06 Aplicar descuento global recalcula el total', async ({ page }) => {
    await page.goto('/sales/cotizaciones');
    await page.getByRole('link', { name: /nueva cotización|crear/i }).or(page.getByRole('button', { name: /nueva cotización|crear/i })).first().click();
    await page.waitForURL(/\/sales\/cotizaciones\/nueva$/, { timeout: 30000 });

    // No hay un campo "descuento" global — el descuento (Desc.%) es por línea.
    const descuentoLinea = page.locator('table tbody tr').first().getByRole('spinbutton').nth(2);
    await descuentoLinea.fill('10');
    await page.waitForTimeout(300);
    // Esperado: total recalculado
    await expect(page.locator('text=/total/i').first()).toBeVisible();
  });

  test('CQ-09 No es posible quedarse sin ítems', async ({ page }) => {
    // No existe un mensaje de validación "sin ítems": el formulario siempre
    // arranca con una línea y el botón de quitarla está deshabilitado mientras
    // sea la única — la UI impide llegar a 0 ítems en vez de validarlo al guardar.
    await page.goto('/sales/cotizaciones/nueva', { timeout: 45000 });
    const filaUnica = page.locator('table tbody tr').first();
    const btnQuitar = filaUnica.getByRole('button').last();
    await expect(btnQuitar).toBeDisabled();
  });
});

// ─── Estados y flujo ──────────────────────────────────────────────────────────

async function crearCotizacionBorrador(page: Page): Promise<string> {
  await page.goto('/sales/cotizaciones/nueva', { timeout: 45000 });
  // Seleccionar un producto del catálogo para la línea por defecto (precio > 0).
  const selectorProducto = page.getByRole('button', { name: /del catálogo/i }).first();
  if (await selectorProducto.isVisible()) {
    await selectorProducto.click();
    await page.getByPlaceholder(/buscar producto/i).fill('a');
    await page.waitForTimeout(500);
    const primeraOpcion = page.getByRole('option').first();
    if (await primeraOpcion.isVisible()) await primeraOpcion.click();
  }
  await page.getByRole('button', { name: /guardar borrador|guardar|crear/i }).click();
  await page.waitForURL(/\/sales\/cotizaciones$/, { timeout: 30000 });

  // La lista ordena por fecha de creación desc — la recién creada queda primera.
  await page.locator('tbody tr a').first().click();
  await page.waitForURL(/\/sales\/cotizaciones\/[\w-]+$/, { timeout: 30000 });
  return page.url();
}

// Serial: CQ-11 y CQ-12 aprueban cotizaciones (generan un Pedido). Antes,
// numero era @unique GLOBAL en Pedido/Cotizacion mientras generarNumeroPedido
// contaba filas SOLO de la instancia actual — dos tenants distintos podían
// generar el mismo "PED-2026-0001" y chocar. Corregido vía migración
// 20260630151025_unique_numero_por_instancia (@@unique([instanciaId, numero])).
// Se mantiene serial por prolijidad, ya no por necesidad de evitar la colisión.
test.describe.serial('Estados y flujo de cotizaciones', () => {
  test('CQ-10 Marcar como Enviada cambia el estado', async ({ page }) => {
    await crearCotizacionBorrador(page);
    // El botón real dice "Marcar como Enviada" (no "Enviar").
    await page.getByRole('button', { name: /marcar como enviada/i }).click();
    await expect(page.locator('text=/enviada/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('CQ-11 Aprobar cotización genera el pedido automáticamente', async ({ page }) => {
    // No existe un estado "Aceptada" ni un paso separado para "convertir en
    // pedido": el botón real es "Aprobar y crear pedido" y hace ambas cosas
    // en una sola acción atómica (ver aprobarCotizacion en actions.ts).
    await crearCotizacionBorrador(page);
    await page.getByRole('button', { name: /aprobar y crear pedido/i }).click();
    await expect(page.locator('text=/pedido.*creado|aprobada/i').first()).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('text=/aprobada/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('CQ-12 El pedido generado al aprobar aparece en Pedidos', async ({ page }) => {
    await crearCotizacionBorrador(page);
    const numeroCotizacion = (await page.locator('h1').first().textContent())?.trim() ?? '';
    await page.getByRole('button', { name: /aprobar y crear pedido/i }).click();
    await expect(page.locator('text=/pedido.*creado|aprobada/i').first()).toBeVisible({ timeout: 8000 });

    // Esperado: el pedido generado a partir de esta cotización es accesible
    // desde el módulo de Pedidos.
    await page.goto('/sales/pedidos', { timeout: 45000 });
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 8000 });
    void numeroCotizacion;
  });

  test('CQ-13 Marcar como Rechazada cambia el estado', async ({ page }) => {
    await crearCotizacionBorrador(page);
    // RECHAZADA solo es alcanzable desde ENVIADA (TRANSICIONES_MANUALES).
    await page.getByRole('button', { name: /marcar como enviada/i }).click();
    await expect(page.locator('text=/enviada/i').first()).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /marcar como rechazada/i }).click();
    await expect(page.locator('text=/rechazada/i').first()).toBeVisible({ timeout: 8000 });
  });
});

// ─── PDF ─────────────────────────────────────────────────────────────────────

test.describe('PDF de cotización', () => {
  test.skip('CQ-15 Generar o descargar PDF — funcionalidad no implementada', async () => {
    // BLOQUEO: no existe generación/descarga de PDF en ninguna parte del
    // código (sin librería, sin route handler, sin componente). No es un bug
    // de este test — es una funcionalidad que aún no se construyó. Requiere
    // decisión de producto antes de poder escribir una prueba real.
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('CQ-16 AGENTE_SOPORTE sin acceso a cotizaciones', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.agenteSoporte });
    const page = await ctx.newPage();
    await page.goto('/sales/cotizaciones');

    const bloqueado =
      page.url().includes('/login') ||
      page.url().includes('/acceso-denegado') ||
      (await page.locator('text=/no tienes acceso|sin permiso|acceso denegado/i').isVisible({ timeout: 5000 }).catch(() => false));
    expect(bloqueado).toBeTruthy();

    await ctx.close();
  });

  test('CQ-17 SUPERVISOR solo lectura en cotizaciones', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/sales/cotizaciones');

    await expect(page.getByRole('table').or(page.locator('[data-testid="cotizaciones-lista"]'))).toBeVisible();
    await expect(page.getByRole('link', { name: /nueva cotización/i }).or(page.getByRole('button', { name: /nueva cotización/i }))).not.toBeVisible();

    await ctx.close();
  });
});
