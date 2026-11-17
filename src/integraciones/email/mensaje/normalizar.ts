// De un correo crudo al payload que entiende el resto del sistema.
//
// El correo NO entra por un camino propio: se normaliza a
// ComandoProcesarEntrantePayload y se publica el comando ProcesarEntrante que
// ya usan WhatsApp, Instagram y Messenger. Por eso esta feature no agrega
// ningún evento nuevo al catálogo.
import { createHash } from "node:crypto";
import { simpleParser, type ParsedMail } from "mailparser";
import type { ComandoProcesarEntrantePayload } from "@/eventos/contratos/procesar-entrante.comando";
import { direccionRemitente, evaluarCorreoEntrante, nombreRemitente, type MotivoDescarte } from "./filtros";
import { limpiarCita } from "./limpiar-cita";
import { avisoAdjuntosDescartados, guardarAdjuntos } from "./adjuntos";
import { limpiarHtmlEntrante, type ResultadoLimpieza } from "./html/limpiar-html";
import { VERSION_POLITICA } from "./html/politica";
import { extraerCabeceras, type CabecerasCorreo } from "./cabeceras";
import type { AdjuntoCorreo, DatosCorreoEntrante } from "../vista/schema";

/** Tope de texto que se guarda de un correo. Más que esto no aporta y sí pesa. */
export const MAX_CARACTERES_CUERPO = 100_000;

const AVISO_RECORTE = "\n\n[Este correo se recibió recortado por su tamaño.]";

export interface CorreoNormalizado {
  payload: ComandoProcesarEntrantePayload;
  /** Asunto original: alimenta `Conversacion.asunto` y el `Re:` de la respuesta. */
  asunto: string | null;
  /** Message-ID crudo, para encadenar la respuesta dentro del hilo. */
  messageId: string | null;
  /** Raíz del hilo, para la agrupación POR_HILO. */
  hiloExterno: string | null;
  /** Nombres de los adjuntos, para dejar constancia mientras no se guardan (US4). */
  adjuntos: string[];
}

export type ResultadoNormalizacion =
  | { tipo: "DESCARTADO"; motivo: MotivoDescarte; messageId: string | null }
  | { tipo: "ACEPTADO"; correo: CorreoNormalizado };

/** Un Message-ID viene como `<id@host>`; se compara y se guarda sin los ángulos. */
export function normalizarMessageId(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpio = valor.trim().replace(/^</, "").replace(/>$/, "").trim();
  return limpio || null;
}

function primerReferencia(correo: ParsedMail): string | null {
  const refs = correo.references;
  if (!refs) return null;
  const lista = Array.isArray(refs) ? refs : [refs];
  return normalizarMessageId(lista[0]);
}

/**
 * Identificador externo del correo. Es lo que usa la deduplicación que ya
 * existe en procesarMensajeEntrante (FR-019).
 *
 * Casi todo correo trae Message-ID; cuando no (es legal no traerlo), se deriva
 * uno estable de la posición en el buzón, que no cambia entre relecturas.
 */
export function calcularIdExterno(
  messageId: string | null,
  cuentaCanalId: string,
  uidValidity: bigint,
  uid: number,
): string {
  if (messageId) return messageId;
  return createHash("sha256").update(`${cuentaCanalId}:${uidValidity}:${uid}`).digest("hex");
}

function cuerpoLegible(correo: ParsedMail): string {
  // El TEXTO sigue siendo la fuente para la IA, la búsqueda, la vista de lista
  // y las automatizaciones (035, FR-008). mailparser ya deja en `text` la
  // versión en texto, incluso cuando el correo vino solo en HTML, conservando
  // los saltos de línea y la URL de cada enlace.
  //
  // El HTML va por otro camino (`limpiarHtml`): solo se guarda limpio y solo
  // se muestra en un iframe aislado, nunca en la página de Karia (CLAUDE.md §9,
  // specs/035-correo-html-seguro/).
  const crudo = correo.text ?? "";
  const limpio = limpiarCita(crudo);
  if (limpio.length <= MAX_CARACTERES_CUERPO) return limpio;
  return limpio.slice(0, MAX_CARACTERES_CUERPO) + AVISO_RECORTE;
}

/**
 * Limpia el HTML del correo, si trae. Nunca lanza ni impide que el correo
 * entre: cualquier problema deja el correo solo en texto (FR-007). El motivo
 * se loguea; el contenido, jamás.
 */
function limpiarHtml(correo: ParsedMail, ctx: ContextoNormalizacion): ResultadoLimpieza {
  const resultado = limpiarHtmlEntrante(typeof correo.html === "string" ? correo.html : null);
  if (resultado.estado === "NO_DISPONIBLE") {
    console.warn("[correo] HTML no disponible, se guarda solo texto", {
      cuentaCanalId: ctx.cuentaCanalId,
      motivo: resultado.motivo,
    });
  }
  return resultado;
}

