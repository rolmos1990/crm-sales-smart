import { listarCiudadesCubiertasPorProvincia } from "@/shared/entregas/resolver-costo-envio";
import { transferirAHumanoInterno } from "@/ai/tools/shared/transferir-a-humano-interno";
import type { ContextoTool, ResultadoTool } from "@/ai/tools/types";

// Qué hacer cuando resolverCostoEnvio devuelve SIN_COINCIDENCIA_CLARA.
//
// Hasta acá las tres tools de envío (calcular_costo_envio, validar_cobertura,
// estimar_fecha_entrega) escalaban a un humano de inmediato. Eso es correcto
// cuando de verdad no se sabe nada del destino, pero no cuando el cliente
// nombró solo la provincia y el negocio cobra por distrito: ahí sí hay
// cobertura y lo único que falta es una pregunta.
//
// El caso real que lo destapó: "¿hacen envíos a Chiriquí?" terminaba en
// "lo confirma un compañero del equipo" aunque Chiriquí estuviera cubierta,
// porque obtenerCandidatosEnvioPorZona exige que el destino aporte cada
// nivel que la zona define (si la zona dice `distritoCiudad`, la provincia
// sola no coincide) y compara por slug exacto, sin tolerar el sufijo
// administrativo del catálogo ("Chiriquí" vs "Chiriquí Province").
//
// listarCiudadesCubiertasPorProvincia ya resuelve las dos cosas —tolera el
// sufijo y lista los distritos con tarifa vigente— y existía justamente para
// esto, pero solo la usaba la UI humana. Preguntar antes de escalar no toca
// obtenerCandidatosEnvioPorZona, que sigue congelada (FR-010 de la 024).

export interface DestinoAmbiguo {
  pais?: string;
  estadoProvincia: string;
  /** Si el cliente ya la dijo, preguntar de nuevo no aporta: se escala. */
  ciudad?: string;
  transportistaId?: string;
}

export async function resolverSinCoincidenciaClara(params: {
  ctx: ContextoTool;
  destino: DestinoAmbiguo;
  /** Queda en Conversacion.atencionMotivo si se termina escalando. */
  motivo: string;
  /** Lo que lee el modelo cuando sí se escala. */
  mensajeEscalacion: string;
}): Promise<ResultadoTool> {
  const { ctx, destino, motivo, mensajeEscalacion } = params;

  if (!destino.ciudad) {
    const ciudades = await listarCiudadesCubiertasPorProvincia({
      instanciaId: ctx.instanciaId,
      pais: destino.pais,
      estadoProvincia: destino.estadoProvincia,
      transportistaId: destino.transportistaId,
    });

    if (ciudades.length > 0) {
      return {
        ok: true,
        data: {
          requiereCiudad: true,
          estadoProvincia: destino.estadoProvincia,
          ciudades,
          mensaje:
            `Sí hay cobertura en ${destino.estadoProvincia}, pero el costo y el tiempo dependen del distrito. ` +
            `Preguntale al cliente a cuál de estos destinos va el envío: ${ciudades.join(", ")}. ` +
            `No des todavía un precio ni una fecha, y no transfieras a un asesor: volvé a consultar con la ciudad ya elegida.`,
        },
      };
    }
  }

  await transferirAHumanoInterno(ctx, motivo);
  return { ok: true, data: { transferidoAHumano: true, mensaje: mensajeEscalacion } };
}
