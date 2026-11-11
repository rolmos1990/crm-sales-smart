import {
  CONFIG_POR_TIPO,
  DefinicionWorkflowSchema,
  type ConfigNodo,
  type DefinicionWorkflow,
  type Destinatario,
  type NodoWorkflow,
} from "./schema";
import { CATALOGO_NODOS, esNodoTerminal, salidasDeNodo } from "./catalogo-nodos";
import { esVariableConocida, extraerVariables, textosConVariables, variablesDeclaradas } from "./variables";

// Reglas para publicar un Workflow (docs/WORKFLOWS-PROPUESTA-ARQUITECTURA.md,
// E.4). Un borrador puede guardarse con errores; publicar exige 0 errores.
// Las advertencias se muestran pero no bloquean.

export type CodigoProblema =
  | "FORMATO_INVALIDO"
  | "ID_DUPLICADO"
  | "SIN_INICIO"
  | "VARIOS_INICIOS"
  | "SIN_FIN"
  | "CONFIG_INCOMPLETA"
  | "CONEXION_NODO_INEXISTENTE"
  | "CONEXION_SALIDA_INEXISTENTE"
  | "INICIO_CON_ENTRADA"
  | "SALIDA_SIN_CONECTAR"
  | "SALIDA_DUPLICADA"
  | "NODO_INALCANZABLE"
  | "SIN_CAMINO_A_FIN"
  | "CICLO_SIN_ESPERA"
  | "VARIABLE_DESCONOCIDA"
  | "TIMER_SIN_POLITICA_RESPUESTA"
  | "AGENTE_IA_INEXISTENTE"
  | "ETAPA_INEXISTENTE"
  | "ETAPA_CON_WORKFLOW"
  | "USUARIO_INEXISTENTE"
  | "ETIQUETA_INEXISTENTE"
  | "WORKFLOW_NO_PUBLICADO"
  | "RECURSION_WORKFLOWS";

export interface ProblemaValidacion {
  codigo: CodigoProblema;
  mensaje: string;
  nodoId?: string;
  conexionId?: string;
}

export interface ResultadoValidacion {
  valido: boolean;
  errores: ProblemaValidacion[];
  advertencias: ProblemaValidacion[];
}

function nombreNodo(n: NodoWorkflow): string {
  return n.etiqueta?.trim() || CATALOGO_NODOS[n.tipo].etiqueta;
}

// ── Estructura (puro, sin base de datos) ────────────────────────────────────

