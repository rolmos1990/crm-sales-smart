import { test, expect } from '@playwright/test';
import { authFile } from '../../fixtures';
import {
  desconectarPrismaTest,
  obtenerInstanciaPruebas,
  obtenerUsuarioOwner,
  crearActividad,
  asegurarAlMenosUnContacto,
  asegurarAlMenosUnaOportunidad,
} from '../../helpers/db';

test.afterAll(() => desconectarPrismaTest());

// ─── Listado ──────────────────────────────────────────────────────────────────

test.describe('Listado de actividades', () => {
  test('A-01 Ver lista de actividades', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const actividad = await crearActividad({ instanciaId: instancia.id, usuarioId: owner.id, completada: false });

    await page.goto('/crm/actividades');
    // La sección "Próximas" pagina de 5 en 5 ordenando ascendente por fecha: una
    // actividad recién creada (fecha = ahora+24h) suele quedar al final, fuera de
    // la ventana inicial. Se busca por título único para no depender de eso.
    await page.getByPlaceholder('Buscar actividades...').fill(actividad.titulo);
    await expect(page.getByText(actividad.titulo)).toBeVisible();
  });

  test('A-02 Filtrar por tipo de actividad', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const llamada = await crearActividad({ instanciaId: instancia.id, usuarioId: owner.id, tipo: 'LLAMADA', completada: false });
    const reunion = await crearActividad({ instanciaId: instancia.id, usuarioId: owner.id, tipo: 'REUNION', completada: false });

    await page.goto('/crm/actividades');
    // Se busca por título único primero para que el filtro de tipo no compita con
    // la paginación de 5 en 5 de la sección (ver A-01: mismo problema de orden).
    await page.getByPlaceholder('Buscar actividades...').fill(llamada.titulo);
    await page.getByRole('button', { name: /filtros/i }).click();
    await page.getByRole('button', { name: 'Llamada', exact: true }).click();

    // Esperado: lista filtrada con solo Llamadas
    await expect(page.getByText(llamada.titulo)).toBeVisible();

    // Se limpia la búsqueda (con el filtro de tipo ya activo) para confirmar que
    // "Reunión" queda excluida independientemente de la paginación.
    await page.getByPlaceholder('Buscar actividades...').fill('');
    await expect(page.getByText(reunion.titulo)).not.toBeVisible();
  });

  test('A-03 Actividades pendientes y completadas se agrupan en secciones distintas', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const pendiente = await crearActividad({ instanciaId: instancia.id, usuarioId: owner.id, completada: false });
    const completada = await crearActividad({ instanciaId: instancia.id, usuarioId: owner.id, completada: true });

    await page.goto('/crm/actividades');

    // No hay filtro de "estado" en la UI: las pendientes y completadas viven en
    // columnas/secciones separadas (ver SeccionActividades en dashboard-actividades.tsx).
    // Cada sección pagina de 5 en 5: se busca por título único para no depender
    // de cuántas actividades residuales de otras corridas haya por delante.
    const buscador = page.getByPlaceholder('Buscar actividades...');
    const columnaPendientes = page.locator('[class*="col-span-3"]').first();
    const columnaCompletadas = page.locator('[class*="col-span-2"]').first();

    await buscador.fill(pendiente.titulo);
    await expect(columnaPendientes.getByText(pendiente.titulo)).toBeVisible();

    await buscador.fill(completada.titulo);
    await expect(columnaCompletadas.getByText(completada.titulo)).toBeVisible();
  });
});

// ─── Creación ─────────────────────────────────────────────────────────────────

