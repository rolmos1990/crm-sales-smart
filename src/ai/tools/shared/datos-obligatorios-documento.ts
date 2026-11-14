// Qué datos obligatorios le faltan al agente para poder emitir una cotización
// o un pedido.
//
// Por qué vive acá y no dentro de requisitos-transportista.ts: ese módulo es
// la fuente única de lo que exige el TRANSPORTISTA y lo comparten tres
// consumidores, uno de ellos el formulario humano. Su diseño es deliberado
// —"libre al redactar, estricto en la puerta"— porque un humano sabe qué está
// dejando a medias en un borrador. El modelo no: si la tool acepta la llamada,
// da por hecho que cumplió. Así que la puerta se adelanta SOLO para el agente,
// componiendo el criterio del transportista en vez de modificarlo.
//
// Antes de esta compuerta, `crear_cotizacion` exigía únicamente `lineas`: una
// llamada sin el bloque `entrega` pasaba por `sinDatosDeEntrega`, no resolvía
// nada y creaba el documento sin método de entrega, sin aviso de ningún tipo.
// El `avisoDatosPendientes` que ya existía solo se disparaba cuando el agente
// mandaba una entrega incompleta — nunca cuando la omitía entera, que es el
// caso más grave.
//
// Puro, sin I/O: es donde van los tests.

import {
  ETIQUETA_CAMPO_REQUERIDO,
  type CampoRequerido,
} from "@/shared/entregas/requisitos-transportista";

export type DatoObligatorio = "nombreCliente" | "metodoEntrega" | "destinoEnvio" | CampoRequerido;

export const ETIQUETA_DATO_OBLIGATORIO: Record<DatoObligatorio, string> = {
  nombreCliente: "nombre del cliente",
  metodoEntrega: "si es por envío o por retiro",
  destinoEnvio: "destino del envío",
  // Las dos del transportista se reutilizan tal cual: el criterio de cuándo
  // faltan sigue siendo de camposRequeridosFaltantes, acá solo se nombran.
  ...ETIQUETA_CAMPO_REQUERIDO,
};

/** Métodos que se resuelven sin transportista: no tienen destino que validar. */
const METODOS_SIN_DESTINO: readonly string[] = ["RETIRO_TIENDA", "DIGITAL", "INSTALACION_SERVICIO"];

/** Un nombre compuesto solo por dígitos y separadores es un teléfono, no un nombre. */
const PARECE_TELEFONO = /^[\d\s+()-]+$/;

/**
 * Si el nombre sirve para emitir un documento a nombre del cliente.
 *
 * Un contacto que entra por WhatsApp sin `pushName` se crea con `nombre: ""`
 * a propósito (ver resolverContactoYConversacion: "crear contacto placeholder
 * sin nombre para que el agente lo identifique"). Y cuando el `pushName`
 * viene, puede ser el propio número. Ninguno de los dos casos cuenta como
 * nombre confirmado por el cliente.
 */
export function nombreClienteUsable(nombre: string | null | undefined): boolean {
  const limpio = nombre?.trim() ?? "";
  if (limpio.length < 2) return false;
  return !PARECE_TELEFONO.test(limpio);
}

export interface InsumosDatosObligatorios {
  /** `Contacto.nombre` tal como está guardado. */
  nombreContacto?: string | null;
  /** `entrega.nombreDestinatario` de los args — alcanza por sí solo. */
  nombreDestinatario?: string | null;
  metodoEntrega?: string | null;
  /** Si el agente mandó algún componente del destino (provincia, ciudad, …). */
  hayDestino: boolean;
  /** Lo que exige el transportista ya resuelto. Vacío o ausente si no hay. */
  camposTransportista?: CampoRequerido[];
}

/**
 * Datos obligatorios que siguen sin confirmarse. Orden estable, de lo más
 * general a lo más específico, para que los mensajes al modelo no bailen
 * entre llamadas.
 *
 * Los productos no se evalúan acá: `lineas` ya es obligatorio en el esquema
 * Zod de ambas tools (`min(1)`, con descripción, cantidad y precio por línea),
 * así que una llamada sin productos nunca llega a esta función.
 */
export function faltantesDocumentoIA(insumos: InsumosDatosObligatorios): DatoObligatorio[] {
  const faltantes: DatoObligatorio[] = [];

  if (!nombreClienteUsable(insumos.nombreContacto) && !nombreClienteUsable(insumos.nombreDestinatario)) {
    faltantes.push("nombreCliente");
  }

  const metodo = insumos.metodoEntrega?.trim();
  if (!metodo) {
    // Sin método no se puede saber si hace falta destino ni qué exige el
    // transportista: se corta acá en vez de reportar faltantes inventados.
    faltantes.push("metodoEntrega");
    return faltantes;
  }

  if (!METODOS_SIN_DESTINO.includes(metodo)) {
    if (!insumos.hayDestino) faltantes.push("destinoEnvio");
    faltantes.push(...(insumos.camposTransportista ?? []));
  }

  return faltantes;
}

/**
 * Mensaje para el agente: qué falta y qué hacer. Cadena vacía si no falta
 * nada, para poder usarla como condición.
 */
export function describirFaltantesDocumento(faltantes: DatoObligatorio[]): string {
  if (faltantes.length === 0) return "";

  const etiquetas = faltantes.map((f) => ETIQUETA_DATO_OBLIGATORIO[f]);
  // "e identificación", no "y identificación" — mismo cuidado que
  // describirCamposFaltantes.
  const union = etiquetas.at(-1)!.startsWith("i") ? "e" : "y";
  const lista =
    etiquetas.length === 1 ? etiquetas[0] : `${etiquetas.slice(0, -1).join(", ")} ${union} ${etiquetas.at(-1)}`;

  return (
    `No se emitió el documento: falta confirmar ${lista}. ` +
    `Pedíselo al cliente en la conversación y volvé a intentarlo. No lo inventes ni lo deduzcas.`
  );
}
