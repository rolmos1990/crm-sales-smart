import { z } from "zod";
import { MAX_SEGUNDOS_ESPERA, SEGUNDOS_ESPERA_DEFECTO } from "@/ai/respuesta/ventana-espera";
import { TipoDisparadorWorkflow } from "@/generated/prisma/enums";
import { ArbolCondicionesSchema } from "@/sales/flujo-venta/schema";

// Contrato de la definición de un Workflow (nodos + conexiones). Es lo que se
// guarda en Workflow.borrador y, ya validado, en WorkflowVersion.definicion.
// Los tipos se derivan de acá con z.infer — no se declaran a mano.

// ── Piezas comunes ──────────────────────────────────────────────────────────

export const LIMITE_ESPERA_DIAS = 90;
const MINUTOS_POR_UNIDAD = { MINUTOS: 1, HORAS: 60, DIAS: 24 * 60 } as const;

export const UnidadTiempoSchema = z.enum(["MINUTOS", "HORAS", "DIAS"]);

export const DuracionSchema = z
  .object({
    cantidad: z.number().int().min(1, "La cantidad debe ser al menos 1"),
    unidad: UnidadTiempoSchema,
  })
  .refine((d) => d.cantidad * MINUTOS_POR_UNIDAD[d.unidad] <= LIMITE_ESPERA_DIAS * 24 * 60, {
    message: `La espera no puede superar ${LIMITE_ESPERA_DIAS} días`,
  });

export function duracionEnMinutos(d: Duracion): number {
  return d.cantidad * MINUTOS_POR_UNIDAD[d.unidad];
}

// Nombre de una variable propia del Workflow (workflow.variables.<nombre>).
export const NombreVariableSchema = z
  .string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,39}$/, "Usa solo letras, números y guion bajo (sin espacios)");

export const DestinatarioSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("RESPONSABLE_OPORTUNIDAD") }),
  z.object({ tipo: z.literal("USUARIO"), usuarioInstanciaId: z.string().min(1, "Elige un usuario") }),
]);

const TextoRequerido = (campo: string, max = 4096) =>
  z.string().trim().min(1, `${campo} es obligatorio`).max(max);

// ── Configuración por tipo de nodo ──────────────────────────────────────────

export const ConfigInicioSchema = z.object({
  disparadoresAceptados: z
    .array(z.enum(Object.values(TipoDisparadorWorkflow) as [TipoDisparadorWorkflow, ...TipoDisparadorWorkflow[]]))
    .min(1, "Elige al menos un evento que inicie el Workflow"),
});

export const ResultadoFinSchema = z.enum([
  "COMPLETADO",
  "NO_INTERESADO",
  "TRANSFERIDO",
  "CONVERTIDO",
  "CANCELADO",
  "OTRO",
]);
export const ConfigFinSchema = z.object({
  resultado: ResultadoFinSchema,
  etiqueta: z.string().max(80).optional(),
});

// TEXTO: el mensaje se escribe en el nodo. PLANTILLA: se envía una plantilla
// de Configuración → Plantillas, leída al momento del envío (si la editan, el
// Workflow envía la versión nueva sin republicar).
export const ConfigEnviarMensajeSchema = z
  .object({
    origen: z.enum(["TEXTO", "PLANTILLA"]).default("TEXTO"),
    texto: z.string().max(4096).default(""),
    mediaUrl: z.string().optional(),
    plantillaId: z.string().optional(),
  })
  .refine((c) => c.origen !== "TEXTO" || c.texto.trim().length > 0 || !!c.mediaUrl, {
    message: "Escribe un mensaje o adjunta un archivo",
  })
  .refine((c) => c.origen !== "PLANTILLA" || !!c.plantillaId, { message: "Elige una plantilla" });

export const OpcionMenuSchema = z.object({
  id: z.string().min(1),
  etiqueta: TextoRequerido("El texto de la opción", 100),
  sinonimos: z.array(z.string().trim().min(1)).max(10).default([]),
});

export const ConfigMenuSchema = z.object({
  pregunta: TextoRequerido("La pregunta", 1024),
  opciones: z.array(OpcionMenuSchema).min(2, "Agrega al menos 2 opciones").max(10, "Máximo 10 opciones"),
  intentos: z.number().int().min(1).max(5).default(2),
  timeout: DuracionSchema.optional(),
  guardarEn: NombreVariableSchema.optional(),
});

