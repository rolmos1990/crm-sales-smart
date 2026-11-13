// Qué datos extra del cliente exige un transportista para poder entregar.
//
// Fuente única del criterio. Lo consumen tres lugares con intenciones
// distintas y es importante que no se desincronicen:
//   - el formulario de cotización/pedido, para mostrar los campos y avisar
//     que faltan (nunca bloquea el guardado: se puede dejar un borrador a
//     medias mientras se le pregunta al cliente);
//   - crear_cotizacion / crear_pedido del agente, para devolverle qué falta
//     y que lo pida en la conversación;
//   - aprobarCotizacion, que sí bloquea — mismo criterio que "costo de
//     entrega por confirmar": libre al redactar, estricto en la puerta.
//
// Puro, sin I/O: es donde van los tests.

export interface RequisitosTransportista {
  requiereDireccionCompleta: boolean;
  requiereIdentificacion: boolean;
}

export interface DatosEntregaRequeridos {
  direccionEntrega?: string | null;
  identificacion?: string | null;
}

export type CampoRequerido = "direccionEntrega" | "identificacion";

export const ETIQUETA_CAMPO_REQUERIDO: Record<CampoRequerido, string> = {
  direccionEntrega: "dirección de entrega",
  identificacion: "identificación",
};

/** Un transportista sin fila de condiciones no exige nada — no se asume el default del schema. */
export function requisitosDeCondiciones(
  condiciones: Partial<RequisitosTransportista> | null | undefined,
): RequisitosTransportista {
  return {
    requiereDireccionCompleta: condiciones?.requiereDireccionCompleta ?? false,
    requiereIdentificacion: condiciones?.requiereIdentificacion ?? false,
  };
}

function vacio(valor: string | null | undefined): boolean {
  return !valor || valor.trim().length === 0;
}

/**
 * Qué campos exigidos por el transportista siguen vacíos. Orden estable
 * (dirección antes que identificación) para que los mensajes no bailen.
 */
export function camposRequeridosFaltantes(
  requisitos: Partial<RequisitosTransportista> | null | undefined,
  datos: DatosEntregaRequeridos | null | undefined,
): CampoRequerido[] {
  const { requiereDireccionCompleta, requiereIdentificacion } = requisitosDeCondiciones(requisitos);
  const faltantes: CampoRequerido[] = [];
  if (requiereDireccionCompleta && vacio(datos?.direccionEntrega)) faltantes.push("direccionEntrega");
  if (requiereIdentificacion && vacio(datos?.identificacion)) faltantes.push("identificacion");
  return faltantes;
}

/**
 * Frase lista para mostrar: "ServiEntrega requiere dirección de entrega e
 * identificación". Cadena vacía si no falta nada, para poder usarla como
 * condición.
 */
export function describirCamposFaltantes(
  faltantes: CampoRequerido[],
  nombreTransportista?: string | null,
): string {
  if (faltantes.length === 0) return "";
  const etiquetas = faltantes.map((c) => ETIQUETA_CAMPO_REQUERIDO[c]);
  // "e identificación", no "y identificación": la siguiente palabra empieza con i.
  const lista = etiquetas.length === 1 ? etiquetas[0] : `${etiquetas.slice(0, -1).join(", ")} e ${etiquetas.at(-1)}`;
  const quien = nombreTransportista?.trim() || "El transportista elegido";
  return `${quien} requiere ${lista}`;
}
