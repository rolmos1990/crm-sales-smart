import type { PayloadNotificacion, EmailTemplate } from "./types"

export function renderNotificacion(data: PayloadNotificacion): EmailTemplate {
  const boton = data.urlAccion
    ? `<a href="${data.urlAccion}"
        style="display:inline-block;background:#84cc16;color:#0f172a;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;">
        ${data.textoAccion ?? "Ver detalle"}
      </a>`
    : ""

  const textoAccion = data.urlAccion
    ? `\n\n${data.textoAccion ?? "Ver detalle"}: ${data.urlAccion}`
    : ""

  return {
    subject: data.titulo,
    text: `${data.titulo}\n\n${data.cuerpo}${textoAccion}`,
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px;max-width:600px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#84cc16;">
                KariaApp CRM
              </p>
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f8fafc;letter-spacing:-0.02em;">
                ${data.titulo}
              </h2>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#94a3b8;">
                ${data.cuerpo}
              </p>
              ${boton}
              <p style="margin:40px 0 0;font-size:12px;color:#475569;">
                Este mensaje es automático, no responder.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }
}
