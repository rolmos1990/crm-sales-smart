// 041 — Grupos de canal visibles en Contactos. La UI agrupa las dos
// integraciones de WhatsApp en una sola opción: para quien vende es el mismo
// canal.

export const GRUPOS_CANAL = ["WHATSAPP", "INSTAGRAM", "FACEBOOK_MESSENGER", "EMAIL"] as const;
export type GrupoCanal = (typeof GRUPOS_CANAL)[number];

/** Valores de `ContactoIdentificadorCanal.canal` / `CuentaCanal.canal` de cada grupo. */
export const VALORES_POR_GRUPO_CANAL: Record<GrupoCanal, readonly string[]> = {
  WHATSAPP: ["whatsapp", "whatsapp_lite"],
  INSTAGRAM: ["instagram"],
  FACEBOOK_MESSENGER: ["facebook_messenger"],
  EMAIL: ["email"],
};

export const ETIQUETA_GRUPO_CANAL: Record<GrupoCanal, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK_MESSENGER: "Messenger",
  EMAIL: "Email",
};

export function grupoDeCanal(valor: string | null | undefined): GrupoCanal | null {
  if (!valor) return null;
  for (const grupo of GRUPOS_CANAL) {
    if (VALORES_POR_GRUPO_CANAL[grupo].includes(valor)) return grupo;
  }
  return null;
}
