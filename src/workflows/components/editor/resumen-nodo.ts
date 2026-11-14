import { CONFIG_POR_TIPO, type ConfigNodo, type Duracion, type NodoWorkflow, type TipoNodo } from "../../definicion/schema";
import type { OpcionesEditor } from "../../queries";
import { ETIQUETA_DISPARADOR } from "../estilos";

const UNIDAD: Record<Duracion["unidad"], [string, string]> = {
  MINUTOS: ["minuto", "minutos"],
  HORAS: ["hora", "horas"],
  DIAS: ["día", "días"],
};

export function textoDuracion(d: Duracion): string {
  const [singular, plural] = UNIDAD[d.unidad];
  return `${d.cantidad} ${d.cantidad === 1 ? singular : plural}`;
}

function recortar(texto: string, max = 70): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

/** Una línea legible de lo que hace el nodo, para la tarjeta del lienzo. */
export function resumenNodo(nodo: NodoWorkflow, opciones: OpcionesEditor): string | null {
  const parse = <T extends TipoNodo>(tipo: T): ConfigNodo<T> | null => {
    const r = CONFIG_POR_TIPO[tipo].safeParse(nodo.config);
    return r.success ? (r.data as ConfigNodo<T>) : null;
  };
  const usuario = (id: string) => opciones.usuarios.find((u) => u.id === id)?.nombre ?? "un usuario";

  switch (nodo.tipo) {
    case "INICIO": {
      const c = parse("INICIO");
      return c ? c.disparadoresAceptados.map((d) => ETIQUETA_DISPARADOR[d]).join(" · ") : null;
    }
    case "FIN":
      return parse("FIN")?.etiqueta || null;
    case "ENVIAR_MENSAJE": {
      if (nodo.config.origen === "PLANTILLA") {
        const p = opciones.plantillas.find((x) => x.id === nodo.config.plantillaId);
        return p ? `Plantilla: ${p.nombre}` : null;
      }
      const texto = typeof nodo.config.texto === "string" ? nodo.config.texto : "";
      return texto.trim() ? `“${recortar(texto)}”` : null;
    }
    case "MENU": {
      const c = parse("MENU");
      return c ? `${recortar(c.pregunta, 40)} (${c.opciones.length} opciones)` : null;
    }
    case "ESPERAR_RESPUESTA": {
      const c = parse("ESPERAR_RESPUESTA");
      return c ? `Guarda en {{workflow.variables.${c.guardarEn}}} · máx. ${textoDuracion(c.timeout)}` : null;
    }
    case "CONDICION": {
      const c = parse("CONDICION");
      return c ? `${c.ramas.length} ${c.ramas.length === 1 ? "rama" : "ramas"} + “En otro caso”` : null;
    }
    case "TIMER": {
      const c = parse("TIMER");
      if (!c) return null;
      return c.modo === "DURACION" ? `Espera ${textoDuracion(c.duracion)}` : `Hasta el ${c.fechaHoraLocal.replace("T", " ")}`;
    }
    case "ATENCION_IA": {
      const c = parse("ATENCION_IA");
      if (!c) return null;
      const agente = opciones.agentes.find((a) => a.id === c.agenteIAConfigId)?.nombre ?? "Agente";
      // 031 — sin la clave `memoria` no se agrega nada: un nodo que nunca la
      // tocó tiene que verse exactamente igual que antes de esa feature.
      const memoria = c.memoria ? (c.memoria.activa ? `recuerda ${c.memoria.cantidad}` : "sin memoria") : null;
      return [
        agente,
        c.modo === "CONTINUA" ? `hasta ${c.maxInteracciones} mensajes` : "una respuesta",
        memoria,
        c.ficha?.activa ? "con ficha" : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "MOVER_ETAPA": {
      const c = parse("MOVER_ETAPA");
      if (!c) return null;
      const pipeline = opciones.pipelines.find((p) => p.id === c.pipelineId);
      const etapa = pipeline?.stages.find((s) => s.id === c.stageId);
      return etapa ? `A ${pipeline!.nombre} · ${etapa.nombre}` : null;
    }
    case "ACTUALIZAR_OPORTUNIDAD": {
      const c = parse("ACTUALIZAR_OPORTUNIDAD");
      return c ? `${c.cambios.length} ${c.cambios.length === 1 ? "cambio" : "cambios"}` : null;
    }
    case "CREAR_TAREA": {
      const c = parse("CREAR_TAREA");
      return c ? `“${recortar(c.titulo, 40)}” · vence en ${textoDuracion(c.vencimiento)}` : null;
    }
    case "NOTIFICAR_AGENTE": {
      const c = parse("NOTIFICAR_AGENTE");
      if (!c) return null;
      return c.destinatario.tipo === "USUARIO" ? `A ${usuario(c.destinatario.usuarioInstanciaId)}` : "Al responsable de la oportunidad";
    }
    case "ASIGNAR_HUMANO": {
      const c = parse("ASIGNAR_HUMANO");
      if (!c) return null;
      return c.destinatario.tipo === "USUARIO" ? `A ${usuario(c.destinatario.usuarioInstanciaId)}` : "Al responsable de la oportunidad";
    }
    case "EJECUTAR_WORKFLOW": {
      const c = parse("EJECUTAR_WORKFLOW");
      return c ? opciones.workflows.find((w) => w.id === c.workflowId)?.nombre ?? null : null;
    }
  }
}
