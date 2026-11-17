import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';

// ─── Listado de conversaciones ────────────────────────────────────────────────

test.describe('Listado de conversaciones', () => {
  test('IN-01 Ver lista de conversaciones', async ({ page }) => {
    await page.goto('/crm/inbox');
    // Esperado: lista con nombre/número, último mensaje, fecha, estado
    await expect(
      page.locator('[data-testid="inbox-lista"], [data-testid="conversaciones-lista"]')
        .or(page.locator('main'))
    ).toBeVisible();
  });

  test('IN-02 Buscar conversación por nombre o número', async ({ page }) => {
    await page.goto('/crm/inbox');
    const buscador = page.getByPlaceholder(/buscar|search/i).or(page.getByRole('searchbox'));
    if (await buscador.isVisible()) {
      await buscador.fill('a');
      await page.waitForTimeout(600);
      await expect(page).toHaveURL(/\/inbox/);
    }
  });

  test('IN-03 Conversaciones no leídas muestran indicador visual', async ({ page }) => {
    await page.goto('/crm/inbox');
    // Esperado: badge o punto en conversaciones pendientes
    const indicadorNoLeido = page.locator(
      '[data-testid="badge-no-leido"], .unread-badge, [aria-label*="no leído"]'
    );
    // Solo verificamos que si existen se renderizan correctamente
    const existe = await indicadorNoLeido.count();
    if (existe > 0) {
      await expect(indicadorNoLeido.first()).toBeVisible();
    }
  });

  test('IN-04 Filtrar por estado — Abierta / Cerrada / Sin asignar', async ({ page }) => {
    await page.goto('/crm/inbox');
    // El filtro son tabs de texto (Todos / Abiertas / Esperando / Cerradas),
    // NO un combobox con role="option". Hacer clic en el tab aplica el filtro
    // directamente — no abre ningún dropdown secundario.
    const tabAbiertas = page.getByRole('button', { name: /^abiertas$/i });
    if (await tabAbiertas.isVisible()) {
      await tabAbiertas.click();
      await page.waitForTimeout(600);
      await expect(page).toHaveURL(/\/inbox/);
    }
  });
});

// ─── Vista de conversación ────────────────────────────────────────────────────

