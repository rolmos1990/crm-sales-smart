"use server";

import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { EscenarioSimulacionSchema } from "./schema";
import type { DiagnosticoRespuestaSimulada } from "./tipos";

type Resultado<T extends object = object> = ({ exito: true } & T) | { exito: false; error: string };

export async function ejecutarSimulacionAction(datos: unknown): Promise<Resultado<{ diagnosticos: DiagnosticoRespuestaSimulada[] }>> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const validado = EscenarioSimulacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Escenario inválido" };

  try {
    const { simuladorService } = await import("./servicio");
    const diagnosticos = await simuladorService.ejecutar({
      ...validado.data,
      instanciaId: auth.sesion.instanciaId,
    });
    return { exito: true, diagnosticos };
  } catch (err) {
    console.error("[Simulador] Error al ejecutar la simulación:", err);
    return { exito: false, error: "No se pudo ejecutar la simulación en este momento" };
  }
}
