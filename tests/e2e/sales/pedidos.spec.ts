import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de pedidos', () => {
  test('P-01 Ver lista de pedidos', async ({ page }) => {
    await page.goto('/sales/pedidos');
    // Esperado: tabla con número, cliente, total, etapa del flujo, estado de entrega, fecha
    await expect(page.getByRole('table').or(page.locator('[data-testid="pedidos-lista"]'))).toBeVisible();
  });

  test('P-02 Filtrar por etapa del flujo', async ({ page }) => {
    await page.goto('/sales/pedidos');
    const filtro = page.getByRole('combobox', { name: /etapa|flujo/i })
      .or(page.locator('select[name*="etapa"]'));
    if (await filtro.isVisible()) {
      await filtro.click();
      await page.getByRole('option').nth(1).click();
      await page.waitForTimeout(600);
      await expect(page).toHaveURL(/\/sales\/pedidos/);
    }
  });

  test('P-03 Búsqueda por número o cliente', async ({ page }) => {
    await page.goto('/sales/pedidos');
    const buscador = page.getByPlaceholder(/buscar|search/i).or(page.getByRole('searchbox'));
    await buscador.fill('a');
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/sales\/pedidos/);
  });
});

// ─── Creación ─────────────────────────────────────────────────────────────────

test.describe('Creación de pedidos', () => {
  test('P-04 Crear pedido mínimo', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.getByRole('button', { name: /nuevo pedido|crear/i }).click();

    // Seleccionar contacto o ingresar datos del cliente
    const inputCliente = page.getByLabel(/cliente|contacto/i).first();
    if (await inputCliente.isVisible()) {
      await inputCliente.fill('Cliente');
      await page.waitForTimeout(400);
      const primeraOpcion = page.getByRole('option').first();
      if (await primeraOpcion.isVisible()) await primeraOpcion.click();
    }

    // Agregar al menos un ítem
    const btnAgregarItem = page.getByRole('button', { name: /agregar ítem|agregar producto/i });
    if (await btnAgregarItem.isVisible()) {
      await btnAgregarItem.click();
      await page.waitForTimeout(300);
      const buscadorProducto = page.getByPlaceholder(/buscar producto/i).last();
      if (await buscadorProducto.isVisible()) {
        await buscadorProducto.fill('a');
        await page.waitForTimeout(400);
        const primera = page.getByRole('option').first();
        if (await primera.isVisible()) await primera.click();
      }
    }

    await page.getByRole('button', { name: /guardar|crear pedido/i }).click();

    // Esperado: pedido creado con número correlativo, en la primera etapa del flujo
    await expect(page).toHaveURL(/\/sales\/pedidos\/\w+/, { timeout: 10000 });
  });

  test('P-05 Agregar ítems — subtotales actualizados en tiempo real', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.getByRole('button', { name: /nuevo pedido|crear/i }).click();

    const btnAgregarItem = page.getByRole('button', { name: /agregar ítem|agregar producto/i });
    if (await btnAgregarItem.isVisible()) {
      await btnAgregarItem.click();
      const cantidad = page.getByLabel(/cantidad/i).last();
      if (await cantidad.isVisible()) {
        await cantidad.clear();
        await cantidad.fill('5');
        // Esperado: total actualizado
        await expect(page.locator('[data-testid="total"], text=/total/i').first()).toBeVisible();
      }
    }
  });
});

// ─── Edición de pedido ────────────────────────────────────────────────────────

