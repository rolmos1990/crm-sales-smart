import { Package } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

/**
 * 044 — Captura `notFound()` de cualquier ruta de Productos.
 *
 * Se renderiza dentro de `productos/layout.tsx`, así que hereda el armazón
 * autenticado: el menú sigue ahí y el usuario no queda sin navegación.
 *
 * Server Component y solo enlaces, nunca botones con handler: Next envía este
 * archivo con todas las rutas del segmento.
 */
export default function NotFound() {
  return (
    <AppErrorScreen
      Icono={Package}
      titulo="No encontramos este producto"
      descripcion="Puede que se haya eliminado del catálogo, o que el enlace tenga un identificador mal copiado."
      accion={<ButtonLink href="/productos">Ver catálogo</ButtonLink>}
      accionSecundaria={<ButtonLink variant="outline" href="/crm">Ir al inicio</ButtonLink>}
    />
  );
}
