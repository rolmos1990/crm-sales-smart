/**
 * Simula un mensaje entrante de WhatsApp enviando un webhook falso al endpoint local.
 * Útil para probar el pipeline completo sin necesitar un teléfono real conectado.
 *
 * Uso:
 *   npx tsx scripts/simular-mensaje-whatsapp.ts
 *   npx tsx scripts/simular-mensaje-whatsapp.ts --telefono 51987654321 --texto "Hola!" --nombre "Carlos"
 *   npx tsx scripts/simular-mensaje-whatsapp.ts --cuentaId cm9we123456 --telefono 51987654321 --texto "Precio?"
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Siempre usar localhost para pruebas locales — no pasar por ngrok
const APP_URL = 'http://localhost:3000'

// Parsear argumentos opcionales
const args = process.argv.slice(2)
const get = (flag: string) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}

const telefonoArg  = get('--telefono')
const textoArg     = get('--texto')
const nombreArg    = get('--nombre')
const cuentaIdArg  = get('--cuentaId')

async function main() {
  let cuentaCanalId = cuentaIdArg

  if (!cuentaCanalId) {
    const cuentas = await prisma.cuentaCanal.findMany({
      where: { canal: 'whatsapp_lite', activa: true },
      select: { id: true, nombre: true, identificador: true, instanciaId: true },
    })

    if (cuentas.length === 0) {
      console.error('❌ No hay cuentas de WhatsApp activas. Conecta una desde la app primero.')
      process.exit(1)
    }

    const cuenta = cuentas[0]
    console.log(`\n📱 Usando cuenta: ${cuenta.nombre} (${cuenta.identificador})`)
    console.log(`   Instancia: ${cuenta.instanciaId}\n`)
    cuentaCanalId = cuenta.id
  } else {
    console.log(`\n📱 Usando cuentaCanalId: ${cuentaCanalId}\n`)
  }

  const telefono = telefonoArg ?? '51999888777'
  const texto    = textoArg    ?? 'Hola! Me interesa saber más sobre sus servicios.'
  const nombre   = nombreArg
  const idExterno = `wamid.TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  // Payload exactamente igual al que envía el adaptador whatsapp_lite
  const payload: Record<string, unknown> = {
    from:         `${telefono}@s.whatsapp.net`,
    text:         texto,
    id:           idExterno,
    cuentaCanalId,
  }

  if (nombre) payload.pushName = nombre

  const webhookUrl = `${APP_URL}/api/webhooks/whatsapp_lite`
  console.log(`📤 Enviando webhook simulado a: ${webhookUrl}`)
  console.log(`   from:    ${telefono}@s.whatsapp.net`)
  console.log(`   texto:   "${texto}"`)
  if (nombre) console.log(`   nombre:  "${nombre}"`)
  console.log(`   id:      ${idExterno}\n`)

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const body = await res.text()

  if (res.ok) {
    console.log(`✅ Webhook aceptado (${res.status}) — el mensaje fue encolado para procesamiento`)
    console.log('   Abre la página de Conversaciones en tu CRM para ver el mensaje.')
  } else {
    console.error(`❌ Webhook rechazado (${res.status}):`, body)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
