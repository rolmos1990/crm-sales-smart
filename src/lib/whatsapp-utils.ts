// Detecta si un identificador de WhatsApp es un LID (número con privacidad activada)
// vs un número de teléfono real (@s.whatsapp.net normalizado a +DIGITS)
export const esLid = (id: string | null | undefined): boolean =>
  !!id?.endsWith("@lid");

// Formatea el identificador para mostrar al agente.
// Retorna null si no hay identificador para permitir encadenamiento de fallbacks.
export const formatearIdentificadorWA = (id: string | null | undefined): string | null => {
  if (!id) return null;
  if (id.endsWith("@lid")) return `WA ID: ${id.replace("@lid", "")}`;
  return id;
};
