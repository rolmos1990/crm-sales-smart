import { ShoppingCart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

/**
 * 044 — Captura `notFound()` de cualquier ruta de Ventas.
 *
 * Se renderiza dentro de `sales/layout.tsx`, así que hereda el armazón
 * autenticado: el menú sigue ahí y el usuario no queda sin navegación.
 *
 * Server Component y solo enlaces, nunca botones con handler: Next envía este
 * archivo con todas las rutas del segmento.
 */
export default function NotFound() {
  return (
    <AppErrorScreen
      Icono={ShoppingCart}
      titulo="No encontramos este registro"
      descripcion="Puede que se haya eliminado, o que el enlace tenga un identificador mal copiado."
      accion={<ButtonLink href="/sales/pedidos">Ver pedidos</ButtonLink>}
      accionSecundaria={<ButtonLink variant="outline" href="/crm">Ir al inicio</ButtonLink>}
    />
  );
}