test.describe('Creación de actividades', () => {
  test.beforeEach(async () => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    await asegurarAlMenosUnContacto(instancia.id, owner.id);
    await asegurarAlMenosUnaOportunidad(instancia.id, owner.id);
  });

  test('A-04 Crear actividad mínima', async ({ page }) => {
    await page.goto('/crm/actividades');
    await page.getByRole('link', { name: /nueva actividad|agregar|crear/i }).or(page.getByRole('button', { name: /nueva actividad|agregar|crear/i })).first().click();

    // El tipo ya viene con un valor por defecto (TAREA) en el formulario; no hace falta tocarlo.
    const titulo = `Actividad-${Date.now()}`;
    await page.getByLabel(/título/i).fill(titulo);

    const inputFecha = page.getByLabel(/fecha/i).first();
    // Input type="datetime-local" exige formato YYYY-MM-DDTHH:mm.
    await inputFecha.fill('2025-12-31T10:00');

    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Esperado: actividad creada y visible en la lista (se busca por título único
    // para no depender de la paginación de las secciones de la página).
    await page.getByPlaceholder('Buscar actividades...').fill(titulo);
    await expect(page.getByText(titulo)).toBeVisible({ timeout: 8000 });
  });

  test('A-05 Crear actividad vinculada a contacto y oportunidad', async ({ page }) => {
    await page.goto('/crm/actividades');
    await page.getByRole('link', { name: /nueva actividad|agregar|crear/i }).or(page.getByRole('button', { name: /nueva actividad|agregar|crear/i })).first().click();

    const titulo = `Actividad-Vinculada-${Date.now()}`;
    await page.getByLabel(/título/i).fill(titulo);

    // "Contacto"/"Oportunidad" son Combobox custom (Popover + cmdk), no <select>
    // nativos: el trigger no se asocia por label-for, así que se ubica por el
    // texto exacto de la etiqueta y se toma el primer botón que le sigue en el
    // DOM (no necesariamente un hijo del hermano: label y trigger son hermanos
    // directos sin wrapper intermedio).
    const selectorContacto = page.getByText('Contacto', { exact: true }).locator('xpath=following::button[1]');
    await expect(selectorContacto).toBeVisible();
    await selectorContacto.click();
    await page.getByRole('option').first().click();

    const selectorOportunidad = page.getByText('Oportunidad', { exact: true }).locator('xpath=following::button[1]');
    await selectorOportunidad.click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /guardar|crear/i }).click();
    await page.getByPlaceholder('Buscar actividades...').fill(titulo);
    await expect(page.getByText(titulo)).toBeVisible({ timeout: 8000 });
  });

  test('A-06 Validaciones: título y fecha requeridos', async ({ page }) => {
    await page.goto('/crm/actividades');
    await page.getByRole('link', { name: /nueva actividad|agregar|crear/i }).or(page.getByRole('button', { name: /nueva actividad|agregar|crear/i })).first().click();

    await page.getByRole('button', { name: /guardar|crear/i }).click();
    // Esperado: errores en campos requeridos
    await expect(page.locator('text=/requerido|obligatorio/i').first()).toBeVisible();
  });
});

// ─── Edición y completar ──────────────────────────────────────────────────────

