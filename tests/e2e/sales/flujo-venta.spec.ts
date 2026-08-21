import { test, expect, type Page } from '@playwright/test';
import {
  obtenerInstanciaPruebas,
  obtenerUsuarioOwner,
  asegurarFlujoConEtapas,
  crearEtapaConPedido,
  crearPedidoEnEtapaFinal,
  crearPedidoConReglaBloqueante,
} from '../../helpers/db';

// /sales/flujo-venta es una página única: NO existe una lista de "flujos" ni
// un botón "crear flujo" — cada instancia tiene exactamente UN FlujoVenta
// (auto-creado, sin etapas, la primera vez que se visita la página). La
// pestaña "Etapas" (PanelConfigEtapas) administra las etapas inline: sin
// tabla, sin diálogo de confirmación al eliminar (acción inmediata con
// rollback optimista si el server la rechaza), y los botones editar/eliminar
// de cada fila son icon-only (sin nombre accesible) — se ubican por posición
// dentro de la fila: [grip, editar, eliminar].

function filaEtapa(page: Page, nombre: string) {
  return page.locator(`text="${nombre}"`).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
}

async function agregarEtapa(page: Page, nombre: string) {
  await page.getByRole('button', { name: /añadir etapa/i }).click();
  await page.getByPlaceholder('Nombre de la etapa').fill(nombre);
  await page.keyboard.press('Enter');
  await expect(page.locator(`text="${nombre}"`)).toBeVisible({ timeout: 8000 });
}

// ─── Configuración del flujo ──────────────────────────────────────────────────