export function validarEstructura(entrada: unknown): ResultadoValidacion & { definicion?: DefinicionWorkflow } {
  const errores: ProblemaValidacion[] = [];
  const advertencias: ProblemaValidacion[] = [];

  const parseado = DefinicionWorkflowSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      valido: false,
      errores: [{ codigo: "FORMATO_INVALIDO", mensaje: "La definición del Workflow no tiene un formato válido" }],
      advertencias,
    };
  }
  const def = parseado.data;
  const nodos = new Map<string, NodoWorkflow>();

  for (const n of def.nodos) {
    if (nodos.has(n.id)) errores.push({ codigo: "ID_DUPLICADO", mensaje: `Hay dos nodos con el id "${n.id}"`, nodoId: n.id });
    nodos.set(n.id, n);
  }
  const idsConexion = new Set<string>();
  for (const c of def.conexiones) {
    if (idsConexion.has(c.id)) errores.push({ codigo: "ID_DUPLICADO", mensaje: `Hay dos conexiones con el id "${c.id}"`, conexionId: c.id });
    idsConexion.add(c.id);
  }

  const inicios = def.nodos.filter((n) => n.tipo === "INICIO");
  if (inicios.length === 0) errores.push({ codigo: "SIN_INICIO", mensaje: "Falta el nodo Inicio" });
  if (inicios.length > 1) {
    for (const n of inicios.slice(1)) {
      errores.push({ codigo: "VARIOS_INICIOS", mensaje: "Solo puede haber un nodo Inicio", nodoId: n.id });
    }
  }
  if (!def.nodos.some((n) => n.tipo === "FIN")) {
    errores.push({ codigo: "SIN_FIN", mensaje: "Agrega al menos un nodo Fin" });
  }

  for (const n of def.nodos) {
    const c = CONFIG_POR_TIPO[n.tipo].safeParse(n.config);
    if (!c.success) {
      const detalle = c.error.issues[0]?.message ?? "configuración incompleta";
      errores.push({ codigo: "CONFIG_INCOMPLETA", mensaje: `${nombreNodo(n)}: ${detalle}`, nodoId: n.id });
    }
  }

  // Conexiones válidas y cada salida conectada exactamente una vez.
  const salidasPorNodo = new Map(def.nodos.map((n) => [n.id, salidasDeNodo(n.tipo, n.config)]));
  const usadas = new Map<string, number>();
  const sucesores = new Map<string, string[]>(def.nodos.map((n) => [n.id, []]));
  for (const c of def.conexiones) {
    const origen = nodos.get(c.origen);
    const destino = nodos.get(c.destino);
    if (!origen || !destino) {
      errores.push({ codigo: "CONEXION_NODO_INEXISTENTE", mensaje: "Hay una conexión hacia o desde un nodo que no existe", conexionId: c.id });
      continue;
    }
    if (destino.tipo === "INICIO") {
      errores.push({ codigo: "INICIO_CON_ENTRADA", mensaje: "El nodo Inicio no puede recibir conexiones", conexionId: c.id, nodoId: destino.id });
    }
    if (!salidasPorNodo.get(origen.id)!.some((s) => s.id === c.salida)) {
      errores.push({
        codigo: "CONEXION_SALIDA_INEXISTENTE",
        mensaje: origen.tipo === "FIN"
          ? "El nodo Fin no puede tener conexiones de salida"
          : `${nombreNodo(origen)}: la salida conectada ya no existe`,
        conexionId: c.id,
        nodoId: origen.id,
      });
      continue;
    }
    const clave = `${origen.id}::${c.salida}`;
    usadas.set(clave, (usadas.get(clave) ?? 0) + 1);
    sucesores.get(origen.id)!.push(destino.id);
  }
  for (const n of def.nodos) {
    for (const s of salidasPorNodo.get(n.id)!) {
      const veces = usadas.get(`${n.id}::${s.id}`) ?? 0;
      if (veces === 0) {
        errores.push({ codigo: "SALIDA_SIN_CONECTAR", mensaje: `${nombreNodo(n)}: conecta la salida "${s.etiqueta}"`, nodoId: n.id });
      } else if (veces > 1) {
        errores.push({ codigo: "SALIDA_DUPLICADA", mensaje: `${nombreNodo(n)}: la salida "${s.etiqueta}" tiene más de una conexión`, nodoId: n.id });
      }
    }
  }

  // Alcanzables desde Inicio.
  const alcanzables = new Set<string>();
  const pila = inicios.length === 1 ? [inicios[0].id] : [];
  while (pila.length) {
    const id = pila.pop()!;
    if (alcanzables.has(id)) continue;
    alcanzables.add(id);
    pila.push(...sucesores.get(id)!);
  }
  if (inicios.length === 1) {
    for (const n of def.nodos) {
      if (!alcanzables.has(n.id)) {
        errores.push({ codigo: "NODO_INALCANZABLE", mensaje: `${nombreNodo(n)}: no se llega a este nodo desde Inicio`, nodoId: n.id });
      }
    }
  }

  // Desde cada nodo debe existir un camino a un final (Fin, Mover etapa que
  // finaliza, Ejecutar otro Workflow): recorrido inverso desde los finales.
  const predecesores = new Map<string, string[]>(def.nodos.map((n) => [n.id, []]));
  for (const [origen, destinos] of sucesores) for (const d of destinos) predecesores.get(d)!.push(origen);
  const llegaAFin = new Set<string>();
  const cola = def.nodos.filter((n) => esNodoTerminal(n.tipo, n.config)).map((n) => n.id);
  while (cola.length) {
    const id = cola.pop()!;
    if (llegaAFin.has(id)) continue;
    llegaAFin.add(id);
    cola.push(...predecesores.get(id)!);
  }
  for (const n of def.nodos) {
    if (alcanzables.has(n.id) && !llegaAFin.has(n.id)) {
      errores.push({ codigo: "SIN_CAMINO_A_FIN", mensaje: `${nombreNodo(n)}: desde aquí ninguna ruta llega a un Fin`, nodoId: n.id });
    }
  }

  // D8: un ciclo solo es válido si pasa por un nodo de espera; si no, el
  // motor daría vueltas sin pausa.
  for (const componente of componentesFuertes(def.nodos.map((n) => n.id), sucesores)) {
    const esCiclo = componente.length > 1 || sucesores.get(componente[0])!.includes(componente[0]);
    if (!esCiclo) continue;
    const tieneEspera = componente.some((id) => CATALOGO_NODOS[nodos.get(id)!.tipo].esEspera);
    if (!tieneEspera) {
      for (const id of componente) {
        errores.push({
          codigo: "CICLO_SIN_ESPERA",
          mensaje: `${nombreNodo(nodos.get(id)!)}: forma un ciclo sin ninguna espera (Timer, Esperar respuesta, Menú o Atención IA)`,
          nodoId: id,
        });
      }
    }
  }

  // Advertencias.
  const declaradas = new Set(variablesDeclaradas(def).map((v) => v.ruta));
  for (const n of def.nodos) {
    for (const texto of textosConVariables(n.tipo, n.config)) {
      for (const ruta of extraerVariables(texto)) {
        if (!esVariableConocida(ruta, declaradas)) {
          advertencias.push({
            codigo: "VARIABLE_DESCONOCIDA",
            mensaje: `${nombreNodo(n)}: la variable {{${ruta}}} no existe; se reemplazará por un texto vacío`,
            nodoId: n.id,
          });
        }
      }
    }
  }
  const enviaMensajes = def.nodos.some((n) => CATALOGO_NODOS[n.tipo].enviaMensajes);
  if (enviaMensajes) {
    for (const n of def.nodos) {
      if (n.tipo !== "TIMER") continue;
      const c = CONFIG_POR_TIPO.TIMER.safeParse(n.config);
      if (c.success && !c.data.politicas.CLIENTE_RESPONDE) {
        advertencias.push({
          codigo: "TIMER_SIN_POLITICA_RESPUESTA",
          mensaje: `${nombreNodo(n)}: no define qué pasa si el cliente responde durante la espera (seguirá esperando)`,
          nodoId: n.id,
        });
      }
    }
  }

  return { valido: errores.length === 0, errores, advertencias, definicion: def };
}

