import { z } from "zod";

// `usoEmojis` y `respuestaLarga` salieron de acá: ahora son columnas propias
// (`formatoEmojis`, `longitudRespuesta`). Zod descarta las claves que ya no
// declara, así que un agente guardado antes queda limpio al primer guardado.
export const ConfiguracionTonoSchema = z.object({
  tono: z.enum(["Cálido", "Profesional", "Directo", "Empático", "Entusiasta"]).nullable().optional(),
  formalidad: z.enum(["Formal", "Semi Formal", "Informal"]).nullable().optional(),
  llamaClientePorNombre: z.boolean().optional(),
  tuteo: z.boolean().optional(),
  usaHumor: z.boolean().optional(),
});

export type ConfiguracionTonoInput = z.infer<typeof ConfiguracionTonoSchema>;

// 009-perfil-agente-estructurado-versionado — dimensiones nuevas de identidad,
// comunicación y reglas. Todas opcionales: un agente sin ninguna configurada
// mantiene el comportamiento exacto que ya tenía (ver construirSystemPrompt).
export const LongitudRespuestaSchema = z.enum(["CORTA", "MEDIA", "LARGA"]);
export const ProactividadSchema = z.enum(["BAJA", "MEDIA", "ALTA"]);
export const IntensidadComercialSchema = z.enum(["SUAVE", "MODERADA", "DIRECTA"]);
export const EstiloRecomendacionSchema = z.enum(["CONSULTIVO", "DIRECTO", "COMPARATIVO"]);
// Formato de salida. Null = el prompt no dice nada sobre emojis.
export const FormatoEmojisSchema = z.enum(["OCASIONALES", "SIN"]);

// 028-respuestas-guia-catalogo-ia — formatos de respuesta por intención.
export const IntencionRespuestaGuiaSchema = z.enum(["PRECIO", "DISPONIBILIDAD", "ENVIO", "PAGO", "SALUDO", "OTRA"]);

export const INTENCIONES_RESPUESTA_GUIA: Record<z.infer<typeof IntencionRespuestaGuiaSchema>, string> = {
  PRECIO: "Precio",
  DISPONIBILIDAD: "Disponibilidad",
  ENVIO: "Envío",
  PAGO: "Pago",
  SALUDO: "Saludo",
  OTRA: "Otra",
};

export const MAX_RESPUESTAS_GUIA = 15;

export const RespuestaGuiaSchema = z.object({
  id: z.string().min(1).max(40),
  intencion: IntencionRespuestaGuiaSchema,
  cuandoAplica: z.string().trim().min(1, "Indica cuándo aplica").max(200),
  formato: z.string().trim().min(1, "El formato es obligatorio").max(1000),
  activa: z.boolean(),
});

export type RespuestaGuiaInput = z.infer<typeof RespuestaGuiaSchema>;

// Tipo de agente (TipoAgenteIA en Prisma). Se elige al crear el agente y
// decide con qué plantilla de instrucciones nace — ver plantillas-agente.ts.
export const TipoAgenteIASchema = z.enum(["COMERCIAL", "GERENCIA"]);

export const MAX_INSTRUCCIONES_AGENTE = 8000;
export const MAX_REGLAS_ETAPA_CICLO_VIDA = 20;
export const MAX_CUANDO_APLICA_ETAPA = 300;

/**
 * Una regla de ciclo de vida: "cuando pase <cuandoAplica>, mové la
 * oportunidad a <etapa>". La ejecuta la herramienta
 * `actualizar_etapa_oportunidad`.
 *
 * `etapa` guarda el NOMBRE y no el stageId: la herramienta resuelve contra el
 * pipeline de cada oportunidad, así que la misma regla sirve para
 * oportunidades de pipelines distintos. La UI lo elige de un desplegable con
 * las etapas reales, para que nadie escriba un nombre que no existe.
 */
export const ReglaEtapaCicloVidaSchema = z.object({
  id: z.string().min(1).max(40),
  etapa: z.string().trim().min(1, "Elegí la etapa de destino").max(100),
  cuandoAplica: z
    .string()
    .trim()
    .min(1, "Describí cuándo mover la oportunidad")
    .max(MAX_CUANDO_APLICA_ETAPA),
});

export type ReglaEtapaCicloVidaInput = z.infer<typeof ReglaEtapaCicloVidaSchema>;

