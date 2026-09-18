/**
 * @deprecated Movido a `@/shared/fechas/zona` — es un kernel transversal, no
 * una utilidad de pedidos (ya lo importaban `crm/oportunidades` y
 * `sales/flujo-venta`). Este shim mantiene compilando a los importadores
 * existentes; se elimina cuando se reescriban sus imports.
 */
export * from "@/shared/fechas/zona";
