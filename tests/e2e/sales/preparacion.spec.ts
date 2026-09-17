import { test, expect, type Page } from '@playwright/test';
import {
  obtenerInstanciaPruebas,
  obtenerUsuarioOwner,
  asegurarFlujoConEtapas,
  crearPedidoParaPreparacion,
  crearPedidoFueraDePreparacion,
  obtenerPreparacionPedido,
  obtenerEstadosPreparacion,
  limpiarEntradasPreparacion,
  marcarAvanceLinea,
} from '../../helpers/db';

// /sales/preparacion es un eje propio, independiente del Flujo de Venta: mover
// una tarjeta acá NO cambia la etapa comercial del pedido. El tablero funciona
// sin configuración previa (flujo por defecto de 2 estados, creado perezosamente
// la primera vez que se entra), y la pertenencia de un pedido se DERIVA de su
// etapa — no de una bandera escrita por el motor de etapas.
//
// El kanban se carga con next/dynamic (ssr: false), así que los tests esperan
// a que las columnas aparezcan en vez de asumirlas en el primer paint.

async function abrirTablero(page: Page, query = '') {
  await page.goto(`/sales/preparacion${query}`);
  await expect(page.getByRole('heading', { name: /preparación de pedidos/i })).toBeVisible({ timeout: 10000 });
}

function tarjeta(page: Page, numero: string) {
  return page.locator('[data-slot="tarjeta-preparacion"]').filter({ hasText: numero });
}

test.describe('Tablero de preparación', () => {
  test('PREP-01 El tablero funciona sin configuración previa, con 2 estados por defecto', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const pedido = await crearPedidoParaPreparacion(instanciaId, usuarioId);

    await abrirTablero(page);

    // Esperado: el flujo por defecto se creó solo, sin pasar por configuración.
    await expect(page.getByText('Por preparar').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Preparado').first()).toBeVisible();

    const estados = await obtenerEstadosPreparacion(instanciaId);
    expect(estados.estados.length).toBeGreaterThanOrEqual(2);
    expect(estados.estados.some((e) => e.esInicial)).toBe(true);
    expect(estados.estados.some((e) => e.esFinal)).toBe(true);

    await expect(tarjeta(page, pedido.numero)).toBeVisible({ timeout: 10000 });
  });

  test('PREP-02 Un pedido creado DIRECTAMENTE en una etapa de entrada aparece en el tablero', async ({ page }) => {
    // Este es el caso que se rompe si la materialización se engancha al motor
    // de etapas: el pedido nace ya en su etapa, sin que nadie lo "mueva".
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const pedido = await crearPedidoParaPreparacion(instanciaId, usuarioId);

    await abrirTablero(page);

    await expect(tarjeta(page, pedido.numero)).toBeVisible({ timeout: 10000 });
    // Y la preparación quedó materializada en base, no solo dibujada.
    const prep = await obtenerPreparacionPedido(pedido.pedidoId);
    expect(prep).not.toBeNull();
  });

  test('PREP-03 Mover un pedido al estado final sella fin y responsable', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const pedido = await crearPedidoParaPreparacion(instanciaId, usuarioId);

    await abrirTablero(page);
    await expect(tarjeta(page, pedido.numero)).toBeVisible({ timeout: 10000 });

    const origen = tarjeta(page, pedido.numero);
    const columnaFinal = page.locator('[data-slot="columna-preparacion"]').filter({ hasText: 'Preparado' }).first();
    await origen.hover();
    await page.mouse.down();
    await columnaFinal.hover();
    await page.mouse.up();

    // Esperado: fin y responsable sellados; el inicio también (el estado
    // inicial del flujo por defecto lleva marcaInicio).
    await expect
      .poll(async () => (await obtenerPreparacionPedido(pedido.pedidoId))?.completadaEn, { timeout: 15000 })
      .not.toBeNull();

    const prep = await obtenerPreparacionPedido(pedido.pedidoId);
    expect(prep?.estadoEsFinal).toBe(true);
    expect(prep?.iniciadaEn).not.toBeNull();
    expect(prep?.responsable).not.toBeNull();
    expect(prep?.movimientos).toBeGreaterThanOrEqual(1);
  });

  test('PREP-04 Un pedido sin fecha de entrega sigue visible y en su columna de estado', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const pedido = await crearPedidoParaPreparacion(instanciaId, usuarioId, { sinFechaEntrega: true });

    // En cualquier rango: el filtro de fecha no lo puede esconder. Y vive en su
    // columna de estado (no en un grupo aparte), así se puede arrastrar como
    // cualquier otra tarjeta.
    await abrirTablero(page, '?rango=MANANA');
    const suTarjeta = tarjeta(page, pedido.numero);
    await expect(suTarjeta).toBeVisible({ timeout: 10000 });
    await expect(suTarjeta.getByText('Sin fecha')).toBeVisible();
    await expect(
      page.locator('[data-slot="columna-preparacion"]').filter({ has: suTarjeta }),
    ).toHaveCount(1);
  });

  test('PREP-05 El avance por ítem se refleja y el resumen por producto consolida', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const pedido = await crearPedidoParaPreparacion(instanciaId, usuarioId, { lineas: 3 });

    // Línea 3 tiene cantidad 3: dejamos 2 preparadas para probar el parcial.
    const parcial = await marcarAvanceLinea(pedido.lineaIds[2], 2);
    expect(parcial.cantidadPreparada).toBe(2);

    await abrirTablero(page);
    await expect(tarjeta(page, pedido.numero)).toBeVisible({ timeout: 10000 });

    // El parcial se muestra explícito: un check binario no podría contarlo.
    await expect(tarjeta(page, pedido.numero).getByText(/2 de 3 preparadas/i)).toBeVisible();

    await expect(page.getByRole('heading', { name: /resumen por producto/i })).toBeVisible();
    await expect(page.getByText(/producto prueba 3/i).first()).toBeVisible();
  });

  test('PREP-06 La búsqueda filtra el tablero sin perder las columnas', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const buscado = await crearPedidoParaPreparacion(instanciaId, usuarioId);
    const otro = await crearPedidoParaPreparacion(instanciaId, usuarioId);

    await abrirTablero(page, `?q=${encodeURIComponent(buscado.numero)}`);

    await expect(tarjeta(page, buscado.numero)).toBeVisible({ timeout: 10000 });
    await expect(tarjeta(page, otro.numero)).toHaveCount(0);
    await expect(page.getByText('Por preparar').first()).toBeVisible();
  });

  test('PREP-07 La vista lista muestra la misma información que el kanban', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const pedido = await crearPedidoParaPreparacion(instanciaId, usuarioId);

    await abrirTablero(page, '?vista=lista');

    await expect(page.getByRole('columnheader', { name: /estado de preparación/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: pedido.numero })).toBeVisible();
  });
});

