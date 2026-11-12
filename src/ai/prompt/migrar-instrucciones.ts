import {
  buildRol,
  construirBloqueIdentidadExtendida,
  construirBloqueReglasDeNegocio,
  construirBloqueTono,
  type ConfigAgenteParaPrompt,
} from "./builder";

// Convierte la configuración por campos de un agente (la 009: rol, identidad,
// estilo, especialidad, frases, reglas, condiciones de transferencia) en el
// bloque único de instrucciones.
//
// Reutiliza a propósito las mismas funciones que arman el prompt hoy: así el
// texto migrado dice exactamente lo que ese agente ya venía diciendo, y pasar
// de un modelo al otro no le cambia el comportamiento. Si estas frases se
// editan en `builder.ts`, la migración las sigue sin tocar nada acá.
//
// El "# Proceso de atención" no se genera: hoy no existe ningún campo que lo
// alimente. Un agente migrado queda sin proceso —igual que estaba— y quien lo
// quiera lo escribe. Las plantillas de tipo sí lo traen, pero solo se aplican
// a agentes nuevos (ver `plantillas-agente.ts`).

const SIN_INSTRUCCIONES = "";

function seccion(titulo: string, cuerpo: string): string {
  return `# ${titulo}\n${cuerpo.trim()}`;
}

/** Quita el encabezado que la función del builder ya trae ("Estilo de comunicación:\n- …"). */
function sinEncabezado(bloque: string): string {
  const salto = bloque.indexOf("\n");
  return salto === -1 ? "" : bloque.slice(salto + 1);
}

export function generarInstruccionesDesdeConfig(config: ConfigAgenteParaPrompt): string {
  // Un agente ya migrado no se vuelve a migrar: su texto manda.
  if (config.instruccionesAgente?.trim()) return config.instruccionesAgente.trim();

  const secciones: string[] = [];

  // ── Rol y objetivo ───────────────────────────────────────────────────────
  const rol = [buildRol(config), construirBloqueIdentidadExtendida(config)]
    .filter(Boolean)
    .join(" ");
  const conEspecialidad = config.especialidad
    ? `${rol} Área de especialidad: ${config.especialidad}.`
    : rol;
  secciones.push(seccion("Rol y objetivo", conEspecialidad));

  // ── Estilo de comunicación ───────────────────────────────────────────────
  const bloqueTono = construirBloqueTono(config.configuracionTono, config);
  if (bloqueTono) {
    secciones.push(seccion("Estilo de comunicación", sinEncabezado(bloqueTono)));
  } else if (config.personalidad) {
    secciones.push(seccion("Estilo de comunicación", `Tu estilo y personalidad: ${config.personalidad}.`));
  }

  // ── Reglas ───────────────────────────────────────────────────────────────
  const bloqueReglas = construirBloqueReglasDeNegocio(config);
  if (bloqueReglas) {
    secciones.push(seccion("Reglas", sinEncabezado(bloqueReglas)));
  }

  return secciones.length > 0 ? secciones.join("\n\n") : SIN_INSTRUCCIONES;
}
