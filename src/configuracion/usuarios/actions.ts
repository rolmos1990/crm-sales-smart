"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { crearSupabaseAdminClient } from "@/shared/auth/provider/supabase-admin";
import { CrearUsuarioSchema, EditarUsuarioSchema } from "./schema";
import type { ResultadoAccion, ResultadoCrearUsuario } from "./types";

async function obtenerOrigin(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function crearUsuario(
  datos: unknown,
): Promise<ResultadoAccion<ResultadoCrearUsuario>> {
  const sesion = await requireSesion();
  if (sesion.rol !== "OWNER" && sesion.rol !== "ADMIN") {
    return { exito: false, error: "Solo el Owner o Admin pueden gestionar usuarios" };
  }

  const validado = CrearUsuarioSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { nombre, email, tipo, rol, cargo, telefono } = validado.data;

  const emailExistente = await prisma.usuarioInstancia.findFirst({
    where: {
      instanciaId: sesion.instanciaId,
      usuario: { email },
    },
  });
  if (emailExistente) {
    return { exito: false, error: "Ya existe un usuario con ese email en esta instancia" };
  }

  try {
    if (tipo === "AGENTE") {
      const usuario = await prisma.usuario.create({
        data: {
          nombre,
          email,
          tipo: "AGENTE",
          cargo: cargo || null,
          telefono: telefono || null,
          estado: "ACTIVO",
          rol,
        },
      });
      await prisma.usuarioInstancia.create({
        data: { usuarioId: usuario.id, instanciaId: sesion.instanciaId, rol, activo: true },
      });

      revalidatePath("/configuracion");
      return { exito: true, datos: {} };
    }

    // Tipo USUARIO: generar invite link via Supabase
    const origin = await obtenerOrigin();
    const admin = crearSupabaseAdminClient();

    // Intentar invite; si falla (usuario ya existe y confirmado), usar magiclink
    let authUserId: string;
    let inviteLink: string;

    const { data: inviteData, error: inviteError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${origin}/auth/callback` },
    });

    if (!inviteError && inviteData?.properties?.action_link) {
      authUserId = inviteData.user.id;
      inviteLink = inviteData.properties.action_link;
    } else {
      // Usuario ya existe y confirmado — generar magic link
      const { data: magicData, error: magicError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${origin}/auth/callback` },
      });
      if (magicError || !magicData?.properties?.action_link) {
        return { exito: false, error: "No se pudo generar el link de acceso" };
      }
      authUserId = magicData.user.id;
      inviteLink = magicData.properties.action_link;
    }

    const usuario = await prisma.usuario.upsert({
      where: { email },
      create: {
        nombre,
        email,
        tipo: "USUARIO",
        cargo: cargo || null,
        telefono: telefono || null,
        estado: "INVITADO",
        rol,
        authUserId,
      },
      update: {
        nombre,
        cargo: cargo || null,
        telefono: telefono || null,
        authUserId,
      },
    });

    await prisma.usuarioInstancia.upsert({
      where: { usuarioId_instanciaId: { usuarioId: usuario.id, instanciaId: sesion.instanciaId } },
      create: { usuarioId: usuario.id, instanciaId: sesion.instanciaId, rol, activo: true },
      update: { rol, activo: true },
    });

    revalidatePath("/configuracion");
    return { exito: true, datos: { inviteLink } };
  } catch {
    return { exito: false, error: "Error al crear el usuario" };
  }
}

export async function editarUsuario(
  usuarioInstanciaId: string,
  datos: unknown,
): Promise<ResultadoAccion<void>> {
  const sesion = await requireSesion();
  if (sesion.rol !== "OWNER" && sesion.rol !== "ADMIN") {
    return { exito: false, error: "Solo el Owner o Admin pueden gestionar usuarios" };
  }

  const validado = EditarUsuarioSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { nombre, rol, cargo, telefono } = validado.data;

  const ui = await prisma.usuarioInstancia.findFirst({
    where: { id: usuarioInstanciaId, instanciaId: sesion.instanciaId },
  });
  if (!ui) return { exito: false, error: "Usuario no encontrado en esta instancia" };

  try {
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: ui.usuarioId },
        data: { nombre, cargo: cargo || null, telefono: telefono || null },
      }),
      prisma.usuarioInstancia.update({
        where: { id: usuarioInstanciaId },
        data: { rol },
      }),
    ]);

    revalidatePath("/configuracion");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar el usuario" };
  }
}

export async function cambiarEstadoUsuario(
  usuarioInstanciaId: string,
  activar: boolean,
): Promise<ResultadoAccion<void>> {
  const sesion = await requireSesion();
  if (sesion.rol !== "OWNER" && sesion.rol !== "ADMIN") {
    return { exito: false, error: "Solo el Owner o Admin pueden gestionar usuarios" };
  }

  const ui = await prisma.usuarioInstancia.findFirst({
    where: { id: usuarioInstanciaId, instanciaId: sesion.instanciaId },
  });
  if (!ui) return { exito: false, error: "Usuario no encontrado en esta instancia" };

  try {
    await prisma.$transaction([
      prisma.usuarioInstancia.update({
        where: { id: usuarioInstanciaId },
        data: { activo: activar },
      }),
      prisma.usuario.update({
        where: { id: ui.usuarioId },
        data: { estado: activar ? "ACTIVO" : "SUSPENDIDO" },
      }),
    ]);

    revalidatePath("/configuracion");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al cambiar el estado del usuario" };
  }
}

export async function resetearPassword(email: string): Promise<ResultadoAccion<void>> {
  const sesion = await requireSesion();
  if (sesion.rol !== "OWNER" && sesion.rol !== "ADMIN") {
    return { exito: false, error: "Solo el Owner o Admin pueden gestionar usuarios" };
  }

  const ui = await prisma.usuarioInstancia.findFirst({
    where: { instanciaId: sesion.instanciaId, usuario: { email } },
    include: { usuario: { select: { tipo: true } } },
  });
  if (!ui) return { exito: false, error: "Usuario no encontrado en esta instancia" };
  if (ui.usuario.tipo !== "USUARIO") {
    return { exito: false, error: "Los Agentes del sistema no tienen contraseña" };
  }

  const origin = await obtenerOrigin();
  const admin = crearSupabaseAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) return { exito: false, error: "No se pudo enviar el email de reset" };
  return { exito: true, datos: undefined };
}

export async function generarLinkAcceso(
  usuarioInstanciaId: string,
): Promise<ResultadoAccion<{ link: string }>> {
  const sesion = await requireSesion();
  if (sesion.rol !== "OWNER" && sesion.rol !== "ADMIN") {
    return { exito: false, error: "Solo el Owner o Admin pueden gestionar usuarios" };
  }

  const ui = await prisma.usuarioInstancia.findFirst({
    where: { id: usuarioInstanciaId, instanciaId: sesion.instanciaId },
    include: { usuario: { select: { email: true, tipo: true } } },
  });
  if (!ui) return { exito: false, error: "Usuario no encontrado en esta instancia" };
  if (ui.usuario.tipo !== "USUARIO") {
    return { exito: false, error: "Los Agentes del sistema no tienen link de acceso" };
  }

  const origin = await obtenerOrigin();
  const admin = crearSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ui.usuario.email,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data?.properties?.action_link) {
    return { exito: false, error: "No se pudo generar el link de acceso" };
  }

  return { exito: true, datos: { link: data.properties.action_link } };
}
