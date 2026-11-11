import { CONFIG_POR_TIPO, type DefinicionWorkflow } from "./schema";

// Variables disponibles en textos de nodos ({{ruta}}). contacto.*, empresa.*,
// agente y correo_agente son los mismos nombres de interpolarPlantilla
// (src/conversaciones/interpolacion.ts). Los campos de la oportunidad llevan
// prefijo explícito `oportunidad.` (las plantillas los usan sin prefijo:
// {{titulo}}); el motor lo traduce al interpolar. Se suman las propias del
// Workflow (workflow.variables.<nombre>), declaradas por nodos que guardan
// respuestas.

export type GrupoVariable = "Contacto" | "Empresa" | "Oportunidad" | "Agente" | "Workflow";

export interface VariableDisponible {
  ruta: string;
  etiqueta: string;
  grupo: GrupoVariable;
}

export const VARIABLES_SISTEMA: VariableDisponible[] = [
  { ruta: "contacto.nombre", etiqueta: "Nombre", grupo: "Contacto" },
  { ruta: "contacto.apellido", etiqueta: "Apellido", grupo: "Contacto" },
  { ruta: "contacto.email", etiqueta: "Email", grupo: "Contacto" },
  { ruta: "contacto.telefonoPrincipal", etiqueta: "Teléfono", grupo: "Contacto" },
  { ruta: "contacto.telefonoSecundario", etiqueta: "Teléfono secundario", grupo: "Contacto" },
  { ruta: "contacto.cargo", etiqueta: "Cargo", grupo: "Contacto" },
  { ruta: "empresa.nombre", etiqueta: "Nombre", grupo: "Empresa" },
  { ruta: "oportunidad.titulo", etiqueta: "Título", grupo: "Oportunidad" },
  { ruta: "oportunidad.etapa", etiqueta: "Etapa", grupo: "Oportunidad" },
  { ruta: "oportunidad.valor", etiqueta: "Valor", grupo: "Oportunidad" },
  { ruta: "oportunidad.moneda", etiqueta: "Moneda", grupo: "Oportunidad" },
  { ruta: "oportunidad.probabilidad", etiqueta: "Probabilidad", grupo: "Oportunidad" },
  { ruta: "oportunidad.fechaCierre", etiqueta: "Fecha de cierre", grupo: "Oportunidad" },
  { ruta: "agente", etiqueta: "Nombre del agente", grupo: "Agente" },
  { ruta: "correo_agente", etiqueta: "Correo del agente", grupo: "Agente" },
];

// Misma sintaxis que interpolarPlantilla: {{ruta}} sin espacios.
const PATRON_VARIABLE = /\{\{([\w.]+)\}\}/g;

export function extraerVariables(texto: string): string[] {
  return [...texto.matchAll(PATRON_VARIABLE)].map((m) => m[1]);
}

/** workflow.variables.<nombre> que algún nodo de la definición guarda. */
export function variablesDeclaradas(def: DefinicionWorkflow): VariableDisponible[] {
  const nombres = new Set<string>();
  for (const nodo of def.nodos) {
    if (nodo.tipo !== "MENU" && nodo.tipo !== "ESPERAR_RESPUESTA") continue;
    const c = CONFIG_POR_TIPO[nodo.tipo].safeParse(nodo.config);
    const guardarEn = c.success ? c.data.guardarEn : undefined;
    if (guardarEn) nombres.add(guardarEn);
  }
  return [...nombres].map((n) => ({ ruta: `workflow.variables.${n}`, etiqueta: n, grupo: "Workflow" as const }));
}

/**
 * Prefijos válidos además de las variables fijas: campos personalizados de
 * empresa y oportunidad (metadata), que interpolarPlantilla resuelve por
 * clave. contacto.* no tiene fallback a metadata: solo valen las fijas.
 */
const PREFIJOS_DINAMICOS = ["empresa.", "oportunidad."];

export function esVariableConocida(ruta: string, declaradas: Set<string>): boolean {
  if (declaradas.has(ruta)) return true;
  if (VARIABLES_SISTEMA.some((v) => v.ruta === ruta)) return true;
  return PREFIJOS_DINAMICOS.some((p) => ruta.startsWith(p) && ruta.length > p.length);
}

/** Textos con {{variables}} dentro de la config de un nodo. */
export function textosConVariables(tipo: string, config: Record<string, unknown>): string[] {
  const textos: unknown[] = [];
  if (tipo === "ENVIAR_MENSAJE") textos.push(config.texto);
  if (tipo === "MENU") textos.push(config.pregunta);
  if (tipo === "CREAR_TAREA") textos.push(config.titulo, config.descripcion);
  if (tipo === "NOTIFICAR_AGENTE") textos.push(config.mensaje);
  if (tipo === "ATENCION_IA") textos.push(config.instrucciones, config.objetivo);
  return textos.filter((t): t is string => typeof t === "string");
}
