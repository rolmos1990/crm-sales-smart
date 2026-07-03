import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  apellido: z.string().max(100).optional(),
  telefonoPrincipal: z.string().max(30).optional(),
  email: z.string().email().optional(),
});

const ActualizarInfoContactoTool: IProveedorTool = {
  name: "actualizar_info_contacto",
  definition: {
    name: "actualizar_info_contacto",
    description:
      "Actualiza los datos del contacto (nombre, apellido, teléfono, email) con información que el cliente proporcionó durante la conversación.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre del contacto" },
        apellido: { type: "string", description: "Apellido del contacto" },
        telefonoPrincipal: { type: "string", description: "Teléfono principal" },
        email: { type: "string", description: "Correo electrónico" },
      },
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para actualizar_info_contacto" };

    if (!ctx.contactoId) return { ok: false, error: "Se requiere un contacto activo para actualizar la información" };

    const { prisma } = await import("@/shared/db/prisma");

    const contacto = await prisma.contacto.findUnique({
      where: { id: ctx.contactoId },
      select: { id: true, instanciaId: true },
    });

    if (!contacto || contacto.instanciaId !== ctx.instanciaId) {
      return { ok: false, error: "Contacto no encontrado en esta instancia" };
    }

    const datosActualizar: Record<string, string> = {};
    if (parsed.data.nombre) datosActualizar.nombre = parsed.data.nombre;
    if (parsed.data.apellido !== undefined) datosActualizar.apellido = parsed.data.apellido;
    if (parsed.data.telefonoPrincipal) datosActualizar.telefonoPrincipal = parsed.data.telefonoPrincipal;
    if (parsed.data.email) datosActualizar.email = parsed.data.email;

    if (Object.keys(datosActualizar).length === 0) {
      return { ok: false, error: "No se proporcionaron datos para actualizar" };
    }

    await prisma.contacto.update({
      where: { id: ctx.contactoId },
      data: datosActualizar,
    });

    return {
      ok: true,
      data: {
        camposActualizados: Object.keys(datosActualizar),
        mensaje: `Información del contacto actualizada: ${Object.keys(datosActualizar).join(", ")}.`,
      },
    };
  },
};

registroHerramientas.register(ActualizarInfoContactoTool);
