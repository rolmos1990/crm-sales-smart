// 035 — Nombre de archivo para Content-Disposition de un adjunto de correo.
// El nombre lo eligió el remitente: no puede inyectar cabeceras ni rutas.

/** Nombre seguro: sin rutas, comillas, saltos de línea ni puntos iniciales. */
export function nombreDescarga(nombre: string): string {
  const limpio = nombre.replace(/[\/"\r\n\t\0]/g, "_").replace(/^\.+/, "").trim().slice(0, 200);
  return limpio || "adjunto";
}

export function conExtension(nombre: string, extension: string): string {
  return /\.[a-z0-9]{1,8}$/i.test(nombre) ? nombre.replace(/\.[a-z0-9]{1,8}$/i, extension) : nombre + extension;
}

/** Content-Disposition con respaldo ASCII y nombre UTF-8 (RFC 5987). */
export function contentDispositionAdjunto(nombre: string): string {
  return `attachment; filename="${nombre.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}
