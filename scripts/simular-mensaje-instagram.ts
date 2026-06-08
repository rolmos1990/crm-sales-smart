/**
 * Simula un mensaje entrante de Instagram enviando un webhook falso al endpoint local.
 * Útil para probar el pipeline completo sin necesitar Meta configurado.
 *
 * Uso:
 *   npx tsx scripts/simular-mensaje-instagram.ts
 *   npx tsx scripts/simular-mensaje-instagram.ts --texto "Hola quiero info" --sender "123456789"
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
const textoIdx = args.indexOf('--texto')
const senderIdx = args.indexOf('--sender')
const textoArg = textoIdx !== -1 ? args[textoIdx + 1] : undefined
const senderArg = senderIdx !== -1 ? args[senderIdx + 1] : undefined

async function main() {
  // Buscar la cuenta de Instagram activa
  const cuentas = await prisma.cuentaCanal.findMany({
    where: { canal: 'instagram', activa: true },
    select: { id: true, nombre: true, identificador: true, instanciaId: true },
  })

  if (cuentas.length === 0) {
    console.error('❌ No hay cuentas de Instagram activas. Conecta una desde la app primero.')
    process.exit(1)
  }

  const cuenta = cuentas[0]
  console.log(`\n📱 Usando cuenta: ${cuenta.nombre} (igId: ${cuenta.identificador})`)
  console.log(`   Instancia: ${cuenta.instanciaId}\n`)

  const senderId   = senderArg ?? '9999999999'   // ID ficticio del usuario que escribe
  const texto      = textoArg  ?? 'Hola! Me interesa saber más sobre sus servicios.'
  const mid        = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Payload exactamente igual al que envía Meta
  const payload = {
    object: 'instagram',
    entry: [
      {
        id: cuenta.identificador,          // Instagram Business Account ID
        time: Math.floor(Date.now() / 1000),
        messaging: [
          {
            sender:    { id: senderId },
            recipient: { id: cuenta.identificador },
            timestamp: Date.now(),
            message: {
              mid,
              text: texto,
            },
          },
        ],
      },
    ],
  }

  const webhookUrl = `${APP_URL}/api/webhooks/instagram`
  console.log(`📤 Enviando webhook simulado a: ${webhookUrl}`)
  console.log(`   sender: ${senderId}`)
  console.log(`   texto:  "${texto}"`)
  console.log(`   mid:    ${mid}\n`)

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const body = await res.text()

  if (res.ok) {
    console.log(`✅ Webhook aceptado (${res.status}) — el job fue encolado en JobMensaje`)
    console.log('   Abre la página de Conversaciones en tu CRM para ver el mensaje.')
  } else {
    console.error(`❌ Webhook rechazado (${res.status}):`, body)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
