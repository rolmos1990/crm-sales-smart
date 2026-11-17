# Contrato: rutas HTTP

Dos familias de rutas:
- **Con sesión** (`/api/correo/...`): se piden desde la página de Karia con cookie.
- **Con token** (`/api/correo-aislado/...`): se piden desde el iframe con sandbox, que no envía la cookie
  (research R8).

Reglas para todas:
- **Cualquier discrepancia devuelve 404 con cuerpo vacío o genérico.** Entran acá: token inválido o
  vencido, otro comercio, mensaje inexistente, recurso fuera del mapa o fallo del proxy. Nunca se devuelve
  401 ni 403, para no revelar si el recurso existe.
- **Nunca se devuelve** configuración del buzón, credenciales, `keyOptimizado` ni URLs de storage
  (FR-016).

---

## 1. `GET /api/correo/mensajes/[mensajeId]` (con sesión)

Autorización: `requireSesion()` y mensaje cuyo `conversacion.instanciaId = sesion.instanciaId`.

Respuesta 200:

```ts
{
  cabeceras: {
    de: DireccionCorreo | null;
    para: DireccionCorreo[]; paraTotal: number;
    cc: DireccionCorreo[];   ccTotal: number;
    asunto: string | null;
    fechaEnvio: string | null;          // ISO UTC; se muestra con <FechaHora>
  } | null;                              // null = correo previo a 035: la UI deduce como hoy
  html: {
    estado: "SIN_HTML" | "DISPONIBLE" | "NO_DISPONIBLE";
    tieneImagenesExternas: boolean;
    urlVista: string | null;             // firmada, 15 min; null si no está DISPONIBLE o falta el secreto
    urlVistaConImagenes: string | null;  // solo si tieneImagenesExternas
    expiraEn: string | null;
  };
  adjuntos: { id: string; nombre: string; mimeType: string; bytes: number; urlDescarga: string }[];
                                          // excluye los enLinea
}
```

Cabeceras: `Cache-Control: private, no-store`.

## 2. `GET /api/correo/mensajes/[mensajeId]/adjuntos/[mediaArchivoId]` (con sesión)

Autorización: la misma que en (1), y además `mediaArchivoId` debe estar en `MensajeCorreo.adjuntos`, o
ser el `mediaArchivoId` del propio mensaje. El `MediaArchivo` debe tener el mismo `instanciaId`.

Respuesta: los bytes que entrega el proveedor de storage, con estas cabeceras:
- `Content-Disposition: attachment; filename*=UTF-8''{nombre}`
- `Content-Type: application/octet-stream`. Se fuerza siempre, para que el navegador nunca interprete el
  archivo.
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: sandbox; default-src 'none'`
- `Cache-Control: private, no-store`

## 3. `GET /api/correo-aislado/vista?t={token}` (con token)

Token: `tipo = "vista"`, `{ mensajeId, instanciaId, imagenes: boolean, exp }`.

Pasos:
1. Verifica la firma y que no haya vencido.
2. Busca el `MensajeCorreo` con ese `mensajeId` e `instanciaId` y `estadoHtml = DISPONIBLE`.
3. Ejecuta `prepararHtmlParaVista`. Las URLs de `cid` e `imagen` se firman con la misma `exp`.
4. Envuelve el resultado en el documento base (research R7).

Respuesta 200 `text/html; charset=utf-8`, con **todas** las cabeceras de research R7. Que esas cabeceras
estén presentes y sean exactas se cubre con una prueba (`documento.test.ts`).

## 4. `GET /api/correo-aislado/cid?t={token}` (con token)

Token: `tipo = "cid"`, `{ mensajeId, instanciaId, recurso: cid, exp }`.

Pasos:
1. Busca la entrada del cid en `MensajeCorreo.adjuntos`.
2. Busca el `MediaArchivo` y comprueba que tenga el mismo `instanciaId`.
3. Ejecuta `getStorageProvider().download(keyOptimizado)`.

Respuesta 200 `image/webp` con: `nosniff`, `Cache-Control: private, no-store` y
`Cross-Origin-Resource-Policy: same-origin`.

## 5. `GET /api/correo-aislado/imagen?t={token}` (con token)

Token: `tipo = "imagen"`, `{ mensajeId, instanciaId, recurso: N, exp }`.

Pasos:
1. Toma la URL `imagenesExternas[N]` del correo de ese comercio.
2. Ejecuta `descargarImagenSegura(url)` (`contracts/proxy-imagenes.md`).

Respuesta 200 `image/webp`, con las mismas cabeceras que en (4). Ante cualquier rechazo, 404.

---

## Token (`src/integraciones/email/vista/token.ts`)

```text
token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(CORREO_VISTA_SECRETO, base64url(payload)))
payload = { v: 1, t: "vista"|"cid"|"imagen", m: mensajeId, i: instanciaId, r?: string, img?: boolean, exp: epochSeconds }
```

- Verificación en tiempo constante.
- Se rechaza si `v` es distinto de 1, si `t` no coincide con la ruta o si `exp` es menor que ahora.
- Se rechaza si `exp - ahora > 15 min`. Así un token emitido con un reloj desfasado no sirve para siempre.
- Sin `CORREO_VISTA_SECRETO` (o con menos de 32 bytes), `firmar` devuelve `null` y `verificar` devuelve
  `null`: el sistema falla cerrado.

## Middleware

`RUTAS_PUBLICAS` suma `"/api/correo-aislado"`. Ninguna otra ruta cambia.