export const AgenteIAConfigSchema = z.object({
  // Bloque único de instrucciones (Rol · Estilo · Proceso · Reglas). Es la
  // fuente del prompt; los campos de identidad/comunicación/reglas de abajo
  // solo siguen vigentes mientras un agente no lo tenga. El `tipo` del agente
  // no viaja acá a propósito: se elige al crearlo y publicar o restaurar una
  // versión nunca debe cambiarlo.
  instruccionesAgente: z
    .string()
    .max(
      MAX_INSTRUCCIONES_AGENTE,
      `Las instrucciones superan el máximo de ${MAX_INSTRUCCIONES_AGENTE.toLocaleString("es")} caracteres.`,
    )
    .nullable()
    .optional(),

  sistemaPrompt: z.string().optional(),
  personalidad: z.string().max(100).optional(),
  objetivo: z.string().max(300).optional(),
  especialidad: z.string().max(100).optional(),
  temperaturaOverride: z.number().min(0).max(2).nullable().optional(),
  modeloPreferido: z.string().max(100).optional(),
  memoriaHabilitada: z.boolean(),
  limiteTokensCtx: z.number().int().min(1000).max(100000),
  canalesPermitidos: z.array(z.string()).nullable().optional(),
  herramientas: z.array(z.string()).nullable().optional(),
  configuracionTono: ConfiguracionTonoSchema.nullable().optional(),

  // Identidad (FR-001)
  nombreAgente: z.string().max(100).nullable().optional(),
  rol: z.string().max(200).nullable().optional(),
  // Clave del set de avatares (ICONOS_AGENTE). No se valida contra el enum
  // del componente: una clave desconocida cae al avatar por defecto al
  // renderizar, y así el schema no se rompe si el set cambia.
  iconoAgente: z.string().max(40).nullable().optional(),
  idiomaPrincipal: z.string().max(10).nullable().optional(),
  idiomasPermitidos: z.array(z.string().max(10)).nullable().optional(),

  // Comunicación (FR-002)
  longitudRespuesta: LongitudRespuestaSchema.nullable().optional(),
  formatoSinMarkdown: z.boolean().optional(),
  formatoEmojis: FormatoEmojisSchema.nullable().optional(),
  proactividad: ProactividadSchema.nullable().optional(),
  intensidadComercial: IntensidadComercialSchema.nullable().optional(),
  estiloRecomendacion: EstiloRecomendacionSchema.nullable().optional(),

  // Reglas de ciclo de vida: a qué etapa mover la oportunidad y cuándo.
  // Solo llegan al prompt si la herramienta actualizar_etapa_oportunidad
  // está habilitada (ver construirBloqueCicloVida).
  reglasEtapaCicloVida: z
    .array(ReglaEtapaCicloVidaSchema)
    .max(MAX_REGLAS_ETAPA_CICLO_VIDA)
    .refine((lista) => new Set(lista.map((r) => r.id)).size === lista.length, "Reglas duplicadas")
    .nullable()
    .optional(),

  // Reglas y límites (FR-003, FR-004)
  frasesPreferidas: z.array(z.string().max(200)).nullable().optional(),
  frasesProhibidas: z.array(z.string().max(200)).nullable().optional(),
  comportamientosProhibidos: z.array(z.string().max(300)).nullable().optional(),
  reglasPersonalizadas: z.array(z.string().max(300)).nullable().optional(),
  condicionesTransferenciaHumano: z.array(z.string().max(300)).nullable().optional(),

  // 028-respuestas-guia-catalogo-ia
  respuestasGuia: z
    .array(RespuestaGuiaSchema)
    .max(MAX_RESPUESTAS_GUIA)
    .refine((lista) => new Set(lista.map((r) => r.id)).size === lista.length, "Respuestas guía duplicadas")
    .nullable()
    .optional(),
  catalogoEnContexto: z.boolean().optional(),

  // 033 — la documentación del comercio NO viaja en este formulario. Vive en
  // su propia tabla (DocumentoAgenteIA) y se maneja con server actions de
  // efecto inmediato. Si viajara acá, o los identificadores de OpenAI
  // llegarían al navegador, o un guardado del perfil los borraría.

  // Delay en respuesta: esperar a que el cliente termine de escribir antes de
  // contestar (ver src/ai/respuesta/ventana-espera.ts). null = heredar el
  // valor de la instancia.
  esperarAntesDeResponder: z.boolean().nullable().optional(),
  segundosEsperaRespuesta: z.number().int().min(1).max(60).nullable().optional(),
  limiteCatalogoContexto: z.number().int().min(1).max(100).optional(),
});

export type AgenteIAConfigInput = z.infer<typeof AgenteIAConfigSchema>;
