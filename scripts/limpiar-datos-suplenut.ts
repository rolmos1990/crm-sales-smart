/**
 * Limpieza general de datos transaccionales de la instancia "Suplenut".
 *
 * Borra: Contactos, Conversaciones (+mensajes), Empresas, Actividades,
 * Etiquetas (Tag), Cotizaciones, Pedidos, Productos, Oportunidades — y todas
 * las tablas de unión/dependientes de esas (OportunidadContacto,
 * CampoPersonalizadoValor, líneas de cotización/pedido, etc.).
 *
 * Conserva (para poder seguir logueando y no perder configuración):
 * Instancia, Usuario, UsuarioInstancia, Pipeline, PipelineStage,
 * CampoPersonalizado, Disparador, CuentaCanal, ConfiguracionEmpresa,
 * IntegracionInstancia, PlantillaCRM.
 *
 * Uso:
 *   npx tsx scripts/limpiar-datos-suplenut.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SLUG_INSTANCIA = "suplenut";

async function main() {
  const instancia = await prisma.instancia.findUnique({ where: { slug: SLUG_INSTANCIA } });
  if (!instancia) {
    console.log(`No existe la instancia "${SLUG_INSTANCIA}" — nada que limpiar.`);
    return;
  }
  const instanciaId = instancia.id;
  console.log(`🧹 Limpiando datos transaccionales de "${instancia.nombre}" (${instanciaId})...\n`);

  const results: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    // --- Jobs de disparadores ligados a oportunidad/pedido (se conservan los Disparador en sí) ---
    results.DisparadorJob = (
      await tx.disparadorJob.deleteMany({
        where: { OR: [{ oportunidad: { instanciaId } }, { pedido: { instanciaId } }] },
      })
    ).count;

    // --- Conversaciones y mensajes ---
    results.MensajeConversacion = (
      await tx.mensajeConversacion.deleteMany({ where: { conversacion: { instanciaId } } })
    ).count;
    results.OportunidadConversacion = (
      await tx.oportunidadConversacion.deleteMany({ where: { oportunidad: { instanciaId } } })
    ).count;
    results.Conversacion = (await tx.conversacion.deleteMany({ where: { instanciaId } })).count;
    results.ContactoIdentificadorCanal = (
      await tx.contactoIdentificadorCanal.deleteMany({ where: { instanciaId } })
    ).count;

    // --- Valores de campos personalizados (se conservan las definiciones CampoPersonalizado) ---
    results.CampoPersonalizadoValor = (
      await tx.campoPersonalizadoValor.deleteMany({
        where: {
          OR: [
            { oportunidad: { instanciaId } },
            { contacto: { instanciaId } },
            { empresa: { instanciaId } },
            { pedido: { instanciaId } },
            { cotizacion: { instanciaId } },
          ],
        },
      })
    ).count;

    // --- Relaciones de oportunidades ---
    results.OportunidadContacto = (
      await tx.oportunidadContacto.deleteMany({ where: { oportunidad: { instanciaId } } })
    ).count;
    results.OportunidadProducto = (
      await tx.oportunidadProducto.deleteMany({ where: { oportunidad: { instanciaId } } })
    ).count;
    results.OportunidadTag = (
      await tx.oportunidadTag.deleteMany({ where: { oportunidad: { instanciaId } } })
    ).count;

    // --- Etiquetas de contacto ---
    results.ContactoTag = (
      await tx.contactoTag.deleteMany({ where: { contacto: { instanciaId } } })
    ).count;

    // --- Actividades ---
    results.Actividad = (await tx.actividad.deleteMany({ where: { instanciaId } })).count;

    // --- Cotizaciones ---
    results.CotizacionLinea = (
      await tx.cotizacionLinea.deleteMany({ where: { cotizacion: { instanciaId } } })
    ).count;
    results.Cotizacion = (await tx.cotizacion.deleteMany({ where: { instanciaId } })).count;

    // --- Pedidos ---
    results.EntregaPedido = (
      await tx.entregaPedido.deleteMany({ where: { pedido: { instanciaId } } })
    ).count;
    results.PedidoHistorial = (
      await tx.pedidoHistorial.deleteMany({ where: { pedido: { instanciaId } } })
    ).count;
    results.PedidoHistorialEtapa = (
      await tx.pedidoHistorialEtapa.deleteMany({ where: { pedido: { instanciaId } } })
    ).count;
    results.PedidoLinea = (
      await tx.pedidoLinea.deleteMany({ where: { pedido: { instanciaId } } })
    ).count;
    results.Pedido = (await tx.pedido.deleteMany({ where: { instanciaId } })).count;

    // --- Oportunidades ---
    results.Oportunidad = (await tx.oportunidad.deleteMany({ where: { instanciaId } })).count;

    // --- Etiquetas (globales de la instancia) ---
    results.Tag = (await tx.tag.deleteMany({ where: { instanciaId } })).count;

    // --- Contactos y empresas ---
    results.Contacto = (await tx.contacto.deleteMany({ where: { instanciaId } })).count;
    results.Empresa = (await tx.empresa.deleteMany({ where: { instanciaId } })).count;

    // --- Productos ---
    results.Producto = (await tx.producto.deleteMany({ where: { instanciaId } })).count;
  }, { timeout: 120_000 });

  console.log("Registros eliminados por tabla:");
  for (const [tabla, count] of Object.entries(results)) {
    if (count > 0) console.log(`  ${tabla}: ${count}`);
  }
  const total = Object.values(results).reduce((a, b) => a + b, 0);
  console.log(`\nTotal eliminado: ${total} registros`);
  console.log('\nConservado: Instancia, Usuario, UsuarioInstancia, Pipeline, PipelineStage,');
  console.log('            CampoPersonalizado, Disparador, CuentaCanal, ConfiguracionEmpresa, etc.');
  console.log("\n✅ Limpieza completada. Puedes seguir logueando con tu usuario de siempre.");
}

main()
  .catch((e) => {
    console.error("❌ Error durante la limpieza:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
