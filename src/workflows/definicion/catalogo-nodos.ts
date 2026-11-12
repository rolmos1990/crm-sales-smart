import { CONFIG_POR_TIPO, type TipoNodo, type ConfigNodo } from "./schema";

// Metadatos de cada tipo de nodo, compartidos por el editor (biblioteca,
// handles de salida) y por el validador (qué salidas deben conectarse).
// Agregar un tipo de nodo = una entrada acá + su schema en schema.ts.

export type CategoriaNodo = "CONTROL" | "CONVERSACION" | "CRM" | "IA";

export interface SalidaNodo {
  id: string;
  etiqueta: string;
}

export interface DefinicionTipoNodo<T extends TipoNodo> {
  tipo: T;
  etiqueta: string;
  descripcion: string;
  categoria: CategoriaNodo;
  /** Nombre de ícono de lucide-react; el editor lo resuelve. */
  icono: string;
  /** Salidas según la config actual. Con config inválida o incompleta se
   *  usan las salidas por defecto (las del config inicial). */
  salidas: (config: ConfigNodo<T>) => SalidaNodo[];
  /** Detiene la ejecución hasta un evento externo (timer, mensaje, IA). Un
   *  ciclo en el grafo solo se permite si pasa por un nodo así (D8). */
  esEspera: boolean;
  /** Envía mensajes al cliente: requiere que la conversación no esté en
   *  atención humana y que el disparador traiga una conversación. */
  enviaMensajes: boolean;
  configInicial: () => ConfigNodo<T>;
}

const S = (id: string, etiqueta: string): SalidaNodo => ({ id, etiqueta });
const SIGUIENTE = S("siguiente", "Siguiente");

type Catalogo = { [T in TipoNodo]: DefinicionTipoNodo<T> };

