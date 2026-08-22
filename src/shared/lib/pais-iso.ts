/**
 * Mapa de país (`ConfiguracionEmpresa.pais`, texto libre elegido en
 * Configuración → Empresa) → código ISO alpha-2, usado por `<PhoneInput>`
 * para preseleccionar el prefijo telefónico por defecto en vez del +51 de
 * Perú (su fallback interno). Ver src/components/ui/phone-input.tsx.
 */
export const PAIS_A_ISO: Record<string, string> = {
  "Panamá": "PA",
  "Perú": "PE",
  "Colombia": "CO",
  "México": "MX",
  "Argentina": "AR",
  "Chile": "CL",
  "Ecuador": "EC",
  "Bolivia": "BO",
  "Venezuela": "VE",
  "Paraguay": "PY",
  "Uruguay": "UY",
  "Costa Rica": "CR",
  "Guatemala": "GT",
};

/** Sin país configurado, o país sin mapeo conocido → Panamá (mismo fallback
 *  ya usado en Pipeline/Contactos, ver PAIS_A_ISO ahí). */
export function isoDesdePais(pais: string | null | undefined): string {
  if (!pais) return "PA";
  return PAIS_A_ISO[pais] ?? "PA";
}
