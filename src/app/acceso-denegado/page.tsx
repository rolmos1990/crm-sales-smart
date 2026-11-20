import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { AppErrorScreen } from "@/shared/ui/app-error-screen";

export default function AccesoDenegadoPage() {
  return (
    <AppErrorScreen
      Icono={ShieldAlert}
      titulo="No tienes acceso a este módulo"
      descripcion="Tu rol no tiene permiso para ver esta sección. Si crees que es un error, contacta a un administrador de tu cuenta."
      accion={<ButtonLink href="/crm">Volver al inicio</ButtonLink>}
    />
  );
}