export const CATALOGO_NODOS: Catalogo = {
  INICIO: {
    tipo: "INICIO",
    etiqueta: "Inicio",
    descripcion: "Punto de entrada. Define qué eventos inician el Workflow.",
    categoria: "CONTROL",
    icono: "Play",
    salidas: () => [SIGUIENTE],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({ disparadoresAceptados: ["ENTRADA_ETAPA"] }),
  },
  FIN: {
    tipo: "FIN",
    etiqueta: "Fin",
    descripcion: "Termina la ejecución y registra el resultado.",
    categoria: "CONTROL",
    icono: "CircleStop",
    salidas: () => [],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({ resultado: "COMPLETADO" }),
  },
  CONDICION: {
    tipo: "CONDICION",
    etiqueta: "Condición",
    descripcion: "Bifurca según reglas sobre el contacto, la oportunidad o variables.",
    categoria: "CONTROL",
    icono: "GitBranch",
    salidas: (c) => [...c.ramas.map((r) => S(`rama:${r.id}`, r.etiqueta)), S("otro", "En otro caso")],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({
      ramas: [{ id: "r1", etiqueta: "Sí", arbol: { type: "group", logicalOperator: "AND", children: [] } }],
    }) as unknown as ConfigNodo<"CONDICION">,
  },
  TIMER: {
    tipo: "TIMER",
    etiqueta: "Esperar (Timer)",
    descripcion: "Espera minutos, horas, días o hasta una fecha antes de seguir.",
    categoria: "CONTROL",
    icono: "Timer",
    salidas: (c) =>
      Object.values(c.politicas ?? {}).includes("RUTA_ALTERNATIVA")
        ? [SIGUIENTE, S("interrumpido", "Interrumpido")]
        : [SIGUIENTE],
    esEspera: true,
    enviaMensajes: false,
    configInicial: () => ({
      modo: "DURACION",
      duracion: { cantidad: 1, unidad: "DIAS" },
      politicas: { CLIENTE_RESPONDE: "CANCELAR_WORKFLOW", CAMBIO_ETAPA: "CANCELAR_WORKFLOW" },
    }),
  },
  ENVIAR_MENSAJE: {
    tipo: "ENVIAR_MENSAJE",
    etiqueta: "Enviar mensaje",
    descripcion: "Envía un mensaje por el canal de la conversación.",
    categoria: "CONVERSACION",
    icono: "Send",
    salidas: () => [SIGUIENTE],
    esEspera: false,
    enviaMensajes: true,
    configInicial: () => ({ origen: "TEXTO", texto: "" }),
  },
  MENU: {
    tipo: "MENU",
    etiqueta: "Opciones / Menú",
    descripcion: "Presenta opciones numeradas y sigue según la elegida.",
    categoria: "CONVERSACION",
    icono: "ListOrdered",
    salidas: (c) => [
      ...c.opciones.map((o, i) => S(`opcion:${o.id}`, `${i + 1}. ${o.etiqueta}`)),
      S("invalida", "Respuesta no válida"),
      ...(c.timeout ? [S("timeout", "Sin respuesta")] : []),
    ],
    esEspera: true,
    enviaMensajes: true,
    configInicial: () => ({
      pregunta: "",
      opciones: [
        { id: "o1", etiqueta: "", sinonimos: [] },
        { id: "o2", etiqueta: "", sinonimos: [] },
      ],
      intentos: 2,
    }),
  },
  ESPERAR_RESPUESTA: {
    tipo: "ESPERAR_RESPUESTA",
    etiqueta: "Esperar respuesta",
    descripcion: "Espera un mensaje del cliente y lo guarda en una variable.",
    categoria: "CONVERSACION",
    icono: "MessageSquareReply",
    salidas: (c) => [
      S("valida", "Respondió"),
      ...(c.tipoEsperado !== "CUALQUIERA" ? [S("invalida", "Respuesta no válida")] : []),
      S("timeout", "Sin respuesta"),
    ],
    esEspera: true,
    enviaMensajes: false,
    configInicial: () => ({
      tipoEsperado: "CUALQUIERA",
      guardarEn: "respuesta",
      timeout: { cantidad: 1, unidad: "DIAS" },
      intentos: 1,
    }),
  },
  ATENCION_IA: {
    tipo: "ATENCION_IA",
    etiqueta: "Atención IA",
    descripcion: "Un agente IA responde una vez o atiende la conversación hasta cumplir el objetivo.",
    categoria: "IA",
    icono: "Bot",
    salidas: (c) =>
      c.modo === "RESPUESTA_UNICA"
        ? [S("respondido", "Respondió"), S("transferencia", "Pidió humano"), S("error", "Error")]
        : [
            S("completado", "Objetivo cumplido"),
            S("transferencia", "Pidió humano"),
            S("no_resuelto", "No resuelto"),
            S("limite", "Límite alcanzado"),
            S("error", "Error"),
          ],
    esEspera: true,
    enviaMensajes: true,
    configInicial: () => ({ agenteIAConfigId: "", modo: "CONTINUA", maxInteracciones: 10 }),
  },
  MOVER_ETAPA: {
    tipo: "MOVER_ETAPA",
    etiqueta: "Mover etapa",
    descripcion: "Mueve la oportunidad a otra etapa del pipeline.",
    categoria: "CRM",
    icono: "ArrowRightLeft",
    // FINALIZAR: al moverse, este Workflow termina (D5); solo queda la
    // salida de error para cuando el movimiento no se puede hacer.
    salidas: (c) =>
      c.workflowActual === "CONTINUAR" ? [SIGUIENTE, S("error", "No se pudo mover")] : [S("error", "No se pudo mover")],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({ pipelineId: "", stageId: "", workflowActual: "FINALIZAR" }),
  },
  ACTUALIZAR_OPORTUNIDAD: {
    tipo: "ACTUALIZAR_OPORTUNIDAD",
    etiqueta: "Actualizar oportunidad",
    descripcion: "Cambia campos, responsable o etiquetas de la oportunidad.",
    categoria: "CRM",
    icono: "PencilLine",
    salidas: () => [SIGUIENTE],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({ cambios: [] }) as unknown as ConfigNodo<"ACTUALIZAR_OPORTUNIDAD">,
  },
  CREAR_TAREA: {
    tipo: "CREAR_TAREA",
    etiqueta: "Crear tarea",
    descripcion: "Crea una tarea para un vendedor con fecha de vencimiento.",
    categoria: "CRM",
    icono: "ListTodo",
    salidas: () => [SIGUIENTE],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({
      titulo: "",
      responsable: { tipo: "RESPONSABLE_OPORTUNIDAD" },
      vencimiento: { cantidad: 1, unidad: "DIAS" },
      prioridad: "MEDIA",
    }),
  },
  NOTIFICAR_AGENTE: {
    tipo: "NOTIFICAR_AGENTE",
    etiqueta: "Notificar agente",
    descripcion: "Avisa a un usuario o al responsable de la oportunidad.",
    categoria: "CRM",
    icono: "Bell",
    salidas: () => [SIGUIENTE],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({ destinatario: { tipo: "RESPONSABLE_OPORTUNIDAD" }, mensaje: "", tambienEmail: false }),
  },
  ASIGNAR_HUMANO: {
    tipo: "ASIGNAR_HUMANO",
    etiqueta: "Asignar agente humano",
    descripcion: "Transfiere la conversación a una persona; la automatización deja de responder.",
    categoria: "CONVERSACION",
    icono: "UserRound",
    salidas: () => [SIGUIENTE],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({ destinatario: { tipo: "RESPONSABLE_OPORTUNIDAD" } }),
  },
  EJECUTAR_WORKFLOW: {
    tipo: "EJECUTAR_WORKFLOW",
    etiqueta: "Ejecutar otro Workflow",
    descripcion: "Transfiere el control a otro Workflow y termina este.",
    categoria: "CONTROL",
    icono: "Workflow",
    salidas: () => [],
    esEspera: false,
    enviaMensajes: false,
    configInicial: () => ({ workflowId: "", transferirVariables: [] }),
  },
};

