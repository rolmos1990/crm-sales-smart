// 013-context-builder-capas-precedencia — capa 5. Tolerante a fallo
// (FR-009): si el perfil no se puede calcular, la capa se omite sin
// bloquear la generación.
import { obtenerPerfil } from "@/ai/perfil-cliente/servicio";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";

export async function producirCapaPerfilCliente(
  contactoId: string,
  instanciaId: string,
): Promise<PerfilCliente | null> {
  try {
    return await obtenerPerfil(contactoId, instanciaId);
  } catch (err) {
    console.error("[ContextBuilder] Error al resolver la capa de perfil de cliente:", err);
    return null;
  }
}
