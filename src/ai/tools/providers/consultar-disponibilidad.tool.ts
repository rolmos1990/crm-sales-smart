import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";
import { calcularDisponibilidadCombo } from "@/shared/productos/inventario";

const ArgsSchema = z.object({ productoId: z.string().min(1) });

const ConsultarDisponibilidadTool: IProveedorTool = {
  name: "consultar_disponibilidad",
  definition: {
    name: "consultar_disponibilidad",
    description:
      "Consulta si un producto tiene stock disponible y la cantidad exacta. Usar siempre antes de afirmar que un producto está disponible.",
    input_schema: {
      type: "object",
      properties: { productoId: { type: "string", description: "ID del producto" } },
      required: ["productoId"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para consultar_disponibilidad" };

    const { prisma } = await import("@/shared/db/prisma");
    const producto = await prisma.producto.findFirst({
      where: { id: parsed.data.productoId, instanciaId: ctx.instanciaId },
      select: {
        manejaStock: true,
        cantidadDisponible: true,
        esCombo: true,
        componentes: { select: { cantidad: true, componente: { select: { manejaStock: true, cantidadDisponible: true, activo: true } } } },
      },
    });

    if (!producto) return { ok: false, error: "Producto no encontrado" };

    // 029-combos-productos-compuestos — un combo no tiene stock propio: se
    // puede vender tantas veces como alcancen sus componentes.
    if (producto.esCombo) {
      const disponibilidad = calcularDisponibilidadCombo(
        (producto.componentes ?? []).map((c) => ({
          cantidad: c.cantidad,
          manejaStock: c.componente.manejaStock,
          cantidadDisponible: Number(c.componente.cantidadDisponible),
          activo: c.componente.activo,
        })),
      );
      return {
        ok: true,
        data: disponibilidad === null
          ? { disponible: true, cantidadDisponible: null, manejaStock: false, esCombo: true }
          : { disponible: disponibilidad > 0, cantidadDisponible: disponibilidad, manejaStock: true, esCombo: true },
      };
    }

    if (!producto.manejaStock) {
      return { ok: true, data: { disponible: true, cantidadDisponible: null, manejaStock: false } };
    }

    const cantidad = Number(producto.cantidadDisponible);
    return {
      ok: true,
      data: { disponible: cantidad > 0, cantidadDisponible: cantidad, manejaStock: true },
    };
  },
};

registroHerramientas.register(ConsultarDisponibilidadTool);
