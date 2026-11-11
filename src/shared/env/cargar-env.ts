// Carga de variables para procesos fuera de Next.js (Prisma CLI, worker).
// Mismo orden que Next: `.env.local` gana sobre `.env` (dotenv no
// sobrescribe una variable ya definida). En producción no existe
// `.env.local` y las variables vienen del entorno, así que no cambia nada.
// Debe importarse por efecto secundario ANTES que cualquier módulo que lea
// process.env al cargarse.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
