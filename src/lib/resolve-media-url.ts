/**
 * Convierte una URL de media relativa en una URL absoluta.
 *
 * Por qué: Las imágenes de proveedor `local` se almacenan como rutas relativas
 * (ej: /uploads/instancia/plantillas/imagen.webp) para que sean portables entre
 * entornos. Cuando se necesita enviar la imagen a canales externos (WhatsApp, email)
 * se debe entregar una URL pública completa que el servicio externo pueda descargar.
 *
 * Base URL: usa STORAGE_URL si está definida explícitamente (útil si el storage
 * vive en un dominio distinto al de la app); si no, cae a APP_URL (la misma
 * variable ya usada para los callbacks de OAuth). Dejar STORAGE_URL sin definir
 * evita que quede una URL vieja/localhost olvidada en el entorno — ese fue
 * justamente el bug que rompía la carga de imágenes en producción.
 *
 * Configurar en .env (opcional, solo si el storage NO vive en el mismo dominio
 * que APP_URL):
 *   STORAGE_URL=https://cdn.tu-dominio.com
 */
export function resolverUrlMedia(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined;

  // Si ya es una URL absoluta (proveedor S3/R2), devolverla tal cual
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Ruta relativa (proveedor local) → necesita base URL
  const base = (process.env.STORAGE_URL || process.env.APP_URL || "").replace(/\/$/, "");

  if (!base) {
    console.warn(
      "[resolverUrlMedia] Ni STORAGE_URL ni APP_URL están configurados — " +
        "no se puede construir una URL absoluta para medios externos. " +
        `URL relativa ignorada: ${url}`
    );
    return undefined;
  }

  return `${base}${url}`;
}
