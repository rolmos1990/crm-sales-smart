import { type NextRequest, NextResponse } from "next/server";
import { refrescarSesion } from "@/shared/auth/provider";
import { esZonaHorariaValida } from "@/shared/fechas/zona";

// La zona detectada por el navegador viaja en una cookie (la escribe
// TimeZoneProvider) y el middleware la promueve a header de request.
//
// Por qué la vuelta por cookie: React controla el fetch de las Server Actions,
// así que desde el cliente no se le pueden agregar headers. La cookie sí viaja
// en todo — navegación, Server Actions, Route Handlers y hasta EventSource, que
// no puede mandar headers pero sí cookies. Promoverla a header hace que
// `headers().get("x-time-zone")` funcione igual en cualquiera de esos contextos.
const COOKIE_ZONA = "karia_tz";
const HEADER_ZONA = "x-time-zone";

// Rutas públicas que no requieren sesión activa.
// "/api/webhooks" también es pública: los webhooks de Meta/WhatsApp llegan sin
// cookie de sesión y se validan con su propia firma/token, no con nuestro login.
const RUTAS_PUBLICAS = [
  "/login",
  "/registro",
  "/auth/callback",
  "/auth/invitacion",
  "/auth/reset-password",
  "/auth/magiclink",
  "/auth/configurar-cuenta",
  "/privacy-policy",
  "/terms-of-service",
  "/data-deletion-status",
  "/api/webhooks",
];

function esRutaPublica(pathname: string) {
  return RUTAS_PUBLICAS.some((ruta) => pathname.startsWith(ruta));
}

/**
 * Headers a propagar al request, con `x-time-zone` derivado de la cookie.
 *
 * El `delete` inicial no es decorativo: /api/webhooks/** es público y lo
 * matchea este middleware, así que sin él cualquiera podría mandar el header a
 * mano. Solo se acepta lo que salga de la cookie y pase la validación IANA —
 * una cadena inválida haría lanzar RangeError a `Intl` más abajo.
 */
function construirHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete(HEADER_ZONA);
  const zona = request.cookies.get(COOKIE_ZONA)?.value;
  if (esZonaHorariaValida(zona)) headers.set(HEADER_ZONA, zona);
  return headers;
}

export async function middleware(request: NextRequest) {
  const { response, usuario } = await refrescarSesion(request, construirHeaders(request));
  const { pathname } = request.nextUrl;

  if (!usuario && !esRutaPublica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
