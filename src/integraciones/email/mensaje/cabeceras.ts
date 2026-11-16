// 035 — Cabeceras propias de un correo (De, Para, CC, fecha, asunto), para
// que cada tarjeta del hilo muestre las de ESE correo y no las de la
// conversación (US2). Apto para el worker.
import type { AddressObject, EmailAddress, ParsedMail } from "mailparser";
import type { DireccionCorreo } from "../vista/schema";

/** Tope de direcciones guardadas por lista; el total real se guarda aparte. */
export const MAX_DIRECCIONES = 50;

export interface CabecerasCorreo {
  de: DireccionCorreo | null;
  para: DireccionCorreo[];
  paraTotal: number;
  cc: DireccionCorreo[];
  ccTotal: number;
  asunto: string | null;
  fechaEnvio: string | null;
}

/** Aplana grupos ("Equipo: a@x, b@x;") a direcciones sueltas. */
function aplanar(direcciones: EmailAddress[]): EmailAddress[] {
  return direcciones.flatMap((d) => (d.group && d.group.length > 0 ? aplanar(d.group) : [d]));
}

function direccionesDe(campo: AddressObject | AddressObject[] | undefined): DireccionCorreo[] {
  if (!campo) return [];
  const objetos = Array.isArray(campo) ? campo : [campo];
  const salida: DireccionCorreo[] = [];
  for (const d of aplanar(objetos.flatMap((o) => o.value ?? []))) {
    const direccion = d.address?.trim().toLowerCase();
    if (!direccion) continue;
    const nombre = d.name?.trim() || null;
    salida.push({ nombre: nombre ? nombre.slice(0, 300) : null, direccion: direccion.slice(0, 320) });
  }
  return salida;
}

/**
 * mailparser reemplaza una cabecera Date ilegible por la hora en que parseó el
 * correo: mostrar eso como "fecha de envío" sería inventar un dato. Se
 * confirma contra la línea cruda y, si no se puede leer, queda null (la UI
 * usa entonces la fecha de recepción).
 */
function fechaEnvio(correo: ParsedMail): Date | null {
  const cruda = correo.headerLines?.find((h) => h.key === "date")?.line.replace(/^date:\s*/i, "");
  if (!cruda || Number.isNaN(Date.parse(cruda))) return null;
  return correo.date instanceof Date && !Number.isNaN(correo.date.getTime()) ? correo.date : null;
}

export function extraerCabeceras(correo: ParsedMail): CabecerasCorreo {
  const de = direccionesDe(correo.from)[0] ?? null;
  const para = direccionesDe(correo.to);
  const cc = direccionesDe(correo.cc);
  const fecha = fechaEnvio(correo);
  return {
    de,
    para: para.slice(0, MAX_DIRECCIONES),
    paraTotal: para.length,
    cc: cc.slice(0, MAX_DIRECCIONES),
    ccTotal: cc.length,
    asunto: correo.subject?.trim().slice(0, 2000) || null,
    fechaEnvio: fecha ? fecha.toISOString() : null,
  };
}
