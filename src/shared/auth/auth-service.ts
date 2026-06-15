"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/shared/db/prisma";
import { obtenerAuthProvider } from "@/shared/auth/provider";
import { LoginSchema, MENSAJE_LOGIN_INVALIDO, type LoginInput } from "@/shared/auth/schema";
import { estaBloqueado, limpiarBloqueo, registrarIntentoFallido } from "@/shared/auth/bloqueo";

export type ResultadoLogin = { error: string } | { error: null };

// Inicia sesión validando contra Supabase Auth y aplicando el bloqueo progresivo
// propio (complementario al rate limiting de Supabase). No revela si el email existe.
export async function iniciarSesion(input: LoginInput): Promise<ResultadoLogin> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) return { error: MENSAJE_LOGIN_INVALIDO };

  const { email, password } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (usuario && estaBloqueado(usuario)) {
    return { error: MENSAJE_LOGIN_INVALIDO };
  }

  const authProvider = obtenerAuthProvider();
  const resultado = await authProvider.iniciarSesionConPassword(email, password);

  if (resultado.error || !resultado.usuario) {
    if (usuario) {
      const nuevoEstadoBloqueo = registrarIntentoFallido(usuario);
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: nuevoEstadoBloqueo,
      });
    }
    return { error: MENSAJE_LOGIN_INVALIDO };
  }

  if (!usuario || usuario.estado !== "ACTIVO") {
    await authProvider.cerrarSesion();
    return { error: MENSAJE_LOGIN_INVALIDO };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      ...limpiarBloqueo(),
      authUserId: resultado.usuario.id,
      ultimoLogin: new Date(),
    },
  });

  return { error: null };
}

export async function cerrarSesion(): Promise<void> {
  await obtenerAuthProvider().cerrarSesion();
  redirect("/login");
}
