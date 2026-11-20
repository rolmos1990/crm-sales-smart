import { Plug } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

/**
 * 044 — Captura `notFound()` de cualquier ruta de Integraciones.
 *
 * Se renderiza dentro de `integraciones/layout.tsx`, así que hereda el armazón
 * autenticado: el menú sigue ahí y el usuario no queda sin navegación.
 *
 * Server Component y solo enlaces, nunca botones con handler: Next envía este
 * archivo con todas las rutas del segmento.
 */
export default function NotFound() {
  return (
    <AppErrorScreen
      Icono={Plug}
      titulo="No encontramos esta integración"
      descripcion="La integración que buscás no existe o ya no está disponible."
      accion={<ButtonLink href="/integraciones">Ver integraciones</ButtonLink>}
      accionSecundaria={<ButtonLink variant="outline" href="/crm">Ir al inicio</ButtonLink>}
    />
  );
}
