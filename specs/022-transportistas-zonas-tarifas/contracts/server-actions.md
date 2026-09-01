# Contratos: Server Actions

Todas siguen el patrón ya establecido en el proyecto: `requirePermisoAction(modulo, tipo)` → validar con Zod → verificar tenencia por `instanciaId` → mutar (+ registrar en `TransportistaHistorial` cuando aplica) → `revalidatePath` → `{ exito, data?, error? }` (o `ResultadoAccion<T>` donde ya se usa ese tipo).

## `src/sales/transportistas/actions.ts` (existente — corregido y extendido)

- **`crearTransportista(datos)`** — sin cambio de forma; ahora valida `requirePermisoAction("transportistas", "modificar")` (antes `"configuracion"`, corrección de la inconsistencia detectada en research.md). Al crear, siembra 3 `ServicioTransportista` (Estándar/Express/Personalizado) y una fila `CondicionesTransportista` con los valores por defecto de la tabla de datos. Registra `TransportistaHistorial{entidadTipo: TRANSPORTISTA, accion: "creado"}`.
- **`editarTransportista(datos)`** — extendido: `datos` ahora incluye `personaContacto?`, `telefono?`, `correoElectronico?`, `notasInternas?` (además de `nombre`/`tipo`/`estado` ya existentes). Valida `"transportistas"`. Registra `TransportistaHistorial{entidadTipo: TRANSPORTISTA, accion: "editado", valorAnterior, valorNuevo}`.
- **`toggleTransportista(id)`** — sin cambio de forma; valida `"transportistas"`. Registra `TransportistaHistorial{accion: "activado"|"desactivado"}`.
- **`listarCoberturaGeograficaAction` / `guardarCoberturaGeografica` / `eliminarCoberturaGeografica`** — **eliminadas** (modelo retirado, Decisión 1).

## `src/sales/transportistas/zonas/actions.ts` (nuevo)

- **`crearZonaEntrega({ nombre, descripcion?, ubicaciones: [{ paisId, provinciaEstado?, distritoCiudad?, corregimiento?, sectorOCodigoPostal? }] })`** — valida `"transportistas"` (`configurar zonas`, cubierto por el mismo módulo). Crea `ZonaEntrega` + sus `ZonaEntregaUbicacion` en una transacción. Rechaza nombre duplicado en la instancia (mismo criterio que `ZonaCobertura`).
- **`editarZonaEntrega({ id, nombre?, descripcion?, activa?, ubicaciones? })`** — reemplaza el set de ubicaciones si se envía `ubicaciones`.
- **`listarZonasEntregaAction(busqueda?)`** — lectura, `"transportistas"` `ver` — soporta `FR-013` (buscar por nombre).
- **`eliminarZonaEntrega(id)`** — solo si ninguna `TarifaTransportistaZona` la referencia; si tiene tarifas, error explicando que debe desactivarse desde ahí en su lugar.

## `src/sales/transportistas/tarifas/actions.ts` (nuevo)

- **`crearTarifa({ transportistaId, zonaEntregaId, servicioTransportistaId, costoInterno, precioCliente, tiempoMinimoDias?, tiempoMaximoDias?, vigenteDesde?, vigenteHasta? })`** — valida `"transportistas"` `modificar`. Rechaza `costoInterno < 0` / `precioCliente < 0` (Zod). Rechaza duplicado (`@@unique`, con verificación previa + captura `P2002` como resguardo, mismo patrón que `021-alias-proveedores-ia`). Si `precioCliente < costoInterno`, no bloquea — devuelve `{ exito: true, advertencia: "El precio al cliente es menor que el costo interno" }`. Registra `TransportistaHistorial{entidadTipo: TARIFA, accion: "creado"}`.
- **`editarTarifa({ id, ...mismosCampos })`** — mismas validaciones; registra `valorAnterior`/`valorNuevo` en el historial.
- **`duplicarTarifa(id, { zonaEntregaId?, servicioTransportistaId? })`** — lee la tarifa origen, crea una copia con la zona/servicio indicados (o los mismos si no se especifican, dejando que el usuario los cambie después) — implementa FR-018.
- **`toggleTarifa(id)`** — activa/desactiva. Registra `TransportistaHistorial{accion: "activada"|"desactivada"}`.
- **`eliminarTarifa(id)`** — solo si `id` no aparece en ningún `EntregaCotizacion.tarifaTransportistaZonaId`/`EntregaPedido.tarifaTransportistaZonaId` (FR-020); si aparece, `{ exito: false, error: "Esta tarifa ya fue usada — solo puede desactivarse" }`.
- **`aplicarCambioMasivo({ transportistaId, servicioTransportistaId, zonaEntregaIds: string[], cambios: { precioCliente?, costoInterno?, activa? } })`** — FR-021, aplica el mismo cambio a varias tarifas (zona×servicio×transportista) en una transacción; crea las tarifas que no existan aún para esas zonas si `crearSiNoExiste: true`.
- **`obtenerPromedioTarifas(transportistaId)`** — lectura: costo promedio y margen promedio de tarifas activas (FR-022).