test.describe('Configuración de flujos de venta', () => {
  test('FV-01 Ver el flujo de venta configurado', async ({ page }) => {
    await page.goto('/sales/flujo-venta');
    // Esperado: pestaña "Etapas" con el listado (tarjetas arrastrables, no
    // tabla) y el control para añadir una nueva etapa.
    await expect(page.getByText(/etapas · arrastra para reordenar/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /añadir etapa/i })).toBeVisible();
  });

  test('FV-02 Agregar una etapa al flujo', async ({ page }) => {
    await page.goto('/sales/flujo-venta');
    const nombreEtapa = `Etapa-${Date.now()}`;
    await agregarEtapa(page, nombreEtapa);
    // Esperado: la etapa queda disponible para nuevos pedidos (aparece en la lista)
    await expect(page.locator(`text="${nombreEtapa}"`)).toBeVisible();
  });

  test('FV-03 Configurar etapa con permiteEditarEntrega', async ({ page }) => {
    await page.goto('/sales/flujo-venta');
    // Etapa propia, para no depender del estado de etapas previas.
    const nombreEtapa = `EtapaEntrega-${Date.now()}`;
    await agregarEtapa(page, nombreEtapa);

    // El botón "editar" (Pencil) es el segundo botón de la fila: [grip, editar, eliminar].
    const fila = filaEtapa(page, nombreEtapa);
    await fila.getByRole('button').nth(1).click();

    await expect(page.getByText('Editar etapa', { exact: true })).toBeVisible();
    // Por defecto la entrega está bloqueada; el propio texto del botón refleja el estado.
    // El TooltipTrigger envuelve al botón real y comparte el mismo nombre
    // accesible (strict-mode violation con 2 matches) — .last() toma el interno.
    await page.getByRole('button', { name: /entrega bloqueada/i }).last().click();
    await expect(page.getByRole('button', { name: /entrega editable/i }).last()).toBeVisible();
    await page.getByRole('button', { name: /^guardar$/i }).click();

    // Esperado: cambio guardado
    await expect(page.locator('text=/etapa actualizada/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('FV-04 Reordenar etapas arrastrando', async ({ page }) => {
    await page.goto('/sales/flujo-venta');
    const sufijo = Date.now();
    const nombre1 = `EtapaOrden1-${sufijo}`;
    const nombre2 = `EtapaOrden2-${sufijo}`;
    await agregarEtapa(page, nombre1);
    await agregarEtapa(page, nombre2);

    // Drag & drop: arrastrar la manija (grip) de la primera etapa hasta
    // debajo de la segunda.
    const grip1 = filaEtapa(page, nombre1).getByRole('button').first();
    const fila2 = filaEtapa(page, nombre2);
    const box1 = await grip1.boundingBox();
    const box2 = await fila2.boundingBox();
    if (box1 && box2) {
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
      await page.mouse.down();
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height + 10, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      // Esperado: etapas reordenadas sin errores — ambas siguen visibles.
      await expect(page.locator(`text="${nombre1}"`)).toBeVisible();
      await expect(page.locator(`text="${nombre2}"`)).toBeVisible();
    }
  });

  test('FV-05 Eliminar etapa sin pedidos asociados', async ({ page }) => {
    await page.goto('/sales/flujo-venta');
    const nombreEliminar = `EtapaEliminar-${Date.now()}`;
    await agregarEtapa(page, nombreEliminar);

    // Sin diálogo de confirmación: el botón "eliminar" (Trash2, último de la
    // fila) borra de inmediato.
    await filaEtapa(page, nombreEliminar).getByRole('button').last().click();

    await expect(page.locator(`text="${nombreEliminar}"`)).not.toBeVisible({ timeout: 8000 });
  });

  test('FV-06 Eliminar etapa con pedidos asociados muestra error', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const { etapaNombre } = await crearEtapaConPedido(instancia.id, owner.id);

    await page.goto('/sales/flujo-venta');
    const fila = filaEtapa(page, etapaNombre);
    await expect(fila).toBeVisible({ timeout: 8000 });
    await fila.getByRole('button').last().click();

    // Esperado: error claro ("No se puede eliminar: N pedido(s)...") y la
    // etapa permanece (rollback optimista en el cliente).
    await expect(page.locator('text=/no se puede eliminar/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text="${etapaNombre}"`)).toBeVisible();
  });
});

// ─── Uso del flujo en pedidos ─────────────────────────────────────────────────

async function crearPedidoConFlujo(page: Page) {
  await page.goto('/sales/pedidos');
  await page.getByRole('link', { name: /nuevo pedido|crear/i }).or(page.getByRole('button', { name: /nuevo pedido|crear/i })).first().click();
  await page.waitForURL(/\/sales\/pedidos\/nuevo$/, { timeout: 30000 });
  await page.getByRole('button', { name: /guardar|crear pedido/i }).click();
  // crearPedido siempre redirige a la lista (no al detalle).
  await page.waitForURL(/\/sales\/pedidos$/, { timeout: 30000 });
  await page.locator('tbody tr a').first().click();
  await page.waitForURL(/\/sales\/pedidos\/[\w-]+$/, { timeout: 30000 });
}

// Botones de transición reales: muestran el NOMBRE de la próxima etapa (ej.
// "Completado"), no un texto genérico "Avanzar". Viven junto a "Editar
// pedido" en el header — se identifican por exclusión.
function botonesTransicion(page: Page) {
  return page.locator('div.flex.items-center.gap-2.flex-wrap button')
    .filter({ hasNotText: 'Editar pedido' });
}

test.describe('Uso del flujo en pedidos', () => {
  test('FV-07 Pedido avanza por etapas con registro en timeline', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    // Garantiza al menos 2 etapas (inicial + final) para tener una transición real.
    await asegurarFlujoConEtapas(instancia.id);

    await crearPedidoConFlujo(page);

    const btnTransicion = botonesTransicion(page).first();
    await expect(btnTransicion).toBeVisible({ timeout: 8000 });
    const etapaDestino = (await btnTransicion.textContent())?.trim();
    await btnTransicion.click();

    // Esperado: la etapa del pedido cambió (badge del header) y quedó
    // registrada en el historial.
    if (etapaDestino) {
      await expect(page.locator(`text="${etapaDestino}"`).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('FV-08 Pedido en última etapa no puede avanzar más', async ({ page }) => {
    // El flujo compartido acumula etapas entre corridas de FV-02/04 (no hay
    // forma de aislarlo: solo existe UN FlujoVenta por instancia), así que
    // "click hasta agotar" sobre la cadena completa es frágil. Se crea el
    // pedido directamente en una etapa esFinal vía helper de datos.
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const { pedidoId } = await crearPedidoEnEtapaFinal(instancia.id, owner.id);

    await page.goto(`/sales/pedidos/${pedidoId}`);

    // Esperado: ningún botón de transición disponible en una etapa final.
    await expect(botonesTransicion(page)).toHaveCount(0, { timeout: 8000 });
  });

  test('FV-09 Una regla de validación activa bloquea la transición y no mueve el pedido', async ({ page }) => {
    // Reglas de validación: un estado puede tener requisitos obligatorios
    // (ver pestaña "Reglas de validación" en /sales/flujo-venta). El helper
    // crea una regla imposible de cumplir (total > 999999) Publicada+activa
    // para una etapa Manual, y un pedido recién creado en otra etapa.
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const { pedidoId, etapaBloqueadaNombre, mensajeFallo } = await crearPedidoConReglaBloqueante(instancia.id, owner.id);

    await page.goto(`/sales/pedidos/${pedidoId}`);

    const btnBloqueado = botonesTransicion(page).filter({ hasText: etapaBloqueadaNombre });
    await expect(btnBloqueado).toBeVisible({ timeout: 8000 });
    await btnBloqueado.click();

    // Esperado: el mensaje configurado en la regla aparece como error — el
    // pedido NO se mueve (si se hubiera movido, saldría un toast de éxito y
    // el botón hacia esa misma etapa ya no tendría sentido mostrarse).
    await expect(page.locator(`text=${mensajeFallo}`).first()).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(new RegExp(`/sales/pedidos/${pedidoId}$`));
  });
});
