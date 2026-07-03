export interface ContextoTool {
  instanciaId: string;   // siempre del backend, nunca de los args del LLM
  agenteId?: string;
  conversacionId: string;
  contactoId?: string;
  oportunidadId?: string;
  herramientasPermitidas: string[];
}

export interface ResultadoTool {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface DefinicionHerramienta {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface IProveedorTool {
  readonly name: string;
  readonly definition: DefinicionHerramienta;
  execute(args: unknown, ctx: ContextoTool): Promise<ResultadoTool>;
}
