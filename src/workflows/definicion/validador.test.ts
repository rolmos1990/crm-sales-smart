import { describe, expect, it } from "vitest";
import type { DefinicionWorkflow, NodoWorkflow } from "./schema";
import { validarEstructura, validarReferencias, validarParaPublicar, type ConsultasReferencias } from "./validador";
import { salidasDeNodo } from "./catalogo-nodos";

// ── Helpers para armar definiciones ─────────────────────────────────────────

function nodo(id: string, tipo: NodoWorkflow["tipo"], config: Record<string, unknown>): NodoWorkflow {
  return { id, tipo, posicion: { x: 0, y: 0 }, config };
}
let n = 0;
function con(origen: string, salida: string, destino: string) {
  return { id: `c${++n}`, origen, salida, destino };
}
const arbol = (fieldKey: string) => ({
  type: "group",
  logicalOperator: "AND",
  children: [{ type: "condition", fieldKey, operator: "ES_VERDADERO" }],
});

const inicio = (id = "inicio") => nodo(id, "INICIO", { disparadoresAceptados: ["ENTRADA_ETAPA"] });
const fin = (id: string) => nodo(id, "FIN", { resultado: "COMPLETADO" });
const enviar = (id: string, texto = "Hola {{contacto.nombre}}") => nodo(id, "ENVIAR_MENSAJE", { texto });
const timer = (id: string, politicas: Record<string, string> = { CLIENTE_RESPONDE: "CANCELAR_WORKFLOW" }) =>
  nodo(id, "TIMER", { modo: "DURACION", duracion: { cantidad: 2, unidad: "DIAS" }, politicas });
const condicion = (id: string) =>
  nodo(id, "CONDICION", { ramas: [{ id: "si", etiqueta: "Respondió", arbol: arbol("conversacion.respondio") }] });

// Ejemplo de la sección 9 del requerimiento: seguimiento de cotización.
function ejemploSeguimiento(): DefinicionWorkflow {
  return {
    version: 1,
    nodos: [
      inicio(),
      enviar("enviarCotizacion", "Hola {{contacto.nombre}}, te enviamos la cotización de {{oportunidad.titulo}}"),
      timer("timer2d"),
      condicion("respondio1"),
      fin("finRespondio1"),
      enviar("recordatorio", "¿Pudiste revisar la cotización?"),
      timer("timer1d"),
      condicion("respondio2"),
      fin("finRespondio2"),
      nodo("moverSinRespuesta", "MOVER_ETAPA", { pipelineId: "p1", stageId: "sinRespuesta", workflowActual: "CONTINUAR" }),
      nodo("crearTarea", "CREAR_TAREA", {
        titulo: "Llamar a {{contacto.nombre}}",
        responsable: { tipo: "RESPONSABLE_OPORTUNIDAD" },
        vencimiento: { cantidad: 1, unidad: "DIAS" },
      }),
      nodo("notificar", "NOTIFICAR_AGENTE", {
        destinatario: { tipo: "RESPONSABLE_OPORTUNIDAD" },
        mensaje: "El cliente lleva 3 días sin responder la cotización",
      }),
      fin("fin"),
    ],
    conexiones: [
      con("inicio", "siguiente", "enviarCotizacion"),
      con("enviarCotizacion", "siguiente", "timer2d"),
      con("timer2d", "siguiente", "respondio1"),
      con("respondio1", "rama:si", "finRespondio1"),
      con("respondio1", "otro", "recordatorio"),
      con("recordatorio", "siguiente", "timer1d"),
      con("timer1d", "siguiente", "respondio2"),
      con("respondio2", "rama:si", "finRespondio2"),
      con("respondio2", "otro", "moverSinRespuesta"),
      con("moverSinRespuesta", "siguiente", "crearTarea"),
      con("moverSinRespuesta", "error", "crearTarea"),
      con("crearTarea", "siguiente", "notificar"),
      con("notificar", "siguiente", "fin"),
    ],
  };
}

function codigos(r: { errores: { codigo: string }[] }) {
  return r.errores.map((e) => e.codigo);
}

// ── Estructura ──────────────────────────────────────────────────────────────

