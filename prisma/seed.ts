import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Sembrando datos de ejemplo...");

  // Limpiar datos existentes
  await prisma.eventoLog.deleteMany();
  await prisma.actividad.deleteMany();
  await prisma.oportunidadProducto.deleteMany();
  await prisma.oportunidadContacto.deleteMany();
  await prisma.oportunidad.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.cotizacionLinea.deleteMany();
  await prisma.cotizacion.deleteMany();
  await prisma.pedidoLinea.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.contacto.deleteMany();
  await prisma.empresa.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.usuario.deleteMany();

  // Usuario admin
  const admin = await prisma.usuario.create({
    data: {
      nombre: "Admin",
      email: "admin@empresa.com",
      passwordHash: "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu39.",
      rol: "ADMIN",
    },
  });
  console.log("✓ Usuario admin creado");

  // Productos
  const [producto1, producto2, producto3] = await Promise.all([
    prisma.producto.create({
      data: {
        nombre: "Software CRM Básico",
        descripcion: "Licencia mensual del módulo CRM básico",
        precio: 299.00,
        moneda: "PEN",
        categoria: "Software",
        unidad: "licencia/mes",
        activo: true,
      },
    }),
    prisma.producto.create({
      data: {
        nombre: "Consultoría de Implementación",
        descripcion: "Servicio de consultoría para implementación del sistema",
        precio: 1500.00,
        moneda: "PEN",
        categoria: "Servicios",
        unidad: "hora",
        activo: true,
      },
    }),
    prisma.producto.create({
      data: {
        nombre: "Soporte Técnico Premium",
        descripcion: "Plan de soporte técnico dedicado 24/7",
        precio: 450.00,
        moneda: "PEN",
        categoria: "Soporte",
        unidad: "mes",
        activo: true,
      },
    }),
  ]);
  console.log("✓ 3 productos creados");

  // Empresas
  const [empresa1, empresa2, empresa3] = await Promise.all([
    prisma.empresa.create({
      data: {
        nombre: "TechPeru SAC",
        ruc: "20123456789",
        industria: "Tecnología",
        tamano: "MEDIANA",
        sitioWeb: "https://techperu.com.pe",
        telefono: "+51 1 234-5678",
        email: "contacto@techperu.com.pe",
        notas: "Cliente potencial en sector tecnológico. Interesados en digitalizar sus procesos.",
        usuarioId: admin.id,
      },
    }),
    prisma.empresa.create({
      data: {
        nombre: "Distribuidora Lima Norte SRL",
        ruc: "20987654321",
        industria: "Distribución",
        tamano: "PEQUEÑA",
        telefono: "+51 1 678-9012",
        email: "ventas@limanorte.com.pe",
        notas: "Empresa familiar con 15 años en el mercado.",
        usuarioId: admin.id,
      },
    }),
    prisma.empresa.create({
      data: {
        nombre: "Grupo Inversiones Sur",
        ruc: "20456789123",
        industria: "Finanzas",
        tamano: "GRANDE",
        sitioWeb: "https://gisurinversiones.pe",
        telefono: "+51 54 321-0987",
        email: "info@gisurinversiones.pe",
        usuarioId: admin.id,
      },
    }),
  ]);
  console.log("✓ 3 empresas creadas");

  // Contactos
  const [c1, c2, c3, c4, c5] = await Promise.all([
    prisma.contacto.create({
      data: {
        nombre: "Carlos",
        apellido: "Ramírez",
        email: "c.ramirez@techperu.com.pe",
        telefonoPrincipal: "+51 987 654 321",
        cargo: "Gerente de TI",
        estado: "ACTIVO",
        empresaId: empresa1.id,
        usuarioId: admin.id,
      },
    }),
    prisma.contacto.create({
      data: {
        nombre: "María",
        apellido: "Torres",
        email: "m.torres@techperu.com.pe",
        telefonoPrincipal: "+51 976 543 210",
        cargo: "CTO",
        estado: "ACTIVO",
        empresaId: empresa1.id,
        usuarioId: admin.id,
      },
    }),
    prisma.contacto.create({
      data: {
        nombre: "Juan",
        apellido: "Mendoza",
        email: "jmendoza@limanorte.com.pe",
        telefonoPrincipal: "+51 965 432 109",
        cargo: "Gerente General",
        estado: "ACTIVO",
        empresaId: empresa2.id,
        usuarioId: admin.id,
      },
    }),
    prisma.contacto.create({
      data: {
        nombre: "Ana",
        apellido: "Flores",
        email: "ana.flores@gisurinversiones.pe",
        telefonoPrincipal: "+51 954 321 098",
        cargo: "Directora Comercial",
        estado: "ACTIVO",
        empresaId: empresa3.id,
        usuarioId: admin.id,
      },
    }),
    prisma.contacto.create({
      data: {
        nombre: "Pedro",
        apellido: "Vargas",
        email: "pvargas@gmail.com",
        telefonoPrincipal: "+51 943 210 987",
        cargo: "Emprendedor",
        estado: "LEAD",
        usuarioId: admin.id,
      },
    }),
  ]);
  console.log("✓ 5 contactos creados");

  const hoy = new Date();
  const en30dias = new Date(hoy.getTime() + 30 * 86400000);
  const en60dias = new Date(hoy.getTime() + 60 * 86400000);
  const en15dias = new Date(hoy.getTime() + 15 * 86400000);

  // Oportunidades
  const [op1, op2] = await Promise.all([
    prisma.oportunidad.create({
      data: {
        titulo: "Implementación CRM TechPeru",
        valor: 15000.00,
        moneda: "PEN",
        etapa: "PROPUESTA",
        probabilidad: 60,
        fechaCierre: en30dias,
        notas: "El cliente solicitó cotización formal. Reunión de presentación agendada.",
        empresaId: empresa1.id,
        usuarioId: admin.id,
        contactos: {
          create: [{ contactoId: c1.id }, { contactoId: c2.id }],
        },
        productos: {
          create: [
            { productoId: producto1.id, cantidad: 12, precioUnitario: 299.00, descuento: 10 },
            { productoId: producto2.id, cantidad: 20, precioUnitario: 1500.00, descuento: 0 },
          ],
        },
      },
    }),
    prisma.oportunidad.create({
      data: {
        titulo: "Soporte Anual Lima Norte",
        valor: 5400.00,
        moneda: "PEN",
        etapa: "CALIFICADO",
        probabilidad: 40,
        fechaCierre: en60dias,
        notas: "Interesados en plan de soporte premium anual.",
        empresaId: empresa2.id,
        usuarioId: admin.id,
        contactos: {
          create: [{ contactoId: c3.id }],
        },
        productos: {
          create: [
            { productoId: producto3.id, cantidad: 12, precioUnitario: 450.00, descuento: 0 },
          ],
        },
      },
    }),
  ]);
  console.log("✓ 2 oportunidades creadas");

  // Actividades
  await Promise.all([
    prisma.actividad.create({
      data: {
        tipo: "REUNION",
        titulo: "Presentación de propuesta CRM",
        descripcion: "Reunión para presentar la propuesta técnica y comercial al equipo de TechPeru.",
        fecha: en15dias,
        contactoId: c1.id,
        empresaId: empresa1.id,
        oportunidadId: op1.id,
        usuarioId: admin.id,
      },
    }),
    prisma.actividad.create({
      data: {
        tipo: "LLAMADA",
        titulo: "Seguimiento cotización Lima Norte",
        descripcion: "Llamar a Juan Mendoza para hacer seguimiento de la cotización enviada.",
        fecha: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 10, 0),
        contactoId: c3.id,
        empresaId: empresa2.id,
        oportunidadId: op2.id,
        usuarioId: admin.id,
      },
    }),
    prisma.actividad.create({
      data: {
        tipo: "EMAIL",
        titulo: "Enviar términos y condiciones",
        descripcion: "Enviar el documento de T&C del contrato de soporte a Ana Flores.",
        fecha: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 14, 30),
        contactoId: c4.id,
        empresaId: empresa3.id,
        usuarioId: admin.id,
      },
    }),
    prisma.actividad.create({
      data: {
        tipo: "TAREA",
        titulo: "Preparar demo del sistema",
        descripcion: "Configurar el ambiente de demo con datos de ejemplo para TechPeru.",
        fecha: en15dias,
        oportunidadId: op1.id,
        usuarioId: admin.id,
        completada: false,
      },
    }),
    prisma.actividad.create({
      data: {
        tipo: "NOTA",
        titulo: "Contacto inicial Pedro Vargas",
        descripcion: "Pedro mostró interés en el módulo CRM. Referido por Carlos Ramírez.",
        fecha: hoy,
        contactoId: c5.id,
        usuarioId: admin.id,
        completada: true,
        completadaEn: hoy,
      },
    }),
  ]);
  console.log("✓ 5 actividades creadas");

  // Cotización de ejemplo
  const subtotalCot = 299.00 * 6;
  const impuestoCot = subtotalCot * 0.18;
  const totalCot = subtotalCot + impuestoCot;
  await prisma.cotizacion.create({
    data: {
      numero: "COT-2026-001",
      estado: "BORRADOR",
      fechaVencimiento: en30dias,
      subtotal: subtotalCot,
      impuesto: impuestoCot,
      total: totalCot,
      moneda: "PEN",
      notas: "Cotización inicial para plan básico de 6 meses.",
      contactoId: c1.id,
      empresaId: empresa1.id,
      usuarioId: admin.id,
      lineas: {
        create: [
          {
            descripcion: "CRM Básico — 6 meses",
            productoId: producto1.id,
            cantidad: 6,
            precioUnitario: 299.00,
            descuento: 0,
            subtotal: subtotalCot,
          },
        ],
      },
    },
  });
  console.log("✓ 1 cotización creada");

  // Pipeline por defecto
  await prisma.pipeline.create({
    data: {
      nombre: "Pipeline de ventas",
      esDefault: true,
      activo: true,
      stages: {
        create: [
          { nombre: "Prospecto",   color: "#818cf8", orden: 0, probabilidad: 10,  esInicial: true,  esGanado: false, esPerdido: false },
          { nombre: "Calificado",  color: "#22d3ee", orden: 1, probabilidad: 25,  esInicial: false, esGanado: false, esPerdido: false },
          { nombre: "Propuesta",   color: "#fbbf24", orden: 2, probabilidad: 50,  esInicial: false, esGanado: false, esPerdido: false },
          { nombre: "Negociación", color: "#f97316", orden: 3, probabilidad: 75,  esInicial: false, esGanado: false, esPerdido: false },
          { nombre: "Ganado",      color: "#4ade80", orden: 4, probabilidad: 100, esInicial: false, esGanado: true,  esPerdido: false },
          { nombre: "Perdido",     color: "#fb7185", orden: 5, probabilidad: 0,   esInicial: false, esGanado: false, esPerdido: true  },
        ],
      },
    },
  });
  console.log("✓ Pipeline por defecto creado");

  console.log("\n✅ Seed completado exitosamente.");
  console.log("   Email admin: admin@empresa.com");
  console.log("   Password:    password123");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