## `src/sales/transportistas/condiciones/actions.ts` (nuevo)

- **`guardarCondicionesTransportista({ transportistaId, ...camposDeCondicionesTransportista })`** — upsert 1-1; valida `"transportistas"` `modificar`. Registra `TransportistaHistorial{entidadTipo: CONDICIONES, accion: "editado", valorAnterior, valorNuevo}`.

## `src/sales/cotizaciones/actions.ts` (existente — extendido)

- El input de crear/editar cotización gana campos opcionales de envío: `zonaEntregaId?`, `zonaAsignadaManualmente?` (bool), `servicioTransportistaId?`, `tarifaTransportistaZonaId?`, `costoManual?` (número, requiere permiso `"transportistas-costos" modificar`), `costoEnvioConfirmado?` (bool, default `true`; `false` = "por confirmar").
- Al guardar: si viene `tarifaTransportistaZonaId`, se lee esa tarifa (verificando que pertenece a la instancia y sigue activa/vigente) y se copian `costoInterno`→`costoInternoEnvio`, `precioCliente`→`costoEnvio` (el campo raíz ya existente). Si viene `costoManual`, se usa ese valor como `costoEnvio` y se registra `TransportistaHistorial{entidadTipo: COSTO_MANUAL, entidadId: entregaCotizacionId, accion: "costo_sobrescrito_manualmente"}`. Si `zonaAsignadaManualmente: true`, se registra `TransportistaHistorial{entidadTipo: ZONA_MANUAL, accion: "zona_cambiada_manualmente"}` con el usuario actual.
- **`aprobarCotizacion`** (existente) — sin cambio de firma; internamente ahora exige `costoEnvioConfirmado = true` antes de permitir el paso a pedido, salvo que `ConfiguracionEmpresa` tenga el flag nuevo `permiteConvertirSinConfirmarCostoEnvio = true` (FR-040).

## `src/sales/pedidos/...` (sin nuevas Server Actions)

`generarPedidoDesdeCotizacion` (servicio, no Server Action) se extiende para copiar los campos nuevos de `EntregaCotizacion` a `EntregaPedido` dentro de la misma transacción ya existente (ver contracts abajo, sección Servicio).

## Servicio interno — `generarPedidoDesdeCotizacion` (extendido, no Server Action)

En el bloque `entrega: cotizacion.entrega ? { create: {...} } : undefined` (`generar-pedido-desde-cotizacion.service.ts:136-153`) se agregan, dentro del mismo `create`: `zonaEntregaId`, `zonaAsignadaManualmente`, `servicioTransportistaId`, `tarifaTransportistaZonaId`, `costoInternoEnvio`, `costoEnvioConfirmado`, `costoManualAutorizadoPorId`, `corregimiento`, `sectorOCodigoPostal` — copiados 1:1 desde `cotizacion.entrega`, sin recalcular nada (Historia 3, FR-046/047).

## `src/configuracion/permisos` (sin Server Action nueva — cambio de mapa)

`PERMISOS` (`src/shared/auth/permisos.ts`) agrega la fila `"transportistas-costos"` para cada rol — por defecto `rw` para `OWNER`/`ADMIN`, `none` para el resto (mismo patrón conservador que hoy tiene `"transportistas"`).

## Reglas transversales

- Todo mensaje de error de duplicado/negocio es un mensaje fijo, nunca expone el código interno de Prisma (mismo criterio que `021-alias-proveedores-ia`).
- Toda consulta/mutación queda scopeada por `instanciaId` de la sesión (Principio V).
