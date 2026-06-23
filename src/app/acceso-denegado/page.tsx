import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";

export default function AccesoDenegadoPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        Icono={ShieldAlert}
        titulo="No tienes acceso a este módulo"
        descripcion="Tu rol no tiene permiso para ver esta sección. Si crees que es un error, contacta a un administrador de tu cuenta."
        accion={<ButtonLink href="/crm">Volver al inicio</ButtonLink>}
      />
    </div>
  );
}
