/**
 * Borra los datos transaccionales (contactos, empresas, oportunidades, productos,
 * cotizaciones, pedidos, actividades) de la "Instancia de Pruebas", dejando intactos
 * la Instancia, los 7 usuarios y el Pipeline default. Útil para limpiar residuos que
 * dejan corridas de Playwright que fallan a mitad de camino, antes de re-sembrar con
 * `npm run db:seed:test`.
 *
 * Uso:
 *   npx tsx prisma/limpiar-datos-prueba.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generarSlug } from "../src/shared/lib/slug";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const slug = generarSlug("Instancia de Pruebas");
  const instancia = await prisma.instancia.findUnique({ where: { slug } });
  if (!instancia) {
    console.log("No existe la Instancia de Pruebas — nada que limpiar.");
    return;
  }

  const instanciaId = instancia.id;

  // Orden respeta dependencias de FK (hijos antes que padres).
  await prisma.disparadorJob.deleteMany({ where: { OR: [{ oportunidad: { instanciaId } }, { pedido: { instanciaId } }] } });
  await prisma.oportunidadConversacion.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.oportunidadTag.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.oportunidadProducto.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.oportunidadContacto.deleteMany({ where: { oportunidad: { instanciaId } } });
  await prisma.actividad.deleteMany({ where: { instanciaId } });
  await prisma.cotizacionLinea.deleteMany({ where: { cotizacion: { instanciaId } } });
  await prisma.cotizacion.deleteMany({ where: { instanciaId } });
  await prisma.entregaPedido.deleteMany({ where: { pedido: { instanciaId } } });
  await prisma.pedidoHistorial.deleteMany({ where: { pedido: { instanciaId } } });
  await prisma.pedidoHistorialEtapa.deleteMany({ where: { pedido: { instanciaId } } });
  await prisma.pedidoLinea.deleteMany({ where: { pedido: { instanciaId } } });
  await prisma.pedido.deleteMany({ where: { instanciaId } });
  await prisma.oportunidad.deleteMany({ where: { instanciaId } });
  await prisma.contactoTag.deleteMany({ where: { contacto: { instanciaId } } });
  await prisma.contactoIdentificadorCanal.deleteMany({ where: { instanciaId } });
  await prisma.contacto.deleteMany({ where: { instanciaId } });
  await prisma.empresa.deleteMany({ where: { instanciaId } });
  await prisma.producto.deleteMany({ where: { instanciaId } });
  await prisma.transportista.deleteMany({ where: { instanciaId } });

  console.log(`✓ Datos transaccionales de "${instancia.nombre}" eliminados (instancia, usuarios y pipeline intactos).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
