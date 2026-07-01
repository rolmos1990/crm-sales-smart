import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ObtenerInfoClienteTool: IProveedorTool = {
  name: "obtener_info_cliente",
  definition: {
    name: "obtener_info_cliente",
    description:
      "Obtiene datos del cliente actual: empresa y oportunidades activas. No requiere argumentos.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  async execute(_args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    if (!ctx.contactoId) {
      return { ok: false, error: "No hay contacto asociado a esta conversación" };
    }

    const { prisma } = await import("@/shared/db/prisma");

    // findUnique por id para tipado correcto, luego validamos instanciaId
    const contacto = await prisma.contacto.findUnique({
      where: { id: ctx.contactoId },
      select: {
        nombre: true,
        apellido: true,
        email: true,
        telefonoPrincipal: true,
        instanciaId: true,
        empresa: { select: { nombre: true, industria: true } },
        oportunidades: {
          // OportunidadContacto[] — filtrar oportunidades sin fecha de ganada/perdida
          where: {
            oportunidad: {
              fechaGanada: null,
              fechaPerdida: null,
              instanciaId: ctx.instanciaId,
            },
          },
          select: {
            oportunidad: {
              select: { titulo: true, etapa: true, valor: true },
            },
          },
          take: 3,
        },
      },
    });

    // Verificar que pertenece a esta instancia (tenant isolation)
    if (!contacto || contacto.instanciaId !== ctx.instanciaId) {
      return { ok: false, error: "Contacto no encontrado" };
    }

    return {
      ok: true,
      data: {
        nombre: `${contacto.nombre} ${contacto.apellido ?? ""}`.trim(),
        email: contacto.email,
        telefono: contacto.telefonoPrincipal,
        empresa: contacto.empresa
          ? { nombre: contacto.empresa.nombre, industria: contacto.empresa.industria }
          : null,
        oportunidadesActivas: contacto.oportunidades.map((oc) => ({
          titulo: oc.oportunidad.titulo,
          etapa: oc.oportunidad.etapa,
          valor: oc.oportunidad.valor ? Number(oc.oportunidad.valor) : null,
        })),
      },
    };
  },
};

registroHerramientas.register(ObtenerInfoClienteTool);