export const TipoRespuestaEsperadaSchema = z.enum(["CUALQUIERA", "NUMERO", "EMAIL", "TELEFONO"]);
export const ConfigEsperarRespuestaSchema = z.object({
  tipoEsperado: TipoRespuestaEsperadaSchema.default("CUALQUIERA"),
  guardarEn: NombreVariableSchema,
  timeout: DuracionSchema,
  intentos: z.number().int().min(1).max(5).default(1),
});

export const RamaCondicionSchema = z.object({
  id: z.string().min(1),
  etiqueta: TextoRequerido("El nombre de la rama", 80),
  arbol: ArbolCondicionesSchema,
});
export const ConfigCondicionSchema = z.object({
  ramas: z.array(RamaCondicionSchema).min(1, "Agrega al menos una rama").max(10),
});

export const MotivoInterrupcionSchema = z.enum([
  "CLIENTE_RESPONDE",
  "CAMBIO_ETAPA",
  "OPORTUNIDAD_GANADA",
  "HUMANO_TOMA",
]);
export const AccionInterrupcionSchema = z.enum([
  "CONTINUAR_ESPERANDO",
  "CANCELAR_TIMER",
  "CANCELAR_WORKFLOW",
  "RUTA_ALTERNATIVA",
]);
export const PoliticasInterrupcionSchema = z.partialRecord(MotivoInterrupcionSchema, AccionInterrupcionSchema);

export const ConfigTimerSchema = z.discriminatedUnion("modo", [
  z.object({
    modo: z.literal("DURACION"),
    duracion: DuracionSchema,
    politicas: PoliticasInterrupcionSchema.default({}),
  }),
  z.object({
    modo: z.literal("HASTA_FECHA"),
    // Hora local de la empresa (zona de negocio), formato de <input type="datetime-local">.
    fechaHoraLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas"),
    politicas: PoliticasInterrupcionSchema.default({}),
  }),
]);

export const ConfigAtencionIASchema = z.object({
  agenteIAConfigId: z.string().min(1, "Elige un agente IA"),
  modo: z.enum(["RESPUESTA_UNICA", "CONTINUA"]),
  instrucciones: z.string().max(4000).optional(),
  objetivo: z.string().max(500).optional(),
  // Subconjunto de las herramientas del agente: puede restringir, nunca ampliar.
  herramientas: z.array(z.string()).optional(),
  maxInteracciones: z.number().int().min(1).max(50).default(10),
  maxTokens: z.number().int().min(100).optional(),
  inactividad: DuracionSchema.optional(),
  // Delay en respuesta: espera a que el cliente termine de escribir y
  // contesta una vez por todo el tramo, en vez de una por mensaje. No usa
  // DuracionSchema porque su unidad mínima es el minuto y acá se habla de
  // segundos. Ausente = sin espera (comportamiento previo).
  delayRespuesta: z
    .object({
      activo: z.boolean().default(false),
      segundos: z.number().int().min(1).max(MAX_SEGUNDOS_ESPERA).default(SEGUNDOS_ESPERA_DEFECTO),
    })
    .optional(),
});

export const ConfigMoverEtapaSchema = z.object({
  pipelineId: z.string().min(1, "Elige un pipeline"),
  stageId: z.string().min(1, "Elige una etapa"),
  motivo: z.string().max(200).optional(),
  // D5: al cambiar de etapa se cancela lo pendiente de la etapa anterior,
  // incluido este Workflow, salvo que pida CONTINUAR explícitamente.
  workflowActual: z.enum(["FINALIZAR", "CONTINUAR"]).default("FINALIZAR"),
});

export const ConfigCrearTareaSchema = z.object({
  titulo: TextoRequerido("El título", 200),
  descripcion: z.string().max(2000).optional(),
  responsable: DestinatarioSchema,
  vencimiento: DuracionSchema,
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA"]).default("MEDIA"),
});

export const ConfigNotificarAgenteSchema = z.object({
  destinatario: DestinatarioSchema,
  mensaje: TextoRequerido("El mensaje", 1000),
  tambienEmail: z.boolean().default(false),
});

