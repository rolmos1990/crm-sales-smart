// 031-memoria-y-ficha-conversacion — derivación determinista de los hechos
// de una conversación. Sin IA y sin Prisma: entra el turno ya ejecutado, sale
// el estado nuevo. Eso la hace barata de probar y imposible de equivocarse
// por culpa del modelo (FR-012).

import type { DocumentoGenerado, HechosConversacion, OrigenPrecio, PrecioInformado } from "./tipos";

/** Una herramienta que el agente ejecutó en este turno, con lo que devolvió. */
export interface HerramientaEjecutada {
  nombre: string;
  args: Record<string, unknown>;
  resultado: { ok: boolean; data?: unknown; error?: string };
}

export interface TurnoEjecutado {
  /** Mensaje que efectivamente se le envió al cliente. */
  mensajeId: string;
  textoEnviado: string;
  herramientas: HerramientaEjecutada[];
  ahora: Date;
}

interface PrecioCandidato {
  productoId: string | null;
  nombre: string;
  monto: number;
  moneda: string;
  origen: OrigenPrecio;
}

const campo = (data: unknown, clave: string): unknown =>
  data && typeof data === "object" ? (data as Record<string, unknown>)[clave] : undefined;

const comoTexto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const comoNumero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * ¿El agente realmente le dijo este monto al cliente?
 *
 * Regla de doble condición (research D6): no alcanza con que una herramienta
 * haya devuelto el precio — tiene que aparecer en el texto que salió. Sin
 * esto, una búsqueda que devuelve 10 productos dejaría 10 precios "mostrados"
 * que el cliente nunca vio, y el turno siguiente el agente se autocensuraría
 * por contradecir algo que no dijo.
 *
 * Limitación aceptada: si el agente redondea ("alrededor de 15") o escribe el
 * número en letras, no se registra. Un falso negativo solo pierde la mejora;
 * un falso positivo hace que el agente se contradiga con un fantasma.
 */
export function montoApareceEnTexto(monto: number, texto: string): boolean {
  const entero = Math.trunc(monto);
  const decimales = Math.round((monto - entero) * 100);

  const formas = new Set<string>([
    String(monto),
    `${entero}.${String(decimales).padStart(2, "0")}`,
    `${entero},${String(decimales).padStart(2, "0")}`,
  ]);
  if (decimales === 0) {
    formas.add(String(entero));
    formas.add(`${entero}.0`);
    formas.add(`${entero},0`);
  }

  // El monto tiene que estar como número suelto: "16" sí, el "16" de "2016" no.
  return [...formas].some((forma) => {
    const escapada = forma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\d.,])${escapada}(?![\\d])`).test(texto);
  });
}

function candidatosDePrecio(h: HerramientaEjecutada): PrecioCandidato[] {
  if (!h.resultado.ok) return [];
  const data = h.resultado.data;

  if (h.nombre === "consultar_precio_actual") {
    const monto = comoNumero(campo(data, "precio"));
    if (monto === null) return [];
    return [
      {
        productoId: comoTexto(h.args.productoId),
        nombre: comoTexto(campo(data, "nombre")) ?? comoTexto(h.args.nombre) ?? "el producto consultado",
        monto,
        moneda: comoTexto(campo(data, "moneda")) ?? "",
        origen: "CONSULTA_PRECIO",
      },
    ];
  }

  if (h.nombre === "buscar_productos") {
    const productos = campo(data, "productos");
    if (!Array.isArray(productos)) return [];
    return productos.flatMap((p) => {
      const monto = comoNumero(campo(p, "precio"));
      if (monto === null) return [];
      return [
        {
          productoId: comoTexto(campo(p, "id")),
          nombre: comoTexto(campo(p, "nombre")) ?? "el producto",
          monto,
          moneda: comoTexto(campo(p, "moneda")) ?? "",
          origen: "BUSQUEDA" as const,
        },
      ];
    });
  }

  if (h.nombre === "crear_cotizacion" || h.nombre === "crear_pedido") {
    const monto = comoNumero(campo(data, "total"));
    if (monto === null) return [];
    const esCotizacion = h.nombre === "crear_cotizacion";
    return [
      {
        productoId: null,
        nombre: esCotizacion ? `la cotización #${comoTexto(campo(data, "numero")) ?? ""}`.trim() : `el pedido #${comoTexto(campo(data, "numero")) ?? ""}`.trim(),
        monto,
        moneda: comoTexto(campo(data, "moneda")) ?? "",
        origen: esCotizacion ? "COTIZACION" : "PEDIDO",
      },
    ];
  }

  return [];
}

