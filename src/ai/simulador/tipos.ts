import type { TipoRelacionCliente, IntencionComercial } from "@/ai/estrategia/tipos";

export type { TipoRelacionCliente, IntencionComercial };

export interface ClienteSimulado {
  tipoRelacion: TipoRelacionCliente;
  intencion: IntencionComercial;
}

export interface EscenarioSimulacion {
  agenteIAConfigId: string;
  instanciaId: string;
  cliente: ClienteSimulado;
  usarBorrador: boolean;
  mensajes: string[];
}

export interface HerramientaEjecutadaDiagnostico {
  nombre: string;
  resultado: unknown;
  previsualizado: boolean;
}

export interface DiagnosticoRespuestaSimulada {
  respuesta: string;
  perfilClienteUsado: ClienteSimulado;
  estrategiaSeleccionada: { id: string; nombre: string; motivo: string } | null;
  ejemplosRecuperados: Array<{ id: string; etiquetasCoincidentes: number }>;
  herramientasEjecutadas: HerramientaEjecutadaDiagnostico[];
  informacionOperativaConsultada: string[];
  reglasAplicadas: string[];
  nivelConfianza: number | null;
  informacionFaltante: string[];
  decisionAutonomia: { accion: "ENVIAR" | "PENDIENTE" | "NO_GENERAR"; motivo: string } | null;
}
