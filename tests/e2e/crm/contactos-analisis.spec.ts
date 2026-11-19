import { test, expect, type Page } from '@playwright/test';
import { authFile } from '../../fixtures';
import {
  crearContactoConAnalisis,
  eliminarContactoE2E,
  obtenerInstanciaPruebas,
  obtenerUsuarioOwner,
} from '../../helpers/db';

// 042 — Análisis inteligente de Contactos: columna Puntaje, sección "Análisis
// de IA" del panel, sugerencias (Solo sugerir) y configuración. La evaluación
// se siembra en la base: estas pruebas no dependen del worker ni de un
// proveedor de IA real.

async function abrirPanel(page: Page, nombre: string) {
  await page.goto('/crm/contactos');
  await page.getByPlaceholder(/buscar/i).fill(nombre);
  const fila = page.locator('tbody tr', { hasText: nombre });
  await expect(fila).toBeVisible({ timeout: 8000 });
  await fila.click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByText('Análisis de IA')).toBeVisible();
  return { fila, panel };
}

async function sembrar(nombre: string) {
  const instancia = await obtenerInstanciaPruebas();
  const usuario = await obtenerUsuarioOwner(instancia.id);
  return crearContactoConAnalisis({ instanciaId: instancia.id, usuarioId: usuario.id, nombre });
}

test.describe('042 — Columna Puntaje (FR-052a)', () => {
  test('A-01 la tabla muestra el puntaje y se puede ordenar sin cambiar el orden por defecto', async ({ page }) => {
    const nombre = `Puntaje-${Date.now()}`;
    const { id } = await sembrar(nombre);
    try {
      await page.goto('/crm/contactos');
      await expect(page.getByText(/ordenado por prioridad de atención/i)).toBeVisible();
      const encabezado = page.getByRole('columnheader', { name: /puntaje/i });
      await expect(encabezado).toHaveAttribute('aria-sort', 'none');
      await encabezado.getByRole('button').click();
      await expect(encabezado).toHaveAttribute('aria-sort', 'descending');

      await page.getByPlaceholder(/buscar/i).fill(nombre);
      await expect(page.locator('tbody tr', { hasText: nombre }).locator('[data-slot="insignia-puntaje"]')).toHaveText(/82/);
    } finally {
      await eliminarContactoE2E(id);
    }
  });
});

test.describe('042 — Panel "Análisis de IA" (Historia 2)', () => {
  test('A-02 muestra intención, señales, acción sugerida y sugerencias pendientes', async ({ page }) => {
    const nombre = `Analisis-${Date.now()}`;
    const { id } = await sembrar(nombre);
    try {
      const { panel } = await abrirPanel(page, nombre);
      await expect(panel.getByText('Consultó precio y fecha de entrega')).toBeVisible();
      await expect(panel.getByText('Enviar cotización')).toBeVisible();
      await expect(panel.getByText(/Interés sugerido:/)).toBeVisible();
      await expect(panel.getByText(/Sugerencia de la IA:/)).toBeVisible();
      // Solo sugerir: el interés del contacto sigue sin evaluar hasta que alguien acepte.
      await expect(panel.locator('[data-slot="insignia-interes"]').first()).toHaveText(/Sin evaluar/);
    } finally {
      await eliminarContactoE2E(id);
    }
  });

  test('A-03 aceptar el interés sugerido lo aplica con origen manual', async ({ page }) => {
    const nombre = `Aceptar-${Date.now()}`;
    const { id } = await sembrar(nombre);
    try {
      const { panel } = await abrirPanel(page, nombre);
      const sugerencia = panel.locator('[data-slot="sugerencia-ia"]', { hasText: 'Interés sugerido' });
      await sugerencia.getByRole('button', { name: /aceptar/i }).click();
      await expect(sugerencia).toHaveCount(0, { timeout: 8000 });
      await expect(panel.locator('[data-slot="insignia-interes"]').first()).toHaveText(/Alto/);
    } finally {
      await eliminarContactoE2E(id);
    }
  });

  test('A-04 descartar "No contactar" no cambia la preferencia (FR-016a)', async ({ page }) => {
    const nombre = `Descartar-${Date.now()}`;
    const { id } = await sembrar(nombre);
    try {
      const { panel } = await abrirPanel(page, nombre);
      const sugerencia = panel.locator('[data-slot="sugerencia-ia"]', { hasText: 'No contactar' });
      await sugerencia.getByRole('button', { name: /descartar/i }).click();
      await expect(sugerencia).toHaveCount(0, { timeout: 8000 });
      await expect(panel.getByText(/^No contactar$/)).toHaveCount(0);
    } finally {
      await eliminarContactoE2E(id);
    }
  });
});

test.describe('042 — Configuración → IA → Análisis de contactos (FR-030a)', () => {
  test('A-05 el administrador ve los interruptores', async ({ page }) => {
    await page.goto('/configuracion');
    await page.getByRole('tab', { name: /inteligencia artificial/i }).click();
    await expect(page.getByText('Análisis de contactos').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Analizar contactos con IA')).toBeVisible();
    await expect(page.getByText('Pausar la clasificación inicial')).toBeVisible();
  });
});

test.describe('042 — Permisos', () => {
  test.use({ storageState: authFile.invitado });

  test('A-06 un invitado ve el análisis pero no puede analizar ni resolver sugerencias', async ({ page }) => {
    const nombre = `Invitado-${Date.now()}`;
    const { id } = await sembrar(nombre);
    try {
      const { panel } = await abrirPanel(page, nombre);
      await expect(panel.getByRole('button', { name: /analizar con ia/i })).toHaveCount(0);
      await expect(panel.locator('[data-slot="sugerencia-ia"]')).toHaveCount(0);
    } finally {
      await eliminarContactoE2E(id);
    }
  });
});

test.describe('042 — Analizar varios contactos (Historia 7)', () => {
  test('A-07 seleccionar contactos muestra el contador y "Analizar seleccionados"', async ({ page }) => {
    await page.goto('/crm/contactos');
    const barra = page.locator('[data-slot="barra-seleccion-analisis"]');
    await page.getByRole('checkbox', { name: /seleccionar la página/i }).check();
    await expect(barra.getByText(/seleccionados?/)).toBeVisible();
    await expect(barra.getByRole('button', { name: /analizar seleccionados/i })).toBeVisible();
    await barra.getByRole('button', { name: /limpiar/i }).click();
    await expect(barra.getByRole('button', { name: /analizar seleccionados/i })).toHaveCount(0);
  });

  test('A-08 cambiar de página o de filtro limpia la selección', async ({ page }) => {
    await page.goto('/crm/contactos');
    await page.getByRole('checkbox', { name: /seleccionar la página/i }).check();
    await page.getByRole('tab', { name: /^Interesados/i }).click();
    await expect(page.locator('[data-slot="barra-seleccion-analisis"]').getByRole('button', { name: /analizar seleccionados/i })).toHaveCount(0);
  });

  test('A-09 el administrador puede analizar todo el segmento, con confirmación', async ({ page }) => {
    await page.goto('/crm/contactos');
    await page.getByRole('button', { name: /analizar todo el segmento/i }).click();
    await expect(page.getByRole('alertdialog')).toContainText(/analizar .* contactos/i);
    await page.getByRole('button', { name: /cancelar/i }).click();
  });

  test('A-10 las acciones de cada fila siguen igual (041, escenario 9)', async ({ page }) => {
    await page.goto('/crm/contactos');
    const primera = page.locator('tbody tr').first();
    await primera.getByRole('button').last().click();
    await expect(page.getByRole('menuitem', { name: /ver detalle/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /editar/i })).toBeVisible();
  });
});
