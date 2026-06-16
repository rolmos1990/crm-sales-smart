/**
 * Script de limpieza de datos de la base de datos.
 * Conserva: Instancia, Pipeline, PipelineStage
 * Borra: todo lo demás (usuarios, datos CRM, conversaciones, productos, config, etc.)
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Iniciando limpieza de datos...\n')

  const results: Record<string, number> = {}

  await prisma.$transaction(async (tx) => {
    // --- Cola de jobs ---
    results.JobMensaje = (await tx.jobMensaje.deleteMany()).count
    results.JobSistema = (await tx.jobSistema.deleteMany()).count
    results.DisparadorJob = (await tx.disparadorJob.deleteMany()).count

    // --- Conversaciones y mensajes ---
    results.MensajeConversacion = (await tx.mensajeConversacion.deleteMany()).count
    results.OportunidadConversacion = (await tx.oportunidadConversacion.deleteMany()).count
    results.Conversacion = (await tx.conversacion.deleteMany()).count
    results.ContactoIdentificadorCanal = (await tx.contactoIdentificadorCanal.deleteMany()).count
    results.CuentaCanal = (await tx.cuentaCanal.deleteMany()).count

    // --- Valores de campos personalizados ---
    results.CampoPersonalizadoValor = (await tx.campoPersonalizadoValor.deleteMany()).count

    // --- Relaciones de oportunidades ---
    results.OportunidadContacto = (await tx.oportunidadContacto.deleteMany()).count
    results.OportunidadProducto = (await tx.oportunidadProducto.deleteMany()).count
    results.OportunidadTag = (await tx.oportunidadTag.deleteMany()).count

    // --- Actividades, líneas de pedido/cotización ---
    results.Actividad = (await tx.actividad.deleteMany()).count
    results.PedidoLinea = (await tx.pedidoLinea.deleteMany()).count
    results.CotizacionLinea = (await tx.cotizacionLinea.deleteMany()).count

    // --- Documentos de ventas ---
    results.Pedido = (await tx.pedido.deleteMany()).count
    results.Cotizacion = (await tx.cotizacion.deleteMany()).count

    // --- Oportunidades ---
    results.Oportunidad = (await tx.oportunidad.deleteMany()).count

    // --- Contactos y empresas ---
    results.ContactoTag = (await tx.contactoTag.deleteMany()).count
    results.Contacto = (await tx.contacto.deleteMany()).count
    results.Empresa = (await tx.empresa.deleteMany()).count

    // --- Tags y productos ---
    results.Tag = (await tx.tag.deleteMany()).count
    results.Producto = (await tx.producto.deleteMany()).count

    // --- Disparadores (los stages se conservan) ---
    results.Disparador = (await tx.disparador.deleteMany()).count

    // --- Campos personalizados ---
    results.CampoPersonalizado = (await tx.campoPersonalizado.deleteMany()).count

    // --- Configuración y archivos ---
    results.MediaArchivo = (await tx.mediaArchivo.deleteMany()).count
    results.PlantillaCRM = (await tx.plantillaCRM.deleteMany()).count
    results.ConfiguracionEmpresa = (await tx.configuracionEmpresa.deleteMany()).count
    results.IntegracionInstancia = (await tx.integracionInstancia.deleteMany()).count
    results.EventoLog = (await tx.eventoLog.deleteMany()).count

    // --- Usuarios ---
    results.UsuarioInstancia = (await tx.usuarioInstancia.deleteMany()).count
    results.Usuario = (await tx.usuario.deleteMany()).count
  }, { timeout: 30000 })

  console.log('Registros eliminados por tabla:')
  for (const [tabla, count] of Object.entries(results)) {
    if (count > 0) console.log(`  ${tabla}: ${count}`)
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0)
  console.log(`\nTotal eliminado: ${total} registros`)
  console.log('\nConservado: Instancia, Pipeline, PipelineStage')
  console.log('Limpieza completada.')
}

main()
  .catch((e) => {
    console.error('Error durante la limpieza:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
