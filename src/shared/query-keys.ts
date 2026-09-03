export const queryKeys = {
  contactos: {
    all: () => ["contactos"] as const,
    detail: (id: string) => ["contacto", id] as const,
  },
  empresas: {
    all: () => ["empresas"] as const,
    detail: (id: string) => ["empresa", id] as const,
  },
  oportunidades: {
    all: () => ["oportunidades"] as const,
    detail: (id: string) => ["oportunidad", id] as const,
  },
  pipeline: {
    all: () => ["pipeline"] as const,
    ops: (pipelineId: string) => ["pipeline", pipelineId, "ops"] as const,
  },
  actividades: {
    all: () => ["actividades"] as const,
    porEntidad: (tipo: string, id: string) => ["actividades", tipo, id] as const,
  },
  tags: {
    all: () => ["tags"] as const,
  },
  geografia: {
    paises: () => ["geografia", "paises"] as const,
    estados: (paisId: string) => ["geografia", "estados", paisId] as const,
    modo: () => ["geografia", "modo"] as const,
  },
  // 024-alias-ubicaciones-transportistas
  transportistas: {
    ubicacionesConAlias: (zonaEntregaId: string) => ["transportistas", "ubicaciones-con-alias", zonaEntregaId] as const,
  },
} as const;
