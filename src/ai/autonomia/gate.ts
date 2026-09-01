import type { CategoriaIntencionAutonomia, NivelAutonomia } from "@/generated/prisma/enums";
import type { PerfilCliente } from "@/ai/perfil-cliente/tipos";
import type {
  AutonomiaIntencionConfigItem,
  ClasificacionIntencion,
  DecisionAutonomia,
} from "./tipos";

// research.md Decisión 5 — orden de severidad fijo, de mayor a menor restricción.
const ORDEN_SEVERIDAD: NivelAutonomia[] = [
  "HUMAN_ONLY",
  "SUGGESTION_ONLY",
  "CONDITIONAL_AUTOMATION",
  "AUTO_REPLY_SAFE_INTENTS",
];

function condicionesCumplidas(
  condiciones: AutonomiaIntencionConfigItem["condicionesConfianza"],
  confianza: number,
  perfilCliente?: PerfilCliente | null,
): boolean {
  // Edge Case: CONDITIONAL_AUTOMATION sin condiciones definidas → nunca se
  // cumplen (favorece la revisión humana sobre el envío automático).
  if (!condiciones) return false;

  if (
    typeof condiciones.confianzaMinimaClasificacion === "number" &&
    confianza < condiciones.confianzaMinimaClasificacion
  ) {
    return false;
  }

  if (condiciones.requiereAusenciaSenalClienteMolestoEnPerfil) {
    // Si el perfil no está disponible, esta condición se trata como no
    // cumplida (research.md Decisión 4).
    if (!perfilCliente) return false;
    const tieneIncidenciaActiva = perfilCliente.datosObjetivos.incidenciasActivas > 0;
    const requiereAtencionHumana =
      perfilCliente.datosInterpretados?.intencionComercialActual === "REQUIERE_ATENCION_HUMANA";
    if (tieneIncidenciaActiva || requiereAtencionHumana) return false;
  }

  return true;
}

/**
 * Función pura — sin I/O. El suscriptor le pasa datos ya cargados (contrato
 * en specs/016-.../contracts/gate.md).
 */
export function decidirAutonomia(
  configsPorCategoria: Map<CategoriaIntencionAutonomia, AutonomiaIntencionConfigItem> | null,
  clasificacion: ClasificacionIntencion | null,
  perfilCliente?: PerfilCliente | null,
): DecisionAutonomia {
  // FR-004 — sin ninguna fila configurada para el agente: comportamiento por defecto.
  if (configsPorCategoria === null) {
    return { accion: "ENVIAR", motivo: "Sin configuración de autonomía — comportamiento por defecto" };
  }

  // FR-010 — la clasificación falló: mismo resultado que sin configuración.
  if (clasificacion === null || clasificacion.categorias.length === 0) {
    return { accion: "ENVIAR", motivo: "No se pudo clasificar el mensaje — se envía por defecto" };
  }

  let nivelResultante: NivelAutonomia | null = null;
  let categoriaAplicada: CategoriaIntencionAutonomia | undefined;
  let confianzaDeCategoriaAplicada = 0;

  for (const { categoria, confianza } of clasificacion.categorias) {
    // Una categoría detectada sin fila propia se trata como segura por
    // defecto (research.md contrato de decidirAutonomia, paso 3).
    const nivel = configsPorCategoria.get(categoria)?.nivel ?? "AUTO_REPLY_SAFE_INTENTS";

    // Menor índice en ORDEN_SEVERIDAD = más restrictivo (Decisión 5).
    if (nivelResultante === null || ORDEN_SEVERIDAD.indexOf(nivel) < ORDEN_SEVERIDAD.indexOf(nivelResultante)) {
      nivelResultante = nivel;
      categoriaAplicada = categoria;
      confianzaDeCategoriaAplicada = confianza;
    }
  }

  if (!nivelResultante || !categoriaAplicada) {
    return { accion: "ENVIAR", motivo: "No se pudo clasificar el mensaje — se envía por defecto" };
  }

  if (nivelResultante === "HUMAN_ONLY") {
    return {
      accion: "NO_GENERAR",
      motivo: `Categoría ${categoriaAplicada} configurada como solo humano`,
      categoriaAplicada,
    };
  }

  if (nivelResultante === "SUGGESTION_ONLY") {
    return {
      accion: "PENDIENTE",
      motivo: `Categoría ${categoriaAplicada} configurada como sugerencia — requiere aprobación humana`,
      categoriaAplicada,
    };
  }

  if (nivelResultante === "AUTO_REPLY_SAFE_INTENTS") {
    return {
      accion: "ENVIAR",
      motivo: `Categoría ${categoriaAplicada} segura para respuesta automática`,
      categoriaAplicada,
    };
  }

  // CONDITIONAL_AUTOMATION
  const condiciones = configsPorCategoria.get(categoriaAplicada)?.condicionesConfianza ?? null;
  const cumplidas = condicionesCumplidas(condiciones, confianzaDeCategoriaAplicada, perfilCliente);
  return cumplidas
    ? { accion: "ENVIAR", motivo: `Categoría ${categoriaAplicada}: condiciones de confianza cumplidas`, categoriaAplicada }
    : { accion: "PENDIENTE", motivo: `Categoría ${categoriaAplicada}: condiciones de confianza no cumplidas`, categoriaAplicada };
}
