import type { TipoRelacionCliente, IntencionComercial } from "./tipos";

export interface ContenidoEstrategia {
  reglas: string[];
}

export interface CondicionesEstrategia {
  tiposRelacion: TipoRelacionCliente[];
  intenciones: IntencionComercial[];
}

export interface EstrategiaAsignada {
  playbookEstrategiaId: string;
  nombre: string;
  contenido: ContenidoEstrategia;
  condiciones: CondicionesEstrategia;
  prioridadEfectiva: number;
  asignadaEn: Date;
}

export interface SenalesSeleccion {
  tipoRelacion?: TipoRelacionCliente;
  intencion?: IntencionComercial;
}

export interface ResultadoSeleccion {
  estrategiaSeleccionada: EstrategiaAsignada | null;
  motivo: string;
  candidatas: number;
}

function coincide(estrategia: EstrategiaAsignada, senales: SenalesSeleccion): boolean {
  const { tiposRelacion, intenciones } = estrategia.condiciones;
  const coincideTipoRelacion =
    tiposRelacion.length === 0 || (senales.tipoRelacion !== undefined && tiposRelacion.includes(senales.tipoRelacion));
  const coincideIntencion =
    intenciones.length === 0 || (senales.intencion !== undefined && intenciones.includes(senales.intencion));

  // Si la estrategia no define ninguna condición en una dimensión, esa
  // dimensión no restringe — pero si la define, la señal correspondiente
  // debe estar presente y coincidir (research.md Decisión 3 de la spec).
  if (tiposRelacion.length > 0 && intenciones.length > 0) return coincideTipoRelacion && coincideIntencion;
  if (tiposRelacion.length > 0) return coincideTipoRelacion;
  if (intenciones.length > 0) return coincideIntencion;
  return true; // sin ninguna condición configurada: aplica siempre que se le asigne
}

/**
 * Selecciona, entre las estrategias asignadas a un agente, la que coincide
 * con las señales de la situación actual — determinístico, sin I/O
 * (FR-007..009, research.md Decisiones 3 y 4 de la spec).
 */
export function seleccionarEstrategia(
  estrategiasAsignadas: EstrategiaAsignada[],
  senales: SenalesSeleccion,
): ResultadoSeleccion {
  const candidatas = estrategiasAsignadas.filter((e) => coincide(e, senales));

  if (candidatas.length === 0) {
    return {
      estrategiaSeleccionada: null,
      motivo: `Sin coincidencias entre ${estrategiasAsignadas.length} estrategia(s) evaluada(s)`,
      candidatas: 0,
    };
  }

  const ordenadas = [...candidatas].sort((a, b) => {
    if (b.prioridadEfectiva !== a.prioridadEfectiva) return b.prioridadEfectiva - a.prioridadEfectiva;
    return b.asignadaEn.getTime() - a.asignadaEn.getTime(); // desempate determinístico: asignación más reciente
  });

  const ganadora = ordenadas[0];
  const motivo =
    candidatas.length > 1
      ? `Empate de prioridad entre ${candidatas.length} candidatas, se tomó la de asignación más reciente`
      : `Coincide tipo de relación=${senales.tipoRelacion ?? "—"} e intención=${senales.intencion ?? "—"}; 1 candidata`;

  return { estrategiaSeleccionada: ganadora, motivo, candidatas: candidatas.length };
}