// Tarjan iterativo: componentes fuertemente conexos para detectar ciclos.
function componentesFuertes(ids: string[], sucesores: Map<string, string[]>): string[][] {
  let indice = 0;
  const indices = new Map<string, number>();
  const bajo = new Map<string, number>();
  const enPila = new Set<string>();
  const pila: string[] = [];
  const resultado: string[][] = [];

  for (const raiz of ids) {
    if (indices.has(raiz)) continue;
    const trabajo: { id: string; i: number }[] = [{ id: raiz, i: 0 }];
    while (trabajo.length) {
      const marco = trabajo[trabajo.length - 1];
      const { id } = marco;
      if (marco.i === 0 && !indices.has(id)) {
        indices.set(id, indice);
        bajo.set(id, indice);
        indice++;
        pila.push(id);
        enPila.add(id);
      }
      const vecinos = sucesores.get(id) ?? [];
      if (marco.i < vecinos.length) {
        const v = vecinos[marco.i++];
        if (!indices.has(v)) trabajo.push({ id: v, i: 0 });
        else if (enPila.has(v)) bajo.set(id, Math.min(bajo.get(id)!, indices.get(v)!));
        continue;
      }
      if (bajo.get(id) === indices.get(id)) {
        const componente: string[] = [];
        let w: string;
        do {
          w = pila.pop()!;
          enPila.delete(w);
          componente.push(w);
        } while (w !== id);
        resultado.push(componente);
      }
      trabajo.pop();
      if (trabajo.length) {
        const padre = trabajo[trabajo.length - 1].id;
        bajo.set(padre, Math.min(bajo.get(padre)!, bajo.get(id)!));
      }
    }
  }
  return resultado;
}

