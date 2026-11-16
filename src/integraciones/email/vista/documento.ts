// 035 — Documento y cabeceras de la vista aislada de un correo.
//
// Segunda capa de protección (la primera es la limpieza): aunque la limpieza
// fallara, el documento no puede ejecutar código, conectarse a nada, enviar
// formularios, navegar la ventana de Karia ni leer su origen. La CSP repite
// la restricción del atributo `sandbox` del iframe para que valga también si
// alguien abre la URL suelta.
//
// NO DEBILITAR para que un correo "se vea mejor" (spec FR-012).

/**
 * Permisos del sandbox, idénticos en el atributo del iframe y en la CSP.
 * Solo un clic del agente en un enlace puede abrir una pestaña nueva, sin
 * vínculo con Karia (research.md R5.1). Nunca allow-scripts ni allow-same-origin.
 */
export const PERMISOS_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";

/** Prefijo de las rutas autorizadas por token: lo único que el documento puede pedir. */
export const RUTA_CORREO_AISLADO = "/api/correo-aislado";

/** Origen público de la app, sin barra final. APP_URL manda (detrás de un proxy, el host del request puede ser interno). */
export function origenPublico(origenRequest: string): string {
  const configurado = process.env.APP_URL?.trim();
  return (configurado || origenRequest).replace(/\/+$/, "");
}

export function politicaContenidoVista(origen: string): string {
  return [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'unsafe-inline'",
    // 'self' es ambiguo en un documento de origen opaco: se escribe el origen
    // explícito, y acotado a las rutas con token.
    `img-src data: ${origen}${RUTA_CORREO_AISLADO}/`,
    "font-src 'none'",
    "connect-src 'none'",
    "media-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "manifest-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
    `sandbox ${PERMISOS_SANDBOX}`,
  ].join("; ");
}

export function cabecerasVista(origen: string): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": politicaContenidoVista(origen),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "private, no-store",
    "X-Frame-Options": "SAMEORIGIN",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()",
  };
}

/** Cabeceras para una imagen servida a la vista (cid o proxy). */
export function cabecerasImagen(): Record<string, string> {
  return {
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
}

// Estilo de Karia para la hoja del correo (no del correo). Los colores van
// fijos porque el documento está aislado y no ve los tokens de la app; la hoja
// es clara siempre porque los correos se diseñan para fondo claro.
// La barra de desplazamiento se oculta pero el desplazamiento sigue
// funcionando (spec FR-022).
const ESTILO_BASE = [
  "html{scrollbar-width:none;-ms-overflow-style:none}",
  "html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;width:0;height:0}",
  "body{margin:0;padding:16px;background:#ffffff;color:#1f2328;font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;overflow-wrap:anywhere}",
  "img{max-width:100%;height:auto}",
  "table{max-width:100%}",
  "a{color:#0b57d0}",
  "blockquote{margin:0 0 0 8px;padding-left:8px;border-left:2px solid #d0d7de;color:#57606a}",
  "img:not([src]){display:inline-block;min-width:24px;min-height:24px;background:#eef1f4;border:1px dashed #d0d7de;vertical-align:middle}",
].join("");

/** Envuelve el HTML ya preparado (prepararHtmlParaVista) en un documento completo. */
export function construirDocumentoVista(htmlPreparado: string): string {
  return (
    "<!doctype html><html><head>" +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<style>${ESTILO_BASE}</style>` +
    `</head><body>${htmlPreparado}</body></html>`
  );
}
