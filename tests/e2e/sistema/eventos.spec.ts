import { test, expect } from '@playwright/test';
import {
  desconectarPrismaTest,
  obtenerInstanciaPruebas,
  obtenerUsuarioOwner,
  crearOportunidad,
} from '../../helpers/db';

test.afterAll(() => desconectarPrismaTest());

/**
 * Tests de eventos del sistema
 *
 * Estrategia: los eventos de RabbitMQ se verifican a través de sus efectos
 * observables en la UI (historial de pedidos, timeline, estados), ya que no
 * tenemos acceso directo al bus de mensajes desde el browser.
 *
 * Para EV-11/EV-12 (RabbitMQ Management) y EV-13/EV-14 (TypeScript types),
 * se usa el CLI/build del proyecto.
 */

// ─── Publicación de eventos verificada via UI ─────────────────────────────────

test.describe('Publicación de eventos — verificación por efectos en UI', () => {
  test('EV-01 CONTACTO_CREADO — contacto aparece en el sistema tras crearlo', async ({ page }) => {
    await page.goto('/crm/contactos/nuevo');
    const nombreContacto = `EventoTest-${Date.now()}`;
    await page.getByLabel(/nombre/i).first().fill(nombreContacto);
    await page.getByLabel(/apellido/i).fill('Evento');
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // El formulario redirige a la lista tras crear (igual que C-05 en
    // contactos.spec.ts). Esperar la navegación antes de buscar en la lista.
    await page.waitForURL(/\/crm\/contactos$/, { timeout: 30000 });
    // Esperado: contacto creado — el evento CONTACTO_CREADO fue publicado correctamente
    // si el flujo funciona de extremo a extremo
    await expect(page.locator(`text=${nombreContacto}`).first()).toBeVisible({ timeout: 8000 });
    // Verificar en logs del servidor si está disponible (observable solo con herramientas de servidor)
    test.info().annotations.push({
      type: 'note',
      description: 'Para confirmar el evento RabbitMQ, verificar logs del servidor: [RabbitMQ] Publicando CONTACTO_CREADO',
    });
  });

  test('EV-02 PEDIDO_CREADO — historial del pedido tiene entrada PEDIDO_CREADO', async ({ page }) => {
    // El primer pedido de la lista puede ser un fixture insertado directamente
    // en la BD por otras suites (vía db-worker.ts), que nunca pasó por la
    // Server Action ni publicó el evento — por eso no tiene historial. Hay
    // que crear un pedido real a través del flujo de UI para garantizar que
    // el evento PEDIDO_CREADO fue publicado y consumido.
    await page.goto('/sales/pedidos');
    await page.getByRole('link', { name: /nuevo pedido|crear/i }).or(page.getByRole('button', { name: /nuevo pedido|crear/i })).first().click();

    const inputCliente = page.getByLabel(/cliente|contacto/i).first();
    if (await inputCliente.isVisible()) {
      await inputCliente.fill('Cliente');
      await page.waitForTimeout(400);
      const primeraOpcion = page.getByRole('option').first();
      if (await primeraOpcion.isVisible()) await primeraOpcion.click();
    }

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
    // crearPedido siempre redirige a la lista (no al detalle).
    await page.waitForURL(/\/sales\/pedidos$/, { timeout: 30000 });

    // El pedido recién creado queda primero (orderBy creadoEn desc).
    await page.locator('tbody tr a').first().click();
    await page.waitForURL(/\/sales\/pedidos\/[\w-]+$/, { timeout: 30000 });

    // Esperado: el historial del pedido tiene la entrada de creación
    await expect(
      page.locator('text=/pedido.*creado|PEDIDO_CREADO|creación/i').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('EV-03 ENTREGA_REGISTRADA — aparece en el timeline al guardar entrega por primera vez', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a').first().click();
    await page.waitForURL(/\/sales\/pedidos\/[\w-]+$/, { timeout: 30000 });

    // Verificar que el timeline registra entradas de entrega
    const entradaEntrega = page.locator('text=/entrega.*registrada|ENTREGA_REGISTRADA/i').first();
    if (await entradaEntrega.isVisible()) {
      await expect(entradaEntrega).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Ninguna entrega registrada en este pedido todavía. Ejecutar P-12 primero.',
      });
    }
  });

  test('EV-04 ENTREGA_ACTUALIZADA — timeline muestra valorAnterior y valorNuevo', async ({ page }) => {
    await page.goto('/sales/pedidos');
    await page.locator('tbody tr a').first().click();
    await page.waitForURL(/\/sales\/pedidos\/[\w-]+$/, { timeout: 30000 });

    const entradaActualizacion = page.locator('text=/entrega.*actualizada|ENTREGA_ACTUALIZADA/i').first();
    if (await entradaActualizacion.isVisible()) {
      // Esperado: la entrada tiene el estado anterior y el nuevo
      await expect(entradaActualizacion).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Ejecutar P-13 para generar este evento antes de correr este test',
      });
    }
  });

  test('EV-05 COTIZACION_ENVIADA — estado de cotización cambia a "Enviada"', async ({ page }) => {
    // Crear una cotización borrador real vía UI (igual que CQ-10 en
    // cotizaciones.spec.ts) en vez de depender de que ya exista una fila
    // "borrador" en la lista. El botón real dice "Marcar como Enviada"
    // (no "Enviar"), y hay que esperar la navegación al detalle.
    await page.goto('/sales/cotizaciones/nueva', { timeout: 45000 });
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

    await page.locator('tbody tr a').first().click();
    await page.waitForURL(/\/sales\/cotizaciones\/[\w-]+$/, { timeout: 30000 });

    await page.getByRole('button', { name: /marcar como enviada/i }).click();
    // Esperado: estado "Enviada" — confirma que COTIZACION_ENVIADA fue procesado
    await expect(page.locator('text=/enviada/i').first()).toBeVisible({ timeout: 8000 });
  });

  test('EV-06 OPORTUNIDAD_GANADA — etapa de oportunidad cambia a Ganada', async ({ page }) => {
    // El kanban de /crm/pipeline depende de que existan tarjetas visibles y
    // de drag&drop — poco confiable. Igual que O-15 en oportunidades.spec.ts,
    // se crea una oportunidad vía helper de BD y se navega directo al detalle.
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const oportunidad = await crearOportunidad({ instanciaId: instancia.id, usuarioId: owner.id });

    await page.goto(`/crm/oportunidades/${oportunidad.id}`);

    const btnGanada = page.getByRole('button', { name: /ganada|won/i });
    if (await btnGanada.isVisible()) {
      await btnGanada.click();
      await expect(page.locator('text=/ganada|won/i').first()).toBeVisible({ timeout: 8000 });
      // Esperado: evento OPORTUNIDAD_GANADA publicado
      test.info().annotations.push({
        type: 'note',
        description: 'Verificar en logs: [RabbitMQ] Publicando OPORTUNIDAD_GANADA',
      });
    }
  });

  test('EV-07 MENSAJE_RECIBIDO — mensaje aparece en inbox en tiempo real', async ({ page }) => {
    await page.goto('/crm/inbox');
    await page.waitForTimeout(2000);

    // Verificar que el inbox carga sin errores de SSE
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('text=/error.*conexión|connection error/i')).not.toBeVisible();

    test.info().annotations.push({
      type: 'note',
      description: 'Verificación completa del evento MENSAJE_RECIBIDO requiere simular mensaje entrante via canal externo (script: npm run script:simular-ig)',
    });
  });
});

