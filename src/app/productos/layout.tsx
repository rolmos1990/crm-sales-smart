import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppLayout } from "@/shared/ui/app-sidebar";
import { obtenerSesionActual } from "@/shared/auth/sesion";

export default async function ProductosLayout({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesionActual();
  if (!sesion) redirect("/login");
  return (
    <AppLayout usuario={{ nombre: sesion.nombre, email: sesion.email }} rol={sesion.rol}>
      {children}
    </AppLayout>
  );
}
