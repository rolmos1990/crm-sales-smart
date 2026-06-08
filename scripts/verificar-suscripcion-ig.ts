/**
 * Verifica y repara la suscripción de la página de Facebook al webhook de Instagram.
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const IG_GRAPH = 'https://graph.facebook.com/v20.0'

async function main() {
  const cuentas = await prisma.cuentaCanal.findMany({
    where: { canal: 'instagram', activa: true },
  })

  if (cuentas.length === 0) {
    console.error('❌ No hay cuentas de Instagram activas.')
    process.exit(1)
  }

  for (const cuenta of cuentas) {
    const cfg = cuenta.configuracion as Record<string, unknown>
    const accessToken = cfg.accessToken as string
    const pageId      = cfg.pageId      as string
    const pageName    = cfg.pageName    as string

    console.log(`\n📄 Página: ${pageName} (${pageId})`)
    console.log(`   Cuenta: ${cuenta.nombre}`)

    // 1. Verificar suscripción actual
    console.log('\n   🔍 Verificando suscripción actual...')
    const getRes = await fetch(
      `${IG_GRAPH}/${pageId}/subscribed_apps?access_token=${accessToken}`,
      { cache: 'no-store' }
    )
    const getJson = await getRes.json() as { data?: Array<{ name: string; subscribed_fields: string[] }>; error?: unknown }

    if (getJson.error) {
      console.log(`   ❌ Error al consultar: ${JSON.stringify(getJson.error)}`)
    } else if (!getJson.data || getJson.data.length === 0) {
      console.log('   ⚠️  La página NO está suscrita a ninguna app')
    } else {
      const appSub = getJson.data[0]
      const tieneMessages = appSub.subscribed_fields?.includes('messages')
      console.log(`   App suscrita: ${appSub.name}`)
      console.log(`   Campos: ${appSub.subscribed_fields?.join(', ') ?? 'ninguno'}`)
      console.log(`   messages suscrito: ${tieneMessages ? '✅ SÍ' : '❌ NO'}`)
      if (tieneMessages) {
        console.log('\n   ✅ Suscripción correcta. El problema está en otro lado.')
        continue
      }
    }

    // 2. Reparar suscripción
    console.log('\n   🔧 Suscribiendo la página al webhook messages...')
    const postRes = await fetch(
      `${IG_GRAPH}/${pageId}/subscribed_apps?subscribed_fields=messages&access_token=${accessToken}`,
      { method: 'POST', cache: 'no-store' }
    )
    const postJson = await postRes.json() as { success?: boolean; error?: unknown }

    if (postJson.success) {
      console.log('   ✅ Suscripción creada correctamente')
    } else {
      console.log(`   ❌ No se pudo suscribir: ${JSON.stringify(postJson.error)}`)
      console.log('\n   💡 Posible causa: el access_token puede estar vencido.')
      console.log('      Reconecta la cuenta desde la app para renovarlo.')
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
