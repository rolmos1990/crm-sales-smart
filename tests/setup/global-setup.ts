import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Cargar DATABASE_URL desde archivos de entorno locales, luego vars de test encima
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.test' });

const emailsPrueba = [
  process.env.TEST_OWNER_EMAIL,
  process.env.TEST_ADMIN_EMAIL,
  process.env.TEST_AGENTE_VENTAS_EMAIL,
  process.env.TEST_EJECUTIVO_VENTAS_EMAIL,
  process.env.TEST_SUPERVISOR_EMAIL,
  process.env.TEST_AGENTE_SOPORTE_EMAIL,
  process.env.TEST_INVITADO_EMAIL,
].filter(Boolean) as string[];

export default async function globalSetup() {
  // Precalentar el servidor Next.js (dev mode compila rutas bajo demanda)
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${BASE_URL}/login`);
    await res.text();
    console.log('[global-setup] Servidor precalentado (/login compilado).');
  } catch {
    console.warn('[global-setup] No se pudo precalentar el servidor. ¿Está corriendo npm run dev?');
  }

  if (emailsPrueba.length === 0) return;

  const lista = emailsPrueba.map((e) => `'${e}'`).join(', ');
  const sql = `UPDATE "Usuario" SET "intentosFallidos" = 0, "bloqueadoHasta" = NULL, "nivelBloqueo" = 0 WHERE email IN (${lista});`;

  try {
    execSync('npx prisma db execute --stdin', {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    console.log('[global-setup] Bloqueos de usuarios de prueba limpiados.');
  } catch (err) {
    console.warn('[global-setup] No se pudo limpiar el bloqueo de usuarios de prueba:', err);
  }
}
