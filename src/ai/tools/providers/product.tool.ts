import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({
  query: z.string().min(1),
  categoria: z.string().optional(),
  limite: z.number().int().min(1).max(10).optional(),
});

const BuscarProductosTool: IProveedorTool = {
  name: "buscar_productos",
  definition: {
    name: "buscar_productos",
    description:
      "Busca productos del catálogo. Usar cuando el cliente pregunta por productos, precios o disponibilidad.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Término de búsqueda" },
        categoria: { type: "string", description: "Filtrar por categoría (opcional)" },
        limite: { type: "number", description: "Máximo de resultados, entre 1 y 10 (default 5)" },
      },
      required: ["query"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para buscar_productos" };

    const { prisma } = await import("@/shared/db/prisma");
    const productos = await prisma.producto.findMany({
      where: {
        instanciaId: ctx.instanciaId, // tenant isolation garantizado — nunca del LLM
        activo: true,
        OR: [
          { nombre: { contains: parsed.data.query, mode: "insensitive" } },
          { descripcion: { contains: parsed.data.query, mode: "insensitive" } },
        ],
        ...(parsed.data.categoria ? { categoria: parsed.data.categoria } : {}),
      },
      select: {
        id: true,
        nombre: true,
        precio: true,
        moneda: true,
        unidad: true,
        descripcion: true,
        sku: true,
      },
      take: Math.min(parsed.data.limite ?? 5, 10),
    });

    if (productos.length === 0) {
      return { ok: true, data: { mensaje: "No se encontraron productos con ese criterio.", productos: [] } };
    }

    return {
      ok: true,
      data: {
        total: productos.length,
        productos: productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          precio: p.precio ? Number(p.precio) : null,
          moneda: p.moneda,
          unidad: p.unidad,
          descripcion: p.descripcion,
          sku: p.sku,
        })),
      },
    };
  },
};

registroHerramientas.register(BuscarProductosTool);