// ── Referencias (consultas inyectadas) ──────────────────────────────────────

export interface ConsultasReferencias {
  /** Ids de agentes IA que existen en la instancia. */
  agentesIA(ids: string[]): Promise<Set<string>>;
  /** Etapas activas de la instancia, con su pipeline y si ya tienen un Workflow asignado. */
  etapas(ids: string[]): Promise<Map<string, { pipelineId: string; tieneWorkflow: boolean }>>;
  /** UsuarioInstancia activos de la instancia. */
  usuarios(ids: string[]): Promise<Set<string>>;
  /** Etiquetas activas de la instancia. */
  etiquetas(ids: string[]): Promise<Set<string>>;
  /** Workflows publicados de la instancia → ids de Workflows que su versión
   *  publicada ejecuta (para detectar recursión A → B → A). */
  workflowsPublicados(ids: string[]): Promise<Map<string, string[]>>;
}

function idsDestinatario(d: Destinatario | undefined): string[] {
  return d?.tipo === "USUARIO" ? [d.usuarioInstanciaId] : [];
}

function configValida<T extends keyof typeof CONFIG_POR_TIPO>(n: NodoWorkflow, tipo: T): ConfigNodo<T> | null {
  if (n.tipo !== tipo) return null;
  const c = CONFIG_POR_TIPO[tipo].safeParse(n.config);
  return c.success ? (c.data as ConfigNodo<T>) : null;
}

