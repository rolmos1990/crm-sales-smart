import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppLayout } from "@/shared/ui/app-sidebar";
import { obtenerSesionActual } from "@/shared/auth/sesion";
import { obtenerPreferenciasFechaEfectivas } from "@/shared/fechas/presentacion";

/**
 * Shell autenticado común a todas las secciones de la app.
 *
 * Existe para tener un único lugar donde resolver sesión y preferencias de
 * fecha: antes los seis layouts de sección (`crm`, `sales`, `configuracion`,
 * `datos`, `productos`, `integraciones`) eran byte a byte idénticos, y
 * agregarles el provider de zona horaria habría significado repetir lo mismo
 * seis veces más.
 *
 * No puede vivir en `src/app/layout.tsx`: ese está por encima de la
 * autenticación, así que no hay `instanciaId` con el que resolver la zona.
 */
export async function LayoutAppServidor({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesionActual();
  if (!sesion) redirect("/login");

  const preferenciasFecha = await obtenerPreferenciasFechaEfectivas({
    instanciaId: sesion.instanciaId,
    zonaUsuario: sesion.zonaHoraria,
  });

  return (
    <AppLayout
      usuario={{ nombre: sesion.nombre, email: sesion.email }}
      rol={sesion.rol}
      preferenciasFecha={preferenciasFecha}
    >
      {children}
    </AppLayout>
  );
}