describe("validarEstructura", () => {
  it("el ejemplo de seguimiento de cotización (sección 9) es válido", () => {
    const r = validarEstructura(ejemploSeguimiento());
    expect(r.errores).toEqual([]);
    expect(r.valido).toBe(true);
  });

  it("rechaza un formato inválido", () => {
    expect(codigos(validarEstructura({ version: 2, nodos: "x" }))).toEqual(["FORMATO_INVALIDO"]);
  });

  it("exige exactamente un Inicio y al menos un Fin", () => {
    const vacio = validarEstructura({ version: 1, nodos: [], conexiones: [] });
    expect(codigos(vacio)).toEqual(expect.arrayContaining(["SIN_INICIO", "SIN_FIN"]));

    const dos = validarEstructura({
      version: 1,
      nodos: [inicio("a"), inicio("b"), fin("f")],
      conexiones: [con("a", "siguiente", "f"), con("b", "siguiente", "f")],
    });
    expect(codigos(dos)).toContain("VARIOS_INICIOS");
  });

  it("el Inicio no recibe conexiones y el Fin no tiene salidas", () => {
    const r = validarEstructura({
      version: 1,
      nodos: [inicio(), fin("f")],
      conexiones: [con("inicio", "siguiente", "f"), con("f", "siguiente", "inicio")],
    });
    expect(codigos(r)).toEqual(expect.arrayContaining(["INICIO_CON_ENTRADA", "CONEXION_SALIDA_INEXISTENTE"]));
  });

  it("toda salida debe conectarse exactamente una vez", () => {
    const sinConectar = ejemploSeguimiento();
    sinConectar.conexiones = sinConectar.conexiones.filter((c) => !(c.origen === "respondio1" && c.salida === "otro"));
    const r1 = validarEstructura(sinConectar);
    expect(r1.errores).toContainEqual(expect.objectContaining({ codigo: "SALIDA_SIN_CONECTAR", nodoId: "respondio1" }));

    const duplicada = ejemploSeguimiento();
    duplicada.conexiones.push(con("inicio", "siguiente", "fin"));
    expect(validarEstructura(duplicada).errores).toContainEqual(
      expect.objectContaining({ codigo: "SALIDA_DUPLICADA", nodoId: "inicio" }),
    );
  });

  it("detecta nodos a los que no se llega desde Inicio", () => {
    const def = ejemploSeguimiento();
    def.nodos.push(fin("finSuelto"));
    expect(validarEstructura(def).errores).toContainEqual(
      expect.objectContaining({ codigo: "NODO_INALCANZABLE", nodoId: "finSuelto" }),
    );
  });

  it("reporta la configuración incompleta de un nodo", () => {
    const def = ejemploSeguimiento();
    def.nodos = def.nodos.map((x) => (x.id === "recordatorio" ? enviar("recordatorio", "   ") : x));
    expect(validarEstructura(def).errores).toContainEqual(
      expect.objectContaining({ codigo: "CONFIG_INCOMPLETA", nodoId: "recordatorio" }),
    );
  });

  it("un Timer de más de 90 días es inválido", () => {
    const def = ejemploSeguimiento();
    def.nodos = def.nodos.map((x) =>
      x.id === "timer2d" ? { ...x, config: { ...x.config, duracion: { cantidad: 91, unidad: "DIAS" } } } : x,
    );
    expect(validarEstructura(def).errores).toContainEqual(
      expect.objectContaining({ codigo: "CONFIG_INCOMPLETA", nodoId: "timer2d" }),
    );
  });

  it("D8: rechaza un ciclo sin nodo de espera", () => {
    const r = validarEstructura({
      version: 1,
      nodos: [
        inicio(),
        condicion("cond"),
        nodo("act", "ACTUALIZAR_OPORTUNIDAD", { cambios: [{ campo: "notas", valor: "x" }] }),
        fin("f"),
      ],
      conexiones: [
        con("inicio", "siguiente", "cond"),
        con("cond", "rama:si", "f"),
        con("cond", "otro", "act"),
        con("act", "siguiente", "cond"),
      ],
    });
    expect(codigos(r)).toContain("CICLO_SIN_ESPERA");
  });

  it("D8: acepta un ciclo que pasa por un Timer", () => {
    const r = validarEstructura({
      version: 1,
      nodos: [inicio(), enviar("recordar"), timer("esperar"), condicion("cond"), fin("f")],
      conexiones: [
        con("inicio", "siguiente", "recordar"),
        con("recordar", "siguiente", "esperar"),
        con("esperar", "siguiente", "cond"),
        con("cond", "rama:si", "f"),
        con("cond", "otro", "recordar"),
      ],
    });
    expect(r.errores).toEqual([]);
  });

  it("detecta rutas que nunca llegan a un Fin", () => {
    const r = validarEstructura({
      version: 1,
      nodos: [inicio(), condicion("cond"), enviar("e"), timer("t"), fin("f")],
      conexiones: [
        con("inicio", "siguiente", "cond"),
        con("cond", "rama:si", "f"),
        con("cond", "otro", "e"),
        con("e", "siguiente", "t"),
        con("t", "siguiente", "e"),
      ],
    });
    expect(r.errores).toContainEqual(expect.objectContaining({ codigo: "SIN_CAMINO_A_FIN", nodoId: "e" }));
  });

  it("Mover etapa con FINALIZAR termina el Workflow y solo exige conectar la salida de error", () => {
    const r = validarEstructura({
      version: 1,
      nodos: [inicio(), nodo("mover", "MOVER_ETAPA", { pipelineId: "p", stageId: "s" }), fin("f")],
      conexiones: [con("inicio", "siguiente", "mover"), con("mover", "error", "f")],
    });
    expect(r.errores).toEqual([]);
  });

  it("advierte variables desconocidas, pero acepta las que guarda el propio Workflow", () => {
    const r = validarEstructura({
      version: 1,
      nodos: [
        inicio(),
        nodo("preguntar", "ESPERAR_RESPUESTA", {
          guardarEn: "presupuesto",
          timeout: { cantidad: 1, unidad: "DIAS" },
        }),
        enviar("confirmar", "Anotado {{workflow.variables.presupuesto}} para {{cliente.nombre}}"),
        fin("f"),
      ],
      conexiones: [
        con("inicio", "siguiente", "preguntar"),
        con("preguntar", "valida", "confirmar"),
        con("preguntar", "timeout", "f"),
        con("confirmar", "siguiente", "f"),
      ],
    });
    expect(r.errores).toEqual([]);
    expect(r.advertencias).toEqual([
      expect.objectContaining({ codigo: "VARIABLE_DESCONOCIDA", mensaje: expect.stringContaining("{{cliente.nombre}}") }),
    ]);
  });

  it("advierte un Timer sin política para cuando el cliente responde", () => {
    const def = ejemploSeguimiento();
    def.nodos = def.nodos.map((x) => (x.id === "timer1d" ? timer("timer1d", {}) : x));
    expect(validarEstructura(def).advertencias).toContainEqual(
      expect.objectContaining({ codigo: "TIMER_SIN_POLITICA_RESPUESTA", nodoId: "timer1d" }),
    );
  });
});

