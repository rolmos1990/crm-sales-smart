// Ejecuta herramientas con validaciones de seguridad:
// 1. El tool debe estar en la lista de herramientasPermitidas del agente
// 2. instanciaId siempre del context (nunca de los args del LLM)
// Las herramientas registran ellas mismas el audit a nivel de Prisma.

import { registroHerramientas } from "./registry";
import type { ContextoTool, ResultadoTool } from "./types";

export async function ejecutarHerramienta(
  nombre: string,
  args: unknown,
  ctx: ContextoTool,
): Promise<ResultadoTool> {
  if (!ctx.herramientasPermitidas.includes(nombre)) {
    return {
      ok: false,
      error: `Herramienta '${nombre}' no autorizada para este agente`,
    };
  }

  const tool = registroHerramientas.get(nombre);
  if (!tool) {
    return {
      ok: false,
      error: `Herramienta '${nombre}' no registrada`,
    };
  }

  try {
    return await tool.execute(args, ctx);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error interno en herramienta",
    };
  }
}
