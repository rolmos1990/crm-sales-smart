import { prisma } from "./prisma";

export async function obtenerOCrearInstancia() {
  const instancia = await prisma.instancia.findFirst();
  if (instancia) return instancia;

  return prisma.instancia.create({
    data: { nombre: "Mi Empresa", slug: "mi-empresa" },
  });
}

// Resuelve el instanciaId activo: env INSTANCIA_ID → primera instancia ACTIVA en DB.
// Usar en todos los lugares que necesiten el instanciaId cuando aún no hay auth.
export async function resolverInstanciaId(): Promise<string> {
  if (process.env.INSTANCIA_ID) return process.env.INSTANCIA_ID;

  const instancia = await prisma.instancia.findFirst({
    where: { estado: "ACTIVA" },
    select: { id: true },
  });
  if (!instancia) throw new Error("No hay instancia activa. Configura INSTANCIA_ID en .env");
  return instancia.id;
}