/**
 * Salidas de un nodo tolerando config incompleta (borrador): en el editor
 * una rama sin condiciones todavía tiene su handle. Se intenta con la config
 * tal cual (las funciones `salidas` solo leen ids/etiquetas/modos) y, si no
 * tiene la forma mínima, con la config inicial del tipo.
 */
export function salidasDeNodo(tipo: TipoNodo, config: unknown): SalidaNodo[] {
  const definicion = CATALOGO_NODOS[tipo] as DefinicionTipoNodo<TipoNodo>;
  const parseado = CONFIG_POR_TIPO[tipo].safeParse(config);
  const candidatas = parseado.success ? [parseado.data, config] : [config];
  for (const candidata of candidatas) {
    try {
      const salidas = definicion.salidas(candidata as ConfigNodo<TipoNodo>);
      if (salidas.every((s) => typeof s.id === "string" && s.id.length > 0)) return salidas;
    } catch { /* forma incompleta: probar la siguiente */ }
  }
  return definicion.salidas(definicion.configInicial() as ConfigNodo<TipoNodo>);
}

/** Un nodo sin salidas termina la ejecución (o la transfiere). */
export function esNodoTerminal(tipo: TipoNodo, config: unknown): boolean {
  if (tipo === "MOVER_ETAPA") {
    const c = CONFIG_POR_TIPO.MOVER_ETAPA.safeParse(config);
    return !c.success || c.data.workflowActual === "FINALIZAR";
  }
  return salidasDeNodo(tipo, config).length === 0;
}

/**
 * Salida por la que el flujo sigue cuando no se elige una: el camino feliz.
 *
 * Cada `salidas` de este catálogo declara ese camino primero — ATENCION_IA
 * abre con "Objetivo cumplido", ESPERAR_RESPUESTA con "Respondió", MENU con
 * su primera opción — y el resto son desvíos (error, timeout, "En otro caso").
 * Mantener ese orden al agregar o reordenar salidas; `catalogo-nodos.test.ts`
 * lo fija tipo por tipo.
 *
 * Un nodo terminal devuelve `null`: después de él no se continúa. Lo usa el
 * editor para insertar un nodo dentro de una conexión existente.
 */
export function salidaPorDefectoDeNodo(tipo: TipoNodo, config: unknown): string | null {
  if (esNodoTerminal(tipo, config)) return null;
  return salidasDeNodo(tipo, config)[0]?.id ?? null;
}
