import type { DefinicionWorkflow } from "../../definicion/schema";

// Estado del editor con historial para deshacer/rehacer. Cada acción que
// modifica la definición decide si deja rastro en el historial: arrastrar un
// nodo actualiza la posición en cada frame (sin historial) y registra un
// único paso al soltarlo.

const MAX_HISTORIAL = 100;

export interface EstadoEditor {
  definicion: DefinicionWorkflow;
  pasado: DefinicionWorkflow[];
  futuro: DefinicionWorkflow[];
  /** Versión monótona: cambia con cada edición; dispara el autoguardado. */
  revision: number;
}

export type AccionEditor =
  | { tipo: "APLICAR"; cambio: (d: DefinicionWorkflow) => DefinicionWorkflow; historial?: boolean }
  | { tipo: "MARCAR_PUNTO_HISTORIAL"; antes: DefinicionWorkflow }
  | { tipo: "DESHACER" }
  | { tipo: "REHACER" };

export function estadoInicial(definicion: DefinicionWorkflow): EstadoEditor {
  return { definicion, pasado: [], futuro: [], revision: 0 };
}

export function reducerEditor(estado: EstadoEditor, accion: AccionEditor): EstadoEditor {
  switch (accion.tipo) {
    case "APLICAR": {
      const nueva = accion.cambio(estado.definicion);
      if (nueva === estado.definicion) return estado;
      const conHistorial = accion.historial !== false;
      return {
        definicion: nueva,
        pasado: conHistorial ? [...estado.pasado, estado.definicion].slice(-MAX_HISTORIAL) : estado.pasado,
        futuro: conHistorial ? [] : estado.futuro,
        revision: estado.revision + 1,
      };
    }
    case "MARCAR_PUNTO_HISTORIAL":
      // Al soltar un nodo arrastrado: el "antes" es la posición previa al arrastre.
      if (accion.antes === estado.definicion) return estado;
      return {
        ...estado,
        pasado: [...estado.pasado, accion.antes].slice(-MAX_HISTORIAL),
        futuro: [],
      };
    case "DESHACER": {
      const anterior = estado.pasado.at(-1);
      if (!anterior) return estado;
      return {
        definicion: anterior,
        pasado: estado.pasado.slice(0, -1),
        futuro: [estado.definicion, ...estado.futuro],
        revision: estado.revision + 1,
      };
    }
    case "REHACER": {
      const siguiente = estado.futuro[0];
      if (!siguiente) return estado;
      return {
        definicion: siguiente,
        pasado: [...estado.pasado, estado.definicion],
        futuro: estado.futuro.slice(1),
        revision: estado.revision + 1,
      };
    }
  }
}

// ── Operaciones puras sobre la definición ──────────────────────────────────

export function generarId(prefijo: string): string {
  return `${prefijo}_${Math.random().toString(36).slice(2, 9)}`;
}

export function quitarNodos(def: DefinicionWorkflow, ids: Set<string>): DefinicionWorkflow {
  return {
    ...def,
    nodos: def.nodos.filter((n) => !ids.has(n.id)),
    conexiones: def.conexiones.filter((c) => !ids.has(c.origen) && !ids.has(c.destino)),
  };
}

/** Copia nodos (y las conexiones entre ellos) con ids nuevos y desplazados. */
export function duplicarNodos(
  def: DefinicionWorkflow,
  origen: { nodos: DefinicionWorkflow["nodos"]; conexiones: DefinicionWorkflow["conexiones"] },
  desplazamiento = 40,
): { definicion: DefinicionWorkflow; nuevosIds: string[] } {
  const mapa = new Map<string, string>();
  // Inicio es único: nunca se copia.
  const copiables = origen.nodos.filter((n) => n.tipo !== "INICIO");
  const nodos = copiables.map((n) => {
    const id = generarId(n.tipo.toLowerCase());
    mapa.set(n.id, id);
    return {
      ...n,
      id,
      posicion: { x: n.posicion.x + desplazamiento, y: n.posicion.y + desplazamiento },
      config: structuredClone(n.config),
    };
  });
  const conexiones = origen.conexiones
    .filter((c) => mapa.has(c.origen) && mapa.has(c.destino))
    .map((c) => ({ ...c, id: generarId("c"), origen: mapa.get(c.origen)!, destino: mapa.get(c.destino)! }));
  return {
    definicion: { ...def, nodos: [...def.nodos, ...nodos], conexiones: [...def.conexiones, ...conexiones] },
    nuevosIds: nodos.map((n) => n.id),
  };
}
