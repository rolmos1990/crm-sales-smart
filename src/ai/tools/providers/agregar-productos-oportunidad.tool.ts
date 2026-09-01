import { z } from "zod";
import { registroHerramientas } from "@/ai/tools/registry";
import type { IProveedorTool, ContextoTool, ResultadoTool } from "@/ai/tools/types";

// research.md/contracts de 015 asumían un caso de uso existente en Sales
// para asociar productos a una oportunidad — verificado por inspección:
// `OportunidadProducto` existe en el schema pero no tiene ningún caso de
// uso implementado hoy (sin ninguna referencia en src/crm/oportunidades ni
// en ningún otro módulo). Esta tool implementa la validación mínima
// directamente en vez de delegar en algo que no existe.
const ArgsSchema = z.object({
  oportunidadId: z.string().min(1),
  productos: z
    .array(
      z.object({
        productoId: z.string().min(1),
        cantidad: z.number().positive(),
      }),
    )
    .min(1),
});

const AgregarProductosOportunidadTool: IProveedorTool = {
  name: "agregar_productos_oportunidad",
  definition: {
    name: "agregar_productos_oportunidad",
    description: "Agrega uno o más productos del catálogo a una oportunidad existente.",
    input_schema: {
      type: "object",
      properties: {
        oportunidadId: { type: "string" },
        productos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productoId: { type: "string" },
              cantidad: { type: "number" },
            },
            required: ["productoId", "cantidad"],
          },
        },
      },
      required: ["oportunidadId", "productos"],
    },
  },

  async execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: "Argumentos inválidos para agregar_productos_oportunidad" };

    const { prisma } = await import("@/shared/db/prisma");

    const oportunidad = await prisma.oportunidad.findFirst({
      where: { id: parsed.data.oportunidadId, instanciaId: ctx.instanciaId },
      select: { id: true },
    });
    if (!oportunidad) return { ok: false, error: "Oportunidad no encontrada en esta instancia" };

    const productoIds = parsed.data.productos.map((p) => p.productoId);
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds }, instanciaId: ctx.instanciaId, activo: true },
      select: { id: true, nombre: true, precio: true },
    });
    const productosPorId = new Map(productos.map((p) => [p.id, p]));

    const faltantes = productoIds.filter((id) => !productosPorId.has(id));
    if (faltantes.length > 0) {
      return { ok: false, error: `Producto(s) no encontrado(s) o inactivo(s): ${faltantes.join(", ")}` };
    }

    const lineasCalculadas = parsed.data.productos.map((p) => {
      const producto = productosPorId.get(p.productoId)!;
      const precioUnitario = Number(producto.precio);
      return {
        oportunidadId: parsed.data.oportunidadId,
        productoId: p.productoId,
        descripcion: producto.nombre,
        cantidad: p.cantidad,
        precioUnitario,
        subtotal: precioUnitario * p.cantidad,
      };
    });

    // 018-simulador-agente — validación ya hecha arriba (oportunidad y
    // productos reales), solo se omite la escritura (FR-006/FR-007).
    if (ctx.modoSimulacion) {
      return { ok: true, data: { productosAgregados: lineasCalculadas.length, previsualizado: true } };
    }

    await prisma.oportunidadProducto.createMany({ data: lineasCalculadas });

    return { ok: true, data: { productosAgregados: parsed.data.productos.length } };
  },
};

registroHerramientas.register(AgregarProductosOportunidadTool);
