import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/shared/db/prisma";
import { obtenerAuthProvider } from "@/shared/auth/provider";
import { normalizarZonaNegocio } from "@/shared/fechas/negocio";
import type { Rol } from "@/generated/prisma/enums";

export type SesionActual = {
  usuarioId: string;
  nombre: string;
  email: string;
  instanciaId: string;
  usuarioInstanciaId: string;
  rol: Rol;
  /**
   * Zona IANA preferida por el usuario, o null para heredar la de la empresa.
   * SOLO presentación — ver src/shared/fechas/presentacion.ts.
   */
  zonaHoraria: string | null;
  /**
   * Zona de negocio del tenant. Única fuente válida para rangos de día,
   * filtros, KPIs y cuotas — ver src/shared/fechas/negocio.ts. Viaja en la
   * sesión porque sale del mismo findUnique, sin query extra.
   */
  zonaNegocio: string;
};

// Resuelve la sesión actual combinando el usuario de Supabase con los datos de
// autorización propios (Usuario, UsuarioInstancia, rol). Retorna null si no hay
// sesión válida, el usuario no está ACTIVO, o no pertenece a ninguna instancia.
export async function obtenerSesionActual(): Promise<SesionActual | null> {
  const authUsuario = await obtenerAuthProvider().obtenerUsuarioActual();
  if (!authUsuario) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { authUserId: authUsuario.id },
    include: {
      instancias: {
        where: { activo: true },
        // La configuración de la empresa se trae acá, en la misma query, para
        // que la zona de negocio viaje en la sesión sin costar un round-trip
        // extra en cada request.
        include: {
          instancia: { include: { configuracionEmpresa: { select: { zonaHoraria: true } } } },
        },
      },
    },
  });

  if (!usuario || usuario.estado !== "ACTIVO") return null;
  if (usuario.instancias.length === 0) return null;

  const cookieStore = await cookies();
  const instanciaIdCookie = cookieStore.get("instanciaId")?.value;

  const usuarioInstancia =
    usuario.instancias.find(
      (ui) => ui.instanciaId === instanciaIdCookie && ui.instancia.estado === "ACTIVA",
    ) ?? usuario.instancias.find((ui) => ui.instancia.estado === "ACTIVA");

  if (!usuarioInstancia) return null;

  return {
    usuarioId: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    instanciaId: usuarioInstancia.instanciaId,
    usuarioInstanciaId: usuarioInstancia.id,
    rol: usuarioInstancia.rol,
    zonaHoraria: usuario.zonaHoraria,
    zonaNegocio: normalizarZonaNegocio(
      usuarioInstancia.instancia.configuracionEmpresa?.zonaHoraria,
    ),
  };
}

// Variante estricta para Server Actions/Server Components que requieren sesión.
// Lanza si no hay sesión válida; usar obtenerSesionActual() cuando null sea un caso válido.
export async function requireSesion(): Promise<SesionActual> {
  const sesion = await obtenerSesionActual();
  if (!sesion) redirect("/login");
  return sesion;
}