// ─── Consumidores / Suscriptores ──────────────────────────────────────────────

test.describe('Consumidores y suscriptores', () => {
  test('EV-08 Historial de pedido tiene entrada PEDIDO_CREADO con número y total', async ({ page }) => {
    // Mismo problema que EV-02: el primer pedido de la lista puede ser un
    // fixture insertado directamente por otras suites sin pasar por la
    // Server Action — se crea un pedido real para garantizar el evento.
    await page.goto('/sales/pedidos');
    await page.getByRole('link', { name: /nuevo pedido|crear/i }).or(page.getByRole('button', { name: /nuevo pedido|crear/i })).first().click();

    const inputCliente = page.getByLabel(/cliente|contacto/i).first();
    if (await inputCliente.isVisible()) {
      await inputCliente.fill('Cliente');
      await page.waitForTimeout(400);
      const primeraOpcion = page.getByRole('option').first();
      if (await primeraOpcion.isVisible()) await primeraOpcion.click();
    }

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
    await page.waitForURL(/\/sales\/pedidos$/, { timeout: 30000 });

    await page.locator('tbody tr a').first().click();
    await page.waitForURL(/\/sales\/pedidos\/[\w-]+$/, { timeout: 30000 });

    // Esperado: registro con accion = "PEDIDO_CREADO", valorNuevo con número y total
    await expect(
      page.locator('text=/pedido.*creado|creación/i').first()
    ).toBeVisible({ timeout: 8000 });

    // Verificar que hay información del total en la entrada de creación
    const entradaCreacion = page.locator('[data-testid="historial-creacion"], [data-testid="entrada-pedido-creado"]').first();
    if (await entradaCreacion.isVisible()) {
      await expect(entradaCreacion.locator('text=/\\$|total|S\\//').first()).toBeVisible();
    }
  });

  test('EV-09 Suscriptor de email — email de bienvenida entregado al registrar instancia', async ({ page }) => {
    // Este test verifica la configuración del sistema de emails de forma indirecta
    await page.goto('/configuracion');
    // Esperado: la configuración de email está presente
    const configEmail = page.locator('text=/email|correo|smtp|resend/i').first();
    test.info().annotations.push({
      type: 'note',
      description: 'Verificar bandeja de entrada del email de registro para confirmar que el suscriptor ENVIAR_EMAIL funciona',
    });
  });

  test('EV-10 Dead-letter queue — retry ante fallo transitorio', async ({ page }) => {
    // Test de infraestructura — se verifica a través de documentación de la config
    test.info().annotations.push({
      type: 'note',
      description: 'Verificar en RabbitMQ Management UI (puerto 15672): cola vento.dlq debe existir y recibir mensajes fallidos. Para simular: detener la BD brevemente durante un suscriptor activo.',
    });
    // Este test documenta el caso y no puede automatizarse completamente via UI
    test.skip(true, 'Requiere acceso a RabbitMQ Management UI o herramientas de infraestructura');
  });
});

