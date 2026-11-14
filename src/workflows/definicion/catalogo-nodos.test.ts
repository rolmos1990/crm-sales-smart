import { describe, expect, it } from "vitest";
import { CATALOGO_NODOS, salidaPorDefectoDeNodo, salidasDeNodo } from "./catalogo-nodos";
import { ConfigAtencionIASchema, MENSAJES_MEMORIA_DEFECTO, type TipoNodo } from "./schema";

const TIPOS = Object.keys(CATALOGO_NODOS) as TipoNodo[];

/**
 * El camino feliz de cada tipo, recién creado. Si al agregar o reordenar
 * salidas este test se cae, la lista quedó con un desvío (error, timeout,
 * "En otro caso") antes del camino feliz: se arregla el orden en el catálogo,
 * no el valor esperado de acá.
 */
const SALIDA_POR_DEFECTO: Record<TipoNodo, string | null> = {
  INICIO: "siguiente",
  ENVIAR_MENSAJE: "siguiente",
  TIMER: "siguiente",
  ACTUALIZAR_OPORTUNIDAD: "siguiente",
  CREAR_TAREA: "siguiente",
  NOTIFICAR_AGENTE: "siguiente",
  ASIGNAR_HUMANO: "siguiente",
  MENU: "opcion:o1",
  ESPERAR_RESPUESTA: "valida",
  CONDICION: "rama:r1",
  ATENCION_IA: "completado",
  // Terminales: con su config inicial no continúan a ningún lado.
  FIN: null,
  EJECUTAR_WORKFLOW: null,
  MOVER_ETAPA: null,
};

describe("salidaPorDefectoDeNodo", () => {
  it.each(TIPOS)("%s continúa por su camino feliz", (tipo) => {
    const config = CATALOGO_NODOS[tipo].configInicial();
    expect(salidaPorDefectoDeNodo(tipo, config)).toBe(SALIDA_POR_DEFECTO[tipo]);
  });

  it("devuelve una salida que el nodo realmente expone", () => {
    for (const tipo of TIPOS) {
      const config = CATALOGO_NODOS[tipo].configInicial();
      const porDefecto = salidaPorDefectoDeNodo(tipo, config);
      if (porDefecto === null) continue;
      expect(salidasDeNodo(tipo, config).map((s) => s.id)).toContain(porDefecto);
    }
  });

  it("ATENCION_IA en respuesta única continúa por 'Respondió'", () => {
    const config = { agenteIAConfigId: "a1", modo: "RESPUESTA_UNICA", maxInteracciones: 10 };
    expect(salidaPorDefectoDeNodo("ATENCION_IA", config)).toBe("respondido");
  });

  it("MOVER_ETAPA continúa solo si no finaliza el Workflow", () => {
    const base = { pipelineId: "p1", stageId: "s1" };
    expect(salidaPorDefectoDeNodo("MOVER_ETAPA", { ...base, workflowActual: "CONTINUAR" })).toBe("siguiente");
    expect(salidaPorDefectoDeNodo("MOVER_ETAPA", { ...base, workflowActual: "FINALIZAR" })).toBeNull();
  });

  it("toma la primera rama de una condición con varias", () => {
    const arbol = { type: "group", logicalOperator: "AND", children: [] };
    const config = {
      ramas: [
        { id: "vip", etiqueta: "Cliente VIP", arbol },
        { id: "resto", etiqueta: "Resto", arbol },
      ],
    };
    expect(salidaPorDefectoDeNodo("CONDICION", config)).toBe("rama:vip");
  });
});

// 031-memoria-y-ficha-conversacion (FR-002) — un nodo nuevo nace sin las
// claves nuevas, y reparsear la configuración de un nodo ya publicado las
// deja en `undefined`. Si alguna de las dos se materializa, todo Workflow
// vivo cambia de comportamiento en silencio al republicarse.
describe("ATENCION_IA — memoria y ficha arrancan ausentes (031, FR-002)", () => {
  it("configInicial() no trae memoria ni ficha", () => {
    const config = CATALOGO_NODOS.ATENCION_IA.configInicial();

    expect(config).not.toHaveProperty("memoria");
    expect(config).not.toHaveProperty("ficha");
  });

  it("parsear la config de un nodo publicado antes de la 031 deja ambas en undefined", () => {
    const configPrevia = { agenteIAConfigId: "ag-1", modo: "CONTINUA", maxInteracciones: 10 };

    const parseada = ConfigAtencionIASchema.parse(configPrevia);

    expect(parseada.memoria).toBeUndefined();
    expect(parseada.ficha).toBeUndefined();
  });

  it("cuando la memoria sí viene, completa sus propios defaults", () => {
    const parseada = ConfigAtencionIASchema.parse({
      agenteIAConfigId: "ag-1",
      modo: "CONTINUA",
      maxInteracciones: 10,
      memoria: {},
    });

    expect(parseada.memoria).toEqual({ activa: true, cantidad: MENSAJES_MEMORIA_DEFECTO });
  });
});
