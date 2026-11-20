import { Settings } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

/**
 * 044 — Captura `notFound()` de cualquier ruta de Configuración.
 *
 * Se renderiza dentro de `configuracion/layout.tsx`, así que hereda el armazón
 * autenticado: el menú sigue ahí y el usuario no queda sin navegación.
 *
 * Server Component y solo enlaces, nunca botones con handler: Next envía este
 * archivo con todas las rutas del segmento.
 */
export default function NotFound() {
  return (
    <AppErrorScreen
      Icono={Settings}
      titulo="No encontramos esta configuración"
      descripcion="La sección que buscás no existe o cambió de lugar."
      accion={<ButtonLink href="/configuracion">Ir a Configuración</ButtonLink>}
      accionSecundaria={<ButtonLink variant="outline" href="/crm">Ir al inicio</ButtonLink>}
    />
  );
}
