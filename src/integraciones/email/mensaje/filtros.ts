// Qué correos NO deben entrar al CRM (FR-020).
//
// Sin esto, un aviso de vacaciones crea un contacto, una oportunidad y —peor—
// dispara al agente de IA, que responde, que vuelve a disparar el aviso de
// vacaciones. El bucle es real y sale caro en tokens y en vergüenza.
//
// Todas las señales son cabeceras estándar: ninguna adivina por el texto del
// asunto, que depende del idioma del remitente.
import type { ParsedMail } from "mailparser";
import { normalizarDireccion } from "../configuracion";

export type MotivoDescarte =
  | "AUTO_RESPUESTA"
  | "LISTA_O_BOLETIN"
  | "REBOTE"
  | "BUCLE_PROPIO_BUZON";

export interface ResultadoFiltro {
  descartar: boolean;
  motivo?: MotivoDescarte;
}

const ACEPTAR: ResultadoFiltro = { descartar: false };

/** Cabeceras cuya sola presencia delata una respuesta automática. */
const CABECERAS_AUTO = ["x-autoreply", "x-autorespond", "x-auto-response-suppress"];

// mailparser NO expone List-Id / List-Unsubscribe por separado: agrupa todas
// las cabeceras `List-*` bajo una sola clave `list`. Verificado contra la
// librería, no supuesto — buscar "list-id" acá no encuentra nunca nada.
const CABECERA_LISTA = "list";

const PRECEDENCIAS_AUTOMATICAS = new Set(["auto_reply", "bulk", "junk", "list"]);

/** Buzones de sistema que notifican entregas fallidas. */
const REMITENTES_SISTEMA = ["mailer-daemon@", "postmaster@", "no-reply@", "noreply@"];

function cabecera(correo: ParsedMail, nombre: string): string | null {
  const valor = correo.headers.get(nombre);
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "string") return valor;
  if (typeof valor === "object" && "value" in valor) return String(valor.value);
  return String(valor);
}

function tieneAlguna(correo: ParsedMail, nombres: string[]): boolean {
  return nombres.some((n) => correo.headers.has(n));
}

/** Return-Path llega parseado como dirección, no como texto: `<>` queda como
 *  una dirección vacía. Es el estándar para notificaciones de entrega. */
function returnPathVacio(correo: ParsedMail): boolean {
  const valor = correo.headers.get("return-path");
  if (valor === undefined || valor === null) return false;
  if (typeof valor === "string") {
    const limpio = valor.trim();
    return limpio === "<>" || limpio === "";
  }
  if (typeof valor === "object" && "value" in valor) {
    const direcciones = (valor as { value?: { address?: string }[] }).value ?? [];
    return direcciones.length > 0 && direcciones.every((d) => !d.address);
  }
  return false;
}

/** Content-Type llega como `{ value, params }`, así que el report-type hay que
 *  leerlo de los parámetros y no buscarlo dentro del texto. */
function esReporteDeEntrega(correo: ParsedMail): boolean {
  const valor = correo.headers.get("content-type");
  if (!valor || typeof valor !== "object" || !("value" in valor)) return false;
  const ct = valor as { value?: string; params?: Record<string, string> };
  if (ct.value?.toLowerCase() !== "multipart/report") return false;
  return ct.params?.["report-type"]?.toLowerCase() === "delivery-status";
}

/** Dirección del remitente, normalizada. Cadena vacía si el correo no trae una. */
export function direccionRemitente(correo: ParsedMail): string {
  const bruta = correo.from?.value?.[0]?.address;
  return bruta ? normalizarDireccion(bruta) : "";
}

/** Nombre visible del remitente, si lo trae ("Juan Pérez" <juan@x.com> → Juan Pérez). */
export function nombreRemitente(correo: ParsedMail): string | undefined {
  const nombre = correo.from?.value?.[0]?.name?.trim();
  return nombre ? nombre : undefined;
}

function esRebote(correo: ParsedMail, remitente: string): boolean {
  // Return-Path vacío es *el* estándar para notificaciones de entrega: existe
  // justamente para que el rebote de un rebote no rebote.
  if (returnPathVacio(correo)) return true;
  if (REMITENTES_SISTEMA.some((p) => remitente.startsWith(p))) return true;
  if (esReporteDeEntrega(correo)) return true;
  return false;
}

function esAutoRespuesta(correo: ParsedMail): boolean {
  const autoSubmitted = cabecera(correo, "auto-submitted")?.toLowerCase().trim();
  // RFC 3834: "no" es el único valor que afirma que lo escribió una persona.
  if (autoSubmitted && autoSubmitted !== "no") return true;

  if (tieneAlguna(correo, CABECERAS_AUTO)) return true;

  const precedence = cabecera(correo, "precedence")?.toLowerCase().trim();
  if (precedence && PRECEDENCIAS_AUTOMATICAS.has(precedence)) return true;

  return false;
}

/**
 * Decide si un correo entra al CRM.
 *
 * El orden importa para el log: el bucle con el propio buzón se reporta como
 * tal aunque además venga marcado como automático, porque es el síntoma de un
 * problema de configuración y conviene verlo distinguido.
 */
export function evaluarCorreoEntrante(
  correo: ParsedMail,
  direccionBuzon: string,
): ResultadoFiltro {
  const remitente = direccionRemitente(correo);
  const buzon = normalizarDireccion(direccionBuzon);

  if (remitente && remitente === buzon) {
    return { descartar: true, motivo: "BUCLE_PROPIO_BUZON" };
  }
  if (esRebote(correo, remitente)) {
    return { descartar: true, motivo: "REBOTE" };
  }
  if (esAutoRespuesta(correo)) {
    return { descartar: true, motivo: "AUTO_RESPUESTA" };
  }
  if (correo.headers.has(CABECERA_LISTA)) {
    return { descartar: true, motivo: "LISTA_O_BOLETIN" };
  }
  // Sin remitente utilizable no hay a quién atribuirle la conversación.
  if (!remitente) {
    return { descartar: true, motivo: "REBOTE" };
  }

  return ACEPTAR;
}
