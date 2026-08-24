import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { renovarTokenInstagram } from "@/integraciones/instagram/conectar";

// Cuántos días antes del vencimiento se intenta renovar. Meta permite
// renovar mientras al menos falten 24h; se deja margen amplio para tolerar
// que el cron no corra un día puntual sin arriesgar que el token expire.
const DIAS_ANTES_DE_VENCER = 10;

/**
 * Cron diario (ver vercel.json) que renueva los tokens de Instagram Login
 * próximos a vencer — sin esto las cuentas dejan de funcionar
 * silenciosamente a los ~60 días (ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md,
 * hallazgo #3). Alcance deliberadamente acotado: solo renueva, sin UI de
 * estado ni notificación si una cuenta falla — queda logueado en el
 * response y en consola para revisión manual.
 */
export async function GET(req: NextRequest) {
  // Vercel Cron agrega automáticamente este header cuando la env var
  // CRON_SECRET está configurada en el proyecto — no hace falta (ni se
  // puede) declarar headers custom en vercel.json.
  // https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const secretEsperado = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secretEsperado || authHeader !== `Bearer ${secretEsperado}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const limite = new Date(Date.now() + DIAS_ANTES_DE_VENCER * 24 * 60 * 60 * 1000);

  const cuentas = await prisma.cuentaCanal.findMany({
    where: {
      canal: "instagram",
      activa: true,
      proveedorAuth: "Instagram",
      tokenExpiraEn: { lt: limite },
    },
    select: { id: true, nombre: true },
  });

  const resultados = await Promise.all(
    cuentas.map(async (cuenta) => {
      const resultado = await renovarTokenInstagram(cuenta.id);
      if (!resultado.renovado) {
        console.error(`[Cron IG Token] Falló la renovación de "${cuenta.nombre}" (${cuenta.id}): ${resultado.error}`);
      }
      return { cuentaCanalId: cuenta.id, nombre: cuenta.nombre, ...resultado };
    }),
  );

  return NextResponse.json({
    revisadas: cuentas.length,
    renovadas: resultados.filter((r) => r.renovado).length,
    resultados,
  });
}
