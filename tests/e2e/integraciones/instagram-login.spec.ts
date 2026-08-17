/**
 * Pruebas del flujo de Instagram Login (Business Login for Instagram) y del
 * webhook compartido de Instagram. Corren contra la app real (BASE_URL),
 * sin contactar a Meta — todo lo que requiere una autorización real en
 * instagram.com/api.instagram.com/graph.instagram.com (login completo,
 * cuenta Business/Creator real, cuenta personal rechazada, envío real de
 * respuesta, renovación real de token) queda fuera de esta suite y se
 * documenta como prueba manual en el informe de la integración — no hay
 * forma de automatizarlo sin credenciales de un app de prueba de Meta y un
 * usuario de Instagram real.
 *
 * Sigue el mismo estilo "soft-check" del resto de la suite (ver
 * conversaciones/inbox.spec.ts): cuando algo depende de configuración que
 * puede no existir en el ambiente donde corre (ej. META_INSTAGRAM_APP_ID),
 * se documenta con una anotación en vez de fallar la corrida completa.
 */
import { test, expect } from '@playwright/test';
import {
  obtenerInstanciaPruebas,
  crearCuentaCanalInstagram,
  contarCuentasCanalInstagram,
  eliminarCuentaCanal,
  contarMensajesPorIdExterno,
} from '../../helpers/db';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function skipSiNoConfigurado(location: string): boolean {
  return location.includes('error=no_configurado');
}

// ─── Inicio del flujo (GET /login) ─────────────────────────────────────────