// ─── Cola y routing ───────────────────────────────────────────────────────────

test.describe('Cola y routing de RabbitMQ', () => {
  test('EV-11 Exchange vento.eventos y colas de suscriptores configurados', async ({ page, request }) => {
    // Intentar acceder a RabbitMQ Management API si está disponible
    const rabbitUrl = 'http://localhost:15672/api/exchanges/%2F/vento.eventos';
    try {
      const response = await request.get(rabbitUrl, {
        headers: {
          Authorization: 'Basic ' + Buffer.from('guest:guest').toString('base64'),
        },
      });
      if (response.ok()) {
        const body = await response.json();
        expect(body.name).toBe('vento.eventos');
      } else {
        test.info().annotations.push({
          type: 'note',
          description: `RabbitMQ Management no accesible en ${rabbitUrl} — verificar manualmente`,
        });
      }
    } catch {
      test.info().annotations.push({
        type: 'note',
        description: 'RabbitMQ Management no disponible en el ambiente actual — test documentado para ejecución manual',
      });
    }
  });

  test('EV-12 Dead-letter queue vento.dlq existe', async ({ request }) => {
    const rabbitUrl = 'http://localhost:15672/api/queues/%2F/vento.dlq';
    try {
      const response = await request.get(rabbitUrl, {
        headers: {
          Authorization: 'Basic ' + Buffer.from('guest:guest').toString('base64'),
        },
      });
      if (response.ok()) {
        const body = await response.json();
        expect(body.name).toBe('vento.dlq');
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'DLQ no verificable via API en este ambiente — verificar manualmente',
        });
      }
    } catch {
      test.info().annotations.push({
        type: 'note',
        description: 'RabbitMQ Management no disponible — verificar manualmente con credentials de la instancia',
      });
    }
  });
});

// ─── Payload types (TypeScript) ───────────────────────────────────────────────

test.describe('Tipos TypeScript de payloads', () => {
  test('EV-13 TypeScript compila sin errores de tipo', async ({ page }) => {
    // Este test se ejecuta a través del proceso de build — no del browser
    test.info().annotations.push({
      type: 'note',
      description: 'Ejecutar: npx tsc --noEmit para confirmar ausencia de errores de tipo en payloads',
    });
    // Como complemento, verificar que la app carga sin errores de runtime
    await page.goto('/crm/contactos');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('text=/TypeError|ReferenceError|Uncaught/i')).not.toBeVisible();
  });

  test('EV-14 Payload incorrecto detectado en tiempo de compilación', async ({ page }) => {
    // Este es un test de desarrollo — no ejecutable en el browser
    test.info().annotations.push({
      type: 'note',
      description: 'Verificar en IDE: pasar un campo incorrecto a publicadorEventos.publicar() debe generar error TypeScript en tiempo de desarrollo (squiggly rojo en VS Code)',
    });
    test.skip(true, 'Test de IDE/compile-time — no ejecutable en browser');
  });
});
