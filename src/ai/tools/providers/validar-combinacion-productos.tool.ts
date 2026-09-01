import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

const ArgsSchema = z.object({ productoIds: z.array(z.string().min(1)).min(1) });

const ValidarCombinacionProductosTool: IProveedorTool = {
  name: "validar_combinacion_productos",
  definition: {
    name: "validar_combinacion_productos",
    description: "Valida que un conjunto de productos exista y esté activo antes de armar una cotización o pedido con ellos.",
    input_schema: {
      type: "object",
      properties: {
        productoIds: { type: "array", items: { type: "string" }, description: "IDs de los productos a validar" },
      },
      required: ["productoIds"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para validar_combinacion_productos" };

    const { prisma } = await import("@/shared/db/prisma");
    const productos = await prisma.producto.findMany({
      where: { id: { in: parsed.data.productoIds }, instanciaId: ctx.instanciaId },
      select: { id: true, activo: true, tipo: true },
    });

    const encontrados = new Set(productos.map((p) => p.id));
    const faltantes = parsed.data.productoIds.filter((id) => !encontrados.has(id));
    if (faltantes.length > 0) {
      return { ok: true, data: { valida: false, motivo: `Producto(s) no encontrado(s): ${faltantes.join(", ")}` } };
    }

    const inactivos = productos.filter((p) => !p.activo);
    if (inactivos.length > 0) {
      return {
        ok: true,
        data: { valida: false, motivo: `Producto(s) inactivo(s): ${inactivos.map((p) => p.id).join(", ")}` },
      };
    }

    // research.md Decisión 2 de 015 — Karia no tiene reglas de
    // incompatibilidad entre categorías; mezclar tipos de cumplimiento es
    // solo una advertencia informativa, no un bloqueo.
    const tiposDistintos = new Set(productos.map((p) => p.tipo));
    return {
      ok: true,
      data: { valida: true, advertenciaTipoMixto: tiposDistintos.size > 1 },
    };
  },
};

registroHerramientas.register(ValidarCombinacionProductosTool);