describe("salidasDeNodo", () => {
  it("con una condición incompleta (borrador) igual expone las salidas de sus ramas", () => {
    const salidas = salidasDeNodo("CONDICION", {
      ramas: [
        { id: "a", etiqueta: "A", arbol: { type: "group", logicalOperator: "AND", children: [] } },
        { id: "b", etiqueta: "B" },
      ],
    });
    expect(salidas.map((s) => s.id)).toEqual(["rama:a", "rama:b", "otro"]);
  });

  it("el Timer agrega la salida 'interrumpido' solo si alguna política usa ruta alternativa", () => {
    expect(salidasDeNodo("TIMER", { modo: "DURACION", duracion: { cantidad: 1, unidad: "HORAS" }, politicas: {} }).map((s) => s.id))
      .toEqual(["siguiente"]);
    expect(
      salidasDeNodo("TIMER", {
        modo: "DURACION",
        duracion: { cantidad: 1, unidad: "HORAS" },
        politicas: { CLIENTE_RESPONDE: "RUTA_ALTERNATIVA" },
      }).map((s) => s.id),
    ).toEqual(["siguiente", "interrumpido"]);
  });
});

// ── Referencias ─────────────────────────────────────────────────────────────

function consultasFalsas(datos: {
  agentes?: string[];
  etapas?: Record<string, { pipelineId: string; tieneWorkflow?: boolean }>;
  usuarios?: string[];
  etiquetas?: string[];
  workflows?: Record<string, string[]>;
  plantillas?: string[];
}): ConsultasReferencias {
  return {
    agentesIA: async (ids) => new Set(ids.filter((i) => datos.agentes?.includes(i))),
    etapas: async (ids) =>
      new Map(
        ids
          .filter((i) => datos.etapas?.[i])
          .map((i) => [i, { pipelineId: datos.etapas![i].pipelineId, tieneWorkflow: !!datos.etapas![i].tieneWorkflow }]),
      ),
    usuarios: async (ids) => new Set(ids.filter((i) => datos.usuarios?.includes(i))),
    etiquetas: async (ids) => new Set(ids.filter((i) => datos.etiquetas?.includes(i))),
    workflowsPublicados: async (ids) =>
      new Map(ids.filter((i) => datos.workflows?.[i]).map((i) => [i, datos.workflows![i]])),
    plantillas: async (ids) => new Set(ids.filter((i) => datos.plantillas?.includes(i))),
  };
}

