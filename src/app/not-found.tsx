import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

export const metadata: Metadata = {
  title: "Página no encontrada — KariaApp",
};

/**
 * 044 — 404 de las direcciones que no coinciden con ninguna ruta.
 *
 * **Sin menú, y no es una omisión**: ningún segmento llegó a activarse, así que
 * no hay armazón del que heredarlo. Es un límite del enrutado, no una decisión
 * de diseño. Lo alcanzable acá es identidad visual y una salida.
 *
 * **Y sin leer la sesión, que es la parte contraintuitiva.** La primera
 * versión resolvía la sesión acá para mandar al usuario con sesión al inicio y
 * al resto al login. Funcionaba, pero el build mostró el costo: este archivo
 * participa del árbol de TODAS las rutas, así que usar una API dinámica acá
 * volvió dinámicas las nueve páginas públicas —`/`, `/privacy-policy`,
 * `/terms-of-service`, `/registro`, `/auth/*`— que antes se prerenderizaban.
 * Pagar eso en cada página legal y de registro, por una pantalla de 404, es
 * mal negocio.
 *
 * El destino sigue dependiendo de la sesión, solo que lo resuelve quien ya lo
 * hacía: el middleware manda un 307 a `/login` para cualquier ruta no pública
 * sin sesión, antes de renderizar nada. Con sesión se cae en `/crm`; sin
 * sesión, en el login. Mismo resultado para el usuario, sin convertir la
 * aplicación entera en dinámica.
 */
export default function NotFound() {
  return (
    <AppErrorScreen
      Icono={Compass}
      titulo="Esta página no existe"
      descripcion="La dirección que abriste no corresponde a ninguna sección de Karia. Puede que el enlace esté mal copiado o que la página haya cambiado de lugar."
      accion={<ButtonLink href="/crm">Ir al inicio</ButtonLink>}
    />
  );
}
