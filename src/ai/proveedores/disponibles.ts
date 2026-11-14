import type { ProveedorIAEnum } from "@/generated/prisma/enums";

// Qué proveedores tienen implementación de verdad.
//
// El enum de Prisma lista seis, pero solo algunos tienen su archivo en
// src/ai/proveedores/ y su registro en inicializar.ts. Elegir uno de los
// otros se guardaba sin una queja y después fallaba en runtime con
// "Proveedor IA no registrado" — un error que queda SOLO en el log del
// servidor, porque seleccionarProveedor lo captura y sigue al siguiente
// proveedor activo. El negocio creía estar probando un modelo y en realidad
// seguía corriendo con otro.
//
// Esta lista vive en un archivo sin dependencias de servidor para que la
// puedan importar tanto la Server Action que valida el alta como el
// formulario del navegador. `inicializar.test.ts` la mantiene sincronizada
// con el registro real: si alguien agrega un proveedor y se olvida de
// registrarlo (o al revés), el test lo dice.
export const PROVEEDORES_IMPLEMENTADOS = ["ANTHROPIC", "DEEPSEEK", "NVIDIA", "OPENAI"] as const;

export type ProveedorImplementado = (typeof PROVEEDORES_IMPLEMENTADOS)[number];

export function estaImplementado(proveedor: string): proveedor is ProveedorImplementado {
  return (PROVEEDORES_IMPLEMENTADOS as readonly string[]).includes(proveedor);
}

/** Mensaje para el negocio: por qué no puede elegir ese proveedor. */
export function mensajeProveedorNoImplementado(proveedor: ProveedorIAEnum | string): string {
  return (
    `El proveedor ${proveedor} todavía no está implementado en Karia. ` +
    `Disponibles: ${PROVEEDORES_IMPLEMENTADOS.join(", ")}.`
  );
}
