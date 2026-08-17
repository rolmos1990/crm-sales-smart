/**
 * Centraliza las diferencias entre los dos flujos de autenticación que puede
 * tener una CuentaCanal de Instagram:
 *
 *  - "MetaFacebook": flujo heredado (Facebook Login + Página de Facebook
 *    vinculada). Usa graph.facebook.com y un Page Access Token.
 *  - "Instagram": Instagram API with Instagram Login (Business Login for
 *    Instagram). Usa graph.instagram.com y un Instagram User Access Token.
 *
 * Ambos flujos comparten la misma forma de payload en mensajería (webhooks
 * de Meta) y el mismo patrón `/{ig-id}/messages` para enviar — solo cambia
 * el host base. Este módulo es el único lugar que debe conocer esa
 * diferencia; el resto del código (provider, webhook) no debe ramificar por
 * proveedorAuth directamente.
 */

export type ProveedorAuthInstagram = "MetaFacebook" | "Instagram";

// Versión de Graph API vigente al momento de esta integración. Revisar
// https://developers.facebook.com/docs/graph-api/changelog antes de subir
// de versión — Meta retira versiones ~2 años después de su lanzamiento.
const GRAPH_FACEBOOK_VERSION = "v20.0";
const GRAPH_INSTAGRAM_VERSION = "v23.0";

const API_BASE: Record<ProveedorAuthInstagram, string> = {
  MetaFacebook: `https://graph.facebook.com/${GRAPH_FACEBOOK_VERSION}`,
  Instagram: `https://graph.instagram.com/${GRAPH_INSTAGRAM_VERSION}`,
};

function esProveedorValido(valor: unknown): valor is ProveedorAuthInstagram {
  return valor === "MetaFacebook" || valor === "Instagram";
}

/**
 * Resuelve el host base de Graph API a usar para una CuentaCanal de
 * Instagram, a partir del `proveedorAuth` guardado en su configuración.
 * Sin valor reconocido → asume el flujo heredado (compatibilidad con
 * cuentas conectadas antes de este campo).
 */
export function resolverApiBaseIG(proveedorAuth: unknown): string {
  return esProveedorValido(proveedorAuth) ? API_BASE[proveedorAuth] : API_BASE.MetaFacebook;
}

export const INSTAGRAM_LOGIN_GRAPH_VERSION = GRAPH_INSTAGRAM_VERSION;
