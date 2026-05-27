import { prisma } from "./prisma";

export async function obtenerOCrearInstancia() {
  const instancia = await prisma.instancia.findFirst();
  if (instancia) return instancia;

  return prisma.instancia.create({
    data: { nombre: "Mi Empresa", slug: "mi-empresa" },
  });
}
