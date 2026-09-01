import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({
  nombreEtiqueta: z.string().min(1).max(50),
});

const AgregarEtiquetaContactoTool: IProveedorTool = {
  name: "agregar_etiqueta_contacto",
  definition: {
    name: "agregar_etiqueta_contacto",
    description:
      "Agrega una etiqueta o calificación al contacto actual. Usar para clasificar prospectos (ej: 'interesado', 'presupuesto alto', 'listo para comprar').",
    input_schema: {
      type: "object",
      properties: {
        nombreEtiqueta: {
          type: "string",
          description: "Nombre de la etiqueta a agregar al contacto (máx 50 caracteres)",
        },
      },
      required: ["nombreEtiqueta"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para agregar_etiqueta_contacto" };

    if (!ctx.contactoId) return { ok: false, error: "Se requiere un contacto activo para agregar la etiqueta" };

    // 018-simulador-agente — evita crear un Tag/ContactoTag real; casi toda
    // la lógica de esta tool es de escritura, sin cálculo previo que valga
    // la pena reutilizar (FR-006/FR-007).
    if (ctx.modoSimulacion) {
      return {
        ok: true,
        data: {
          nombreEtiqueta: parsed.data.nombreEtiqueta,
          previsualizado: true,
          mensaje: `[Simulación] Se habría agregado la etiqueta "${parsed.data.nombreEtiqueta}".`,
        },
      };
    }

    const { prisma } = await import("@/shared/db/prisma");

    let tag = await prisma.tag.findFirst({
      where: {
        instanciaId: ctx.instanciaId,
        nombre: { equals: parsed.data.nombreEtiqueta, mode: "insensitive" },
        activo: true,
      },
    });

    if (!tag) {
      tag = await prisma.tag.create({
        data: {
          nombre: parsed.data.nombreEtiqueta,
          instanciaId: ctx.instanciaId,
        },
      });
    }

    const yaAsignado = await prisma.contactoTag.findUnique({
      where: { contactoId_tagId: { contactoId: ctx.contactoId, tagId: tag.id } },
    });

    if (yaAsignado) {
      return {
        ok: true,
        data: { mensaje: `El contacto ya tiene la etiqueta "${tag.nombre}".`, tagId: tag.id },
      };
    }

    await prisma.contactoTag.create({
      data: { contactoId: ctx.contactoId, tagId: tag.id },
    });

    return {
      ok: true,
      data: {
        tagId: tag.id,
        nombreEtiqueta: tag.nombre,
        mensaje: `Etiqueta "${tag.nombre}" agregada al contacto exitosamente.`,
      },
    };
  },
};

registroHerramientas.register(AgregarEtiquetaContactoTool);
