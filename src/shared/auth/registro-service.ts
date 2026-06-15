"use server";

import { prisma } from "@/shared/db/prisma";
import { obtenerAuthProvider } from "@/shared/auth/provider";
import { generarSlug } from "@/shared/lib/slug";
import {
  RegistroSchema,
  MENSAJE_REGISTRO_INVALIDO,
  type RegistroInput,
} from "@/shared/auth/schema";

export type ResultadoRegistro = { error: string } | { error: null };

async function generarSlugUnico(nombreEmpresa: string): Promise<string> {
  const base = generarSlug(nombreEmpresa);

  let slug = base;
  let sufijo = 2;
  while (await prisma.instancia.findUnique({ where: { slug } })) {
    slug = `${base}-${sufijo}`;
    sufijo += 1;
  }

  return slug;
}

// Crea la primera cuenta (empresa + usuario OWNER) y la deja activa de inmediato.
export async function registrarEmpresa(input: RegistroInput): Promise<ResultadoRegistro> {
  const parsed = RegistroSchema.safeParse(input);
  if (!parsed.success) return { error: MENSAJE_REGISTRO_INVALIDO };

  const { nombre, empresa, email, password } = parsed.data;

  const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
  if (usuarioExistente) {
    return { error: "Ya existe una cuenta con este correo. Inicia sesión." };
  }

  const authProvider = obtenerAuthProvider();
  const resultado = await authProvider.registrarUsuario(email, password);

  if (resultado.error || !resultado.usuario) {
    return { error: MENSAJE_REGISTRO_INVALIDO };
  }

  const authUserId = resultado.usuario.id;
  const slug = await generarSlugUnico(empresa);

  try {
    await prisma.$transaction(async (tx) => {
      const instancia = await tx.instancia.create({
        data: { nombre: empresa, slug, estado: "ACTIVA" },
      });

      const usuario = await tx.usuario.create({
        data: {
          nombre,
          email,
          authUserId,
          estado: "ACTIVO",
          rol: "OWNER",
          passwordHash: null,
        },
      });

      await tx.usuarioInstancia.create({
        data: { usuarioId: usuario.id, instanciaId: instancia.id, rol: "OWNER", activo: true },
      });
    });
  } catch {
    await authProvider.eliminarUsuarioAuth(authUserId);
    return { error: MENSAJE_REGISTRO_INVALIDO };
  }

  const inicio = await authProvider.iniciarSesionConPassword(email, password);
  if (inicio.error) {
    return { error: MENSAJE_REGISTRO_INVALIDO };
  }

  return { error: null };
}
