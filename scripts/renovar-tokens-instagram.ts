/**
 * Renueva los long-lived access tokens de las cuentas de Instagram conectadas
 * vía Instagram Login (proveedorAuth = "Instagram"). No toca cuentas del
 * flujo heredado (MetaFacebook) — ese sigue sin renovación automática, igual
 * que antes de este cambio.
 *
 * Regla de Meta: un long-lived token se puede refrescar en cualquier momento
 * mientras tenga al menos 24h de antigüedad y no haya expirado; el token
 * refrescado vale otros 60 días desde la fecha de renovación.
 * https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/
 *
 * Uso: `npx tsx scripts/renovar-tokens-instagram.ts`
 * Pensado para correr por cron/Task Scheduler cada pocos días (no hay un
 * scheduler genérico de tareas de mantenimiento en este proyecto — el worker
 * existente solo procesa disparadores de pipeline).
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { INSTAGRAM_LOGIN_GRAPH_VERSION } from '../src/conversaciones/providers/instagram-estrategia-auth'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const VENTANA_MINIMA_MS = 24 * 60 * 60 * 1000 // Meta exige >= 24h de antigüedad para refrescar

async function main() {
  const cuentas = await prisma.cuentaCanal.findMany({
    where: { canal: 'instagram', activa: true, proveedorAuth: 'Instagram' },
  })

  if (cuentas.length === 0) {
    console.log('No hay cuentas de Instagram (Instagram Login) activas para renovar.')
    return
  }

  console.log(`Revisando ${cuentas.length} cuenta(s) conectada(s) vía Instagram Login...\n`)

  for (const cuenta of cuentas) {
    const cfg = cuenta.configuracion as Record<string, unknown>
    const accessToken = cfg.accessToken as string | undefined

    if (!accessToken) {
      console.warn(`⚠️  ${cuenta.nombre}: sin accessToken en configuracion — se omite`)
      continue
    }

    const emitidoEn = cuenta.tokenRenovadoEn ?? cuenta.creadoEn
    const antiguedadMs = Date.now() - emitidoEn.getTime()
    if (antiguedadMs < VENTANA_MINIMA_MS) {
      console.log(`⏭️  ${cuenta.nombre}: token emitido hace menos de 24h — se omite por ahora`)
      continue
    }

    console.log(`🔄 ${cuenta.nombre} (${cuenta.identificador}): renovando...`)

    try {
      const res = await fetch(
        `https://graph.instagram.com/${INSTAGRAM_LOGIN_GRAPH_VERSION}/refresh_access_token` +
          `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: unknown }

      if (!json.access_token) {
        console.error(`   ❌ Meta no devolvió access_token nuevo:`, json.error ?? '(sin detalle)')
        console.error(`      Posible causa: token expirado o con menos de 24h. Reconectar manualmente si persiste.`)
        continue
      }

      const expiraEn = new Date(Date.now() + (json.expires_in ?? 60 * 24 * 60 * 60) * 1000)

      await prisma.cuentaCanal.update({
        where: { id: cuenta.id },
        data: {
          configuracion: { ...cfg, accessToken: json.access_token },
          tokenExpiraEn: expiraEn,
          tokenRenovadoEn: new Date(),
        },
      })

      console.log(`   ✅ Renovado — nuevo vencimiento: ${expiraEn.toISOString()}`)
    } catch (e) {
      console.error(`   ❌ Error de red renovando ${cuenta.nombre}:`, e instanceof Error ? e.message : e)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
