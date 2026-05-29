/**
 * Extrae solo los dígitos de un string de teléfono.
 * "+507 612-3456" → "5076123456"
 */
export function normalizarTelefono(telefono: string): string {
  return telefono.replace(/\D/g, "");
}

/**
 * Construye el JID de WhatsApp a partir de un teléfono en cualquier formato.
 * "+50761234567" → "50761234567@s.whatsapp.net"
 */
export function construirJidWhatsapp(telefono: string): string {
  const digits = normalizarTelefono(telefono);
  return digits ? `${digits}@s.whatsapp.net` : "";
}
