// 013-context-builder-capas-precedencia — capa 4. Primer punto real donde
// el selector de 011 se conecta a una conversación real (antes solo era
// invocable manualmente/desde tests). Tolerante a fallo (FR-009): cualquier
// error acá degrada a "sin estrategia", nunca bloquea la generación.
import { listarAsignacionesDeAgente } from "@/ai/estrategia/queries";
import { seleccionarEstrategia, type EstrategiaAsignada, type CondicionesEstrategia } from "@/ai/estrategia/selector";
import { registrarSeleccionEstrategia } from "@/ai/estrategia/registrar-seleccion";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";

interface InsumosCapaEstrategia {
  instanciaId: string;
  agenteIAConfigId: string;
  conversacionId?: string;
  perfilCliente: PerfilCliente | null;
}

interface ResultadoCapaEstrategia {
  texto: string | null;
  estrategiaSeleccionada: { id: string; nombre: string } | null;
}

export async function producirCapaEstrategia(insumos: InsumosCapaEstrategia): Promise<ResultadoCapaEstrategia> {
  try {
    const asignaciones = await listarAsignacionesDeAgente(insumos.agenteIAConfigId);

    const estrategiasAsignadas: EstrategiaAsignada[] = asignaciones
      .filter((a) => a.playbookEstrategia.activo)
      .map((a) => ({
        playbookEstrategiaId: a.playbookEstrategiaId,
        nombre: a.playbookEstrategia.nombre,
        contenido: a.playbookEstrategia.contenido as unknown as { reglas: string[] },
        condiciones: (a.condicionesOverride as unknown as CondicionesEstrategia | null) ??
          (a.playbookEstrategia.condiciones as unknown as CondicionesEstrategia),
        prioridadEfectiva: a.prioridadEfectiva ?? a.playbookEstrategia.prioridad,
        asignadaEn: a.creadoEn,
      }));

    const senales = {
      tipoRelacion: insumos.perfilCliente?.tipoRelacion,
      intencion: insumos.perfilCliente?.datosInterpretados?.intencionComercialActual ?? undefined,
    };

    const resultado = seleccionarEstrategia(estrategiasAsignadas, senales);

    await registrarSeleccionEstrategia({
      instanciaId: insumos.instanciaId,
      agenteIAConfigId: insumos.agenteIAConfigId,
      conversacionId: insumos.conversacionId,
      resultado,
      senales,
    });

    if (!resultado.estrategiaSeleccionada) return { texto: null, estrategiaSeleccionada: null };

    const texto =
      `Estrategia activa para esta conversación (${resultado.estrategiaSeleccionada.nombre}):\n` +
      resultado.estrategiaSeleccionada.contenido.reglas.map((r) => `- ${r}`).join("\n");

    return {
      texto,
      estrategiaSeleccionada: {
        id: resultado.estrategiaSeleccionada.playbookEstrategiaId,
        nombre: resultado.estrategiaSeleccionada.nombre,
      },
    };
  } catch (err) {
    console.error("[ContextBuilder] Error al resolver la capa de estrategia:", err);
    return { texto: null, estrategiaSeleccionada: null };
  }
}
