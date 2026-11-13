// Cuándo el selector de provincia debe olvidar lo elegido porque cambió el
// país. Función pura para poder cubrirla con tests: el proyecto no tiene
// testing-library, y esta decisión ya borró datos guardados una vez.
//
// El caso que destapó el problema: en modo UN_SOLO_PAIS el formulario no pide
// país, así que lo guarda como null y para el selector usa el país de
// operación de la instancia — que llega por una consulta asíncrona. En el
// primer render el país vale null y un instante después vale el real; sin
// esta guarda, ese null → real se interpretaba como "el usuario cambió de
// país" y limpiaba la provincia que acababa de cargarse de la base.
//
// Y al limpiarse la provincia desaparecía todo el bloque de opciones de
// envío, que es donde vive el check "Costo de entrega por confirmar": la
// cotización se abría a editar como si nunca se hubiera elegido un destino.

export function debeLimpiarEstadoProvincia(params: {
  /** País en el render anterior. */
  paisAnterior: string | null;
  paisActual: string | null;
  estadoProvinciaActual: string | null;
}): boolean {
  const { paisAnterior, paisActual, estadoProvinciaActual } = params;

  // Nada que limpiar.
  if (estadoProvinciaActual === null) return false;
  // El país es el mismo: la provincia sigue siendo válida.
  if (paisAnterior === paisActual) return false;
  // Todavía no había país: esto es la resolución inicial, no un cambio del
  // usuario. El selector está deshabilitado sin país, así que nadie pudo
  // haber elegido una provincia que no corresponda.
  if (paisAnterior === null) return false;

  // Cambió de un país real a otro (o se vació): la provincia ya no aplica.
  return true;
}