test.describe('Instagram Login — inicio del flujo OAuth', () => {
  test('IGL-01 Redirige a instagram.com con los scopes correctos y genera un state + cookie de nonce', async ({ request }) => {
    const res = await request.get('/api/integraciones/instagram/login', { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());

    const location = res.headers()['location'] ?? '';
    if (skipSiNoConfigurado(location)) {
      test.info().annotations.push({
        type: 'note',
        description: 'META_INSTAGRAM_APP_ID/SECRET no configurados en este ambiente — no se pudo verificar la URL de instagram.com. Configurar para correr esta prueba en CI/staging.',
      });
      return;
    }

    const url = new URL(location);
    expect(url.hostname).toBe('www.instagram.com');
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');

    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('instagram_business_basic');
    expect(scope).toContain('instagram_business_manage_messages');
    expect(scope).toContain('instagram_business_manage_comments');
    // Instagram Basic Display NUNCA debe usarse — validamos que no estemos
    // pidiendo sus scopes por error de copy/paste.
    expect(scope).not.toContain('user_profile');
    expect(scope).not.toContain('user_media');

    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('client_id')).toBeTruthy();

    const setCookie = res.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain('ig_login_nonce=');
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  test('IGL-06 Sin sesión, el flujo no permite iniciar la conexión', async ({ browser }) => {
    // Contexto nuevo sin storageState (sin cookies de sesión) — a diferencia
    // del resto de la suite, que corre autenticada como owner por defecto.
    const contexto = await browser.newContext();
    const res = await contexto.request.get(`${BASE_URL}/api/integraciones/instagram/login`, { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(location).toMatch(/\/login/);
    await contexto.close();
  });
});

// ─── Callback ───────────────────────────────────────────────────────────────

test.describe('Instagram Login — callback', () => {
  test('IGL-02 Rechaza un state manipulado/inválido', async ({ request }) => {
    const res = await request.get(
      '/api/integraciones/instagram/login/callback?code=codigo-de-prueba&state=esto-no-es-un-state-valido',
      { maxRedirects: 0 },
    );
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('error=state');
  });

  test('IGL-03 Usuario cancela / rechaza permisos', async ({ request }) => {
    const res = await request.get(
      '/api/integraciones/instagram/login/callback?error=access_denied&error_reason=user_denied&error_description=El+usuario+cancel%C3%B3',
      { maxRedirects: 0 },
    );
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('error=cancelado');
  });

  test('IGL-04 Rechaza la falta de code/state', async ({ request }) => {
    const res = await request.get('/api/integraciones/instagram/login/callback', { maxRedirects: 0 });
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('error=parametros');
  });

  test('IGL-05 Rechaza si falta la cookie de nonce (protección CSRF)', async ({ request, browser }) => {
    const loginRes = await request.get('/api/integraciones/instagram/login', { maxRedirects: 0 });
    const location = loginRes.headers()['location'] ?? '';
    if (skipSiNoConfigurado(location)) {
      test.info().annotations.push({ type: 'note', description: 'META_INSTAGRAM_APP_ID/SECRET no configurados — se omite' });
      return;
    }
    const state = new URL(location).searchParams.get('state')!;

    // Contexto sin la cookie ig_login_nonce que dejó la llamada anterior.
    const contextoLimpio = await browser.newContext();
    const res = await contextoLimpio.request.get(
      `${BASE_URL}/api/integraciones/instagram/login/callback?code=codigo-de-prueba&state=${encodeURIComponent(state)}`,
      { maxRedirects: 0 },
    );
    const loc = res.headers()['location'] ?? '';
    expect(loc).toContain('error=state');
    await contextoLimpio.close();
  });
});

// ─── Compatibilidad: flujo heredado y otros canales no se rompen ──────────────

test.describe('Compatibilidad — flujo heredado y otros canales', () => {
  test('IGL-07 El endpoint OAuth heredado (Facebook Login) sigue respondiendo', async ({ request }) => {
    // No probamos el diálogo de Facebook en sí (fuera de alcance), solo que
    // la ruta sigue existiendo y respondiendo — es la garantía de que no la
    // tocamos al agregar el flujo nuevo.
    const res = await request.get('/api/integraciones/instagram/oauth', { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
  });

  test('IGL-08 El webhook de WhatsApp Lite no se ve afectado por los cambios en Instagram', async ({ request }) => {
    const res = await request.get('/api/webhooks/whatsapp_lite?hub.mode=subscribe&hub.verify_token=token-incorrecto&hub.challenge=abc', {
      maxRedirects: 0,
    });
    // Token incorrecto → 403, igual que antes. Solo confirma que la ruta
    // compartida [canal]/route.ts sigue viva y no rompió por los cambios.
    expect(res.status()).toBe(403);
  });

  test('IGL-12 Verificación GET del webhook de Instagram — token correcto responde el challenge, incorrecto da 403', async ({ request }) => {
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken) {
      test.info().annotations.push({ type: 'note', description: 'WEBHOOK_VERIFY_TOKEN no disponible en este ambiente — se omite' });
      return;
    }
    const challenge = `challenge-${Date.now()}`;
    const ok = await request.get(
      `/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${challenge}`,
    );
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toBe(challenge);

    const bad = await request.get(
      `/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=token-incorrecto&hub.challenge=${challenge}`,
    );
    expect(bad.status()).toBe(403);
  });
});

// ─── Datos: duplicados y webhook de mensajes ───────────────────────────────────

test.describe('Instagram — datos y webhook de mensajes', () => {
  test('IGL-09 No se puede duplicar la misma cuenta de Instagram dentro de una organización', async () => {
    const instancia = await obtenerInstanciaPruebas();
    const identificador = `test-ig-dup-${Date.now()}`;

    const primera = await crearCuentaCanalInstagram({ instanciaId: instancia.id, identificador });
    let fallo = false;
    try {
      await crearCuentaCanalInstagram({ instanciaId: instancia.id, identificador });
    } catch {
      fallo = true;
    }
    expect(fallo).toBe(true); // el índice único parcial (instanciaId, identificador) WHERE canal='instagram' lo bloquea

    const cantidad = await contarCuentasCanalInstagram(instancia.id, identificador);
    expect(cantidad).toBe(1);

    await eliminarCuentaCanal(primera.id);
  });

  test('IGL-10 El webhook responde rápido (200) ante un mensaje entrante bien formado', async ({ request }) => {
    const instancia = await obtenerInstanciaPruebas();
    const identificador = `test-ig-msg-${Date.now()}`;
    const cuenta = await crearCuentaCanalInstagram({ instanciaId: instancia.id, identificador });
    const mid = `mid-test-${Date.now()}`;

    try {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: identificador,
            time: Date.now(),
            messaging: [
              {
                sender: { id: `contacto-test-${Date.now()}` },
                recipient: { id: identificador },
                timestamp: Date.now(),
                message: { mid, text: 'Hola, mensaje de prueba E2E' },
              },
            ],
          },
        ],
      };

      const inicio = Date.now();
      const res = await request.post('/api/webhooks/instagram', { data: payload });
      const duracionMs = Date.now() - inicio;

      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      // Meta espera un ack rápido (procesamiento real es asíncrono vía cola).
      expect(duracionMs).toBeLessThan(5000);
    } finally {
      await eliminarCuentaCanal(cuenta.id);
    }
  });

  test('IGL-11 El webhook no crece el conteo de mensajes al reenviar el mismo idExterno (idempotencia)', async ({ request }) => {
    const instancia = await obtenerInstanciaPruebas();
    const identificador = `test-ig-idem-${Date.now()}`;
    const cuenta = await crearCuentaCanalInstagram({ instanciaId: instancia.id, identificador });
    const mid = `mid-test-idem-${Date.now()}`;

    const payload = {
      object: 'instagram',
      entry: [
        {
          id: identificador,
          messaging: [
            {
              sender: { id: `contacto-test-${Date.now()}` },
              recipient: { id: identificador },
              timestamp: Date.now(),
              message: { mid, text: 'Mensaje duplicado de prueba' },
            },
          ],
        },
      ],
    };

    try {
      const res1 = await request.post('/api/webhooks/instagram', { data: payload });
      expect(res1.status()).toBe(200);

      // Da tiempo a que el consumidor asíncrono (si está corriendo en este
      // ambiente) escriba el MensajeConversacion antes del reintento — el
      // guard de idempotencia de la ruta consulta por idExterno existente.
      await new Promise((r) => setTimeout(r, 1500));

      const res2 = await request.post('/api/webhooks/instagram', { data: payload });
      expect(res2.status()).toBe(200);

      await new Promise((r) => setTimeout(r, 1500));

      const cantidad = await contarMensajesPorIdExterno(mid);
      // 0 si el worker/consumidor no corre en este ambiente (no hay nada que
      // contar todavía), 1 si sí corrió — nunca más de 1.
      expect(cantidad).toBeLessThanOrEqual(1);
      if (cantidad === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'El consumidor de RabbitMQ no parece estar corriendo en este ambiente — no se pudo verificar el conteo final en MensajeConversacion, solo que el webhook no falló ni se comportó de forma distinta en el reintento.',
        });
      }
    } finally {
      await eliminarCuentaCanal(cuenta.id);
    }
  });
});
