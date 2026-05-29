import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

const convs = await prisma.conversacion.deleteMany({});
console.log("Conversaciones eliminadas:", convs.count);

const ops = await prisma.oportunidad.updateMany({ data: { nuevoMensaje: false } });
console.log("Flags nuevoMensaje reseteados:", ops.count);

await prisma.$disconnect();
