import "dotenv/config";
import { prisma } from "@/shared/db/prisma";
import { asegurarFlujoPreparacion } from "@/sales/preparacion/servicios/asegurar-flujo-preparacion";
import { moverPreparacion } from "@/sales/preparacion/servicios/mover-preparacion";

const I = "cmsxugqtt00030ipj7gg5jybb";

(async () => {
  const flujo = await asegurarFlujoPreparacion(I);
  const inicial = flujo.estados.find(e => e.esInicial)!;
  const final = flujo.estados.find(e => e.esFinal)!;

  const prep = await prisma.preparacionPedido.findFirst({
    where: { estadoId: inicial.id, pedido: { lineas: { some: {} } } },
    select: { pedidoId: true, estadoId: true, pedido: { select: { numero: true } } },
  });
  if (!prep) throw new Error("sin candidato");

  const antes = await prisma.pedidoLinea.findMany({
    where: { pedidoId: prep.pedidoId },
    select: { id: true, cantidad: true, cantidadPreparada: true, preparadaEn: true },
  });
  console.log(`pedido ${prep.pedido.numero} — líneas antes:`);
  for (const l of antes) console.log(`  ${Number(l.cantidadPreparada)}/${Number(l.cantidad)} preparadaEn=${l.preparadaEn ? "sí" : "no"}`);

  const t0 = Date.now();
  const r = await moverPreparacion({
    pedidoId: prep.pedidoId, estadoDestinoId: final.id, estadoEsperadoId: prep.estadoId,
    instanciaId: I, usuarioId: null,
  });
  console.log(`mover al estado final: ${JSON.stringify(r)} en ${Date.now() - t0} ms`);

  const despues = await prisma.pedidoLinea.findMany({
    where: { pedidoId: prep.pedidoId },
    select: { cantidad: true, cantidadPreparada: true, preparadaEn: true },
  });
  console.log("líneas después:");
  for (const l of despues) console.log(`  ${Number(l.cantidadPreparada)}/${Number(l.cantidad)} preparadaEn=${l.preparadaEn ? "sí" : "no"}`);
  const todas = despues.every(l => Number(l.cantidadPreparada) >= Number(l.cantidad));
  console.log(`TODAS marcadas: ${todas}`);

  // Retroceso: las líneas deben QUEDAR marcadas
  await moverPreparacion({
    pedidoId: prep.pedidoId, estadoDestinoId: inicial.id, estadoEsperadoId: final.id,
    instanciaId: I, usuarioId: null,
  });
  const trasRetroceso = await prisma.pedidoLinea.findMany({
    where: { pedidoId: prep.pedidoId }, select: { cantidad: true, cantidadPreparada: true },
  });
  console.log(`tras retroceder, siguen marcadas: ${trasRetroceso.every(l => Number(l.cantidadPreparada) >= Number(l.cantidad))}`);

  // Restaura el estado original de las líneas
  for (const l of antes) {
    await prisma.pedidoLinea.update({ where: { id: l.id }, data: { cantidadPreparada: l.cantidadPreparada, preparadaEn: l.preparadaEn } });
  }
  await prisma.preparacionHistorial.deleteMany({ where: { preparacion: { pedidoId: prep.pedidoId }, usuarioId: null } });
  console.log("datos de prueba restaurados");
  await prisma.$disconnect();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
