import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import { obtenerOpcionesEnvioConConfianza } from "@/shared/entregas/resolver-costo-envio";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

// 024-alias-ubicaciones-transportistas — a diferencia de calcular_costo_envio
// (019), esta tool nunca transfiere a un humano: devuelve TODAS las opciones
// encontradas con su nivel de confianza (contracts/ai-tools.md), incluso
// ante AMBIGUA/SIN_COINCIDENCIA, para que el agente decida cómo seguir la
// conversación (pedir precisión, comparar opciones, etc.).
const ArgsSchema = z.object({
  pais: z.string().optional(),
  provinciaEstado: z.string().optional(),
  distritoCiudad: z.string().optional(),
  corregimiento: z.string().optional(),
});

function mensajePorConfianza(confianza: "PROBABLE" | "AMBIGUA" | "SIN_COINCIDENCIA"): string {
  switch (confianza) {
    case "PROBABLE":
      return "La coincidencia con el destino no es exacta — conviene confirmar la ubicación con el cliente antes de dar el precio como definitivo.";
    case "AMBIGUA":
      return "Encontré más de una ubicación posible para lo que escribiste. Pedile al cliente que precise la provincia o el distrito antes de cotizar.";
    case "SIN_COINCIDENCIA":
      return "No hay transportistas configurados para ese destino — costo de entrega por confirmar.";
  }
}

function formatearTiempoEstimado(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min}-${max} días`;
  return `${min ?? max} día${(min ?? max) === 1 ? "" : "s"}`;
}

const ConsultarOpcionesEnvioTool: IProveedorTool = {
  name: "consultar_opciones_envio",
  definition: {
    name: "consultar_opciones_envio",
    description:
      "Devuelve TODAS las opciones de envío que cubren un destino (transportista, servicio, precio) con un nivel de confianza sobre la coincidencia de ubicación. A diferencia de calcular_costo_envio, nunca transfiere a un humano — úsala cuando el cliente pide comparar opciones, pedir una recomendación, o cuando quieras reconocer una ubicación escrita de forma coloquial o con errores de tipeo.",
    input_schema: {
      type: "object",
      properties: {
        pais: { type: "string", description: "Nombre del país — opcional si el negocio opera en un solo país" },
        provinciaEstado: { type: "string", description: "Nombre de la provincia/estado de destino" },
        distritoCiudad: { type: "string", description: "Opcional — refina la coincidencia" },
        corregimiento: { type: "string", description: "Opcional — refina la coincidencia" },
      },
      required: [],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para consultar_opciones_envio" };

    const resultado = await obtenerOpcionesEnvioConConfianza({ instanciaId: ctx.instanciaId, ...parsed.data });

    if (resultado.opciones.length === 0) {
      return {
        ok: true,
        data: { confianza: "SIN_COINCIDENCIA", opciones: [], mensaje: mensajePorConfianza("SIN_COINCIDENCIA") },
      };
    }

    // Construcción campo por campo (nunca spread) — garantiza que costoInterno,
    // margen, transportistaId, y cualquier dato interno del transportista
    // nunca lleguen a la respuesta que ve el cliente (FR-009).
    const opciones = resultado.opciones.map((o) => ({
      transportista: o.transportistaNombre,
      servicio: o.servicioNombre,
      zona: o.zonaEntregaNombre,
      precio: o.precioCliente,
      tiempoEstimado: formatearTiempoEstimado(o.tiempoMinimoDias, o.tiempoMaximoDias),
      aceptaPagoContraEntrega: o.aceptaPagoContraEntrega,
      diasEntrega: o.diasEntrega,
      horaLimiteMismoDia: o.horaLimiteMismoDia,
      confianza: o.confianza,
    }));

    // Solo PROBABLE/AMBIGUA necesitan aclaración acá — EXACTA y ALIAS son
    // ambas "cotizar directamente" (requerimiento-transportista.md sección
    // 8, niveles de confianza); SIN_COINCIDENCIA ya se manejó arriba.
    return {
      ok: true,
      data: {
        confianza: resultado.confianza,
        opciones,
        ...(resultado.confianza === "PROBABLE" || resultado.confianza === "AMBIGUA"
          ? { mensaje: mensajePorConfianza(resultado.confianza) }
          : {}),
      },
    };
  },
};

registroHerramientas.register(ConsultarOpcionesEnvioTool);
