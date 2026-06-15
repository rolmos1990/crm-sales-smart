import { cookies } from "next/headers";
import { prisma } from "@/shared/db/prisma";
import { obtenerAuthProvider } from "@/shared/auth/provider";
import type { Rol } from "@/generated/prisma/enums";

export type SesionActual = {
  usuarioId: string;
  nombre: string;
  email: string;
  instanciaId: string;
  usuarioInstanciaId: string;
  rol: Rol;
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
        include: { instancia: true },
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
  };
}

// Variante estricta para Server Actions/Server Components que requieren sesión.
// Lanza si no hay sesión válida; usar obtenerSesionActual() cuando null sea un caso válido.
export async function requireSesion(): Promise<SesionActual> {
  const sesion = await obtenerSesionActual();
  if (!sesion) throw new Error("No autenticado");
  return sesion;
}