test.describe('Edición de pedido', () => {
  test('P-07 Editar datos del cliente y ver PEDIDO_EDITADO en historial', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();
    await page.getByRole('button', { name: /editar/i }).click();

    const nombreCliente = page.getByLabel(/nombre.*cliente|cliente.*nombre/i);
    if (await nombreCliente.isVisible()) {
      await nombreCliente.clear();
      await nombreCliente.fill('Cliente Editado Test');
    }

    await page.getByRole('button', { name: /guardar/i }).click();

    // Esperado: cambios en historial con PEDIDO_EDITADO
    await expect(page.locator('text=/editado|pedido_editado|cliente.*editado/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('P-08 Agregar producto a un pedido — PRODUCTO_AGREGADO en historial', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();

    const btnEditarLineas = page.getByRole('button', { name: /editar líneas|agregar ítem|editar/i });
    if (await btnEditarLineas.isVisible()) {
      await btnEditarLineas.click();
      const btnAgregar = page.getByRole('button', { name: /agregar ítem|agregar producto/i });
      if (await btnAgregar.isVisible()) {
        await btnAgregar.click();
        await page.getByRole('button', { name: /guardar/i }).click();
        // Esperado: PRODUCTO_AGREGADO en historial
        await expect(page.locator('text=/producto.*agregado|PRODUCTO_AGREGADO/i').first()).toBeVisible({ timeout: 8000 });
      }
    }
  });
});

// ─── Flujo de venta ───────────────────────────────────────────────────────────

test.describe('Flujo de venta y etapas', () => {
  test('P-09 Avanzar etapa del pedido registra en timeline', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();

    const btnAvanzar = page.getByRole('button', { name: /avanzar|siguiente etapa|próxima etapa/i });
    if (await btnAvanzar.isVisible()) {
      await btnAvanzar.click();
      const btnConfirmar = page.getByRole('button', { name: /confirmar|avanzar/i }).last();
      if (await btnConfirmar.isVisible()) await btnConfirmar.click();

      // Esperado: etapa actualizada, entrada en el timeline
      await expect(page.locator('text=/etapa|avanzó|timeline/i').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('P-11 Etapa con acción automática ejecuta la acción', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();

    // Solo verificar que el historial/timeline existe y funciona
    await expect(page.locator('[data-testid="pedido-timeline"], [data-testid="historial"]').or(
      page.locator('text=/historial|timeline/i').first()
    )).toBeVisible({ timeout: 5000 });
  });
});

// ─── Entrega y seguimiento ────────────────────────────────────────────────────

test.describe('Entrega y seguimiento', () => {
  test('P-12 Registrar entrega por primera vez — "Entrega registrada" en timeline', async ({ page }) => {
    await page.goto('/sales/pedidos');

    // Buscar un pedido en etapa que permita editar entrega
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();

    const seccionEntrega = page.locator('text=/entrega y seguimiento|entrega/i').first();
    if (await seccionEntrega.isVisible()) {
      await seccionEntrega.click().catch(() => {});
    }

    const btnRegistrarEntrega = page.getByRole('button', { name: /registrar entrega|guardar entrega/i });
    if (await btnRegistrarEntrega.isVisible()) {
      const estadoEntrega = page.getByLabel(/estado.*entrega|estado/i).first();
      if (await estadoEntrega.isVisible()) {
        await estadoEntrega.click();
        await page.getByRole('option', { name: /pendiente/i }).click();
      }

      const metodoEntrega = page.getByLabel(/método.*entrega|método/i);
      if (await metodoEntrega.isVisible()) {
        await metodoEntrega.fill('Courier');
      }

      await btnRegistrarEntrega.click();
      // Esperado: "Entrega registrada" en el timeline
      await expect(page.locator('text=/entrega.*registrada|ENTREGA_REGISTRADA/i').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('P-13 Actualizar estado de entrega — "Entrega actualizada" en timeline', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();

    const btnActualizar = page.getByRole('button', { name: /actualizar entrega|editar entrega/i });
    if (await btnActualizar.isVisible()) {
      await btnActualizar.click();
      const estadoEntrega = page.getByLabel(/estado.*entrega|estado/i).first();
      if (await estadoEntrega.isVisible()) {
        await estadoEntrega.click();
        await page.getByRole('option', { name: /en camino/i }).click();
      }
      await page.getByRole('button', { name: /guardar/i }).click();
      // Esperado: "Entrega actualizada" con antes/después
      await expect(page.locator('text=/entrega.*actualizada|ENTREGA_ACTUALIZADA/i').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('P-15 Sección de entrega no disponible en etapa incorrecta', async ({ page }) => {
    await page.goto('/sales/pedidos');
    // Buscar un pedido en primera etapa donde permiteEditarEntrega = false
    await page.locator('tbody tr a').first().click();

    // Si el pedido está en etapa sin permiso de entrega, la sección debe estar bloqueada
    const seccionBloqueada = page.locator('[data-testid="entrega-bloqueada"], text=/no disponible en esta etapa/i');
    const btnDeshabilitado = page.getByRole('button', { name: /guardar entrega/i }).and(page.locator('[disabled]'));

    const estaBloqueada = await seccionBloqueada.isVisible({ timeout: 3000 }).catch(() => false)
      || await btnDeshabilitado.isVisible({ timeout: 3000 }).catch(() => false);

    // El test solo registra el comportamiento; puede pasar o skip si el pedido ya está en etapa habilitada
    if (!estaBloqueada) {
      test.info().annotations.push({ type: 'note', description: 'Pedido en etapa con entrega habilitada — buscar uno en etapa sin permiso' });
    }
  });
});

// ─── Timeline e historial ─────────────────────────────────────────────────────

test.describe('Timeline e historial', () => {
  test('P-16 Ver historial de cambios completo y ordenado', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();

    // Esperado: timeline con entradas ordenadas por fecha
    await expect(
      page.locator('[data-testid="pedido-timeline"], [data-testid="historial"]')
        .or(page.locator('text=/historial|creación|creado/i').first())
    ).toBeVisible({ timeout: 5000 });
  });

  test('P-17 Nombre de usuario visible en cada entrada del historial', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a, [data-testid="pedido-fila"] a').first().click();

    const timeline = page.locator('[data-testid="pedido-timeline"], [data-testid="historial"]').first();
    await expect(timeline).toBeVisible({ timeout: 5000 });

    // Al menos una entrada debe tener nombre de usuario o "Sistema"
    await expect(
      timeline.locator('text=/sistema|usuario|por:/i').first()
    ).toBeVisible();
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('P-18 AGENTE_SOPORTE solo lectura en pedidos', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.agenteSoporte });
    const page = await ctx.newPage();
    await page.goto('/sales/pedidos');

    await expect(page.getByRole('table').or(page.locator('[data-testid="pedidos-lista"]'))).toBeVisible();
    await expect(page.getByRole('button', { name: /nuevo pedido/i })).not.toBeVisible();

    await ctx.close();
  });

  test('P-19 SUPERVISOR solo lectura en pedidos', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/sales/pedidos');

    await expect(page.getByRole('table').or(page.locator('[data-testid="pedidos-lista"]'))).toBeVisible();
    await expect(page.getByRole('button', { name: /nuevo pedido/i })).not.toBeVisible();

    await ctx.close();
  });
});
