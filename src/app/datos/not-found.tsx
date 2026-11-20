import { Database } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

/**
 * 044 — Captura `notFound()` de cualquier ruta de Importar datos.
 *
 * Se renderiza dentro de `datos/layout.tsx`, así que hereda el armazón
 * autenticado: el menú sigue ahí y el usuario no queda sin navegación.
 *
 * Server Component y solo enlaces, nunca botones con handler: Next envía este
 * archivo con todas las rutas del segmento.
 */
export default function NotFound() {
  return (
    <AppErrorScreen
      Icono={Database}
      titulo="No encontramos esta sección"
      descripcion="La página que buscás dentro de Importar datos no existe o cambió de lugar."
      accion={<ButtonLink href="/datos">Ir a Importar datos</ButtonLink>}
      accionSecundaria={<ButtonLink variant="outline" href="/crm">Ir al inicio</ButtonLink>}
    />
  );
}
