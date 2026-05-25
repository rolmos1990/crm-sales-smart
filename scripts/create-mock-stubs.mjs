/**
 * Genera stubs mínimos de @/generated/prisma/ para que el compilador de
 * Turbopack pueda resolver los `import type` sin necesitar la base de datos
 * ni ejecutar `prisma generate`.
 *
 * Se ejecuta automáticamente vía `npm run premock` antes de `npm run mock`.
 * Los archivos son sobreescritos al ejecutar `prisma generate` en modo normal.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = join(__dirname, "../src/generated/prisma");

mkdirSync(generatedDir, { recursive: true });

const clientStub = `\
// Stub para modo mock — reemplazado por \`prisma generate\` en modo normal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class PrismaClient {
  constructor(_options?: Record<string, unknown>) {}
  $connect(): Promise<void> { return Promise.resolve(); }
  $disconnect(): Promise<void> { return Promise.resolve(); }
}
`;

const enumsStub = `\
// Stub para modo mock — reemplazado por \`prisma generate\` en modo normal.
export type Rol = "ADMIN" | "AGENTE";
export type EstadoContacto = "ACTIVO" | "INACTIVO" | "LEAD";
export type Etapa =
  | "PROSPECTO"
  | "CALIFICADO"
  | "PROPUESTA"
  | "NEGOCIACION"
  | "GANADO"
  | "PERDIDO";
export type TipoActividad = "LLAMADA" | "EMAIL" | "REUNION" | "TAREA" | "NOTA";
export type EstadoCotizacion =
  | "BORRADOR"
  | "ENVIADA"
  | "APROBADA"
  | "RECHAZADA"
  | "VENCIDA";
export type EstadoPedido =
  | "PENDIENTE"
  | "CONFIRMADO"
  | "EN_PROCESO"
  | "ENVIADO"
  | "ENTREGADO"
  | "CANCELADO";
`;

writeFileSync(join(generatedDir, "client.ts"), clientStub);
writeFileSync(join(generatedDir, "enums.ts"), enumsStub);

console.log("[mock] Stubs creados en src/generated/prisma/");
