import { ReactNode } from "react";
import { AppLayout } from "@/shared/ui/app-sidebar";
import { obtenerSesionActual } from "@/shared/auth/sesion";

export default async function CRMLayout({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesionActual();
  return (
    <AppLayout usuario={sesion ? { nombre: sesion.nombre, email: sesion.email } : null} rol={sesion?.rol}>
      {children}
    </AppLayout>
  );
}
