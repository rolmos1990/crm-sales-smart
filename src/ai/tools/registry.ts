import type { IProveedorTool, DefinicionHerramienta } from "./types";

class ToolRegistry {
  private readonly tools = new Map<string, IProveedorTool>();

  register(tool: IProveedorTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): IProveedorTool | undefined {
    return this.tools.get(name);
  }

  obtenerDefiniciones(nombres: string[]): DefinicionHerramienta[] {
    return nombres
      .map((n) => this.tools.get(n)?.definition)
      .filter((d): d is DefinicionHerramienta => d !== undefined);
  }
}

export const registroHerramientas = new ToolRegistry();
