import { test, expect, type Page } from '@playwright/test';
import { obtenerInstanciaPruebas, obtenerUsuarioOwner, crearPedidoConEntregaEditable } from '../../helpers/db';

// 019-cobertura-geografica-envios — cubre quickstart.md Escenario 1
// (transportista con cobertura por país/estado) y parte del Escenario 4
// (selector de estado/provincia visible en la entrega de un pedido). El
// toggle completo "un solo país oculta el selector de país" requeriría un
// helper de datos nuevo para fijar ConfiguracionEmpresa.modoGeografico
// (tests/helpers/db.ts + db-worker.ts) — queda fuera de este archivo,
// documentado como pendiente en tasks.md.

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

test.describe('Cobertura geográfica de transportista (Historia 1)', () => {
  test('CG-01 Configurar zona de cobertura por país/estado con costo, al editar un transportista', async ({ page }) => {
    await page.goto(URL_TRANSPORTISTAS);
    const nombre = `TransCobertura-${Date.now()}`;
    await crearTransportista(page, nombre);

    // Editar: la sección de cobertura geográfica solo aparece al editar
    // (dialog-transportista.tsx, decisión documentada en tasks.md T020).
    await filaTransportista(page, nombre).getByRole('button').first().click();
    await expect(page.getByText('Editar transportista', { exact: true })).toBeVisible();
    await expect(page.getByText(/zonas de cobertura y costo de envío/i)).toBeVisible({ timeout: 8000 });

    // Combobox de país — buscar por nombre en español con tilde y confirmar
    // que encuentra el país aunque el catálogo lo tenga sembrado sin tilde
    // (research.md Decisión 2b / fix de generarSlug en T039).
    await page.getByRole('button', { name: /selecciona un país/i }).click();
    await page.getByPlaceholder(/buscar país/i).fill('Perú');
    await page.getByRole('option', { name: /Perú/i }).click();

    await page.getByRole('button', { name: /elige un país primero|selecciona un estado/i }).click();
    await page.getByPlaceholder(/buscar estado/i).fill('Lima');
    await page.getByRole('option', { name: /Lima/i }).first().click();

    // El input de costo es el DecimalInput junto al botón "Agregar zona de
    // cobertura" (aria-label explícito — el botón es icon-only).
    const inputCosto = page.locator('input[type="text"], input[type="number"]').last();
    await inputCosto.fill('25');
    await page.getByRole('button', { name: /agregar zona de cobertura/i }).click();

    // Esperado: la zona queda listada con su costo exacto.
    await expect(page.getByText(/Lima/i).last()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('25.00')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Ubicación de entrega en pedido (Historia 4)', () => {
  test('CG-02 El formulario de entrega del pedido pide provincia/estado', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const { pedidoId } = await crearPedidoConEntregaEditable(instancia.id, owner.id);

    await page.goto(`/sales/pedidos/${pedidoId}`);
    // El campo es un Combobox (no un <select> nativo) — igual que el resto
    // de los Combobox del proyecto, se ubica por el texto de su botón
    // trigger, no por getByLabel (ver tests/e2e/sales/cotizaciones.spec.ts).
    await expect(
      page.getByRole('button', { name: /selecciona un estado\/provincia|elige un país primero/i })
    ).toBeVisible({ timeout: 8000 });
  });
});