function datosCorreo(
  html: ResultadoLimpieza,
  cabeceras: CabecerasCorreo,
  adjuntos: AdjuntoCorreo[],
): DatosCorreoEntrante {
  const disponible = html.estado === "DISPONIBLE" ? html : null;
  return {
    estadoHtml: html.estado,
    motivoHtml: html.estado === "DISPONIBLE" ? null : html.motivo,
    htmlLimpio: disponible ? disponible.html : null,
    versionPolitica: disponible ? disponible.versionPolitica : VERSION_POLITICA,
    imagenesExternas: disponible ? disponible.imagenesExternas : [],
    adjuntos,
    ...cabeceras,
  };
}

export interface ContextoNormalizacion {
  cuentaCanalId: string;
  instanciaId: string;
  direccionBuzon: string;
  uid: number;
  uidValidity: bigint;
}

/** Parsea y normaliza un correo crudo. Decide primero si corresponde descartarlo. */
export async function normalizarCorreo(
  fuente: Buffer,
  ctx: ContextoNormalizacion,
): Promise<ResultadoNormalizacion> {
  const correo = await simpleParser(fuente);
  const messageId = normalizarMessageId(correo.messageId);

  const filtro = evaluarCorreoEntrante(correo, ctx.direccionBuzon);
  if (filtro.descartar) {
    return { tipo: "DESCARTADO", motivo: filtro.motivo ?? "REBOTE", messageId };
  }

  const remitente = direccionRemitente(correo);
  const contenido = cuerpoLegible(correo);
  const html = limpiarHtml(correo, ctx);

  const { guardados, descartados } = await guardarAdjuntos(correo.attachments ?? [], {
    instanciaId: ctx.instanciaId,
    // Solo si el HTML quedó disponible: si no, una imagen en línea es un
    // adjunto más y se ve como hoy.
    ...(html.estado === "DISPONIBLE" ? { cidsUsados: html.cidsUsados } : {}),
  });
  // Las imágenes en línea se ven dentro del cuerpo; el resto del sistema
  // (Inbox, IA, texto) solo conoce los adjuntos "de verdad".
  const visibles = guardados.filter((a) => !a.enLinea);
  const adjuntos = visibles.map((a) => a.nombre);

  // Un correo que solo trae adjunto no debe entrar con el cuerpo vacío: sin
  // texto, la conversación se ve rota en el Inbox.
  const contenidoBase =
    contenido || (adjuntos.length > 0 ? `[Correo con ${adjuntos.length} archivo(s) adjunto(s)]` : "");
  const contenidoFinal = contenidoBase + avisoAdjuntosDescartados(descartados);

  // El primer adjunto viaja en los campos de media del mensaje, que es lo que
  // el Inbox ya sabe mostrar. Los demás quedan registrados por nombre en el
  // cuerpo: soportar varios adjuntos por mensaje exigiría cambiar
  // MensajeConversacion para todos los canales, y ningún requisito lo pide.
  const principal = visibles[0];

  const asunto = correo.subject?.trim() || null;
  const hiloExterno =
    primerReferencia(correo) ?? normalizarMessageId(correo.inReplyTo) ?? messageId;

  const payload: ComandoProcesarEntrantePayload = {
    instanciaId: ctx.instanciaId,
    canal: "email",
    identificadorContacto: remitente,
    cuentaCanalId: ctx.cuentaCanalId,
    contenido: contenidoFinal,
    tipo: "TEXTO",
    idExterno: calcularIdExterno(messageId, ctx.cuentaCanalId, ctx.uidValidity, ctx.uid),
    ...(nombreRemitente(correo) ? { pushName: nombreRemitente(correo) } : {}),
    ...(asunto ? { asunto } : {}),
    ...(hiloExterno ? { hiloExterno } : {}),
    ...(principal
      ? {
          tipo: principal.esImagen ? "IMAGEN" : "DOCUMENTO",
          mediaArchivoId: principal.mediaArchivoId,
          mediaMimeType: principal.mediaMimeType,
          ...(principal.mediaUrl ? { mediaUrl: principal.mediaUrl } : {}),
        }
      : {}),
  };

  if (visibles.length > 1) {
    const extras = visibles.slice(1).map((a) => `· ${a.nombre}`).join("\n");
    payload.contenido = `${payload.contenido ?? ""}\n\n[Otros adjuntos del correo:\n${extras}]`.trim();
  }

  // Se manda siempre, aunque no haya HTML: las cabeceras se guardan igual (US2).
  payload.correo = datosCorreo(
    html,
    extraerCabeceras(correo),
    guardados.map((a) => ({
      mediaArchivoId: a.mediaArchivoId,
      nombre: a.nombre.slice(0, 500),
      mimeType: a.mimeTypeDeclarado.slice(0, 255),
      bytes: a.bytes,
      cid: a.cid ? a.cid.slice(0, 500) : null,
      enLinea: a.enLinea,
    })),
  );

  return {
    tipo: "ACEPTADO",
    correo: {
      payload,
      asunto,
      messageId,
      hiloExterno,
      adjuntos,
    },
  };
}
