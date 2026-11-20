"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ServerCrash } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

/**
 * 044 — Límite de error de la raíz: captura lo que falla en el armazón
 * autenticado (`LayoutAppServidor`: sesión, zona horaria, menú, asistente).
 *
 * Tiene que estar acá y no dentro de cada segmento porque un `error.tsx` NO
 * envuelve el `layout.tsx` de su propio segmento, solo los de abajo. Como el
 * armazón se monta justamente en esos layouts, su fallo sube un nivel.
 *
 * **Sin menú, y es lo correcto**: lo que falló es precisamente lo que lo
 * construye. Prometer menú acá sería prometer lo imposible.
 *
 * La salida secundaria va al inicio de sesión y no al inicio de la aplicación:
 * la causa más probable de que el armazón no se arme es que la sesión no se
 * pudo resolver.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[RootError] Error al montar el armazón de la aplicación:", error);
  }, [error]);

  const codigoSoporte = error instanceof Error ? error.digest : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <AppErrorScreen
        Icono={ServerCrash}
        titulo="No pudimos cargar Karia"
        descripcion="Hubo un problema al preparar tu sesión. Probá de nuevo; si sigue pasando, volvé a iniciar sesión o pasale el código de abajo a soporte."
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
        accionSecundaria={<ButtonLink variant="outline" href="/login">Iniciar sesión</ButtonLink>}
      />
    </div>
  );
}
