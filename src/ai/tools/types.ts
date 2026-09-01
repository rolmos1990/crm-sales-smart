export interface ContextoTool {
  instanciaId: string;   // siempre del backend, nunca de los args del LLM
  agenteId?: string;
  conversacionId: string;
  contactoId?: string;
  oportunidadId?: string;
  herramientasPermitidas: string[];
  // 018-simulador-agente — undefined/false = comportamiento actual exacto
  // (ninguna tool cambia su lógica). true = las tools que escriben datos
  // devuelven una previsualización (misma forma de ResultadoTool, con
  // `previsualizado: true` en `data`) sin tocar Prisma.
  modoSimulacion?: boolean;
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
