import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

// 033 — Le da al agente acceso a la documentación que cargó el negocio.
//
// A diferencia de la base de conocimiento anterior, que se inyectaba en cada
// prompt la usara o no, acá el agente decide cuándo consultar: eso es
// exactamente lo que le pide la política del bloque de contexto (ver
// src/ai/contexto/capas/conocimiento.ts).
//
// La descripción de la herramienta es la mitad de esa decisión. Dice qué SÍ y
// —tan importante— qué NO: sin el "no sirve para precios ni stock", el modelo
// la usaría para todo, gastando una llamada de file search por mensaje y
// respondiendo con un PDF desactualizado en vez de con el dato vivo de Karia.

const ArgsSchema = z.object({
  consulta: z.string().trim().min(1).max(500),
});

const BuscarEnDocumentacionTool: IProveedorTool = {
  name: "buscar_en_documentacion",
  definition: {
    name: "buscar_en_documentacion",
    description:
      "Busca en la documentación que cargó el negocio: políticas, métodos generales de envío y retiro, " +
      "materiales, cuidados y preguntas frecuentes. NO sirve para precios, stock, pedidos ni tarifas " +
      "actuales — para eso usá las herramientas de datos. Usala solo cuando la respuesta dependa de " +
      "información del comercio que todavía no tenés en la conversación. Si no encontrás, decilo.",
    input_schema: {
      type: "object",
      properties: {
        consulta: {
          type: "string",
          description:
            "Qué buscar, en lenguaje natural. Ej: 'política de devoluciones', 'cómo se cuida el cuero'.",
        },
      },
      required: ["consulta"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para buscar_en_documentacion" };

    // Sin agente no hay a qué documentación acotar la búsqueda, y en un índice
    // compartido buscar "sin agente" no es una opción.
    if (!ctx.agenteId) {
      return { ok: false, error: "No hay un agente asociado a esta conversación" };
    }

    const { buscarEnDocumentacion } = await import("@/ai/documentacion/busqueda");

    const resultado = await buscarEnDocumentacion({
      // Del contexto del backend, nunca de `args`: aunque el modelo inyecte un
      // instanciaId en el JSON, acá no se lee.
      instanciaId: ctx.instanciaId,
      agenteId: ctx.agenteId,
      consulta: parsed.data.consulta,
      conversacionId: ctx.conversacionId,
    });

    if (!resultado.encontrado) {
      // `ok: true` con `encontrado: false` y no un error: "no hay nada sobre
      // eso" es una respuesta válida y útil. Devolverlo como error haría que
      // el modelo reintentara o se disculpara por una falla que no hubo.
      return {
        ok: true,
        data: {
          encontrado: false,
          mensaje: "No hay nada en la documentación del negocio sobre eso.",
        },
      };
    }

    return {
      ok: true,
      data: {
        encontrado: true,
        respuesta: resultado.respuesta,
        fuentes: resultado.fuentes,
      },
    };
  },
};

registroHerramientas.register(BuscarEnDocumentacionTool);

export const NOMBRE_BUSCAR_EN_DOCUMENTACION = BuscarEnDocumentacionTool.name;
