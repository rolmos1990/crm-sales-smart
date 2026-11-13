// Cotización como texto plano, listo para pegar en un chat de WhatsApp.
//
// Vivía dentro de boton-copiar-cotizacion.tsx como una closure, así que no se
// podía reutilizar ni probar. Se extrajo al sacar el botón de "enviar al
// chat" del Inbox y del Workspace: los tres puntos arman el MISMO texto, y
// que el cliente reciba un documento distinto según desde dónde se mandó
// sería un error difícil de notar.
//
// Al extraerlo salieron dos errores que el original arrastraba:
//
//   - El símbolo de moneda era `moneda === "USD" ? "$" : "S/"`. Para un
//     negocio en Panamá (PAB) el texto decía soles peruanos.
//   - No incluía el costo de envío, que sí entra en el total. El cliente
//     sumaba subtotal + impuesto y no le daba el total.

/** Símbolo por moneda; para las que no están, se usa el código. */
const SIMBOLO_MONEDA: Record<string, string> = {
  PAB: "B/.",
  USD: "$",
  PEN: "S/",
  COP: "$",
  MXN: "$",
  ARS: "$",
  CLP: "$",
  EUR: "€",
};

export function simboloMoneda(moneda: string): string {
  return SIMBOLO_MONEDA[moneda] ?? moneda;
}

export interface LineaCotizacionTexto {
  descripcion: string | null;
  productoNombre: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
}

export interface DestinatarioCotizacionTexto {
  nombre?: string | null;
  apellido?: string | null;
  telefono?: string | null;
  email?: string | null;
}

export interface EntregaCotizacionTexto {
  /** Quién recibe el envío, si no es el mismo cliente. */
  nombreDestinatario?: string | null;
  transportistaNombre?: string | null;
  servicioNombre?: string | null;
  ciudad?: string | null;
  direccionEntrega?: string | null;
  estadoProvinciaNombre?: string | null;
  /** false = "por confirmar": no se anuncia un costo que todavía no es firme. */
  costoEnvioConfirmado?: boolean;
}

export interface CotizacionTexto {
  numero: string;
  moneda: string;
  fechaEmision: Date | string;
  fechaVencimiento?: Date | string | null;
  subtotal: number;
  impuesto: number;
  costoEnvio?: number;
  total: number;
  notas?: string | null;
  destinatario?: DestinatarioCotizacionTexto;
  lineas: LineaCotizacionTexto[];
  entrega?: EntregaCotizacionTexto | null;
}

const SEPARADOR = "─────────────────────";

/** dd/MM/yyyy sin date-fns: este módulo lo usan cliente y servidor. */
function fecha(valor: Date | string): string {
  const d = valor instanceof Date ? valor : new Date(valor);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function cantidadLegible(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function construirTextoCotizacion(c: CotizacionTexto): string {
  const simbolo = simboloMoneda(c.moneda);
  const monto = (n: number) => `${simbolo} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

  const partes: string[] = [];

  partes.push(`📋 COTIZACIÓN ${c.numero}`);
  partes.push(`Fecha: ${fecha(c.fechaEmision)}`);
  if (c.fechaVencimiento) partes.push(`Vence: ${fecha(c.fechaVencimiento)}`);
  partes.push("");

  const nombre = [c.destinatario?.nombre, c.destinatario?.apellido].filter(Boolean).join(" ");
  if (nombre) partes.push(`Para: ${nombre}`);
  if (c.destinatario?.telefono) partes.push(`Tel: ${c.destinatario.telefono}`);
  if (c.destinatario?.email) partes.push(`Email: ${c.destinatario.email}`);
  if (nombre || c.destinatario?.telefono || c.destinatario?.email) partes.push("");

  partes.push("PRODUCTOS:");
  for (const l of c.lineas) {
    const desc = l.productoNombre ?? l.descripcion ?? "—";
    const dto = l.descuento > 0 ? ` (${l.descuento}% dto.)` : "";
    partes.push(`${cantidadLegible(l.cantidad)}x ${desc} — ${monto(l.precioUnitario)}${dto}`);
  }

  // El destino y el transportista solo se nombran si están resueltos: una
  // entrega a medias confundiría más que ayudar.
  const envio = c.entrega;
  const destino = [envio?.ciudad, envio?.estadoProvinciaNombre].filter(Boolean).join(", ");
  if (envio && (destino || envio.transportistaNombre || envio.nombreDestinatario)) {
    partes.push("");
    partes.push("ENTREGA:");
    if (envio.nombreDestinatario) partes.push(`Recibe: ${envio.nombreDestinatario}`);
    if (envio.direccionEntrega) partes.push(`Dirección: ${envio.direccionEntrega}`);
    if (destino) partes.push(`Destino: ${destino}`);
    if (envio.transportistaNombre) {
      const servicio = envio.servicioNombre ? ` (${envio.servicioNombre})` : "";
      partes.push(`Transportista: ${envio.transportistaNombre}${servicio}`);
    }
  }

  partes.push("");
  partes.push(SEPARADOR);
  partes.push(`Subtotal:  ${monto(c.subtotal)}`);
  partes.push(`Impuesto:  ${monto(c.impuesto)}`);
  // Sin esta línea el cliente suma subtotal + impuesto y no le da el total.
  if (c.costoEnvio && c.costoEnvio > 0) {
    partes.push(`Envío:     ${monto(c.costoEnvio)}`);
  } else if (envio?.costoEnvioConfirmado === false) {
    partes.push("Envío:     por confirmar");
  }
  partes.push(`TOTAL:     ${monto(c.total)}`);
  partes.push(SEPARADOR);

  if (c.notas) {
    partes.push("");
    partes.push(`Notas: ${c.notas}`);
  }

  return partes.join("\n");
}
