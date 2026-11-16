// 035 — Respuesta de GET /api/correo/mensajes/[mensajeId] (contracts/rutas-http.md §1).
//
// Puro: arma lo que ve el navegador a partir de lo leído de la base. Acá se
// decide qué NO sale: nunca el HTML, nunca las URLs externas, nunca claves de
// storage ni configuración del buzón (FR-016).
import { expiracionNueva, firmarToken } from "./token";
import { RUTA_CORREO_AISLADO } from "./documento";
import type { MensajeCorreoParaSesion } from "./queries";
import type { DireccionCorreo } from "./schema";

export interface RespuestaCorreoMensaje {
  cabeceras: {
    de: DireccionCorreo | null;
    para: DireccionCorreo[];
    paraTotal: number;
    cc: DireccionCorreo[];
    ccTotal: number;
    asunto: string | null;
    fechaEnvio: string | null;
  } | null;
  html: {
    estado: "SIN_HTML" | "DISPONIBLE" | "NO_DISPONIBLE";
    tieneImagenesExternas: boolean;
    urlVista: string | null;
    urlVistaConImagenes: string | null;
    expiraEn: string | null;
  };
  adjuntos: { id: string; nombre: string; mimeType: string; bytes: number; urlDescarga: string }[];
}

export function construirRespuestaCorreo(
  datos: MensajeCorreoParaSesion,
  instanciaId: string,
  origen: string,
  ahora?: number,
): RespuestaCorreoMensaje {
  const correo = datos.correo;
  if (!correo) {
    return {
      cabeceras: null,
      html: { estado: "SIN_HTML", tieneImagenesExternas: false, urlVista: null, urlVistaConImagenes: null, expiraEn: null },
      adjuntos: [],
    };
  }

  const exp = expiracionNueva(ahora);
  const urlVista = (imagenes: boolean): string | null => {
    const token = firmarToken({ tipo: "vista", mensajeId: datos.mensajeId, instanciaId, imagenes, exp });
    return token ? `${origen}${RUTA_CORREO_AISLADO}/vista?t=${encodeURIComponent(token)}` : null;
  };

  const disponible = correo.estadoHtml === "DISPONIBLE";
  const vista = disponible ? urlVista(false) : null;
  // Sin secreto no hay vista: para la UI es "con formato no disponible".
  const estado = disponible && !vista ? "NO_DISPONIBLE" : correo.estadoHtml;

  return {
    cabeceras: {
      de: correo.de,
      para: correo.para,
      paraTotal: correo.paraTotal,
      cc: correo.cc,
      ccTotal: correo.ccTotal,
      asunto: correo.asunto,
      fechaEnvio: correo.fechaEnvio ? correo.fechaEnvio.toISOString() : null,
    },
    html: {
      estado,
      tieneImagenesExternas: vista !== null && correo.tieneImagenesExternas,
      urlVista: vista,
      urlVistaConImagenes: vista && correo.tieneImagenesExternas ? urlVista(true) : null,
      expiraEn: vista ? new Date(exp * 1000).toISOString() : null,
    },
    adjuntos: correo.adjuntos
      .filter((a) => !a.enLinea)
      .map((a) => ({
        id: a.mediaArchivoId,
        nombre: a.nombre,
        mimeType: a.mimeType,
        bytes: a.bytes,
        urlDescarga: `/api/correo/mensajes/${encodeURIComponent(datos.mensajeId)}/adjuntos/${encodeURIComponent(a.mediaArchivoId)}`,
      })),
  };
}
