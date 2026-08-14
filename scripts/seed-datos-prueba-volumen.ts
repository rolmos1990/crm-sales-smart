/**
 * Genera datos dummy de alto volumen para probar el comportamiento de la app
 * (listados, inbox de conversaciones, pipeline, reportes) bajo carga real.
 *
 * Crea, todo asociado a la única Empresa/Instancia existente (Suplenut):
 *   - 100 contactos, cada uno con 1 conversación de WhatsApp de 1000 mensajes
 *   - 500 contactos adicionales con 1000 oportunidades GANADAS repartidas entre ellos
 *
 * Todo lo generado queda marcado con metadata.seedDummy = true para poder
 * identificarlo y borrarlo después con `npm run script:limpiar-volumen-prueba`.
 *
 * Uso:
 *   npx tsx scripts/seed-datos-prueba-volumen.ts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------- Configuración de volumen ----------
const TOTAL_CONTACTOS_CONVERSACION = 100;
const MENSAJES_POR_CONVERSACION = 1000;
const TOTAL_CONTACTOS_OPORTUNIDAD = 500;
const TOTAL_OPORTUNIDADES = 1000;
const MAX_OPORTUNIDADES_POR_CONTACTO = 6;
const LOTE_MENSAJES = 2000;
const LOTE_OPORTUNIDADES = 500;

const SEED_BATCH_CONV = "conversaciones-2026-08";
const SEED_BATCH_OPP = "oportunidades-2026-08";
const CUENTA_CANAL_DUMMY_ID_EXTERNO = "demo-dummy-seed";

// ---------- Datos base para generar contenido variado ----------
const NOMBRES = [
  "Carlos", "María", "Juan", "Ana", "Pedro", "Lucía", "Diego", "Valeria", "Jorge", "Camila",
  "Luis", "Fernanda", "Miguel", "Daniela", "José", "Paula", "Andrés", "Gabriela", "Ricardo", "Sofía",
  "Manuel", "Carmen", "Alberto", "Rosa", "Fernando", "Patricia", "Raúl", "Silvia", "Eduardo", "Karina",
  "Óscar", "Melissa", "Gustavo", "Vanessa", "Iván", "Milagros", "Cristian", "Katherine", "Renzo", "Estefanía",
];
const APELLIDOS = [
  "Ramírez", "Torres", "Mendoza", "Flores", "Vargas", "Quispe", "Rojas", "Salazar", "Castillo", "Chávez",
  "Vega", "Rivera", "Cruz", "Reyes", "Gutiérrez", "Herrera", "Medina", "Aguilar", "Campos", "Cárdenas",
  "Núñez", "Paredes", "Zapata", "Delgado", "Espinoza", "Guerra", "León", "Palacios", "Romero", "Silva",
  "Huamán", "Ibáñez", "Contreras", "Peña", "Soto", "Bravo", "Cárdenas", "Ojeda", "Guevara", "Villanueva",
];

const FRASES_CONTACTO = [
  "Hola, buenas tardes, quería hacer una consulta 🙂",
  "¿Tienen stock disponible para esta semana?",
  "¿Cuál es el precio actual del combo?",
  "¿Hacen envíos a provincia?",
  "¿Cuánto demora la entrega a Lima?",
  "Perfecto, muchas gracias por la información",
  "¿Puedo pagar con tarjeta o solo por transferencia?",
  "¿Tienen algún descuento por compra al por mayor?",
  "Ya hice el pago, les envío el comprobante",
  "¿Me confirman cuando esté despachado?",
  "Buenas, ¿siguen con la promoción de este mes?",
  "¿Tienen catálogo actualizado?",
  "Quisiera cambiar la dirección de entrega",
  "¿A qué hora cierran hoy?",
  "Todo bien con el pedido anterior, gracias 👍",
  "¿Puedo recoger en tienda en vez de delivery?",
  "¿Cuál es el tiempo de garantía?",
  "Me interesa renovar el plan de este mes",
  "¿Tienen otro color u opción disponible?",
  "¿Cuánto sería el costo de envío?",
  "Ok, quedo atento a la confirmación",
  "¿Podrían llamarme cuando puedan?",
  "Disculpen la demora en responder, aquí sigo",
  "¿Aceptan Yape o Plin?",
  "Necesito factura, no boleta",
  "¿Cuál es el mínimo de compra?",
  "Genial, avísenme cuando salga a reparto",
  "¿Tienen sucursal más cerca de mi zona?",
  "Sí, confirmo el pedido tal como quedó",
  "¿Puedo cancelar y reprogramar la entrega?",
];

const FRASES_AGENTE = [
  "¡Hola! Claro, con gusto te ayudo 🙌",
  "Déjame revisar el stock, un momento por favor",
  "Sí, tenemos disponibilidad para esta semana",
  "El precio actual es el que aparece en el catálogo, te lo confirmo",
  "Sí, hacemos envíos a todo el país",
  "El envío a Lima demora entre 2 y 3 días hábiles",
  "Con gusto, aceptamos tarjeta, Yape, Plin y transferencia",
  "Sí, por compras al por mayor manejamos precio especial",
  "Perfecto, recibido el comprobante, gracias",
  "Claro, te aviso apenas quede despachado",
  "Sí, la promoción sigue vigente todo el mes",
  "Te comparto el catálogo actualizado en un momento",
  "Listo, ya actualicé la dirección de entrega",
  "Hoy cerramos a las 7pm",
  "Gracias por tu preferencia 🙏",
  "Sí, puedes recoger en tienda sin problema",
  "La garantía es de 30 días desde la entrega",
  "Perfecto, te genero la renovación ahora mismo",
  "Sí, tenemos otras opciones disponibles, te las muestro",
  "El envío tiene un costo de S/ 10 dentro de Lima",
  "Perfecto, quedo pendiente de la confirmación",
  "Claro, te llamamos en un rato",
  "No hay problema, gracias por avisar",
  "Sí, aceptamos Yape y Plin sin recargo",
  "Perfecto, te emitimos la factura con tus datos",
  "El mínimo de compra es de S/ 50",
  "Listo, te aviso apenas salga a reparto",
  "Sí, tenemos una sucursal cerca de tu zona",
  "Perfecto, pedido confirmado por nuestro lado",
  "Sin problema, ¿para qué fecha lo reprogramamos?",
];

const TITULOS_OPORTUNIDAD = [
  "Venta cerrada",
  "Pedido mayorista",
  "Renovación de suscripción",
  "Compra combo inicial",
  "Pedido recurrente",
  "Venta cruzada",
  "Upgrade de plan",
  "Pedido especial",
  "Compra por campaña",
  "Venta referida",
  "Pedido corporativo",
  "Compra por WhatsApp",
  "Venta showroom",
  "Pedido de temporada",
  "Compra recompra",
  "Venta directa",
  "Pedido express",
  "Compra por catálogo",
  "Venta fidelización",
  "Pedido a domicilio",
];

// ---------- Helpers ----------
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}
function randomFecha(desde: Date, hasta: Date): Date {
  return new Date(randomInt(desde.getTime(), hasta.getTime()));
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log("🌱 Sembrando datos dummy de alto volumen para pruebas de comportamiento...\n");

  const instancia = await prisma.instancia.findUnique({ where: { slug: "suplenut" } });
  if (!instancia) throw new Error('No se encontró la instancia "suplenut".');

  const owner = await prisma.usuario.findFirst({ where: { rol: "OWNER" } });
  if (!owner) throw new Error("No se encontró un usuario OWNER.");

  const pipeline = await prisma.pipeline.findFirst({
    where: { instanciaId: instancia.id, esDefault: true },
    include: { stages: true },
  });
  if (!pipeline) throw new Error("No se encontró el pipeline por defecto.");
  const stageGanado = pipeline.stages.find((s) => s.esGanado);
  if (!stageGanado) throw new Error('El pipeline no tiene una etapa marcada como "Ganado".');

  let empresa = await prisma.empresa.findFirst({ where: { instanciaId: instancia.id, nombre: "Suplenut" } });
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: { nombre: "Suplenut", instanciaId: instancia.id, usuarioId: owner.id },
    });
    console.log("✓ Empresa \"Suplenut\" creada (no existía ninguna Empresa aún)");
  } else {
    console.log(`✓ Usando Empresa "Suplenut" existente (${empresa.id})`);
  }

  let cuentaDummy = await prisma.cuentaCanal.findFirst({
    where: { instanciaId: instancia.id, identificador: CUENTA_CANAL_DUMMY_ID_EXTERNO },
  });
  if (!cuentaDummy) {
    cuentaDummy = await prisma.cuentaCanal.create({
      data: {
        canal: "whatsapp_lite",
        nombre: "DEMO Datos de prueba",
        identificador: CUENTA_CANAL_DUMMY_ID_EXTERNO,
        configuracion: {},
        activa: false, // nunca debe intentar sincronizar/enviar de verdad
        instanciaId: instancia.id,
      },
    });
    console.log("✓ Cuenta de canal dummy creada (inactiva, solo para agrupar conversaciones de prueba)");
  }

  const ahora = new Date();

  // =====================================================
  // 1) Contactos + conversaciones de 1000 mensajes
  // =====================================================
  console.log(
    `\n📇 Creando ${TOTAL_CONTACTOS_CONVERSACION} contactos con conversación de ${MENSAJES_POR_CONVERSACION} mensajes cada uno...`,
  );

  const contactosConv = Array.from({ length: TOTAL_CONTACTOS_CONVERSACION }, (_, i) => ({
    id: randomUUID(),
    nombre: pick(NOMBRES),
    apellido: pick(APELLIDOS),
    email: `demo.conv.${i + 1}@suplenut-demo.test`,
    telefonoPrincipal: `+51 9${String(10_000_000 + i).padStart(8, "0")}`,
    estado: "ACTIVO" as const,
    empresaId: empresa.id,
    usuarioId: owner.id,
    instanciaId: instancia.id,
    metadata: { seedDummy: true, seedBatch: SEED_BATCH_CONV },
  }));
  await prisma.contacto.createMany({ data: contactosConv });
  console.log(`✓ ${contactosConv.length} contactos creados`);

  const identificadores = contactosConv.map((c, i) => ({
    id: randomUUID(),
    canal: "whatsapp",
    identificador: `demo-conv-${String(i + 1).padStart(4, "0")}`,
    contactoId: c.id,
    instanciaId: instancia.id,
  }));
  await prisma.contactoIdentificadorCanal.createMany({ data: identificadores });

  const conversaciones = contactosConv.map((c, i) => ({
    id: randomUUID(),
    contactoId: c.id,
    cuentaCanalId: cuentaDummy!.id,
    instanciaId: instancia.id,
    estado: i % 5 === 0 ? ("CERRADA" as const) : ("ABIERTA" as const),
    clasificacion: i % 3 === 0 ? ("COMERCIAL" as const) : ("NINGUNA" as const),
  }));
  await prisma.conversacion.createMany({ data: conversaciones });
  console.log(`✓ ${conversaciones.length} conversaciones creadas`);

  console.log(`✉️  Generando ${TOTAL_CONTACTOS_CONVERSACION * MENSAJES_POR_CONVERSACION} mensajes (en lotes de ${LOTE_MENSAJES})...`);
  let loteMensajes: Prisma.MensajeConversacionCreateManyInput[] = [];
  let totalMensajesCreados = 0;

  for (const conv of conversaciones) {
    let cursor = new Date(ahora.getTime() - randomInt(10, 90) * 86_400_000);
    for (let i = 0; i < MENSAJES_POR_CONVERSACION; i++) {
      const esContacto = i % 2 === 0;
      cursor = new Date(cursor.getTime() + randomInt(1, 20) * 60_000);
      loteMensajes.push({
        id: randomUUID(),
        conversacionId: conv.id,
        contenido: esContacto ? pick(FRASES_CONTACTO) : pick(FRASES_AGENTE),
        tipo: "TEXTO",
        remitente: esContacto ? "CONTACTO" : "AGENTE",
        estado: esContacto ? "RECIBIDO" : "LEIDO",
        creadoEn: cursor,
        enviadoEn: esContacto ? null : cursor,
        leidoEn: cursor,
      });
      if (loteMensajes.length >= LOTE_MENSAJES) {
        await prisma.mensajeConversacion.createMany({ data: loteMensajes });
        totalMensajesCreados += loteMensajes.length;
        process.stdout.write(`\r   ${totalMensajesCreados} mensajes insertados...`);
        loteMensajes = [];
      }
    }
  }
  if (loteMensajes.length) {
    await prisma.mensajeConversacion.createMany({ data: loteMensajes });
    totalMensajesCreados += loteMensajes.length;
  }
  console.log(`\n✓ ${totalMensajesCreados} mensajes creados`);

  // =====================================================
  // 2) Contactos + oportunidades ganadas
  // =====================================================
  console.log(
    `\n💰 Creando ${TOTAL_CONTACTOS_OPORTUNIDAD} contactos con ${TOTAL_OPORTUNIDADES} oportunidades GANADAS repartidas entre ellos...`,
  );

  const contactosOpp = Array.from({ length: TOTAL_CONTACTOS_OPORTUNIDAD }, (_, i) => ({
    id: randomUUID(),
    nombre: pick(NOMBRES),
    apellido: pick(APELLIDOS),
    email: `demo.opp.${i + 1}@suplenut-demo.test`,
    telefonoPrincipal: `+51 9${String(20_000_000 + i).padStart(8, "0")}`,
    estado: "ACTIVO" as const,
    empresaId: empresa.id,
    usuarioId: owner.id,
    instanciaId: instancia.id,
    metadata: { seedDummy: true, seedBatch: SEED_BATCH_OPP },
  }));
  await prisma.contacto.createMany({ data: contactosOpp });
  console.log(`✓ ${contactosOpp.length} contactos creados`);

  // 1 oportunidad base por contacto + el resto repartido al azar (algunos contactos
  // terminan con varias oportunidades, como pidió el usuario).
  const cantidadPorContacto = new Array(TOTAL_CONTACTOS_OPORTUNIDAD).fill(1);
  let restantes = TOTAL_OPORTUNIDADES - TOTAL_CONTACTOS_OPORTUNIDAD;
  while (restantes > 0) {
    const idx = randomInt(0, TOTAL_CONTACTOS_OPORTUNIDAD - 1);
    if (cantidadPorContacto[idx] < MAX_OPORTUNIDADES_POR_CONTACTO) {
      cantidadPorContacto[idx]++;
      restantes--;
    }
  }

  const oportunidades: Prisma.OportunidadCreateManyInput[] = [];
  const oportunidadContactos: Prisma.OportunidadContactoCreateManyInput[] = [];

  for (let ci = 0; ci < TOTAL_CONTACTOS_OPORTUNIDAD; ci++) {
    for (let n = 0; n < cantidadPorContacto[ci]; n++) {
      const oppId = randomUUID();
      const fechaGanada = randomFecha(new Date(ahora.getTime() - 365 * 86_400_000), ahora);
      const creadoEn = new Date(fechaGanada.getTime() - randomInt(3, 45) * 86_400_000);
      const contacto = contactosOpp[ci];

      oportunidades.push({
        id: oppId,
        titulo: `${pick(TITULOS_OPORTUNIDAD)} — ${contacto.nombre} ${contacto.apellido}`,
        valor: randomInt(150, 8000),
        moneda: "PEN",
        etapa: "GANADO",
        probabilidad: 100,
        pipelineId: pipeline.id,
        stageId: stageGanado.id,
        empresaId: empresa.id,
        usuarioId: owner.id,
        instanciaId: instancia.id,
        fechaCierre: fechaGanada,
        fechaGanada,
        creadoEn,
        metadata: { seedDummy: true, seedBatch: SEED_BATCH_OPP },
      });
      oportunidadContactos.push({ oportunidadId: oppId, contactoId: contacto.id, principal: true });
    }
  }

  for (const lote of chunk(oportunidades, LOTE_OPORTUNIDADES)) {
    await prisma.oportunidad.createMany({ data: lote });
  }
  console.log(`✓ ${oportunidades.length} oportunidades ganadas creadas`);

  for (const lote of chunk(oportunidadContactos, LOTE_OPORTUNIDADES * 2)) {
    await prisma.oportunidadContacto.createMany({ data: lote });
  }
  console.log(`✓ ${oportunidadContactos.length} relaciones oportunidad-contacto creadas`);

  // =====================================================
  // Resumen final
  // =====================================================
  const [totalContactosDummy, totalOportunidadesDummy, totalConversacionesDummy] = await Promise.all([
    prisma.contacto.count({ where: { metadata: { path: ["seedDummy"], equals: true } } }),
    prisma.oportunidad.count({ where: { metadata: { path: ["seedDummy"], equals: true } } }),
    prisma.conversacion.count({ where: { cuentaCanalId: cuentaDummy.id } }),
  ]);

  console.log("\n✅ Seed de volumen completado.");
  console.log(`   Contactos dummy totales:      ${totalContactosDummy}`);
  console.log(`   Conversaciones dummy:         ${totalConversacionesDummy}`);
  console.log(`   Mensajes creados esta corrida: ${totalMensajesCreados}`);
  console.log(`   Oportunidades dummy (GANADO): ${totalOportunidadesDummy}`);
  console.log(`\n   Para borrar todo esto luego: npm run script:limpiar-volumen-prueba`);
}

main()
  .catch((e) => {
    console.error("❌ Error en seed de volumen:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