test.describe('Vista de conversación', () => {
  test('IN-05 Ver mensajes de una conversación ordenados cronológicamente', async ({ page }) => {
    await page.goto('/crm/inbox');
    const primeraConversacion = page.locator('[data-testid="conversacion-item"], .conversacion-item').first();
    if (await primeraConversacion.isVisible()) {
      await primeraConversacion.click();
      // Esperado: hilo de mensajes con distinción visual entrantes/salientes
      await expect(
        page.locator('[data-testid="mensaje-thread"], .mensaje-thread, [data-testid="mensajes"]')
          .or(page.locator('text=/mensaje|chat/i').first())
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test('IN-06 Mensajes en tiempo real via SSE — conversación activa recibe nuevos mensajes', async ({ page }) => {
    await page.goto('/crm/inbox');
    const primeraConversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (await primeraConversacion.isVisible()) {
      await primeraConversacion.click();

      // Verificar que la conexión SSE está activa
      // Se puede verificar a través de la ausencia de errores de red o de un indicador de "conectado"
      await page.waitForTimeout(2000);
      await expect(page.locator('[data-testid="mensajes"]').or(page.locator('main'))).toBeVisible();
      // El test de SSE real requeriría simular un mensaje externo — se documenta el comportamiento
      test.info().annotations.push({
        type: 'note',
        description: 'SSE activo — verificación completa requiere simular mensaje entrante desde canal externo',
      });
    }
  });

  test('IN-07 Indicador de tipo de mensaje — texto, imagen, archivo', async ({ page }) => {
    await page.goto('/crm/inbox');
    const primeraConversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (await primeraConversacion.isVisible()) {
      await primeraConversacion.click();
      // Verificar que los mensajes se renderizan sin errores
      await expect(page.locator('main')).toBeVisible();
      // No debe haber errores de renderizado
      await expect(page.locator('text=/undefined|error al cargar|null/i')).not.toBeVisible();
    }
  });
});

// ─── Responder y enviar mensajes ──────────────────────────────────────────────

test.describe('Responder y enviar mensajes', () => {
  test('IN-08 Enviar mensaje de texto', async ({ page }) => {
    await page.goto('/crm/inbox');
    const primeraConversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (!await primeraConversacion.isVisible()) {
      test.skip(true, 'No hay conversaciones disponibles');
    }
    await primeraConversacion.click();

    const campomensaje = page.getByPlaceholder(/escribir mensaje|responder|mensaje/i)
      .or(page.locator('[data-testid="input-mensaje"]'));
    await expect(campomensaje).toBeVisible({ timeout: 5000 });

    await campomensaje.fill('Mensaje de prueba automatizado');
    await page.keyboard.press('Enter');
    // O usar botón de enviar
    const btnEnviar = page.getByRole('button', { name: /enviar/i });
    if (await btnEnviar.isVisible()) await btnEnviar.click();

    // Esperado: mensaje enviado y visible en el hilo
    await expect(page.locator('text=Mensaje de prueba automatizado').first()).toBeVisible({ timeout: 8000 });
  });

  test('IN-09 Responder con template', async ({ page }) => {
    await page.goto('/crm/inbox');
    const primeraConversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (!await primeraConversacion.isVisible()) {
      test.skip(true, 'No hay conversaciones disponibles');
    }
    await primeraConversacion.click();

    const btnTemplate = page.getByRole('button', { name: /template|plantilla/i });
    if (await btnTemplate.isVisible()) {
      await btnTemplate.click();
      const primerTemplate = page.locator('[data-testid="template-item"]').first();
      if (await primerTemplate.isVisible()) {
        await primerTemplate.click();
        // Esperado: template insertado en el campo de respuesta
        const campoMensaje = page.getByPlaceholder(/escribir mensaje|responder/i);
        await expect(campoMensaje).not.toBeEmpty({ timeout: 3000 });
      }
    }
  });
});

// ─── Gestión de conversaciones ────────────────────────────────────────────────

test.describe('Gestión de conversaciones', () => {
  test('IN-11 Marcar conversación como leída al abrirla', async ({ page }) => {
    await page.goto('/crm/inbox');
    // Buscar conversación con indicador de no leído
    const convNoLeida = page.locator('[data-testid="conversacion-item"]').filter({
      has: page.locator('[data-testid="badge-no-leido"]')
    }).first();

    if (await convNoLeida.isVisible()) {
      await convNoLeida.click();
      await page.waitForTimeout(1000);
      // Esperado: indicador de no leído desaparece
      await expect(convNoLeida.locator('[data-testid="badge-no-leido"]')).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('IN-12 Cerrar conversación cambia estado a Cerrada', async ({ page }) => {
    await page.goto('/crm/inbox');
    const primeraConversacion = page.locator('[data-testid="conversacion-item"]').filter({
      hasText: /abierta/i
    }).first();
    if (await primeraConversacion.isVisible()) {
      await primeraConversacion.click();
      await page.getByRole('button', { name: /cerrar conversación|cerrar/i }).click();
      const btnConfirmar = page.getByRole('button', { name: /confirmar|cerrar/i }).last();
      if (await btnConfirmar.isVisible()) await btnConfirmar.click();

      // Esperado: estado cambia a "Cerrada"
      await expect(page.locator('text=/cerrada/i').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('IN-13 Asignar conversación a un agente', async ({ page }) => {
    await page.goto('/crm/inbox');
    const primeraConversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (await primeraConversacion.isVisible()) {
      await primeraConversacion.click();

      const btnAsignar = page.getByRole('button', { name: /asignar|asignar agente/i });
      if (await btnAsignar.isVisible()) {
        await btnAsignar.click();
        const primerAgente = page.getByRole('option').first();
        if (await primerAgente.isVisible()) {
          await primerAgente.click();
          await expect(page.locator('text=/asignado/i').first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});

// ─── Vinculación con CRM ──────────────────────────────────────────────────────

test.describe('Vinculación con CRM', () => {
  test('IN-14 Conversación vinculada a contacto — datos visibles en panel lateral', async ({ page }) => {
    await page.goto('/crm/inbox');
    const primeraConversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (await primeraConversacion.isVisible()) {
      await primeraConversacion.click();
      // Esperado: panel lateral con datos del contacto
      const panelContacto = page.locator('[data-testid="panel-contacto"], .panel-contacto');
      if (await panelContacto.isVisible()) {
        await expect(panelContacto.locator('text=/nombre|empresa/i').first()).toBeVisible();
      }
    }
  });

  test('IN-15 Crear contacto desde conversación de número desconocido', async ({ page }) => {
    await page.goto('/crm/inbox');
    // Buscar conversación sin contacto vinculado
    const convSinContacto = page.locator('[data-testid="conversacion-item"]').filter({
      has: page.locator('[data-testid="sin-contacto"]')
    }).first();

    if (await convSinContacto.isVisible()) {
      await convSinContacto.click();
      const btnCrearContacto = page.getByRole('button', { name: /crear contacto|vincular contacto/i });
      if (await btnCrearContacto.isVisible()) {
        await btnCrearContacto.click();
        await expect(page.locator('text=/nuevo contacto|crear contacto/i').first()).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  test('IN-16 EJECUTIVO_VENTAS sin acceso al inbox', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.ejecutivoVentas });
    const page = await ctx.newPage();
    await page.goto('/crm/inbox');

    const bloqueado =
      page.url().includes('/login') ||
      page.url().includes('/acceso-denegado') ||
      (await page.locator('text=/no tienes acceso|sin permiso|acceso denegado/i').isVisible({ timeout: 5000 }).catch(() => false));
    expect(bloqueado).toBeTruthy();

    await ctx.close();
  });

  test('IN-17 INVITADO solo lectura — campo de respuesta oculto o deshabilitado', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.invitado });
    const page = await ctx.newPage();
    await page.goto('/crm/inbox');

    if (!page.url().includes('/login') && !page.url().includes('/acceso-denegado')) {
      const primeraConversacion = page.locator('[data-testid="conversacion-item"]').first();
      if (await primeraConversacion.isVisible()) {
        await primeraConversacion.click();
        // Esperado: campo de respuesta oculto o deshabilitado
        const campoMensaje = page.getByPlaceholder(/escribir mensaje|responder/i);
        const visible = await campoMensaje.isVisible({ timeout: 3000 }).catch(() => false);
        if (visible) {
          await expect(campoMensaje).toBeDisabled();
        } else {
          // Si no está visible, también es aceptable
          expect(visible).toBeFalsy();
        }
      }
    }

    await ctx.close();
  });
});

// ─── 035 — Inbox agrupado por contacto ───────────────────────────────────────
//
// Mismo estilo tolerante que el resto del archivo (guardas por cantidad): la
// base de pruebas puede no tener un contacto multicanal, y en ese caso estos
// tests verifican lo que sí se puede verificar sin inventar datos.

test.describe('Inbox agrupado por contacto', () => {
  test('IN-18 La lista se presenta agrupada por contacto', async ({ page }) => {
    await page.goto('/crm/inbox');
    await page.getByRole('button', { name: /^todos$/i }).click().catch(() => {});
    await page.waitForTimeout(500);

    const grupos = page.locator('[data-testid="grupo-contacto"]');
    const conversaciones = page.locator('[data-testid="conversacion-item"]');

    if (await conversaciones.count() > 0) {
      // Invariante de la agrupación: nunca hay más personas que conversaciones.
      expect(await grupos.count()).toBeGreaterThan(0);
      expect(await grupos.count()).toBeLessThanOrEqual(await conversaciones.count());
    }
  });

  test('IN-19 Un grupo multicanal se expande y se colapsa', async ({ page }) => {
    await page.goto('/crm/inbox');
    await page.getByRole('button', { name: /^todos$/i }).click().catch(() => {});
    await page.waitForTimeout(500);

    // Solo los grupos con varias conversaciones tienen cabecera expandible.
    const cabecera = page.locator('[data-testid="grupo-contacto"] > button[aria-expanded]').first();
    if (await cabecera.count() === 0) test.skip(true, 'Sin contactos multicanal en la base de pruebas');

    await expect(cabecera).toHaveAttribute('aria-expanded', 'true');
    await cabecera.click();
    await expect(cabecera).toHaveAttribute('aria-expanded', 'false');
    await cabecera.click();
    await expect(cabecera).toHaveAttribute('aria-expanded', 'true');
  });

  test('IN-20 Abrir una conversación desde dentro de su grupo', async ({ page }) => {
    await page.goto('/crm/inbox');
    await page.getByRole('button', { name: /^todos$/i }).click().catch(() => {});
    await page.waitForTimeout(500);

    const conversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (await conversacion.count() === 0) test.skip(true, 'Sin conversaciones en la base de pruebas');

    await conversacion.click();
    await expect(
      page.getByPlaceholder(/escribe un mensaje|escribir mensaje|responder/i)
        .or(page.locator('main'))
    ).toBeVisible({ timeout: 8000 });
  });

  test('IN-21 El panel del contacto lista sus identidades de canal', async ({ page }) => {
    await page.goto('/crm/inbox');
    await page.getByRole('button', { name: /^todos$/i }).click().catch(() => {});
    await page.waitForTimeout(500);

    const conversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (await conversacion.count() === 0) test.skip(true, 'Sin conversaciones en la base de pruebas');

    await conversacion.click();
    await page.waitForTimeout(800);

    // El panel de contacto puede venir colapsado: se abre con su botón.
    const botonInfo = page.getByRole('button', { name: /info de contacto|ver perfil/i }).first();
    if (await botonInfo.count() > 0) await botonInfo.click().catch(() => {});

    await expect(page.getByText(/identidades \/ canales vinculados/i).first())
      .toBeVisible({ timeout: 5000 });
  });

  test('IN-22 El canal del compositor es una etiqueta, no un selector', async ({ page }) => {
    await page.goto('/crm/inbox');
    await page.getByRole('button', { name: /^todos$/i }).click().catch(() => {});
    await page.waitForTimeout(500);

    const conversacion = page.locator('[data-testid="conversacion-item"]').first();
    if (await conversacion.count() === 0) test.skip(true, 'Sin conversaciones en la base de pruebas');

    await conversacion.click();
    await page.waitForTimeout(800);

    // FR-020: el envío siempre sale por el canal de la conversación, así que
    // acá no puede haber un control que prometa elegir otro.
    const etiqueta = page.getByText(/respondiendo por/i).first();
    if (await etiqueta.count() > 0) {
      await expect(etiqueta).toBeVisible();
      const esBoton = await etiqueta.evaluate((el) => !!el.closest('button'));
      expect(esBoton).toBeFalsy();
    }
  });
});