function precioInformado(turno: TurnoEjecutado): PrecioInformado | null {
  const candidatos = turno.herramientas.flatMap(candidatosDePrecio);
  // Si el agente mencionó más de uno, el último es el que cerró el mensaje.
  const mencionados = candidatos.filter((c) => montoApareceEnTexto(c.monto, turno.textoEnviado));
  const elegido = mencionados.at(-1);
  if (!elegido) return null;

  return { ...elegido, mensajeId: turno.mensajeId, informadoEn: turno.ahora.toISOString() };
}

/**
 * Última oración interrogativa del mensaje enviado (research D7). No se
 * intenta decidir si el cliente la respondió: eso es juicio semántico y vive
 * en `datosFaltantes` de la lectura interpretada.
 */
export function ultimaPregunta(texto: string): string | null {
  const preguntas = texto.match(/[¿][^¿?]*\?|[^.!?¿\n]+\?/g);
  return preguntas?.at(-1)?.trim() ?? null;
}

function productoEnFoco(turno: TurnoEjecutado): { productoId: string; nombre: string } | null {
  // 1 — señal explícita: el agente consultó precio o stock de un producto.
  for (const h of turno.herramientas) {
    if (!h.resultado.ok) continue;
    if (h.nombre !== "consultar_precio_actual" && h.nombre !== "consultar_disponibilidad") continue;
    const productoId = comoTexto(h.args.productoId);
    if (productoId) {
      return { productoId, nombre: comoTexto(campo(h.resultado.data, "nombre")) ?? comoTexto(h.args.nombre) ?? productoId };
    }
  }

  // 2 — mejor esfuerzo: primer resultado de la búsqueda. Es la señal más
  // débil, por eso va última (ya estaba marcada como tal en la spec 017).
  for (const h of turno.herramientas) {
    if (h.nombre !== "buscar_productos" || !h.resultado.ok) continue;
    const productos = campo(h.resultado.data, "productos");
    if (!Array.isArray(productos) || productos.length === 0) continue;
    const productoId = comoTexto(campo(productos[0], "id"));
    if (productoId) return { productoId, nombre: comoTexto(campo(productos[0], "nombre")) ?? productoId };
  }

  return null;
}

function documentosNuevos(turno: TurnoEjecutado): DocumentoGenerado[] {
  return turno.herramientas.flatMap((h) => {
    if (!h.resultado.ok) return [];
    const esCotizacion = h.nombre === "crear_cotizacion";
    if (!esCotizacion && h.nombre !== "crear_pedido") return [];

    const id = comoTexto(campo(h.resultado.data, esCotizacion ? "cotizacionId" : "pedidoId"));
    if (!id) return [];

    return [
      {
        tipo: (esCotizacion ? "COTIZACION" : "PEDIDO") as DocumentoGenerado["tipo"],
        id,
        numero: comoTexto(campo(h.resultado.data, "numero")) ?? "",
        total: comoNumero(campo(h.resultado.data, "total")) ?? 0,
        moneda: comoTexto(campo(h.resultado.data, "moneda")) ?? "",
        creadoEn: turno.ahora.toISOString(),
      },
    ];
  });
}

/**
 * Estado nuevo de los hechos tras un turno. Función pura: lo que no se pudo
 * observar en este turno se conserva del anterior, nunca se borra.
 */
export function derivarHechos(previos: HechosConversacion, turno: TurnoEjecutado): HechosConversacion {
  const preguntaNueva = ultimaPregunta(turno.textoEnviado);
  const yaRegistrados = new Set(previos.documentos.map((d) => d.id));

  return {
    productoEnFoco: productoEnFoco(turno) ?? previos.productoEnFoco,
    ultimoPrecioInformado: precioInformado(turno) ?? previos.ultimoPrecioInformado,
    ultimaPreguntaDelAgente: preguntaNueva
      ? { texto: preguntaNueva, mensajeId: turno.mensajeId, hechaEn: turno.ahora.toISOString(), turnosDesde: 0 }
      : previos.ultimaPreguntaDelAgente
        ? { ...previos.ultimaPreguntaDelAgente, turnosDesde: previos.ultimaPreguntaDelAgente.turnosDesde + 1 }
        : null,
    documentos: [...previos.documentos, ...documentosNuevos(turno).filter((d) => !yaRegistrados.has(d.id))],
    ultimoTurnoEn: turno.ahora.toISOString(),
  };
}
