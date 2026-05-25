// Punto de entrada alternativo de la capa de datos en modo mock.
// Turbopack lo sustituye por @/shared/db/prisma cuando USE_MOCK=true.
// Las queries, actions y páginas no necesitan cambio alguno.
export { mockPrisma as prisma } from "@/mocks/mock-prisma";