export const ConfigAsignarHumanoSchema = z.object({
  destinatario: DestinatarioSchema,
  motivo: z.string().max(200).optional(),
});

// Campos que un Workflow puede modificar: lista cerrada (misma idea que
// CAMPOS_PERMITIDOS de los disparadores) + campos personalizados por clave.
export const CAMPOS_ACTUALIZABLES = [
  "titulo",
  "notas",
  "valor",
  "probabilidad",
  "responsable",
  "agregarEtiqueta",
  "quitarEtiqueta",
] as const;
export const CampoActualizableSchema = z.union([
  z.enum(CAMPOS_ACTUALIZABLES),
  z.string().regex(/^campo:[a-zA-Z0-9_]+$/, "Campo personalizado inválido"),
]);
export const ConfigActualizarOportunidadSchema = z.object({
  cambios: z
    .array(z.object({ campo: CampoActualizableSchema, valor: z.string().max(2000) }))
    .min(1, "Agrega al menos un cambio")
    .max(20),
});

export const ConfigEjecutarWorkflowSchema = z.object({
  workflowId: z.string().min(1, "Elige un Workflow"),
  transferirVariables: z.array(NombreVariableSchema).default([]),
});

export const CONFIG_POR_TIPO = {
  INICIO: ConfigInicioSchema,
  FIN: ConfigFinSchema,
  ENVIAR_MENSAJE: ConfigEnviarMensajeSchema,
  MENU: ConfigMenuSchema,
  ESPERAR_RESPUESTA: ConfigEsperarRespuestaSchema,
  CONDICION: ConfigCondicionSchema,
  TIMER: ConfigTimerSchema,
  ATENCION_IA: ConfigAtencionIASchema,
  MOVER_ETAPA: ConfigMoverEtapaSchema,
  ACTUALIZAR_OPORTUNIDAD: ConfigActualizarOportunidadSchema,
  CREAR_TAREA: ConfigCrearTareaSchema,
  NOTIFICAR_AGENTE: ConfigNotificarAgenteSchema,
  ASIGNAR_HUMANO: ConfigAsignarHumanoSchema,
  EJECUTAR_WORKFLOW: ConfigEjecutarWorkflowSchema,
} as const;

export const TIPOS_NODO = Object.keys(CONFIG_POR_TIPO) as (keyof typeof CONFIG_POR_TIPO)[];
export const TipoNodoSchema = z.enum(TIPOS_NODO as [TipoNodo, ...TipoNodo[]]);

// ── Definición ──────────────────────────────────────────────────────────────

// En el borrador la config de cada nodo puede estar incompleta (el usuario
// la va llenando); el validador de publicación aplica CONFIG_POR_TIPO.
export const NodoSchema = z.object({
  id: z.string().min(1).max(64),
  tipo: TipoNodoSchema,
  etiqueta: z.string().max(80).optional(),
  posicion: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.unknown()),
});

export const ConexionSchema = z.object({
  id: z.string().min(1).max(64),
  origen: z.string().min(1),
  salida: z.string().min(1),
  destino: z.string().min(1),
});

export const MAX_NODOS = 200;
export const DefinicionWorkflowSchema = z.object({
  version: z.literal(1),
  nodos: z.array(NodoSchema).max(MAX_NODOS, `Máximo ${MAX_NODOS} nodos`),
  conexiones: z.array(ConexionSchema).max(MAX_NODOS * 4),
});

// ── Tipos derivados ─────────────────────────────────────────────────────────

export type TipoNodo = keyof typeof CONFIG_POR_TIPO;
export type ConfigNodo<T extends TipoNodo> = z.infer<(typeof CONFIG_POR_TIPO)[T]>;
export type Duracion = z.infer<typeof DuracionSchema>;
export type Destinatario = z.infer<typeof DestinatarioSchema>;
export type NodoWorkflow = z.infer<typeof NodoSchema>;
export type ConexionWorkflow = z.infer<typeof ConexionSchema>;
export type DefinicionWorkflow = z.infer<typeof DefinicionWorkflowSchema>;
export type MotivoInterrupcion = z.infer<typeof MotivoInterrupcionSchema>;
export type AccionInterrupcion = z.infer<typeof AccionInterrupcionSchema>;

export const DEFINICION_VACIA: DefinicionWorkflow = { version: 1, nodos: [], conexiones: [] };
