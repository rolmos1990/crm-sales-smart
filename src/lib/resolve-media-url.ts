/**
 * Convierte una URL de media relativa en una URL absoluta usando STORAGE_URL del .env.
 *
 * Por qué: Las imágenes se almacenan en la base de datos como rutas relativas
 * (ej: /uploads/instancia/plantillas/imagen.webp) para que sean portables entre
 * entornos. Cuando se necesita enviar la imagen a canales externos (WhatsApp, email)
 * se debe entregar una URL pública completa que el servicio externo pueda descargar.
 *
 * Configurar en .env:
 *   STORAGE_URL=https://tu-dominio.com   # producción
 *   STORAGE_URL=http://localhost:3000     # desarrollo local (solo alcanzable si hay túnel)
 */
export function resolverUrlMedia(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined;

  // Si ya es una URL absoluta, devolverla tal cual
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Ruta relativa → necesita base URL
  const base = (process.env.STORAGE_URL ?? "").replace(/\/$/, "");

  if (!base) {
    console.warn(
      "[resolverUrlMedia] STORAGE_URL no está configurado en .env — " +
        "no se puede construir una URL absoluta para medios externos. " +
        `URL relativa ignorada: ${url}`
    );
    return undefined;
  }

  return `${base}${url}`;
}
