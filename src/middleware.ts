import { type NextRequest, NextResponse } from "next/server";
import { refrescarSesion } from "@/shared/auth/provider";

// Rutas públicas que no requieren sesión activa.
const RUTAS_PUBLICAS = ["/login", "/registro", "/auth/callback", "/auth/invitacion", "/auth/reset-password", "/auth/magiclink", "/auth/configurar-cuenta", "/privacy-policy"];

function esRutaPublica(pathname: string) {
  return RUTAS_PUBLICAS.some((ruta) => pathname.startsWith(ruta));
}

export async function middleware(request: NextRequest) {
  const { response, usuario } = await refrescarSesion(request);
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
