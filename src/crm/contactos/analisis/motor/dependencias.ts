import { evaluarLoteConIA } from "@/ai/analisis-contactos/evaluar-lote";
import type { OpcionesCiclo } from "./ciclo";
import { marcarMotorIAConectado } from "./disponibilidad";
import { evaluarDisponibilidadIA, registrarConsumoLocal } from "./presupuesto";

/**
 * 042 — Dependencias de producción del motor: qué ejecutor de IA usa, cómo
 * mide la disponibilidad y cómo entrega la interpretación al perfil 012. El
 * simulador de carga arma las suyas (ejecutor simulado) sin pasar por acá.
 *
 * Conectar el ejecutor y marcar el motor como conectado van JUNTOS: recién
 * entonces el perfil 012 deja su extracción por evento a cargo del motor
 * (riesgo R1). Nunca uno sin el otro.
 */
export async function dependenciasMotorAnalisis(): Promise<OpcionesCiclo> {
  marcarMotorIAConectado(true);
  return {
    dependencias: {
      ejecutorIA: evaluarLoteConIA,
      disponibilidadIA: evaluarDisponibilidadIA,
      registrarConsumo: registrarConsumoLocal,
      alEvaluarConIA: async (instanciaId, contactoId, ia) => {
        const { fusionarDatosInterpretados } = await import("@/ai/perfil-cliente/servicio");
        await fusionarDatosInterpretados(contactoId, instanciaId, {
          intencionComercialActual: ia.intencionComercial,
          productosConsultados: ia.productosConsultados,
          presupuestoConocido: ia.presupuestoConocido,
          ocasionActual: ia.ocasionActual,
          fechaRequerida: ia.fechaRequerida,
          confianza: 0.8,
        });
      },
    },
  };
}