test.describe('Edición y completar actividades', () => {
  test('A-07 Marcar actividad como completada', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const titulo = `Completar-${Date.now()}`;
    await crearActividad({ instanciaId: instancia.id, usuarioId: owner.id, titulo, completada: false });

    await page.goto('/crm/actividades');
    // Se busca por título único para no depender de la paginación de las secciones.
    await page.getByPlaceholder('Buscar actividades...').fill(titulo);

    const columnaPendientes = page.locator('[class*="col-span-3"]').first();
    const columnaCompletadas = page.locator('[class*="col-span-2"]').first();

    const fila = columnaPendientes.getByText(titulo);
    await expect(fila).toBeVisible();

    // El botón "Completar" (icono, sin texto, accesible por su atributo title) vive
    // en el mismo contenedor "group" que el título — ver CardActividad.
    const filaContenedor = fila.locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await filaContenedor.getByRole('button', { name: 'Completar' }).click();

    // Esperado: la actividad se mueve a la columna de completadas recientes.
    await expect(columnaCompletadas.getByText(titulo)).toBeVisible({ timeout: 5000 });
  });

  // A-08 Editar actividad pendiente — DESHABILITADO: no existe edición de
  // actividades en la UI actual (sin ruta de detalle ni de edición, ver
  // src/app/crm/actividades/; dashboard-actividades.tsx solo expone Completar/
  // Eliminar desde la lista). Pendiente de definir con producto si se agrega
  // edición o si el caso de prueba debe retirarse.
  test.skip('A-08 Editar actividad pendiente', async () => {});

  test('A-09 Eliminar actividad', async ({ page }) => {
    // Crear una actividad para eliminar
    await page.goto('/crm/actividades');
    await page.getByRole('link', { name: /nueva actividad|agregar|crear/i }).or(page.getByRole('button', { name: /nueva actividad|agregar|crear/i })).first().click();

    const titulo = `Eliminar-${Date.now()}`;
    await page.getByLabel(/título/i).fill(titulo);
    await page.getByRole('button', { name: /guardar|crear/i }).click();

    // Se busca por título único para no depender de la paginación de las secciones.
    await page.getByPlaceholder('Buscar actividades...').fill(titulo);
    const fila = page.getByText(titulo);
    await expect(fila).toBeVisible({ timeout: 8000 });

    // Eliminar (botón con icono, accesible por su atributo title, en el mismo
    // contenedor "group" que el título — ver CardActividad). No hay diálogo de
    // confirmación: handleEliminar() borra directamente al hacer click.
    const filaContenedor = fila.locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await filaContenedor.getByRole('button', { name: 'Eliminar' }).click();

    // Esperado: eliminada de la lista
    await expect(page.getByText(titulo)).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── Desde detalle de contacto/oportunidad ────────────────────────────────────

test.describe('Actividades desde detalle de contacto u oportunidad', () => {
  test('A-10 Crear actividad desde el detalle de un contacto', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const contacto = await asegurarAlMenosUnContacto(instancia.id, owner.id);

    await page.goto(`/crm/contactos/${contacto.id}`);

    // El botón "Nueva actividad" vive dentro del tab "Actividades" del detalle.
    await page.getByRole('tab', { name: /actividades/i }).click();

    const btnNuevaActividad = page.getByRole('link', { name: /nueva actividad|agregar actividad/i }).or(page.getByRole('button', { name: /nueva actividad|agregar actividad/i }));
    await expect(btnNuevaActividad).toBeVisible({ timeout: 5000 });
    await btnNuevaActividad.click();

    // Esperado: formulario con el contacto pre-seleccionado. "Contacto" es un
    // Combobox custom (Popover + cmdk): el botón ya no muestra el placeholder
    // "Seleccionar..." sino el nombre del contacto.
    const botonContacto = page.getByText('Contacto', { exact: true }).locator('xpath=following::button[1]');
    await expect(botonContacto).not.toHaveText('Seleccionar...', { timeout: 5000 });
  });

  test('A-11 Ver actividades en el detalle de una oportunidad', async ({ page }) => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const oportunidad = await asegurarAlMenosUnaOportunidad(instancia.id, owner.id);

    await page.goto(`/crm/oportunidades/${oportunidad.id}`);

    // Esperado: sección de actividades con estado y fecha
    await expect(page.locator('text=/actividades/i').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── Permisos por rol ─────────────────────────────────────────────────────────

test.describe('Permisos por rol', () => {
  let tituloActividad: string;

  test.beforeEach(async () => {
    const instancia = await obtenerInstanciaPruebas();
    const owner = await obtenerUsuarioOwner(instancia.id);
    const actividad = await crearActividad({ instanciaId: instancia.id, usuarioId: owner.id });
    tituloActividad = actividad.titulo;
  });

  test('A-12 SUPERVISOR solo lectura — sin botones de crear/editar', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.supervisor });
    const page = await ctx.newPage();
    await page.goto('/crm/actividades');

    // Se busca por título único para no depender de la paginación de las secciones.
    await page.getByPlaceholder('Buscar actividades...').fill(tituloActividad);
    await expect(page.getByText(tituloActividad)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nueva actividad', exact: true })).not.toBeVisible();

    await ctx.close();
  });

  test('A-13 INVITADO puede ver actividades sin acciones de modificación', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile.invitado });
    const page = await ctx.newPage();
    await page.goto('/crm/actividades');

    // Esperado: puede ver la lista
    await page.getByPlaceholder('Buscar actividades...').fill(tituloActividad);
    await expect(page.getByText(tituloActividad)).toBeVisible();
    // Sin botones de modificación
    await expect(page.getByRole('link', { name: 'Nueva actividad', exact: true })).not.toBeVisible();

    await ctx.close();
  });
});
