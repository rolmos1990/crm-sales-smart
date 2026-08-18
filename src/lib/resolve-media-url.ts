/**
 * Convierte una URL de media relativa en una URL absoluta usando APP_URL.
 *
 * Por qué: las rutas relativas (`/uploads/...` del proveedor `local`, o
 * `/cdn/...` del proxy interno de S3Provider cuando no hay dominio propio
 * configurado — ver s3.provider.ts) son siempre rutas DE ESTA MISMA APP, así
 * que su origen absoluto es necesariamente APP_URL, nunca un dominio aparte.
 * Cuando se necesita enviar la imagen a canales externos (WhatsApp, Instagram,
 * email) se debe entregar esa URL pública completa para que el servicio
 * externo pueda descargarla.
 *
 * Antes existía una variable STORAGE_URL separada para esto — se eliminó:
 * al ser dos variables apuntando "casi siempre" al mismo dominio, era fácil
 * dejar una desactualizada (ej. en un valor viejo `localhost`) y romper en
 * silencio el envío de imágenes a canales externos sin que nada lo avisara.
 * Una sola fuente de verdad (APP_URL, ya usada también en los callbacks de
 * OAuth) evita esa clase de bug.
 */
export function resolverUrlMedia(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined;

  // Si ya es una URL absoluta (proveedor S3/R2 con dominio propio), devolverla tal cual
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Ruta relativa → necesita base URL
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");

  if (!base) {
    console.warn(
      "[resolverUrlMedia] APP_URL no está configurado — no se puede construir " +
        `una URL absoluta para medios externos. URL relativa ignorada: ${url}`
    );
    return undefined;
  }

  return `${base}${url}`;
}
