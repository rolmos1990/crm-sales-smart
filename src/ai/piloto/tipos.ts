import type { ClasificacionPiloto, EstadoRecomendacion } from "@/generated/prisma/enums";
import type { IntencionComercial, TipoRelacionCliente } from "@/ai/estrategia/tipos";

export type { ClasificacionPiloto, EstadoRecomendacion, IntencionComercial, TipoRelacionCliente };

export interface MensajeAnonimizado {
  rol: "user" | "assistant";
  texto: string;
}

export interface ContenidoAnonimizado {
  mensajes: MensajeAnonimizado[];
}

export interface CriteriosRecuperacion {
  instanciaId: string;
  agenteIAConfigId: string;
  intencion?: IntencionComercial;
  tipoCliente?: TipoRelacionCliente;
  playbookEstrategiaId?: string;
  productoId?: string;
}

export interface EjemploRecuperado {
  id: string;
  contenido: ContenidoAnonimizado;
  etiquetasCoincidentes: number;
}

export interface IRecuperadorEjemplos {
  recuperar(criterios: CriteriosRecuperacion): Promise<EjemploRecuperado[]>;
}
