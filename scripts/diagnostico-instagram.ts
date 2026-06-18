import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('\n══════════════════════════════════════════')
  console.log('  DIAGNÓSTICO INSTAGRAM — PIPELINE MENSAJES')
  console.log('══════════════════════════════════════════\n')

  // 1. Cuentas de canal Instagram
  const cuentas = await prisma.cuentaCanal.findMany({
    where: { canal: 'instagram' },
    select: { id: true, nombre: true, identificador: true, instanciaId: true, activa: true },
  })
  console.log(`📱 CUENTAS INSTAGRAM (${cuentas.length}):`)
  cuentas.forEach(c => {
    console.log(`   ${c.activa ? '✅' : '❌'} ${c.nombre}`)
    console.log(`      id:          ${c.id}`)
    console.log(`      identificador (igId): ${c.identificador}`)
    console.log(`      instanciaId: ${c.instanciaId ?? '⚠️  NULL — este es un problema'}`)
  })

  // 2. Cola de mensajes (ahora via RabbitMQ — revisar management UI en :15672)
  console.log('\n📬 COLA DE MENSAJES: Los jobs ahora van a RabbitMQ (crm.comando.mensaje.entrante)')
  console.log('   Revisar en http://localhost:15672 (management UI)')

  // 3. Instancias
  const instancias = await prisma.instancia.findMany({
    select: { id: true, nombre: true, slug: true, estado: true },
  })
  console.log(`\n🏢 INSTANCIAS (${instancias.length}):`)
  if (instancias.length === 0) {
    console.log('   ⚠️  NO HAY INSTANCIAS — el sistema multitenancy no está configurado')
    console.log('        Esto impide que los mensajes se vinculen correctamente.')
  }
  instancias.forEach(i => console.log(`   ${i.estado === 'ACTIVA' ? '✅' : '❌'} ${i.nombre} (${i.id})`))

  // 4. Conversaciones recientes
  const convs = await prisma.conversacion.findMany({
    orderBy: { actualizadoEn: 'desc' },
    take: 5,
    select: { id: true, estado: true, actualizadoEn: true, cuentaCanalId: true, instanciaId: true,
      contacto: { select: { nombre: true, apellido: true } },
      _count: { select: { mensajes: true } }
    },
  })
  console.log(`\n💬 CONVERSACIONES RECIENTES (${convs.length}):`)
  if (convs.length === 0) console.log('   Sin conversaciones')
  convs.forEach(c => {
    console.log(`   [${c.estado}] ${c.contacto.nombre} ${c.contacto.apellido} — ${c._count.mensajes} mensajes`)
    console.log(`      instanciaId: ${c.instanciaId ?? '⚠️  NULL'}`)
  })

  console.log('\n══════════════════════════════════════════')

  // Diagnóstico final
  const problemas: string[] = []
  const cuentaSinInstancia = cuentas.find(c => !c.instanciaId)
  if (cuentaSinInstancia) problemas.push('CuentaCanal de Instagram sin instanciaId — los mensajes no se pueden asociar a ninguna instancia')
  if (instancias.length === 0) problemas.push('No existe ninguna Instancia en la BD — la app necesita al menos una')

  if (problemas.length > 0) {
    console.log('\n🚨 PROBLEMAS DETECTADOS:')
    problemas.forEach((p, i) => console.log(`   ${i + 1}. ${p}`))
  } else {
    console.log('\n✅ Sin problemas estructurales detectados')
  }
  console.log()
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