function conNodo(extra: NodoWorkflow, salidas: string[]): DefinicionWorkflow {
  return {
    version: 1,
    nodos: [inicio(), extra, fin("f")],
    conexiones: [con("inicio", "siguiente", extra.id), ...salidas.map((s) => con(extra.id, s, "f"))],
  };
}

describe("validarReferencias", () => {
  it("agente IA inexistente o de otra empresa", async () => {
    const def = conNodo(nodo("ia", "ATENCION_IA", { agenteIAConfigId: "ajeno", modo: "RESPUESTA_UNICA" }), [
      "respondido",
      "transferencia",
      "error",
    ]);
    const r = await validarReferencias(def, consultasFalsas({ agentes: ["propio"] }), {});
    expect(codigos(r)).toEqual(["AGENTE_IA_INEXISTENTE"]);
  });

  it("plantilla inexistente o inactiva; el texto propio no consulta plantillas", async () => {
    const enviarPlantilla = (plantillaId: string) =>
      conNodo(nodo("e", "ENVIAR_MENSAJE", { origen: "PLANTILLA", plantillaId }), ["siguiente"]);
    const consultas = consultasFalsas({ plantillas: ["activa"] });
    expect(codigos(await validarReferencias(enviarPlantilla("borrada"), consultas, {}))).toEqual(["PLANTILLA_INEXISTENTE"]);
    expect(codigos(await validarReferencias(enviarPlantilla("activa"), consultas, {}))).toEqual([]);
  });

  it("etapa que no pertenece al pipeline elegido; advertencia si la etapa destino tiene su propio Workflow", async () => {
    const mover = (stageId: string) =>
      conNodo(nodo("m", "MOVER_ETAPA", { pipelineId: "p1", stageId, workflowActual: "FINALIZAR" }), ["error"]);
    const consultas = consultasFalsas({ etapas: { s1: { pipelineId: "p2" }, s2: { pipelineId: "p1", tieneWorkflow: true } } });

    expect(codigos(await validarReferencias(mover("s1"), consultas, {}))).toEqual(["ETAPA_INEXISTENTE"]);
    const conWorkflow = await validarReferencias(mover("s2"), consultas, {});
    expect(conWorkflow.errores).toEqual([]);
    expect(conWorkflow.advertencias.map((a) => a.codigo)).toEqual(["ETAPA_CON_WORKFLOW"]);
  });

  it("usuario y etiqueta inexistentes", async () => {
    const def = conNodo(
      nodo("act", "ACTUALIZAR_OPORTUNIDAD", {
        cambios: [
          { campo: "responsable", valor: "ui-ajeno" },
          { campo: "agregarEtiqueta", valor: "tag-ajeno" },
        ],
      }),
      ["siguiente"],
    );
    const r = await validarReferencias(def, consultasFalsas({}), {});
    expect(codigos(r).sort()).toEqual(["ETIQUETA_INEXISTENTE", "USUARIO_INEXISTENTE"]);
  });

  it("Ejecutar otro Workflow: debe estar publicado, no puede ser él mismo ni cerrar un ciclo A → B → A", async () => {
    const ejecutar = (workflowId: string) => conNodo(nodo("x", "EJECUTAR_WORKFLOW", { workflowId }), []);

    expect(codigos(await validarReferencias(ejecutar("B"), consultasFalsas({}), { workflowId: "A" }))).toEqual([
      "WORKFLOW_NO_PUBLICADO",
    ]);
    expect(codigos(await validarReferencias(ejecutar("A"), consultasFalsas({}), { workflowId: "A" }))).toEqual([
      "RECURSION_WORKFLOWS",
    ]);
    const ciclo = consultasFalsas({ workflows: { B: ["C"], C: ["A"] } });
    expect(codigos(await validarReferencias(ejecutar("B"), ciclo, { workflowId: "A" }))).toEqual(["RECURSION_WORKFLOWS"]);
    const sinCiclo = consultasFalsas({ workflows: { B: ["C"], C: [] } });
    expect(codigos(await validarReferencias(ejecutar("B"), sinCiclo, { workflowId: "A" }))).toEqual([]);
  });

  it("validarParaPublicar combina estructura y referencias", async () => {
    const r = await validarParaPublicar(
      ejemploSeguimiento(),
      consultasFalsas({ etapas: { sinRespuesta: { pipelineId: "p1" } } }),
      { workflowId: "W" },
    );
    expect(r.valido).toBe(true);
  });
});