test.describe('Visibilidad del estado de preparación en Pedidos', () => {
  test('PREP-08 El chip de preparación aparece en la lista de pedidos', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const pedido = await crearPedidoParaPreparacion(instanciaId, usuarioId);

    // Entrar al tablero materializa la preparación del pedido.
    await abrirTablero(page);
    await expect(tarjeta(page, pedido.numero)).toBeVisible({ timeout: 10000 });

    await page.goto(`/sales/pedidos?q=${encodeURIComponent(pedido.numero)}`);
    const fila = page.locator('tr').filter({ hasText: pedido.numero });
    await expect(fila).toBeVisible({ timeout: 10000 });
    await expect(fila.locator('[data-slot="chip-preparacion"]')).toBeVisible();
  });

  test('PREP-09 El detalle muestra el bloque de armado separado del de Entrega', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    await asegurarFlujoConEtapas(instanciaId);
    await limpiarEntradasPreparacion(instanciaId);
    const pedido = await crearPedidoParaPreparacion(instanciaId, usuarioId);

    await abrirTablero(page);
    await expect(tarjeta(page, pedido.numero)).toBeVisible({ timeout: 10000 });

    await page.goto(`/sales/pedidos/${pedido.pedidoId}`);

    // El rótulo dice "armado" a propósito: el bloque de Entrega tiene su propio
    // estado "Preparando", que significa otra cosa (logística).
    await expect(page.getByText(/preparación \(armado\)/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Estado del armado')).toBeVisible();
    await expect(page.getByText('Responsable')).toBeVisible();
  });

  test('PREP-10 Un pedido que nunca entró al tablero no muestra chip ni bloque (no regresión)', async ({ page }) => {
    const { id: instanciaId } = await obtenerInstanciaPruebas();
    const { id: usuarioId } = await obtenerUsuarioOwner(instanciaId);
    const pedido = await crearPedidoFueraDePreparacion(instanciaId, usuarioId);

    await page.goto(`/sales/pedidos?q=${encodeURIComponent(pedido.numero)}`);
    const fila = page.locator('tr').filter({ hasText: pedido.numero });
    await expect(fila).toBeVisible({ timeout: 10000 });
    await expect(fila.locator('[data-slot="chip-preparacion"]')).toHaveCount(0);

    await page.goto(`/sales/pedidos/${pedido.pedidoId}`);
    await expect(page.getByText(/preparación \(armado\)/i)).toHaveCount(0);
  });
});
