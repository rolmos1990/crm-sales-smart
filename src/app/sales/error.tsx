"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

/**
 * 044 — Límite de error de Ventas.
 *
 * Se renderiza dentro de `sales/layout.tsx`, así que el menú sigue ahí y
 * el fallo de esta sección no tumba el resto de la aplicación.
 *
 * El botón hace `router.refresh()` y RECIÉN DESPUÉS `reset()`. No es un
 * detalle de estilo: en Next 15 `reset()` solo limpia el estado del boundary y
 * vuelve a renderizar con los mismos datos. Como todas las páginas de Karia
 * leen del lado del servidor, sin el refresh el reintento volvería a fallar
 * siempre y el botón sería decorativo. (`retry()`, que sí re-consulta, llegó
 * recién en Next 16.3.)
 */
export default function VentasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[VentasError] Error al renderizar la sección:", error);
  }, [error]);

  // El mensaje visible nunca sale del error: en producción Next ya lo
  // reemplaza por uno genérico, y acá se escribe a mano igual. Lo único que
  // viaja del error a la pantalla es el digest.
  const codigoSoporte = error instanceof Error ? error.digest : undefined;

  return (
    <AppErrorScreen
      titulo="No pudimos cargar esta sección"
      descripcion="Fue un problema nuestro, no algo que hayas hecho mal. Probá de nuevo; si sigue pasando, pasale el código de abajo a soporte."
      codigoSoporte={codigoSoporte}
      accion={
        <Button
          onClick={() => {
            router.refresh();
            reset();
          }}
        >
          Reintentar
        </Button>
      }
      accionSecundaria={<ButtonLink variant="outline" href="/sales/pedidos">Ver pedidos</ButtonLink>}
    />
  );
}
