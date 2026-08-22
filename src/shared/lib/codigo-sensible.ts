/**
 * Único punto donde se decide "el cliente puede saber que hay un código/
 * licencia configurado" sin que el valor real salga nunca de una query
 * function hacia un componente cliente — mismo criterio ya usado para
 * ProveedorIA.apiKeyEncriptada (ver src/configuracion/ia/queries.ts:
 * "La API key nunca se devuelve al cliente"), generalizado acá para
 * ProductoEntregaDigital/EntregaDigitalCotizacion/EntregaDigitalPedido.codigo.
 *
 * Usar en toda query que haga `include`/`select` de un registro con
 * `codigo` y cuyo resultado pueda llegar a un Server/Client Component:
 * traer `codigo` de Prisma está bien, pero la función SIEMPRE debe pasar el
 * resultado por acá antes de devolverlo.
 */
export function ocultarCodigo<T extends { codigo: string | null } | null | undefined>(
  registro: T
): (Omit<NonNullable<T>, "codigo"> & { tieneCodigoConfigurado: boolean }) | null {
  if (!registro) return null;
  const { codigo, ...resto } = registro;
  return { ...resto, tieneCodigoConfigurado: !!codigo };
}

/** Acción que el cliente puede pedir sobre un código/licencia ya
 *  configurado — nunca se modela como un string enmascarado. */
export type CodigoAccion = "CONSERVAR" | "REEMPLAZAR";

/**
 * Resuelve el código/licencia efectivo a persistir, del lado del servidor
 * — el cliente nunca manda el valor real salvo que esté reemplazándolo
 * explícitamente.
 *
 * - REEMPLAZAR con un valor no vacío → usa ese valor nuevo (recortado).
 * - REEMPLAZAR con un valor vacío → limpia el código (null).
 * - CONSERVAR, o sin acción (nada configurado todavía) → deja
 *   `valorExistente` tal cual estaba.
 */
export function resolverCodigoEfectivo(
  input: { codigoAccion?: CodigoAccion; codigoNuevo?: string },
  valorExistente: string | null
): string | null {
  if (input.codigoAccion === "REEMPLAZAR") {
    const nuevo = input.codigoNuevo?.trim();
    return nuevo ? nuevo : null;
  }
  return valorExistente;
}