export async function validarReferencias(
  def: DefinicionWorkflow,
  consultas: ConsultasReferencias,
  contexto: { workflowId?: string },
): Promise<ResultadoValidacion> {
  const errores: ProblemaValidacion[] = [];
  const advertencias: ProblemaValidacion[] = [];

  const agentes = new Map<string, string>();
  const etapas = new Map<string, { nodoId: string; pipelineId: string }>();
  const usuarios = new Map<string, string>();
  const etiquetas = new Map<string, string>();
  const workflows = new Map<string, string>();

  for (const n of def.nodos) {
    const ia = configValida(n, "ATENCION_IA");
    if (ia) agentes.set(ia.agenteIAConfigId, n.id);
    const mover = configValida(n, "MOVER_ETAPA");
    if (mover) etapas.set(mover.stageId, { nodoId: n.id, pipelineId: mover.pipelineId });
    for (const id of idsDestinatario(configValida(n, "CREAR_TAREA")?.responsable)) usuarios.set(id, n.id);
    for (const id of idsDestinatario(configValida(n, "NOTIFICAR_AGENTE")?.destinatario)) usuarios.set(id, n.id);
    for (const id of idsDestinatario(configValida(n, "ASIGNAR_HUMANO")?.destinatario)) usuarios.set(id, n.id);
    for (const cambio of configValida(n, "ACTUALIZAR_OPORTUNIDAD")?.cambios ?? []) {
      if (cambio.campo === "responsable") usuarios.set(cambio.valor, n.id);
      if (cambio.campo === "agregarEtiqueta" || cambio.campo === "quitarEtiqueta") etiquetas.set(cambio.valor, n.id);
    }
    const ejecutar = configValida(n, "EJECUTAR_WORKFLOW");
    if (ejecutar) workflows.set(ejecutar.workflowId, n.id);
  }

  const [agentesOk, etapasOk, usuariosOk, etiquetasOk] = await Promise.all([
    agentes.size ? consultas.agentesIA([...agentes.keys()]) : new Set<string>(),
    etapas.size ? consultas.etapas([...etapas.keys()]) : new Map<string, { pipelineId: string; tieneWorkflow: boolean }>(),
    usuarios.size ? consultas.usuarios([...usuarios.keys()]) : new Set<string>(),
    etiquetas.size ? consultas.etiquetas([...etiquetas.keys()]) : new Set<string>(),
  ]);

  for (const [id, nodoId] of agentes) {
    if (!agentesOk.has(id)) errores.push({ codigo: "AGENTE_IA_INEXISTENTE", mensaje: "El agente IA elegido no existe o fue eliminado", nodoId });
  }
  for (const [stageId, { nodoId, pipelineId }] of etapas) {
    const etapa = etapasOk.get(stageId);
    if (!etapa || etapa.pipelineId !== pipelineId) {
      errores.push({ codigo: "ETAPA_INEXISTENTE", mensaje: "La etapa destino no existe o no pertenece al pipeline elegido", nodoId });
    } else if (etapa.tieneWorkflow) {
      advertencias.push({
        codigo: "ETAPA_CON_WORKFLOW",
        mensaje: "La etapa destino tiene su propio Workflow: al mover la oportunidad, ese Workflow se iniciará",
        nodoId,
      });
    }
  }
  for (const [id, nodoId] of usuarios) {
    if (!usuariosOk.has(id)) errores.push({ codigo: "USUARIO_INEXISTENTE", mensaje: "El usuario elegido no existe o está inactivo", nodoId });
  }
  for (const [id, nodoId] of etiquetas) {
    if (!etiquetasOk.has(id)) errores.push({ codigo: "ETIQUETA_INEXISTENTE", mensaje: "La etiqueta elegida no existe o está inactiva", nodoId });
  }

  // Ejecutar otro Workflow: debe estar publicado y la cadena de llamadas no
  // puede volver a este Workflow (A → B → A).
  if (workflows.size) {
    // Grafo de llamadas entre Workflows publicados, recorrido por niveles.
    const grafo = new Map<string, string[]>();
    const consultados = new Set<string>();
    let pendientes = [...workflows.keys()];
    while (pendientes.length) {
      for (const id of pendientes) consultados.add(id);
      const nuevos = await consultas.workflowsPublicados(pendientes);
      for (const [id, refs] of nuevos) grafo.set(id, refs);
      pendientes = [...new Set([...nuevos.values()].flat())].filter((id) => !consultados.has(id));
    }

    for (const [destino, nodoId] of workflows) {
      if (contexto.workflowId && destino === contexto.workflowId) {
        errores.push({ codigo: "RECURSION_WORKFLOWS", mensaje: "Un Workflow no puede ejecutarse a sí mismo", nodoId });
        continue;
      }
      if (!grafo.has(destino)) {
        errores.push({ codigo: "WORKFLOW_NO_PUBLICADO", mensaje: "El Workflow destino no existe o no está publicado", nodoId });
        continue;
      }
      if (contexto.workflowId && alcanza(destino, contexto.workflowId, grafo)) {
        errores.push({
          codigo: "RECURSION_WORKFLOWS",
          mensaje: "El Workflow destino termina llamando de nuevo a este Workflow (ciclo entre Workflows)",
          nodoId,
        });
      }
    }
  }

  return { valido: errores.length === 0, errores, advertencias };
}

function alcanza(desde: string, objetivo: string, grafo: Map<string, string[]>): boolean {
  const vistos = new Set<string>();
  const pila = [desde];
  while (pila.length) {
    const id = pila.pop()!;
    if (id === objetivo) return true;
    if (vistos.has(id)) continue;
    vistos.add(id);
    pila.push(...(grafo.get(id) ?? []));
  }
  return false;
}

// ── Validación completa para publicar ───────────────────────────────────────

export async function validarParaPublicar(
  entrada: unknown,
  consultas: ConsultasReferencias,
  contexto: { workflowId?: string },
): Promise<ResultadoValidacion> {
  const estructura = validarEstructura(entrada);
  if (!estructura.definicion) return estructura;
  const referencias = await validarReferencias(estructura.definicion, consultas, contexto);
  const errores = [...estructura.errores, ...referencias.errores];
  return {
    valido: errores.length === 0,
    errores,
    advertencias: [...estructura.advertencias, ...referencias.advertencias],
  };
}
