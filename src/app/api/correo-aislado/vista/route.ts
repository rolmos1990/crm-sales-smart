// 035 — Documento del correo para el iframe aislado (autorizado por token).
//
// No usa la sesión: el iframe con sandbox no la envía (research.md R8). El
// token lo emitió /api/correo/mensajes/[id] tras verificar el comercio, y acá
// se vuelve a verificar contra la base igual. Cualquier discrepancia → 404.
import { NextRequest } from "next/server";
import { verificarToken, firmarToken } from "@/integraciones/email/vista/token";
import { obtenerCorreoDeMensaje } from "@/integraciones/email/vista/queries";
import { prepararHtmlParaVista } from "@/integraciones/email/mensaje/html/limpiar-html";
import {
  RUTA_CORREO_AISLADO,
  cabecerasVista,
  construirDocumentoVista,
  origenPublico,
} from "@/integraciones/email/vista/documento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noEncontrado() {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(req: NextRequest) {
  const token = verificarToken(req.nextUrl.searchParams.get("t"), "vista");
  if (!token) return noEncontrado();

  const correo = await obtenerCorreoDeMensaje(token.mensajeId, token.instanciaId);
  if (!correo || correo.estadoHtml !== "DISPONIBLE" || !correo.htmlLimpio) return noEncontrado();

  const origen = origenPublico(req.nextUrl.origin);
  const firmarRecurso = (tipo: "cid" | "imagen", recurso: string): string | null => {
    // Las imágenes vencen junto con la vista que las pidió.
    const t = firmarToken({ tipo, mensajeId: correo.mensajeId, instanciaId: correo.instanciaId, recurso, exp: token.exp });
    return t ? `${origen}${RUTA_CORREO_AISLADO}/${tipo}?t=${encodeURIComponent(t)}` : null;
  };

  const cidsDelCorreo = new Set(correo.adjuntos.filter((a) => a.cid).map((a) => a.cid as string));

  const html = prepararHtmlParaVista(correo.htmlLimpio, {
    imagenes: token.imagenes === true,
    urlCid: (cid) => (cidsDelCorreo.has(cid) ? firmarRecurso("cid", cid) : null),
    urlImagenExterna: (indice) =>
      indice >= 0 && indice < correo.imagenesExternas.length ? firmarRecurso("imagen", String(indice)) : null,
  });

  return new Response(construirDocumentoVista(html), { status: 200, headers: cabecerasVista(origen) });
}
