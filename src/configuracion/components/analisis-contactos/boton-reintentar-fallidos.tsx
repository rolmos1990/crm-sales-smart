"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSesion } from "@/shared/auth/sesion-context";
import { reintentarFallidosAction } from "@/crm/contactos/analisis/configuracion/actions";

export function BotonReintentarFallidos() {
  const { puedeModificar } = useSesion();
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  if (!puedeModificar("ia")) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const r = await reintentarFallidosAction();
          if (!r.exito) return void toast.error(r.error);
          toast.success(`${r.datos.reintentados} contactos vuelven a la cola`);
          router.refresh();
        })
      }
    >
      <RotateCcw className="size-3.5" aria-hidden />
      Reintentar
    </Button>
  );
}
