import { test, expect, type Page } from '@playwright/test';
import {
  obtenerInstanciaPruebas,
  obtenerUsuarioOwner,
  crearPedidoConEntregaEditable,
} from '../../helpers/db';

// La ruta real es /sales/transportistas (NO /configuracion/transportistas,
// que no existe). No hay tabla: es una lista de tarjetas. Crear/editar usa
// un Dialog inline (sin navegación), y el modelo Transportista solo tiene
// nombre + tipo (sin RUC/teléfono/email). "Desactivar" es un botón Power
// con título accesible ("Desactivar"/"Activar") que actúa de inmediato, sin
// diálogo de confirmación ni paso de "guardar" separado.
const URL_TRANSPORTISTAS = '/sales/transportistas';

function filaTransportista(page: Page, nombre: string) {
  return page.locator(`text="${nombre}"`).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
}

async function crearTransportista(page: Page, nombre: string) {
  await page.getByRole('button', { name: /nuevo transportista/i }).click();
  await page.getByLabel(/nombre/i).fill(nombre);
  await page.getByRole('button', { name: /crear transportista/i }).click();
  await expect(page.locator(`text="${nombre}"`)).toBeVisible({ timeout: 8000 });
}

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de transportistas', () => {
  test('TR-01 Ver lista de transportistas', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    // Esperado: catálogo de transportistas (tarjetas, no tabla) con botón
    // para crear uno nuevo.
    await expect(page.getByRole('heading', { name: 'Transportistas' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /nuevo transportista/i })).toBeVisible();
  });
});

// ─── Creación y edición ───────────────────────────────────────────────────────

test.describe('Creación y edición de transportistas', () => {
  test('TR-02 Crear transportista completo', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    const nombreTransportista = `Transportista-${Date.now()}`;
    await page.getByRole('button', { name: /nuevo transportista/i }).click();
    await page.getByLabel(/nombre/i).fill(nombreTransportista);
    // El modelo solo tiene nombre + tipo (sin RUC/teléfono/email); el tipo
    // ya viene con un valor por defecto ("Courier externo").
    await page.getByRole('button', { name: /crear transportista/i }).click();

    // Esperado: transportista creado y disponible para asignar en entregas
    await expect(page.locator(`text="${nombreTransportista}"`)).toBeVisible({ timeout: 8000 });
  });

  test('TR-03 Editar transportista', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    const nombreOriginal = `TransOriginal-${Date.now()}`;
    await crearTransportista(page, nombreOriginal);

    // Editar es un botón Pencil icon-only directamente en la fila (sin
    // navegar a ninguna página de detalle).
    await filaTransportista(page, nombreOriginal).getByRole('button').first().click();
    await expect(page.getByText('Editar transportista', { exact: true })).toBeVisible();

    const nuevoNombre = `TransEditado-${Date.now()}`;
    await page.getByLabel(/nombre/i).fill(nuevoNombre);
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    // Esperado: cambios reflejados
    await expect(page.locator(`text="${nuevoNombre}"`)).toBeVisible({ timeout: 8000 });
  });

  test('TR-04 Validación: nombre requerido', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    await page.getByRole('button', { name: /nuevo transportista/i }).click();
    await page.getByRole('button', { name: /crear transportista/i }).click();
    // Esperado: error en campo nombre
    await expect(page.locator('text=/requerido|obligatorio/i').first()).toBeVisible();
  });

  test('TR-05 Desactivar transportista no lo muestra en selector de entregas', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    const nombreDesactivar = `TransDesactivar-${Date.now()}`;
    await crearTransportista(page, nombreDesactivar);

    // Desactivar: botón "Power" (título accesible "Desactivar"), acción
    // inmediata sin diálogo de confirmación ni paso de "guardar" aparte.
    const fila = filaTransportista(page, nombreDesactivar);
    await fila.getByRole('button', { name: /desactivar/i }).click();
    await expect(page.locator('text=/transportista desactivado/i').first()).toBeVisible({ timeout: 5000 });
    await expect(fila.getByText('Inactivo')).toBeVisible();

    // Verificar que no aparece en el selector de entregas de un pedido. La
    // sección de entrega está bloqueada por defecto — se crea un pedido en
    // una etapa que explícitamente permite editarla.
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const { pedidoId } = await crearPedidoConEntregaEditable(instancia.id, owner.id);

    await page.goto(`/sales/pedidos/${pedidoId}`);
    const selectorTransportista = page.getByLabel(/transportista/i);
    await expect(selectorTransportista).toBeVisible({ timeout: 8000 });
    await selectorTransportista.click();
    await expect(page.getByRole('option', { name: nombreDesactivar })).not.toBeVisible();
  });
});

// ─── Uso en pedidos ───────────────────────────────────────────────────────────

test.describe('Uso de transportistas en pedidos', () => {
  test('TR-06 Asignar transportista en entrega de un pedido', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);

    // Transportista propio, para verificar exactamente que ese se asignó.
    await page.goto(URL_TRANSPORTISTAS);
    const nombreTransportista = `TransAsignar-${Date.now()}`;
    await crearTransportista(page, nombreTransportista);

    const { pedidoId } = await crearPedidoConEntregaEditable(instancia.id, owner.id);
    await page.goto(`/sales/pedidos/${pedidoId}`);

    const selectorTransportista = page.getByLabel(/transportista/i);
    await expect(selectorTransportista).toBeVisible({ timeout: 8000 });
    await selectorTransportista.click();
    await page.getByRole('option', { name: nombreTransportista }).click();
    await page.getByRole('button', { name: /guardar entrega/i }).click();

    // Esperado: entrega actualizada y transportista asignado visible
    await expect(page.locator('text=/entrega actualizada/i').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator(`text="${nombreTransportista}"`).first()).toBeVisible();
  });

  test('TR-07 Solo transportistas activos aparecen en el selector', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);

    await page.goto(URL_TRANSPORTISTAS);
    const nombreInactivo = `TransInactivo-${Date.now()}`;
    await crearTransportista(page, nombreInactivo);
    await filaTransportista(page, nombreInactivo).getByRole('button', { name: /desactivar/i }).click();
    await expect(page.locator('text=/transportista desactivado/i').first()).toBeVisible({ timeout: 5000 });

    const { pedidoId } = await crearPedidoConEntregaEditable(instancia.id, owner.id);
    await page.goto(`/sales/pedidos/${pedidoId}`);

    const selectorTransportista = page.getByLabel(/transportista/i);
    await expect(selectorTransportista).toBeVisible({ timeout: 8000 });
    await selectorTransportista.click();

    // El transportista recién desactivado no debe listarse como opción.
    await expect(page.getByRole('option', { name: nombreInactivo })).not.toBeVisible();
  });
});
